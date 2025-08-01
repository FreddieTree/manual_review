// src/hooks/useUser.js
import { useEffect, useState, useCallback } from "react";
import { getCurrentUser, logout as apiLogout } from "../api";

/**
 * Hook to fetch and cache current logged-in user.
 * Returns { user, loading, error, refresh, logout }
 */
export default function useUser() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const u = await getCurrentUser();
            setUser(u);
        } catch (e) {
            setError(e);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const logout = async () => {
        try {
            await apiLogout();
        } catch (_) {
            // ignore
        }
        // force clear
        setUser(null);
        window.location.href = "/";
    };

    return { user, loading, error, refresh, logout };
}