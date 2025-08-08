# backend/models/abstracts.py
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..config import ABSTRACTS_PATH

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
    """Ensure minimal structural integrity for an abstract object."""
    if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
        a["sentence_results"] = []
    for s in a["sentence_results"]:
        if "assertions" not in s or not isinstance(s["assertions"], list):
            s["assertions"] = []
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
    """Get abstract by PMID; cache refreshes when mtime changes."""
    target = str(abs_id)
    path = _abs_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    with _lock:
        if _state["data"] is None or _state["mtime"] != mtime:
            _rebuild_cache(path)
        return _state["index"].get(target)

def get_all_pmids() -> List[str]:
    """Return all PMIDs as strings."""
    load_abstracts()  # ensure cache
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