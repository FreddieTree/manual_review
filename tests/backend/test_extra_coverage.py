# tests/backend/test_extra_coverage.py

def test_app_error_handlers_and_health(client, app, monkeypatch):
    # 200: 健康检查
    r = client.get("/api/meta/health")
    assert r.status_code == 200
    assert r.get_json()["success"] is True

    # 405: 用 POST 请求一个 GET-only 的接口
    r = client.post("/api/meta/health")
    assert r.status_code == 405
    j = r.get_json()
    assert j["success"] is False
    assert j["message"].lower().startswith("method not allowed")

    # 404: 不存在的路径
    r = client.get("/not_found_here")
    assert r.status_code == 404
    j = r.get_json()
    assert j["success"] is False
    assert j["message"].lower().startswith("not found")

    # 500：对已注册的 /api/meta/vocab 打补丁，让它抛异常
    import backend.routes.meta as meta_module

    def boom():
        raise RuntimeError("boom")

    # 注意：打补丁到 routes 层的符号（不是 services），因为蓝图在导入时已绑定了该符号
    monkeypatch.setattr(meta_module, "get_vocab_with_descriptions", boom, raising=True)

    r = client.get("/api/meta/vocab")
    assert r.status_code == 500
    j = r.get_json()
    assert j["success"] is False
    assert j["error_code"] == "vocab_error"