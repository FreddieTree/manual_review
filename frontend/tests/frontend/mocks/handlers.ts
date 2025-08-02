// tests/frontend/mocks/handlers.ts
import { http, HttpResponse } from "msw";

// 假数据（会被测试修改）
const reviewers = [
    { email: "a@bristol.ac.uk", name: "Alice", role: "reviewer", active: true, note: "" },
    { email: "b@bristol.ac.uk", name: "Bob", role: "admin", active: false, note: "on leave" },
];

export const handlers = [
    // GET /api/reviewers?q=...
    http.get("/api/reviewers", ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").toLowerCase();
        const data = q
            ? reviewers.filter(
                (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
            )
            : reviewers;
        return HttpResponse.json({ reviewers: data });
    }),

    // POST /api/reviewers
    http.post("/api/reviewers", async ({ request }) => {
        const body = await request.json();
        reviewers.push({
            email: String(body.email).trim().toLowerCase(),
            name: String(body.name || ""),
            role: body.role ?? "reviewer",
            active: body.active ?? true,
            note: body.note ?? "",
        });
        return HttpResponse.json({ success: true });
    }),

    // PUT /api/reviewers/:email
    http.put("/api/reviewers/:email", async ({ params, request }) => {
        const email = decodeURIComponent(String(params.email || ""));
        const body = await request.json();
        const idx = reviewers.findIndex((r) => r.email === email);
        if (idx >= 0) {
            reviewers[idx] = { ...reviewers[idx], ...body };
            return HttpResponse.json({ success: true });
        }
        return HttpResponse.json({ success: false }, { status: 404 });
    }),

    // DELETE /api/reviewers/:email
    http.delete("/api/reviewers/:email", ({ params }) => {
        const email = decodeURIComponent(String(params.email || ""));
        const idx = reviewers.findIndex((r) => r.email === email);
        if (idx >= 0) reviewers.splice(idx, 1);
        return HttpResponse.json({ success: true });
    }),
];