// src/api/client.js
import axios from "axios";

/**
 * API client 约定：
 * - baseURL: 若设置 VITE_API_BASE -> `${VITE_API_BASE}/api`；否则使用相对 '/api'
 * - withCredentials: true，保证 Flask session-cookie 工作
 * - 401/403：先派发 'auth:required' 事件（可 preventDefault 接管），无人接管则兜底跳转
 * - unwrap：兼容 {success,data} 与非标准直接 data 的两类后端返回
 * - 支持 AbortController / 429&5xx 指数退避重试
 * - GET 自动禁用缓存
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
export const BASE_URL = RAW_BASE ? `${RAW_BASE}/api` : "/api";

// 登录页路径（可通过 .env 覆盖），兜底 "/"
const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";

// SSR / 非浏览器安全检测
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
    // 避免浏览器缓存 GET
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
  }
  return config;
});

/**
 * 401/403 处理：
 *  - 先派发 `auth:required`，监听方可 e.preventDefault() 接管（比如弹层登录）
 *  - 无人接管时兜底跳转到 LOGIN_PATH，并在查询串上追加 next=当前页面
 */
function handleAuthRequired(originalConfig) {
  if (!isBrowser) return;

  const here = window.location.pathname + window.location.search;
  const isLoginCall =
    /\/api\/login$/.test(((originalConfig?.baseURL || "") + (originalConfig?.url || ""))) ||
    /\/login$/.test(originalConfig?.url || "");

  // 仅对非登录请求触发
  if (isLoginCall) return;

  const evt = new CustomEvent("auth:required", { detail: { from: here } });
  window.dispatchEvent(evt);
  if (evt.defaultPrevented) return;

  const loginUrl = LOGIN_PATH || "/";
  const qs = `?next=${encodeURIComponent(here)}`;
  window.location.href = `${loginUrl}${qs}`;
}

/** 将 axios 错误对象规范化为 Error 并附带 status/response/config */
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
  e.status = status;
  e.response = err?.response;
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
 * 解包响应体（兼容两种风格）
 * @template T
 * @param {import('axios').AxiosResponse<any>} res
 * @param {'data'|'full'} unwrap
 * @returns {T}
 */
export function unwrapResponse(res, unwrap) {
  const body = res?.data;

  // 标准：{ success, ... }
  if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success")) {
    if (!body.success) {
      const e = new Error(body.message || "API error");
      e.status = res.status;
      e.payload = body;
      throw e;
    }
    if (unwrap === "full") return body;
    if (Object.prototype.hasOwnProperty.call(body, "data")) return body.data;
    return body;
  }

  // 非标准：直接返回 data
  if (unwrap === "full") return { success: true, data: body };
  return body;
}

/**
 * 通用请求包装：支持 429/5xx 指数退避重试
 * @template T
 * @param {() => Promise<import('axios').AxiosResponse<any>>} fn - 一个返回 axios Promise 的函数
 * @param {{ retries?: number, unwrap?: 'data'|'full', _attempt?: number }} opts
 * @returns {Promise<T>}
 */
export async function call(fn, opts = {}) {
  const { retries = 1, unwrap = "data", _attempt = 0 } = opts;

  try {
    const res = await fn();
    return /** @type {any} */(unwrapResponse(res, unwrap));
  } catch (err) {
    const status = err?.status ?? err?.response?.status ?? null;
    if (retries > 0 && (status === 429 || (status >= 500 && status < 600))) {
      const attempt = _attempt + 1;
      const base = 200 * Math.pow(2, attempt - 1); // 200, 400, 800...
      const jitter = Math.floor(Math.random() * 120);
      await new Promise((r) => setTimeout(r, base + jitter));
      return call(fn, { ...opts, retries: retries - 1, _attempt: attempt });
    }
    throw err;
  }
}

/**
 * 取消工具：配合 axios 的 { signal } 使用
 * @returns {{ signal: AbortSignal, cancel: () => void }}
 */
export function makeCancel() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

// 便捷方法：自动 unwrap + 可选重试配置
/** @type {(url: string, config?: import('axios').AxiosRequestConfig, opts?: {retries?: number, unwrap?: 'data'|'full'}) => Promise<any>} */
export const get = (url, config = {}, opts = {}) =>
  call(() => client.get(url, config), opts);

/** @type {(url: string, data?: any, config?: import('axios').AxiosRequestConfig, opts?: {retries?: number, unwrap?: 'data'|'full'}) => Promise<any>} */
export const post = (url, data, config = {}, opts = {}) =>
  call(() => client.post(url, data, config), opts);

/** @type {(url: string, data?: any, config?: import('axios').AxiosRequestConfig, opts?: {retries?: number, unwrap?: 'data'|'full'}) => Promise<any>} */
export const put = (url, data, config = {}, opts = {}) =>
  call(() => client.put(url, data, config), opts);

/** @type {(url: string, config?: import('axios').AxiosRequestConfig, opts?: {retries?: number, unwrap?: 'data'|'full'}) => Promise<any>} */
export const del = (url, config = {}, opts = {}) =>
  call(() => client.delete(url, config), opts);

export default client;