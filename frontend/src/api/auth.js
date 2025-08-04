// src/api/auth.js
import { get, post } from "./client";

/**
 * 登录 Reviewer（返回完整 envelope）
 */
export const loginReviewer = (data, { signal } = {}) =>
    post("login", data, { signal }, { unwrap: "full", retries: 0 });

/**
 * 登出
 */
export const logout = ({ signal } = {}) =>
    post("logout", {}, { signal }, { unwrap: "full", retries: 0 });

/**
 * 当前用户（normalize user envelope）
 */
export const whoami = async ({ signal } = {}) => {
    const body = await get("whoami", { signal }, { unwrap: "full" });

    if (body && typeof body === "object") {
        if (body.user && typeof body.user === "object") return body.user;
        if (body.data && typeof body.data === "object") return body.data;
    }
    return body;
};