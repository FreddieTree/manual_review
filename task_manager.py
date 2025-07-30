# task_manager.py

import time

# 内存锁表, 生产用redis或sqlite实现
CURRENT_LOCKS = {}

def assign_abstract_to_reviewer(email, name):
    """
    Dummy: Assign the first unlocked abstract's pmid to reviewer.
    实际应检查锁/分配状态与已审核情况。
    """
    from models import load_abstracts
    for abstract in load_abstracts():
        pmid = str(abstract["pmid"])
        if pmid not in CURRENT_LOCKS or time.time() - CURRENT_LOCKS[pmid]["lock_time"] > 1800:
            # 分配此abstract
            CURRENT_LOCKS[pmid] = {"reviewer": email, "lock_time": time.time()}
            return pmid
    return None

def release_expired_locks():
    """释放超时锁（30分钟）"""
    now = time.time()
    expired = [pmid for pmid, lock in CURRENT_LOCKS.items() if now - lock["lock_time"] > 1800]
    for pmid in expired:
        del CURRENT_LOCKS[pmid]