# backend/services/arbitration.py
from __future__ import annotations

import time
from typing import List, Optional, Dict, Any, Literal, Iterable
from collections import Counter

from ..models.abstracts import get_all_pmids
from ..models.logs import log_review_action, load_logs
from ..services.aggregation import (
    find_assertion_conflicts,
    aggregate_assertions_for_pmid,
    consensus_decision,
    ConsensusResult,
    invalidate_cache,
)

ArbitrateDecision = Literal["accept", "modify", "reject", "uncertain"]


class ArbitrationError(Exception):
    """Custom error for arbitration-related invalid operations."""
    pass


# ---------------------------- small utils ------------------------------------

def _norm_action(a: Any) -> str:
    """Normalize actions / decisions to lowercase strings."""
    v = getattr(a, "value", a)
    return (str(v or "").strip().lower())

def _ts(log: Dict[str, Any]) -> float:
    """Parse timestamp robustly; prefer created_at, then timestamp."""
    for k in ("created_at", "timestamp"):
        v = log.get(k)
        try:
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str) and v.strip():
                return float(v)
        except Exception:
            continue
    return 0.0

def _pmids_from_logs(raw: Iterable[Dict[str, Any]]) -> List[str]:
    """Collect distinct PMIDs found in raw logs."""
    seen, out = set(), []
    for l in raw:
        pid = str(l.get("pmid") or "").strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append(pid)
    return out


# ----------------------------- public API ------------------------------------

def get_arbitration_queue(
    pmid: Optional[str] = None,
    only_conflicts: bool = True,
    include_pending: bool = False,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve assertions needing arbitration.

    返回每项字段：
      - pmid
      - assertion_key   # 稳定生命周期键（兼容返回 assertion_id 同值）
      - logs            # 已按时间升序
      - status          # aggregation.ConsensusResult 的 value
      - support_counts  # 各 action 计数
      - conflict_reason # 若为冲突则给出简短原因（可选）
    """
    queue: List[Dict[str, Any]] = []

    # 目标 pmids：如果指定 pmid 则只看该 pmid；否则来自「abstracts ∪ 日志」
    if pmid is not None:
        targets = [str(pmid)]
    else:
        raw_logs = load_logs()
        pmids_logs = _pmids_from_logs(raw_logs)
        pmids_abs = list(get_all_pmids())
        targets = list({*pmids_logs, *pmids_abs})

    for pid in targets:
        groups = aggregate_assertions_for_pmid(pid)  # {assertion_key: logs}
        for akey, logs in groups.items():
            # 跳过已仲裁（出现 arbitrate）
            if any(_norm_action(l.get("action")) == "arbitrate" for l in logs):
                continue

            status = consensus_decision(logs)

            # 忽略仅包含 add 的生命周期（尚未开始评审，不应进入仲裁）
            actions = [_norm_action(l.get("action")) for l in logs if l.get("action")]
            counts = dict(Counter(actions))
            if counts and set(counts.keys()).issubset({"add"}):
                continue

            if only_conflicts:
                if status != ConsensusResult.CONFLICT:
                    # 可选择把未决/不确定也塞入
                    if include_pending and status in (ConsensusResult.PENDING, ConsensusResult.UNCERTAIN):
                        pass
                    else:
                        continue
            else:
                if not include_pending and status in (ConsensusResult.PENDING, ConsensusResult.UNCERTAIN):
                    continue

            # 统计 & 排序日志
            # actions/counts 已在上面计算
            logs_sorted = sorted(logs, key=_ts)

            # 简单冲突原因（可选）
            conflict_reason = None
            if status == ConsensusResult.CONFLICT:
                bits = []
                if counts.get("reject", 0) > 0:
                    bits.append("contains reject")
                if counts.get("uncertain", 0) > 0:
                    bits.append("contains uncertain")
                conflict_reason = "; ".join(bits) if bits else "mixed signals"

            queue.append({
                "pmid": pid,
                "assertion_key": akey,
                "assertion_id": akey,   # 兼容旧字段名
                "logs": logs_sorted,
                "status": status.value,
                "support_counts": counts,
                "conflict_reason": conflict_reason,
                "last_updated": _ts(logs_sorted[-1]) if logs_sorted else 0.0,
            })

    # 排序：最近更新时间倒序；同时间可以保留原相对顺序
    queue.sort(key=lambda it: it.get("last_updated", 0.0), reverse=True)

    if limit:
        queue = queue[: int(limit)]
    return queue


def get_latest_arbitration(assertion_key: str, pmid: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve the most recent arbitration entry (action == 'arbitrate')
    for a given assertion lifecycle (assertion_key).
    """
    groups = aggregate_assertions_for_pmid(pmid)
    logs = groups.get(assertion_key, []) or []
    arb_logs = [l for l in logs if _norm_action(l.get("action")) == "arbitrate"]
    if not arb_logs:
        return None
    return max(arb_logs, key=_ts)


def set_arbitration_result(
    pmid: str,
    assertion_key: str,
    decision: ArbitrateDecision,
    admin_email: str,
    comment: str = "",
    overwrite: bool = False
) -> Dict[str, Any]:
    """
    Record an arbitration decision for a conflicted assertion (or force overwrite).

    - 使用 assertion_key（稳定生命周期键）。为兼容旧前端，可把 assertion_id 传入同一参数。
    - 写入后会自动失效聚合缓存。
    """
    normalized = _norm_action(decision)
    if normalized not in {"accept", "modify", "reject", "uncertain"}:
        raise ArbitrationError(f"Unsupported arbitration decision: {decision}")

    # Append-only policy: no destructive overwrite. If not overwrite, require conflict membership;
    # if the same decision exists already, return latest.
    if not overwrite:
        conflicts = find_assertion_conflicts(pmid)  # 仅扫描该 pmid（配合我们上游聚合，日志也能识别）
        conflict_keys = {c["assertion_key"] for c in conflicts}
        if assertion_key not in conflict_keys:
            latest = get_latest_arbitration(assertion_key, pmid)
            if latest and _norm_action(latest.get("arbitrate_decision")) == normalized:
                return latest
            raise ArbitrationError(
                f"Assertion {assertion_key} for PMID {pmid} is not in conflict and overwrite is False."
            )

    # 取仲裁前的共识状态（用于审计，失败不阻断）
    try:
        groups = aggregate_assertions_for_pmid(pmid)
        prior_logs = groups.get(assertion_key, [])
        prior_status = consensus_decision(prior_logs).value if prior_logs else ConsensusResult.PENDING.value
    except Exception:
        prior_status = "unknown"

    record: Dict[str, Any] = {
        "action": "arbitrate",
        "arbitrate_decision": normalized,
        "assertion_id": assertion_key,   # 兼容旧字段名
        "assertion_key": assertion_key,  # 新字段名（推荐）
        "pmid": pmid,
        "admin": (admin_email or "").lower(),
        "comment": comment or "",
        "prior_consensus_status": prior_status,
        "created_at": time.time(),
        # traceability fields will be backfilled in logs module if request context exists
    }

    log_review_action(record)
    invalidate_cache()  # 立刻刷新聚合缓存
    return record


def undo_arbitration(assertion_key: str, pmid: str, admin_email: str, reason: str = "") -> Dict[str, Any]:
    """
    Append an undo record for prior arbitration. Maintains audit trail instead of deleting.
    """
    latest = get_latest_arbitration(assertion_key, pmid)
    if not latest:
        raise ArbitrationError("No existing arbitration to undo.")

    record = {
        "action": "arbitrate_undo",
        "original_arbitration": latest,
        "assertion_id": assertion_key,   # 兼容
        "assertion_key": assertion_key,
        "pmid": pmid,
        "admin": (admin_email or "").lower(),
        "reason": reason or "",
        "created_at": time.time(),
    }
    log_review_action(record)
    invalidate_cache()
    return record


def get_arbitration_history(assertion_key: str, pmid: str) -> List[Dict[str, Any]]:
    """
    Return full sequence of arbitration-related records (arbitrate + undo) for an assertion lifecycle.
    """
    groups = aggregate_assertions_for_pmid(pmid)
    logs = groups.get(assertion_key, []) or []
    history = [l for l in logs if _norm_action(l.get("action")) in ("arbitrate", "arbitrate_undo")]
    history.sort(key=_ts)
    return history