import DecisionBadge from "./DecisionBadge";
import PricingDisplay from "./PricingDisplay";
import { useUser } from "../hooks/useUser";
import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

export default function TopBar({ overallDecision, abstract, onExit }) {
    const { user, loading: userLoading } = useUser();
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    return (
        <div className="flex flex-wrap justify-between items-center gap-4 bg-white/90 backdrop-blur px-6 py-3 rounded-xl shadow mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="text-xl font-bold text-gray-800 mr-4">Abstract Review</div>
                {abstract?.sentence_count && (
                    <div className="text-sm text-gray-600">• {abstract.sentence_count} sentences</div>
                )}
                {abstract?.pmid && (
                    <div className="text-sm text-gray-600 ml-3">
                        • PMID: <span className="font-medium">{abstract.pmid}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <DecisionBadge decision={overallDecision} />
                    <div className="text-sm text-gray-500">Overall decision</div>
                </div>
                <PricingDisplay abstractId={abstract?.pmid} />
                <div className="flex items-center gap-4">
                    {!userLoading && user && (
                        <div className="text-sm text-gray-700">
                            Reviewer: <span className="font-semibold">{user.name || user.email}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm hover:bg-red-100 transition"
                    >
                        Exit
                    </button>
                </div>
            </div>
            <ConfirmModal
                open={showExitConfirm}
                title="Exit Review"
                description="Are you sure you want to exit? Unsaved progress will be lost."
                confirmText="Exit"
                onConfirm={() => {
                    setShowExitConfirm(false);
                    onExit?.();
                }}
                onCancel={() => setShowExitConfirm(false)}
            />
        </div>
    );
}