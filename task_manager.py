import time
from config import REVIEW_TIMEOUT_MINUTES

# 内存锁，生产建议redis/sqlite
CURRENT_LOCKS = {}

def assign_abstract_to_reviewer(email, name):
    """
    Assign an unlocked/unreviewed abstract to reviewer.
    Returns: pmid or None if no tasks left.
    """
    from models import load_abstracts
    now = time.time()
    timeout = REVIEW_TIMEOUT_MINUTES * 60
    for abstract in load_abstracts():
        pmid = str(abstract["pmid"])
        # 跳过已分配两个reviewer的abstract
        lock = CURRENT_LOCKS.get(pmid)
        if lock:
            # 如果 reviewer1/reviewer2 还没分配或已超时释放，可以分配
            if len(lock["reviewers"]) < 2:
                # 不能分配给同一人
                if email not in lock["reviewers"]:
                    lock["reviewers"][email] = now
                    return pmid
            # 超时自动释放
            if any(now - t > timeout for t in lock["reviewers"].values()):
                CURRENT_LOCKS[pmid] = {"reviewers": {email: now}}
                return pmid
        else:
            # 完全没锁过
            CURRENT_LOCKS[pmid] = {"reviewers": {email: now}}
            return pmid
    return None

def release_expired_locks():
    """释放所有超时锁"""
    now = time.time()
    timeout = REVIEW_TIMEOUT_MINUTES * 60
    expired_pmids = []
    for pmid, lock in CURRENT_LOCKS.items():
        for email, t in list(lock["reviewers"].items()):
            if now - t > timeout:
                del lock["reviewers"][email]
        if not lock["reviewers"]:
            expired_pmids.append(pmid)
    for pmid in expired_pmids:
        del CURRENT_LOCKS[pmid]