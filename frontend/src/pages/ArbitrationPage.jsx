import React, { useEffect, useState, useRef, useCallback, forwardRef, memo } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

function ArbitrationPageImpl(_, ref) {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState(null); // assertion_id 正在处理
    const [error, setError] = useState("");

    const controllerRef = useRef(null);

    const loadQueue = useCallback(async () => {
        setLoading(true);
        setError("");

        // 取消上次请求
        controllerRef.current?.abort();
        controllerRef.current = new AbortController();

        try {
            const res = await api.get("/arbitration_queue", {
                signal: controllerRef.current.signal,
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setQueue(data);
        } catch (err) {
            if (axios.isCancel(err)) return;
            setQueue([]);
            setError("Failed to load arbitration queue.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadQueue();
        return () => controllerRef.current?.abort();
    }, [loadQueue]);

    const handleDecision = async (item, decision) => {
        let comment = "";
        if (decision !== "accept") {
            // 简单交互；可替换为自定义对话框
            // eslint-disable-next-line no-alert
            comment = window.prompt(`Leave comment for this ${decision}:`, "") ?? "";
            if (comment === "" && decision !== "reject") {
                // 允许空但给提示
            }
        }

        setActioning(item.assertion_id);
        try {
            await api.post("/arbitrate", {
                pmid: item.pmid,
                assertion_id: item.assertion_id,
                decision,
                comment,
            });
            await loadQueue();
        } catch (err) {
            setError(
                "Failed to arbitrate: " + (err.response?.data?.error || err.message)
            );
        } finally {
            setActioning(null);
        }
    };

    return (
        <div ref={ref} className="max-w-5xl mx-auto bg-white p-8 rounded-3xl shadow-xl mt-10">
            <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
                Arbitration Queue
                <span className="ml-2 px-2 py-1 rounded bg-red-50 text-red-800 text-xs font-semibold">
                    Admin Only
                </span>
            </h2>

            {loading ? (
                <div className="py-10 text-center text-gray-400">Loading…</div>
            ) : error ? (
                <div role="alert" aria-live="polite" className="py-10 text-center text-red-500">
                    {error}
                </div>
            ) : !queue?.length ? (
                <div className="py-10 text-center text-gray-400">
                    No items for arbitration. All good!
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="border px-2 py-2 text-left">PMID</th>
                                <th className="border px-2 text-left">Subject</th>
                                <th className="border px-2 text-left">Predicate</th>
                                <th className="border px-2 text-left">Object</th>
                                <th className="border px-2 text-left">Submitted By</th>
                                <th className="border px-2 text-left">Conflict</th>
                                <th className="border px-2 w-40 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map((item) => {
                                const busy = actioning === item.assertion_id;
                                return (
                                    <tr key={item.assertion_id}>
                                        <td className="border px-2">{item.pmid}</td>
                                        <td className="border px-2">{item.subject}</td>
                                        <td className="border px-2">
                                            {item.negation ? `neg_${item.predicate}` : item.predicate}
                                        </td>
                                        <td className="border px-2">{item.object}</td>
                                        <td className="border px-2">{item.creator}</td>
                                        <td className="border px-2">
                                            {item.conflict_type || "Unspecified"}
                                        </td>
                                        <td className="border px-2">
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-700 transition disabled:opacity-60"
                                                    disabled={busy}
                                                    onClick={() => handleDecision(item, "accept")}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-yellow-700 transition disabled:opacity-60"
                                                    disabled={busy}
                                                    onClick={() => handleDecision(item, "modify")}
                                                >
                                                    Modify
                                                </button>
                                                <button
                                                    type="button"
                                                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition disabled:opacity-60"
                                                    disabled={busy}
                                                    onClick={() => handleDecision(item, "reject")}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={loadQueue}
                            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                            disabled={loading}
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(forwardRef(ArbitrationPageImpl));