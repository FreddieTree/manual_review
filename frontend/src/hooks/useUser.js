// src/hooks/useUser.js
import { useState, useEffect, useCallback } from "react";
import api, { logout as logoutApi } from "../api";

// 简易全局订阅，用于多个 hook/组件共享用户状态
let globalUser = null;
let globalError = null;
let globalLoading = false;
let listeners = [];

// TTL + cache key
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

function broadcast() {
    listeners.forEach((cb) =>
        cb({ user: globalUser, loading: globalLoading, error: globalError })
    );
}

async function fetchUser() {
    if (globalLoading) return; // already in flight
    globalLoading = true;
    globalError = null;
    broadcast();
    try {
        const res = await api.get("/whoami");
        const userInfo = res?.data ?? res;
        globalUser = userInfo;
        saveToStorage(userInfo);
    } catch (e) {
        // if 401, force redirect (session expired)
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
            globalUser = null;
            localStorage.removeItem(STORAGE_KEY);
            window.location.href = "/";
        } else {
            globalError = e;
            globalUser = null;
            localStorage.removeItem(STORAGE_KEY);
        }
    } finally {
        globalLoading = false;
        broadcast();
    }
}

/**
 * useUser hook exposes shared user/session info, caching, refresh, logout.
 */
export function useUser() {
    const [state, setState] = useState({
        user: globalUser ?? loadFromStorage(),
        loading: globalLoading || globalUser == null,
        error: globalError,
    });

    // subscribe to global updates
    useEffect(() => {
        const updater = (payload) => setState(payload);
        listeners.push(updater);
        // initial trigger if nothing in flight
        if (globalUser == null && !globalLoading) {
            fetchUser();
        } else {
            broadcast();
        }
        return () => {
            listeners = listeners.filter((l) => l !== updater);
        };
    }, []);

    const refresh = useCallback(() => {
        return fetchUser();
    }, []);

    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch {
            // ignore
        }
        globalUser = null;
        globalError = null;
        globalLoading = false;
        localStorage.removeItem(STORAGE_KEY);
        broadcast();
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