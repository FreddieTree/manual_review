// src/api.js
import axios from "axios";

/**
 * API client:
 *  - baseURL from VITE_API_BASE or relative '/api'
 *  - withCredentials for Flask session cookie
 *  - response unwrap for both styles:
 *      A) { success, data, message }
 *      B) { success, ...top-level fields }  // e.g. login: is_admin, no_more_tasks
 *  - smart redirect on 401/403 (skip /login itself)
 *  - retry (429 / 5xx) with exponential backoff + jitter
 *  - supports AbortController (pass { signal } in opts)
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const BASE_URL = RAW_BASE ? `${RAW_BASE}/api` : "/api";

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Optional: small cache-busting for GETs in dev
client.interceptors.request.use((config) => {
  if (config.method === "get") {
    config.headers["Cache-Control"] = "no-cache";
    config.headers["Pragma"] = "no-cache";
  }
  return config;
});

// Redirect helper (skip when already on login or calling /login)
function maybeRedirectToLogin(originalConfig) {
  const here = window.location.pathname + window.location.search;
  const isLoginCall =
    /\/api\/login$/.test((originalConfig?.baseURL || "") + (originalConfig?.url || "")) ||
    /\/login$/.test(originalConfig?.url || "");

  if (!isLoginCall && window.location.pathname !== "/") {
    window.location.href = `/?next=${encodeURIComponent(here)}`;
  }
}

// Normalize axios errors
function buildError(err, fallback = "Network error") {
  const status = err?.response?.status;
  const data = err?.response?.data;
  let message = fallback;

  if (data && typeof data === "object") {
    message = data.message || message;
  } else if (typeof data === "string" && data.trim()) {
    message = data;
  } else if (err?.message) {
    message = err.message;
  }

  const out = new Error(message);
  out.status = status;
  out.response = err?.response;
  return out;
}

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      // 对非 /login 请求做登录跳转
      maybeRedirectToLogin(err?.config);
    }
    return Promise.reject(buildError(err));
  }
);

/**
 * 解包响应
 * @param {AxiosResponse} res
 * @param {'data'|'full'} unwrap
 *   - 'data': 成功时优先返回 payload.data；没有 data 时返回整个 payload/body（兼容）
 *   - 'full': 成功时返回整个 payload（用于 /login 这种顶层字段）
 */
function unwrapResponse(res, unwrap) {
  const body = res?.data;

  // 标准包裹：{ success, ... }
  if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success")) {
    if (!body.success) {
      const e = new Error(body.message || "API error");
      e.status = res.status;
      e.payload = body;
      throw e;
    }
    if (unwrap === "full") return body;
    // unwrap === 'data'
    if (Object.prototype.hasOwnProperty.call(body, "data")) return body.data;
    // 后端没有 data 字段时，直接返回整个 body（兼容型）
    return body;
  }

  // 非标准包裹：直接返回 data（包装一层意义不大）
  if (unwrap === "full") return { success: true, data: body };
  return body;
}

/**
 * 通用调用包装
 * @param {() => Promise<import('axios').AxiosResponse>} fn
 * @param {{ retries?: number, unwrap?: 'data'|'full', signal?: AbortSignal }} opts
 */
async function call(fn, opts = {}) {
  const { retries = 1, unwrap = "data", signal } = opts;

  // axios 支持 signal；为避免用户忘记，我们在 fn 内部透传
  try {
    const res = await fn(signal);
    return unwrapResponse(res, unwrap);
  } catch (err) {
    const status = err?.status || err?.response?.status;

    if (retries > 0 && (status === 429 || (status >= 500 && status < 600))) {
      // 指数退避 + 随机抖动
      const attempt = (opts._attempt || 0) + 1;
      const base = 200 * Math.pow(2, attempt - 1); // 200, 400, 800...
      const jitter = Math.floor(Math.random() * 120);
      await new Promise((r) => setTimeout(r, base + jitter));
      return call(fn, { ...opts, retries: retries - 1, _attempt: attempt });
    }
    throw err;
  }
}

/* -------------------- Exported helpers -------------------- */

// 登录：需要完整返回（含 is_admin / no_more_tasks / success）
export const loginReviewer = (data, opts) =>
  call(
    (signal) => client.post("/login", data, { signal }),
    { ...opts, unwrap: "full", retries: 0 } // 登录不做重试，避免多次提交
  );

// whoami：有需要就用（通常在 useUser 里）
export const whoAmI = (opts) =>
  call((signal) => client.get("/whoami", { signal }), { ...opts, unwrap: "full" });

// Reviewer 工作流
export const getAssignedAbstract = (opts) =>
  call((signal) => client.get("/assigned_abstract", { signal }), { ...opts, unwrap: "data" });

export const submitReview = (data, opts) =>
  call((signal) => client.post("/submit_review", data, { signal }), { ...opts, unwrap: "data" });

export const logout = (opts) =>
  call((signal) => client.post("/logout", {}, { signal }), { ...opts, unwrap: "full", retries: 0 });

// Admin
export const getAdminStats = (opts) =>
  call((signal) => client.get("/admin_stats", { signal }), { ...opts, unwrap: "data" });

// Reviewers CRUD（管理员）
export const getReviewers = (opts) =>
  call((signal) => client.get("/reviewers", { signal }), { ...opts, unwrap: "data" });

export const addReviewer = (data, opts) =>
  call((signal) => client.post("/reviewers", data, { signal }), { ...opts, unwrap: "data" });

export const updateReviewer = (email, data, opts) =>
  call((signal) => client.put(`/reviewers/${encodeURIComponent(email)}`, data, { signal }), {
    ...opts,
    unwrap: "data",
  });

export const deleteReviewer = (email, opts) =>
  call((signal) => client.delete(`/reviewers/${encodeURIComponent(email)}`, { signal }), {
    ...opts,
    unwrap: "data",
  });

// Arbitration / Export
export const getArbitrationQueue = (opts) =>
  call((signal) => client.get("/arbitration_queue", { signal }), { ...opts, unwrap: "data" });

export const arbitrate = (data, opts) =>
  call((signal) => client.post("/arbitrate", data, { signal }), { ...opts, unwrap: "data" });

export const exportConsensus = (opts) =>
  call((signal) => client.get("/export_consensus", { signal }), { ...opts, unwrap: "data" });

// Assertions / Pricing（若后端这些路由存在）
export const createAssertion = ({ pmid, sentence_index, assertion }, opts) =>
  call(
    (signal) => client.post("/review/assertion/create", { pmid, sentence_index, ...assertion }, { signal }),
    { ...opts, unwrap: "data" }
  );

export const updateAssertion = ({ pmid, sentence_index, assertion_id, ...fields }, opts) =>
  call(
    (signal) => client.post("/review/assertion/update", { pmid, sentence_index, assertion_id, ...fields }, { signal }),
    { ...opts, unwrap: "data" }
  );

export const deleteAssertion = ({ pmid, sentence_index, assertion_id }, opts) =>
  call(
    (signal) => client.post("/review/assertion/delete", { pmid, sentence_index, assertion_id }, { signal }),
    { ...opts, unwrap: "data" }
  );

export const getPricing = (abstractId, opts) => {
  const params = abstractId ? `?abstract=${encodeURIComponent(abstractId)}` : "";
  return call((signal) => client.get(`/review/pricing${params}`, { signal }), { ...opts, unwrap: "data" });
};

export default client;