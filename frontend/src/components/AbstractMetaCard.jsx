import React, { forwardRef, useMemo, useState, memo } from "react";
import clsx from "clsx";
import PropTypes from "prop-types";
import Badge from "./ui/Badge";
import Tooltip from "./ui/Tooltip";

import {
    ArrowTopRightOnSquareIcon,
    StarIcon,
    ShareIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";

/** 安全高亮 */
const Highlighter = memo(function Highlighter({ text = "", queries = [] }) {
    const normalized = useMemo(() => {
        if (!queries) return [];
        if (Array.isArray(queries)) return queries.filter(Boolean).map((q) => q.trim()).filter(Boolean);
        if (typeof queries === "string" && queries.trim()) return [queries.trim()];
        return [];
    }, [queries]);

    const parts = useMemo(() => {
        if (!text || normalized.length === 0) return [{ text, match: false }];
        const escaped = normalized.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const regex = new RegExp(`(${escaped.join("|")})`, "gi");

        const out = [];
        let last = 0;
        let m;
        while ((m = regex.exec(text)) !== null) {
            const idx = m.index;
            const seg = m[0];
            if (idx > last) out.push({ text: text.slice(last, idx), match: false });
            out.push({ text: seg, match: true });
            last = idx + seg.length;
            if (regex.lastIndex === m.index) regex.lastIndex++;
        }
        if (last < text.length) out.push({ text: text.slice(last), match: false });
        return out;
    }, [text, normalized]);

    if (!normalized.length) return <span>{text}</span>;
    return (
        <>
            {parts.map((p, i) =>
                p.match ? (
                    <mark
                        key={i}
                        className="bg-yellow-100 text-yellow-900 dark:bg-yellow-600/60 dark:text-yellow-50 px-0.5 rounded"
                    >
                        {p.text}
                    </mark>
                ) : (
                    <span key={i}>{p.text}</span>
                )
            )}
        </>
    );
});

/** 信息行（两列栅格） */
const InfoRow = memo(function InfoRow({ term, children, className = "" }) {
    return (
        <div
            className={clsx("items-start", className)}
            style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr",
                columnGap: "16px",
                rowGap: "10px",
                fontSize: "15px",
                lineHeight: 1.5,
            }}
        >
            <dt className="text-slate-600 dark:text-slate-300 font-medium select-none">{term}</dt>
            <dd className="text-slate-900 dark:text-slate-100">{children}</dd>
        </div>
    );
});

/** 状态映射 */
const STATUS_MAP = {
    conflict: { label: "Conflict", color: "danger", variant: "solid" },
    resolved: { label: "Resolved", color: "success", variant: "solid" },
    pending: { label: "Pending", color: "primary", variant: "subtle" },
    uncertain: { label: "Uncertain", color: "warning", variant: "subtle" },
    accepted: { label: "Accepted", color: "success", variant: "subtle" },
    rejected: { label: "Rejected", color: "danger", variant: "subtle" },
};

function AbstractMetaCardImpl(
    {
        className = "",
        title,
        pmid,
        journal,
        year,
        doi = null,
        authors = [],
        meta = {},
        extraTags = [],
        status,
        statusBadge,
        highlight = [],
        loading = false,
        onStar = null,
        onShare = null,
        onHistory = null,
    },
    ref
) {
    const [showAllAuthors, setShowAllAuthors] = useState(false);

    const formattedTime = useMemo(() => {
        if (!meta?.timestamp) return "—";
        try {
            return new Date(meta.timestamp).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            });
        } catch {
            return String(meta.timestamp);
        }
    }, [meta]);

    const visibleAuthors = showAllAuthors ? authors : authors.slice(0, 6);
    const moreCount = Math.max(0, authors.length - visibleAuthors.length);

    const statusInfo =
        (status && STATUS_MAP[status]) ||
        (statusBadge ? { label: statusBadge, color: "gray", variant: "subtle" } : null);

    /** Skeleton */
    if (loading) {
        return (
            <section
                ref={ref}
                aria-label="Abstract metadata loading"
                className={clsx(
                    "relative isolate mx-auto my-8 rounded-2xl overflow-hidden",
                    "bg-white dark:bg-slate-800",
                    "border border-slate-200 dark:border-slate-700 ring-1 ring-black/5 shadow-2xl",
                    className
                )}
                style={{ maxWidth: "1080px" }}
            >
                <div className="animate-pulse" style={{ padding: "clamp(18px, 3vw, 32px)" }}>
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-5" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-7" />
                    <div className="grid gap-6" style={{ gridTemplateColumns: "2fr 1fr" }}>
                        <div className="space-y-3">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                        </div>
                        <div className="h-28 bg-slate-100 dark:bg-slate-700 rounded-2xl" />
                    </div>
                </div>
            </section>
        );
    }

    /** Card */
    return (
        <section
            ref={ref}
            aria-label="Abstract metadata"
            className={clsx(
                "relative isolate mx-auto my-8 rounded-[20px] overflow-hidden",
                "bg-white dark:bg-slate-800",
                "border border-slate-200 dark:border-slate-700 ring-1 ring-black/5",
                "shadow-[0_12px_36px_rgba(0,0,0,0.08)] hover:shadow-[0_18px_48px_rgba(0,0,0,0.12)] transition-shadow duration-300",
                className
            )}
            style={{ maxWidth: "1080px" }}
        >
            {/* 顶部操作按钮 */}
            <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                {onStar && (
                    <Tooltip label="Star">
                        <button
                            aria-label="Star"
                            onClick={onStar}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                            <StarIcon className="w-5 h-5 text-amber-500" />
                        </button>
                    </Tooltip>
                )}
                {onShare && (
                    <Tooltip label="Share">
                        <button
                            aria-label="Share"
                            onClick={onShare}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                            <ShareIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                        </button>
                    </Tooltip>
                )}
                {onHistory && (
                    <Tooltip label="History">
                        <button
                            aria-label="History"
                            onClick={onHistory}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                            <ClockIcon className="w-5 h-5 text-slate-500" />
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* 内部内容 */}
            <div style={{ padding: "clamp(22px, 3.2vw, 36px)" }}>
                {/* 标题 + 标签 */}
                <div style={{ marginBottom: "18px" }}>
                    <h1
                        className="text-slate-900 dark:text-slate-50 font-extrabold tracking-tight break-words"
                        style={{ fontSize: "clamp(20px, 2.4vw, 30px)", lineHeight: 1.15 }}
                    >
                        <Highlighter text={title} queries={highlight} />
                    </h1>

                    <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
                        {extraTags?.map((t, i) => (
                            <Badge
                                key={i}
                                variant="subtle"
                                color="gray"
                                size="sm"
                                className="uppercase tracking-wide"
                                title={t.label}
                            >
                                {t.label}
                            </Badge>
                        ))}
                        {statusInfo && (
                            <Badge
                                variant={statusInfo.variant === "solid" ? "solid" : "subtle"}
                                color={statusInfo.color}
                                size="sm"
                                className="uppercase tracking-wide"
                            >
                                {statusInfo.label}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* 主体两栏：左信息 + 右 meta */}
                <div
                    className="grid gap-8"
                    style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)" }}
                >
                    {/* 左侧信息 */}
                    <dl className="space-y-4">
                        {/* PMID + PubMed */}
                        <InfoRow term="PMID">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-indigo-700 dark:text-indigo-300 truncate">
                                    {pmid ?? "—"}
                                </span>
                                {!!pmid && (
                                    <Tooltip label="Open in PubMed">
                                        <a
                                            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline"
                                            aria-label={`Open PMID ${pmid} on PubMed`}
                                        >
                                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                            <span className="text-[13px]">PubMed</span>
                                        </a>
                                    </Tooltip>
                                )}
                            </div>
                        </InfoRow>

                        {/* DOI */}
                        {doi && (
                            <InfoRow term="DOI">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="truncate">{doi}</span>
                                    <Tooltip label="Resolve DOI">
                                        <a
                                            href={`https://doi.org/${doi}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline"
                                            aria-label="Open DOI"
                                        >
                                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                            <span className="text-[13px]">Open</span>
                                        </a>
                                    </Tooltip>
                                </div>
                            </InfoRow>
                        )}

                        {/* Journal / Year */}
                        <InfoRow term="Journal">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="truncate">{journal || "—"}</span>
                                <Badge variant="subtle" color="gray" size="sm">
                                    {year || "—"}
                                </Badge>
                            </div>
                        </InfoRow>

                        {/* Authors */}
                        {authors && authors.length > 0 && (
                            <InfoRow term="Authors">
                                <div className="flex flex-wrap items-center gap-2">
                                    {visibleAuthors.map((a, i) => (
                                        <Tooltip key={i} label={a}>
                                            <div
                                                className="text-[12px] px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100 truncate"
                                                style={{ maxWidth: 200 }}
                                                aria-label={`Author ${a}`}
                                                title={a}
                                            >
                                                <Highlighter text={a} queries={highlight} />
                                            </div>
                                        </Tooltip>
                                    ))}
                                    {moreCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllAuthors((s) => !s)}
                                            className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline font-medium"
                                            aria-label={
                                                showAllAuthors ? "Show fewer authors" : `Show ${moreCount} more authors`
                                            }
                                        >
                                            {showAllAuthors ? "Show less" : `+${moreCount} more`}
                                        </button>
                                    )}
                                </div>
                            </InfoRow>
                        )}
                    </dl>

                    {/* 右侧 meta 卡片 */}
                    <aside
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
                        style={{ padding: "18px" }}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[10px] tracking-wider uppercase font-semibold text-slate-700 dark:text-slate-300">
                                    Generated / Reviewed by
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge variant="subtle" color="primary" size="sm">
                                        {meta?.model || "unknown"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-right text-[11px] text-slate-600 dark:text-slate-400">
                                <div className="font-medium">Timestamp</div>
                                <div>{formattedTime}</div>
                            </div>
                        </div>

                        {meta?.extra && (
                            <div className="mt-3 text-[13px] text-slate-700 dark:text-slate-200">{meta.extra}</div>
                        )}

                        {meta?.quality && (
                            <div className="mt-3 flex items-center gap-2">
                                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Quality:</div>
                                <div className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                                    {meta.quality}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </section>
    );
}

if (process.env.NODE_ENV !== "production") {
    AbstractMetaCardImpl.propTypes = {
        className: PropTypes.string,
        title: PropTypes.string.isRequired,
        pmid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        journal: PropTypes.string,
        year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        doi: PropTypes.string,
        authors: PropTypes.arrayOf(PropTypes.string),
        meta: PropTypes.shape({
            timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            model: PropTypes.string,
            extra: PropTypes.string,
            quality: PropTypes.string,
        }),
        extraTags: PropTypes.arrayOf(
            PropTypes.shape({
                label: PropTypes.string.isRequired,
                variant: PropTypes.string,
            })
        ),
        status: PropTypes.string,
        statusBadge: PropTypes.string,
        highlight: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        loading: PropTypes.bool,
        onStar: PropTypes.func,
        onShare: PropTypes.func,
        onHistory: PropTypes.func,
    };
}

const AbstractMetaCard = memo(forwardRef(AbstractMetaCardImpl));
export default AbstractMetaCard;