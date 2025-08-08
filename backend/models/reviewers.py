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

# ---------------------------------------------------------------------------
# Path helpers (dynamic read to adapt to test fixtures/runtime temp dirs)
# ---------------------------------------------------------------------------

def _file_path() -> Path:
    """Prefer MANUAL_REVIEW_REVIEWERS_JSON; otherwise fallback to config.REVIEWERS_JSON."""
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
# IO helpers
# ---------------------------------------------------------------------------

def _load_raw() -> List[Dict[str, Any]]:
    """Read reviewers list. Create empty file if missing.
    Return empty list on bad structure/lines and log the error.
    """
    p = _ensure_file()
    try:
        text = p.read_text(encoding="utf-8")
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception:
        logger.exception("Failed to read reviewers file: %s", str(p))
        return []

def _atomic_write(data: List[Dict[str, Any]]) -> None:
    """Atomic write using same-dir temp file -> flush+fsync -> os.replace."""
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
# Public API
# ---------------------------------------------------------------------------

def load_reviewers() -> List[Dict[str, Any]]:
    """Return normalized reviewers list."""
    with _LOCK:
        raw = _load_raw()
        out = [_normalize_record(r) for r in raw if isinstance(r, dict)]
        return out

def save_reviewers(reviewers: List[Dict[str, Any]]) -> None:
    """Overwrite reviewers file (normalizes the input first)."""
    with _LOCK:
        _atomic_write([_normalize_record(r) for r in reviewers if isinstance(r, dict)])

def get_all_reviewers() -> List[Dict[str, Any]]:
    """Return deduplicated reviewers (keyed by email; last write wins), sorted by email."""
    with _LOCK:
        data = _load_raw()
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
    with _LOCK:
        for r in _load_raw():
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
    with _LOCK:
        data = _load_raw()
        # 冲突检查
        for r in data:
            if not isinstance(r, dict):
                continue
            if _normalize_email(r.get("email")) == email_n:
                raise ValueError("reviewer already exists")
        data.append(rec)
        _atomic_write(data)

def update_reviewer(email: str, fields: Dict[str, Any]) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        raise ValueError("invalid email")

    allowed = {"name", "active", "role", "note"}
    with _LOCK:
        data = _load_raw()
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
        _atomic_write(data)

def delete_reviewer(email: str) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        return
    with _LOCK:
        data = _load_raw()
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
            _atomic_write(new_data)