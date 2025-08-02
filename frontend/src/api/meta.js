import { get } from "./client";

// 后端已稳定：/api/meta/vocab, /api/meta/health
export const getVocab = ({ signal } = {}) =>
    get("/meta/vocab", { signal }, { unwrap: "data" });

export const getHealth = ({ signal } = {}) =>
    get("/meta/health", { signal }, { unwrap: "data" });