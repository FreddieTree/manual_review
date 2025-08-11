// src/api/tasks.js
import { get, post } from "./client";

export const getAssignedAbstract = ({ signal } = {}) =>
    get("assigned_abstract", { signal }, { unwrap: "data" });

export const submitReview = (data, { signal } = {}) =>
    post("submit_review", data, { signal }, { unwrap: "data" });

export const releaseAssignment = ({ signal } = {}) =>
    post("abandon", {}, { signal }, { unwrap: "full" });

export const heartbeat = ({ signal } = {}) =>
    post("heartbeat", {}, { signal }, { unwrap: "data" });

export const getAbstractOverview = (pmid, { signal } = {}) =>
    get(`abstract_overview/${encodeURIComponent(pmid)}`, { signal }, { unwrap: "data" });