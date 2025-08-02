# tests/backend/test_arbitration_compat_routes.py
import time
from backend.models.logs import log_review_action

def test_arbitration_queue_compat_and_arbitrate(client):
    # 造冲突
    pmid = "9001"; now = time.time()
    log_review_action({"pmid":pmid,"action":"add","subject":"X","subject_type":"dsyn","predicate":"TREATS","object":"Y","object_type":"phsu","created_at":now})
    log_review_action({"pmid":pmid,"action":"accept","created_at":now+1})
    log_review_action({"pmid":pmid,"action":"reject","created_at":now+2})

    # 公有队列（旧）
    r = client.get("/api/arbitration_queue")
    assert r.status_code == 200 and isinstance(r.get_json(), list)

    # 管理员登录
    client.post("/api/login", json={"name":"Admin User","email":"admin@bristol.ac.uk"})

    # 取新风格队列拿 key
    j = client.get("/api/arbitration/queue").get_json()
    key = j["data"]["items"][0]["assertion_key"]

    # 旧仲裁接口
    r2 = client.post("/api/arbitrate", json={"pmid":pmid,"assertion_id":key,"decision":"accept"})
    assert r2.status_code == 200 and r2.get_json()["success"] is True