# tests/backend/test_aggregation_modify_conflict.py
import time
from backend.domain.assertions import make_assertion_id
from backend.models.logs import log_review_action
from backend.services.aggregation import get_detailed_assertion_summary, ConsensusResult

def test_modify_content_mismatch_conflict():
    pmid = "MOD-CONFLICT-1"
    aid = make_assertion_id("A", "dsyn", "TREATS", "B", "phsu")
    t0 = time.time()

    # 初始 add（用于分组与上下文）
    log_review_action({
        "pmid": pmid, "action": "add",
        "subject": "A", "subject_type": "dsyn",
        "predicate": "TREATS",
        "object": "B", "object_type": "phsu",
        "assertion_id": aid,
        "created_at": t0,
    })

    # 两个 reviewer 对同一 assertion 执行 modify，但内容不同（一个改为对象 C，一个仍为 B）
    log_review_action({
        "pmid": pmid, "action": "modify",
        "subject": "A", "subject_type": "dsyn",
        "predicate": "TREATS",
        "object": "B", "object_type": "phsu",
        "negation": False,
        "assertion_id": aid, "reviewer": "r1@bristol.ac.uk",
        "created_at": t0 + 1,
    })
    log_review_action({
        "pmid": pmid, "action": "modify",
        "subject": "A", "subject_type": "dsyn",
        "predicate": "TREATS",
        "object": "C", "object_type": "phsu",  # 改动点：object 不同
        "negation": False,
        "assertion_id": aid, "reviewer": "r2@bristol.ac.uk",
        "created_at": t0 + 2,
    })

    detail = get_detailed_assertion_summary(
        pmid,
        require_exact_content_match=True,  # 关键：严格比对 modify 内容
        min_reviewers_for_consensus=2,
    )
    # 找到目标断言项
    target = next((d for d in detail if d["assertion_key"] == aid), None)
    assert target is not None
    assert target["consensus_status"] == ConsensusResult.CONFLICT.value
    # 可选：理由包含 modify mismatch（不同实现命名略异）
    reason = (target.get("conflict_reason") or "").lower()
    assert ("modify" in reason and "mismatch" in reason) or reason != ""