// src/pages/ReviewersPage.jsx
import React from "react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
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

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
    timeout: 10000,
});

const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

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
            const res = await api.get("/reviewers", {
                params: { q: debouncedSearch || undefined, per_page: 200 },
            });
            if (reqIdRef.current !== id) return; // ignore stale
            const data = Array.isArray(res.data)
                ? res.data
                : res.data?.reviewers || res.data?.data?.reviewers || [];
            setReviewers(Array.isArray(data) ? data : []);
        } catch (e) {
            if (reqIdRef.current !== id) return;
            console.error(e);
            setError(e?.response?.data?.message || e?.response?.data?.error || "Failed to load reviewers.");
        } finally {
            if (reqIdRef.current === id) setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => { load(); }, [load]);

    // filtered + paginated
    const filtered = useMemo(() => {
        if (!debouncedSearch.trim()) return reviewers;
        const q = debouncedSearch.trim().toLowerCase();
        return reviewers.filter(
            (r) =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q)
        );
    }, [reviewers, debouncedSearch]);

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
        const email = normalizeEmail(form.email);

        if (!name) {
            setError("Name is required.");
            return;
        }
        if (!email || !isValidEmail(email)) {
            setError("Valid email is required.");
            return;
        }

        try {
            if (editingEmail) {
                await api.put(`/reviewers/${encodeURIComponent(editingEmail)}`, { name });
                setSuccessMsg("Reviewer updated.");
            } else {
                await api.post("/reviewers", { name, email });
                setSuccessMsg("Reviewer added.");
            }
            resetForm();
            await load();
        } catch (e) {
            console.error(e);
            setError(
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                (editingEmail ? "Update failed." : "Add failed.")
            );
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
            await api.delete(`/reviewers/${encodeURIComponent(pendingDelete)}`);
            setSuccessMsg("Reviewer deleted.");
            if (editingEmail === pendingDelete) resetForm();
            await load();
        } catch (e) {
            console.error(e);
            setError(e?.response?.data?.message || "Delete failed.");
        } finally {
            setConfirmOpen(false);
            setPendingDelete(null);
        }
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    return (
        <div className="max-w-4xl mx-auto mt-10 px-4">
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
                        <label className="block text-xs font-semibold mb-1" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="reviewer@bristol.ac.uk"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            required
                            disabled={!!editingEmail}
                        />
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
                                            <button
                                                aria-label={`Edit ${rev.email}`}
                                                onClick={() => startEdit(rev)}
                                                className="text-indigo-600 hover:underline text-xs font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                aria-label={`Delete ${rev.email}`}
                                                onClick={() => requestDelete(rev.email)}
                                                className="text-red-600 hover:underline text-xs font-medium"
                                            >
                                                Delete
                                            </button>
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