import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

export default function ArbitrationPage() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState("");
    const [error, setError] = useState("");

    const loadQueue = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await api.get("/arbitration_queue");
            let data = res.data;
            if (!Array.isArray(data)) data = [];
            setQueue(data);
        } catch {
            setQueue([]);
            setError("Failed to load arbitration queue.");
        }
        setLoading(false);
    };

    useEffect(() => { loadQueue(); }, []);

    const handleDecision = async (item, decision) => {
        let comment = "";
        if (decision !== "accept") {
            comment = window.prompt(`Leave comment for this ${decision}:`, "");
            if (comment === null) return; // 用户点取消
        }
        setActioning(item.assertion_id + decision);
        try {
            await api.post("/arbitrate", {
                pmid: item.pmid,
                assertion_id: item.assertion_id,
                decision,
                comment
            });
            await loadQueue();
        } catch (err) {
            setError("Failed to arbitrate: " + (err.response?.data?.error || err.message));
        }
        setActioning("");
    };

    return (
        <div className="max-w-5xl mx-auto bg-white p-8 rounded-3xl shadow-xl mt-10">
            <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
                Arbitration Queue
                <span className="ml-2 px-2 py-1 rounded bg-red-50 text-red-800 text-xs font-semibold">Admin Only</span>
            </h2>
            {loading ? (
                <div className="py-10 text-center text-gray-400">Loading…</div>
            ) : error ? (
                <div className="py-10 text-center text-red-500">{error}</div>
            ) : (!queue || !Array.isArray(queue) || queue.length === 0) ? (
                <div className="py-10 text-center text-gray-400">No items for arbitration. All good!</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="border px-2 py-2">PMID</th>
                                <th className="border px-2">Subject</th>
                                <th className="border px-2">Predicate</th>
                                <th className="border px-2">Object</th>
                                <th className="border px-2">Submitted By</th>
                                <th className="border px-2">Conflict</th>
                                <th className="border px-2 w-40">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map((item) => (
                                <tr key={item.assertion_id}>
                                    <td className="border px-2">{item.pmid}</td>
                                    <td className="border px-2">{item.subject}</td>
                                    <td className="border px-2">{item.predicate}</td>
                                    <td className="border px-2">{item.object}</td>
                                    <td className="border px-2">{item.creator}</td>
                                    <td className="border px-2">{item.conflict_type || "Unspecified"}</td>
                                    <td className="border px-2 flex gap-1">
                                        <button
                                            className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-700 transition"
                                            disabled={!!actioning}
                                            onClick={() => handleDecision(item, "accept")}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-yellow-700 transition"
                                            disabled={!!actioning}
                                            onClick={() => handleDecision(item, "modify")}
                                        >
                                            Modify
                                        </button>
                                        <button
                                            className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition"
                                            disabled={!!actioning}
                                            onClick={() => handleDecision(item, "reject")}
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}