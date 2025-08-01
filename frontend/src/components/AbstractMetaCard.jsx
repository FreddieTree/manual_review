// src/components/AbstractMetaCard.jsx
import { useMemo, useState } from "react";
import clsx from "clsx";
import PropTypes from "prop-types";

/** Info row for label + value pairs */
const InfoRow = ({ label, children, className = "" }) => (
    <div className={clsx("flex flex-wrap items-start gap-2 text-sm", className)}>
        <div className="w-24 font-medium text-gray-600">{label}</div>
        <div className="flex-1 flex flex-wrap gap-1 items-center text-gray-800">
            {children}
        </div>
    </div>
);

/** Reusable badge variants */
const Badge = ({ children, variant = "primary", className = "" }) => {
    const base = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition";
    const variants = {
        primary: "bg-gradient-to-r from-indigo-100 to-sky-100 text-indigo-800",
        model: "bg-indigo-200 text-indigo-900",
        year: "bg-blue-50 text-blue-800",
        pill: "bg-gray-100 text-gray-800",
        status: "bg-yellow-100 text-yellow-900",
        warning: "bg-red-100 text-red-800",
    };
    return (
        <div className={clsx(base, variants[variant] || variants.primary, className)}>
            {children}
        </div>
    );
};

/** Simple hover tooltip */
const Tooltip = ({ children, label }) => (
    <div className="relative group inline-block">
        {children}
        {label && (
            <div
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 transition-all absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg"
            >
                {label}
            </div>
        )}
    </div>
);

/** Copy button with temporary feedback */
const CopyButton = ({ value, ariaLabel }) => {
    const [done, setDone] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
        } catch {
            // best effort
        }
    };
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onClick={handleCopy}
            className="ml-1 flex items-center gap-1 text-gray-500 hover:text-gray-700 transition relative"
        >
            {done ? (
                <div className="flex items-center gap-1 text-green-600 text-[11px] font-semibold">
                    <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                </div>
            ) : (
                <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M8 16h8M8 12h8M8 8h8M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )}
        </button>
    );
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
    statusBadge = null,
}) {
    const [showAllAuthors, setShowAllAuthors] = useState(false);

    const formattedTime = useMemo(() => {
        if (!meta?.timestamp) return "-";
        try {
            return new Date(meta.timestamp).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
            });
        } catch {
            return meta.timestamp;
        }
    }, [meta]);

    const visibleAuthors = showAllAuthors ? authors : authors.slice(0, 5);
    const moreCount = Math.max(0, authors.length - visibleAuthors.length);

    return (
        <div
            className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6"
            aria-label="Abstract metadata"
        >
            {/* Left section: title + core identifiers */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start gap-3">
                    <h1
                        className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight break-words flex-1"
                        aria-label="Title"
                    >
                        {title}
                    </h1>
                    <div className="flex flex-wrap gap-2 items-center">
                        {extraTags.map((t, i) => (
                            <Badge key={i} variant={t.variant || "pill"}>
                                {t.label}
                            </Badge>
                        ))}
                        {statusBadge && (
                            <Badge variant="status" className="ml-1">
                                {statusBadge}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <InfoRow label="PMID:">
                        <div className="flex items-center gap-2">
                            <span className="font-mono truncate" aria-label="PMID">
                                {pmid}
                            </span>
                            <CopyButton value={pmid} ariaLabel="Copy PMID" />
                            {pmid && (
                                <Tooltip label="View in external database">
                                    <a
                                        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] underline hover:text-indigo-700"
                                    >
                                        View
                                    </a>
                                </Tooltip>
                            )}
                        </div>
                    </InfoRow>

                    {doi && (
                        <InfoRow label="DOI:">
                            <div className="flex items-center gap-2">
                                <span className="truncate" aria-label="DOI">
                                    {doi}
                                </span>
                                <CopyButton value={doi} ariaLabel="Copy DOI" />
                                <Tooltip label="Resolve DOI">
                                    <a
                                        href={`https://doi.org/${doi}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] underline hover:text-indigo-700"
                                    >
                                        View
                                    </a>
                                </Tooltip>
                            </div>
                        </InfoRow>
                    )}

                    <InfoRow label="Journal:">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate" aria-label="Journal">
                                {journal || "-"}
                            </span>
                            <Badge variant="year">{year || "-"}</Badge>
                        </div>
                    </InfoRow>

                    {authors && authors.length > 0 && (
                        <InfoRow label="Authors:">
                            <div className="flex flex-wrap items-center gap-2">
                                {visibleAuthors.map((a, i) => (
                                    <Tooltip key={i} label={a}>
                                        <div
                                            className="text-[12px] bg-gray-100 px-2 py-1 rounded-full truncate max-w-[140px]"
                                            aria-label={`Author ${a}`}
                                        >
                                            {a}
                                        </div>
                                    </Tooltip>
                                ))}
                                {moreCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllAuthors((s) => !s)}
                                        className="text-[12px] text-indigo-600 hover:underline flex items-center gap-1"
                                        aria-label={showAllAuthors ? "Show fewer authors" : `Show ${moreCount} more authors`}
                                    >
                                        {showAllAuthors ? "Show less" : `+${moreCount} more`}
                                    </button>
                                )}
                            </div>
                        </InfoRow>
                    )}
                </div>
            </div>

            {/* Right section: provenance & metadata */}
            <div className="flex flex-col justify-between gap-4">
                <div className="bg-indigo-50 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <div className="text-[10px] font-semibold uppercase text-indigo-600 tracking-wider">
                                Generated / Reviewed by
                            </div>
                            <div className="mt-1 flex gap-2 flex-wrap items-center">
                                <Badge variant="model">{meta?.model || "unknown"}</Badge>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-600">
                            <div className="font-medium">Timestamp</div>
                            <div>{formattedTime}</div>
                        </div>
                    </div>
                    {meta?.extra && (
                        <div className="text-[12px] text-gray-700 mt-1" aria-label="Extra info">
                            {meta.extra}
                        </div>
                    )}
                    {meta?.quality && (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="text-[11px] font-semibold text-gray-600">Quality:</div>
                            <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                {meta.quality}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

AbstractMetaCard.propTypes = {
    title: PropTypes.string.isRequired,
    pmid: PropTypes.string,
    journal: PropTypes.string,
    year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    doi: PropTypes.string,
    authors: PropTypes.arrayOf(PropTypes.string),
    meta: PropTypes.object,
    extraTags: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            variant: PropTypes.string,
        })
    ),
    statusBadge: PropTypes.string,
};

AbstractMetaCard.defaultProps = {
    pmid: "-",
    journal: "-",
    year: "-",
    doi: null,
    authors: [],
    meta: {},
    extraTags: [],
    statusBadge: null,
};