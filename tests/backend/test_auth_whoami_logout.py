# tests/backend/test_auth_whoami_logout.py
def _admin_login(client):
    return client.post("/api/login", json={"name":"Admin User","email":"admin@bristol.ac.uk"})

def test_whoami_not_authenticated(client):
    r = client.get("/api/whoami")
    assert r.status_code == 401
    assert r.get_json()["success"] is False

def test_whoami_and_logout_flow(client):
    assert _admin_login(client).status_code == 200
    r = client.get("/api/whoami")
    j = r.get_json()
    assert r.status_code == 200 and j["success"] and j["user"]["is_admin"] is True
    r2 = client.post("/api/logout")
    assert r2.status_code == 200 and r2.get_json()["success"] is True