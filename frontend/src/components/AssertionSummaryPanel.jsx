import React, { useMemo, useCallback, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import DecisionBadge from "./DecisionBadge";
import Tooltip from "./ui/Tooltip";

const VALID_DECISIONS = ["accept", "modify", "reject", "uncertain"];
const DECISION_INFO = {
    accept: { label: "Accept", colorClass: "bg-emerald-500", display: "ACCEPT" },
    modify: { label: "Modify", colorClass: "bg-yellow-500", display: "MODIFY" },
    reject: { label: "Reject", colorClass: "bg-red-500", display: "REJECT" },
    uncertain: { label: "Uncertain", colorClass: "bg-gray-400", display: "UNCERTAIN" },
};

/** Legend item */
const LegendItem = memo(function LegendItem({ label, colorClass }) {
    return (
        <div className="flex items-center gap-2 text-[11px]">
            <span className={clsx("w-3 h-3 rounded-full flex-shrink-0", colorClass)} aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
});

/** Stacked bar for decisions */
const SentenceBar = memo(function SentenceBar({ counts, total, ariaLabel }) {
    const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
    return (
        <div
            className="relative flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
            aria-label={ariaLabel}
            role="img"
        >
            {VALID_DECISIONS.map((key) => {
                const value = counts[key] || 0;
                if (value <= 0) return null;
                let bg;
                switch (key) {
                    case "accept":
                        bg = "rgba(16,185,129,0.85)";
                        break;
                    case "modify":
                        bg = "rgba(234,179,8,0.85)";
                        break;
                    case "reject":
                        bg = "rgba(239,68,68,0.85)";
                        break;
                    default:
                        bg = "rgba(107,114,128,0.85)";
                }
                return <div key={key} className="transition-all" style={{ width: `${pct(value)}%`, backgroundColor: bg }} />;
            })}
            <span className="sr-only">
                {VALID_DECISIONS.map((k) => {
                    const v = counts[k] || 0;
                    return v > 0 ? `${DECISION_INFO[k].label}: ${v}` : null;
                })
                    .filter(Boolean)
                    .join(", ")}
            </span>
        </div>
    );
});

function AssertionSummaryPanelImpl({ sentenceResults = [], reviewStatesMap = {}, overallDecision = null }, ref) {
    const aggregate = useMemo(() => {
        const summary = { accept: 0, modify: 0, reject: 0, uncertain: 0, totalAssertions: 0 };
        sentenceResults.forEach((s) => {
            const states = reviewStatesMap?.[s.sentence_index] || [];
            states.forEach((st) => {
                const decision = VALID_DECISIONS.includes(st.decision) ? st.decision : "uncertain";
                summary[decision] = (summary[decision] || 0) + 1;
                summary.totalAssertions += 1;
            });
        });
        return summary;
    }, [sentenceResults, reviewStatesMap]);

    const getDominant = useCallback((counts) => {
        let top = "uncertain";
        VALID_DECISIONS.forEach((k) => {
            if ((counts[k] || 0) > (counts[top] || 0)) top = k;
        });
        return top;
    }, []);

    return (
        <div
            ref={ref}
            className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-5 w-full"
        >
            {/* Header */}
            <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            Review Summary
                        </h2>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Sentence & assertion breakdown</div>
                    </div>
                </div>
                {overallDecision && (
                    <div className="flex items-center gap-2">
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider">Overall</div>
                        <DecisionBadge decision={overallDecision} />
                    </div>
                )}
            </div>

            {/* Aggregate overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex gap-5 flex-wrap">
                            <LegendItem label="Accept" colorClass="bg-emerald-500" />
                            <LegendItem label="Modify" colorClass="bg-yellow-500" />
                            <LegendItem label="Reject" colorClass="bg-red-500" />
                            <LegendItem label="Uncertain" colorClass="bg-gray-500" />
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-[12px] text-gray-500">Total assertions:</div>
                            <div className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                                {aggregate.totalAssertions}
                            </div>
                        </div>
                    </div>

                    <div className="mt-1 flex flex-col gap-2">
                        <div className="text-[11px] uppercase text-gray-500 tracking-wide">Distribution</div>
                        <SentenceBar
                            counts={{
                                accept: aggregate.accept,
                                modify: aggregate.modify,
                                reject: aggregate.reject,
                                uncertain: aggregate.uncertain,
                            }}
                            total={aggregate.totalAssertions}
                            ariaLabel="Overall assertion distribution"
                        />
                        <div className="flex gap-6 flex-wrap mt-2">
                            {VALID_DECISIONS.map((key) => (
                                <div key={key} className="flex flex-col">
                                    <div className="text-[12px] text-gray-500">{DECISION_INFO[key].label}</div>
                                    <div
                                        className={clsx("text-lg font-semibold", {
                                            "text-emerald-700": key === "accept",
                                            "text-yellow-700": key === "modify",
                                            "text-red-600": key === "reject",
                                            "text-gray-600": key === "uncertain",
                                        })}
                                    >
                                        {aggregate[key]}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Per-sentence breakdown */}
            <div className="grid grid-cols-1 gap-3">
                {sentenceResults.map((s) => {
                    const states = reviewStatesMap?.[s.sentence_index] || [];
                    const counts = { accept: 0, modify: 0, reject: 0, uncertain: 0 };
                    states.forEach((st) => {
                        const decision = VALID_DECISIONS.includes(st.decision) ? st.decision : "uncertain";
                        counts[decision] = (counts[decision] || 0) + 1;
                    });
                    const total = states.length;
                    const dominant = getDominant(counts);
                    return (
                        <div
                            key={s.sentence_index}
                            className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-[#111827] p-3 rounded-xl border border-gray-200 dark:border-gray-700"
                            aria-label={`Sentence ${s.sentence_index} summary`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="text-sm font-medium w-10 flex-shrink-0">S{s.sentence_index}</div>
                                <div className="flex-1">
                                    <SentenceBar
                                        counts={counts}
                                        total={total}
                                        ariaLabel={`Sentence ${s.sentence_index} assertion distribution`}
                                    />
                                </div>
                                <div className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {total > 0 ? `${total} assertion${total > 1 ? "s" : ""}` : "No assertions"}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                <div className="text-[11px]">Dominant</div>
                                <Tooltip label={`Most frequent decision: ${DECISION_INFO[dominant].label}`} placement="top">
                                    <div>
                                        <DecisionBadge decision={dominant} />
                                    </div>
                                </Tooltip>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

if (process.env.NODE_ENV !== "production") {
    AssertionSummaryPanelImpl.propTypes = {
        sentenceResults: PropTypes.arrayOf(PropTypes.object),
        reviewStatesMap: PropTypes.object,
        overallDecision: PropTypes.string,
    };
}

const AssertionSummaryPanel = memo(forwardRef(AssertionSummaryPanelImpl));
export default AssertionSummaryPanel;