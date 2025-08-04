// src/api/pricing.js
import { get } from "./client";

/**
 * 获取 pricing 信息
 */
export const getPricing = (abstractId, { signal } = {}) => {
    const params = abstractId ? { abstract: abstractId } : undefined;
    return get("review/pricing", { params, signal }).then(res => {
        return res;
    });
};