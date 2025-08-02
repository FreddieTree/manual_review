# tests/backend/test_misc_small.py
from backend.services.vocab import predicates, entity_types
from backend.services.pricing import compute_pricing_for_abstract
from backend.services.stats import get_default_pricing_descriptor

def test_small_helpers():
    assert isinstance(predicates(), list)
    assert isinstance(entity_types(), list)

    # 传入最小抽象对象（含 pmid / sentences 字段）
    abs_obj = {"pmid": "1", "sentences": ["a"]}
    desc = get_default_pricing_descriptor(abs_obj)
    assert isinstance(desc, dict)

    price = compute_pricing_for_abstract(abs_obj)
    assert isinstance(price, dict)