import { get, post } from "./client";

// 登录：保留完整返回（包含 is_admin / success 等）
export const loginReviewer = (data, { signal } = {}) =>
    post("/login", data, { signal }, { unwrap: "full", retries: 0 });

export const logout = ({ signal } = {}) =>
    post("/logout", {}, { signal }, { unwrap: "full", retries: 0 });

// whoami：保留完整返回（{ success, email, is_admin, ... }）
export const whoami = ({ signal } = {}) =>
    get("/whoami", { signal }, { unwrap: "full" });