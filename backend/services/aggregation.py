# backend/services/aggregation.py
from __future__ import annotations

import json
import os
import threading
from collections import defaultdict, Counter
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Iterable

from ..config import REVIEW_LOGS_PATH, FINAL_EXPORT_PATH, get_logger
from ..domain.assertions import make_assertion_id
from ..models.abstracts import get_all_pmids

logger = get_logger("services.aggregation")

# ---------- Enums ------------------------------------------------------------

class Action(str, Enum):
    ACCEPT = "accept"
    MODIFY = "modify"
    REJECT = "reject"
    UNCERTAIN = "uncertain"
    ADD = "add"
    ARBITRATE = "arbitrate"
    ARBITRATE_UNDO = "arbitrate_undo"

class ConsensusResult(str, Enum):
    CONSENSUS = "consensus"
    CONFLICT = "conflict"
    UNCERTAIN = "uncertain"
    PENDING = "pending"
    ARBITRATED = "arbitrated"

# ---------- Internal state & helpers ----------------------------------------

_log_file_lock = threading.RLock()
_cached_log_mtime: Optional[float] = None
_cached_parsed_logs: Optional[List[Dict[str, Any]]] = None


def _log_path() -> Path:
    """
    与 models.logs._to_path 保持一致：
    优先环境变量 MANUAL_REVIEW_REVIEW_LOGS_PATH（pytest 夹具会设定），否则回退配置常量。
    """
    env_path = os.environ.get("MANUAL_REVIEW_REVIEW_LOGS_PATH")
    return Path(env_path) if env_path else Path(REVIEW_LOGS_PATH)


def _get_log_file_mtime() -> float:
    try:
        p = _log_path()
        return p.stat().st_mtime if p.exists() else 0.0
    except Exception:
        return 0.0


def invalidate_cache() -> None:
    """
    失效原始日志缓存 + 按 PMID 的聚合缓存。
    """
    global _cached_log_mtime, _cached_parsed_logs
    with _log_file_lock:
        _cached_log_mtime = None
        _cached_parsed_logs = None
    try:
        aggregate_assertions_for_pmid.cache_clear()  # type: ignore[attr-defined]
    except Exception:
        pass


def _load_raw_logs() -> List[Dict[str, Any]]:
    """
    从 JSONL 读取日志；以文件 mtime 作朴素缓存；跳过坏行。
    """
    global _cached_log_mtime, _cached_parsed_logs
    with _log_file_lock:
        current_mtime = _get_log_file_mtime()
        if _cached_parsed_logs is not None and _cached_log_mtime == current_mtime:
            return _cached_parsed_logs

        logs: List[Dict[str, Any]] = []
        path = _log_path()
        if not path.exists():
            _cached_log_mtime = current_mtime
            _cached_parsed_logs = logs
            return logs

        try:
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    s = line.strip()
                    if not s:
                        continue
                    try:
                        obj = json.loads(s)
                        if isinstance(obj, dict):
                            logs.append(obj)
                    except json.JSONDecodeError:
                        continue
        except Exception:
            logger.exception("Failed reading logs from %s", str(path))
            logs = []

        _cached_log_mtime = current_mtime
        _cached_parsed_logs = logs
        return logs

# ---------- Normalization & timestamps --------------------------------------

def _norm_action(act: Any) -> str:
    """Enum/字符串统一为小写字符串。"""
    if act is None:
        return ""
    val = getattr(act, "value", act)
    return str(val).strip().lower()


def _ts(log: Dict[str, Any]) -> float:
    """优先 created_at，后备 timestamp；容忍字符串数字。"""
    for key in ("created_at", "timestamp"):
        v = log.get(key)
        try:
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str) and v.strip():
                return float(v)
        except Exception:
            continue
    return 0.0

# ---------- Grouping ---------------------------------------------------------

def _content_key(log: Dict[str, Any]) -> str:
    """基于内容生成稳定 key（字段缺失时为空字符串）。"""
    return make_assertion_id(
        log.get("subject", ""),
        log.get("subject_type", ""),
        log.get("predicate", ""),
        log.get("object", ""),
        log.get("object_type", ""),
    )


def _group_logs_for_pmid_ordered(pmid: str, logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    以时间序归并的分组算法（关键修复点）：
      1) related_to -> 直接归属；
      2) assertion_id -> 直接归属；
      3) action==add -> 以“内容 key”建组，并更新 last_add_key；
      4) 其他动作：
          - 若具备完整内容字段 -> 用内容 key；
          - 否则（缺少 assertion_id + 内容） -> 归到当前 last_add_key（若不存在再退回内容 key）。
    这样能把“缺失 assertion_id 的 accept/reject”等正确归到最近的 add，避免不同断言被空 key 合并。
    """
    pmid_s = str(pmid)
    filt = [l for l in logs if str(l.get("pmid")) == pmid_s]
    # 稳定按时间升序
    filt.sort(key=_ts)

    agg: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    last_add_key: Optional[str] = None

    for log in filt:
        action = _norm_action(log.get("action"))
        rid = (log.get("related_to") or "").strip()
        aid = (log.get("assertion_id") or "").strip()

        if rid:
            key = rid
        elif aid:
            key = aid
        else:
            if action == Action.ADD.value:
                key = _content_key(log)
                last_add_key = key or last_add_key
            else:
                # 是否有足够内容
                has_content = any(log.get(k) for k in ("subject", "predicate", "object"))
                if has_content:
                    key = _content_key(log)
                elif last_add_key:
                    key = last_add_key
                else:
                    # 最保守兜底：仍用内容 key（可能为空串，但此时无 add 在前，影响极小）
                    key = _content_key(log)

        agg[key].append(log)

        # 一些日志在后置也带来了 add-like 内容，谨慎更新 last_add_key 仅限真 add
        if action == Action.ADD.value and key:
            last_add_key = key

    return agg


def _group_logs_by_assertion(pmid: str, logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """公共入口，封装为有序分组。"""
    return _group_logs_for_pmid_ordered(pmid, logs)

# ---------- Consensus Logic --------------------------------------------------

def consensus_decision(
    logs: List[Dict[str, Any]],
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2,
) -> ConsensusResult:
    """
    单一断言的共识判定：
      1. 出现 arbitrate -> ARBITRATED
      2. 有 reject/uncertain -> 若全 uncertain 则 UNCERTAIN，否则 CONFLICT
      3. 仅 accept/modify -> 数量达到阈值视为 CONSENSUS；若要求精确内容且多次 modify 不一致 -> CONFLICT
      4. 其他情况 -> UNCERTAIN 或 PENDING
    """
    if not logs:
        return ConsensusResult.PENDING

    if any(_norm_action(l.get("action")) == Action.ARBITRATE.value for l in logs):
        return ConsensusResult.ARBITRATED

    allowed = {
        Action.ACCEPT.value,
        Action.MODIFY.value,
        Action.REJECT.value,
        Action.UNCERTAIN.value,
    }
    review_actions = [_norm_action(l.get("action")) for l in logs if _norm_action(l.get("action")) in allowed]

    if not review_actions:
        return ConsensusResult.PENDING

    counter = Counter(review_actions)

    if counter.get(Action.REJECT.value, 0) > 0 or counter.get(Action.UNCERTAIN.value, 0) > 0:
        if counter.get(Action.UNCERTAIN.value, 0) == len(review_actions) and counter.get(Action.REJECT.value, 0) == 0:
            return ConsensusResult.UNCERTAIN
        return ConsensusResult.CONFLICT

    support = counter.get(Action.ACCEPT.value, 0) + counter.get(Action.MODIFY.value, 0)
    if support >= min_reviewers_for_consensus:
        if require_exact_content_match:
            modify_logs = [l for l in logs if _norm_action(l.get("action")) == Action.MODIFY.value]
            if len(modify_logs) > 1:
                contents = {
                    (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    for l in modify_logs
                }
                if len(contents) > 1:
                    return ConsensusResult.CONFLICT
        return ConsensusResult.CONSENSUS

    return ConsensusResult.UNCERTAIN

# ---------- Public API ------------------------------------------------------

@lru_cache(maxsize=128)
def aggregate_assertions_for_pmid(pmid: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    聚合指定 PMID 的断言日志，按稳定生命周期键分组（有序算法）。
    """
    logs = _load_raw_logs()
    return _group_logs_by_assertion(pmid, logs)


def get_detailed_assertion_summary(
    pmid: str,
    require_exact_content_match: bool = False,
    min_reviewers_for_consensus: int = 2,
) -> List[Dict[str, Any]]:
    """
    返回每个断言的：
      - consensus_status
      - support_counts
      - last_updated
      - reviewers
      - logs
      - conflict_reason（如适用）
    """
    agg = aggregate_assertions_for_pmid(pmid)
    summary: List[Dict[str, Any]] = []
    for assertion_key, logs in agg.items():
        status = consensus_decision(
            logs,
            require_exact_content_match=require_exact_content_match,
            min_reviewers_for_consensus=min_reviewers_for_consensus,
        )
        actions = [_norm_action(l.get("action")) for l in logs if l.get("action") is not None]
        counter = Counter(actions)
        last = max((_ts(l) for l in logs), default=0.0)
        reviewers = sorted({
            (l.get("creator") or l.get("reviewer") or "").lower()
            for l in logs if (l.get("creator") or l.get("reviewer"))
        })
        item: Dict[str, Any] = {
            "assertion_key": assertion_key,
            "consensus_status": status.value,
            "support_counts": dict(counter),
            "last_updated": last,
            "reviewers": reviewers,
            "logs": sorted(logs, key=_ts),
        }
        if status == ConsensusResult.CONFLICT:
            reasons = []
            if counter.get(Action.REJECT.value, 0) > 0:
                reasons.append("contains reject")
            if counter.get(Action.UNCERTAIN.value, 0) > 0:
                reasons.append("contains uncertain")
            if counter.get(Action.MODIFY.value, 0) > 1 and require_exact_content_match:
                modify_logs = [l for l in logs if _norm_action(l.get("action")) == Action.MODIFY.value]
                contents = {
                    (
                        l.get("subject"),
                        l.get("subject_type"),
                        l.get("predicate"),
                        l.get("object"),
                        l.get("object_type"),
                        bool(l.get("negation", False)),
                    )
                    for l in modify_logs
                }
                if len(contents) > 1:
                    reasons.append("modify content mismatch")
            item["conflict_reason"] = "; ".join(reasons) if reasons else "mixed signals"
        summary.append(item)
    return summary


def _pmids_from_logs(logs: Iterable[Dict[str, Any]]) -> List[str]:
    """从原始日志收集唯一 PMID。"""
    out: List[str] = []
    seen = set()
    for l in logs:
        pid = str(l.get("pmid") or "").strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append(pid)
    return out


def find_assertion_conflicts(pmid: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    列出当前处于冲突的断言（不含已仲裁）。
    - 若指定 pmid：仅检查该 pmid；
    - 否则：使用“摘要 + 日志”的 PMID 并集，逐个 pmid 用同一套分组/判定逻辑。
    """
    raw = _load_raw_logs()
    if pmid is not None:
        targets = [str(pmid)]
    else:
        pmids_abs = list(get_all_pmids())
        pmids_logs = _pmids_from_logs(raw)
        targets = list({*pmids_abs, *pmids_logs})

    conflicts: List[Dict[str, Any]] = []
    for pid in targets:
        agg = _group_logs_for_pmid_ordered(pid, raw)
        for key, logs in agg.items():
            status = consensus_decision(logs)
            if status == ConsensusResult.CONFLICT:
                conflicts.append({
                    "pmid": pid,
                    "assertion_key": key,
                    "logs": sorted(logs, key=_ts),
                    "status": status.value,
                })
    return conflicts


def aggregate_final_decisions_for_pmid(pmid: str) -> List[Dict[str, Any]]:
    """
    返回最终决策（已达共识或已仲裁）的断言；以该组最后一条日志为权威快照。
    """
    detailed = get_detailed_assertion_summary(pmid)
    finals: List[Dict[str, Any]] = []
    for item in detailed:
        status = item.get("consensus_status")
        if status in (ConsensusResult.CONSENSUS.value, ConsensusResult.ARBITRATED.value):
            final_log = item["logs"][-1] if item.get("logs") else {}
            record = {
                **final_log,
                "final_decision": status,
                "support_counts": item.get("support_counts", {}),
                "reviewers": item.get("reviewers", []),
                "last_updated": item.get("last_updated", 0),
                "assertion_key": item.get("assertion_key"),
            }
            finals.append(record)
    return finals

# ---------- Export / Overview ------------------------------------------------

def export_final_consensus(out_path: Optional[str | Path] = None) -> tuple[int, Path]:
    """
    导出所有 PMID 的“最终决策”到 JSONL 文件。
    返回: (写入条数, 文件路径)
    """
    raw = _load_raw_logs()
    pmids = list({*get_all_pmids(), *_pmids_from_logs(raw)})

    finals: List[Dict[str, Any]] = []
    for pid in pmids:
        finals.extend(aggregate_final_decisions_for_pmid(pid))

    path = Path(out_path or FINAL_EXPORT_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as f:
        for rec in finals:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    logger.info("Exported %d final consensus records to %s", len(finals), str(path))
    return len(finals), path


def export_summary_to_json(pmid: str, out_path: str) -> bool:
    """
    导出指定 PMID 的详细断言汇总为 JSON 文件。
    """
    try:
        summary = get_detailed_assertion_summary(pmid)
        Path(os.path.dirname(out_path) or ".").mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        logger.exception("Failed to export summary for %s -> %s", pmid, out_path)
        return False


def get_conflict_overview() -> Dict[str, Any]:
    """
    汇总冲突概览：PMID 总数、每 PMID 的冲突数与总冲突数。
    （PMID 来源为“摘要 + 日志”的并集）
    """
    raw = _load_raw_logs()
    pmids = list({*get_all_pmids(), *_pmids_from_logs(raw)})

    over: Dict[str, Any] = {
        "total_pmids": len(pmids),
        "conflicts": 0,
        "per_pmid": {},
        "generated_at": int(_get_log_file_mtime()),
    }
    total_conflicts = 0
    for pid in pmids:
        agg = aggregate_assertions_for_pmid(pid)  # 复用缓存友好的聚合
        cnt = sum(1 for ls in agg.values() if consensus_decision(ls) == ConsensusResult.CONFLICT)
        over["per_pmid"][pid] = cnt
        total_conflicts += cnt
    over["conflicts"] = total_conflicts
    return over