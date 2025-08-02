# tests/backend/test_config_integrity_more.py
import json
from pathlib import Path
import backend.config as cfg

def test_assert_integrity_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(tmp_path / "missing_abstracts.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(tmp_path / "logs.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(tmp_path / "reviewers.json"))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(tmp_path / "exports" / "final.jsonl"))
    assert cfg.assert_integrity(raise_on_missing=False) is False

def test_assert_integrity_ok(monkeypatch, tmp_path):
    # 准备最小可用数据
    abstracts = tmp_path / "abstracts.jsonl"
    reviewers = tmp_path / "reviewers.json"
    logs = tmp_path / "logs.jsonl"
    exports = tmp_path / "exports" / "final.jsonl"
    abstracts.write_text(json.dumps({"pmid": "1", "sentences": ["a"]}) + "\n", encoding="utf-8")
    reviewers.write_text(json.dumps([{"email": "ok@bristol.ac.uk", "name": "OK", "active": True}]), encoding="utf-8")
    logs.write_text("", encoding="utf-8")

    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(abstracts))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(logs))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(reviewers))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(exports))

    assert cfg.assert_integrity(raise_on_missing=False) is True