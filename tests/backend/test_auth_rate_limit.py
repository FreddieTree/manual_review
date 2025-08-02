# tests/backend/test_auth_rate_limit.py
import backend.routes.auth as auth_mod

def test_login_rate_limit(client, monkeypatch):
    # 将阈值调低，快速触发
    monkeypatch.setattr(auth_mod, "LOCKOUT_THRESHOLD", 2)
    monkeypatch.setattr(auth_mod, "LOCKOUT_WINDOW", 60)
    monkeypatch.setattr(auth_mod, "COOLDOWN_SECONDS", 3600)

    bad = {"name": "X", "email": "x@evil.com"}  # 非允许域 -> 400 (计入失败)
    r1 = client.post("/api/login", json=bad); assert r1.status_code in (400, 403)
    r2 = client.post("/api/login", json=bad); assert r2.status_code in (400, 403)
    # 第三次应 429
    r3 = client.post("/api/login", json=bad)
    assert r3.status_code == 429
    j = r3.get_json()
    assert j["success"] is False and j.get("error_code") == "rate_limited"