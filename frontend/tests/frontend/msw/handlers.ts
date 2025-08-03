// tests/frontend/msw/handlers.ts
import { http, HttpResponse } from "msw";

/** In-memory DB for tests */
type Reviewer = {
    name: string;
    email: string;
    role: "reviewer" | "admin";
    active: boolean;
    note?: string;
};

type AdminStats = {
    total_abstracts: number | null;
    total_reviewers: number | null;
    reviewed_count: number | null;
    reviewed_ratio?: number | null;
    conflicts: number;
    abstracts_today?: number;
    new_reviewers?: number;
    arbitration_count?: number;
    active_reviewers?: number;
    last_export?: string | null;
};

let reviewers: Reviewer[] = [
    { name: "Alice", email: "alice@bristol.ac.uk", role: "reviewer", active: true, note: "" },
    { name: "Bob", email: "bob@bristol.ac.uk", role: "admin", active: false, note: "on leave" },
];

let adminStats: AdminStats = {
    total_abstracts: 150,
    total_reviewers: 10,
    reviewed_count: 100,
    reviewed_ratio: 66.6,
    conflicts: 2,
    abstracts_today: 3,
    new_reviewers: 1,
    arbitration_count: 2,
    active_reviewers: 5,
    last_export: "2025-06-01 10:00",
};

const assignedAbstract = {
    pmid: "12345",
    title: "Sample title for testing",
    journal: "Test Journal",
    year: 2024,
    sentence_count: 2,
    sentence_results: [
        {
            sentence_index: 1,
            sentence: "This is a sample sentence one.",
            assertions: [{ id: "a1", text: "Gene A upregulates Gene B", comment: "", is_new: true }],
        },
        {
            sentence_index: 2,
            sentence: "This is a sample sentence two.",
            assertions: [{ id: "a2", text: "Protein X inhibits Protein Y", comment: "" }],
        },
    ],
};

const assignedAbstractPayload = {
    abstract: { ...assignedAbstract },
    ...assignedAbstract,
};

// Reset helper
export function resetDb() {
    reviewers = [
        { name: "Alice", email: "alice@bristol.ac.uk", role: "reviewer", active: true, note: "" },
        { name: "Bob", email: "bob@bristol.ac.uk", role: "admin", active: false, note: "on leave" },
    ];
    adminStats = {
        total_abstracts: 150,
        total_reviewers: 10,
        reviewed_count: 100,
        reviewed_ratio: 66.6,
        conflicts: 2,
        abstracts_today: 3,
        new_reviewers: 1,
        arbitration_count: 2,
        active_reviewers: 5,
        last_export: "2025-06-01 10:00",
    };
}

/** Utils */
const normEmail = (s: string) => s.trim().toLowerCase();
const qs = (req: Request) => new URL(req.url).searchParams;

function parseListParams(req: Request) {
    const p = qs(req);
    const q = (p.get("q") ?? p.get("search") ?? "").trim().toLowerCase();
    const page = Math.max(1, parseInt(p.get("page") || "1", 10) || 1);
    const per = Math.max(
        1,
        parseInt(p.get("per_page") ?? p.get("page_size") ?? p.get("limit") ?? "200", 10) || 200
    );
    const offset = (page - 1) * per;
    return { q, page, per, offset };
}

/** Response builders */
function buildAdminStatsBody() {
    let ratio: number | null = null;
    if (typeof adminStats.reviewed_ratio === "number") {
        ratio = adminStats.reviewed_ratio;
    } else if (
        typeof adminStats.total_abstracts === "number" &&
        typeof adminStats.reviewed_count === "number" &&
        adminStats.total_abstracts > 0
    ) {
        ratio = Math.round((adminStats.reviewed_count / adminStats.total_abstracts) * 1000) / 10;
    }
    const plain = {
        ...adminStats,
        reviewed_ratio: ratio,
        // camelCase variants
        totalAbstracts: adminStats.total_abstracts,
        totalReviewers: adminStats.total_reviewers,
        reviewedCount: adminStats.reviewed_count,
        activeReviewers: adminStats.active_reviewers,
        arbitrationCount: adminStats.arbitration_count,
        lastExport: adminStats.last_export,
    };
    return { success: true, data: plain, meta: { ok: true }, ...plain };
}

/** Handlers */

// Admin stats fallback (covers many variants)
const adminStatsRegex =
    /\/(api\/)?(v\d+\/)?(admin\/)?(stats|overview|dashboard|metrics|summary|status)\/?$/i;
const adminStatsFallback = http.get(adminStatsRegex, () =>
    HttpResponse.json(buildAdminStatsBody(), { status: 200 })
);

// Reviewers list fallback
const reviewerListRegex = /\/(api\/)?(v\d+\/)?(admin\/)?(reviewers|users)(\/list)?\/?$/i;
const reviewerListFallback = http.get(reviewerListRegex, ({ request }) => {
    const { q, per, offset } = parseListParams(request);
    let data = reviewers.slice();
    if (q) {
        data = data.filter(
            (r) =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q)
        );
    }
    const total = data.length;
    const pageData = data.slice(offset, offset + per);
    return HttpResponse.json({ reviewers: pageData, meta: { total }, total }, { status: 200 });
});

// Create / update / delete reviewers
const createReviewerRoutes = [
    "/api/reviewers",
    "/reviewers",
    "/api/admin/reviewers",
    "/admin/reviewers",
];
const createReviewerHandlers = createReviewerRoutes.map((path) =>
    http.post(path, async ({ request }) => {
        let body: any = {};
        try {
            body = await request.json();
        } catch { }
        const name = String(body?.name || "").trim();
        const email = normEmail(String(body?.email || ""));
        if (!name || !email) {
            return HttpResponse.json({ message: "name and email are required" }, { status: 400 });
        }
        if (reviewers.some((r) => normEmail(r.email) === email)) {
            return HttpResponse.json({ message: "email exists" }, { status: 422 });
        }
        reviewers.push({
            name,
            email,
            role: body?.role === "admin" ? "admin" : "reviewer",
            active: true,
            note: "",
        });
        adminStats.total_reviewers = (adminStats.total_reviewers || 0) + 1;
        adminStats.new_reviewers = (adminStats.new_reviewers || 0) + 1;
        return HttpResponse.json({ ok: true }, { status: 201 });
    })
);
const updateReviewerRoutes = [
    "/api/reviewers/:email",
    "/reviewers/:email",
    "/api/admin/reviewers/:email",
    "/admin/reviewers/:email",
];
const updateReviewerHandlers = updateReviewerRoutes.map((path) =>
    http.put(path, async ({ params, request }) => {
        const target = normEmail(decodeURIComponent(String(params.email || "")));
        const idx = reviewers.findIndex((r) => normEmail(r.email) === target);
        if (idx < 0) return HttpResponse.json({ message: "not found" }, { status: 404 });
        let body: Partial<Reviewer> = {};
        try {
            body = await request.json();
        } catch { }
        reviewers[idx] = { ...reviewers[idx], ...body, email: reviewers[idx].email };
        return HttpResponse.json({ ok: true }, { status: 200 });
    })
);
const deleteReviewerHandlers = updateReviewerRoutes.map((path) =>
    http.delete(path, ({ params }) => {
        const target = normEmail(decodeURIComponent(String(params.email || "")));
        const before = reviewers.length;
        reviewers = reviewers.filter((r) => normEmail(r.email) !== target);
        if (reviewers.length === before) {
            return HttpResponse.json({ message: "not found" }, { status: 404 });
        }
        return HttpResponse.json({ ok: true }, { status: 200 });
    })
);

// Assigned abstract (fallback + explicit)
const assignedRegex =
    /\/(api\/)?(v\d+\/)?((reviews?|abstracts?|review)\/assigned|assigned[_-]?abstract)\/?$/i;
const assignedFallback = http.get(assignedRegex, () =>
    HttpResponse.json(assignedAbstractPayload, { status: 200 })
);
const assignedExplicitRoutes = [
    "/api/assigned_abstract",
    "/assigned_abstract",
    "/api/reviews/assigned",
    "/api/abstracts/assigned",
    "/api/review/assigned",
    "/review/assigned",
    "/api/assigned-abstract",
    "/assigned-abstract",
];
const assignedExplicitHandlers = assignedExplicitRoutes.map((path) =>
    http.get(path, () => HttpResponse.json(assignedAbstractPayload, { status: 200 }))
);

// Submit review
const submitRoutes = [
    "/api/submit_review",
    "/submit_review",
    "/api/reviews",
    "/api/reviews/submit",
    "/reviews/submit",
];
const submitHandlers = submitRoutes.map((path) =>
    http.post(path, () => HttpResponse.json({ ok: true }, { status: 200 }))
);

// Pricing
const pricingRoutes = ["/api/review/pricing", "/review/pricing"];
const pricingHandlers = pricingRoutes.map((path) =>
    http.get(path, ({ request }) => {
        const id = qs(request).get("abstract") || null;
        return HttpResponse.json({ abstract: id, price: 0 }, { status: 200 });
    })
);

// Auth / meta
const authHandlers = [
    http.post("/api/login", () =>
        HttpResponse.json({ success: true, email: "test@user", is_admin: true }, { status: 200 })
    ),
    http.post("/api/logout", () => HttpResponse.json({ success: true }, { status: 200 })),
    http.get("/api/whoami", () =>
        HttpResponse.json({ success: true, email: "test@user", is_admin: true }, { status: 200 })
    ),
];
const metaHandlers = [
    http.get("/api/meta/health", () => HttpResponse.json({ ok: true, env: "test" }, { status: 200 })),
    http.get("/api/meta/vocab", () => HttpResponse.json({ terms: [] }, { status: 200 })),
];

// Export aggregated handlers in order: fallbacks first
export const handlers = [
    adminStatsFallback,
    reviewerListFallback,
    assignedFallback,

    // explicit routes
    ...createReviewerHandlers,
    ...updateReviewerHandlers,
    ...deleteReviewerHandlers,
    ...assignedExplicitHandlers,
    ...submitHandlers,
    ...pricingHandlers,
    ...authHandlers,
    ...metaHandlers,
];