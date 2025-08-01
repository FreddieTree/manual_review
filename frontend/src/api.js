import axios from "axios";

/**
 * API client with:
 *  - flexible baseURL (env or relative for proxy)
 *  - session cookie support
 *  - unified envelope unwrapping ({success,data,message})
 *  - auth expiration redirect
 *  - retry for transient failures (429, 5xx)
 *  - optional cancellation support
 */

// Build baseURL: prefer VITE_API_BASE, fallback to relative so proxy works
const RAW_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";
const BASE_URL = RAW_BASE ? `${RAW_BASE}/api` : "/api";

// Axios instance
const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 12000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Response interceptor: normalize errors and handle auth expiry
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      // Unauthorized or expired session: redirect to login
      window.location.href = "/";
      return Promise.reject(new Error("Unauthorized or session expired."));
    }

    let msg = "Network error";
    if (err?.response) {
      const data = err.response.data;
      if (data && typeof data === "object") {
        msg = data.message || JSON.stringify(data);
      } else if (typeof data === "string" && data.trim()) {
        msg = data;
      } else if (err.message) {
        msg = err.message;
      }
    } else if (err.message) {
      msg = err.message;
    }

    const error = new Error(msg);
    error.status = status;
    error.response = err.response;
    return Promise.reject(error);
  }
);

/**
 * Core call wrapper.
 * Unwraps { success, data, message } envelope.
 * Retries transient failures once by default.
 * @param {() => Promise<import('axios').AxiosResponse>} fn
 * @param {number} retries
 */
async function call(fn, retries = 1) {
  try {
    const res = await fn();
    // Backend may wrap in { success, data, message }
    const payload = res.data && typeof res.data === "object" && "success" in res.data
      ? res.data
      : { success: true, data: res.data };

    if (!payload.success) {
      const err = new Error(payload.message || "API error");
      err.payload = payload;
      err.status = res.status;
      throw err;
    }
    return payload.data ?? {};
  } catch (e) {
    const status = e.status || (e.response && e.response.status);
    if (retries > 0 && (status === 429 || (status >= 500 && status < 600))) {
      // exponential backoff
      const backoff = 150 * Math.pow(2, 1);
      await new Promise((r) => setTimeout(r, backoff));
      return call(fn, retries - 1);
    }
    throw e;
  }
}

// ----- Exported API helpers -----
export const loginReviewer = (data) => call(() => client.post("/login", data));
export const getAssignedAbstract = () => call(() => client.get("/assigned_abstract"));
export const submitReview = (data) => call(() => client.post("/submit_review", data));
export const logout = () => call(() => client.post("/logout"));

export const getAdminStats = () => call(() => client.get("/admin_stats"));

export const getReviewers = () => call(() => client.get("/reviewers"));
export const addReviewer = (data) => call(() => client.post("/reviewers", data));
export const updateReviewer = (email, data) => call(() => client.put(`/reviewers/${encodeURIComponent(email)}`, data));
export const deleteReviewer = (email) => call(() => client.delete(`/reviewers/${encodeURIComponent(email)}`));

export const getArbitrationQueue = () => call(() => client.get("/arbitration_queue"));
export const arbitrate = (data) => call(() => client.post("/arbitrate", data));
export const exportConsensus = () => call(() => client.get("/export_consensus"));

export const createAssertion = ({ pmid, sentence_index, assertion }) =>
  call(() => client.post("/review/assertion/create", { pmid, sentence_index, ...assertion }));
export const updateAssertion = ({ pmid, sentence_index, assertion_id, ...fields }) =>
  call(() => client.post("/review/assertion/update", { pmid, sentence_index, assertion_id, ...fields }));
export const deleteAssertion = ({ pmid, sentence_index, assertion_id }) =>
  call(() => client.post("/review/assertion/delete", { pmid, sentence_index, assertion_id }));

export const getPricing = (abstractId) => {
  const params = abstractId ? `?abstract=${encodeURIComponent(abstractId)}` : "";
  return call(() => client.get(`/review/pricing${params}`));
};

export default client;