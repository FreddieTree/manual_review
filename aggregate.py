# src/aggregate.py

import json
import os
import threading
from collections import defaultdict, Counter
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from config import REVIEW_LOGS_PATH
from assertion_utils import make_assertion_id

# ---------- Enums ------------------------------------------------------------

class Action(str, Enum):
    ACCEPT = "accept"
    MODIFY = "modify"
    REJECT = "reject"
    UNCERTAIN = "uncertain"
    ADD = "add"
    ARBITRATE = "arbitrate"

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

def _get_log_file_mtime() -> float:
    try:
        return Path(REVIEW_LOGS_PATH).stat().st_mtime
    except Exception:
        return 0.0

def _load_raw_logs() -> List[Dict[str, Any]]:
    """
    Load and parse review logs from disk, with naive caching keyed by file modification time.
    """
    global _cached_log_mtime, _cached_parsed_logs
    with _log_file_lock:
        current_mtime = _get_log_file_mtime()
        if _cached_parsed_logs is not None and _cached_log_mtime == current_mtime:
            return _cached_parsed_logs  # reuse cached

        logs: List[Dict[str, Any]] = []
        if not os.path.exists(REVIEW_LOGS_PATH):
            _cached_log_mtime = current_mtime
            _cached_parsed_logs = logs
            return logs

        try:
            with open(REVIEW_LOGS_PATH, "r", encoding="utf-8") as f:
                for line_no, line in enumerate(f, start=1):
                    if not line.strip():
                        continue
                    try:
                        log = json.loads(line)
                        logs.append(log)
                    except json.JSONDecodeError:
                        # skip malformed line but record for debugging
                        # Could emit to a monitoring system instead
                        continue
        except Exception:
            # on failure, fall back to empty list
            logs = []

        _cached_log_mtime = current_mtime
        _cached_parsed_logs = logs
        return logs

def _group_logs_by_assertion(pmid: str, logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group logs for a given PMID by assertion key. Uses assertion_id if present, else synthetic key.
    """
    agg: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for log in logs:
        if str(log.get("pmid")) != str(pmid):
            continue
        key = log.get("assertion_id")
        if not key:
            key = make_assertion_id(
                log.get("subject", ""),
                log.get("subject_type", ""),
                log.get("predicate", ""),
                log.get("object", ""),
                log.get("object_type", ""),
            )
        agg[key].append(log)
    return agg

# ---------- Consensus Logic --------------------------------------------------

def consensus_decision(
    logs: List[Dict[str, Any]],
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2,
) -> ConsensusResult:
    """
    Determine consensus status for a single assertion based on collected logs.
    Priority:
      1. Arbitration overrides all.
      2. If majority of NON-conflicting accept/modify reviews meet threshold and no reject/uncertain -> CONSENSUS.
      3. Mixed signals with reject/uncertain -> CONFLICT (unless all uncertain -> UNCERTAIN).
      4. Insufficient input -> PENDING / UNCERTAIN.
    """
    if not logs:
        return ConsensusResult.PENDING

    # Arbitration wins
    for log in logs:
        if log.get("action") == Action.ARBITRATE:
            return ConsensusResult.ARBITRATED

    # Extract review actions
    review_actions = []
    for log in logs:
        act = log.get("action")
        if act in {Action.ACCEPT, Action.MODIFY, Action.REJECT, Action.UNCERTAIN}:
            review_actions.append(act)

    if not review_actions:
        return ConsensusResult.PENDING

    counter = Counter(review_actions)

    # Presence of rejects or uncertain among multiple reviewers causes conflict/uncertain
    if counter.get(Action.REJECT, 0) > 0 or counter.get(Action.UNCERTAIN, 0) > 0:
        # All uncertain (no rejects) -> mark uncertain
        if counter.get(Action.UNCERTAIN, 0) >= len(review_actions) and counter.get(Action.REJECT, 0) == 0:
            return ConsensusResult.UNCERTAIN
        return ConsensusResult.CONFLICT

    # Only accept/modify remain
    support = counter.get(Action.ACCEPT, 0) + counter.get(Action.MODIFY, 0)
    if support >= min_reviewers_for_consensus:
        if require_exact_content_match:
            # If multiple modify logs differ in content, escalate to conflict
            modify_logs = [l for l in logs if l.get("action") == Action.MODIFY]
            if len(modify_logs) > 1:
                contents = set()
                for l in modify_logs:
                    snapshot = (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    contents.add(snapshot)
                if len(contents) > 1:
                    return ConsensusResult.CONFLICT
        return ConsensusResult.CONSENSUS

    # Not enough support -> uncertain
    return ConsensusResult.UNCERTAIN

# ---------- Public API ------------------------------------------------------

@lru_cache(maxsize=128)
def aggregate_assertions_for_pmid(pmid: str, refresh: bool = False) -> Dict[str, List[Dict[str, Any]]]:
    """
    Aggregate logs for a given PMID, grouped by assertion key.
    Caching is memoized, refresh=True invalidates via a sentinel (ignored for simplicity because _load_raw_logs uses mtime).
    """
    logs = _load_raw_logs()
    return _group_logs_by_assertion(pmid, logs)

def get_detailed_assertion_summary(
    pmid: str,
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2
) -> List[Dict[str, Any]]:
    """
    Returns annotated assertion summaries for a PMID:
      - consensus_status
      - support_counts
      - last_updated timestamp
      - involved reviewers
      - full sorted log history
      - conflict_reason (if applicable)
    """
    agg = aggregate_assertions_for_pmid(pmid)
    summary: List[Dict[str, Any]] = []
    for assertion_id, logs in agg.items():
        status = consensus_decision(
            logs,
            require_exact_content_match=require_exact_content_match,
            min_reviewers_for_consensus=min_reviewers_for_consensus,
        )
        actions = [l.get("action") for l in logs if l.get("action")]
        counter = Counter(actions)
        last = max(
            (l.get("created_at", 0) for l in logs if isinstance(l.get("created_at", 0), (int, float))),
            default=0,
        )
        reviewers = sorted({(l.get("creator") or l.get("reviewer") or "").lower() for l in logs if (l.get("creator") or l.get("reviewer"))})
        item: Dict[str, Any] = {
            "assertion_id": assertion_id,
            "consensus_status": status.value,
            "support_counts": dict(counter),
            "last_updated": last,
            "reviewers": reviewers,
            "logs": sorted(logs, key=lambda x: x.get("created_at", 0)),
        }
        if status == ConsensusResult.CONFLICT:
            # Provide brief reason summary
            reasons = []
            if counter.get(Action.REJECT, 0) > 0:
                reasons.append("contains reject")
            if counter.get(Action.UNCERTAIN, 0) > 0:
                reasons.append("contains uncertain")
            if counter.get(Action.MODIFY, 0) > 1 and require_exact_content_match:
                # inspect modify divergence
                modify_logs = [l for l in logs if l.get("action") == Action.MODIFY]
                contents = set()
                for l in modify_logs:
                    snapshot = (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    contents.add(snapshot)
                if len(contents) > 1:
                    reasons.append("modify content mismatch")
            item["conflict_reason"] = "; ".join(reasons) if reasons else "mixed signals";
        summary.append(item)
    return summary

def find_assertion_conflicts(pmid: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List assertions currently in conflict (excluding those already arbitrated).
    If pmid is provided restrict to that abstract.
    """
    from models import get_all_pmids

    targets = [str(pmid)] if pmid else list(get_all_pmids())
    conflicts: List[Dict[str, Any]] = []
    for pid in targets:
        agg = aggregate_assertions_for_pmid(pid)
        for assertion_id, logs in agg.items():
            status = consensus_decision(logs)
            if status == ConsensusResult.CONFLICT:
                conflicts.append({
                    "pmid": pid,
                    "assertion_id": assertion_id,
                    "logs": sorted(logs, key=lambda x: x.get("created_at", 0)),
                    "status": status.value,
                })
    return conflicts

def aggregate_final_decisions_for_pmid(pmid: str) -> List[Dict[str, Any]]:
    """
    Return final resolved assertions for a PMID: those with consensus or arbitration.
    Last log for each assertion is taken as authoritative.
    """
    detailed = get_detailed_assertion_summary(pmid)
    finals: List[Dict[str, Any]] = []
    for item in detailed:
        status = item.get("consensus_status")
        if status in (ConsensusResult.CONSENSUS.value, ConsensusResult.ARBITRATED.value):
            final_log = item["logs"][-1] if item.get("logs") else {}
            record = {
                **final_log,
                "final_decision": status,
                "support_counts": item.get("support_counts", {}),
                "reviewers": item.get("reviewers", []),
                "last_updated": item.get("last_updated", 0),
            }
            finals.append(record)
    return finals

# ---------- Export / Overview ------------------------------------------------

def export_summary_to_json(pmid: str, out_path: str) -> bool:
    """
    Export detailed assertion summary for pmid to a JSON file.
    """
    try:
        summary = get_detailed_assertion_summary(pmid)
        Path(os.path.dirname(out_path) or ".").mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False

def get_conflict_overview() -> Dict[str, Any]:
    """
    Aggregate high-level conflict metrics across all PMIDs.
    Returns structure with per-pmid counts and total.
    """
    from models import get_all_pmids

    pmids = list(get_all_pmids())
    overview: Dict[str, Any] = {
        "total_pmids": len(pmids),
        "conflicts": 0,
        "per_pmid": {},
        "generated_at": int(os.path.getmtime(REVIEW_LOGS_PATH) or 0),
    }
    total_conflicts = 0
    for pid in pmids:
        conflicts = find_assertion_conflicts(pid)
        overview["per_pmid"][pid] = len(conflicts)
        total_conflicts += len(conflicts)
    overview["conflicts"] = total_conflicts
    return overview