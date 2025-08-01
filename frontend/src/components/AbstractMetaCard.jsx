// src/components/AbstractMetaCard.jsx
import React, { useMemo, useState } from "react";
import clsx from "clsx";
import PropTypes from "prop-types";
import Badge from "./ui/Badge";
import Tooltip from "./ui/Tooltip";
import CopyButton from "./ui/CopyButton";
import {
    ArrowTopRightOnSquareIcon,
    StarIcon,
    ShareIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";

/** Stable highlighter: splits text and wraps matched queries, case-insensitive. */
function Highlighter({ text = "", queries = [] }) {
    const normalizedQueries = useMemo(() => {
        if (!queries) return [];
        if (Array.isArray(queries)) return queries.filter(Boolean).map(q => q.trim()).filter(Boolean);
        if (typeof queries === "string" && queries.trim()) return [queries.trim()];
        return [];
    }, [queries]);

    const parts = useMemo(() => {
        if (!text || normalizedQueries.length === 0) return [{ text, match: false }];

        // Build regex safely
        const escaped = normalizedQueries.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const regex = new RegExp(`(${escaped.join("|")})`, "gi");

        const result = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const matchText = match[0];
            const index = match.index;
            if (index > lastIndex) {
                result.push({ text: text.slice(lastIndex, index), match: false });
            }
            result.push({ text: matchText, match: true });
            lastIndex = index + matchText.length;
            // prevent infinite loops for zero-length matches
            if (regex.lastIndex === match.index) regex.lastIndex++;
        }
        if (lastIndex < text.length) {
            result.push({ text: text.slice(lastIndex), match: false });
        }
        return result;
    }, [text, normalizedQueries]);

    if (!normalizedQueries.length) return <span>{text}</span>;

    return (
        <>
            {parts.map((p, i) =>
                p.match ? (
                    <mark
                        key={i}
                        className="bg-yellow-100 dark:bg-yellow-600 text-yellow-800 dark:text-yellow-200 font-semibold px-0.5 rounded"
                    >
                        {p.text}
                    </mark>
                ) : (
                    <span key={i}>{p.text}</span>
                )
            )}
        </>
    );
}

/** InfoRow: semantic label/value pair */
const InfoRow = ({ term, children, className = "" }) => (
    <div className={clsx("flex flex-wrap gap-3 items-start text-sm", className)}>
        <dt className="w-24 flex-shrink-0 font-medium text-gray-600 dark:text-gray-300">{term}</dt>
        <dd className="flex-1 flex flex-wrap gap-2 items-center text-gray-800 dark:text-gray-100">
            {children}
        </dd>
    </div>
);

// Semantic status map drives badge appearance
const STATUS_MAP = {
    conflict: { label: "Conflict", color: "danger", variant: "solid" },
    resolved: { label: "Resolved", color: "success", variant: "solid" },
    pending: { label: "Pending", color: "primary", variant: "subtle" },
    uncertain: { label: "Uncertain", color: "warning", variant: "subtle" },
    accepted: { label: "Accepted", color: "success", variant: "subtle" },
    rejected: { label: "Rejected", color: "danger", variant: "subtle" },
};

export default function AbstractMetaCard({
    title,
    pmid,
    journal,
    year,
    doi = null,
    authors = [],
    meta = {},
    extraTags = [],
    status, // semantic status key
    statusBadge, // fallback string
    highlight = [],
    loading = false,
    onStar = null,
    onShare = null,
    onHistory = null,
}) {
    const [showAllAuthors, setShowAllAuthors] = useState(false);

    const formattedTime = useMemo(() => {
        if (!meta?.timestamp) return "—";
        try {
            return new Date(meta.timestamp).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
            });
        } catch {
            return String(meta.timestamp);
        }
    }, [meta]);

    const visibleAuthors = showAllAuthors ? authors : authors.slice(0, 5);
    const moreCount = Math.max(0, authors.length - visibleAuthors.length);

    // resolve status info
    let statusInfo = null;
    if (status && STATUS_MAP[status]) statusInfo = STATUS_MAP[status];
    else if (statusBadge) {
        statusInfo = { label: statusBadge, color: "gray", variant: "subtle" };
    }

    // Loading skeleton
    if (loading) {
        return (
            <section
                aria-label="Abstract metadata placeholder"
                className="relative bg-gray-100 dark:bg-[#111827] rounded-3xl overflow-hidden p-6 animate-pulse grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6"
            >
                <div className="space-y-4">
                    <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                    <div className="flex gap-2">
                        <div className="h-7 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
                        <div className="h-7 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
                    </div>
                </div>
                <div className="flex flex-col justify-between gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900 rounded-2xl p-5 flex flex-col gap-3 border border-indigo-100 dark:border-indigo-700">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-24" />
                                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-32" />
                            </div>
                            <div className="space-y-1 text-right">
                                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-16" />
                                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20" />
                            </div>
                        </div>
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full" />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            aria-label="Abstract metadata"
            className="relative bg-white dark:bg-[#1f2937] rounded-3xl shadow-lg dark:shadow-xl border border-gray-100 dark:border-gray-700 p-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 overflow-hidden"
        >
            {/* Action zone */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                {onStar && (
                    <Tooltip label="Star abstract" placement="bottom">
                        <button
                            aria-label="Star"
                            onClick={onStar}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400"
                        >
                            <StarIcon className="w-5 h-5 text-yellow-500" />
                        </button>
                    </Tooltip>
                )}
                {onShare && (
                    <Tooltip label="Share" placement="bottom">
                        <button
                            aria-label="Share"
                            onClick={onShare}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400"
                        >
                            <ShareIcon className="w-5 h-5 text-indigo-600" />
                        </button>
                    </Tooltip>
                )}
                {onHistory && (
                    <Tooltip label="View history" placement="bottom">
                        <button
                            aria-label="History"
                            onClick={onHistory}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                        >
                            <ClockIcon className="w-5 h-5 text-gray-500" />
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* Left content */}
            <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight break-words">
                            <Highlighter text={title} queries={highlight} />
                        </h1>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {extraTags.map((t, i) => (
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
                                    className="ml-1 uppercase tracking-wider"
                                    title={statusInfo.label}
                                >
                                    {statusInfo.label}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <dl className="space-y-3">
                    <InfoRow term="PMID:">
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="font-mono truncate text-indigo-700 dark:text-indigo-300"
                                aria-label="PMID"
                            >
                                {pmid ?? "—"}
                            </span>
                            <CopyButton
                                value={String(pmid || "")}
                                ariaLabel="Copy PMID"
                                className="flex-shrink-0"
                            />
                            {pmid && (
                                <Tooltip label="Open on PubMed">
                                    <a
                                        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline transition"
                                    >
                                        <ArrowTopRightOnSquareIcon
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                        />
                                        <span className="sr-only">Open PMID externally</span>
                                    </a>
                                </Tooltip>
                            )}
                        </div>
                    </InfoRow>

                    {doi && (
                        <InfoRow term="DOI:">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{doi}</span>
                                <CopyButton value={doi} ariaLabel="Copy DOI" />
                                <Tooltip label="Resolve DOI">
                                    <a
                                        href={`https://doi.org/${doi}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline transition"
                                    >
                                        <ArrowTopRightOnSquareIcon
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                        />
                                        <span className="sr-only">Open DOI externally</span>
                                    </a>
                                </Tooltip>
                            </div>
                        </InfoRow>
                    )}

                    <InfoRow term="Journal:">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="truncate">{journal || "—"}</span>
                            <Badge variant="subtle" color="gray" size="sm">
                                {year || "—"}
                            </Badge>
                        </div>
                    </InfoRow>

                    {authors && authors.length > 0 && (
                        <InfoRow term="Authors:">
                            <div className="flex flex-wrap items-center gap-2">
                                {visibleAuthors.map((a, i) => (
                                    <Tooltip key={i} label={a}>
                                        <div
                                            className="text-[12px] bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full truncate max-w-[160px]"
                                            aria-label={`Author ${a}`}
                                        >
                                            <Highlighter text={a} queries={highlight} />
                                        </div>
                                    </Tooltip>
                                ))}
                                {moreCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllAuthors(s => !s)}
                                        className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1 font-medium transition"
                                        aria-label={
                                            showAllAuthors
                                                ? "Show fewer authors"
                                                : `Show ${moreCount} more authors`
                                        }
                                    >
                                        {showAllAuthors ? "Show less" : `+${moreCount} more`}
                                    </button>
                                )}
                            </div>
                        </InfoRow>
                    )}
                </dl>
            </div>

            {/* Right meta */}
            <div className="flex flex-col justify-between gap-4">
                <div className="bg-indigo-50 dark:bg-[#111827] rounded-2xl p-5 flex flex-col gap-4 border border-indigo-100 dark:border-indigo-700">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <div className="text-[10px] font-semibold uppercase text-indigo-700 dark:text-indigo-300 tracking-wide">
                                Generated / Reviewed by
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <Badge variant="subtle" color="primary" size="sm">
                                    {meta?.model || "unknown"}
                                </Badge>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-600 dark:text-gray-400">
                            <div className="font-medium">Timestamp</div>
                            <div>{formattedTime}</div>
                        </div>
                    </div>
                    {meta?.extra && (
                        <div
                            className="text-sm text-gray-700 dark:text-gray-200"
                            aria-label="Extra info"
                        >
                            {meta.extra}
                        </div>
                    )}
                    {meta?.quality && (
                        <div className="mt-1 flex items-center gap-2">
                            <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                Quality:
                            </div>
                            <div className="text-xs px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full">
                                {meta.quality}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

AbstractMetaCard.propTypes = {
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

AbstractMetaCard.defaultProps = {
    pmid: "-",
    journal: "-",
    year: "-",
    doi: null,
    authors: [],
    meta: {},
    extraTags: [],
    status: null,
    statusBadge: null,
    highlight: [],
    loading: false,
    onStar: null,
    onShare: null,
    onHistory: null,
};