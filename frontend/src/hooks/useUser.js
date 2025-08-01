// src/hooks/useUser.js
import { useState, useEffect, useCallback } from "react";
import api, { logout as logoutApi } from "../api";

const USER_CACHE_KEY = "current_user_info";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

function getCached() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL_MS) {
            localStorage.removeItem(USER_CACHE_KEY);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

function setCached(data) {
    try {
        localStorage.setItem(
            USER_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data })
        );
    } catch { }
}

export function useUser() {
    const [user, setUser] = useState(() => getCached());
    const [loading, setLoading] = useState(!user);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/whoami"); // 需要后端提供当前 session 用户信息接口
            setUser(res.data || res); // flexibility
            setCached(res.data || res);
        } catch (e) {
            setError(e);
            setUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            refresh();
        }
    }, [user, refresh]);

    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch {
            // ignore
        }
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
        window.location.href = "/";
    }, []);

    return {
        user,
        loading,
        error,
        refresh,
        logout,
    };
}