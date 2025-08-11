# backend/models/abstracts.py
from __future__ import annotations

import threading
from typing import Any, Dict, List, Optional, Union

try:
    # MongoDB collection for abstracts (REQUIRED for runtime)
    from ..models.db import abstracts_col  # type: ignore
except Exception as e:  # pragma: no cover
    abstracts_col = None  # type: ignore

_lock = threading.RLock()

# ---------------------------------------------------------------------------
# Normalize
# ---------------------------------------------------------------------------

def _strip_object_ids(obj: Dict[str, Any]) -> Dict[str, Any]:
    obj.pop("_id", None)
    # Also strip possible nested _id from sentences/assertions
    try:
        for s in obj.get("sentences", []) or []:
            if isinstance(s, dict):
                s.pop("_id", None)
                for a in s.get("assertions", []) or []:
                    if isinstance(a, dict):
                        a.pop("_id", None)
        for s in obj.get("sentence_results", []) or []:
            if isinstance(s, dict):
                s.pop("_id", None)
                for a in s.get("assertions", []) or []:
                    if isinstance(a, dict):
                        a.pop("_id", None)
    except Exception:
        pass
    return obj

def _normalize_abstract(a: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure minimal structural integrity for an abstract object.

    This normalizes two possible storage layouts:
    - File-based JSONL uses key: "sentence_results"
    - MongoDB-based docs (import_service) use key: "sentences"
    We convert everything into the file-compatible shape with "sentence_results".
    """
    # Strip internal Mongo identifiers first
    a = _strip_object_ids(a)

    # DB stores `sentences`; normalize to file-compatible `sentence_results` shape used by the UI
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
    return _strip_object_ids(a)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_abstracts(force_reload: bool = False) -> List[Dict[str, Any]]:
    """Load abstracts strictly from MongoDB (authoritative source)."""
    if abstracts_col is None:
        raise RuntimeError("MongoDB is not configured (MONGO_URI missing).")
    with _lock:
        docs = list(abstracts_col.find({}))
        out: List[Dict[str, Any]] = []
        for d in docs:
            if d.get("pmid") is not None:
                d["pmid"] = str(d["pmid"])  # ensure string
            out.append(_normalize_abstract(d))
        return out

def invalidate_cache() -> None:
    # No-op retained for compatibility; DB is the source of truth now
    return None

def get_abstract_by_id(abs_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """Get abstract by PMID from MongoDB only."""
    if abstracts_col is None:
        raise RuntimeError("MongoDB is not configured (MONGO_URI missing).")
    target = str(abs_id)
    try:
        doc = abstracts_col.find_one({"pmid": target})
        if doc:
            if doc.get("pmid") is not None:
                doc["pmid"] = str(doc["pmid"])
            return _normalize_abstract(doc)
    except Exception:
        return None
    return None

def get_all_pmids() -> List[str]:
    """Return all PMIDs as strings from MongoDB."""
    if abstracts_col is None:
        raise RuntimeError("MongoDB is not configured (MONGO_URI missing).")
    try:
        return [str(d.get("pmid")) for d in abstracts_col.find({}, {"pmid": 1}) if d.get("pmid")]
    except Exception:
        return []

def sentence_count(abstract: Optional[Dict[str, Any]]) -> int:
    """Get sentence count for an abstract."""
    if not abstract:
        return 0
    sc = abstract.get("sentence_count")
    if isinstance(sc, int):
        return sc
    return len(abstract.get("sentence_results", []) or [])