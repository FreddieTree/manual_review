import axios from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
// Ensure baseURL ends without duplicate slashes; we want requests like "admin/stats" to become "/api/admin/stats"
export const BASE_URL = RAW_BASE ? `${RAW_BASE.replace(/\/+$/, "")}/api` : "/api";
const LOGIN_PATH =
  (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";
const isBrowser = typeof window !== "undefined";

/** @type {import('axios').AxiosInstance} */
export const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Optional: log request URLs for debugging (can be gated behind env if too verbose)
client.interceptors.request.use((config) => {
  if ((config.method || "").toLowerCase() === "get") {
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[api client] request:", config.method, config.baseURL + "/" + (config.url || ""), {
      params: config.params,
      data: config.data,
    });
  }
  return config;
});

function handleAuthRequired(originalConfig) {
  if (!isBrowser) return;

  const here = window.location.pathname + window.location.search;
  const fullUrl = ((originalConfig?.baseURL || "") + (originalConfig?.url || ""));
  const isLoginCall =
    /\/api\/login$/.test(fullUrl) || /\/login$/.test(originalConfig?.url || "");
  if (isLoginCall) return;

  const evt = new CustomEvent("auth:required", { detail: { from: here } });
  window.dispatchEvent(evt);
  if (evt.defaultPrevented) return;

  const loginUrl = LOGIN_PATH || "/";
  const qs = `?next=${encodeURIComponent(here)}`;
  window.location.href = `${loginUrl}${qs}`;
}

function buildError(err, fallback = "Network error") {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data;
  let message = fallback;

  if (data && typeof data === "object") {
    message = data.message || data.error || data.detail || message;
  } else if (typeof data === "string" && data.trim()) {
    message = data;
  } else if (err?.message) {
    message = err.message;
  }

  const e = new Error(message);
  // augment for callers
  // @ts-expect-error
  e.status = status;
  // @ts-expect-error
  e.response = err?.response;
  // @ts-expect-error
  e.config = err?.config;
  return e;
}

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      handleAuthRequired(err?.config);
    }
    return Promise.reject(buildError(err));
  }
);

/**
 * Unwrap standard API envelope:
 * { success: boolean, data: ... } or raw object
 */
export function unwrapResponse(res, unwrap) {
  const body = res?.data;

  if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success")) {
    if (!body.success) {
      const e = new Error(body.message || "API error");
      // @ts-expect-error
      e.status = res.status;
      // @ts-expect-error
      e.payload = body;
      throw e;
    }
    if (unwrap === "full") return body;
    if (Object.prototype.hasOwnProperty.call(body, "data")) return body.data;
    return body;
  }

  if (unwrap === "full") return { success: true, data: body };
  return body;
}

/**
 * Generic call wrapper with retry/backoff.
 * opts: { retries, unwrap }
 */
export async function call(fn, opts = {}) {
  const { retries = 1, unwrap = "data", _attempt = 0 } = opts;

  try {
    const res = await fn();
    return unwrapResponse(res, unwrap);
  } catch (err) {
    const status = err?.status ?? err?.response?.status ?? null;
    if (retries > 0 && (status === 429 || (status >= 500 && status < 600))) {
      const attempt = _attempt + 1;
      const base = 200 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 120);
      await new Promise((r) => setTimeout(r, base + jitter));
      return call(fn, { ...opts, retries: retries - 1, _attempt: attempt });
    }
    throw err;
  }
}

export function makeCancel() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

// Exported helpers: callers MUST pass paths like "admin/stats" (no leading slash, no /api prefix)
export const get = (url, config = {}, opts = {}) => call(() => client.get(url, config), opts);
export const post = (url, data, config = {}, opts = {}) => call(() => client.post(url, data, config), opts);
export const put = (url, data, config = {}, opts = {}) => call(() => client.put(url, data, config), opts);
export const del = (url, config = {}, opts = {}) => call(() => client.delete(url, config), opts);

export default client;
export { call as request };