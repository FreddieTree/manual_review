import React, { useCallback, forwardRef, memo } from "react";
import clsx from "clsx";
import Tooltip from "./ui/Tooltip";
import Button from "./ui/Button";
import PropTypes from "prop-types";
import { usePricing } from "../hooks/usePricing";

const normalizePricing = (raw) => {
    if (!raw || typeof raw !== "object") {
        return { total: null, per_sentence: null, currency: "GBP", extra: null };
    }
    const { total, currency, units, per_abstract, per_assertion_add, default_descriptor } = raw;

    if (per_abstract !== undefined) {
        // 默认计价，未指定具体摘要
        return {
            total: null,
            per_sentence: null,
            currency: currency || "GBP",
            extra: {
                per_abstract,
                per_assertion_add,
                default_descriptor: default_descriptor || null,
            },
        };
    }
    // 具体计价，units 结构如 { sentences: X, abstracts: Y }
    let per_sentence = null;
    if (units?.sentences && total != null) {
        per_sentence = total / units.sentences;
    }
    return {
        total,
        per_sentence,
        currency: currency || "GBP",
        extra: null,
    };
};

function PricingDisplayImpl(
    { abstractId, compact = false, showTooltip = true, onRetry, className = "" },
    ref
) {
    const { pricing: rawPricing, loading, error, refetch, isStale } = usePricing(abstractId, 10, {
        enabled: Boolean(abstractId),
        pauseOnHidden: true,
    });

    const pricing = normalizePricing(rawPricing || {});

    if (error) {
        console.log("Pricing error object:", error, typeof error, error?.response);
    }

    const handleRetry = useCallback(() => {
        if (loading) return;
        refetch();
        onRetry?.();
    }, [refetch, onRetry, loading]);

    const formatMoney = useCallback(
        (value) => {
            try {
                return new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: pricing?.currency || "GBP",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(value);
            } catch {
                const cur = pricing?.currency || "£";
                return `${cur}${Number(value).toFixed(2)}`;
            }
        },
        [pricing]
    );

    const total = pricing?.total;
    const perSentence = pricing?.per_sentence;
    const formattedTotal = total != null ? formatMoney(total) : "—";
    const formattedPerSentence =
        perSentence != null ? `${formatMoney(perSentence)} / sentence` : null;

    const containerBase = clsx(
        "relative flex rounded-2xl px-4 py-2 shadow-sm border transition font-sans min-w-[140px] overflow-hidden",
        className
    );

    // Loading
    if (loading) {
        return (
            <div
                ref={ref}
                aria-label="Pricing loading"
                className={clsx(
                    containerBase,
                    compact ? "items-center gap-2" : "flex-col text-right gap-1",
                    "animate-pulse rounded-3xl",
                    compact ? "min-w-[140px]" : "max-w-[260px]",
                    "bg-gray-100 border border-gray-200"
                )}
            >
                <div className={clsx("flex flex-col", compact ? "items-start" : "items-end")} style={{ width: "100%" }}>
                    <div className="text-[10px] uppercase text-gray-500 tracking-wide mb-1">Estimated pay</div>
                    <div className="flex items-baseline gap-1">
                        <div className={clsx("font-bold", compact ? "text-sm" : "text-xl")}>
                            <div className="h-6 bg-gray-300 rounded w-20" />
                        </div>
                        {!compact && (
                            <div className="ml-1 text-[11px]">
                                <div className="h-4 bg-gray-300 rounded w-28" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Error (含 stale)
    if (error) {
        const msg =
            error?.message ||
            error?.toString() ||
            "Failed to load pricing";

        return (
            <div
                ref={ref}
                role="alert"
                aria-label="Pricing error"
                className={clsx(
                    containerBase,
                    compact ? "items-center gap-2" : "flex-col text-right gap-1",
                    "rounded-3xl bg-red-50 border border-red-200",
                    compact ? "min-w-[140px]" : "max-w-[260px]"
                )}
            >
                <div className="flex flex-1 flex-col gap-1">
                    <div className="text-[10px] uppercase tracking-wide font-medium text-red-700">
                        Estimated pay
                    </div>
                    <div className="flex items-baseline gap-1">
                        <div className="font-bold text-red-700">Error</div>
                        {!compact && (
                            <div className="ml-1 text-[11px] text-red-600 truncate">{msg}</div>
                        )}
                    </div>
                    {isStale && (
                        <div className="text-[10px] text-yellow-700 mt-1">
                            Showing stale data; retry to refresh.
                        </div>
                    )}
                </div>
                <div className="flex gap-2 items-center flex-shrink-0 mt-1">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleRetry}
                        aria-label="Retry pricing"
                        className="rounded-full"
                        disabled={loading}
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    // Normal
    return (
        <div
            ref={ref}
            aria-label="Pricing summary"
            className={clsx(
                containerBase,
                compact ? "items-center gap-2" : "flex-col text-right gap-1",
                "rounded-3xl",
                pricing?.total != null ? "bg-white border-green-100" : "bg-gray-50 border-gray-200",
                compact ? "min-w-[140px]" : "max-w-[260px]"
            )}
        >
            <div className={clsx("flex flex-col", compact ? "items-start" : "items-end", "flex-1")}>
                <div className="text-[10px] uppercase text-gray-500 tracking-wide">Estimated pay</div>
                <div className="flex items-baseline gap-1">
                    <div className={clsx("font-extrabold leading-tight", compact ? "text-sm" : "text-2xl")}>
                        {formattedTotal}
                    </div>
                    {!compact && formattedPerSentence && (
                        <div className="ml-1 text-[11px] text-gray-500 whitespace-nowrap">
                            {formattedPerSentence}
                        </div>
                    )}
                </div>
            </div>

            {!compact && showTooltip && (
                <div className="ml-2 flex-shrink-0">
                    <Tooltip
                        label={
                            pricing ? (
                                <div className="text-xs">
                                    <div className="font-semibold mb-1">Pay Breakdown</div>
                                    <div className="flex justify-between">
                                        <span className="mr-2">Per sentence:</span>
                                        <span>{perSentence != null ? formatMoney(perSentence) : "—"}</span>
                                    </div>
                                    {pricing?.extra && (
                                        <div className="flex justify-between mt-1">
                                            <span className="mr-2">Extras:</span>
                                            <span>{JSON.stringify(pricing.extra)}</span>
                                        </div>
                                    )}
                                    <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                                        <span>Total:</span>
                                        <span>{formattedTotal}</span>
                                    </div>
                                </div>
                            ) : (
                                "No pricing data"
                            )
                        }
                        placement="bottom"
                    >
                        <div
                            aria-label="Pricing info"
                            className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-[12px] font-semibold cursor-help"
                        >
                            i
                        </div>
                    </Tooltip>
                </div>
            )}

            <div className="absolute top-2 right-2">
                <button
                    aria-label="Refresh pricing"
                    onClick={handleRetry}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition"
                >
                    ⟳
                </button>
            </div>
        </div>
    );
}

if (process.env.NODE_ENV !== "production") {
    PricingDisplayImpl.propTypes = {
        abstractId: PropTypes.any,
        compact: PropTypes.bool,
        showTooltip: PropTypes.bool,
        onRetry: PropTypes.func,
        className: PropTypes.string,
    };
}

export default memo(forwardRef(PricingDisplayImpl));