// src/api/auth.js
import { get, post } from "./client";

export const loginReviewer = (data, { signal } = {}) =>
    post("/login", data, { signal }, { unwrap: "full", retries: 0 });

export const logout = ({ signal } = {}) =>
    post("/logout", {}, { signal }, { unwrap: "full", retries: 0 });

export const whoami = ({ signal } = {}) =>
    get("/whoami", { signal }, { unwrap: "full" });