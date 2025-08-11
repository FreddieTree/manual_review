# backend/domain/assertions.py
from __future__ import annotations

import uuid
import copy
import time
from typing import Any, Dict, List
import hashlib

__all__ = [
    "make_assertion_id",
    "new_assertion",
    "update_assertion",
    "reject_assertion",
    "uncertain_assertion",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_ts() -> float:
    return time.time()

def make_assertion_id(subject: str, subject_type: str, predicate: str, object_: str, object_type: str) -> str:
    """
    Deterministic key used for grouping the *same* logical assertion content
    across different logs. 需与 aggregation 中的逻辑保持一致。
    （不要随意大小写归一/去空格，以免改变历史分组语义。）
    """
    return f"{subject}|{subject_type}|{predicate}|{object_}|{object_type}"


def compute_content_hash(
    *,
    pmid: str | int,
    sentence_idx: int,
    subject: str,
    subject_type: str,
    predicate: str,
    object_: str,
    object_type: str,
) -> str:
    """
    Canonical unique identifier per requirements:
    hash(lower(trim(subject)), lower(trim(subject_type)), lower(trim(predicate)), lower(trim(object)), lower(trim(object_type)), sentence_index, pmid)
    joined in order and hashed (sha1) to a hex string.
    """
    parts = [
        str(pmid).strip().lower(),
        str(sentence_idx).strip().lower(),
        (subject or "").strip().lower(),
        (subject_type or "").strip().lower(),
        (predicate or "").strip().lower(),
        (object_ or "").strip().lower(),
        (object_type or "").strip().lower(),
    ]
    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()

# ---------------------------------------------------------------------------
# Constructors for atomic log records
# ---------------------------------------------------------------------------

def new_assertion(
    *,
    subject: str,
    subject_type: str,
    predicate: str,
    object_: str,
    object_type: str,
    negation: bool,
    creator: str,
    pmid: str | int,
    sentence_idx: int,
    sentence_text: str,
    comment: str = "",
) -> Dict[str, Any]:
    """
    Create an 'add' log entry for a newly proposed assertion.
    """
    content_hash = compute_content_hash(
        pmid=pmid,
        sentence_idx=sentence_idx,
        subject=subject,
        subject_type=subject_type,
        predicate=predicate,
        object_=object_,
        object_type=object_type,
    )

    return {
        "version": 1,
        "assertion_id": str(uuid.uuid4()),
        "action": "add",
        "related_to": None,
        "creator": creator,

        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,

        "subject": subject,
        "subject_type": subject_type,
        "predicate": predicate,
        "object": object_,
        "object_type": object_type,
        "negation": bool(negation),

        "comment": comment,
        "content_hash": content_hash,
        "created_at": _now_ts(),

        # 便于后续审计/展示（新增时为空）
        "changed_fields": [],
    }

def update_assertion(
    *,
    original: Dict[str, Any],
    updated_fields: Dict[str, Any],
    updater: str,
    pmid: str | int,
    sentence_idx: int,
    sentence_text: str,
    comment: str = "",
) -> Dict[str, Any]:
    """
    Create a 'modify' (or no-op 'accept') log by applying updated_fields to original.
    若没有任何字段变化，则 action=accept（为了向后兼容，但通常上层会在无变化时不落日志）。
    """
    fields = ["subject", "subject_type", "predicate", "object", "object_type", "negation"]

    # 计算变更列表
    changed: List[str] = []
    for f in fields:
        old_v = original.get(f)
        new_v = updated_fields.get(f, old_v)
        if f == "negation":
            old_v = bool(old_v)
            new_v = bool(new_v)
        if old_v != new_v:
            changed.append(f)

    # 构造 updated 内容（原子快照）
    updated = copy.deepcopy(original)
    for k in fields:
        if k in updated_fields:
            updated[k] = updated_fields[k]

    return {
        "version": 1,
        "assertion_id": str(uuid.uuid4()),
        "action": "modify" if changed else "accept",
        "related_to": original.get("assertion_id"),
        "creator": updater,
        "reviewer": updater,

        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,

        "subject": updated.get("subject"),
        "subject_type": updated.get("subject_type"),
        "predicate": updated.get("predicate"),
        "object": updated.get("object"),
        "object_type": updated.get("object_type"),
        "negation": bool(updated.get("negation", False)),

        "comment": comment,
        "content_hash": compute_content_hash(
            pmid=pmid,
            sentence_idx=sentence_idx,
            subject=updated.get("subject"),
            subject_type=updated.get("subject_type"),
            predicate=updated.get("predicate"),
            object_=updated.get("object"),
            object_type=updated.get("object_type"),
        ),
        "created_at": _now_ts(),

        "changed_fields": changed,  # ⭐️ 便于后续仲裁/审计
    }

def reject_assertion(
    *,
    original: Dict[str, Any],
    reviewer: str,
    pmid: str | int,
    sentence_idx: int,
    sentence_text: str,
    reason: str = "",
) -> Dict[str, Any]:
    """
    Create a 'reject' log entry against an existing assertion.
    """
    return {
        "version": 1,
        "assertion_id": str(uuid.uuid4()),
        "action": "reject",
        "related_to": original.get("assertion_id"),
        "reviewer": reviewer,
        "creator": reviewer,

        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,

        # 保留被拒绝的原断言内容以便独立审计（快照）
        "subject": original.get("subject"),
        "subject_type": original.get("subject_type"),
        "predicate": original.get("predicate"),
        "object": original.get("object"),
        "object_type": original.get("object_type"),
        "negation": bool(original.get("negation", False)),

        "reason": reason,
        "content_hash": compute_content_hash(
            pmid=pmid,
            sentence_idx=sentence_idx,
            subject=original.get("subject"),
            subject_type=original.get("subject_type"),
            predicate=original.get("predicate"),
            object_=original.get("object"),
            object_type=original.get("object_type"),
        ),
        "created_at": _now_ts(),
    }

def uncertain_assertion(
    *,
    original: Dict[str, Any],
    reviewer: str,
    pmid: str | int,
    sentence_idx: int,
    sentence_text: str,
    comment: str = "",
) -> Dict[str, Any]:
    """
    Create an 'uncertain' log entry with optional comment.
    """
    return {
        "version": 1,
        "assertion_id": str(uuid.uuid4()),
        "action": "uncertain",
        "related_to": original.get("assertion_id"),
        "reviewer": reviewer,
        "creator": reviewer,

        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,

        # 保留快照
        "subject": original.get("subject"),
        "subject_type": original.get("subject_type"),
        "predicate": original.get("predicate"),
        "object": original.get("object"),
        "object_type": original.get("object_type"),
        "negation": bool(original.get("negation", False)),

        "comment": comment,
        "content_hash": compute_content_hash(
            pmid=pmid,
            sentence_idx=sentence_idx,
            subject=original.get("subject"),
            subject_type=original.get("subject_type"),
            predicate=original.get("predicate"),
            object_=original.get("object"),
            object_type=original.get("object_type"),
        ),
        "created_at": _now_ts(),
    }