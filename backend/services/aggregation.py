# backend/services/aggregation.py
from __future__ import annotations

import json
import os
import threading
from collections import defaultdict, Counter
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Iterable

from ..config import REVIEW_LOGS_PATH, FINAL_EXPORT_PATH, get_logger
from ..domain.assertions import make_assertion_id
from ..models.abstracts import get_all_pmids, get_abstract_by_id

logger = get_logger("services.aggregation")

# ---------- Enums ------------------------------------------------------------

class Action(str, Enum):
    ACCEPT = "accept"
    MODIFY = "modify"
    REJECT = "reject"
    UNCERTAIN = "uncertain"
    ADD = "add"
    ARBITRATE = "arbitrate"
    ARBITRATE_UNDO = "arbitrate_undo"

class ConsensusResult(str, Enum):
    CONSENSUS = "consensus"
    CONFLICT = "conflict"
    UNCERTAIN = "uncertain"
    PENDING = "pending"
    ARBITRATED = "arbitrated"

# ---------- Internal state & helpers ----------------------------------------

_log_file_lock = threading.RLock()
_cached_log_mtime: Optional[float] = None
_cached_parsed_logs: Optional[List[Dict[str, Any]]] = None


def _log_path() -> Path:
    """Mirror models.logs._to_path behavior: prefer env var for tests/overrides.
    Fallback to configured REVIEW_LOGS_PATH.
    """
    env_path = os.environ.get("MANUAL_REVIEW_REVIEW_LOGS_PATH")
    return Path(env_path) if env_path else Path(REVIEW_LOGS_PATH)


def _get_log_file_mtime() -> float:
    try:
        p = _log_path()
        return p.stat().st_mtime if p.exists() else 0.0
    except Exception:
        return 0.0


def invalidate_cache() -> None:
    """Invalidate raw log cache and per-PMID aggregation cache."""
    global _cached_log_mtime, _cached_parsed_logs
    with _log_file_lock:
        _cached_log_mtime = None
        _cached_parsed_logs = None
    try:
        aggregate_assertions_for_pmid.cache_clear()  # type: ignore[attr-defined]
    except Exception:
        pass


def _load_raw_logs() -> List[Dict[str, Any]]:
    """Load raw JSONL logs with mtime cache; skip malformed lines."""
    global _cached_log_mtime, _cached_parsed_logs
    with _log_file_lock:
        current_mtime = _get_log_file_mtime()
        if _cached_parsed_logs is not None and _cached_log_mtime == current_mtime:
            return _cached_parsed_logs

        logs: List[Dict[str, Any]] = []
        path = _log_path()
        if not path.exists():
            _cached_log_mtime = current_mtime
            _cached_parsed_logs = logs
            return logs

        try:
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    s = line.strip()
                    if not s:
                        continue
                    try:
                        obj = json.loads(s)
                        if isinstance(obj, dict):
                            logs.append(obj)
                    except json.JSONDecodeError:
                        continue
        except Exception:
            logger.exception("Failed reading logs from %s", str(path))
            logs = []

        _cached_log_mtime = current_mtime
        _cached_parsed_logs = logs
        return logs

# ---------- Normalization & timestamps --------------------------------------

def _norm_action(act: Any) -> str:
    """Normalize action to lowercase string (supports Enum and str)."""
    if act is None:
        return ""
    val = getattr(act, "value", act)
    return str(val).strip().lower()


def _ts(log: Dict[str, Any]) -> float:
    """Prefer created_at, fallback to timestamp; accept numeric strings."""
    for key in ("created_at", "timestamp"):
        v = log.get(key)
        try:
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str) and v.strip():
                return float(v)
        except Exception:
            continue
    return 0.0

# ---------- Grouping ---------------------------------------------------------

def _content_key(log: Dict[str, Any]) -> str:
    """Generate stable content key (empty string if fields missing)."""
    return make_assertion_id(
        log.get("subject", ""),
        log.get("subject_type", ""),
        log.get("predicate", ""),
        log.get("object", ""),
        log.get("object_type", ""),
    )


def _group_logs_for_pmid_ordered(pmid: str, logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Time-ordered grouping algorithm:
      1) If 'related_to' is present -> group by that id
      2) Else if 'assertion_id' is present -> group by that id
      3) Else if action == add -> group by content key and update last_add_key
      4) For other actions without ids:
          - If content fields exist -> use content key
          - Else if last_add_key exists -> group to last_add_key
          - Else fallback to content key (may be empty)

    This keeps accepts/rejects without assertion_id attached to the latest prior add,
    preventing unrelated assertions from merging under empty keys.
    """
    pmid_s = str(pmid)
    filt = [l for l in logs if str(l.get("pmid")) == pmid_s]
    # Sort by time ascending
    filt.sort(key=_ts)

    agg: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    last_add_key: Optional[str] = None

    for log in filt:
        action = _norm_action(log.get("action"))
        rid = (log.get("related_to") or "").strip()
        aid = (log.get("assertion_id") or "").strip()

        ch = (log.get("content_hash") or "").strip()
        if ch:
            key = ch
        elif rid:
            key = rid
        elif aid:
            key = aid
        else:
            if action == Action.ADD.value:
                key = _content_key(log)
                last_add_key = key or last_add_key
            else:
                # Do we have enough content to compute a key?
                has_content = any(log.get(k) for k in ("subject", "predicate", "object"))
                if has_content:
                    key = _content_key(log)
                elif last_add_key:
                    key = last_add_key
                else:
                    # 最保守兜底：仍用内容 key（可能为空串，但此时无 add 在前，影响极小）
                    key = _content_key(log)

        agg[key].append(log)

        # Only update last_add_key for true 'add' actions
        if action == Action.ADD.value and key:
            last_add_key = key

    return agg


def _group_logs_by_assertion(pmid: str, logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Public entrypoint that wraps the ordered grouping."""
    return _group_logs_for_pmid_ordered(pmid, logs)

# ---------- Consensus Logic --------------------------------------------------

def consensus_decision(
    logs: List[Dict[str, Any]],
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2,
) -> ConsensusResult:
    """Consensus for a single assertion:
      1. If any arbitrate -> ARBITRATED
      2. If reject/uncertain exist -> UNCERTAIN if all uncertain else CONFLICT
      3. If only accept/modify -> CONSENSUS if support >= threshold; when exact-match required and multiple modify disagree -> CONFLICT
      4. Otherwise -> UNCERTAIN or PENDING
    """
    if not logs:
        return ConsensusResult.PENDING

    if any(_norm_action(l.get("action")) == Action.ARBITRATE.value for l in logs):
        return ConsensusResult.ARBITRATED

    allowed = {
        Action.ACCEPT.value,
        Action.MODIFY.value,
        Action.REJECT.value,
        Action.UNCERTAIN.value,
    }
    review_actions = [_norm_action(l.get("action")) for l in logs if _norm_action(l.get("action")) in allowed]

    if not review_actions:
        return ConsensusResult.PENDING

    counter = Counter(review_actions)

    if counter.get(Action.REJECT.value, 0) > 0 or counter.get(Action.UNCERTAIN.value, 0) > 0:
        if counter.get(Action.UNCERTAIN.value, 0) == len(review_actions) and counter.get(Action.REJECT.value, 0) == 0:
            return ConsensusResult.UNCERTAIN
        return ConsensusResult.CONFLICT

    # Require decisions from distinct reviewers for consensus
    support_reviewers = set()
    for l in logs:
        act = _norm_action(l.get("action"))
        if act in (Action.ACCEPT.value, Action.MODIFY.value):
            who = (l.get("creator") or l.get("reviewer") or "").strip().lower()
            if who:
                support_reviewers.add(who)

    if len(support_reviewers) >= min_reviewers_for_consensus:
        if require_exact_content_match:
            modify_logs = [l for l in logs if _norm_action(l.get("action")) == Action.MODIFY.value]
            if len(modify_logs) > 1:
                contents = {
                    (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    for l in modify_logs
                }
                if len(contents) > 1:
                    return ConsensusResult.CONFLICT
        return ConsensusResult.CONSENSUS

    # Not enough distinct reviewers yet -> pending
    return ConsensusResult.PENDING

# ---------- Public API ------------------------------------------------------

@lru_cache(maxsize=128)
def aggregate_assertions_for_pmid(pmid: str) -> Dict[str, List[Dict[str, Any]]]:
    """Aggregate logs for a PMID by lifecycle key (ordered algorithm)."""
    logs = _load_raw_logs()
    return _group_logs_by_assertion(pmid, logs)


def get_detailed_assertion_summary(
    pmid: str,
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2,
) -> List[Dict[str, Any]]:
    """Return for each assertion:
      - consensus_status
      - support_counts
      - last_updated
      - reviewers
      - logs
      - conflict_reason (if applicable)
    """
    agg = aggregate_assertions_for_pmid(pmid)
    summary: List[Dict[str, Any]] = []
    for assertion_key, logs in agg.items():
        status = consensus_decision(
            logs,
            require_exact_content_match=require_exact_content_match,
            min_reviewers_for_consensus=min_reviewers_for_consensus,
        )
        actions = [_norm_action(l.get("action")) for l in logs if l.get("action") is not None]
        counter = Counter(actions)
        last = max((_ts(l) for l in logs), default=0.0)
        reviewers = sorted({
            (l.get("creator") or l.get("reviewer") or "").lower()
            for l in logs if (l.get("creator") or l.get("reviewer"))
        })
        item: Dict[str, Any] = {
            "assertion_key": assertion_key,
            "consensus_status": status.value,
            "support_counts": dict(counter),
            "last_updated": last,
            "reviewers": reviewers,
            "logs": sorted(logs, key=_ts),
        }
        if status == ConsensusResult.CONFLICT:
            reasons = []
            if counter.get(Action.REJECT.value, 0) > 0:
                reasons.append("contains reject")
            if counter.get(Action.UNCERTAIN.value, 0) > 0:
                reasons.append("contains uncertain")
            if counter.get(Action.MODIFY.value, 0) > 1 and require_exact_content_match:
                modify_logs = [l for l in logs if _norm_action(l.get("action")) == Action.MODIFY.value]
                contents = {
                    (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    for l in modify_logs
                }
                if len(contents) > 1:
                    reasons.append("modify content mismatch")
            item["conflict_reason"] = "; ".join(reasons) if reasons else "mixed signals"
        summary.append(item)
    return summary


def _pmids_from_logs(logs: Iterable[Dict[str, Any]]) -> List[str]:
    """Collect distinct PMIDs from raw logs."""
    out: List[str] = []
    seen = set()
    for l in logs:
        pid = str(l.get("pmid") or "").strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append(pid)
    return out


def find_assertion_conflicts(pmid: Optional[str] = None) -> List[Dict[str, Any]]:
    """List current conflicted assertions (excluding arbitrated).
    - If pmid specified: check only that pmid
    - Else: union of PMIDs from abstracts and logs using same grouping/decision logic
    """
    raw = _load_raw_logs()
    if pmid is not None:
        targets = [str(pmid)]
    else:
        pmids_abs = list(get_all_pmids())
        pmids_logs = _pmids_from_logs(raw)
        targets = list({*pmids_abs, *pmids_logs})

    conflicts: List[Dict[str, Any]] = []
    for pid in targets:
        agg = _group_logs_for_pmid_ordered(pid, raw)
        for key, logs in agg.items():
            status = consensus_decision(logs)
            if status == ConsensusResult.CONFLICT:
                conflicts.append({
                    "pmid": pid,
                    "assertion_key": key,
                    "logs": sorted(logs, key=_ts),
                    "status": status.value,
                })
    return conflicts


def aggregate_final_decisions_for_pmid(pmid: str) -> List[Dict[str, Any]]:
    """Return final decisions (consensus or arbitrated) per assertion using the last log as authoritative snapshot."""
    detailed = get_detailed_assertion_summary(pmid)
    finals: List[Dict[str, Any]] = []
    for item in detailed:
        status = item.get("consensus_status")
        if status in (ConsensusResult.CONSENSUS.value, ConsensusResult.ARBITRATED.value):
            final_log = item["logs"][ -1 ] if item.get("logs") else {}
            record = {
                **final_log,
                "final_decision": status,
                "support_counts": item.get("support_counts", {}),
                "reviewers": item.get("reviewers", []),
                "last_updated": item.get("last_updated", 0),
                "assertion_key": item.get("assertion_key"),
            }
            finals.append(record)
    return finals

# ---------- Export / Overview ------------------------------------------------

def build_export_abstract(pmid: str) -> Optional[Dict[str, Any]]:
    """Build one export-ready abstract object matching the input JSONL shape.
    - Use DB abstract as base (normalized to sentence_results)
    - Keep only assertions with final consensus/arbitrated decisions
      (via DB flags if present, else via logs-based finals content match)
    """
    abs_obj = get_abstract_by_id(pmid)
    if not abs_obj:
        return None

    # Build a set of tuples for finals from logs
    finals_logs = aggregate_final_decisions_for_pmid(pmid)
    finals_keys = set()
    for fl in finals_logs:
        try:
            si = int(fl.get("sentence_idx") or fl.get("sentence_index") or -1)
        except Exception:
            si = -1
        tpl = (
            str(fl.get("subject") or "").strip(),
            str(fl.get("subject_type") or "").strip(),
            str(fl.get("predicate") or "").strip(),
            str(fl.get("object") or "").strip(),
            str(fl.get("object_type") or "").strip(),
            bool(fl.get("negation", False)),
            si,
        )
        finals_keys.add(tpl)

    # Filter assertions within sentence_results
    sr = abs_obj.get("sentence_results") or []
    new_sr: List[Dict[str, Any]] = []
    for idx, s in enumerate(sr, 1):
        assertions = s.get("assertions") or []
        kept: List[Dict[str, Any]] = []
        for a in assertions:
            # Prefer DB flags if present
            if a.get("final_status") == "consensus" and a.get("final_decision") in ("accept", "add"):
                kept.append(a)
                continue
            # Else fallback to logs-based finals match
            tpl = (
                str(a.get("subject") or "").strip(),
                str(a.get("subject_type") or "").strip(),
                str(a.get("predicate") or "").strip(),
                str(a.get("object") or "").strip(),
                str(a.get("object_type") or "").strip(),
                bool(a.get("negation", False)),
                int(s.get("sentence_index") or idx),
            )
            if tpl in finals_keys:
                kept.append(a)
        new_sr.append({ **s, "assertions": kept })

    abs_obj["sentence_results"] = new_sr
    # Maintain sentence_count
    abs_obj["sentence_count"] = len(new_sr)
    # Remove any transient DB/internal fields if present
    try:
        abs_obj.pop("_id", None)
    except Exception:
        pass
    return abs_obj


def export_final_consensus(out_path: Optional[str | Path] = None) -> tuple[int, Path]:
    """Export all PMIDs' final decisions to JSONL (one line per abstract)."""
    raw = _load_raw_logs()
    # Authority is DB; union with logs for completeness
    try:
        pmids = list({*get_all_pmids(), *_pmids_from_logs(raw)})
    except Exception:
        pmids = _pmids_from_logs(raw)

    path = Path(out_path or FINAL_EXPORT_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with path.open("w", encoding="utf-8") as f:
        for pid in pmids:
            obj = build_export_abstract(pid)
            if not obj:
                continue
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
            written += 1

    logger.info("Exported %d abstracts with final consensus to %s", written, str(path))
    return written, path


def export_summary_to_json(pmid: str, out_path: str) -> bool:
    """Export a detailed assertion summary for a PMID to a JSON file."""
    try:
        summary = get_detailed_assertion_summary(pmid)
        Path(os.path.dirname(out_path) or ".").mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        logger.exception("Failed to export summary for %s -> %s", pmid, out_path)
        return False


def get_conflict_overview() -> Dict[str, Any]:
    """Summarize conflict overview: total PMIDs, conflicts per PMID, and total conflicts.
    PMIDs come from the union of abstracts and logs.
    """
    raw = _load_raw_logs()
    pmids = list({*get_all_pmids(), *_pmids_from_logs(raw)})

    over: Dict[str, Any] = {
        "total_pmids": len(pmids),
        "conflicts": 0,
        "per_pmid": {},
        "generated_at": int(_get_log_file_mtime()),
    }
    total_conflicts = 0
    for pid in pmids:
        agg = aggregate_assertions_for_pmid(pid)  # 复用缓存友好的聚合
        cnt = sum(1 for ls in agg.values() if consensus_decision(ls) == ConsensusResult.CONFLICT)
        over["per_pmid"][pid] = cnt
        total_conflicts += cnt
    over["conflicts"] = total_conflicts
    return over