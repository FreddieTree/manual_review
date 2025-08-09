import { get, post } from "./client";
import { BASE_URL } from "./client";

/**
 * 将后端返回的不同字段风格（snake/camel）标准化为统一键名。
 * 返回形如：
 * {
 *   total_abstracts, total_reviewers, reviewed_count, reviewed_ratio,
 *   conflicts, abstracts_today, new_reviewers, arbitration_count,
 *   active_reviewers, last_export
 * }
 */
function normalizeAdminStats(obj) {
    if (!obj || typeof obj !== "object") return null;
    const pick = (a, b) => (a !== undefined ? a : b !== undefined ? b : null);
    return {
        total_abstracts: pick(obj.total_abstracts, obj.totalAbstracts),
        total_reviewers: pick(obj.total_reviewers, obj.totalReviewers),
        reviewed_count: pick(obj.reviewed_count, obj.reviewedCount),
        reviewed_ratio: pick(obj.reviewed_ratio, obj.reviewedRatio),
        conflicts: obj.conflicts ?? 0,
        abstracts_today: obj.abstracts_today ?? null,
        new_reviewers: obj.new_reviewers ?? null,
        arbitration_count: pick(obj.arbitration_count, obj.arbitrationCount) ?? 0,
        active_reviewers: pick(obj.active_reviewers, obj.activeReviewers) ?? 0,
        last_export: pick(obj.last_export, obj.lastExport),
    };
}

/**
 * 获取管理端统计数据（多端点兜底 + 字段标准化）。
 * 注意：传入的 path 是相对的，不要带前导 slash，也不要写 /api 前缀；
 * client 已经配置 baseURL 为 /api。
 */
export async function getAdminStats({ signal } = {}) {
    const candidates = [
        "admin/stats",
        "admin/overview",
        "stats/overview",
        "admin/dashboard",
        "stats",
    ];

    for (const path of candidates) {
        try {
            console.debug("[getAdminStats] trying", path);
            const body = await get(path, { signal }, { unwrap: "data" });
            console.debug("[getAdminStats] raw response from", path, ":", body);

            const raw =
                (body && typeof body === "object" && body.data) ||
                (body && typeof body === "object" && body.stats) ||
                body;

            const normalized = normalizeAdminStats(raw);
            if (normalized) {
                console.debug("[getAdminStats] normalized from", path, ":", normalized);
                return normalized;
            }
        } catch (err) {
            console.warn("[getAdminStats] failed for", path, err);
            // 继续下一个候选
        }
    }

    throw new Error("Unable to load admin stats from any endpoint.");
}

// Analytics (global or reviewer-scoped)
export const getAnalytics = (params = {}, { signal } = {}) => {
  const qs = new URLSearchParams(params).toString();
  return get(`admin/analytics${qs ? `?${qs}` : ""}`, { signal }, { unwrap: "data" });
};

// Admin actions
// Open a GET download in the browser (saves to Downloads). Returns true if initiated.
export function exportConsensus() {
  try {
    const url = `${BASE_URL.replace(/\/+$/, "")}/export_consensus?download=1`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return Promise.resolve(true);
  } catch (e) {
    return Promise.reject(e);
  }
}

export function exportPassed() {
  try {
    const url = `${BASE_URL.replace(/\/+$/, "")}/export_passed?download=1`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return Promise.resolve(true);
  } catch (e) {
    return Promise.reject(e);
  }
}

// POST download with a temporary form to include body and cookies
export function exportSnapshot() {
  try {
    const url = `${BASE_URL.replace(/\/+$/, "")}/admin/export_snapshot?download=1`;
    const form = document.createElement("form");
    form.action = url;
    form.method = "POST";
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "confirm";
    input.value = "true";
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => document.body.removeChild(form), 2000);
    return Promise.resolve(true);
  } catch (e) {
    return Promise.reject(e);
  }
}

export const uploadAbstracts = (payload, { signal } = {}) => {
  // Supports multipart file upload or JSON { path, confirm }
  // Callers must set confirm=true per backend requirement
  const hasFile = payload instanceof FormData;
  if (hasFile) {
    payload.set("confirm", "true");
    return fetch("/api/admin/upload_abstracts", {
      method: "POST",
      credentials: "include",
      body: payload,
      signal,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.message || res.statusText);
      return data;
    });
  }
  const body = { ...(payload || {}), confirm: true };
  return fetch("/api/admin/upload_abstracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error(data?.message || res.statusText);
    return data;
  });
};

export const getImportProgress = (jobId, { signal } = {}) =>
  get(`admin/import_progress/${encodeURIComponent(jobId)}`, { signal }, { unwrap: "full" });