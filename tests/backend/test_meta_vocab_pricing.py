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

def test_pricing(client):
    r = client.get("/api/review/pricing")
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"]
    assert "per_abstract" in j["data"]
    assert "per_assertion_add" in j["data"]