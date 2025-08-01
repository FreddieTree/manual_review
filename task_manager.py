# task_manager.py
"""
Assignment & locking manager for abstracts under review.

Responsibilities:
  * Assign abstracts to reviewers with concurrency limits.
  * Track active locks with timeout-based expiration.
  * Provide explicit release and introspection APIs.
  * Safe for multi-threaded WSGI usage via reentrant locking.
  * Audit trail via history entries.
  * Designed for future pluggable persistence (e.g., Redis/DB).
"""

import time
import threading
import logging
from typing import Optional, Dict, List, Tuple, Any

from config import REVIEW_TIMEOUT_MINUTES, MAX_REVIEWERS_PER_ABSTRACT, LOG_LEVEL

# --- Logger ---------------------------------------------------------------
def get_logger(name: str) -> logging.Logger:
    """
    Centralized logger factory with consistent formatting and level from config.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = "[%(asctime)s] %(levelname)s %(name)s: %(message)s"
        handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))
        logger.addHandler(handler)
    try:
        level = logging.getLevelName(LOG_LEVEL.upper())
    except Exception:
        level = logging.INFO
    logger.setLevel(level)
    logger.propagate = False
    return logger

logger = get_logger(__name__)

# --- Internal state ------------------------------------------------------
# Structure:
# {
#   pmid: {
#       "reviewers": { email: last_heartbeat_ts, ... },
#       "assigned_at": first_assignment_timestamp,
#       "history": [ { email, assigned_at, released_at }, ... ]  # audit trail
#   }
# }
_LOCKS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.RLock()

# Derived constants w/ safe fallback
_DEFAULT_TIMEOUT_SECONDS: float = float(REVIEW_TIMEOUT_MINUTES) * 60 if isinstance(REVIEW_TIMEOUT_MINUTES, (int, float)) else 30 * 60
_MAX_CONCURRENT_REVIEWERS: int = int(MAX_REVIEWERS_PER_ABSTRACT) if isinstance(MAX_REVIEWERS_PER_ABSTRACT, int) else 2


def _now() -> float:
    return time.time()


# --- Internal helpers ----------------------------------------------------
def _cleanup_expired_locked(current_time: Optional[float] = None) -> None:
    """
    Internal: assume _LOCK is held. Expire stale reviewer locks.
    """
    if current_time is None:
        current_time = _now()
    expired_pmids: List[str] = []

    for pmid, lock in list(_LOCKS.items()):
        reviewers: Dict[str, float] = lock.get("reviewers", {})
        for email, last_seen in list(reviewers.items()):
            if current_time - last_seen > _DEFAULT_TIMEOUT_SECONDS:
                logger.info(
                    "Lock expired for reviewer '%s' on abstract %s (age %.1fs), releasing.",
                    email,
                    pmid,
                    current_time - last_seen,
                )
                # update history entry
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


# --- Public API ----------------------------------------------------------
def release_expired_locks_locked(now: Optional[float] = None) -> None:
    """
    Exposed alias: caller already holds lock; expire stale reviewers.
    """
    _cleanup_expired_locked(now)


def release_expired_locks() -> None:
    """
    Expire stale reviewer locks (to be called periodically or before assignment).
    """
    with _LOCK:
        _cleanup_expired_locked()


def assign_abstract_to_reviewer(email: str, name: str) -> Optional[str]:
    """
    Allocate an abstract to a reviewer, respecting concurrency limits and timeouts.

    Returns:
        Assigned pmid string, or None if none available.
    """
    from models import load_abstracts  # lazy import to avoid circular dependency

    email = (email or "").lower().strip()
    if not email:
        logger.warning("Empty email provided to assign_abstract_to_reviewer")
        return None

    now = _now()

    with _LOCK:
        # Clean expired first to free capacity.
        _cleanup_expired_locked(now)

        for abstract in load_abstracts():
            pmid = str(abstract.get("pmid"))
            lock = _LOCKS.get(pmid)

            if not lock:
                # brand new lock
                _LOCKS[pmid] = {
                    "reviewers": {email: now},
                    "assigned_at": now,
                    "history": [
                        {"email": email, "assigned_at": now, "released_at": None}
                    ],
                }
                logger.info("Assigned abstract %s to reviewer %s (new)", pmid, email)
                return pmid

            reviewers: Dict[str, float] = lock.setdefault("reviewers", {})
            history: List[Dict[str, Any]] = lock.setdefault("history", [])

            if email in reviewers:
                # refresh heartbeat
                reviewers[email] = now
                logger.debug("Refreshed lock for reviewer %s on abstract %s", email, pmid)
                return pmid

            if len(reviewers) < _MAX_CONCURRENT_REVIEWERS:
                reviewers[email] = now
                history.append({"email": email, "assigned_at": now, "released_at": None})
                logger.info("Added reviewer %s to existing lock on abstract %s", email, pmid)
                return pmid

            # occupied, skip
            logger.debug("Abstract %s has %d reviewers, skipping for %s", pmid, len(reviewers), email)
            continue

        logger.info("No available abstract to assign to reviewer %s", email)
        return None


def release_assignment(email: str, pmid: str) -> bool:
    """
    Explicitly release a reviewer's lock on a given abstract.

    Returns:
        True if release succeeded, False if nothing to release.
    """
    email = (email or "").lower().strip()
    if not email or not pmid:
        return False

    with _LOCK:
        lock = _LOCKS.get(str(pmid))
        if not lock:
            return False

        reviewers: Dict[str, float] = lock.get("reviewers", {})
        history: List[Dict[str, Any]] = lock.get("history", [])

        if email not in reviewers:
            return False

        # mark release in latest open history entry
        for entry in reversed(history):
            if entry.get("email") == email and entry.get("released_at") is None:
                entry["released_at"] = _now()
                break

        reviewers.pop(email, None)
        if not reviewers:
            _LOCKS.pop(str(pmid), None)
            logger.info("Released last reviewer %s from abstract %s; cleared lock", email, pmid)
        else:
            logger.info("Released reviewer %s from abstract %s; remaining reviewers: %s", email, pmid, list(reviewers.keys()))
        return True


def who_has_abstract(pmid: str) -> List[Tuple[str, float]]:
    """
    Return list of active (email, last_heartbeat_timestamp) holders for the given abstract.
    """
    with _LOCK:
        lock = _LOCKS.get(str(pmid))
        if not lock:
            return []
        reviewers: Dict[str, float] = lock.get("reviewers", {})
        return list(reviewers.items())


def get_current_locks_snapshot() -> Dict[str, Dict[str, Any]]:
    """
    Return a deep-copied snapshot of current lock state (safe for display).
    """
    with _LOCK:
        import copy
        return copy.deepcopy(_LOCKS)


# --- Background maintenance ----------------------------------------------
def start_periodic_cleanup(interval_sec: int = 60) -> threading.Thread:
    """
    Spawn a daemon thread that periodically expires stale locks.
    """
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


# --- Extensibility hooks --------------------------------------------------
def persist_lock_state():
    """
    Hook to persist current in-memory locks (e.g., into Redis or disk) for fault tolerance.
    """
    # Implement if needed
    pass


def restore_lock_state():
    """
    Hook to restore lock state from persistent store if available.
    """
    # Implement if needed
    pass