import { useState } from "react";
import DecisionBadge from "./DecisionBadge";
import PricingDisplay from "./PricingDisplay";
import { useUser } from "../hooks/useUser";
import ConfirmModal from "./ConfirmModal";

/**
 * TopBar: shows title, overall decision, abstract quick info, pricing, reviewer identity, and exit control.
 */
export default function TopBar({ overallDecision, abstract = {}, onExit }) {
    const { user, loading: userLoading } = useUser();
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    return (
        <>
            <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-md">
                {/* Left: title + abstract summary */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                        <div className="text-2xl font-extrabold text-gray-900">Abstract Review</div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 sm:mt-0 text-sm">
                        {abstract?.sentence_count != null && (
                            <div className="flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-full">
                                <div className="font-semibold">{abstract.sentence_count}</div>
                                <div className="text-xs text-gray-600">
                                    sentence{abstract.sentence_count > 1 ? "s" : ""}
                                </div>
                            </div>
                        )}
                        {abstract?.pmid && (
                            <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                                <div className="font-medium">PMID:</div>
                                <div className="truncate">{abstract.pmid}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: decision + pricing */}
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <DecisionBadge decision={overallDecision} />
                        <div className="text-xs text-gray-500">Overall decision</div>
                    </div>
                    <div className="flex items-center">
                        <PricingDisplay abstractId={abstract?.pmid} />
                    </div>
                </div>

                {/* Right: user + exit */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    {!userLoading && user && (
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1 shadow-sm text-sm">
                            <div className="flex flex-col">
                                <div className="font-medium truncate" style={{ maxWidth: 140 }}>
                                    {user.name || user.email}
                                </div>
                                {user.is_admin && (
                                    <div className="mt-0.5 text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                        Admin
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <button
                        aria-label="Exit review"
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm font-semibold hover:bg-red-100 transition"
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
                onConfirm={() => {
                    setShowExitConfirm(false);
                    onExit?.();
                }}
                onCancel={() => setShowExitConfirm(false)}
            />
        </>
    );
}