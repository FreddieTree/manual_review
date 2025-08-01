// src/utils.js

// 白名单（后端 config.py 为权威，前端可通过 API 同步替代硬编码）
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

// 标准化文本：小写、去多余空格、去常见标点
function normalizeText(str = "") {
    return str
        .toLowerCase()
        .replace(/[.,;:()\"']/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

// perfectMatch 兼容旧用法
export function isPerfectMatch(sentence = "", fragment = "") {
    if (!sentence || !fragment) return false;
    return normalizeText(sentence).includes(normalizeText(fragment));
}
export const perfectMatch = isPerfectMatch;

// deriveOverallDecision：支持两种输入形式
export function deriveOverallDecision(arg) {
    if (Array.isArray(arg)) {
        // 简化版： [{ decision: 'accept'|'modify'|'reject'|'uncertain' }, ...]
        const states = arg;
        const hasReject = states.some((s) => (s.decision || s.review) === "reject");
        const hasModify = states.some((s) => (s.decision || s.review) === "modify");
        const allAccept =
            states.length > 0 &&
            states.every((s) => (s.decision || s.review) === "accept");
        if (hasReject) return "reject";
        if (hasModify) return "modify";
        if (allAccept) return "accept";
        return "uncertain";
    }

    // 旧版结构：{ existingReviews, addedAssertions }
    const { existingReviews = [], addedAssertions = [] } = arg || {};
    const hasModify = existingReviews.some(
        (r) => r.review === "modify" || r.isModified
    );
    if (hasModify) return "modify";
    const hasReject = existingReviews.some((r) => r.review === "reject");
    if (hasReject) return "reject";
    const allAccept =
        existingReviews.length > 0 &&
        existingReviews.every((r) => r.review === "accept");
    if (allAccept && addedAssertions.length === 0) return "accept";
    if (addedAssertions.length > 0) return "modify";
    return "uncertain";
}