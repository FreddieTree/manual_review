// src/components/AbstractMetaCard.jsx
import { useMemo } from "react";

const InfoPair = ({ label, children }) => (
    <div className="flex flex-wrap items-start gap-2 text-sm">
        <div className="w-24 font-semibold text-gray-600">{label}</div>
        <div className="flex-1 flex items-center gap-1 flex-wrap text-gray-800">
            {children}
        </div>
    </div>
);

const Badge = ({ children, variant = "primary", className = "" }) => {
    const base = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
    const variants = {
        primary: "bg-gradient-to-r from-indigo-100 to-sky-100 text-indigo-800",
        model: "bg-indigo-200 text-indigo-900",
        year: "bg-blue-50 text-blue-800",
    };
    return (
        <div className={`${base} ${variants[variant] || variants.primary} ${className}`}>
            {children}
        </div>
    );
};

const CopyButton = ({ value, ariaLabel }) => {
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            // optional: show ephemeral feedback
        } catch { }
    };
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onClick={handleCopy}
            className="ml-1 text-gray-400 hover:text-gray-600 transition"
            title="Copy"
        >
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
}) {
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

    return (
        <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
            {/* Left: Title and core info */}
            <div className="flex flex-col gap-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight break-words">
                    {title}
                </h1>

                <div className="space-y-2">
                    <InfoPair label="PMID:">
                        <div className="flex items-center gap-1">
                            <span className="truncate">{pmid}</span>
                            <CopyButton value={pmid} ariaLabel="Copy PMID" />
                        </div>
                    </InfoPair>
                    {doi && (
                        <InfoPair label="DOI:">
                            <div className="flex items-center gap-1">
                                <span className="truncate">{doi}</span>
                                <CopyButton value={doi} ariaLabel="Copy DOI" />
                            </div>
                        </InfoPair>
                    )}
                    <InfoPair label="Journal:">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span>{journal}</span>
                            <Badge variant="year">{year}</Badge>
                        </div>
                    </InfoPair>
                    {authors && authors.length > 0 && (
                        <InfoPair label="Authors:">
                            <div className="flex flex-wrap gap-1">
                                {authors.slice(0, 5).map((a, i) => (
                                    <div
                                        key={i}
                                        className="text-[12px] bg-gray-100 px-2 py-1 rounded-full"
                                    >
                                        {a}
                                    </div>
                                ))}
                                {authors.length > 5 && (
                                    <div className="text-[12px] text-gray-500">
                                        +{authors.length - 5} more
                                    </div>
                                )}
                            </div>
                        </InfoPair>
                    )}
                </div>
            </div>

            {/* Right: provenance / model & timestamp */}
            <div className="flex flex-col justify-between gap-4">
                <div className="bg-indigo-50 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                        <div className="text-xs font-semibold uppercase text-indigo-600 tracking-wide">
                            Generated / Reviewed by
                        </div>
                        <Badge variant="model">{meta?.model || "unknown"}</Badge>
                    </div>
                    <div className="text-[13px] text-gray-700">
                        <div className="flex items-center gap-1">
                            <div className="font-medium">Timestamp:</div>
                            <div>{formattedTime}</div>
                        </div>
                        {meta?.extra && (
                            <div className="mt-1 text-[12px] text-gray-600">{meta.extra}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}