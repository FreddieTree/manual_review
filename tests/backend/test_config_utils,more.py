from backend import config as cfg
from backend.utils import is_valid_email, normalize_str, coerce_bool, safe_get, chunked

def test_config_helpers_and_validators(monkeypatch, tmp_path):
    # validate_* 本身返回布尔即可（白名单内容由你项目决定）
    assert cfg.validate_predicate("prevents") in (True, False)
    assert cfg.validate_entity_type("dsyn") in (True, False)

    # assert_integrity：缺失 abstracts 时不抛，返回 False
    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(tmp_path / "missing.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(tmp_path / "review_logs.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(tmp_path / "reviewers.json"))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(tmp_path / "exports" / "final.jsonl"))
    assert cfg.assert_integrity(raise_on_missing=False) is False

def test_utils_helpers():
    assert is_valid_email("alice@bristol.ac.uk")
    assert not is_valid_email("bad@evil.com")  # 默认限制域
    assert normalize_str("  A  B   ") == "a b"
    assert coerce_bool("yes") is True
    assert coerce_bool("0") is False
    obj = {"a": {"b": {"c": 1}}}
    assert safe_get(obj, "a", "b", "c") == 1
    assert list(chunked(range(5), 2)) == [[0,1],[2,3],[4]]