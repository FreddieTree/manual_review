// src/hooks/useScrollRestoration.js
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * 在每个 pathname(+search) 维度保存并恢复滚动位置。
 * - 使用 history.scrollRestoration = 'manual' 避免浏览器默认行为冲突
 * - 在 pagehide 与路由切换时保存，iOS Safari 更可靠
 */
const STORAGE_KEY = "scroll-restoration-v1";

function readStorage() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}
function writeStorage(data) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { }
}

export default function useScrollRestoration() {
    const { pathname, search } = useLocation();
    const key = pathname + search;
    const positionsRef = useRef(readStorage());

    useEffect(() => {
        // 禁用浏览器原生滚动还原，避免与我们冲突
        const { scrollRestoration } = window.history;
        try {
            if ("scrollRestoration" in window.history) {
                window.history.scrollRestoration = "manual";
            }
        } catch { }

        // 恢复当前位置
        const y = positionsRef.current[key];
        if (typeof y === "number") {
            requestAnimationFrame(() => window.scrollTo(0, y));
        } else {
            window.scrollTo(0, 0);
        }

        const save = () => {
            positionsRef.current[key] = window.scrollY;
            writeStorage(positionsRef.current);
        };

        // iOS Safari: pagehide 比 beforeunload 更可靠
        window.addEventListener("pagehide", save);
        return () => {
            save();
            window.removeEventListener("pagehide", save);
            // 尝试还原系统设置
            try {
                if (scrollRestoration) {
                    window.history.scrollRestoration = scrollRestoration;
                }
            } catch { }
        };
    }, [key]);
}