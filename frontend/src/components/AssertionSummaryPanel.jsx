// src/components/AssertionSummaryPanel.jsx
import DecisionBadge from "./DecisionBadge";
import { useMemo } from "react";
import clsx from "clsx";

/**
 * Small legend / key
 */
const LegendItem = ({ label, colorClass }) => (
    <div className="flex items-center gap-1 text-[11px]">
        <span className={clsx("w-3 h-3 rounded-full", colorClass)}></span>
        <span>{label}</span>
    </div>
);

/**
 * Summary bar showing relative proportions of decisions for a sentence.
 */
const SentenceBar = ({ counts, total }) => {
    const getPct = (n) => (total > 0 ? (n / total) * 100 : 0);
    return (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
                className="transition-all"
                style={{
                    width: `${getPct(counts.accept)}%`,
                    backgroundColor: "rgba(16, 185, 129, 0.9)", // emerald
                }}
            />
            <div
                className="transition-all"
                style={{
                    width: `${getPct(counts.modify)}%`,
                    backgroundColor: "rgba(234, 179, 8, 0.9)", // yellow
                }}
            />
            <div
                className="transition-all"
                style={{
                    width: `${getPct(counts.reject)}%`,
                    backgroundColor: "rgba(239, 68, 68, 0.9)", // red
                }}
            />
            <div
                className="transition-all"
                style={{
                    width: `${getPct(counts.uncertain)}%`,
                    backgroundColor: "rgba(107, 114, 128, 0.9)", // gray
                }}
            />
        </div>
    );
};

/**
 * Props:
 *  - sentenceResults: array of sentence objects
 *  - reviewStatesMap: { [sentence_index]: [{ decision, comment, isModified }] }
 *  - overallDecision: optional overall decision for display
 */
export default function AssertionSummaryPanel({
    sentenceResults = [],
    reviewStatesMap = {},
    overallDecision = null,
}) {
    // aggregate totals
    const aggregate = useMemo(() => {
        const summary = {
            accept: 0,
            modify: 0,
            reject: 0,
            uncertain: 0,
            totalAssertions: 0,
        };
        sentenceResults.forEach((s) => {
            const states = reviewStatesMap?.[s.sentence_index] || [];
            states.forEach((st) => {
                summary[st.decision] = (summary[st.decision] || 0) + 1;
                summary.totalAssertions += 1;
            });
        });
        return summary;
    }, [sentenceResults, reviewStatesMap]);

    // helper to pick dominant per-sentence decision
    const getDominant = (counts) => {
        const entries = Object.entries(counts);
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0] || "uncertain";
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 flex flex-col gap-4 w-full">
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-lg font-semibold text-gray-800">Review Summary</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        Sentence-level breakdown and overall tally
                    </div>
                </div>
                {overallDecision && (
                    <div className="flex items-center gap-2">
                        <div className="text-[11px] text-gray-600 uppercase">Overall</div>
                        <DecisionBadge decision={overallDecision} />
                    </div>
                )}
            </div>

            {/* aggregate overview */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-4 flex-wrap">
                        <LegendItem label="Accept" colorClass="bg-emerald-500" />
                        <LegendItem label="Modify" colorClass="bg-yellow-500" />
                        <LegendItem label="Reject" colorClass="bg-red-500" />
                        <LegendItem label="Uncertain" colorClass="bg-gray-500" />
                    </div>
                    <div className="text-sm text-gray-600">
                        Total assertions: <span className="font-medium">{aggregate.totalAssertions}</span>
                    </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                        <div className="text-[11px] uppercase text-gray-500 mb-1">Summary Bar</div>
                        <SentenceBar
                            counts={{
                                accept: aggregate.accept,
                                modify: aggregate.modify,
                                reject: aggregate.reject,
                                uncertain: aggregate.uncertain,
                            }}
                            total={aggregate.totalAssertions}
                        />
                    </div>
                    <div className="flex gap-6 flex-wrap">
                        <div className="flex flex-col">
                            <div className="text-[12px] text-gray-500">Accepted</div>
                            <div className="text-lg font-semibold text-emerald-700">{aggregate.accept}</div>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-[12px] text-gray-500">Modified</div>
                            <div className="text-lg font-semibold text-yellow-700">{aggregate.modify}</div>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-[12px] text-gray-500">Rejected</div>
                            <div className="text-lg font-semibold text-red-600">{aggregate.reject}</div>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-[12px] text-gray-500">Uncertain</div>
                            <div className="text-lg font-semibold text-gray-600">{aggregate.uncertain}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* per-sentence breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                {sentenceResults.map((s) => {
                    const states = reviewStatesMap?.[s.sentence_index] || [];
                    const counts = { accept: 0, modify: 0, reject: 0, uncertain: 0 };
                    states.forEach((st) => {
                        counts[st.decision] = (counts[st.decision] || 0) + 1;
                    });
                    const total = states.length;
                    const dominant = getDominant(counts);
                    return (
                        <div
                            key={s.sentence_index}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border"
                            aria-label={`Sentence ${s.sentence_index} summary`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="text-sm font-medium w-10">S{s.sentence_index}</div>
                                <div className="flex-1">
                                    <SentenceBar counts={counts} total={total} />
                                </div>
                                <div className="text-[11px] text-gray-600">
                                    {total > 0 ? `${total} assertion${total > 1 ? "s" : ""}` : "No assertions"}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-[11px]">Dominant</div>
                                <DecisionBadge decision={dominant} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}