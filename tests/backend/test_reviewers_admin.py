def test_admin_requires_login(client):
    r = client.get("/api/reviewers")
    assert r.status_code == 403

def test_admin_crud_reviewers(client, login_admin):
    login_admin()

    # 创建
    r = client.post("/api/reviewers", json={
        "email": "bob@bristol.ac.uk",
        "name": "Bob Reviewer",
        "active": True,
        "role": "reviewer",
        "note": "new joiner"
    })
    assert r.status_code in (200, 409)
    if r.status_code == 200:
        assert r.get_json()["success"]

    # 列表
    r = client.get("/api/reviewers?q=bob")
    assert r.status_code == 200
    data = r.get_json()["data"]["reviewers"]
    assert any(rw["email"] == "bob@bristol.ac.uk" for rw in data)

    # 更新
    r = client.put("/api/reviewers/bob@bristol.ac.uk", json={"active": False, "note": "offboard"})
    assert r.status_code == 200
    assert r.get_json()["success"]

    # 获取单个
    r = client.get("/api/reviewers/bob@bristol.ac.uk")
    assert r.status_code == 200
    reviewer = r.get_json()["data"]
    assert reviewer["active"] is False

    # 删除
    r = client.delete("/api/reviewers/bob@bristol.ac.uk")
    assert r.status_code == 200
    assert r.get_json()["success"]