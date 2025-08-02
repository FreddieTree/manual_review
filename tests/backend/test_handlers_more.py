def test_fallback_health_and_error_handlers(client, app, monkeypatch):
    # 调用 fallback _health（非蓝图版本）
    with app.test_request_context("/api/meta/health"):
        resp, status = app.view_functions["_health"]()
        assert status == 200
        assert resp.get_json()["success"] is True

    # 覆盖一个已注册 endpoint → 触发 Exception → 命中 @app.errorhandler(Exception)
    def boom():
        raise RuntimeError("boom")
    app.view_functions["reviewer_api.list_reviewers"] = boom
    r = client.get("/api/reviewers")
    assert r.status_code == 500
    j = r.get_json()
    assert j["success"] is False
    assert j["message"].lower().startswith("server error")

    # 覆盖另外一个 endpoint → abort(500) → 命中 @app.errorhandler(500)
    from flask import abort
    def boom_abort():
        abort(500)
    app.view_functions["auth_api.api_whoami"] = boom_abort
    r = client.get("/api/whoami")
    assert r.status_code == 500
    j = r.get_json()
    assert j["success"] is False