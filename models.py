# models.py
import json
import os
import tempfile
import threading
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime
from functools import lru_cache

from config import ABSTRACTS_PATH, REVIEW_LOGS_PATH, REVIEWERS_JSON
from utils import normalize_str, coerce_bool, is_valid_email  # assumes these exist

# ---- Exceptions ------------------------------------------------------------
class ModelError(Exception):
    """Base exception for model-level errors."""
    pass

class NotFoundError(ModelError):
    pass

class ConflictError(ModelError):
    pass

class ValidationError(ModelError):
    pass

# ---- Internal utilities ----------------------------------------------------
def _ensure_dir(path: str) -> None:
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)

def _atomic_write_jsonl(path: str, record: Dict[str, Any]) -> None:
    """
    Append a JSON line safely. Does not truncate existing data.
    """
    _ensure_dir(path)
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:
        raise ModelError(f"Failed to append to jsonl {path}: {e}") from e

def _safe_load_jsonl(path: str) -> List[Dict[str, Any]]:
    """
    Load JSONL file, skipping malformed lines. Never raises unless catastrophic.
    """
    items: List[Dict[str, Any]] = []
    if not os.path.exists(path):
        return items
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                    if isinstance(obj, dict):
                        items.append(obj)
                except json.JSONDecodeError:
                    # skip malformed line
                    continue
    except Exception:
        # fallback to empty list
        return []
    return items

# ---- Abstracts caching/loading ---------------------------------------------
_abstracts_cache: Optional[List[Dict[str, Any]]] = None
_abstracts_last_mtime: float = 0.0
_abstracts_lock = threading.RLock()

def load_abstracts(force_reload: bool = False) -> List[Dict[str, Any]]:
    """
    Load abstracts from disk with caching. Ensures shape integrity.
    If force_reload=True, bypasses cache.
    """
    global _abstracts_cache, _abstracts_last_mtime
    try:
        mtime = os.path.getmtime(ABSTRACTS_PATH)
    except FileNotFoundError:
        raise NotFoundError(f"Abstracts file not found: {ABSTRACTS_PATH}")

    with _abstracts_lock:
        if force_reload or _abstracts_cache is None or mtime != _abstracts_last_mtime:
            abstracts: List[Dict[str, Any]] = []
            try:
                with open(ABSTRACTS_PATH, "r", encoding="utf-8") as f:
                    for line in f:
                        if not line.strip():
                            continue
                        try:
                            a = json.loads(line)
                        except json.JSONDecodeError:
                            continue  # skip bad line
                        # normalize shape defensively
                        if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
                            a["sentence_results"] = []
                        for s in a["sentence_results"]:
                            if "assertions" not in s or not isinstance(s["assertions"], list):
                                s["assertions"] = []
                        abstracts.append(a)
                _abstracts_cache = abstracts
                _abstracts_last_mtime = mtime
            except Exception as e:
                raise ModelError(f"Failed to load abstracts from {ABSTRACTS_PATH}: {e}") from e
        return _abstracts_cache  # type: ignore

def get_abstract_by_id(abs_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single abstract by PMID. Returns None if not found.
    """
    target = str(abs_id)
    for a in load_abstracts():
        if str(a.get("pmid")) == target:
            # defensive shape
            if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
                a["sentence_results"] = []
            for s in a["sentence_results"]:
                if "assertions" not in s or not isinstance(s["assertions"], list):
                    s["assertions"] = []
            return a
    return None

def get_all_pmids() -> Set[str]:
    """
    Returns set of all abstract pmid strings.
    """
    return {str(a.get("pmid")) for a in load_abstracts()}

# ---- Review logging and stats ---------------------------------------------
# Fallback constants
DEFAULT_PER_ABSTRACT_RATE = 0.3
DEFAULT_PER_ASSERTION_ADD_RATE = 0.05

def log_review_action(record: Dict[str, Any]) -> bool:
    """
    Log a review-related action to the review log JSONL.
    """
    if not isinstance(record, dict):
        raise ValidationError("Log record must be a dict.")
    if "pmid" not in record and "abstract_id" not in record:
        # not strictly required in all contexts, but warn
        pass
    try:
        _atomic_write_jsonl(REVIEW_LOGS_PATH, record)
        return True
    except Exception as e:
        raise ModelError(f"Failed to log review action: {e}") from e

def _read_review_logs() -> List[Dict[str, Any]]:
    return _safe_load_jsonl(REVIEW_LOGS_PATH)

def get_reviewer_logs(email: str) -> List[Dict[str, Any]]:
    email_norm = (email or "").lower()
    return [
        log for log in _read_review_logs()
        if (isinstance(log.get("creator"), str) and log.get("creator", "").lower() == email_norm)
        or (isinstance(log.get("reviewer"), str) and log.get("reviewer", "").lower() == email_norm)
    ]

def get_stats_for_reviewer(
    email: str,
    per_abstract_rate: float = DEFAULT_PER_ABSTRACT_RATE,
    per_assertion_add_rate: float = DEFAULT_PER_ASSERTION_ADD_RATE,
) -> Dict[str, Any]:
    """
    Compute statistics (number of reviewed abstracts, added assertions, commission).
    """
    abs_ids: Set[str] = set()
    assertion_adds = 0
    logs = get_reviewer_logs(email)
    for log in logs:
        pmid = log.get("pmid") or log.get("abstract_id") or log.get("abs_id")
        if pmid:
            abs_ids.add(str(pmid))
        if log.get("action") == "add":
            assertion_adds += 1
    total = len(abs_ids)
    commission = total * per_abstract_rate + assertion_adds * per_assertion_add_rate
    return {
        "reviewed_abstracts": total,
        "assertions_added": assertion_adds,
        "commission": round(commission, 2),
    }

def assertion_exists(assertion_id: str) -> bool:
    if not assertion_id:
        return False
    for log in _read_review_logs():
        if log.get("assertion_id") == assertion_id:
            return True
    return False

def get_log_by_assertion_id(assertion_id: str) -> Optional[Dict[str, Any]]:
    for log in _read_review_logs():
        if log.get("assertion_id") == assertion_id:
            return log
    return None

# ---- Reviewers management -----------------------------------------------
_reviewers_lock = threading.RLock()

def _ensure_reviewers_file():
    with _reviewers_lock:
        dirpath = os.path.dirname(REVIEWERS_JSON)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        if not os.path.exists(REVIEWERS_JSON):
            with open(REVIEWERS_JSON, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)

def load_reviewers(force_reload: bool = False) -> List[Dict[str, Any]]:
    """
    Load reviewers list, create file if missing. No caching to keep edits visible.
    """
    _ensure_reviewers_file()
    try:
        with open(REVIEWERS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list):
                data = []
        return data
    except Exception:
        return []

def save_reviewers(reviewers: List[Dict[str, Any]]) -> None:
    """
    Atomically save reviewers list.
    """
    if not isinstance(reviewers, list):
        raise ValidationError("Reviewers must be a list.")
    _ensure_reviewers_file()
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".tmp", dir=os.path.dirname(REVIEWERS_JSON))
    os.close(tmp_fd)
    try:
        with open(tmp_path, "w", encoding="utf-8") as tf:
            json.dump(reviewers, tf, ensure_ascii=False, indent=2)
        os.replace(tmp_path, REVIEWERS_JSON)
    except Exception as e:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise ModelError(f"Failed to save reviewers: {e}") from e

def get_all_reviewers() -> List[Dict[str, Any]]:
    return load_reviewers()

@lru_cache(maxsize=512)
def get_reviewer_by_email_cached(email: str) -> Optional[Dict[str, Any]]:
    return get_reviewer_by_email(email)  # just delegate

def get_reviewer_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_norm = (email or "").lower().strip()
    if not email_norm:
        return None
    for r in load_reviewers():
        if (isinstance(r.get("email"), str) and r.get("email", "").lower() == email_norm):
            return r
    return None

def add_reviewer(email: str, name: str, active: bool = True, role: str = "reviewer", note: str = "") -> bool:
    """
    Add a reviewer. Raises on invalid inputs or existing reviewer.
    """
    email_norm = (email or "").lower().strip()
    name = (name or "").strip()
    if not email_norm or "@" not in email_norm:
        raise ValidationError("Invalid email.")
    if not is_valid_email(email_norm):
        # optionally allow relaxing domain in higher layers
        raise ValidationError("Email domain not allowed.")
    if not name:
        raise ValidationError("Name required.")
    with _reviewers_lock:
        allr = load_reviewers()
        if any(isinstance(r.get("email"), str) and r.get("email", "").lower() == email_norm for r in allr):
            raise ConflictError("Reviewer already exists.")
        new = {
            "email": email_norm,
            "name": name,
            "active": bool(active),
            "role": role,
            "note": note,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        allr.append(new)
        save_reviewers(allr)
    # invalidate cache
    get_reviewer_by_email_cached.cache_clear()
    return True

def update_reviewer(email: str, fields: Dict[str, Any]) -> bool:
    """
    Update reviewer fields. Raises NotFoundError if absent.
    """
    email_norm = (email or "").lower().strip()
    if not email_norm:
        raise ValidationError("Invalid email.")
    with _reviewers_lock:
        allr = load_reviewers()
        updated = False
        for r in allr:
            if isinstance(r.get("email"), str) and r.get("email", "").lower() == email_norm:
                # sanitize and apply
                # only allow expected keys (can be tightened)
                for k, v in fields.items():
                    if k in ("name", "role", "note"):
                        r[k] = v
                    elif k == "active":
                        r["active"] = bool(v)
                r["updated_at"] = datetime.utcnow().isoformat() + "Z"
                updated = True
                break
        if not updated:
            raise NotFoundError("Reviewer not found.")
        save_reviewers(allr)
    # invalidate cache
    get_reviewer_by_email_cached.cache_clear()
    return True

def delete_reviewer(email: str) -> bool:
    email_norm = (email or "").lower().strip()
    with _reviewers_lock:
        allr = load_reviewers()
        filtered = [r for r in allr if not (isinstance(r.get("email"), str) and r.get("email", "").lower() == email_norm)]
        if len(filtered) == len(allr):
            return True  # idempotent
        save_reviewers(filtered)
    get_reviewer_by_email_cached.cache_clear()
    return True

# ---- Additional utilities -------------------------------------------------

def search_reviewers(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fuzzy search on name/email with a cap.
    """
    q = (query or "").strip().lower()
    if not q:
        return load_reviewers()[:limit]
    found: List[Dict[str, Any]] = []
    for r in load_reviewers():
        name = (r.get("name") or "").lower()
        email = (r.get("email") or "").lower()
        if q in name or q in email:
            found.append(r)
        if len(found) >= limit:
            break
    return found