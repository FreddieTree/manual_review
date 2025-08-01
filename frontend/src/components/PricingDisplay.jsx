// src/components/PricingDisplay.jsx
import { useEffect, useState } from "react";
import { getPricing } from "../api";

export default function PricingDisplay({ abstractId }) {
    const [pricing, setPricing] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetch = async () => {
        try {
            const data = await getPricing();
            setPricing(data);
        } catch {
            setPricing(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch();
        const iv = setInterval(fetch, 10000); // 每 10s 刷新
        return () => clearInterval(iv);
    }, []);

    if (loading) return <div className="text-sm text-gray-500">Pricing…</div>;
    if (!pricing)
        return <div className="text-sm text-red-500">Pricing unavailable</div>;

    // 这里可以按后端返回结构自定义计算显示逻辑
    return (
        <div className="flex flex-col items-end text-right">
            <div className="text-xs text-gray-600">Current payout</div>
            <div className="text-lg font-bold text-green-700">
                £{(pricing?.amount || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
                {pricing?.detail || "Base + additions"}
            </div>
        </div>
    );
}