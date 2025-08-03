// src/api/admin.js
import { get } from "./client";

/**
 * 获取管理端统计数据。
 * 预期返回一个“扁平对象”，例如：
 * { total_abstracts, total_reviewers, reviewed_count, reviewed_ratio, conflicts, ... }
 */
export const getAdminStats = ({ signal } = {}) =>
    get("/admin/stats", { signal }, { unwrap: "data" });