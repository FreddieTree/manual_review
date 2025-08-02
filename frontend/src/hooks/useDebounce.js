// src/hooks/useDebounce.js
import { useState, useRef, useEffect, useCallback } from "react";

/** 保持不变 */
export function useDebouncedValue(value, delay = 200, options = {}) {
    const { leading = false } = options;
    const [debounced, setDebounced] = useState(value);
    const timerRef = useRef(null);

    useEffect(() => {
        if (leading && !timerRef.current) {
            setDebounced(value);
        }
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            setDebounced(value);
            timerRef.current = null;
        }, Math.max(0, delay));

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [value, delay, leading]);

    return debounced;
}

/**
 * 修复后的 useDebouncedCallback：
 * - 使用 firstPendingAtRef 记录“本轮 pending 的起始时间”
 * - maxWait 基于 firstPendingAtRef（非 leading）或 lastInvokeRef（leading）计算
 */
export function useDebouncedCallback(fn, delay = 200, options = {}) {
    const { leading = false, maxWait = null } = options;

    const fnRef = useRef(fn);
    const timerRef = useRef(null);
    const maxWaitTimerRef = useRef(null);

    const pendingRef = useRef(false);
    const lastArgsRef = useRef([]);
    const lastInvokeRef = useRef(0);
    const firstPendingAtRef = useRef(null); // ★ 新增

    useEffect(() => {
        fnRef.current = fn;
    }, [fn]);

    const resetTimers = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (maxWaitTimerRef.current) {
            clearTimeout(maxWaitTimerRef.current);
            maxWaitTimerRef.current = null;
        }
    }, []);

    const invoke = useCallback(() => {
        if (!pendingRef.current) return;
        pendingRef.current = false;
        lastInvokeRef.current = Date.now();
        const args = lastArgsRef.current;
        lastArgsRef.current = [];
        firstPendingAtRef.current = null; // ★ 清理起始时间
        fnRef.current(...args);
    }, []);

    const cancel = useCallback(() => {
        resetTimers();
        pendingRef.current = false;
        lastArgsRef.current = [];
        firstPendingAtRef.current = null; // ★ 清理
    }, [resetTimers]);

    const flush = useCallback(() => {
        resetTimers();
        invoke();
    }, [invoke, resetTimers]);

    const isPending = useCallback(() => !!pendingRef.current, []);

    const debounced = useCallback(
        (...args) => {
            lastArgsRef.current = args;
            const now = Date.now();

            const noTimer = !timerRef.current;
            const wasPending = pendingRef.current;

            // leading：仅在没有现存计时器且非 pending 时即时触发一次
            if (leading && noTimer && !wasPending) {
                pendingRef.current = true;
                lastInvokeRef.current = now;
                firstPendingAtRef.current = null; // 这次直接触发，不开启 pending 起点
                fnRef.current(...args);
            }

            // 无论是否 leading，都安排 trailing
            if (timerRef.current) clearTimeout(timerRef.current);
            pendingRef.current = true;

            // 若本轮首次进入 pending，记录起始时间（用于 maxWait）
            if (firstPendingAtRef.current == null) {
                firstPendingAtRef.current = now;
            }

            timerRef.current = setTimeout(() => {
                invoke();
                timerRef.current = null;
            }, Math.max(0, delay));

            // maxWait：确保最长等待后一定触发一次
            if (maxWait != null && maxWait > 0) {
                // 计算自“本轮可触发基准”以来已过去的时间
                const baseTs =
                    leading && lastInvokeRef.current
                        ? lastInvokeRef.current
                        : firstPendingAtRef.current ?? now;

                const since = Math.max(0, now - baseTs);
                const remain = Math.max(0, maxWait - since);

                if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                maxWaitTimerRef.current = setTimeout(() => {
                    flush();
                    maxWaitTimerRef.current = null;
                }, remain);
            }
        },
        [delay, leading, maxWait, invoke, flush]
    );

    useEffect(() => cancel, [cancel]);

    return [debounced, { cancel, flush, isPending }];
}