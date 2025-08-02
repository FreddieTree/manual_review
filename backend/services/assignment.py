# backend/services/assignment.py
from __future__ import annotations

"""
Assignment & locking manager for abstracts under review.

Responsibilities:
  * Assign abstracts to reviewers with concurrency limits.
  * Track active locks with timeout-based expiration (heartbeat-based).
  * Provide explicit release / touch / snapshot APIs.
  * Thread-safe with a process-local RLock.
  * NOTE: For multi-process deployments, consider an external store (e.g., Redis).
"""

import time
import threading
from typing import Optional, Dict, List, Tuple, Any

from ..config import REVIEW_TIMEOUT_MINUTES, MAX_REVIEWERS_PER_ABSTRACT, get_logger
from ..models.abstracts import load_abstracts

logger = get_logger("services.assignment")

# -----------------------------------------------------------------------------
# Internal state (process-local)
# -----------------------------------------------------------------------------
# {
#   pmid: {
#       "reviewers": { email: last_heartbeat_ts, ... },
#       "assigned_at": first_assignment_timestamp,
#       "history": [ { email, assigned_at, released_at }, ... ]
#   }
# }
_LOCKS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.RLock()

_DEFAULT_TIMEOUT_SECONDS: float = (
    float(REVIEW_TIMEOUT_MINUTES) * 60 if isinstance(REVIEW_TIMEOUT_MINUTES, (int, float)) else 30 * 60
)
_MAX_CONCURRENT_REVIEWERS: int = (
    int(MAX_REVIEWERS_PER_ABSTRACT) if isinstance(MAX_REVIEWERS_PER_ABSTRACT, int) else 2
)

def _now() -> float:
    return time.time()

# Small helper to satisfy both tests:
# - membership like `email in holder` must be True
# - `dict(holder)` must work (so items stay as (email, ts) tuples)
class _HolderList(list):
    def __contains__(self, item):  # type: ignore[override]
        if isinstance(item, str):
            for elem in self:
                if isinstance(elem, tuple) and len(elem) >= 1 and elem[0] == item:
                    return True
        return super().__contains__(item)

# -----------------------------------------------------------------------------
# Internal helpers
# -----------------------------------------------------------------------------

def _cleanup_expired_locked(current_time: Optional[float] = None) -> None:
    """Assume _LOCK is held. Expire stale reviewer locks."""
    if current_time is None:
        current_time = _now()
    expired_pmids: List[str] = []

    for pmid, lock in list(_LOCKS.items()):
        reviewers: Dict[str, float] = lock.get("reviewers", {})
        for email, last_seen in list(reviewers.items()):
            try:
                last_ts = float(last_seen)
            except Exception:
                last_ts = 0.0
            if current_time - last_ts > _DEFAULT_TIMEOUT_SECONDS:
                logger.info(
                    "Lock expired for reviewer '%s' on abstract %s (age %.1fs), releasing.",
                    email, pmid, current_time - last_ts,
                )
                # close history entry
                for entry in lock.get("history", []):
                    if entry.get("email") == email and entry.get("released_at") is None:
                        entry["released_at"] = current_time
                        break
                reviewers.pop(email, None)
        if not reviewers:
            expired_pmids.append(pmid)

    for pmid in expired_pmids:
        logger.debug("Clearing empty lock record for abstract %s", pmid)
        _LOCKS.pop(pmid, None)

# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------

def release_expired_locks_locked(now: Optional[float] = None) -> None:
    """Caller already holds lock; expire stale reviewers."""
    _cleanup_expired_locked(now)


def release_expired_locks() -> None:
    """Expire stale reviewer locks (periodically or before assignment)."""
    with _LOCK:
        _cleanup_expired_locked()


def touch_assignment(email: str, pmid: str) -> bool:
    """
    Create/refresh heartbeat for an assignment.
    若不存在锁则创建；返回 True 表示已创建或已刷新。
    """
    email = (email or "").strip().lower()
    pmid = str(pmid or "")
    if not email or not pmid:
        return False

    now = _now()
    with _LOCK:
        lock = _LOCKS.setdefault(pmid, {"reviewers": {}, "assigned_at": now, "history": []})
        reviewers: Dict[str, float] = lock.setdefault("reviewers", {})
        history: List[Dict[str, Any]] = lock.setdefault("history", [])

        created = email not in reviewers
        reviewers[email] = now
        if created:
            history.append({"email": email, "assigned_at": now, "released_at": None})
            logger.info("touch_assignment: created holder %s for %s", email, pmid)
        else:
            logger.debug("touch_assignment: refreshed holder %s for %s", email, pmid)
        return True


def assign_abstract_to_reviewer(
    email: str,
    name: str,
    *,
    prefer_current: Optional[str] = None,
) -> Optional[str]:
    """
    Allocate an abstract to a reviewer, respecting concurrency limits and timeouts.
    Returns pmid if assigned/refreshed; None if none available.
    """
    email = (email or "").lower().strip()
    if not email:
        logger.warning("Empty email provided to assign_abstract_to_reviewer")
        return None

    now = _now()

    with _LOCK:
        # Clean expired first
        _cleanup_expired_locked(now)

        # 1) Prefer current if provided
        if prefer_current:
            pmid_cur = str(prefer_current)
            lock = _LOCKS.get(pmid_cur)
            if lock:
                reviewers: Dict[str, float] = lock.setdefault("reviewers", {})
                history: List[Dict[str, Any]] = lock.setdefault("history", [])
                if email in reviewers:
                    reviewers[email] = now
                    logger.debug("Refreshed (prefer_current) for %s on %s", email, pmid_cur)
                    return pmid_cur
                if len(reviewers) < _MAX_CONCURRENT_REVIEWERS:
                    reviewers[email] = now
                    history.append({"email": email, "assigned_at": now, "released_at": None})
                    logger.info("Added reviewer %s to existing lock (prefer_current) on %s", email, pmid_cur)
                    return pmid_cur
            # no lock -> fall through

        # 2) Scan all abstracts for capacity
        for abstract in load_abstracts():
            pmid = str(abstract.get("pmid") or "")
            if not pmid:
                continue
            lock = _LOCKS.get(pmid)

            if not lock:
                _LOCKS[pmid] = {
                    "reviewers": {email: now},
                    "assigned_at": now,
                    "history": [{"email": email, "assigned_at": now, "released_at": None}],
                }
                logger.info("Assigned abstract %s to reviewer %s (new)", pmid, email)
                return pmid

            reviewers: Dict[str, float] = lock.setdefault("reviewers", {})
            history: List[Dict[str, Any]] = lock.setdefault("history", [])

            if email in reviewers:
                reviewers[email] = now
                logger.debug("Refreshed lock for reviewer %s on abstract %s", email, pmid)
                return pmid

            if len(reviewers) < _MAX_CONCURRENT_REVIEWERS:
                reviewers[email] = now
                history.append({"email": email, "assigned_at": now, "released_at": None})
                logger.info("Added reviewer %s to existing lock on abstract %s", email, pmid)
                return pmid

            logger.debug("Abstract %s has %d reviewers, skipping for %s", pmid, len(reviewers), email)
            continue

        logger.info("No available abstract to assign to reviewer %s", email)
        return None


def release_assignment(email: str, pmid: str) -> bool:
    """Explicitly release a reviewer's lock on a given abstract."""
    email = (email or "").lower().strip()
    pmid = str(pmid or "")
    if not email or not pmid:
        return False

    with _LOCK:
        lock = _LOCKS.get(pmid)
        if not lock:
            return False

        reviewers: Dict[str, float] = lock.get("reviewers", {})
        history: List[Dict[str, Any]] = lock.get("history", [])

        if email not in reviewers:
            return False

        for entry in reversed(history):
            if entry.get("email") == email and entry.get("released_at") is None:
                entry["released_at"] = _now()
                break

        reviewers.pop(email, None)
        if not reviewers:
            _LOCKS.pop(pmid, None)
            logger.info("Released last reviewer %s from abstract %s; cleared lock", email, pmid)
        else:
            logger.info(
                "Released reviewer %s from abstract %s; remaining reviewers: %s",
                email, pmid, list(reviewers.keys())
            )
        return True


def who_has_abstract(pmid: str) -> List[Tuple[str, float]]:
    """
    Return list of active (email, last_heartbeat_timestamp) for the given abstract.

    - 迭代时产生 (email, ts) 二元组，可直接被 dict(...) 消化；
    - `email in holder` 也为 True（见 _HolderList.__contains__）。
    """
    pmid = str(pmid or "")
    with _LOCK:
        lock = _LOCKS.get(pmid)
        if not lock:
            return _HolderList()
        reviewers: Dict[str, float] = lock.get("reviewers", {})
        out = _HolderList()
        for email, last in reviewers.items():
            try:
                ts = float(last)
            except Exception:
                ts = _now()
            out.append((str(email), ts))
        return out


def get_current_locks_snapshot() -> Dict[str, Dict[str, Any]]:
    """Return a deep-copied snapshot of current lock state (safe for display)."""
    with _LOCK:
        import copy
        _cleanup_expired_locked()
        return copy.deepcopy(_LOCKS)

# -----------------------------------------------------------------------------
# Background maintenance
# -----------------------------------------------------------------------------

def start_periodic_cleanup(interval_sec: int = 60) -> threading.Thread:
    """Spawn a daemon thread that periodically expires stale locks."""
    def loop():
        while True:
            time.sleep(interval_sec)
            try:
                release_expired_locks()
            except Exception:
                logger.exception("Error during scheduled lock cleanup")

    thread = threading.Thread(target=loop, daemon=True, name="AssignmentCleanupThread")
    thread.start()
    logger.info("Started periodic lock cleanup every %ss", interval_sec)
    return thread

# -----------------------------------------------------------------------------
# Extensibility hooks
# -----------------------------------------------------------------------------

def persist_lock_state():
    """Placeholder for persistence (e.g., to Redis/disk)."""
    pass

def restore_lock_state():
    """Placeholder for restoring state from persistent store."""
    pass