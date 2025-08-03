// src/api/reviewers.js
import { get, post, put, del } from "./client";

export const getReviewers = ({ signal, query } = {}) =>
    get("/reviewers", { signal, params: query }, { unwrap: "data" });

export const addReviewer = (data, { signal } = {}) =>
    post("/reviewers", data, { signal }, { unwrap: "data" });

export const updateReviewer = (email, data, { signal } = {}) =>
    put(`/reviewers/${encodeURIComponent(email)}`, data, { signal }, { unwrap: "data" });

export const deleteReviewer = (email, { signal } = {}) =>
    del(`/reviewers/${encodeURIComponent(email)}`, { signal }, { unwrap: "data" });