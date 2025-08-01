# reviewer_utils.py
"""
Audit logic for review submissions.

Supports both structured front-end review_states and legacy form_data.
Generates atomic log entries (add/modify/reject/uncertain) via assertion_utils helpers.
"""

import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

from assertion_utils import (
    new_assertion,
    update_assertion,
    reject_assertion,
    uncertain_assertion,
)
from models import get_abstract_by_id
from utils import coerce_bool  # fallback if no normalize_str needed

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s reviewer_utils: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

VALID_DECISIONS = {"accept", "modify", "reject", "uncertain"}


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "yes", "y")
    try:
        return bool(int(val))
    except Exception:
        return False


def audit_review_submission(
    abs_id: Union[str, int],
    sentence_results: List[Dict[str, Any]],
    post_data: Dict[str, Any],
    reviewer_info: Dict[str, str],
    review_states: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
    """
    Convert review submission into log entries.
    """
    logs: List[Dict[str, Any]] = []
    email = reviewer_info.get("email", "").lower()
    name = reviewer_info.get("name", email)

    abstract = get_abstract_by_id(abs_id)
    if not abstract:
        raise ValueError(f"Abstract {abs_id} not found during audit.")

    for sent_idx, sent in enumerate(sentence_results):
        sentence_text = sent.get("sentence", "")
        assertions = sent.get("assertions", []) or []

        structured = {}
        key_str = str(sent.get("sentence_index", sent_idx))
        if review_states:
            # support both numeric and string keys
            if key_str in review_states:
                structured = {i: s for i, s in enumerate(review_states[key_str])}
            elif sent_idx in review_states:
                structured = {i: s for i, s in enumerate(review_states[sent_idx])}

        for ass_idx, assertion in enumerate(assertions):
            decision = "accept"
            comment = ""
            is_modified_flag = False

            # structured takes precedence
            if ass_idx in structured:
                state = structured[ass_idx]
                decision = (state.get("review") or "accept").lower()
                comment = state.get("comment", "") or ""
                is_modified_flag = bool(state.get("isModified", False))
            else:
                # legacy form fields
                review_key = f"review_{sent_idx}_{ass_idx}"
                comment_key = f"comment_{sent_idx}_{ass_idx}"
                subject_key = f"subject_{sent_idx}_{ass_idx}"
                predicate_key = f"predicate_{sent_idx}_{ass_idx}"
                object_key = f"object_{sent_idx}_{ass_idx}"
                negation_key = f"negation_{sent_idx}_{ass_idx}"

                decision = (post_data.get(review_key) or "accept").lower()
                comment = post_data.get(comment_key, "") or ""

                # detect if any content changed
                if (
                    post_data.get(subject_key, assertion.get("subject")) != assertion.get("subject")
                    or post_data.get(predicate_key, assertion.get("predicate")) != assertion.get("predicate")
                    or post_data.get(object_key, assertion.get("object")) != assertion.get("object")
                    or str(post_data.get(negation_key, assertion.get("negation"))).lower()
                    != str(assertion.get("negation")).lower()
                ):
                    is_modified_flag = True

            if decision not in VALID_DECISIONS:
                decision = "accept"

            # Build updated fields for modifications
            subj = assertion.get("subject")
            subj_type = assertion.get("subject_type")
            pred = assertion.get("predicate")
            obj = assertion.get("object")
            obj_type = assertion.get("object_type")
            neg = assertion.get("negation", False)

            if ass_idx not in structured:
                # override from legacy if provided
                subj_key = f"subject_{sent_idx}_{ass_idx}"
                subj_type_key = f"subject_type_{sent_idx}_{ass_idx}"
                predicate_key = f"predicate_{sent_idx}_{ass_idx}"
                object_key = f"object_{sent_idx}_{ass_idx}"
                object_type_key = f"object_type_{sent_idx}_{ass_idx}"
                negation_key = f"negation_{sent_idx}_{ass_idx}"

                subj = post_data.get(subj_key, subj)
                subj_type = post_data.get(subj_type_key, subj_type)
                pred = post_data.get(predicate_key, pred)
                obj = post_data.get(object_key, obj)
                obj_type = post_data.get(object_type_key, obj_type)
                neg = _parse_bool(post_data.get(negation_key, neg))

            # Decide what to log
            if decision == "accept" and not is_modified_flag:
                continue  # nothing to emit
            elif decision == "modify" or (decision == "accept" and is_modified_flag):
                updated = update_assertion(
                    original=assertion,
                    updated_fields={
                        "subject": subj,
                        "subject_type": subj_type,
                        "predicate": pred,
                        "object": obj,
                        "object_type": obj_type,
                        "negation": neg,
                    },
                    updater=email,
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sentence_text,
                    comment=comment,
                )
                logs.append(updated)
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

    # New assertions - legacy fields
    for sent_idx, sent in enumerate(sentence_results):
        sentence_text = sent.get("sentence", "")
        subj = post_data.get(f"useradd_subject_{sent_idx}", "").strip()
        pred = post_data.get(f"useradd_predicate_{sent_idx}", "").strip()
        obj = post_data.get(f"useradd_object_{sent_idx}", "").strip()
        neg = _parse_bool(post_data.get(f"useradd_negation_{sent_idx}", "false"))
        comment = post_data.get(f"useradd_comment_{sent_idx}", "") or ""
        subj_type = post_data.get(f"useradd_subject_type_{sent_idx}", "").strip()
        obj_type = post_data.get(f"useradd_object_type_{sent_idx}", "").strip()

        if subj and pred and obj:
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

    # Normalize/enrich logs
    for log in logs:
        if "creator" not in log and "reviewer" not in log:
            log["creator"] = email
        log.setdefault("logged_at", datetime.utcnow().isoformat() + "Z")

    return logs