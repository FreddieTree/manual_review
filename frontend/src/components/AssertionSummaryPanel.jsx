import DecisionBadge from "./DecisionBadge";

/**
 * Summarizes per-sentence status: counts of accepted/modified/rejected/uncertain.
 */
export default function AssertionSummaryPanel({ sentenceResults, reviewStatesMap }) {
    return (
        <div className="bg-white rounded-xl shadow p-4 border border-gray-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-800">Review Summary</div>
                <div className="text-sm text-gray-500">Quick overview of sentence-level decisions</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sentenceResults.map((s, si) => {
                    const states = reviewStatesMap?.[s.sentence_index] || [];
                    const counts = { accept: 0, modify: 0, reject: 0, uncertain: 0 };
                    states.forEach((st) => {
                        counts[st.decision] = (counts[st.decision] || 0) + 1;
                    });
                    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                    return (
                        <div
                            key={s.sentence_index}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-md border"
                        >
                            <div className="text-sm font-medium">S{s.sentence_index}</div>
                            <div className="flex gap-2 items-center">
                                <div className="text-xs">
                                    A: {counts.accept} M: {counts.modify} R: {counts.reject} U: {counts.uncertain}
                                </div>
                                <DecisionBadge decision={dominant} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}