// src/hooks/usePricing.js
import { useState, useEffect, useCallback, useRef } from "react";
import { request } from "../api";

/**
 * usePricing
 *  - 拉取并轮询 /api/review/pricing?abstract=<id>
 *  - 失败指数退避；页面隐藏时暂停轮询（可配置）
 *  - 支持 AbortController，避免竞态与内存泄漏
 *
 * @param {string} abstractId
 * @param {number} intervalSec 基础轮询间隔（秒）
 * @param {{ enabled?: boolean, pauseOnHidden?: boolean }} options
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

            // 若同一 ID 且已有加载中且非强制，则跳过
            if (lastIdRef.current === abstractId && !force && loading) return;

            // 取消上一次请求
            abortCtrlRef.current?.abort();
            const controller = new AbortController();
            abortCtrlRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const data = await request({
                    method: "GET",
                    url: "/review/pricing",
                    params: { abstract: abstractId }, // 后端期望参数名为 abstract/abstractId/pmid
                    signal: controller.signal,
                });
                if (!mountedRef.current) return;
                setPricing(data);
                setIsStale(false);
                backoffRef.current = 0;
                lastIdRef.current = abstractId;
            } catch (e) {
                if (!mountedRef.current) return;
                backoffRef.current = Math.min(backoffRef.current + 1, 5);
                setError(e);
                if (pricing) setIsStale(true);
            } finally {
                if (!mountedRef.current) return;
                setLoading(false);
            }
        },
        [abstractId, enabled] // 故意不把 pricing 放依赖，避免循环触发
    );

    // 轮询调度（指数退避），可在页面隐藏时暂停
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
            // 页面隐藏时暂停轮询（可选）
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

        // 首次拉取
        doFetch({ force: true });
        schedule();

        const visHandler = () => {
            if (!pauseOnHidden) return;
            // 切回可见时立即刷新
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