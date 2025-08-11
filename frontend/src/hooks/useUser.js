// src/hooks/useUser.js
import { useState, useEffect, useCallback, useRef } from "react";
import { whoami as whoamiApi, logout as logoutApi } from "../api/auth";

let globalUser = null;
let globalError = null;
let globalLoading = false;
let listeners = [];

const STORAGE_KEY = "manual_review_current_user";
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";

function isAtLoginPath() {
    try {
        const here = window.location?.pathname?.replace(/\/+$/, "") || "/";
        return here === LOGIN_PATH.replace(/\/+$/, "");
    } catch {
        return false;
    }
}

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
    listeners.forEach((cb) => {
        try {
            cb(payload);
        } catch { }
    });
}

let inFlight = null;

async function fetchUser(force = false) {
    if (globalLoading && inFlight && !force) return inFlight;
    globalLoading = true;
    globalError = null;
    broadcast();

    const attempt = async (retry = 0) => {
        try {
            const userObj = await whoamiApi();
            // Normalize fields: some backends might use full_name etc.
            const normalized = normalizeUser(userObj);
            globalUser = normalized;
            globalError = null;
            saveToStorage(normalized);
            return normalized;
        } catch (e) {
            const status = e?.status ?? e?.response?.status;
            if (status === 401 || status === 403) {
                // Not authenticated: clear and stop
                globalUser = null;
                globalError = null;
                clearStorage();
                return null;
            }
            if (retry < 1) {
                // one retry with small backoff
                await new Promise((r) => setTimeout(r, 150 * Math.pow(2, retry)));
                return attempt(retry + 1);
            }
            globalUser = null;
            globalError = e;
            clearStorage();
            return null;
        }
    };

    inFlight = attempt();
    try {
        return await inFlight;
    } finally {
        globalLoading = false;
        inFlight = null;
        broadcast();
    }
}

function normalizeUser(raw) {
    if (!raw || typeof raw !== "object") return null;
    // Possible variants: { name, full_name, email, is_admin } or nested
    const name =
        (raw.name && String(raw.name).trim()) ||
        (raw.full_name && String(raw.full_name).trim()) ||
        (raw.display_name && String(raw.display_name).trim()) ||
        "";
    const email = raw.email ? String(raw.email).toLowerCase() : "";
    const is_admin = Boolean(raw.is_admin || raw.isAdmin || raw.admin);
    return {
        ...raw,
        name,
        email,
        is_admin,
    };
}

export function useUser() {
    const [state, setState] = useState(() => {
        const cached = globalUser ?? loadFromStorage();
        // On login route, do not show loading spinner and do not auto-fetch whoami
        const onLogin = isAtLoginPath();
        const loading = onLogin ? false : (globalLoading || (cached == null && !globalLoading));
        return { user: cached, loading, error: globalError };
    });

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const updater = (payload) => {
            if (!mountedRef.current) return;
            setState(payload);
        };
        listeners.push(updater);

        if (globalUser == null && !globalLoading && !isAtLoginPath()) {
            fetchUser();
        } else {
            broadcast();
        }

        const onAuthRequired = () => {
            globalUser = null;
            globalError = null;
            globalLoading = false;
            clearStorage();
            broadcast();
        };
        window.addEventListener?.("auth:required", onAuthRequired);

        return () => {
            mountedRef.current = false;
            listeners = listeners.filter((l) => l !== updater);
            window.removeEventListener?.("auth:required", onAuthRequired);
        };
    }, []);

    const refresh = useCallback(() => fetchUser(true), []);
    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch {
            // ignore
        }
        globalUser = null;
        globalError = null;
        globalLoading = false;
        clearStorage();
        broadcast();
        const loginPath = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";
        // Use replace to avoid back navigation into a protected page
        window.location.replace(loginPath);
    }, []);

    return {
        user: state.user,
        loading: state.loading,
        error: state.error,
        refresh,
        logout,
    };
}