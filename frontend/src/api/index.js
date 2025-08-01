// src/api/index.js
import axios from "axios";

/**
 * Normalize base URL: prefer env override, strip trailing slash.
 * Falls back to localhost for development.
 */
const RAW_BASE = import.meta.env.VITE_API_BASE || "";
const BASE_URL = (RAW_BASE || "http://localhost:5050/api").replace(/\/+$/, "");

const DEFAULT_TIMEOUT = 12000; // ms

// Simple in-memory request dedupe cache: key -> timestamp of last start
const _inflight = new Map();

/**
 * Build a dedupe key for a request (method + url + sorted params + body)
 */
function _makeKey(config) {
    const { method, url, params, data } = config;
    let key = `${method?.toUpperCase() || "GET"}::${url}`;
    if (params) {
        try {
            key += "::P:" + JSON.stringify(_sortedCopy(params));
        } catch { }
    }
    if (data) {
        try {
            key += "::B:" + JSON.stringify(_sortedCopy(typeof data === "string" ? JSON.parse(data) : data));
        } catch { }
    }
    return key;
}

function _sortedCopy(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(_sortedCopy);
    return Object.keys(obj)
        .sort()
        .reduce((acc, k) => {
            acc[k] = _sortedCopy(obj[k]);
            return acc;
        }, {});
}

/**
 * Create global axios instance
 */
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    timeout: DEFAULT_TIMEOUT,
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
    },
});

// Response interceptor: normalize errors
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (axios.isCancel(error)) {
            return Promise.reject({ message: "Request cancelled", code: "CANCELLED", isCancelled: true });
        }
        const status = error.response?.status || null;
        // Auto redirect on auth failure
        if (status === 401 || status === 403) {
            // Optionally: centralized logout / router push
            window.location.href = "/";
        }
        const payload = error.response?.data;
        const message =
            (payload && (payload.message || payload.error || payload.detail)) ||
            error.message ||
            "Network error";
        const code = (payload && payload.code) || `HTTP_${status || "UNKNOWN"}`;
        return Promise.reject({
            message,
            status,
            code,
            raw: error,
        });
    }
);

/**
 * Exponential backoff retry wrapper for idempotent methods.
 * Retries only on network errors or 5xx.
 */
async function _requestWithRetry(config, { retries = 2, backoffFactor = 2, minDelay = 300 } = {}) {
    const method = (config.method || "get").toLowerCase();
    const isIdempotent = ["get", "head", "options"].includes(method);
    let attempt = 0;
    let delay = minDelay;

    while (true) {
        attempt += 1;
        try {
            // Dedupe: if same request launched within short window, reuse promise
            const key = _makeKey(config);
            if (_inflight.has(key)) {
                return await _inflight.get(key);
            }
            const promise = api.request(config).then((r) => r.data);
            if (isIdempotent) {
                _inflight.set(key, promise);
            }
            const result = await promise;
            if (isIdempotent) {
                _inflight.delete(key);
            }
            return result;
        } catch (err) {
            const shouldRetry =
                isIdempotent &&
                attempt <= retries &&
                (err.status === null || (err.status >= 500 && err.status < 600));
            if (!shouldRetry) {
                throw err;
            }
            // backoff
            await new Promise((res) => setTimeout(res, delay));
            delay *= backoffFactor;
        }
    }
}

/**
 * Helper to create a cancel token for a request.
 * Usage:
 * const { token, cancel } = makeCancel();
 * api.get("/foo", { cancelToken: token });
 * cancel(); // abort
 */
export function makeCancel() {
    const controller = new AbortController();
    return {
        signal: controller.signal,
        cancel: () => controller.abort(),
    };
}

/**
 * Wrapper for API calls - returns { data } or throws normalized error object.
 * @param {Object} config - axios request config
 * @param {Object} opts - retry options: { retries, backoffFactor, minDelay }
 */
export async function request(config, opts = {}) {
    return _requestWithRetry(config, opts);
}

// ==== Specific endpoints ==== //

/**
 * Login reviewer/admin.
 * @param {{name: string, email: string}} payload
 */
export async function loginReviewer(payload) {
    return request({ method: "POST", url: "/login", data: payload });
}

/**
 * Get assigned abstract for current reviewer.
 */
export async function getAssignedAbstract() {
    return request({ method: "GET", url: "/assigned_abstract" });
}

/**
 * Submit review payload.
 * @param {Object} data
 */
export async function submitReview(data) {
    return request({ method: "POST", url: "/submit_review", data });
}

/**
 * Logout current user.
 */
export async function logout() {
    return request({ method: "POST", url: "/logout" });
}

/**
 * Fetch admin stats.
 */
export async function getAdminStats() {
    return request({ method: "GET", url: "/admin_stats" });
}

/**
 * Fetch reviewers list with optional query params.
 * @param {Object} params
 */
export async function getReviewers(params = {}) {
    return request({ method: "GET", url: "/reviewers", params });
}

/**
 * Add a reviewer.
 * @param {Object} reviewer - { email, name, active?, role?, note? }
 */
export async function addReviewer(reviewer) {
    return request({ method: "POST", url: "/reviewers", data: reviewer });
}

/**
 * Update reviewer by email.
 * @param {string} email
 * @param {Object} updates
 */
export async function updateReviewer(email, updates) {
    return request({
        method: "PUT",
        url: `/reviewers/${encodeURIComponent(email)}`,
        data: updates,
    });
}

/**
 * Delete reviewer.
 * @param {string} email
 */
export async function deleteReviewer(email) {
    return request({
        method: "DELETE",
        url: `/reviewers/${encodeURIComponent(email)}`,
    });
}

/**
 * Get arbitration queue.
 */
export async function getArbitrationQueue() {
    return request({ method: "GET", url: "/arbitration_queue" });
}

/**
 * Submit arbitration decision.
 * @param {Object} data
 */
export async function arbitrate(data) {
    return request({ method: "POST", url: "/arbitrate", data });
}

/**
 * Export consensus.
 */
export async function exportConsensus() {
    return request({ method: "GET", url: "/export_consensus" });
}

/**
 * Get pricing for an abstract.
 * @param {string} abstractId
 */
export async function getPricing(abstractId) {
    const params = abstractId ? { abstract: abstractId } : {};
    return request({ method: "GET", url: "/review/pricing", params });
}

// Convenience default export
export default {
    loginReviewer,
    getAssignedAbstract,
    submitReview,
    logout,
    getAdminStats,
    getReviewers,
    addReviewer,
    updateReviewer,
    deleteReviewer,
    getArbitrationQueue,
    arbitrate,
    exportConsensus,
    getPricing,
    request,
    makeCancel,
};