import React, { useMemo, useCallback, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import DecisionBadge from "./DecisionBadge";
import Tooltip from "./ui/Tooltip";

// 可枚举决策类型
const VALID_DECISIONS = ["accept", "modify", "reject", "uncertain"];
const DECISION_INFO = {
    accept: { label: "Accept", colorClass: "bg-emerald-500", ring: "ring-emerald-300" },
    modify: { label: "Modify", colorClass: "bg-yellow-400", ring: "ring-yellow-300" },
    reject: { label: "Reject", colorClass: "bg-red-500", ring: "ring-red-300" },
    uncertain: { label: "Uncertain", colorClass: "bg-gray-400", ring: "ring-gray-300" },
};

// Legend可点击版
const LegendItem = memo(function LegendItem({ type, label, colorClass, count, onClick }) {
    return (
        <button
            type="button"
            className={clsx(
                "flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition",
                "focus:outline-none",
                count > 0 ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
            )}
            title={`Show all "${label}" assertions`}
            onClick={() => count > 0 && onClick?.(type)}
            disabled={count <= 0}
            tabIndex={count > 0 ? 0 : -1}
        >
            <span className={clsx("w-3 h-3 rounded-full flex-shrink-0", colorClass)} aria-hidden="true" />
            <span>
                {label} <span className="ml-0.5 font-bold">{count}</span>
            </span>
        </button>
    );
});

// 叠加统计条
const SentenceBar = memo(function SentenceBar({ counts, total, ariaLabel }) {
    const pct = n => (total > 0 ? (n / total) * 100 : 0);
    return (
        <div
            className="relative flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
            aria-label={ariaLabel}
            role="img"
        >
            {VALID_DECISIONS.map(key => {
                const value = counts[key] || 0;
                if (value <= 0) return null;
                let bg;
                switch (key) {
                    case "accept": bg = "rgba(16,185,129,0.88)"; break;
                    case "modify": bg = "rgba(234,179,8,0.85)"; break;
                    case "reject": bg = "rgba(239,68,68,0.88)"; break;
                    default: bg = "rgba(107,114,128,0.82)";
                }
                return <div key={key} style={{ width: `${pct(value)}%`, backgroundColor: bg }} />;
            })}
        </div>
    );
});

const AssertionSummaryPanelImpl = (
    {
        sentenceResults = [],
        reviewStatesMap = {},
        overallDecision = null,
        className = "",
        onDrilldown,          // (type: "accept"|"modify"|...) => void
        onSentenceClick,      // (sentenceIndex: number) => void
        style = {},
    },
    ref
) => {
    // 统计总览
    const aggregate = useMemo(() => {
        const summary = { accept: 0, modify: 0, reject: 0, uncertain: 0, total: 0 };
        sentenceResults.forEach(s => {
            const states = reviewStatesMap?.[s.sentence_index] || [];
            states.forEach(st => {
                const decision = VALID_DECISIONS.includes(st.decision) ? st.decision : "uncertain";
                summary[decision] += 1;
                summary.total += 1;
            });
        });
        return summary;
    }, [sentenceResults, reviewStatesMap]);

    // 点击统计钻取
    const handleDrilldown = useCallback((type) => {
        if (onDrilldown) onDrilldown(type);
    }, [onDrilldown]);

    // 获取每句dominant决策
    const getDominant = useCallback((counts) => {
        let top = "uncertain";
        VALID_DECISIONS.forEach(k => {
            if ((counts[k] || 0) > (counts[top] || 0)) top = k;
        });
        return top;
    }, []);

    return (
        <aside
            ref={ref}
            className={clsx(
                "w-full max-w-md min-w-[260px] bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-6",
                "transition-all duration-300",
                className
            )}
            style={style}
        >
            {/* 头部 */}
            <div className="flex flex-wrap justify-between items-end gap-3 mb-1">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            Review Summary
                        </h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">({aggregate.total} total)</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Sentence &amp; assertion breakdown
                    </div>
                </div>
                {overallDecision && (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider">Overall</span>
                        <DecisionBadge decision={overallDecision} />
                    </div>
                )}
            </div>

            {/* 主分布+legend */}
            <div>
                <SentenceBar
                    counts={aggregate}
                    total={aggregate.total}
                    ariaLabel="Overall assertion distribution"
                />
                <div className="flex flex-wrap gap-2 mt-3 mb-2">
                    {VALID_DECISIONS.map(key => (
                        <LegendItem
                            key={key}
                            type={key}
                            label={DECISION_INFO[key].label}
                            colorClass={DECISION_INFO[key].colorClass}
                            count={aggregate[key]}
                            onClick={handleDrilldown}
                        />
                    ))}
                </div>
            </div>

            {/* 句级断言分布，点击可高亮/定位主review区 */}
            <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-[40vh] overflow-y-auto">
                {sentenceResults.map(s => {
                    const idx = s.sentence_index;
                    const states = reviewStatesMap?.[idx] || [];
                    const counts = { accept: 0, modify: 0, reject: 0, uncertain: 0 };
                    states.forEach(st => {
                        const decision = VALID_DECISIONS.includes(st.decision) ? st.decision : "uncertain";
                        counts[decision]++;
                    });
                    const total = states.length;
                    const dominant = getDominant(counts);
                    return (
                        <button
                            key={idx}
                            type="button"
                            className={clsx(
                                "group flex items-center w-full py-2 px-2 hover:bg-gray-50 dark:hover:bg-[#232933] rounded transition",
                                "focus:outline-none"
                            )}
                            aria-label={`Go to sentence ${idx}`}
                            onClick={() => onSentenceClick?.(idx)}
                            tabIndex={0}
                        >
                            <div className="text-xs font-mono text-gray-500 w-8 shrink-0">S{idx}</div>
                            <div className="flex-1 min-w-0 mr-2">
                                <SentenceBar counts={counts} total={total} ariaLabel={`Sentence ${idx} assertion distribution`} />
                                <span className="text-[10px] text-gray-400 pl-1">
                                    {total > 0 ? `${total} assertion${total > 1 ? "s" : ""}` : "No assertions"}
                                </span>
                            </div>
                            {dominant && (
                                <Tooltip label={`Most frequent: ${DECISION_INFO[dominant].label}`}>
                                    <span>
                                        <DecisionBadge decision={dominant} />
                                    </span>
                                </Tooltip>
                            )}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

const AssertionSummaryPanel = memo(forwardRef(AssertionSummaryPanelImpl));

if (process.env.NODE_ENV !== "production") {
AssertionSummaryPanel.propTypes = {
    sentenceResults: PropTypes.arrayOf(PropTypes.object),
    reviewStatesMap: PropTypes.object,
    overallDecision: PropTypes.string,
    className: PropTypes.string,
    onDrilldown: PropTypes.func,
    onSentenceClick: PropTypes.func,
    style: PropTypes.object,
};
}

export default AssertionSummaryPanel;