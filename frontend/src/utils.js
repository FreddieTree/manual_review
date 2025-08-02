// src/utils.js

// 白名单（最终以后端为准；前端可通过 /api/meta/vocab 同步）
export const PREDICATE_WHITELIST = [
    "causes",
    "increases",
    "reduces",
    "decreases",
    "associated_with",
    "inhibits",
    "induces",
    "related_to",
    "no_effect",
    "prevents",
];

export const ENTITY_TYPE_WHITELIST = [
    "dsyn",
    "neop",
    "chem",
    "phsu",
    "gngm",
    "aapp",
    "sosy",
    "patf",
];

// --- Text normalization ----------------------------------------------------

/**
 * 规范化文本：
 * - 转小写
 * - Unicode 归一化（NFKD）并去除重音/变音
 * - 标点/引号/括号最小化处理
 * - 折叠空白
 */
export function normalizeText(str = "") {
    if (!str) return "";
    let s = String(str).toLowerCase();

    // Unicode 兼容分解 + 去除变音（如 café -> cafe）
    try {
        s = s.normalize("NFKD").replace(/\p{M}+/gu, "");
    } catch {
        // older engines: ignore
    }

    // 统一各类破折号/连字符为空格
    s = s.replace(/[\u2010-\u2015\u2212-]+/g, " ");

    // 去掉常见英文标点与引号、括号
    s = s.replace(/[.,;:!?()"“”'’[\]{}/\\]+/g, " ");

    // 折叠空白
    s = s.trim().replace(/\s+/g, " ");

    return s;
}

/**
 * perfectMatch（向后兼容）：
 * 默认使用包含匹配；可通过 options.mode === 'exact' 指定全等。
 * @param {string} sentence
 * @param {string} fragment
 * @param {{ mode?: 'contains'|'exact' }} [options]
 */
export function isPerfectMatch(sentence = "", fragment = "", options = {}) {
    if (!sentence || !fragment) return false;
    const a = normalizeText(sentence);
    const b = normalizeText(fragment);
    const mode = options.mode || "contains";
    return mode === "exact" ? a === b : a.includes(b);
}

// 保持别名
export const perfectMatch = isPerfectMatch;

// --- Decision aggregation --------------------------------------------------

/**
 * 统一决策值（大小写不敏感 + 同义映射）
 */
function normalizeDecision(v) {
    const d = String(v || "").toLowerCase().trim();
    if (!d) return "";
    if (d === "edited" || d === "edit" || d === "changed") return "modify";
    if (d === "approve" || d === "accepted") return "accept";
    if (d === "decline" || d === "rejected") return "reject";
    if (d === "uncertain" || d === "unknown") return "uncertain";
    return d; // accept | modify | reject | uncertain
}

/**
 * 根据多人的决策或旧结构推导最终结论。
 * 返回值：'accept' | 'modify' | 'reject' | 'uncertain'
 *
 * 支持两种输入：
 *  - 数组：[{ decision: 'accept'|'modify'|'reject'|'uncertain' }, ...]
 *  - 对象：{ existingReviews: [{ review: '...' }], addedAssertions: [...] }
 */
export function deriveOverallDecision(arg) {
    // 形式 A：数组
    if (Array.isArray(arg)) {
        const states = arg.map((s) => normalizeDecision(s?.decision ?? s?.review));
        const hasReject = states.includes("reject");
        const hasModify = states.includes("modify");
        const allAccept = states.length > 0 && states.every((d) => d === "accept");

        if (hasReject) return "reject";
        if (hasModify) return "modify";
        if (allAccept) return "accept";
        return "uncertain";
    }

    // 形式 B：旧版结构
    const { existingReviews = [], addedAssertions = [] } = arg || {};
    const reviews = existingReviews.map((r) => normalizeDecision(r?.review));
    const hasModify = reviews.includes("modify") || existingReviews.some((r) => r?.isModified === true);
    const hasReject = reviews.includes("reject");
    const allAccept = reviews.length > 0 && reviews.every((d) => d === "accept");

    if (hasReject) return "reject";
    if (hasModify) return "modify";
    if (allAccept && (Array.isArray(addedAssertions) ? addedAssertions.length === 0 : true)) {
        return "accept";
    }
    if (Array.isArray(addedAssertions) && addedAssertions.length > 0) return "modify";
    return "uncertain";
}