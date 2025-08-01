# src/arbitration.py

import time
import json
import threading
import logging
from typing import List, Optional, Dict, Any, Literal

from config import REVIEW_LOGS_PATH
from aggregate import (
    find_assertion_conflicts,
    aggregate_assertions_for_pmid,
    consensus_decision,
    ConsensusResult,
)
from models import get_abstract_by_id

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# protect concurrent writes in typical WSGI/multi-threaded environments
_WRITE_LOCK = threading.RLock()

# Allowed decisions for arbitration (expanded for clarity)
ArbitrateDecision = Literal["accept", "modify", "reject", "uncertain"]

class ArbitrationError(Exception):
    """Custom error for arbitration-related invalid operations."""
    pass


def _safe_append_log(record: Dict[str, Any]) -> None:
    """
    Append a log record to the central review log file in a thread-safe manner.
    """
    with _WRITE_LOCK:
        try:
            with open(REVIEW_LOGS_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
            logger.debug("Appended arbitration log: %s", record.get("assertion_id"))
        except Exception as e:
            logger.exception("Failed to append arbitration log: %s", e)
            raise ArbitrationError(f"Failed to persist arbitration record: {e}")


def get_arbitration_queue(
    pmid: Optional[str] = None,
    only_conflicts: bool = True,
    include_pending: bool = False,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve assertions needing arbitration.

    Args:
      pmid: filter by specific abstract.
      only_conflicts: if True, only return those currently in 'conflict' state.
      include_pending: if True, also include assertions with pending/uncertain status for proactive arbitration.
      limit: optionally cap number of returned items.

    Returns:
      List of dicts with keys: pmid, assertion_id, logs, status, conflict_reason (if any)
    """
    queue = []
    target_pmid_list = [str(pmid)] if pmid else None

    # Acquire raw candidate set
    if only_conflicts:
        raw = find_assertion_conflicts(pmid)
    else:
        # build from summaries, include uncertain/pending if requested
        raw = []
        from aggregate import get_detailed_assertion_summary
        targets = target_pmid_list if target_pmid_list else list({str(p) for p in __import__("models").models.get_all_pmids()})  # fallback
        for pid in targets:
            detailed = get_detailed_assertion_summary(pid)
            for item in detailed:
                status = item.get("consensus_status")
                if status == ConsensusResult.CONFLICT.value or (include_pending and status in (ConsensusResult.UNCERTAIN.value, ConsensusResult.PENDING.value)):
                    raw.append({
                        "pmid": pid,
                        "assertion_id": item["assertion_id"],
                        "logs": item.get("logs", []),
                        "status": status,
                        "support_counts": item.get("support_counts", {}),
                        "conflict_reason": item.get("conflict_reason"),
                    })

    # Optionally trim / sort: conflicts first, then oldest updated
    def sort_key(item: Dict[str, Any]):
        logs = item.get("logs", [])
        last_update = max((l.get("created_at", 0) for l in logs), default=0)
        return (0 if item.get("status") == ConsensusResult.CONFLICT.value else 1, last_update)

    queue = sorted(raw, key=sort_key)
    if limit:
        queue = queue[:limit]
    return queue


def set_arbitration_result(
    pmid: str,
    assertion_id: str,
    decision: ArbitrateDecision,
    admin_email: str,
    comment: str = "",
    overwrite: bool = False
) -> Dict[str, Any]:
    """
    Resolve a conflicted assertion by recording an arbitration decision.

    Args:
      pmid: the abstract identifier.
      assertion_id: ID (or synthetic key) of the assertion under arbitration.
      decision: one of "accept", "modify", "reject", "uncertain".
      admin_email: who performed the arbitration.
      comment: optional rationale for audit.
      overwrite: if False, and an existing active arbitration exists, prevents duplicate.

    Returns:
      The arbitration record that was appended.

    Raises:
      ArbitrationError: on invalid inputs or state conflicts.
    """
    normalized = decision.lower()
    if normalized not in {"accept", "modify", "reject", "uncertain"}:
        raise ArbitrationError(f"Unsupported arbitration decision: {decision}")

    # Validate abstract existence
    abs_obj = get_abstract_by_id(pmid)
    if not abs_obj:
        raise ArbitrationError(f"Abstract with PMID {pmid} not found.")

    # Check current conflict status
    current_conflicts = find_assertion_conflicts(pmid)
    existing_conflict = next((c for c in current_conflicts if c["assertion_id"] == assertion_id), None)
    if existing_conflict is None and not overwrite:
        raise ArbitrationError(f"Assertion {assertion_id} for PMID {pmid} is not flagged as conflict and overwrite is False.")

    # Prevent duplicate arbitration if same decision already most recent (idempotency)
    latest = get_latest_arbitration(assertion_id, pmid)
    if latest and latest.get("arbitrate_decision") == normalized and not overwrite:
        logger.info("Skipping redundant arbitration for %s on %s with same decision", assertion_id, pmid)
        return latest  # no-op

    # Build arbitration record
    prior_status = "unknown"
    try:
        agg = aggregate_assertions_for_pmid(pmid)
        prior_logs = agg.get(assertion_id, [])
        prior_status = consensus_decision(prior_logs).value if prior_logs else ConsensusResult.PENDING.value
    except Exception:
        logger.exception("Failed to derive prior consensus status during arbitration")

    record: Dict[str, Any] = {
        "action": "arbitrate",
        "arbitrate_decision": normalized,
        "assertion_id": assertion_id,
        "pmid": pmid,
        "admin": admin_email,
        "comment": comment,
        "prior_consensus_status": prior_status,
        "created_at": time.time(),
    }

    _safe_append_log(record)

    # Optional extension hooks (e.g., notifications, metrics)
    # _post_arbitration_hook(assertion_id, pmid, normalized, admin_email)

    return record


def get_latest_arbitration(assertion_id: str, pmid: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve the most recent arbitration entry for a given assertion.
    """
    agg = aggregate_assertions_for_pmid(pmid)
    logs = agg.get(assertion_id, []) or []
    arb_entries = [l for l in logs if l.get("action") == "arbitrate"]
    if not arb_entries:
        return None
    # Stable sort by timestamp
    latest = max(arb_entries, key=lambda x: x.get("created_at", 0))
    return latest


def undo_arbitration(assertion_id: str, pmid: str, admin_email: str, reason: str = "") -> Dict[str, Any]:
    """
    Append an undo record for prior arbitration. Maintains audit trail instead of deleting.
    """
    latest = get_latest_arbitration(assertion_id, pmid)
    if not latest:
        raise ArbitrationError("No existing arbitration to undo.")

    record = {
        "action": "arbitrate_undo",
        "original_arbitration": latest,
        "assertion_id": assertion_id,
        "pmid": pmid,
        "admin": admin_email,
        "reason": reason,
        "created_at": time.time(),
    }
    _safe_append_log(record)
    return record


def get_arbitration_history(assertion_id: str, pmid: str) -> List[Dict[str, Any]]:
    """
    Return full sequence of arbitration-related records (arbitrate + undo) for an assertion.
    """
    agg = aggregate_assertions_for_pmid(pmid)
    logs = agg.get(assertion_id, []) or []
    history = [l for l in logs if l.get("action") in ("arbitrate", "arbitrate_undo")]
    return sorted(history, key=lambda x: x.get("created_at", 0))