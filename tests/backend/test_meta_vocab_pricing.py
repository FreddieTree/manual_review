def test_health(client):
    r = client.get("/api/meta/health")
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"] and j["data"]["status"] == "ok"

def test_vocab(client):
    r = client.get("/api/meta/vocab")
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"]
    data = j["data"]
    assert any(p["id"] == "INHIBITS" for p in data["predicates"])
    assert any(t["id"] == "phsu" for t in data["entity_types"])