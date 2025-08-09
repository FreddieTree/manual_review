# backend/models/abstracts.py
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..config import ABSTRACTS_PATH
try:
    # MongoDB collection for abstracts (optional at runtime)
    from ..models.db import abstracts_col  # type: ignore
except Exception:  # pragma: no cover
    abstracts_col = None  # type: ignore

# Thread-safe cache keyed by file mtime
_state = {
    "data": None,   # type: Optional[List[Dict[str, Any]]]
    "mtime": 0.0,   # type: float
    "index": {},    # type: Dict[str, Dict[str, Any]]
}
_lock = threading.RLock()

# ---------------------------------------------------------------------------
# Path helper (reads env at call time to avoid early binding in tests)
# ---------------------------------------------------------------------------

def _abs_path() -> Path:
    env_path = os.environ.get("MANUAL_REVIEW_ABSTRACTS_PATH")
    if env_path:
        return Path(env_path)
    return Path(ABSTRACTS_PATH)

# ---------------------------------------------------------------------------
# Normalize / IO
# ---------------------------------------------------------------------------

def _normalize_abstract(a: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure minimal structural integrity for an abstract object.

    This normalizes two possible storage layouts:
    - File-based JSONL uses key: "sentence_results"
    - MongoDB-based docs (import_service) use key: "sentences"
    We convert everything into the file-compatible shape with "sentence_results".
    """
    # If Mongo-style, convert to file-style
    if isinstance(a.get("sentences"), list):
        sentences = a.get("sentences") or []
        sentence_results: List[Dict[str, Any]] = []
        for idx, s in enumerate(sentences, 1):
            sr = {
                "sentence_index": s.get("sentence_index", idx),
                "sentence": s.get("sentence", ""),
                "assertions": s.get("assertions", []) if isinstance(s.get("assertions"), list) else [],
            }
            sentence_results.append({**s, **sr})
        a["sentence_results"] = sentence_results

    if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
        a["sentence_results"] = []
    for s in a["sentence_results"]:
        if "assertions" not in s or not isinstance(s["assertions"], list):
            s["assertions"] = []

    # Maintain sentence_count coherently
    if not isinstance(a.get("sentence_count"), int):
        a["sentence_count"] = len(a["sentence_results"]) if isinstance(a["sentence_results"], list) else 0
    return a

def _load_jsonl(path: Path) -> List[Dict[str, Any]]:
    """Load JSONL robustly; skip bad lines and avoid throwing when possible."""
    items: List[Dict[str, Any]] = []
    if not path.exists():
        return items
    try:
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(obj, dict):
                    items.append(_normalize_abstract(obj))
    except Exception:
        # IO 失败时返回空列表，保持可用
        return []
    return items

def _rebuild_cache(path: Path) -> None:
    # Prefer MongoDB as the authoritative source when available
    data: List[Dict[str, Any]] = []
    used_mongo = False
    if abstracts_col is not None:
        try:
            # Pull all documents; projection can be added if needed
            docs = list(abstracts_col.find({}))
            for d in docs:
                # Ensure pmid is string
                if d.get("pmid") is not None:
                    d["pmid"] = str(d["pmid"])
                data.append(_normalize_abstract(d))
            used_mongo = True
        except Exception:
            used_mongo = False

    # Fallback to JSONL file if Mongo unavailable or empty
    if not used_mongo or not data:
        data = _load_jsonl(path)

    index: Dict[str, Dict[str, Any]] = {}
    for a in data:
        pmid = str(a.get("pmid"))
        if pmid:
            index[pmid] = a
    _state["data"] = data
    _state["index"] = index
    _state["mtime"] = path.stat().st_mtime if path.exists() else 0.0

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_abstracts(force_reload: bool = False) -> List[Dict[str, Any]]:
    """Load abstracts with an mtime-based cache; env path change or file
    modification automatically triggers a rebuild.
    """
    path = _abs_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    with _lock:
        if force_reload or _state["data"] is None or _state["mtime"] != mtime:
            _rebuild_cache(path)
        return _state["data"] or []

def invalidate_cache() -> None:
    """Externally invalidate the cache (e.g., after switching data file in tests)."""
    with _lock:
        _state["data"] = None

def get_abstract_by_id(abs_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """Get abstract by PMID; prefer Mongo, fallback to file cache."""
    target = str(abs_id)

    # Try Mongo first (no need to consider mtime)
    if abstracts_col is not None:
        try:
            doc = abstracts_col.find_one({"pmid": target})
            if doc:
                if doc.get("pmid") is not None:
                    doc["pmid"] = str(doc["pmid"])
                return _normalize_abstract(doc)
        except Exception:
            pass

    # Fallback to file-backed cache
    path = _abs_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    with _lock:
        if _state["data"] is None or _state["mtime"] != mtime:
            _rebuild_cache(path)
        return _state["index"].get(target)

def get_all_pmids() -> List[str]:
    """Return all PMIDs as strings; prefer Mongo, fallback to file cache."""
    if abstracts_col is not None:
        try:
            return [str(d.get("pmid")) for d in abstracts_col.find({}, {"pmid": 1}) if d.get("pmid")]
        except Exception:
            pass
    load_abstracts()  # ensure cache from file
    with _lock:
        return list(_state["index"].keys())

def sentence_count(abstract: Optional[Dict[str, Any]]) -> int:
    """Get sentence count for an abstract."""
    if not abstract:
        return 0
    sc = abstract.get("sentence_count")
    if isinstance(sc, int):
        return sc
    return len(abstract.get("sentence_results", []) or [])