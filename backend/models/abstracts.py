# backend/models/abstracts.py
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..config import ABSTRACTS_PATH

# 线程安全缓存：按文件 mtime 做失效
_state = {
    "data": None,   # type: Optional[List[Dict[str, Any]]]
    "mtime": 0.0,   # type: float
    "index": {},    # type: Dict[str, Dict[str, Any]]
}
_lock = threading.RLock()

# ---------------------------------------------------------------------------
# Path helper（动态读取环境变量，避免测试中的早绑定问题）
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
    """保证最小结构完整性。"""
    if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
        a["sentence_results"] = []
    for s in a["sentence_results"]:
        if "assertions" not in s or not isinstance(s["assertions"], list):
            s["assertions"] = []
    return a

def _load_jsonl(path: Path) -> List[Dict[str, Any]]:
    """安全加载 JSONL；跳过坏行，尽量不抛异常。"""
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
    """
    加载摘要，基于 mtime 的缓存；env 路径改变或文件修改会自动重建缓存。
    """
    path = _abs_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    with _lock:
        if force_reload or _state["data"] is None or _state["mtime"] != mtime:
            _rebuild_cache(path)
        return _state["data"] or []

def invalidate_cache() -> None:
    """外部强制失效缓存（例如测试切换数据文件后）。"""
    with _lock:
        _state["data"] = None

def get_abstract_by_id(abs_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    按 PMID 获取单个摘要；缓存会按 mtime 自动刷新。
    """
    target = str(abs_id)
    path = _abs_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    with _lock:
        if _state["data"] is None or _state["mtime"] != mtime:
            _rebuild_cache(path)
        return _state["index"].get(target)

def get_all_pmids() -> List[str]:
    """返回所有 PMID（字符串）。"""
    load_abstracts()  # ensure cache
    with _lock:
        return list(_state["index"].keys())

def sentence_count(abstract: Optional[Dict[str, Any]]) -> int:
    """获取摘要的句子数。"""
    if not abstract:
        return 0
    sc = abstract.get("sentence_count")
    if isinstance(sc, int):
        return sc
    return len(abstract.get("sentence_results", []) or [])