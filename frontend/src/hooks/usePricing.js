// src/hooks/usePricing.js
import { useState, useEffect, useCallback } from "react";
import { getPricing } from "../api";

/**
 * usePricing: 每隔 interval 秒刷新一次价格
 * @param {string} abstractId 用于获取该 abstract 的定价（如 PMID）
 * @param {number} intervalSec 轮询间隔（默认 15 秒）
 */
export function usePricing(abstractId, intervalSec = 15) {
    const [pricing, setPricing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetch = useCallback(async () => {
        if (!abstractId) return;
        setLoading(true);
        try {
            const data = await getPricing(); // 可扩展为带参数：/review/pricing?abstract=xxx
            setPricing(data);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [abstractId]);

    useEffect(() => {
        fetch();
        const iv = setInterval(fetch, intervalSec * 1000);
        return () => clearInterval(iv);
    }, [fetch, intervalSec]);

    return {
        pricing,
        loading,
        error,
        refresh: fetch,
    };
}