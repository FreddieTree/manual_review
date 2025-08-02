// src/hooks/useUser.js
import { useState, useEffect, useCallback } from "react";
import { request, logout as logoutApi } from "../api";

// —— 简易全局缓存/订阅 —— //
let globalUser = null;
let globalError = null;
let globalLoading = false;
let listeners = [];

const STORAGE_KEY = "manual_review_current_user";
const TTL_MS = 5 * 60 * 1000; // 5 分钟

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const { ts, user } = JSON.parse(raw);
        if (Date.now() - ts > TTL_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return user;
    } catch {
        return null;
    }
}
function saveToStorage(user) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), user }));
    } catch { }
}
function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { }
}
function broadcast() {
    const payload = { user: globalUser, loading: globalLoading, error: globalError };
    listeners.forEach((cb) => cb(payload));
}

// 提供一个独立的取数函数，避免并发重复
async function fetchUser() {
    if (globalLoading) return;
    globalLoading = true;
    globalError = null;
    broadcast();
    try {
        const body = await request({ method: "GET", url: "/whoami" });
        const userInfo = body?.data ?? body; // 兼容 {success,data} 与直返体
        globalUser = userInfo;
        saveToStorage(userInfo);
    } catch (e) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 403) {
            globalUser = null;
            clearStorage();
            // 让上层路由/组件根据 user=null 决定是否跳转；
            // 若希望立即跳转，可在这里 location.href="/"
        } else {
            globalError = e;
            globalUser = null;
            clearStorage();
        }
    } finally {
        globalLoading = false;
        broadcast();
    }
}

/**
 * useUser
 * - 共享用户信息（带本地缓存 TTL）
 * - 提供 refresh / logout
 */
export function useUser() {
    const [state, setState] = useState(() => ({
        user: globalUser ?? loadFromStorage(),
        loading: globalLoading || globalUser == null,
        error: globalError,
    }));

    useEffect(() => {
        const updater = (payload) => setState(payload);
        listeners.push(updater);

        // 首次进入时触发一次加载（若还没有全局用户）
        if (globalUser == null && !globalLoading) {
            fetchUser();
        } else {
            broadcast();
        }

        // 监听全局 “需要登录” 事件（由 API 客户端在 401/403 时派发，可选）
        const onAuthRequired = () => {
            // 置空用户 & 同步状态
            globalUser = null;
            globalError = null;
            globalLoading = false;
            clearStorage();
            broadcast();
        };
        window.addEventListener?.("auth:required", onAuthRequired);

        return () => {
            listeners = listeners.filter((l) => l !== updater);
            window.removeEventListener?.("auth:required", onAuthRequired);
        };
    }, []);

    const refresh = useCallback(() => fetchUser(), []);
    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch {
            // 后端不可达时也直接清理前端态
        }
        globalUser = null;
        globalError = null;
        globalLoading = false;
        clearStorage();
        broadcast();
        // 默认回到登录页
        window.location.href = "/";
    }, []);

    return {
        user: state.user,
        loading: state.loading,
        error: state.error,
        refresh,
        logout,
    };
}