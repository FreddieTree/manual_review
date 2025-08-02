import time, json
from backend.models.logs import log_review_action, load_logs, get_reviewer_logs

def test_load_logs_tail_and_filters(logs_path):
    # 先写 5 条
    for i in range(5):
        log_review_action({"pmid":"1001","action":"add","creator":"u@bristol.ac.uk","created_at":time.time()+i})
    # tail 读取最后 3 行
    last3 = load_logs(limit=3)
    assert len(last3) == 3

    # 过滤：按 actions 与时间窗口
    ts0 = time.time()
    log_review_action({"pmid":"2002","action":"accept","creator":"alice@bristol.ac.uk","created_at":ts0})
    log_review_action({"pmid":"2003","action":"reject","creator":"alice@bristol.ac.uk","created_at":ts0+10})
    only_accept = get_reviewer_logs("alice@bristol.ac.uk", actions={"accept"})
    assert len(only_accept) == 1
    window = get_reviewer_logs("alice@bristol.ac.uk", since_ts=ts0+1, until_ts=ts0+20)
    assert len(window) == 1  # 只剩 reject 那条