import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "theme-preference"; // "light" | "dark" | "system"

export function getSystemTheme() {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
    const [mode, setMode] = useState(() => {
        if (typeof window === "undefined") return "system";
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved || "system";
    });
    const [resolved, setResolved] = useState(() => (mode === "system" ? getSystemTheme() : mode));

    const apply = useCallback(
        (effective) => {
            const root = document.documentElement;
            if (effective === "dark") {
                root.setAttribute("data-theme", "dark");
                root.classList.add("dark");
            } else {
                root.setAttribute("data-theme", "light");
                root.classList.remove("dark");
            }
        },
        []
    );

    // watch system preference if mode === system
    useEffect(() => {
        const listener = (e) => {
            if (mode === "system") {
                const sys = e.matches ? "dark" : "light";
                setResolved(sys);
                apply(sys);
            }
        };
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener ? mq.addEventListener("change", listener) : mq.addListener(listener);
        return () => {
            mq.removeEventListener ? mq.removeEventListener("change", listener) : mq.removeListener(listener);
        };
    }, [mode, apply]);

    // apply whenever mode or resolved change
    useEffect(() => {
        const effective = mode === "system" ? getSystemTheme() : mode;
        setResolved(effective);
        apply(effective);
    }, [mode, apply]);

    const setTheme = useCallback(
        (newMode) => {
            localStorage.setItem(STORAGE_KEY, newMode);
            setMode(newMode);
        },
        []
    );

    return {
        mode, // "light" | "dark" | "system"
        resolved, // applied "light" or "dark"
        setTheme,
    };
}