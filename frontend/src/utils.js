// src/utils.js

// 白名单（可未来从后端同步替代硬编码）
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

// 归一化文本：去多余空格，小写
export function normalizeText(str = "") {
    return str
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

// 完美匹配：subject/object 是否在 sentence 中出现（忽略大小写 & 多余空格）
export function isPerfectMatch(sentence = "", fragment = "") {
    if (!sentence || !fragment) return false;
    const normSentence = normalizeText(sentence);
    const normFragment = normalizeText(fragment);
    // exact substring match
    return normSentence.includes(normFragment);
}

// 推导 overall decision：
// rules:
// - 如果有修改（某条 existing assertion 被标记 modify 或 编辑） => "modify"
// - else 如果有 reject 且 没有 modify => "reject"
// - else 如果全部 existing 都 accept 且 没有新增 => "accept"
// - else 如果有新增且没有 reject/modify => "accept" (可考虑改为 "modify" 视策略)
// - 其他情况 => "uncertain"
export function deriveOverallDecision({
    existingReviews = [], // array of {review: 'accept'|'modify'|'reject'|'uncertain', isModified: bool}
    addedAssertions = [], // array of new assertions
}) {
    const hasModify = existingReviews.some(r => r.review === "modify" || r.isModified);
    if (hasModify) return "modify";

    const hasReject = existingReviews.some(r => r.review === "reject");
    if (hasReject) return "reject";

    const allAccept = existingReviews.length > 0 && existingReviews.every(r => r.review === "accept");
    if (allAccept && addedAssertions.length === 0) return "accept";

    // 如果有新增，但没有 reject/modify -> treat as modify (since new assertion is change)
    if (addedAssertions.length > 0) return "modify";

    return "uncertain";
}