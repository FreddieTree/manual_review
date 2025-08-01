// src/hooks/usePricing.js
import { useEffect, useState, useMemo } from "react";
import { getPricing } from "../api";
import { debounce } from "lodash-es";

/**
 * Hook to fetch backend pricing and compute dynamic estimate.
 * @param {*} abstractData - the current abstract object, expected to include sentence_results and maybe metadata
 * @returns { estimated, backend, loading, error, refresh }
 */
export default function usePricing(abstractData) {
    const [backend, setBackend] = useState(null);
    const [loadingBackend, setLoadingBackend] = useState(true);
    const [error, setError] = useState(null);

    // fetch backend pricing (could include base pay, per-assertion, etc.)
    const fetchBackend = async () => {
        setLoadingBackend(true);
        setError(null);
        try {
            const res = await getPricing();
            setBackend(res);
        } catch (e) {
            setError(e);
            setBackend(null);
        } finally {
            setLoadingBackend(false);
        }
    };

    useEffect(() => {
        fetchBackend();
    }, []);

    // local estimate logic: if backend provides rules use them, else fallback
    const estimated = useMemo(() => {
        if (!abstractData) return null;
        // Simple default formula if backend not available
        const base = backend?.base_per_abstract ?? 0.3;
        const addPer = backend?.per_assertion_add ?? 0.05;

        // Count number of new assertions vs existing maybe from meta
        let added = 0;
        if (abstractData.sentence_results) {
            abstractData.sentence_results.forEach(s => {
                const existing = s.assertions || [];
                const reviewed = s.reviewState?.addedAssertions || [];
                // Assuming added ones tracked separately; fallback: difference in length?
                if (Array.isArray(reviewed)) {
                    added += reviewed.length;
                }
            });
        }

        // Fallback: if no tracking, assume zero added
        return (base + added * addPer).toFixed(2);
    }, [abstractData, backend]);

    // Debounced version of estimate (if heavy recompute in future)
    const [debouncedEstimated, setDebouncedEstimated] = useState(estimated);
    useEffect(() => {
        const runner = debounce(() => setDebouncedEstimated(estimated), 200);
        runner();
        return () => runner.cancel();
    }, [estimated]);

    const refresh = () => {
        fetchBackend();
    };

    return {
        estimated: debouncedEstimated,
        backend,
        loading: loadingBackend,
        error,
        refresh,
    };
}