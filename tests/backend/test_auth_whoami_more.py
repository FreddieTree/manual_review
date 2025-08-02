# tests/backend/test_auth_whoami_more.py
ADMIN_EMAIL = "admin@bristol.ac.uk"
ADMIN_NAME = "Admin User"

def test_whoami_unauthenticated(client):
    r = client.get("/api/whoami")
    assert r.status_code == 401
    j = r.get_json()
    assert j["success"] is False

def test_whoami_reviewer_logged_in(client):
    # 管理员先添加一个 reviewer
    r = client.post("/api/login", json={"name": ADMIN_NAME, "email": ADMIN_EMAIL})
    assert r.status_code == 200 and r.get_json()["success"]

    email = "whoami@bristol.ac.uk"
    r = client.post("/api/reviewers", json={"email": email, "name": "Who Am I"})
    assert r.status_code == 200

    # 以 reviewer 登录
    r = client.post("/api/login", json={"name": "Who Am I", "email": email})
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"] and j["is_admin"] is False

    # whoami 返回用户信息与统计（统计字段允许为空字典，但键存在）
    r = client.get("/api/whoami")
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"] is True
    user = data["user"]
    assert user["email"] == email and user["is_admin"] is False
    assert "stats" in user