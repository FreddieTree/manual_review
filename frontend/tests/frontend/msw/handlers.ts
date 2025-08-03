// tests/frontend/msw/handlers.ts
import { http, HttpResponse } from "msw";

/** ───────────────────────── In-memory DB for tests ───────────────────────── */

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
    { name: "Alice", email: "a@bristol.ac.uk", role: "reviewer", active: true, note: "" },
    { name: "Bob", email: "b@bristol.ac.uk", role: "admin", active: false, note: "on leave" },
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
            assertions: [
                { id: "a1", text: "Gene A upregulates Gene B", comment: "", is_new: true } // ← 关键：标记新增
            ],
        },
        {
            sentence_index: 2,
            sentence: "This is a sample sentence two.",
            assertions: [{ id: "a2", text: "Protein X inhibits Protein Y", comment: "" }],
        },
    ],
};

// 提供顶层和 abstract 两种形状
const assignedAbstractPayload = {
    abstract: { ...assignedAbstract },
    ...assignedAbstract,
};

/** Reset helpers for tests */
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

/** ─────────────────────────────── Handlers ─────────────────────────────── */

// Admin stats（多别名 + 多形状）
function adminStatsBody() {
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
    const plain = { ...adminStats, reviewed_ratio: ratio };
    return {
        success: true,
        data: plain,
        meta: { ok: true },
        ...plain,
    };
}

const adminStatsRoutes = [
    "/api/admin/stats",
    "/api/stats",
    "/admin/stats",
    "/api/admin/overview",
    "/api/admin/dashboard",
    "/api/admin/metrics",
    "/api/api/admin/stats",
    "/api/api/stats",
];
const adminHandlers = adminStatsRoutes.map((path) =>
    http.get(path, () => HttpResponse.json(adminStatsBody(), { status: 200 })),
);

// Reviewers 列表/增删改（多别名）
const reviewerListRoutes = [
    "/api/reviewers",
    "/reviewers",
    "/api/admin/reviewers",
    "/admin/reviewers",
    "/api/api/reviewers",
];
const listHandlers = reviewerListRoutes.map((path) =>
    http.get(path, ({ request }) => {
        const { q, per, offset } = parseListParams(request);
        let data = reviewers.slice();
        if (q) {
            data = data.filter(
                (r) =>
                    (r.name || "").toLowerCase().includes(q) ||
                    (r.email || "").toLowerCase().includes(q),
            );
        }
        const total = data.length;
        const pageData = data.slice(offset, offset + per);
        return HttpResponse.json(
            { reviewers: pageData, meta: { total }, total },
            { status: 200 },
        );
    }),
);

const createRoutes = [
    "/api/reviewers",
    "/reviewers",
    "/api/admin/reviewers",
    "/admin/reviewers",
    "/api/api/reviewers",
];
const updateRoutes = [
    "/api/reviewers/:email",
    "/reviewers/:email",
    "/api/admin/reviewers/:email",
    "/admin/reviewers/:email",
    "/api/api/reviewers/:email",
];
const deleteRoutes = updateRoutes;

const createHandlers = createRoutes.map((path) =>
    http.post(path, async ({ request }) => {
        let body: any = {};
        try { body = await request.json(); } catch { }
        const name = String(body?.name || "").trim();
        const email = normEmail(String(body?.email || ""));
        if (!name || !email) {
            return HttpResponse.json({ message: "name and email are required" }, { status: 400 });
        }
        if (reviewers.some((r) => normEmail(r.email) === email)) {
            return HttpResponse.json({ message: "email exists" }, { status: 422 });
        }
        reviewers.push({ name, email, role: body?.role === "admin" ? "admin" : "reviewer", active: true, note: "" });
        adminStats.total_reviewers = (adminStats.total_reviewers || 0) + 1;
        adminStats.new_reviewers = (adminStats.new_reviewers || 0) + 1;
        return HttpResponse.json({ ok: true }, { status: 201 });
    }),
);

const updateHandlers = updateRoutes.map((path) =>
    http.put(path, async ({ params, request }) => {
        const target = normEmail(decodeURIComponent(String(params.email || "")));
        const idx = reviewers.findIndex((r) => normEmail(r.email) === target);
        if (idx < 0) return HttpResponse.json({ message: "not found" }, { status: 404 });
        let body: Partial<Reviewer> = {};
        try { body = await request.json(); } catch { }
        reviewers[idx] = { ...reviewers[idx], ...body, email: reviewers[idx].email };
        return HttpResponse.json({ ok: true }, { status: 200 });
    }),
);

const deleteHandlers = deleteRoutes.map((path) =>
    http.delete(path, ({ params }) => {
        const target = normEmail(decodeURIComponent(String(params.email || "")));
        const before = reviewers.length;
        reviewers = reviewers.filter((r) => normEmail(r.email) !== target);
        if (reviewers.length === before) {
            return HttpResponse.json({ message: "not found" }, { status: 404 });
        }
        return HttpResponse.json({ ok: true }, { status: 200 });
    }),
);

// Assigned abstract（多别名 + 双形状）
const assignedRoutes = [
    "/api/assigned_abstract",
    "/assigned_abstract",
    "/api/reviews/assigned",
    "/api/abstracts/assigned",
    "/api/assigned-abstract",
    "/assigned-abstract",
    "/api/api/assigned_abstract",
];
const assignedHandlers = assignedRoutes.map((path) =>
    http.get(path, () => HttpResponse.json(assignedAbstractPayload, { status: 200 })),
);

// Submit review（多别名）
const submitRoutes = [
    "/api/submit_review",
    "/submit_review",
    "/api/reviews",
    "/api/reviews/submit",
    "/reviews/submit",
    "/api/api/submit_review",
];
const submitHandlers = submitRoutes.map((path) =>
    http.post(path, () => HttpResponse.json({ ok: true }, { status: 200 })),
);

// Pricing / Meta / Auth
const pricingRoutes = [
    "/api/review/pricing",
    "/review/pricing",
    "/api/api/review/pricing",
];
const pricingHandlers = pricingRoutes.map((path) =>
    http.get(path, ({ request }) => {
        const id = qs(request).get("abstract") || null;
        return HttpResponse.json({ abstract: id, price: 0 }, { status: 200 });
    }),
);

const authHandlers = [
    http.post("/api/login", () => HttpResponse.json({ success: true, email: "test@user", is_admin: true }, { status: 200 })),
    http.post("/api/logout", () => HttpResponse.json({ success: true }, { status: 200 })),
    http.get("/api/whoami", () => HttpResponse.json({ success: true, email: "test@user", is_admin: true }, { status: 200 })),
];

const metaHandlers = [
    http.get("/api/meta/health", () => HttpResponse.json({ ok: true, env: "test" }, { status: 200 })),
    http.get("/api/meta/vocab", () => HttpResponse.json({ terms: [] }, { status: 200 })),
];

export const handlers = [
    ...adminHandlers,
    ...listHandlers,
    ...createHandlers,
    ...updateHandlers,
    ...deleteHandlers,
    ...assignedHandlers,
    ...submitHandlers,
    ...pricingHandlers,
    ...authHandlers,
    ...metaHandlers,
];