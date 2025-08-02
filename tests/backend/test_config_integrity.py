# tests/backend/test_config_integrity.py
import json, os
from pathlib import Path
import backend.config as cfg

def test_assert_integrity_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(tmp_path/"abs.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(tmp_path/"logs.jsonl"))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(tmp_path/"reviewers.json"))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(tmp_path/"exports"/"final.jsonl"))
    assert cfg.assert_integrity(raise_on_missing=False) is False

def test_assert_integrity_ok(monkeypatch, tmp_path):
    abs_p = tmp_path/"abs.jsonl"; abs_p.write_text('{"pmid":"1","sentences":["a"]}\n', encoding="utf-8")
    logs_p = tmp_path/"logs.jsonl"; logs_p.write_text("{}", encoding="utf-8")
    rev_p = tmp_path/"reviewers.json"; rev_p.write_text("{}", encoding="utf-8")
    export_p = tmp_path/"exports"/"final.jsonl"; export_p.parent.mkdir(parents=True, exist_ok=True); export_p.write_text("", encoding="utf-8")
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(abs_p))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(logs_p))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(rev_p))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(export_p))
    assert cfg.assert_integrity(raise_on_missing=False) is True