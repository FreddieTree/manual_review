# tests/backend/test_aggregation_find_conflicts.py
import time
from backend.models.logs import log_review_action
from backend.services.aggregation import find_assertion_conflicts

def test_find_assertion_conflicts_basic(monkeypatch, tmp_path):
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(tmp_path/"logs.jsonl"))
    pmid = "7777"; now = time.time()
    # 一条断言，制造冲突
    log_review_action({"pmid": pmid,"action":"add","subject":"A","subject_type":"dsyn","predicate":"TREATS","object":"B","object_type":"phsu","created_at":now})
    log_review_action({"pmid": pmid,"action":"accept","created_at":now+1})
    log_review_action({"pmid": pmid,"action":"reject","timestamp":now+2})  # 覆盖 _ts 的另一分支
    items = find_assertion_conflicts(pmid)
    assert items and items[0]["pmid"] == pmid