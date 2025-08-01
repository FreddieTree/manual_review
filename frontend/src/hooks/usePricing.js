// src/hooks/usePricing.js
import { useState, useEffect, useCallback, useRef } from "react";
import { getPricing } from "../api";

/**
 * usePricing: 获取并周期性刷新某 abstract 的定价（带退避、缓存、手动 refetch）
 * @param {string} abstractId
 * @param {number} intervalSec base 轮询间隔（失败后会退避）
 * @param {object} options
 *    enabled: boolean 是否启用（默认 true）
 */
export function usePricing(abstractId, intervalSec = 15, options = {}) {
    const { enabled = true } = options;
    const [pricing, setPricing] = useState(null);
    const [loading, setLoading] = useState(Boolean(abstractId));
    const [error, setError] = useState(null);
    const [isStale, setIsStale] = useState(false);

    const abortCtrlRef = useRef(null);
    const backoffRef = useRef(0); // failure count
    const intervalRef = useRef(null);
    const lastFetchedId = useRef(null);
    const isMounted = useRef(true);

    const fetchPricing = useCallback(
        async ({ force = false } = {}) => {
            if (!abstractId || !enabled) return;
            // avoid duplicate concurrent for same id
            if (lastFetchedId.current === abstractId && !force && loading) return;

            // abort previous
            abortCtrlRef.current?.abort();
            const controller = new AbortController();
            abortCtrlRef.current = controller;

            setLoading(true);
            setError(null);
            try {
                const data = await getPricing({ params: { abstractId } }); // assume API can take param; backend adapt if needed
                if (!isMounted.current) return;
                setPricing(data);
                setIsStale(false);
                backoffRef.current = 0;
                lastFetchedId.current = abstractId;
                setError(null);
            } catch (e) {
                if (!isMounted.current) return;
                backoffRef.current = Math.min(backoffRef.current + 1, 5); // cap exponent
                setError(e);
                // mark stale only if we had previous data
                if (pricing) setIsStale(true);
            } finally {
                if (!isMounted.current) return;
                setLoading(false);
            }
        },
        [abstractId, enabled] // intentionally omit pricing to avoid loop
    );

    // auto polling with backoff logic
    useEffect(() => {
        if (!enabled || !abstractId) return () => { };
        isMounted.current = true;

        // initial fetch
        fetchPricing({ force: true });

        const scheduleNext = () => {
            const failures = backoffRef.current;
            // exponential backoff: interval * 2^failures, capped to 5x base
            const delay = Math.min(intervalSec * Math.pow(2, failures), intervalSec * 8) * 1000;
            intervalRef.current = setTimeout(async () => {
                await fetchPricing();
                if (isMounted.current) scheduleNext();
            }, delay);
        };

        scheduleNext();

        return () => {
            isMounted.current = false;
            clearTimeout(intervalRef.current);
            abortCtrlRef.current?.abort();
        };
    }, [abstractId, intervalSec, enabled, fetchPricing]);

    // manual refetch exposed
    const refetch = useCallback(() => {
        return fetchPricing({ force: true });
    }, [fetchPricing]);

    return {
        pricing,
        loading,
        error,
        isStale,
        refetch,
    };
}