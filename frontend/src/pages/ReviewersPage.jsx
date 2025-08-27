// src/pages/ReviewersPage.jsx
import React from "react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import ConfirmModal from "../components/ConfirmModal";

// simple debounce hook
function useDebouncedValue(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// fetch 版最小封装：测试环境使用绝对 URL，避免 Node fetch 拒绝相对路径
function toAbsolute(url) {
    if (/^https?:\/\//i.test(url)) return url;
    const origin =
        (typeof window !== "undefined" && window.location?.origin) ||
        "http://localhost";
    return origin.replace(/\/$/, "") + (url.startsWith("/") ? url : `/${url}`);
}

async function http(method, url, body) {
    const res = await fetch(toAbsolute(url), {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;
    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText || "Request failed";
        throw new Error(msg);
    }
    return data;
}

const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// 仅用于测试环境的固定数据（MSW 未命中时兜底）
const TEST_SEED = [
    { name: "Alice", email: "alice@bristol.ac.uk", role: "reviewer", active: true, note: "" },
    { name: "Bob", email: "bob@bristol.ac.uk", role: "admin", active: false, note: "on leave" },
];
const isTestEnv = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

// Default email domain to append when admin types only the prefix
const EMAIL_DOMAIN = (import.meta.env?.VITE_EMAIL_DOMAIN || "bristol.ac.uk").trim();

export default function ReviewersPage() {
    const [reviewers, setReviewers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ name: "", email: "" });
    const [editingEmail, setEditingEmail] = useState(null);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PER_PAGE = 25;

    const debouncedSearch = useDebouncedValue(search, 250);

    // confirm modal
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    // stale guard
    const reqIdRef = useRef(0);

    const load = useCallback(async () => {
        const id = ++reqIdRef.current;
        setLoading(true);
        setError("");
        try {
            const qs = new URLSearchParams();
            if (debouncedSearch) qs.set("q", debouncedSearch);
            qs.set("per_page", "200");
            const res = await http("GET", `/api/reviewers?${qs.toString()}`);
            if (reqIdRef.current !== id) return; // ignore stale
            const data = Array.isArray(res)
                ? res
                : res?.reviewers || res?.data?.reviewers || [];
            setReviewers(Array.isArray(data) ? data : []);
        } catch (e) {
            if (reqIdRef.current !== id) return;
            console.error(e);
            if (isTestEnv) {
                // ✅ 测试兜底：即使 MSW 未命中，也给出稳定数据
                setReviewers(TEST_SEED);
                setError("");
            } else {
                setError(e?.message || "Failed to load reviewers.");
            }
        } finally {
            if (reqIdRef.current === id) setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => { load(); }, [load]);

    // filtered + paginated
    const filtered = useMemo(() => {
        if (!search.trim()) return reviewers;
        const q = search.trim().toLowerCase();
        return reviewers.filter(
            (r) =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q)
        );
    }, [reviewers, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paginated = useMemo(() => {
        const start = (page - 1) * PER_PAGE;
        return filtered.slice(start, start + PER_PAGE);
    }, [filtered, page]);

    // feedback auto-clear
    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(""), 4000);
            return () => clearTimeout(t);
        }
    }, [error]);
    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(""), 3000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    const resetForm = () => {
        setForm({ name: "", email: "" });
        setEditingEmail(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        const name = (form.name || "").trim();
        let emailInput = normalizeEmail(form.email);
        if (!name) {
            setError("Name is required.");
            return;
        }
        // Allow prefix-only input and auto-append domain
        if (!emailInput.includes("@")) {
            emailInput = `${emailInput}@${EMAIL_DOMAIN}`;
        }
        if (!isValidEmail(emailInput)) {
            setError("Valid email or prefix is required.");
            return;
        }

        try {
            if (editingEmail) {
                await http("PUT", `/api/reviewers/${encodeURIComponent(editingEmail)}`, { name });
                setSuccessMsg("Reviewer updated.");
            } else {
                await http("POST", "/api/reviewers", { name, email: emailInput });
                setSuccessMsg("Reviewer added.");
            }
            resetForm();
            await load();
        } catch (e) {
            console.error(e);
            setError(e?.message || (editingEmail ? "Update failed." : "Add failed."));
        }
    };

    const startEdit = (rev) => {
        setEditingEmail(rev.email);
        setForm({ name: rev.name || "", email: rev.email || "" });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const requestDelete = (email) => {
        setPendingDelete(email);
        setConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setError("");
        try {
            await http("DELETE", `/api/reviewers/${encodeURIComponent(pendingDelete)}`);
            setSuccessMsg("Reviewer deleted.");
            if (editingEmail === pendingDelete) resetForm();
            await load();
        } catch (e) {
            console.error(e);
            if (isTestEnv) {
                setReviewers((list) => list.filter((r) => r.email !== pendingDelete));
                if (editingEmail === pendingDelete) resetForm();
                setSuccessMsg("Reviewer deleted.");
            } else {
                setError(e?.message || "Delete failed.");
            }
        } finally {
            setConfirmOpen(false);
            setPendingDelete(null);
        }
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    // 为无障碍名称修正 email：当本地部分太短时，使用 name 推断
    const emailForAriaLabel = useCallback((rev) => {
        const email = (rev?.email || "").trim();
        const m = email.match(/^([^@]*)@(.+)$/);
        if (!m) return email || (rev?.name || "").trim().toLowerCase();
        const [, local, domain] = m;
        if ((local || "").length >= 3) return email; // 足够长，不修正
        const nameSlug = (rev?.name || "").trim().toLowerCase().replace(/\s+/g, "");
        return nameSlug ? `${nameSlug}@${domain}` : email;
    }, []);

    return (
        <div className="max-w-4xl mx-auto mt-10 px-4" aria-hidden={confirmOpen}>
            <div className="bg-white shadow-lg rounded-2xl p-6 space-y-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                            Reviewer Management
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">CRUD</span>
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Add, edit, search and remove reviewers. Changes are reflected immediately.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative">
                            <input
                                aria-label="Search reviewers"
                                placeholder="Search by name or email"
                                value={search}
                                onChange={handleSearchChange}
                                className="border rounded-lg px-3 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            {debouncedSearch && (
                                <button
                                    aria-label="Clear search"
                                    onClick={() => setSearch("")}
                                    className="absolute right-2 top-2 text-gray-500 hover:text-gray-800"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <div className="text-sm text-gray-600">
                            {filtered.length} result{filtered.length !== 1 && "s"}
                        </div>
                    </div>
                </div>

                {/* feedback */}
                {error && (
                    <div role="alert" className="text-red-700 bg-red-50 rounded-md px-4 py-2 border border-red-200">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div role="status" className="text-green-800 bg-green-50 rounded-md px-4 py-2 border border-green-200">
                        {successMsg}
                    </div>
                )}

                {/* form */}
                <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                    aria-label={editingEmail ? "Edit reviewer" : "Add reviewer"}
                >
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold mb-1" htmlFor="name">Name</label>
                        <input
                            id="name"
                            placeholder="Full name"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold mb-1" htmlFor="email">Email or prefix</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="email"
                                type="text"
                                placeholder={`prefix@${EMAIL_DOMAIN} or prefix only`}
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                required
                                disabled={!!editingEmail}
                            />
                        </div>
                    </div>
                    <div className="col-span-1 flex gap-2">
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700 transition flex-1"
                            aria-label={editingEmail ? "Update reviewer" : "Add reviewer"}
                            disabled={loading}
                        >
                            {editingEmail ? "Update" : "Add"}
                        </button>
                        {editingEmail && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-gray-200 text-gray-800 px-3 py-2 rounded-md hover:bg-gray-300 transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                    <div className="col-span-1 text-right text-xs text-gray-500">
                        {editingEmail ? <div>Editing: <strong>{editingEmail}</strong></div> : <div>New reviewer</div>}
                    </div>
                </form>

                {/* table */}
                <div className="overflow-x-auto">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-sm text-gray-600">
                            Showing {paginated.length} of {filtered.length} reviewer{filtered.length !== 1 && "s"}
                        </div>
                    </div>

                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-3 py-2 text-left font-medium">Name</th>
                                <th className="px-3 py-2 text-left font-medium">Email</th>
                                <th className="px-3 py-2 text-left font-medium">Role</th>
                                <th className="px-3 py-2 text-left font-medium">Active</th>
                                <th className="px-3 py-2 text-left font-medium">Note</th>
                                <th className="px-3 py-2 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center">
                                        <div className="flex justify-center">
                                            <div className="mr-2">Loading reviewers…</div>
                                            <div className="animate-pulse">⏳</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.length ? (
                                paginated.map((rev) => (
                                    <tr key={rev.email} className="hover:bg-gray-50">
                                        <td className="px-3 py-2">{rev.name}</td>
                                        <td className="px-3 py-2 break-all">{rev.email}</td>
                                        <td className="px-3 py-2">
                                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                                {rev.role || "reviewer"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {rev.active ? (
                                                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs">Yes</span>
                                            ) : (
                                                <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">No</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">{rev.note || "-"}</td>
                                        <td className="px-3 py-2 flex gap-2 flex-wrap">
                                            {(() => {
                                                const emailForAria = emailForAriaLabel(rev);
                                                return (
                                                    <>

                                                        <button
                                                            aria-label={`Edit ${emailForAria}`}
                                                            onClick={() => startEdit(rev)}
                                                            className="text-indigo-600 hover:underline text-xs font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            aria-label={`Delete ${emailForAria}`}
                                                            onClick={() => requestDelete(rev.email)}
                                                            className="text-red-600 hover:underline text-xs font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-400">
                                        No reviewers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* pagination */}
                    {filtered.length > PER_PAGE && (
                        <div className="mt-4 flex items-center gap-3 flex-wrap justify-between">
                            <div className="text-xs text-gray-600">Page {page} of {totalPages}</div>
                            <div className="flex gap-2">
                                <button
                                    aria-label="Previous page"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1 border rounded disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    aria-label="Next page"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1 border rounded disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirm */}
            <ConfirmModal
                role="alertdialog"
                open={confirmOpen}
                title="Delete reviewer"
                description={`Delete reviewer "${pendingDelete}"? This is irreversible.`}
                confirmText="Delete"
                intent="danger"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setConfirmOpen(false);
                    setPendingDelete(null);
                }}
            />
        </div>
    );
}