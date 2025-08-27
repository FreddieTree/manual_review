import React, { useEffect, useState, useRef, useCallback, forwardRef, memo } from "react";
import { client } from "../api/client";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";
import ConfirmModal from "../components/ConfirmModal";

function ArbitrationPageImpl(_, ref) {
    const [queue, setQueue] = useState([]);
    const [summary, setSummary] = useState({ total: 0, conflicts: 0, pending: 0 });
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
            const sum = data?.summary && typeof data.summary === 'object' ? data.summary : { total: items.length, conflicts: items.length, pending: 0 };
            const mapped = items.map((it) => {
                const logs = Array.isArray(it.logs) ? it.logs : [];
                const last = logs[logs.length - 1] || {};
                return {
                    ...it,
                    _last: last,
                    subject: last.subject,
                    object: last.object,
                    predicate: last.predicate,
                    negation: !!last.negation,
                    creator: last.creator || last.reviewer || "",
                    conflict_type: it.conflict_reason || it.status,
                };
            });
            setQueue(mapped);
            setSummary(sum);
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

    const [pendingAction, setPendingAction] = useState(null);
    const [pendingDecision, setPendingDecision] = useState(null);

    const postDecision = async (item, decision, commentText = "") => {
        if (!item || !decision) return;
        setActioning(item.assertion_key || item.assertion_id);
        try {
            await client.post("arbitration/decide", {
                pmid: item.pmid,
                assertion_key: item.assertion_key || item.assertion_id,
                decision,
                comment: commentText,
            });
            await loadQueue();
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Failed to arbitrate";
            setError("Failed to arbitrate: " + msg);
        } finally {
            setActioning(null);
        }
    };

    const confirmAction = async (commentText = "") => {
        const item = pendingAction;
        const decision = pendingDecision;
        setPendingAction(null);
        setPendingDecision(null);
        await postDecision(item, decision, commentText);
    };

    const handleDecision = (item, decision) => {
        if (decision === "accept") {
            postDecision(item, decision, "");
            return;
        }
        setPendingAction(item);
        setPendingDecision(decision);
    };

    return (
        <div ref={ref} className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <Card>
                    <Section title="Arbitration Queue" description={`Admin Only • Conflicts: ${summary.conflicts} • Pending: ${summary.pending}`}>
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
                {pendingAction && (
                    <div className="mt-4">
                        <Card>
                            <Section title={`Confirm ${pendingDecision}`} description="Provide a reason (required).">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="arb-comment-input" className="text-sm text-gray-700">Reason</label>
                                    <textarea id="arb-comment-input" className="w-full min-h-[80px] rounded-md border border-gray-300 p-2" placeholder="Reason for decision" />
                                    <div className="flex gap-2 justify-end">
                                        <button className="px-4 py-2 rounded bg-gray-200" onClick={() => { setPendingAction(null); setPendingDecision(null); }}>Cancel</button>
                                        <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={() => {
                                            const el = document.getElementById("arb-comment-input");
                                            const val = (el && el.value) || "";
                                            if (!val.trim()) return;
                                            confirmAction(val);
                                        }}>Confirm</button>
                                    </div>
                                </div>
                            </Section>
                        </Card>
                    </div>
                )}
                <ConfirmModal
                    open={!!pendingAction}
                    title={`Confirm ${pendingDecision || ""}`}
                    description="Please add a brief reason (required for modify/reject)."
                    confirmText="Confirm"
                    cancelText="Cancel"
                    intent={pendingDecision === "reject" ? "danger" : "primary"}
                    onCancel={() => { setPendingAction(null); setPendingDecision(null); }}
                    onConfirm={() => {
                        const el = document.getElementById("arb-comment-input");
                        const val = (el && el.value) || "";
                        if ((pendingDecision === "reject" || pendingDecision === "uncertain" || pendingDecision === "modify") && !val.trim()) {
                            return; // require reason
                        }
                        confirmAction(val);
                    }}
                    className=""
                >
                </ConfirmModal>
            </div>
        </div>
    );
}

export default memo(forwardRef(ArbitrationPageImpl));