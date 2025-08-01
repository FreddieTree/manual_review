// src/components/PricingDisplay.jsx
import React from "react";
import { usePricing } from "../hooks/usePricing";

export default function PricingDisplay({ abstractId }) {
    const { pricing, loading, error } = usePricing(abstractId, 10);

    // 假设后端返回 { per_sentence: 0.02, total: 0.12, currency: "£" }
    const display = () => {
        if (loading) return <span className="text-sm text-gray-500">Pricing...</span>;
        if (error) return <span className="text-sm text-red-500">Price error</span>;
        if (!pricing) return null;
        return (
            <div className="flex flex-col text-right">
                <div className="text-xs text-gray-500">Current pay</div>
                <div className="text-lg font-bold text-green-700">
                    {pricing.currency || "£"}
                    {(pricing.total ?? 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-400">
                    {pricing.per_sentence != null
                        ? `£${pricing.per_sentence.toFixed(3)} / sentence`
                        : null}
                </div>
            </div>
        );
    };

    return (
        <div className="flex items-center gap-2 bg-white/90 px-4 py-2 rounded-2xl shadow-md border border-green-100">
            {display()}
        </div>
    );
}