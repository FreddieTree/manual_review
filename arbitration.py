# arbitration.py

import time
from config import REVIEW_LOGS_PATH
from aggregate import find_assertion_conflicts

def get_arbitration_queue():
    """
    获取所有需要仲裁的断言队列（全局）
    """
    return find_assertion_conflicts()

def set_arbitration_result(pmid, assertion_id, decision, admin_email, comment=""):
    """
    管理员仲裁一条冲突断言，写日志（决议如“accept/reject/modify”等）
    """
    record = {
        "action": "arbitrate",
        "arbitrate_decision": decision,
        "assertion_id": assertion_id,
        "pmid": pmid,
        "admin": admin_email,
        "comment": comment,
        "created_at": time.time()
    }
    with open(REVIEW_LOGS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record