// src/api/tasks.js
import { get, post } from "./client";

export const getAssignedAbstract = ({ signal } = {}) =>
    get("/assigned_abstract", { signal }, { unwrap: "data" });

export const submitReview = (data, { signal } = {}) =>
    post("/submit_review", data, { signal }, { unwrap: "data" });

export const releaseAssignment = (pmid, { signal } = {}) =>
    post("/release_assignment", { pmid }, { signal }, { unwrap: "full" });