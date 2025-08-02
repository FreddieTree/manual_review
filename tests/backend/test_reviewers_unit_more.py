from backend.models import reviewers as R

def test_reviewers_load_save_direct(tmp_path, monkeypatch):
    p = tmp_path / "reviewers.json"
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(p))
    # 触发 _ensure_file
    assert R.load_reviewers() == []
    R.save_reviewers([{"email":"a@bristol.ac.uk","name":"A","active":True,"role":"reviewer"}])
    lst = R.load_reviewers()
    assert lst and lst[0]["email"] == "a@bristol.ac.uk"

def _admin_login(client):
    with client.session_transaction() as s:
        s["email"] = "admin@bristol.ac.uk"
        s["is_admin"] = True

def test_reviewers_routes_edge_cases(client):
    _admin_login(client)
    # 无效邮箱
    r = client.post("/api/reviewers", json={"email":"bad@evil.com","name":"X"})
    assert r.status_code == 400
    # 正常插入 + 未知角色会被归一化
    r = client.post("/api/reviewers", json={"email":"ok@bristol.ac.uk","name":"OK","role":"unknown"})
    assert r.status_code == 200
    # 更新不存在
    r = client.put("/api/reviewers/none@bristol.ac.uk", json={"name":"N"})
    assert r.status_code == 404
    # 角色归一化为 reviewer
    r = client.put("/api/reviewers/ok@bristol.ac.uk", json={"role":"OWNER"})
    assert r.status_code == 200
    # 删除不存在
    r = client.delete("/api/reviewers/none@bristol.ac.uk")
    assert r.status_code == 200