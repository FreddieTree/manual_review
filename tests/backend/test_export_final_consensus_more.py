# tests/backend/test_export_final_consensus_more.py
import json
from pathlib import Path
from backend.models.logs import log_review_action
from backend.services.aggregation import export_final_consensus

def test_export_final_consensus_roundtrip(tmp_path):
    pmid = "EXP-1"
    # 两个 accept -> CONSENSUS
    log_review_action({"pmid": pmid, "action": "add", "subject": "A", "subject_type": "dsyn",
                       "predicate": "TREATS", "object": "B", "object_type": "phsu"})
    log_review_action({"pmid": pmid, "action": "accept", "reviewer": "r1@bristol.ac.uk"})
    log_review_action({"pmid": pmid, "action": "accept", "reviewer": "r2@bristol.ac.uk"})

    out_path = tmp_path / "final.jsonl"
    n, path = export_final_consensus(out_path)
    assert path == out_path and path.exists() and n >= 1

    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines
    rec = json.loads(lines[0])
    assert rec.get("final_decision") in ("consensus", "arbitrated")