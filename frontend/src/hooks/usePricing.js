import { useState, useEffect, useCallback, useRef } from "react";
import { getPricing } from "../api/pricing";

/**
 * usePricing：自动拉取并轮询 pricing，支持 pauseOnHidden
 */
export function usePricing(abstractId, intervalSec = 15, options = {}) {
    const { enabled = true, pauseOnHidden = true } = options;

    const [pricing, setPricing] = useState(null);
    const [loading, setLoading] = useState(Boolean(abstractId && enabled));
    const [error, setError] = useState(null);
    const [isStale, setIsStale] = useState(false);

    const abortCtrlRef = useRef(null);
    const timerRef = useRef(null);
    const backoffRef = useRef(0);
    const lastIdRef = useRef(null);
    const mountedRef = useRef(false);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const doFetch = useCallback(
        async ({ force = false } = {}) => {
            if (!enabled || !abstractId) return;
            if (lastIdRef.current === abstractId && !force && loading) return;
            abortCtrlRef.current?.abort();
            const controller = new AbortController();
            abortCtrlRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const data = await getPricing(abstractId, { signal: controller.signal });
                // 关键 debug！
                if (!mountedRef.current) return;
                setPricing(data);
                setIsStale(false);
                backoffRef.current = 0;
                lastIdRef.current = abstractId;
            } catch (e) {
                // 忽略因请求被 cancel（abort）导致的错误
                if (
                    (e && e.message && e.message.toLowerCase().includes("cancel")) ||
                    (e && e.name === "CanceledError")
                ) {
                    // 直接 return，不 setError
                    return;
                }
                if (!mountedRef.current) return;
                backoffRef.current = Math.min(backoffRef.current + 1, 5);
                setError(e);
                if (pricing) setIsStale(true);
            } finally {
                if (!mountedRef.current) return;
                setLoading(false);
            }
        },
        [abstractId, enabled]
    );

    useEffect(() => {
        mountedRef.current = true;
        const shouldRun = enabled && Boolean(abstractId);
        if (!shouldRun) {
            clearTimer();
            return () => {
                mountedRef.current = false;
                abortCtrlRef.current?.abort();
            };
        }
        const isHidden = () => document.visibilityState === "hidden";
        const schedule = () => {
            if (!mountedRef.current) return;
            if (pauseOnHidden && isHidden()) {
                timerRef.current = setTimeout(schedule, 1000);
                return;
            }
            const fail = backoffRef.current;
            const delayMs = Math.min(intervalSec * Math.pow(2, fail), intervalSec * 8) * 1000;
            timerRef.current = setTimeout(async () => {
                await doFetch();
                schedule();
            }, delayMs);
        };
        doFetch({ force: true });
        schedule();
        const visHandler = () => {
            if (!pauseOnHidden) return;
            if (document.visibilityState === "visible") {
                clearTimer();
                doFetch({ force: true });
                schedule();
            }
        };
        document.addEventListener("visibilitychange", visHandler);
        return () => {
            mountedRef.current = false;
            document.removeEventListener("visibilitychange", visHandler);
            clearTimer();
            abortCtrlRef.current?.abort();
        };
    }, [abstractId, intervalSec, enabled, pauseOnHidden, doFetch]);

    const refetch = useCallback(() => doFetch({ force: true }), [doFetch]);

    return { pricing, loading, error, isStale, refetch };
}