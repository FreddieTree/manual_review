import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import DecisionBadge from "./DecisionBadge";
import PricingDisplay from "./PricingDisplay";
import { useUser } from "../hooks/useUser";
import ConfirmModal from "./ConfirmModal";
import Badge from "./ui/Badge";
import CopyButton from "./ui/CopyButton";
import Tooltip from "./ui/Tooltip";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

/**
 * TopBar: shows title, overall decision, abstract quick info, pricing, reviewer identity, and exit control.
 */
export default function TopBar({ overallDecision, abstract = {}, onExit }) {
    const { user, loading: userLoading } = useUser();
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const handleExit = useCallback(() => {
        setShowExitConfirm(false);
        onExit?.();
    }, [onExit]);

    const sentenceCount = abstract?.sentence_count;
    const pmid = abstract?.pmid;

    return (
        <>
            <div
                className="w-full flex flex-wrap items-center justify-between gap-4 bg-white/75 dark:bg-[#1f2937]/75 backdrop-blur-md px-6 py-3 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700"
                aria-label="Top bar with review summary"
            >
                {/* Left: title + abstract summary */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight">
                            Abstract Review
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 sm:mt-0 text-sm">
                        {sentenceCount != null && (
                            <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full">
                                <div className="font-semibold text-indigo-700 dark:text-indigo-300">
                                    {sentenceCount}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                    sentence{sentenceCount > 1 ? "s" : ""}
                                </div>
                            </div>
                        )}
                        {pmid && (
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2a3447] px-3 py-1 rounded-full">
                                <div className="flex items-center gap-1">
                                    <div className="font-medium text-gray-700 dark:text-gray-200">PMID:</div>
                                    <div className="font-mono truncate text-gray-800 dark:text-indigo-200 max-w-[100px]">
                                        {pmid}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <CopyButton value={String(pmid)} ariaLabel="Copy PMID" size={4} />
                                    <Tooltip label="Open in PubMed">
                                        <a
                                            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="View PMID externally"
                                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                        >
                                            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                                        </a>
                                    </Tooltip>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: decision + pricing */}
                <div className="flex flex-wrap items-center gap-6 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <div className="flex items-center gap-2">
                                <DecisionBadge decision={overallDecision} />
                                <div className="text-xs text-gray-500 dark:text-gray-400">Overall decision</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <PricingDisplay abstractId={pmid} compact={false} showTooltip={true} />
                    </div>
                </div>

                {/* Right: user + exit */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    {/* User identity */}
                    {!userLoading && user ? (
                        <div className="flex items-center gap-3 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-600 rounded-full px-4 py-2 shadow-sm text-sm">
                            <div className="flex flex-col min-w-0">
                                <div
                                    className="font-medium truncate"
                                    style={{ maxWidth: 160 }}
                                    title={user.name || user.email}
                                >
                                    {user.name || user.email}
                                </div>
                                {user.is_admin && (
                                    <div className="mt-0.5 inline-block text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                        Admin
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" aria-label="Loading user info" />
                    )}

                    {/* Exit button */}
                    <button
                        aria-label="Exit review"
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-700 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900 transition"
                    >
                        Exit
                    </button>
                </div>
            </div>

            <ConfirmModal
                open={showExitConfirm}
                title="Exit Review"
                description="Are you sure you want to exit? Any unsaved progress will be lost."
                confirmText="Exit"
                onConfirm={handleExit}
                onCancel={() => setShowExitConfirm(false)}
            />
        </>
    );
}

TopBar.propTypes = {
    overallDecision: PropTypes.string,
    abstract: PropTypes.object,
    onExit: PropTypes.func,
};

TopBar.defaultProps = {
    overallDecision: "uncertain",
    abstract: {},
    onExit: null,
};