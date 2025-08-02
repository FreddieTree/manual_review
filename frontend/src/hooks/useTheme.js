// src/hooks/useTheme.js
import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "theme-preference"; // "light" | "dark" | "system"

export function getSystemTheme() {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateMetaThemeColor(effective) {
    // 同步 <meta name="theme-color">，提升移动端沉浸体验
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", effective === "dark" ? "#0f1f44" : "#f0f6ff");
}

export function useTheme() {
    const [mode, setMode] = useState(() => {
        if (typeof window === "undefined") return "system";
        return localStorage.getItem(STORAGE_KEY) || "system";
    });
    const [resolved, setResolved] = useState(() => (mode === "system" ? getSystemTheme() : mode));

    const apply = useCallback((effective) => {
        const root = document.documentElement;
        if (effective === "dark") {
            root.setAttribute("data-theme", "dark");
            root.classList.add("dark");
        } else {
            root.setAttribute("data-theme", "light");
            root.classList.remove("dark");
        }
        updateMetaThemeColor(effective);
    }, []);

    // 监听系统偏好（仅在 system 模式下）
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (e) => {
            if (mode === "system") {
                const eff = e.matches ? "dark" : "light";
                setResolved(eff);
                apply(eff);
            }
        };
        mq.addEventListener?.("change", onChange) ?? mq.addListener(onChange);
        return () => {
            mq.removeEventListener?.("change", onChange) ?? mq.removeListener(onChange);
        };
    }, [mode, apply]);

    // 模式变化或 system 解析变化时应用
    useEffect(() => {
        const eff = mode === "system" ? getSystemTheme() : mode;
        setResolved(eff);
        apply(eff);
    }, [mode, apply]);

    const setTheme = useCallback((newMode) => {
        localStorage.setItem(STORAGE_KEY, newMode);
        setMode(newMode);
    }, []);

    return { mode, resolved, setTheme };
}