import { get, post } from "./client";

export const getAssignedAbstract = ({ signal } = {}) =>
    get("/assigned_abstract", { signal }, { unwrap: "data" });

export const submitReview = (data, { signal } = {}) =>
    post("/submit_review", data, { signal }, { unwrap: "data" });

// 如果后端存在该路由（你的后端当前未显式暴露），保留可选：
export const releaseAssignment = (pmid, { signal } = {}) =>
    post("/release_assignment", { pmid }, { signal }, { unwrap: "full" });