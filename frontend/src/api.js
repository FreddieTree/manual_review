// src/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:5050/api";
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 12000,
});

// 拦截处理
api.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      window.location.href = "/";
      return Promise.reject("Unauthorized or session expired.");
    }
    let msg = err?.response?.data?.message || err?.message || "Network error";
    if (typeof msg !== "string") msg = JSON.stringify(msg);
    return Promise.reject(msg);
  }
);

// 通用
const call = req => req.then(r => r.data).catch(e => { throw e; });

// ------- API -------
export const loginReviewer = data => call(api.post("/login", data));
export const getAssignedAbstract = () => call(api.get("/assigned_abstract"));
export const submitReview = data => call(api.post("/submit_review", data));
export const logout = () => call(api.post("/logout"));

export const getAdminStats = () => call(api.get("/admin_stats"));
export const getReviewers = () => call(api.get("/reviewers"));
export const addReviewer = data => call(api.post("/reviewers", data));
export const updateReviewer = (email, data) => call(api.put(`/reviewers/${encodeURIComponent(email)}`, data));
export const deleteReviewer = email => call(api.delete(`/reviewers/${encodeURIComponent(email)}`));
export const getArbitrationQueue = () => call(api.get("/arbitration_queue"));
export const arbitrate = data => call(api.post("/arbitrate", data));
export const exportConsensus = () => call(api.get("/export_consensus"));

export const createAssertion = ({ pmid, sentence_index, assertion }) =>
  call(api.post("/review/assertion/create", { pmid, sentence_index, ...assertion }));
export const updateAssertion = ({ pmid, sentence_index, assertion_id, ...fields }) =>
  call(api.post("/review/assertion/update", { pmid, sentence_index, assertion_id, ...fields }));
export const deleteAssertion = ({ pmid, sentence_index, assertion_id }) =>
  call(api.post("/review/assertion/delete", { pmid, sentence_index, assertion_id }));
export const getPricing = () => call(api.get("/review/pricing"));

export default api;