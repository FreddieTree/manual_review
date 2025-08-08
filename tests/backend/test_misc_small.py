# tests/backend/test_misc_small.py
from backend.services.vocab import predicates, entity_types
from backend.services.stats import get_default_pricing_descriptor

def test_small_helpers():
    assert isinstance(predicates(), list)
    assert isinstance(entity_types(), list)

    # pass minimal abstract-like object (pmid / sentences)
    abs_obj = {"pmid": "1", "sentences": ["a"]}
    desc = get_default_pricing_descriptor(abs_obj)
    assert isinstance(desc, dict)