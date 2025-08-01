// src/pages/ReviewerAdminPage.jsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function ReviewerAdminPage() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // {email,...} or null
    const [form, setForm] = useState({ email: "", name: "", active: true, role: "reviewer", note: "" });
    const [error, setError] = useState("");
    const [refreshFlag, setRefreshFlag] = useState(0);

    useEffect(() => {
        setLoading(true);
        axios.get("/api/reviewers").then(r => setList(r.data)).catch(e => setError("Failed to load")).finally(() => setLoading(false));
    }, [refreshFlag]);

    const handleEdit = (r) => {
        setEditing(r.email);
        setForm(r);
    };

    const handleDelete = (email) => {
        if (!window.confirm("Delete this reviewer?")) return;
        axios.delete(`/api/reviewers/${encodeURIComponent(email)}`).then(() => setRefreshFlag(f => f + 1));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        if (!form.email || !form.name) { setError("Email and Name required"); return; }
        if (editing) {
            axios.put(`/api/reviewers/${encodeURIComponent(editing)}`, form)
                .then(() => { setEditing(null); setForm({ email: "", name: "", active: true, role: "reviewer", note: "" }); setRefreshFlag(f => f + 1); })
                .catch(e => setError(e?.response?.data?.error || "Update failed"));
        } else {
            axios.post("/api/reviewers", form)
                .then(() => { setForm({ email: "", name: "", active: true, role: "reviewer", note: "" }); setRefreshFlag(f => f + 1); })
                .catch(e => setError(e?.response?.data?.error || "Add failed"));
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow">
            <h2 className="text-xl font-bold mb-4 text-blue-900">Reviewer Management</h2>
            <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap mb-4">
                <input type="email" placeholder="Email" className="border rounded px-2 py-1"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editing} />
                <input type="text" placeholder="Name" className="border rounded px-2 py-1"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <select className="border rounded px-2 py-1" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
                </select>
                <select className="border rounded px-2 py-1" value={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.value === "true" }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
                <input type="text" placeholder="Note" className="border rounded px-2 py-1 w-28"
                    value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">{editing ? "Update" : "Add"}</button>
                {editing && <button type="button" className="bg-gray-300 rounded px-2 py-1" onClick={() => { setEditing(null); setForm({ email: "", name: "", active: true, role: "reviewer", note: "" }); }}>Cancel</button>}
            </form>
            {error && <div className="text-red-500 mb-3">{error}</div>}
            {loading ? <div className="text-gray-400">Loading…</div> : (
                <table className="min-w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-100">
                            <th>Email</th><th>Name</th><th>Role</th><th>Active</th><th>Note</th><th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map(r => (
                            <tr key={r.email}>
                                <td>{r.email}</td>
                                <td>{r.name}</td>
                                <td>{r.role}</td>
                                <td>{r.active ? "Yes" : "No"}</td>
                                <td>{r.note}</td>
                                <td>
                                    <button className="text-blue-600 underline mr-2" onClick={() => handleEdit(r)}>Edit</button>
                                    <button className="text-red-600 underline" onClick={() => handleDelete(r.email)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {!list.length && <tr><td colSpan={6} className="text-gray-400 text-center py-6">No reviewers.</td></tr>}
                    </tbody>
                </table>
            )}
        </div>
    );
}