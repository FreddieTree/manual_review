// src/pages/ReviewerAdminPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { debounce } from "lodash"; // assume lodash is available; otherwise implement simple debounce
import {
    getReviewers as fetchReviewers,
    addReviewer,
    updateReviewer,
    deleteReviewer,
} from "../api";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import { Badge } from "../components/ui/Badge";

const DEFAULT_PAGE_SIZE = 25;

const emptyForm = {
    email: "",
    name: "",
    active: true,
    role: "reviewer",
    note: "",
};

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

    // form/editing
    const [form, setForm] = useState(emptyForm);
    const [editingEmail, setEditingEmail] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'error'|'success', message }

    // Derived filtered/paginated list (if backend doesn't support pagination/search)
    const filtered = useMemo(() => {
        if (!search.trim()) return reviewers;
        const q = search.trim().toLowerCase();
        return reviewers.filter(
            (r) =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q)
        );
    }, [reviewers, search]);

    const paginated = useMemo(() => {
        const start = (page - 1) * perPage;
        return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    const loadReviewers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchReviewers(); // expects { reviewers: [...], meta: {...} } or raw array
            let data = [];
            if (res.reviewers) {
                data = res.reviewers;
                if (res.meta && typeof res.meta.total === "number") {
                    setTotal(res.meta.total);
                } else {
                    setTotal(data.length);
                }
            } else if (Array.isArray(res)) {
                data = res;
                setTotal(data.length);
            } else if (res.data?.reviewers) {
                data = res.data.reviewers;
                setTotal(res.data.meta?.total ?? data.length);
            }
            setReviewers(data);
        } catch (e) {
            console.error(e);
            setError(typeof e === "string" ? e : e?.message || "Failed to load reviewers.");
        } finally {
            setLoading(false);
        }
    }, [refreshFlag]);

    // debounced search to avoid thrash
    const debouncedSearch = useMemo(
        () =>
            debounce((val) => {
                setSearch(val);
                setPage(1);
            }, 300),
        []
    );

    useEffect(() => {
        loadReviewers();
        // cleanup debounce on unmount
        return () => {
            debouncedSearch.cancel();
        };
    }, [loadReviewers]);

    // success / error auto clear
    useEffect(() => {
        if (feedback) {
            const t = setTimeout(() => setFeedback(null), 4000);
            return () => clearTimeout(t);
        }
    }, [feedback]);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingEmail(null);
    };

    const validateForm = () => {
        if (!form.email || !form.name) return "Email and name are required.";
        // basic email prefix/domain handling (expect full email)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Invalid email format.";
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
                    name: form.name,
                    active: form.active,
                    role: form.role,
                    note: form.note,
                });
                setFeedback({ type: "success", message: "Reviewer updated." });
            } else {
                await addReviewer({
                    email: form.email,
                    name: form.name,
                    active: form.active,
                    role: form.role,
                    note: form.note,
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
            email: rev.email,
            name: rev.name || "",
            active: !!rev.active,
            role: rev.role || "reviewer",
            note: rev.note || "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => resetForm();

    const handleDelete = async (email) => {
        if (!window.confirm(`Permanently delete reviewer "${email}"?`)) return;
        try {
            await deleteReviewer(email);
            setFeedback({ type: "success", message: "Deleted reviewer." });
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
        }
    };

    const handleSearchChange = (e) => {
        debouncedSearch(e.target.value);
    };

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-white p-6 rounded-2xl shadow-md">
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
                        <div className="flex gap-2">
                            <div className="text-sm text-gray-600">
                                {filtered.length} result{filtered.length !== 1 && "s"}
                            </div>
                            <div className="text-sm text-gray-600">
                                Page {page} / {totalPages}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback */}
                {feedback && (
                    <div
                        role="alert"
                        className={`mb-4 px-4 py-2 rounded ${feedback.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
                            }`}
                    >
                        {feedback.message}
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
                            <Button variant="secondary" type="button" onClick={cancelEdit}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>

                {/* Reviewer table */}
                <div className="overflow-x-auto">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">
                            Showing {paginated.length} of {filtered.length} reviewer{filtered.length !== 1 && "s"}
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
                        <thead>
                            <tr className="bg-gray-100 text-left">
                                <th className="px-3 py-2 font-medium">Email</th>
                                <th className="px-3 py-2 font-medium">Name</th>
                                <th className="px-3 py-2 font-medium">Role</th>
                                <th className="px-3 py-2 font-medium">Active</th>
                                <th className="px-3 py-2 font-medium">Note</th>
                                <th className="px-3 py-2 font-medium">Actions</th>
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
                                            <Badge variant={r.role === "admin" ? "model" : "pill"}>
                                                {r.role}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.active ? (
                                                <Badge variant="primary">Yes</Badge>
                                            ) : (
                                                <Badge variant="tag">No</Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">{r.note || "-"}</td>
                                        <td className="px-3 py-2 flex gap-2 flex-wrap">
                                            <Button size="xs" onClick={() => startEdit(r)} aria-label={`Edit ${r.email}`}>
                                                Edit
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="danger"
                                                onClick={() => handleDelete(r.email)}
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
                        <div className="text-xs text-gray-600">
                            Page {page} of {totalPages}
                        </div>
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
        </div>
    );
}