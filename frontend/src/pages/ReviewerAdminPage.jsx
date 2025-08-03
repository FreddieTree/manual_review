// src/pages/ReviewerAdminPage.jsx
import React from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { debounce } from "lodash";
import {
    getReviewers as fetchReviewers,
    addReviewer,
    updateReviewer,
    deleteReviewer,
} from "../api";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import Badge from "../components/ui/Badge";
import ConfirmModal from "../components/ConfirmModal";

const DEFAULT_PAGE_SIZE = 25;

const emptyForm = {
    email: "",
    name: "",
    active: true,
    role: "reviewer",
    note: "",
};

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());

export default function ReviewerAdminPage() {
    // list state and controls
    const [reviewers, setReviewers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [refreshFlag, setRefreshFlag] = useState(0);

    // sort
    const [sortKey, setSortKey] = useState("email"); // email | name | role | active
    const [sortDir, setSortDir] = useState("asc");   // asc | desc

    // form/editing
    const [form, setForm] = useState(emptyForm);
    const [editingEmail, setEditingEmail] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'error'|'success', message }

    // delete confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    // stale guard
    const reqIdRef = useRef(0);

    // debounced search
    const debouncedSearch = useMemo(
        () =>
            debounce((val) => {
                setSearch(val);
                setPage(1);
            }, 300),
        []
    );

    const loadReviewers = useCallback(async () => {
        const id = ++reqIdRef.current;
        setLoading(true);
        setError("");
        try {
            const res = await fetchReviewers();
            if (reqIdRef.current !== id) return; // ignore stale

            let data = [];
            if (res?.reviewers) {
                data = res.reviewers;
                setTotal(typeof res?.meta?.total === "number" ? res.meta.total : data.length);
            } else if (Array.isArray(res)) {
                data = res;
                setTotal(data.length);
            } else if (res?.data?.reviewers) {
                data = res.data.reviewers;
                setTotal(res?.data?.meta?.total ?? data.length);
            }
            setReviewers(Array.isArray(data) ? data : []);
        } catch (e) {
            if (reqIdRef.current !== id) return;
            console.error(e);
            setError(typeof e === "string" ? e : e?.message || "Failed to load reviewers.");
            setReviewers([]);
            setTotal(0);
        } finally {
            if (reqIdRef.current === id) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReviewers();
        return () => debouncedSearch.cancel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadReviewers, refreshFlag]);

    // success / error auto clear
    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(t);
    }, [feedback]);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingEmail(null);
    };

    const validateForm = () => {
        if (!form.email || !form.name) return "Email and name are required.";
        if (!isValidEmail(form.email)) return "Invalid email format.";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFeedback(null);
        const validationError = validateForm();
        if (validationError) {
            setFeedback({ type: "error", message: validationError });
            return;
        }
        setSubmitting(true);
        try {
            if (editingEmail) {
                await updateReviewer(editingEmail, {
                    name: form.name.trim(),
                    active: !!form.active,
                    role: form.role,
                    note: form.note?.trim() || "",
                });
                setFeedback({ type: "success", message: "Reviewer updated." });
            } else {
                await addReviewer({
                    email: form.email.trim().toLowerCase(),
                    name: form.name.trim(),
                    active: !!form.active,
                    role: form.role,
                    note: form.note?.trim() || "",
                });
                setFeedback({ type: "success", message: "Reviewer added." });
            }
            resetForm();
            setRefreshFlag((f) => f + 1);
            await loadReviewers();
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Operation failed.";
            setFeedback({ type: "error", message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (rev) => {
        setEditingEmail(rev.email);
        setForm({
            email: rev.email || "",
            name: rev.name || "",
            active: !!rev.active,
            role: rev.role || "reviewer",
            note: rev.note || "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const requestDelete = (email) => {
        setPendingDelete(email);
        setConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            await deleteReviewer(pendingDelete);
            setFeedback({ type: "success", message: "Deleted reviewer." });
            if (editingEmail === pendingDelete) resetForm();
            setRefreshFlag((f) => f + 1);
            await loadReviewers();
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Deletion failed.";
            setFeedback({ type: "error", message: msg });
        } finally {
            setPendingDelete(null);
            setConfirmOpen(false);
        }
    };

    const handleSearchChange = (e) => {
        debouncedSearch(e.target.value);
    };

    // filtered + sorted + paginated
    const filtered = useMemo(() => {
        if (!search.trim()) return reviewers;
        const q = search.trim().toLowerCase();
        return reviewers.filter(
            (r) =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q)
        );
    }, [reviewers, search]);

    const sorted = useMemo(() => {
        const dir = sortDir === "asc" ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const av = sortKey === "active" ? !!a.active : (a[sortKey] ?? "").toString().toLowerCase();
            const bv = sortKey === "active" ? !!b.active : (b[sortKey] ?? "").toString().toLowerCase();
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const paginated = useMemo(() => {
        const start = (page - 1) * perPage;
        return sorted.slice(start, start + perPage);
    }, [sorted, page, perPage]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));

    const toggleSort = (key) => {
        if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-indigo-800">Reviewer Management</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Add, edit, search, and manage reviewer accounts.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <div className="w-full sm:w-64">
                            <Input
                                aria-label="Search reviewers"
                                placeholder="Search by name or email"
                                onChange={handleSearchChange}
                                defaultValue={search}
                                disabled={loading}
                            />
                        </div>
                        <div className="flex gap-2 text-sm text-gray-600">
                            <div>{sorted.length} result{sorted.length !== 1 && "s"}</div>
                            <div>Page {page} / {totalPages}</div>
                        </div>
                    </div>
                </div>

                {/* Feedback */}
                {feedback && (
                    <div
                        role={feedback.type === "error" ? "alert" : "status"}
                        aria-live="polite"
                        className={`mb-4 px-4 py-2 rounded border ${feedback.type === "error"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                    >
                        {feedback.message}
                    </div>
                )}
                {error && (
                    <div role="alert" className="mb-4 px-4 py-2 rounded bg-red-50 text-red-700 border border-red-200">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold mb-1">Email</label>
                        <Input
                            type="email"
                            placeholder="reviewer@bristol.ac.uk"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            disabled={!!editingEmail}
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold mb-1">Name</label>
                        <Input
                            placeholder="Full name"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="col-span-1 grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold mb-1">Role</label>
                            <Select
                                value={form.role}
                                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                                options={[
                                    { label: "Reviewer", value: "reviewer" },
                                    { label: "Admin", value: "admin" },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1">Active</label>
                            <Select
                                value={form.active ? "true" : "false"}
                                onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}
                                options={[
                                    { label: "Yes", value: "true" },
                                    { label: "No", value: "false" },
                                ]}
                            />
                        </div>
                    </div>
                    <div className="col-span-full md:col-span-2">
                        <label className="block text-xs font-semibold mb-1">Note</label>
                        <Input
                            placeholder="Optional note"
                            value={form.note}
                            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                        />
                    </div>
                    <div className="col-span-full md:col-span-1 flex items-end gap-2">
                        <Button type="submit" disabled={submitting}>
                            {editingEmail ? (submitting ? "Updating…" : "Update Reviewer") : submitting ? "Adding…" : "Add Reviewer"}
                        </Button>
                        {editingEmail && (
                            <Button variant="secondary" type="button" onClick={resetForm}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>

                {/* Reviewer table */}
                <div className="overflow-x-auto">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">
                            Showing {paginated.length} of {sorted.length} reviewer{sorted.length !== 1 && "s"}
                        </div>
                        <div className="flex gap-2">
                            <Select
                                aria-label="Per page"
                                value={String(perPage)}
                                onChange={(e) => {
                                    setPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                                options={[
                                    { label: "10 / page", value: "10" },
                                    { label: "25 / page", value: "25" },
                                    { label: "50 / page", value: "50" },
                                    { label: "100 / page", value: "100" },
                                ]}
                            />
                        </div>
                    </div>

                    <table className="min-w-full border-collapse text-sm">
                        <thead className="sticky top-0 bg-gray-100 z-10">
                            <tr className="text-left">
                                {[
                                    { key: "email", label: "Email" },
                                    { key: "name", label: "Name" },
                                    { key: "role", label: "Role" },
                                    { key: "active", label: "Active" },
                                    { key: "note", label: "Note", sortable: false },
                                    { key: "actions", label: "Actions", sortable: false },
                                ].map((col) => (
                                    <th key={col.key} className="px-3 py-2 font-medium">
                                        {col.sortable === false ? (
                                            col.label
                                        ) : (
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 hover:underline"
                                                onClick={() => toggleSort(col.key)}
                                                aria-label={`Sort by ${col.label}`}
                                            >
                                                {col.label}
                                                {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>}
                                            </button>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center">
                                        <Loader size="sm" />
                                    </td>
                                </tr>
                            ) : paginated.length ? (
                                paginated.map((r) => (
                                    <tr key={r.email} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 break-all">{r.email}</td>
                                        <td className="px-3 py-2">{r.name}</td>
                                        <td className="px-3 py-2">
                                            <Badge variant={r.role === "admin" ? "model" : "pill"}>{r.role || "reviewer"}</Badge>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.active ? <Badge variant="primary">Yes</Badge> : <Badge variant="tag">No</Badge>}
                                        </td>
                                        <td className="px-3 py-2">{r.note || "-"}</td>
                                        <td className="px-3 py-2 flex gap-2 flex-wrap">
                                            <Button size="xs" onClick={() => startEdit(r)} aria-label={`Edit ${r.email}`}>
                                                Edit
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="danger"
                                                onClick={() => requestDelete(r.email)}
                                                aria-label={`Delete ${r.email}`}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-gray-500">
                                        No reviewers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination controls */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-600">Page {page} of {totalPages}</div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                aria-label="Previous page"
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                aria-label="Next page"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete confirm modal */}
            <ConfirmModal
                role="alertdialog"
                open={confirmOpen}
                title="Delete reviewer"
                description={`Permanently delete reviewer "${pendingDelete}"? This cannot be undone.`}
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