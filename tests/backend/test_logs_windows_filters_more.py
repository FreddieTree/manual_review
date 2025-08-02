# tests/backend/test_logs_window_filters_more.py
import time
from backend.models.logs import log_review_action, get_reviewer_logs

def test_reviewer_logs_time_windows_and_all_actions(logs_path):
    email = "alice@bristol.ac.uk"
    t0 = time.time()
    log_review_action({"pmid": "3001", "action": "accept", "creator": email, "created_at": t0})
    log_review_action({"pmid": "3002", "action": "reject", "creator": email, "created_at": t0 + 5})
    log_review_action({"pmid": "3003", "action": "modify", "creator": email, "created_at": t0 + 10})

    # 无 actions -> 不去重，取全部
    all_logs = get_reviewer_logs(email)
    assert len([l for l in all_logs if l.get("creator") == email]) >= 3

    # 时间窗口：只取后 7 秒内的（应命中后两条）
    subset = get_reviewer_logs(email, since_ts=t0 + 3)
    assert len(subset) >= 2
    # 窄窗口：只命中中间那条
    narrow = get_reviewer_logs(email, since_ts=t0 + 3, until_ts=t0 + 7)
    assert any(l["pmid"] == "3002" for l in narrow)