# backend/models/reviewers.py
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..config import REVIEWERS_JSON, get_logger

logger = get_logger("models.reviewers")

_LOCK = threading.RLock()

# Try Mongo-backed storage; fall back to file when Mongo is unavailable
try:
    from ..models.db import reviewers_col  # type: ignore
except Exception:  # pragma: no cover
    reviewers_col = None  # type: ignore

# ---------------------------------------------------------------------------
# Path helpers (file fallback)
# ---------------------------------------------------------------------------

def _file_path() -> Path:
    env = os.environ.get("MANUAL_REVIEW_REVIEWERS_JSON")
    return Path(env) if env else Path(REVIEWERS_JSON)

def _ensure_file(path: Optional[Path] = None) -> Path:
    p = path or _file_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        p.write_text("[]", encoding="utf-8")
    return p

# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def _normalize_email(email: Any) -> str:
    return (str(email or "").strip().lower())

def _normalize_role(role: Any) -> str:
    r = (str(role or "").strip().lower()) or "reviewer"
    return r if r in ("reviewer", "admin") else "reviewer"

def _normalize_record(r: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "email": _normalize_email(r.get("email")),
        "name": (r.get("name") or "").strip(),
        "active": bool(r.get("active", True)),
        "role": _normalize_role(r.get("role", "reviewer")),
        "note": str(r.get("note", "") or ""),
    }

# ---------------------------------------------------------------------------
# File IO helpers
# ---------------------------------------------------------------------------

def _load_raw_file() -> List[Dict[str, Any]]:
    p = _ensure_file()
    try:
        text = p.read_text(encoding="utf-8")
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception:
        logger.exception("Failed to read reviewers file: %s", str(p))
        return []

def _atomic_write_file(data: List[Dict[str, Any]]) -> None:
    p = _ensure_file()
    tmp_fd, tmp_path = tempfile.mkstemp(prefix="reviewers.", suffix=".tmp", dir=str(p.parent))
    os.close(tmp_fd)
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, p)
    except Exception:
        logger.exception("Failed to write reviewers file atomically: %s", str(p))
        raise
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Mongo helpers
# ---------------------------------------------------------------------------

def _load_raw_db() -> List[Dict[str, Any]]:
    if reviewers_col is None:
        return _load_raw_file()
    try:
        return list(reviewers_col.find({}, {"_id": 0}))
    except Exception:
        return _load_raw_file()

def _write_db(items: List[Dict[str, Any]]) -> None:
    if reviewers_col is None:
        _atomic_write_file(items)
        return
    try:
        # Replace all (small list), using upserts on email to preserve unique index
        for r in items:
            norm = _normalize_record(r)
            if not norm["email"]:
                continue
            reviewers_col.update_one({"email": norm["email"]}, {"$set": norm}, upsert=True)
    except Exception:
        # Fallback to file on failure
        _atomic_write_file(items)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_reviewers() -> List[Dict[str, Any]]:
    with _LOCK:
        raw = _load_raw_db()
        out = [_normalize_record(r) for r in raw if isinstance(r, dict)]
        return out

def save_reviewers(reviewers: List[Dict[str, Any]]) -> None:
    with _LOCK:
        _write_db([_normalize_record(r) for r in reviewers if isinstance(r, dict)])

def get_all_reviewers() -> List[Dict[str, Any]]:
    with _LOCK:
        data = _load_raw_db()
        dedup: Dict[str, Dict[str, Any]] = {}
        for r in data:
            if not isinstance(r, dict):
                continue
            email = _normalize_email(r.get("email"))
            if not email:
                continue
            dedup[email] = _normalize_record(r)
        out = list(dedup.values())
        out.sort(key=lambda r: r.get("email") or "")
        return out

def get_reviewer_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_n = _normalize_email(email)
    if not email_n:
        return None
    if reviewers_col is not None:
        try:
            doc = reviewers_col.find_one({"email": email_n}, {"_id": 0})
            return _normalize_record(doc) if doc else None
        except Exception:
            pass
    with _LOCK:
        for r in _load_raw_file():
            if not isinstance(r, dict):
                continue
            if _normalize_email(r.get("email")) == email_n:
                return _normalize_record(r)
    return None

def add_reviewer(
    email: str,
    name: str,
    active: bool = True,
    role: str = "reviewer",
    note: str = "",
) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        raise ValueError("invalid email")
    rec = _normalize_record({
        "email": email_n, "name": name, "active": active, "role": role, "note": note
    })
    if reviewers_col is not None:
        try:
            reviewers_col.update_one({"email": email_n}, {"$set": rec}, upsert=True)
            return
        except Exception:
            pass
    with _LOCK:
        data = _load_raw_file()
        for r in data:
            if not isinstance(r, dict):
                continue
            if _normalize_email(r.get("email")) == email_n:
                raise ValueError("reviewer already exists")
        data.append(rec)
        _atomic_write_file(data)

def update_reviewer(email: str, fields: Dict[str, Any]) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        raise ValueError("invalid email")

    allowed = {"name", "active", "role", "note"}
    if reviewers_col is not None:
        to_set: Dict[str, Any] = {}
        for k, v in fields.items():
            if k not in allowed:
                continue
            if k == "role":
                to_set[k] = _normalize_role(v)
            elif k == "active":
                to_set[k] = bool(v)
            elif k == "name":
                to_set[k] = (v or "").strip()
            else:
                to_set[k] = str(v if v is not None else "")
        if to_set:
            try:
                reviewers_col.update_one({"email": email_n}, {"$set": to_set}, upsert=False)
                return
            except Exception:
                pass

    with _LOCK:
        data = _load_raw_file()
        found = False
        for r in data:
            if not isinstance(r, dict):
                continue
            if _normalize_email(r.get("email")) == email_n:
                for k, v in fields.items():
                    if k not in allowed:
                        continue
                    if k == "role":
                        r[k] = _normalize_role(v)
                    elif k == "active":
                        r[k] = bool(v)
                    elif k == "name":
                        r[k] = (v or "").strip()
                    else:
                        r[k] = str(v if v is not None else "")
                found = True
                break
        if not found:
            raise ValueError("reviewer not found")
        _atomic_write_file(data)

def delete_reviewer(email: str) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        return
    if reviewers_col is not None:
        try:
            reviewers_col.delete_one({"email": email_n})
            return
        except Exception:
            pass
    with _LOCK:
        data = _load_raw_file()
        new_data = []
        removed = False
        for r in data:
            if not isinstance(r, dict):
                continue
            if _normalize_email(r.get("email")) == email_n:
                removed = True
                continue
            new_data.append(r)
        if removed:
            _atomic_write_file(new_data)