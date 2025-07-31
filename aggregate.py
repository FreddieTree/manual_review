# aggregate.py

import json
import os
from collections import defaultdict, Counter
from config import REVIEW_LOGS_PATH
from reviewer import make_assertion_id

def aggregate_assertions_for_pmid(pmid):
    """
    聚合一篇abstract所有断言的所有审核记录（accept/modify/reject/uncertain/add/仲裁），按断言ID聚合多轮意见
    返回：{ assertion_id: [log1, log2, ...], ... }
    """
    logs = []
    try:
        with open(REVIEW_LOGS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                log = json.loads(line)
                if str(log.get("pmid")) == str(pmid):
                    logs.append(log)
    except Exception:
        pass
    agg = defaultdict(list)
    for log in logs:
        # assertion_id or synthetic key for add
        key = log.get("assertion_id") or make_assertion_id(
            log.get("subject"), log.get("subject_type"),
            log.get("predicate"), log.get("object"), log.get("object_type")
        )
        agg[key].append(log)
    return agg

def consensus_decision(logs):
    """
    输入同一断言的所有log，输出“consensus”（accept/modify）、"conflict"、"uncertain"、"pending"
    规则：
      - 仲裁后log（action=="arbitrate"）优先
      - 两reviewer都accept/modify一致→consensus
      - 两reviewer出现reject/uncertain/内容不一致→conflict/uncertain
    """
    if not logs:
        return "pending"
    # 查找仲裁结果
    for log in logs:
        if log.get("action") == "arbitrate":
            return log.get("arbitrate_decision", "arbitrate")
    # 聚合reviewer操作
    actions = [l["action"] for l in logs if l.get("action") in ("accept", "modify", "reject", "uncertain")]
    if not actions:
        return "pending"
    cnt = Counter(actions)
    # 两人都accept/modify且内容一致为共识
    if cnt.get("reject", 0) > 0 or cnt.get("uncertain", 0) > 0:
        return "conflict"
    if cnt.get("accept", 0) + cnt.get("modify", 0) >= 2:
        # 可选：内容完全一致才算consensus，否则还是conflict
        return "consensus"
    return "pending"

def find_assertion_conflicts(pmid=None):
    """
    返回所有冲突或待仲裁的断言（全局或指定PMID）。
    """
    from models import get_all_pmids
    pmid_list = [pmid] if pmid else list(get_all_pmids())
    results = []
    for pid in pmid_list:
        agg = aggregate_assertions_for_pmid(pid)
        for key, logs in agg.items():
            status = consensus_decision(logs)
            if status == "conflict":
                results.append({
                    "pmid": pid,
                    "assertion_id": key,
                    "logs": logs,
                    "status": status
                })
    return results

def aggregate_final_decisions_for_pmid(pmid):
    """
    返回指定pmid下所有断言的最终状态和内容（仅consensus/arbitrate）
    """
    agg = aggregate_assertions_for_pmid(pmid)
    final_records = []
    for key, logs in agg.items():
        status = consensus_decision(logs)
        if status in ("consensus", "arbitrate"):
            logs_sorted = sorted(logs, key=lambda x: x["created_at"])
            final = logs_sorted[-1]
            final["final_decision"] = status
            final_records.append(final)
    return final_records