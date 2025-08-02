def test_arbitration_queue_public(client):
    # 不强制管理员也可拉取队列（你的实现如此）
    r = client.get("/api/arbitration_queue")
    assert r.status_code == 200
    assert isinstance(r.get_json(), list)

def test_arbitrate_requires_admin(client):
    r = client.post("/api/arbitrate", json={
        "pmid": "1001", "assertion_id": "x", "decision": "accept", "comment": ""
    })
    assert r.status_code == 403