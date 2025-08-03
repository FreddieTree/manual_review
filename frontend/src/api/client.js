// src/api/client.js
import axios from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
export const BASE_URL = RAW_BASE ? `${RAW_BASE}/api` : "/api";
const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";
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

client.interceptors.request.use((config) => {
  if ((config.method || "").toLowerCase() === "get") {
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
  }
  return config;
});

function handleAuthRequired(originalConfig) {
  if (!isBrowser) return;

  const here = window.location.pathname + window.location.search;
  const isLoginCall =
    /\/api\/login$/.test(((originalConfig?.baseURL || "") + (originalConfig?.url || ""))) ||
    /\/login$/.test(originalConfig?.url || "");
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
  // @ts-expect-error augment
  e.status = status;
  // @ts-expect-error augment
  e.response = err?.response;
  // @ts-expect-error augment
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

export function unwrapResponse(res, unwrap) {
  const body = res?.data;

  if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success")) {
    if (!body.success) {
      const e = new Error(body.message || "API error");
      // @ts-expect-error augment
      e.status = res.status;
      // @ts-expect-error augment
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

export async function call(fn, opts = {}) {
  const { retries = 1, unwrap = "data", _attempt = 0 } = opts;

  try {
    const res = await fn();
    return /** @type {any} */ (unwrapResponse(res, unwrap));
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

export const get = (url, config = {}, opts = {}) => call(() => client.get(url, config), opts);
export const post = (url, data, config = {}, opts = {}) => call(() => client.post(url, data, config), opts);
export const put = (url, data, config = {}, opts = {}) => call(() => client.put(url, data, config), opts);
export const del = (url, config = {}, opts = {}) => call(() => client.delete(url, config), opts);

export default client;

export { call as request };