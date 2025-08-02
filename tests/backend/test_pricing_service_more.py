# tests/backend/test_pricing_service_more.py
import backend.services.pricing as pricing_mod

def test_compute_pricing_for_abstract_found(monkeypatch):
    # 让 services.pricing 内部的 get_abstract_by_id 返回一个极简摘要
    monkeypatch.setattr(pricing_mod, "get_abstract_by_id", lambda x: {"pmid": str(x), "sentences": ["a", "b"]})
    # 让定价描述可预测且包含 per_abstract 字段
    monkeypatch.setattr(pricing_mod, "get_default_pricing_descriptor", lambda abs_obj: {
        "pmid": abs_obj.get("pmid") if abs_obj else "",
        "per_abstract": 10.0,
        "per_assertion_add": 0.5,
        "currency": "USD",
        "units": {"abstracts": 1, "sentences": len(abs_obj.get("sentences", [])) if abs_obj else 0},
        "amount": 10.0,
    })
    out = pricing_mod.compute_pricing_for_abstract("123")
    assert out and out["pmid"] == "123" and out["per_abstract"] == 10.0

def test_compute_pricing_for_abstract_not_found(monkeypatch):
    monkeypatch.setattr(pricing_mod, "get_abstract_by_id", lambda x: None)
    # 即使不打桩 descriptor，找不到摘要应返回 None（路由层会转成 404）
    out = pricing_mod.compute_pricing_for_abstract("nope")
    assert out is None

def test_compute_default_pricing(monkeypatch):
    monkeypatch.setattr(pricing_mod, "get_default_pricing_descriptor", lambda abs_obj: {
        "pmid": "",
        "per_abstract": 8.0,
        "per_assertion_add": 0.0,
        "currency": "USD",
        "units": {"abstracts": 1, "sentences": 0},
        "amount": 8.0,
    })
    out = pricing_mod.compute_default_pricing()
    assert out["per_abstract"] == 8.0 and out["units"]["abstracts"] == 1