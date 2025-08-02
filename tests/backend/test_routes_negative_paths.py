def test_pricing_error_path(client, monkeypatch):
    import backend.routes.pricing as pricing_mod
    def bad(*a, **k): raise RuntimeError("bad")
    monkeypatch.setattr(pricing_mod, "compute_pricing_for_abstract", bad, raising=True)
    r = client.get("/api/review/pricing?abstract=1001")
    assert r.status_code == 500
    j = r.get_json()
    assert j["success"] is False and j["error_code"] == "pricing_error"

def test_export_error_path(client, monkeypatch):
    import backend.routes.export as export_mod
    def bad(): raise RuntimeError("boom")
    monkeypatch.setattr(export_mod, "export_final_consensus", bad, raising=True)
    r = client.get("/api/export_consensus")
    assert r.status_code == 500
    j = r.get_json()
    assert j["success"] is False and j["error"] == "export_failed"