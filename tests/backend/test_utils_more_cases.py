# tests/backend/test_utils_more_cases.py
from backend.utils import normalize_str
from backend.utils import _domain_matches  # 私有函数，测试其行为即可

def test_normalize_str_variants():
    assert normalize_str("  Mixed  CASE\ttext ") == "mixed case text"
    assert normalize_str(None) == ""
    assert normalize_str(123) == "123"

def test_domain_matches_modes():
    # 精确匹配
    assert _domain_matches("bristol.ac.uk", "bristol.ac.uk")
    assert not _domain_matches("x.bristol.ac.uk", "bristol.ac.uk")

    # "*.suffix" 仅子域（不含根域）
    assert _domain_matches("a.bristol.ac.uk", "*.bristol.ac.uk")
    assert not _domain_matches("bristol.ac.uk", "*.bristol.ac.uk")

    # ".suffix" 根域 + 子域
    assert _domain_matches("bristol.ac.uk", ".bristol.ac.uk")
    assert _domain_matches("a.bristol.ac.uk", ".bristol.ac.uk")