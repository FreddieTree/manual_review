import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Persists scroll position per pathname in sessionStorage and restores on navigation.
 * Useful for preserving scroll when user navigates back/forward.
 */
const STORAGE_KEY = "scroll-restoration-v1";

function readStorage() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function writeStorage(data) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // ignore quota errors
    }
}

export default function useScrollRestoration() {
    const location = useLocation();
    const pathname = location.pathname + location.search;
    const positionsRef = useRef(readStorage());

    // on unmount or path change, persist current scroll
    useEffect(() => {
        const handleBeforeUnload = () => {
            positionsRef.current[pathname] = window.scrollY;
            writeStorage(positionsRef.current);
        };

        // restore scroll on mount
        const stored = positionsRef.current[pathname];
        if (typeof stored === "number") {
            // slight delay to allow layout to settle
            requestAnimationFrame(() => {
                window.scrollTo(0, stored);
            });
        } else {
            // default to top
            window.scrollTo(0, 0);
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            // save on cleanup
            positionsRef.current[pathname] = window.scrollY;
            writeStorage(positionsRef.current);
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [pathname]);
}