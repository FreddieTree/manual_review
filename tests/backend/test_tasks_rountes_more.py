# tests/backend/test_tasks_routes_more.py
import time

ADMIN_EMAIL = "admin@bristol.ac.uk"
ADMIN_NAME = "Admin User"

def test_submit_review_requires_login(client):
    # 未登录直接提交 -> 401
    r = client.post("/api/submit_review", json={"pmid": "1001", "action": "accept"})
    assert r.status_code == 401
    j = r.get_json()
    assert j["success"] is False

def test_submit_review_missing_fields(client):
    # 先以管理员登录并创建一个 reviewer，再用 reviewer 登录
    r = client.post("/api/login", json={"name": ADMIN_NAME, "email": ADMIN_EMAIL})
    assert r.status_code == 200 and r.get_json()["success"]

    # 创建 reviewer（邮箱使用允许域）
    rv_email = "ok_tasks@bristol.ac.uk"
    r = client.post("/api/reviewers", json={"email": rv_email, "name": "OK Tasks"})
    assert r.status_code == 200

    # 以 reviewer 登录
    r = client.post("/api/login", json={"name": "OK Tasks", "email": rv_email})
    assert r.status_code == 200 and r.get_json()["success"]

    # 缺字段：发空 JSON，应触发 400 分支（由 routes/tasks.py 参数校验）
    r = client.post("/api/submit_review", json={})
    assert r.status_code == 400
    j = r.get_json()
    assert j["success"] is False