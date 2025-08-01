// src/components/PricingDisplay.jsx
import React, { useMemo, useCallback } from "react";
import { usePricing } from "../hooks/usePricing";
import clsx from "clsx";

/**
 * Props:
 *  - abstractId: 用来 fetch 计价的 key
 *  - compact: 是否紧凑模式（用于 top bar 等空间有限处）
 *  - showTooltip: 是否显示细分 tooltip（默认 true）
 */
export default function PricingDisplay({
    abstractId,
    compact = false,
    showTooltip = true,
    onRetry,
}) {
    const { pricing, loading, error, refetch } = usePricing(abstractId, 10);

    const handleRetry = useCallback(() => {
        refetch();
        if (onRetry) onRetry();
    }, [refetch, onRetry]);

    const currency = pricing?.currency || "£";
    const total = pricing?.total ?? 0;
    const perSentence = pricing?.per_sentence;

    const formattedTotal = useMemo(() => `${currency}${total.toFixed(2)}`, [currency, total]);
    const formattedPerSentence = useMemo(
        () => (perSentence != null ? `${currency}${perSentence.toFixed(3)} / sentence` : null),
        [currency, perSentence]
    );

    // loading skeleton
    if (loading) {
        return (
            <div
                aria-label="pricing loading"
                className={clsx(
                    "flex items-center gap-3 rounded-2xl px-4 py-2 shadow-sm border bg-white/70 animate-pulse",
                    compact ? "min-w-[120px]" : "max-w-[220px]"
                )}
            >
                <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded w-20 mb-1" />
                    {!compact && <div className="h-2 bg-gray-200 rounded w-28" />}
                </div>
            </div>
        );
    }

    // error state
    if (error) {
        return (
            <div
                role="alert"
                className={clsx(
                    "flex items-center justify-between gap-3 rounded-2xl px-4 py-2 shadow-sm border bg-red-50",
                    compact ? "min-w-[140px]" : "max-w-[240px]"
                )}
            >
                <div className="flex flex-col">
                    <div className="text-xs font-semibold text-red-700">Pricing error</div>
                    <div className="text-[10px] text-red-600">Failed to load pay</div>
                </div>
                <button
                    onClick={handleRetry}
                    aria-label="Retry pricing"
                    className="text-xs px-3 py-1 bg-red-100 border border-red-200 rounded hover:bg-red-200 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    // normal display
    return (
        <div
            className={clsx(
                "relative flex items-center rounded-2xl px-4 py-2 shadow-sm border",
                compact ? "gap-2" : "flex-col text-right gap-1",
                pricing
                    ? "bg-white/90 border-green-200"
                    : "bg-gray-100 border-gray-300",
                compact ? "min-w-[140px]" : "max-w-[260px]"
            )}
            aria-label="pricing summary"
        >
            <div
                className={clsx(
                    "flex flex-col",
                    compact ? "items-start" : "items-end"
                )}
            >
                <div className="text-[10px] uppercase text-gray-500 tracking-wide">
                    Estimated pay
                </div>
                <div className="flex items-baseline gap-1">
                    <div className={clsx("font-bold", compact ? "text-sm" : "text-xl")}>
                        {formattedTotal}
                    </div>
                    {!compact && formattedPerSentence && (
                        <div className="ml-1 text-[11px] text-gray-400">
                            {formattedPerSentence}
                        </div>
                    )}
                </div>
            </div>

            {/* Breakdown tooltip */}
            {!compact && showTooltip && (
                <div className="group relative ml-2 flex-shrink-0">
                    <div
                        aria-label="pricing info"
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold cursor-default"
                    >
                        i
                    </div>
                    <div
                        role="tooltip"
                        className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg text-xs p-3 z-20"
                    >
                        <div className="font-semibold mb-1">Pay Breakdown</div>
                        {pricing ? (
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Per sentence:</span>
                                    <span>{perSentence != null ? `${currency}${perSentence.toFixed(3)}` : "-"}</span>
                                </div>
                                {pricing.extra && (
                                    <div className="flex justify-between">
                                        <span>Extras:</span>
                                        <span>{pricing.extra}</span>
                                    </div>
                                )}
                                <div className="border-t mt-1 pt-1 flex justify-between font-semibold">
                                    <span>Total:</span>
                                    <span>{formattedTotal}</span>
                                </div>
                            </div>
                        ) : (
                            <div>No pricing data available.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}