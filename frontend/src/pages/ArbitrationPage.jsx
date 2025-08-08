import React, { useEffect, useState, useRef, useCallback, forwardRef, memo } from "react";
import { client } from "../api/client";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";

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
            const data = await client.get(
                "arbitration/queue",
                { signal: controllerRef.current.signal, params: { only_conflicts: true, include_pending: false } },
                { unwrap: "data" }
            );
            const items = Array.isArray(data?.items) ? data.items : [];
            setQueue(items);
        } catch (err) {
            setQueue([]);
            setError(err?.message || "Failed to load arbitration queue.");
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

        setActioning(item.assertion_key || item.assertion_id);
        try {
            await client.post("arbitration/decide", {
                pmid: item.pmid,
                assertion_key: item.assertion_key || item.assertion_id,
                decision,
                comment,
            });
            await loadQueue();
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Failed to arbitrate";
            setError("Failed to arbitrate: " + msg);
        } finally {
            setActioning(null);
        }
    };

    return (
        <div ref={ref} className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <Card>
                    <Section title="Arbitration Queue" description="Admin Only">
                        {loading ? (
                            <div className="py-10 text-center text-gray-400">Loading…</div>
                        ) : error ? (
                            <div role="alert" aria-live="polite" className="py-10 text-center text-red-500">
                                {error}
                            </div>
                        ) : !queue?.length ? (
                            <div className="py-10 text-center text-gray-400">No items for arbitration. All good!</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                        <tr className="text-left">
                                            <th className="border-b px-3 py-2">PMID</th>
                                            <th className="border-b px-3 py-2">Subject</th>
                                            <th className="border-b px-3 py-2">Predicate</th>
                                            <th className="border-b px-3 py-2">Object</th>
                                            <th className="border-b px-3 py-2">Submitted By</th>
                                            <th className="border-b px-3 py-2">Conflict</th>
                                            <th className="border-b px-3 py-2 w-40">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queue.map((item) => {
                                            const busy = actioning === item.assertion_id;
                                            return (
                                                <tr key={item.assertion_id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2">{item.pmid}</td>
                                                    <td className="px-3 py-2">{item.subject}</td>
                                                    <td className="px-3 py-2">{item.negation ? `neg_${item.predicate}` : item.predicate}</td>
                                                    <td className="px-3 py-2">{item.object}</td>
                                                    <td className="px-3 py-2">{item.creator}</td>
                                                    <td className="px-3 py-2">{item.conflict_type || "Unspecified"}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex gap-2">
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
                    </Section>
                </Card>
            </div>
        </div>
    );
}

export default memo(forwardRef(ArbitrationPageImpl));