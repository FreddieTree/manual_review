# tests/backend/test_reviewers_more_edges.py
def test_get_reviewer_404(client, login_admin):
    login_admin()
    r = client.get("/api/reviewers/missing@bristol.ac.uk")
    assert r.status_code == 404

def test_update_reviewer_empty_name(client, login_admin):
    login_admin()
    client.post("/api/reviewers", json={"email":"x@bristol.ac.uk","name":"X"})
    r = client.put("/api/reviewers/x@bristol.ac.uk", json={"name":""})
    assert r.status_code == 400

def test_update_reviewer_ok(client, login_admin):
    login_admin()
    client.post("/api/reviewers", json={"email":"y@bristol.ac.uk","name":"Y"})
    r = client.put("/api/reviewers/y@bristol.ac.uk", json={"name":"YY","role":"unknown"})
    assert r.status_code == 200