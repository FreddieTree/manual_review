import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

export default function ReviewersPage() {
    const [reviewers, setReviewers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: "", email: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // 载入所有审核员
    const loadReviewers = async () => {
        setLoading(true);
        try {
            const res = await api.get("/reviewers");
            setReviewers(Array.isArray(res.data) ? res.data : []);
        } catch {
            setReviewers([]);
            setError("Failed to load reviewers.");
        }
        setLoading(false);
    };

    useEffect(() => { loadReviewers(); }, []);

    // 新增或更新审核员
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const { name, email } = form;
        if (!name.trim()) {
            setError("Name is required.");
            return;
        }
        if (!email.trim() || !email.includes("@")) {
            setError("Valid email is required.");
            return;
        }
        try {
            if (editing) {
                // update
                await api.put(`/reviewers/${encodeURIComponent(email)}`, { name });
            } else {
                // add
                await api.post("/reviewers", { name, email });
            }
            setForm({ name: "", email: "" });
            setEditing(null);
            loadReviewers();
        } catch (err) {
            setError(err.response?.data?.message || "Save failed.");
        }
    };

    // 编辑
    const startEdit = (rev) => {
        setEditing(rev.email);
        setForm({ name: rev.name, email: rev.email });
    };

    // 删除
    const handleDelete = async (email) => {
        if (!window.confirm("Delete this reviewer?")) return;
        try {
            await api.delete(`/reviewers/${encodeURIComponent(email)}`);
            loadReviewers();
        } catch (err) {
            setError("Delete failed: " + (err.response?.data?.message || ""));
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow mt-10">
            <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
                Reviewer Management
                <span className="ml-2 px-2 py-1 rounded bg-emerald-50 text-emerald-800 text-xs font-semibold">
                    CRUD
                </span>
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4 items-end">
                <input
                    className="border rounded px-2 py-1 w-44"
                    placeholder="Name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                />
                <input
                    className="border rounded px-2 py-1 w-56"
                    placeholder="Email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    disabled={!!editing}
                />
                <button
                    className="bg-blue-700 text-white px-4 py-1 rounded-lg shadow hover:bg-blue-800 font-semibold transition"
                    type="submit"
                >
                    {editing ? "Update" : "Add"}
                </button>
                {editing && (
                    <button
                        type="button"
                        onClick={() => { setEditing(null); setForm({ name: "", email: "" }); }}
                        className="bg-gray-300 text-gray-700 px-3 py-1 rounded ml-2 hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                )}
                {error && <div className="w-full text-red-600 text-xs mt-1">{error}</div>}
            </form>
            {loading ? (
                <div className="text-center py-4 text-gray-400">Loading...</div>
            ) : (
                <table className="w-full mt-3 border text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="px-3 py-2 border">Name</th>
                            <th className="px-3 py-2 border">Email</th>
                            <th className="px-3 py-2 border w-32">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(Array.isArray(reviewers) ? reviewers : []).map((rev) => (
                            <tr key={rev.email}>
                                <td className="border px-2">{rev.name}</td>
                                <td className="border px-2">{rev.email}</td>
                                <td className="border px-2">
                                    <button
                                        className="text-blue-700 hover:underline mr-2"
                                        onClick={() => startEdit(rev)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="text-red-600 hover:underline"
                                        onClick={() => handleDelete(rev.email)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {(!reviewers || reviewers.length === 0) && (
                            <tr>
                                <td colSpan={3} className="text-center py-6 text-gray-400">
                                    No reviewers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}