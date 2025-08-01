// src/hooks/useDebounce.js
import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Debounced value hook.
 * Returns a version of `value` that only updates after `delay` ms of no changes.
 * Supports optional leading edge emission.
 */
export function useDebouncedValue(value, delay = 200, options = {}) {
    const { leading = false } = options;
    const [debounced, setDebounced] = useState(value);
    const timerRef = useRef(null);
    const firstRunRef = useRef(true);
    const lastValueRef = useRef(value);

    useEffect(() => {
        // If leading and first time, emit immediately
        if (leading && firstRunRef.current) {
            setDebounced(value);
            firstRunRef.current = false;
            lastValueRef.current = value;
            return;
        }

        // If value hasn't changed, do nothing
        if (value === lastValueRef.current) return;
        lastValueRef.current = value;

        // Clear previous pending
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            setDebounced(value);
            timerRef.current = null;
        }, delay);

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
 * Debounced callback hook.
 * Returns a debounced version of `fn` and controls: cancel, flush, isPending.
 * Supports leading edge and optional maxWait to ensure execution.
 */
export function useDebouncedCallback(fn, delay = 200, options = {}) {
    const { leading = false, maxWait = null } = options;
    const fnRef = useRef(fn);
    const timerRef = useRef(null);
    const lastInvokeTimeRef = useRef(0);
    const lastCallTimeRef = useRef(null);
    const pendingRef = useRef(false);
    const lastArgsRef = useRef([]);

    // keep latest function
    useEffect(() => {
        fnRef.current = fn;
    }, [fn]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = false;
        lastCallTimeRef.current = null;
        lastArgsRef.current = [];
    }, []);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (pendingRef.current) {
            pendingRef.current = false;
            lastInvokeTimeRef.current = Date.now();
            fnRef.current(...lastArgsRef.current);
            lastArgsRef.current = [];
        }
    }, []);

    const isPending = useCallback(() => !!pendingRef.current, []);

    const debounced = useCallback(
        (...args) => {
            const now = Date.now();
            lastArgsRef.current = args;

            const shouldInvokeImmediately =
                leading && !pendingRef.current;

            // maxWait enforcement
            if (maxWait != null && lastInvokeTimeRef.current) {
                const timeSinceLastInvoke = now - lastInvokeTimeRef.current;
                if (timeSinceLastInvoke >= maxWait) {
                    cancel();
                    lastInvokeTimeRef.current = now;
                    fnRef.current(...args);
                    return;
                }
            }

            if (shouldInvokeImmediately) {
                pendingRef.current = true;
                lastInvokeTimeRef.current = now;
                fnRef.current(...args);
            }

            if (timerRef.current) clearTimeout(timerRef.current);

            pendingRef.current = true;
            lastCallTimeRef.current = now;

            timerRef.current = setTimeout(() => {
                if (!leading || (leading && now !== lastInvokeTimeRef.current)) {
                    lastInvokeTimeRef.current = Date.now();
                    fnRef.current(...lastArgsRef.current);
                }
                pendingRef.current = false;
                timerRef.current = null;
                lastArgsRef.current = [];
            }, delay);
        },
        [cancel, delay, leading, maxWait]
    );

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return [debounced, { cancel, flush, isPending }];
}