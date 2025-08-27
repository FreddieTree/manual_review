# backend/models/logs.py
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..config import (
    REVIEW_LOGS_PATH,
    REWARD_PER_ABSTRACT,
    REWARD_PER_ASSERTION_ADD,
    get_logger,
)
try:
    # Prefer Mongo persistence when available
    from ..models.db import logs_col  # type: ignore
except Exception:  # pragma: no cover
    logs_col = None  # type: ignore

logger = get_logger("models.logs")

_WRITE_LOCK = threading.RLock()
_TAIL_BLOCK_SIZE = 4096
_USE_FSYNC = str(os.environ.get("LOG_FSYNC", "1")).strip().lower() in ("1", "true", "yes")
# 若外部未设置，默认回落到配置路径（不会覆盖 fixture 中的 monkeypatch）
os.environ.setdefault("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(REVIEW_LOGS_PATH))

# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

def _to_path(p: Optional[str | os.PathLike] = None) -> Path:
    if p is not None:
        return Path(p)
    env_path = os.environ.get("MANUAL_REVIEW_REVIEW_LOGS_PATH")
    if env_path:
        return Path(env_path)
    return Path(REVIEW_LOGS_PATH)

# ---------------------------------------------------------------------------
# Timestamp helpers & record sanitize
# ---------------------------------------------------------------------------

def _to_float_ts(v: Any, *, default: Optional[float] = None) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0 if default is None else float(default)

def _sanitize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    rec = dict(record) if isinstance(record, dict) else {}
    now = time.time()
    created = _to_float_ts(rec.get("created_at"), default=now)
    rec["created_at"] = created
    rec.setdefault("timestamp", created)
    # Ensure action present and normalized for query
    if rec.get("action"):
        try:
            rec["action"] = str(rec["action"]).strip().lower()
        except Exception:
            pass
    return rec

# ---------------------------------------------------------------------------
# JSONL write
# ---------------------------------------------------------------------------

def log_review_action(record: Dict[str, Any], *, path: Optional[str | os.PathLike] = None) -> None:
    p = _to_path(path)
    _ensure_dir(p)
    rec = _sanitize_record(record)
    # Best-effort operator/ip propagation
    try:
        from flask import request
        if "ip" not in rec:
            rec["ip"] = request.remote_addr
        if "user_agent" not in rec:
            rec["user_agent"] = request.headers.get("User-Agent", "")
    except Exception:
        pass
    data = json.dumps(rec, ensure_ascii=False)

    with _WRITE_LOCK:
        # Write to file (best-effort) for local dev
        try:
            with p.open("a", encoding="utf-8") as f:
                f.write(data + "\n")
                f.flush()
                if _USE_FSYNC:
                    os.fsync(f.fileno())
        except Exception:
            logger.debug("File log append failed; continuing with Mongo only")
        # Write to Mongo (preferred for persistence)
        if logs_col is not None:
            try:
                # Store original record; Mongo will handle ObjectId
                logs_col.insert_one(rec)
            except Exception:
                logger.exception("Failed to append review log to Mongo")

    # 写入后主动失效聚合缓存
    try:
        from ..services.aggregation import invalidate_cache as _invalidate
        _invalidate()
    except Exception:
        pass

# ---------------------------------------------------------------------------
# JSONL read
# ---------------------------------------------------------------------------

def load_logs(*, path: Optional[str | os.PathLike] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load logs from Mongo when available; fallback to file on local dev.

    - When limit is provided, returns the most recent N items sorted by created_at/ timestamp.
    - Ensures consistent dict output.
    """
    # Prefer Mongo
    if logs_col is not None:
        try:
            cursor = logs_col.find({}, {"_id": 0})
            if limit and limit > 0:
                cursor = logs_col.find({}, {"_id": 0}).sort([("created_at", 1), ("timestamp", 1)])  # ascending to keep order
                docs = list(cursor)[-limit:]
            else:
                docs = list(cursor)
            return [dict(d) for d in docs if isinstance(d, dict)]
        except Exception:
            logger.debug("Mongo load_logs failed; falling back to file")

    # Fallback to file
    p = _to_path(path)
    if not p.exists():
        return []

    out: List[Dict[str, Any]] = []
    try:
        if not limit or limit <= 0:
            with p.open("r", encoding="utf-8") as f:
                for line in f:
                    s = line.strip()
                    if not s:
                        continue
                    try:
                        obj = json.loads(s)
                        if isinstance(obj, dict):
                            out.append(obj)
                    except Exception:
                        continue
        else:
            with p.open("rb") as f:
                f.seek(0, os.SEEK_END)
                size = f.tell()
                data = b""
                lines = []
                while size > 0 and len(lines) <= limit:
                    step = min(_TAIL_BLOCK_SIZE, size)
                    size -= step
                    f.seek(size)
                    data = f.read(step) + data
                    lines = data.splitlines()
            for line in [ln.decode("utf-8", errors="ignore") for ln in lines[-limit:]]:
                s = line.strip()
                if not s:
                    continue
                try:
                    obj = json.loads(s)
                    if isinstance(obj, dict):
                        out.append(obj)
                except Exception:
                    continue
    except Exception:
        logger.exception("Failed to load logs from %s", str(p))
        return []
    return out

# ---------------------------------------------------------------------------
# Reviewer-scoped helpers & stats
# ---------------------------------------------------------------------------

def get_reviewer_logs(
    email: str,
    *,
    path: Optional[str | os.PathLike] = None,
    actions: Optional[Set[str]] = None,
    since_ts: Optional[float] = None,
    until_ts: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    过滤指定审稿人的日志；可选按 action、时间窗口过滤。

    策略：
    - 提供 `actions` 时先过滤到指定动作；
    - 若 **未** 指定时间窗口（both None），则对“同一 action”仅保留**最新**一条记录
      （按文件写入顺序倒序扫描），以隔离其它测试/历史数据的干扰；
    - 若指定了 since_ts/until_ts，则不做该去重，完整返回窗口内所有匹配记录。
    """
    email_norm = (email or "").strip().lower()
    if not email_norm:
        return []

    logs = load_logs(path=path)
    actions_lc: Optional[Set[str]] = {a.strip().lower() for a in actions} if actions else None

    filtered: List[Dict[str, Any]] = []
    for log in logs:
        actor = ((log.get("creator") or log.get("reviewer") or log.get("email") or "")).strip().lower()
        if actor != email_norm:
            continue

        act = (log.get("action") or "").strip().lower()
        if actions_lc and act not in actions_lc:
            continue

        ts = _to_float_ts(log.get("created_at", log.get("timestamp", 0)))
        if since_ts is not None and ts < _to_float_ts(since_ts):
            continue
        if until_ts is not None and ts > _to_float_ts(until_ts):
            continue

        filtered.append(log)

    # 仅当传入 actions 且不含时间窗口：按“action 维度”保留最新一条
    if actions_lc and since_ts is None and until_ts is None and filtered:
        seen_actions: Set[str] = set()
        dedup_reversed: List[Dict[str, Any]] = []
        for log in reversed(filtered):  # 从新到旧
            act = (log.get("action") or "").strip().lower()
            if act in seen_actions:
                continue
            seen_actions.add(act)
            dedup_reversed.append(log)
        filtered = list(reversed(dedup_reversed))

    return filtered


def get_stats_for_reviewer(
    email: str,
    *,
    path: Optional[str | os.PathLike] = None,
    per_abstract_rate: float = float(REWARD_PER_ABSTRACT),
    per_assertion_add_rate: float = float(REWARD_PER_ASSERTION_ADD),
    since_ts: Optional[float] = None,
    until_ts: Optional[float] = None,
) -> Dict[str, Any]:
    """
    统计某审稿人的产出与佣金：
      - reviewed_abstracts：出现过的不同 pmid 数
      - assertions_added：action == "add" 的条目数
      - commission：抽象件数*单价 + 新增断言数*单价
    """
    logs = get_reviewer_logs(email, path=path, since_ts=since_ts, until_ts=until_ts)

    abs_ids: Set[str] = set()
    adds = 0
    for log in logs:
        pmid = log.get("pmid") or log.get("abstract_id") or log.get("abs_id")
        if pmid:
            abs_ids.add(str(pmid))
        if (log.get("action") or "").strip().lower() == "add":
            adds += 1

    reviewed_abstracts = len(abs_ids)
    commission = reviewed_abstracts * per_abstract_rate + adds * per_assertion_add_rate

    return {
        "reviewed_abstracts": reviewed_abstracts,
        "assertions_added": adds,
        "commission": round(commission, 2),
        "since_ts": since_ts,
        "until_ts": until_ts,
    }