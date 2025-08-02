# tests/backend/test_arbitration_api_more.py
import time
from backend.models.logs import log_review_action
from backend.domain.assertions import make_assertion_id

def _admin_login(client):
    with client.session_transaction() as s:
        s["email"] = "admin@bristol.ac.uk"
        s["is_admin"] = True

def test_arbitration_full_flow(client):
    pmid = "1001"
    # 先计算 assertion_id，确保三条日志分到同一分组
    aid = make_assertion_id("A", "dsyn", "TREATS", "B", "phsu")

    # 写入冲突断言：add + accept + reject（都关联到同一 assertion）
    now = time.time()
    log_review_action({
        "pmid": pmid,
        "action": "add",
        "subject": "A",
        "subject_type": "dsyn",
        "predicate": "TREATS",
        "object": "B",
        "object_type": "phsu",
        "assertion_id": aid,
        "created_at": now,
    })
    log_review_action({
        "pmid": pmid,
        "action": "accept",
        "assertion_id": aid,
        "reviewer": "r1@bristol.ac.uk",
        "created_at": now + 1,
    })
    log_review_action({
        "pmid": pmid,
        "action": "reject",
        "assertion_id": aid,
        "reviewer": "r2@bristol.ac.uk",
        "created_at": now + 2,
    })

    # 队列（公开）
    r = client.get("/api/arbitration/queue")
    assert r.status_code == 200 and r.get_json()["success"] is True

    _admin_login(client)
    items = client.get("/api/arbitration/queue").get_json()["data"]["items"]
    assert items, "应当存在冲突项以进入仲裁队列"
    key = items[0]["assertion_key"]

    # 后续裁决、历史、撤销逻辑保持不变
    j = client.post("/api/arbitration/decide", json={
        "pmid": pmid, "assertion_key": key, "decision": "accept", "comment": "ok", "overwrite": True
    }).get_json()
    assert j["success"] is True

    j = client.get(f"/api/arbitration/history?pmid={pmid}&assertion_key={key}").get_json()
    assert j["success"] is True and j["data"]["history"]

    j = client.post("/api/arbitration/undo", json={"pmid": pmid, "assertion_key": key, "reason": "mistake"}).get_json()
    assert j["success"] is True