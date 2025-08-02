# tests/backend/test_utils_more.py
from backend.utils import normalize_email, normalize_str, safe_int, safe_float, coerce_bool, _domain_matches

def test_utils_bulk():
    assert normalize_email("  A@B.C  ") == "a@b.c"
    assert normalize_str("  Hello  ") == "hello"  # 小写
    assert safe_int("12", default=-1) == 12 and safe_int("x", default=-1) == -1
    assert safe_float("1.5", default=-1.0) == 1.5 and safe_float("x", default=-1.0) == -1.0
    assert coerce_bool("true") is True and coerce_bool("0") is False
    assert _domain_matches("x@bristol.ac.uk", {"bristol.ac.uk"})