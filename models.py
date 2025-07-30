import json
import time
import os
from config import ABSTRACTS_PATH

_abstracts_cache = None
_abstracts_last_mtime = 0

def load_abstracts(force_reload=False):
    global _abstracts_cache, _abstracts_last_mtime
    mtime = os.path.getmtime(ABSTRACTS_PATH)
    if _abstracts_cache is None or force_reload or mtime != _abstracts_last_mtime:
        abstracts = []
        with open(ABSTRACTS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    abstracts.append(json.loads(line))
        _abstracts_cache = abstracts
        _abstracts_last_mtime = mtime
    return _abstracts_cache

def get_abstract_by_id(abs_id):
    return next((a for a in load_abstracts() if str(a.get("pmid")) == str(abs_id)), None)

def get_all_pmids():
    return set(str(a.get("pmid")) for a in load_abstracts())

REVIEW_LOG_PATH = "data/review_logs.jsonl"
PER_ABSTRACT = 0.3
PER_ASSERTION_ADD = 0.05

def log_review_action(record):
    with open(REVIEW_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return True

def get_reviewer_logs(email):
    logs = []
    try:
        with open(REVIEW_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    log = json.loads(line)
                    if log.get("reviewer_email") == email:
                        logs.append(log)
    except Exception:
        pass
    return logs

def get_stats_for_reviewer(email):
    abs_ids = set()
    assertion_adds = 0
    logs = get_reviewer_logs(email)
    for log in logs:
        abs_ids.add(log.get("abstract_id"))
        if log.get("type") == "user_add":
            assertion_adds += 1
    total = len(abs_ids)
    commission = total * PER_ABSTRACT + assertion_adds * PER_ASSERTION_ADD
    return {
        "reviewed_abstracts": total,
        "assertions_added": assertion_adds,
        "commission": round(commission, 2)
    }

def assertion_exists(assertion_id):
    """Check if an assertion with given id is already logged."""
    try:
        with open(REVIEW_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                log = json.loads(line)
                if log.get("assertion_id") == assertion_id:
                    return True
    except Exception:
        pass
    return False

def get_log_by_assertion_id(assertion_id):
    """Find a log by assertion id."""
    try:
        with open(REVIEW_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                log = json.loads(line)
                if log.get("assertion_id") == assertion_id:
                    return log
    except Exception:
        pass
    return None