# backend/services/audit.py
from __future__ import annotations

"""
Audit logic for review submissions with strict backend validation.

Rules
-----
- Whitelists: predicate / entity types must be valid (case-insensitive).
- Subject/Object must appear in the source sentence (case-insensitive exact substring).
- If exact not found, provide fuzzy suggestions (token Jaccard vs Levenshtein, max >= threshold).
- Existing assertions:
    * If system finds any error, "accept" is disallowed.
    * "modify" should change at most 1 field; >1 yields a warning (recommend reject/uncertain + new add).
    * "uncertain" requires a reason.
- New assertions:
    * Subject/Object must match sentence (case-insensitive exact), and whitelist checks must pass.

Return structure
----------------
{
  "logs": List[dict],
  "violations": List[dict],   # each has {level, code, message, field, sentence_index, assertion_index, addition, fuzzy_suggestion?}
  "can_commit": bool
}
"""

import os
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from ..domain.assertions import (
    new_assertion,
    update_assertion,
    reject_assertion,
    uncertain_assertion,
)
from ..models.abstracts import get_abstract_by_id
from ..services.vocab import is_valid_predicate, is_valid_entity_type

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s audit: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

VALID_DECISIONS = {"accept", "modify", "reject", "uncertain"}

# ---------------------------------------------------------------------------
# Fuzzy matching
# ---------------------------------------------------------------------------

# Allow override via env; default 0.80
FUZZY_THRESHOLD = float(os.environ.get("REVIEW_FUZZY_THRESHOLD", "0.80"))

# Split tokens by non-word characters (letters/digits/underscore are "word")
TOKEN_SPLIT_RE = re.compile(r"[^\w]+")


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "yes", "y", "on")
    return False


def _casefold(s: Any) -> str:
    try:
        return str(s or "").strip().casefold()
    except Exception:
        return ""


def _tokenize(s: str) -> List[str]:
    s = (s or "").strip().lower()
    return [t for t in TOKEN_SPLIT_RE.split(s) if t]


def _levenshtein(a: str, b: str) -> int:
    a, b = a or "", b or ""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    dp = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev = dp[0]
        dp[0] = i
        for j, cb in enumerate(b, 1):
            cur = dp[j]
            cost = 0 if ca == cb else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
            prev = cur
    return dp[-1]


def _lev_ratio(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    dist = _levenshtein(a.lower(), b.lower())
    m = max(len(a), len(b))
    return 1.0 - (dist / m if m > 0 else 1.0)


def _ngram_strings(tokens: List[str], n: int) -> List[str]:
    if n <= 0 or not tokens:
        return []
    out = []
    for i in range(0, max(0, len(tokens) - n + 1)):
        out.append(" ".join(tokens[i : i + n]))
    return out


def _token_jaccard(a: str, b: str) -> float:
    A, B = set(_tokenize(a)), set(_tokenize(b))
    if not A and not B:
        return 1.0
    inter = len(A & B)
    union = len(A | B)
    return inter / union if union else 0.0


def _best_fuzzy_span(sentence: str, phrase: str) -> Tuple[str, float]:
    """
    Find the n-gram in `sentence` (n=len(tokens(phrase))) that best matches `phrase`.
    Score is max(token-jaccard, levenshtein-ratio).
    """
    tokens = _tokenize(sentence)
    cand_tokens = _tokenize(phrase)
    if not cand_tokens or not tokens:
        return "", 0.0
    n = len(cand_tokens)
    spans = _ngram_strings(tokens, n)
    best_text = ""
    best_score = 0.0
    for s in spans:
        j = _token_jaccard(s, phrase)
        l = _lev_ratio(s, phrase)
        score = max(j, l)
        if score > best_score:
            best_score = score
            best_text = s
    return best_text, best_score


def _contains_case_insensitive(sentence: str, phrase: str) -> bool:
    return _casefold(phrase) in _casefold(sentence)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _mk_violation(
    *,
    level: str,
    code: str,
    message: str,
    field: Optional[str] = None,
    sentence_index: Optional[int] = None,
    assertion_index: Optional[int] = None,
    addition: bool = False,
    fuzzy_suggestion: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    v: Dict[str, Any] = {
        "level": level,
        "code": code,
        "message": message,
        "field": field,
        "sentence_index": sentence_index,
        "assertion_index": assertion_index,
        "addition": addition,
    }
    if fuzzy_suggestion:
        v["fuzzy_suggestion"] = {
            "text": str(fuzzy_suggestion.get("text", "")),
            "score": round(float(fuzzy_suggestion.get("score", 0.0)), 3),
        }
    return v


def _validate_fields_against_sentence(
    sentence_text: str,
    subject: str,
    object_: str,
    *,
    sentence_index: Optional[int] = None,
    assertion_index: Optional[int] = None,
    addition: bool = False,
) -> List[Dict[str, Any]]:
    """
    Validate subject/object presence in the sentence (case-insensitive exact substring).
    If exact not found, attach fuzzy suggestion when score >= FUZZY_THRESHOLD.
    """
    violations: List[Dict[str, Any]] = []

    # subject
    if subject:
        if not _contains_case_insensitive(sentence_text, subject):
            best, score = _best_fuzzy_span(sentence_text, subject)
            fuzzy = {"text": best, "score": score} if best and score >= FUZZY_THRESHOLD else None
            if fuzzy:
                violations.append(
                    _mk_violation(
                        level="warning",
                        code="subject_fuzzy_match",
                        message=f'Fuzzy match candidate for subject: "{best}". Please select an exact phrase from the sentence.',
                        field="subject",
                        sentence_index=sentence_index,
                        assertion_index=assertion_index,
                        addition=addition,
                        fuzzy_suggestion=fuzzy,
                    )
                )
            violations.append(
                _mk_violation(
                    level="error",
                    code="subject_not_found",
                    message="Subject not found in sentence (case-insensitive exact match required).",
                    field="subject",
                    sentence_index=sentence_index,
                    assertion_index=assertion_index,
                    addition=addition,
                    fuzzy_suggestion=fuzzy,
                )
            )
    else:
        violations.append(
            _mk_violation(
                level="error",
                code="subject_missing",
                message="Subject is required.",
                field="subject",
                sentence_index=sentence_index,
                assertion_index=assertion_index,
                addition=addition,
            )
        )

    # object
    if object_:
        if not _contains_case_insensitive(sentence_text, object_):
            best, score = _best_fuzzy_span(sentence_text, object_)
            fuzzy = {"text": best, "score": score} if best and score >= FUZZY_THRESHOLD else None
            if fuzzy:
                violations.append(
                    _mk_violation(
                        level="warning",
                        code="object_fuzzy_match",
                        message=f'Fuzzy match candidate for object: "{best}". Please select an exact phrase from the sentence.',
                        field="object",
                        sentence_index=sentence_index,
                        assertion_index=assertion_index,
                        addition=addition,
                        fuzzy_suggestion=fuzzy,
                    )
                )
            violations.append(
                _mk_violation(
                    level="error",
                    code="object_not_found",
                    message="Object not found in sentence (case-insensitive exact match required).",
                    field="object",
                    sentence_index=sentence_index,
                    assertion_index=assertion_index,
                    addition=addition,
                    fuzzy_suggestion=fuzzy,
                )
            )
    else:
        violations.append(
            _mk_violation(
                level="error",
                code="object_missing",
                message="Object is required.",
                field="object",
                sentence_index=sentence_index,
                assertion_index=assertion_index,
                addition=addition,
            )
        )

    return violations


def _validate_whitelists(
    predicate: str,
    subject_type: str,
    object_type: str,
    *,
    sentence_index: Optional[int] = None,
    assertion_index: Optional[int] = None,
    addition: bool = False,
) -> List[Dict[str, Any]]:
    """
    Case-insensitive whitelist checks using services.vocab validators.
    """
    out: List[Dict[str, Any]] = []
    if predicate and not is_valid_predicate(predicate):
        out.append(
            _mk_violation(
                level="error",
                code="predicate_not_whitelisted",
                message=f'Predicate "{predicate}" is not in whitelist.',
                field="predicate",
                sentence_index=sentence_index,
                assertion_index=assertion_index,
                addition=addition,
            )
        )
    if subject_type and not is_valid_entity_type(subject_type):
        out.append(
            _mk_violation(
                level="error",
                code="subject_type_not_whitelisted",
                message=f'Subject type "{subject_type}" is not in whitelist.',
                field="subject_type",
                sentence_index=sentence_index,
                assertion_index=assertion_index,
                addition=addition,
            )
        )
    if object_type and not is_valid_entity_type(object_type):
        out.append(
            _mk_violation(
                level="error",
                code="object_type_not_whitelisted",
                message=f'Object type "{object_type}" is not in whitelist.',
                field="object_type",
                sentence_index=sentence_index,
                assertion_index=assertion_index,
                addition=addition,
            )
        )
    return out


def _norm_field(k: str, v: Any) -> Any:
    if k == "negation":
        return bool(v)
    # case-insensitive compare for strings; treat None as empty
    return (str(v or "").strip().casefold())


def _count_changes(original: Dict[str, Any], updated: Dict[str, Any]) -> int:
    keys = ("subject", "subject_type", "predicate", "object", "object_type", "negation")
    return sum(_norm_field(k, original.get(k)) != _norm_field(k, updated.get(k)) for k in keys)


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------

def audit_review_submission(
    abs_id: Union[str, int],
    sentence_results: List[Dict[str, Any]],
    post_data: Dict[str, Any],
    reviewer_info: Dict[str, str],
    review_states: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """
    Convert a review submission into atomic logs while enforcing strict validation.
    """
    logs: List[Dict[str, Any]] = []
    violations: List[Dict[str, Any]] = []
    can_commit = True

    email = (reviewer_info.get("email") or "").lower()
    abstract = get_abstract_by_id(abs_id)
    if not abstract:
        raise ValueError(f"Abstract {abs_id} not found during audit.")

    for sent_idx, sent in enumerate(sentence_results):
        sentence_text = sent.get("sentence", "")
        assertions = sent.get("assertions", []) or []

        # review_states may use string or numeric sentence keys
        structured_for_sentence: Dict[int, Dict[str, Any]] = {}
        key_str = str(sent.get("sentence_index", sent_idx))
        if review_states:
            if key_str in review_states:
                structured_for_sentence = {i: s for i, s in enumerate(review_states[key_str])}
            elif sent_idx in review_states:
                structured_for_sentence = {i: s for i, s in enumerate(review_states[sent_idx])}

        # ---- Existing assertions ------------------------------------------
        for ass_idx, assertion in enumerate(assertions):
            decision = "accept"
            comment = ""
            is_modified_flag = False

            if ass_idx in structured_for_sentence:
                state = structured_for_sentence[ass_idx]
                decision = (state.get("review") or "accept").lower()
                comment = state.get("comment", "") or ""
                is_modified_flag = bool(state.get("isModified", False))
            else:
                # legacy flat fields
                decision = (post_data.get(f"review_{sent_idx}_{ass_idx}") or "accept").lower()
                comment = post_data.get(f"comment_{sent_idx}_{ass_idx}", "") or ""
                if (
                    post_data.get(f"subject_{sent_idx}_{ass_idx}", assertion.get("subject")) != assertion.get("subject")
                    or post_data.get(f"predicate_{sent_idx}_{ass_idx}", assertion.get("predicate")) != assertion.get("predicate")
                    or post_data.get(f"object_{sent_idx}_{ass_idx}", assertion.get("object")) != assertion.get("object")
                    or str(post_data.get(f"negation_{sent_idx}_{ass_idx}", assertion.get("negation"))).lower()
                    != str(assertion.get("negation")).lower()
                ):
                    is_modified_flag = True

            if decision not in VALID_DECISIONS:
                decision = "accept"

            # Collect possibly updated snapshot (legacy overrides if present)
            subj = assertion.get("subject")
            subj_type = assertion.get("subject_type")
            pred = assertion.get("predicate")
            obj = assertion.get("object")
            obj_type = assertion.get("object_type")
            neg = assertion.get("negation", False)

            if ass_idx not in structured_for_sentence:
                subj = post_data.get(f"subject_{sent_idx}_{ass_idx}", subj)
                subj_type = post_data.get(f"subject_type_{sent_idx}_{ass_idx}", subj_type)
                pred = post_data.get(f"predicate_{sent_idx}_{ass_idx}", pred)
                obj = post_data.get(f"object_{sent_idx}_{ass_idx}", obj)
                obj_type = post_data.get(f"object_type_{sent_idx}_{ass_idx}", obj_type)
                neg = _parse_bool(post_data.get(f"negation_{sent_idx}_{ass_idx}", neg))

            updated_snapshot = {
                "subject": subj,
                "subject_type": subj_type,
                "predicate": pred,
                "object": obj,
                "object_type": obj_type,
                "negation": bool(neg),
            }

            # Validations
            field_issues = []
            field_issues += _validate_fields_against_sentence(
                sentence_text, subj or "", obj or "",
                sentence_index=sent_idx, assertion_index=ass_idx, addition=False
            )
            field_issues += _validate_whitelists(
                pred or "", subj_type or "", obj_type or "",
                sentence_index=sent_idx, assertion_index=ass_idx, addition=False
            )

            # Accept is disallowed if any error is present
            if decision == "accept" and any(v["level"] == "error" for v in field_issues):
                field_issues.append(
                    _mk_violation(
                        level="error",
                        code="accept_disallowed_due_to_issues",
                        message="System found issues in this assertion. Accept is not allowed; choose Modify/Reject or add a new assertion.",
                        field=None,
                        sentence_index=sent_idx,
                        assertion_index=ass_idx,
                        addition=False,
                    )
                )

            # Modify should change at most one field
            change_count = _count_changes(assertion, updated_snapshot)
            if decision == "modify" or is_modified_flag:
                if change_count > 1:
                    field_issues.append(
                        _mk_violation(
                            level="warning",
                            code="multiple_changes",
                            message="More than one change detected. Prefer Reject or mark Uncertain, then add a clean assertion.",
                            field=None,
                            sentence_index=sent_idx,
                            assertion_index=ass_idx,
                            addition=False,
                        )
                    )

            # Uncertain requires a reason
            if decision == "uncertain" and not (comment or "").strip():
                field_issues.append(
                    _mk_violation(
                        level="error",
                        code="uncertain_reason_required",
                        message="Please provide a reason when marking an assertion as 'uncertain'.",
                        field=None,
                        sentence_index=sent_idx,
                        assertion_index=ass_idx,
                        addition=False,
                    )
                )

            # Aggregate violations and commit gating
            violations.extend(field_issues)
            if any(v["level"] == "error" for v in field_issues):
                can_commit = False

            # Emit logs (do not auto-alter decision based on violations)
            if decision == "accept" and not is_modified_flag:
                # No log for plain accepts (historical behavior)
                continue
            elif decision == "modify" or (decision == "accept" and is_modified_flag):
                logs.append(
                    update_assertion(
                        original=assertion,
                        updated_fields=updated_snapshot,
                        updater=email,
                        pmid=abs_id,
                        sentence_idx=sent_idx,
                        sentence_text=sentence_text,
                        comment=comment,
                    )
                )
            elif decision == "uncertain":
                logs.append(
                    uncertain_assertion(
                        original=assertion,
                        reviewer=email,
                        pmid=abs_id,
                        sentence_idx=sent_idx,
                        sentence_text=sentence_text,
                        comment=comment,
                    )
                )
            elif decision == "reject":
                logs.append(
                    reject_assertion(
                        original=assertion,
                        reviewer=email,
                        pmid=abs_id,
                        sentence_idx=sent_idx,
                        sentence_text=sentence_text,
                        reason=comment,
                    )
                )

        # ---- New assertion via legacy flat fields --------------------------
        subj = (post_data.get(f"useradd_subject_{sent_idx}", "") or "").strip()
        pred = (post_data.get(f"useradd_predicate_{sent_idx}", "") or "").strip()
        obj = (post_data.get(f"useradd_object_{sent_idx}", "") or "").strip()
        neg = _parse_bool(post_data.get(f"useradd_negation_{sent_idx}", "false"))
        comment = post_data.get(f"useradd_comment_{sent_idx}", "") or ""
        subj_type = (post_data.get(f"useradd_subject_type_{sent_idx}", "") or "").strip()
        obj_type = (post_data.get(f"useradd_object_type_{sent_idx}", "") or "").strip()

        if subj or pred or obj:
            add_issues: List[Dict[str, Any]] = []
            if not subj:
                add_issues.append(
                    _mk_violation(
                        level="error",
                        code="subject_missing",
                        message="Subject is required for new assertion.",
                        field="subject",
                        sentence_index=sent_idx,
                        assertion_index=None,
                        addition=True,
                    )
                )
            if not pred:
                add_issues.append(
                    _mk_violation(
                        level="error",
                        code="predicate_missing",
                        message="Predicate is required for new assertion.",
                        field="predicate",
                        sentence_index=sent_idx,
                        assertion_index=None,
                        addition=True,
                    )
                )
            if not obj:
                add_issues.append(
                    _mk_violation(
                        level="error",
                        code="object_missing",
                        message="Object is required for new assertion.",
                        field="object",
                        sentence_index=sent_idx,
                        assertion_index=None,
                        addition=True,
                    )
                )

            # Exact-match & whitelist checks
            add_issues += _validate_fields_against_sentence(
                sentence_text, subj or "", obj or "",
                sentence_index=sent_idx, assertion_index=None, addition=True
            )
            add_issues += _validate_whitelists(
                pred or "", subj_type or "", obj_type or "",
                sentence_index=sent_idx, assertion_index=None, addition=True
            )

            violations.extend(add_issues)
            if any(v["level"] == "error" for v in add_issues):
                can_commit = False

            # Only create "add" log when the 3 core fields exist and no error
            if subj and pred and obj and not any(v["level"] == "error" for v in add_issues):
                logs.append(
                    new_assertion(
                        subject=subj,
                        subject_type=subj_type,
                        predicate=pred,
                        object_=obj,
                        object_type=obj_type,
                        negation=neg,
                        creator=email,
                        pmid=abs_id,
                        sentence_idx=sent_idx,
                        sentence_text=sentence_text,
                        comment=comment,
                    )
                )

    # Enrich logs with fallback identity & ISO timestamp
    for log in logs:
        if "creator" not in log and "reviewer" not in log:
            log["creator"] = email
        log.setdefault("logged_at", datetime.utcnow().isoformat() + "Z")

    return {
        "logs": logs,
        "violations": violations,
        "can_commit": bool(can_commit),
    }