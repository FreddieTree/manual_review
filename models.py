import json
import os
from config import ABSTRACTS_PATH, REVIEW_LOGS_PATH

_abstracts_cache = None
_abstracts_last_mtime = 0

def load_abstracts(force_reload=False):
    global _abstracts_cache, _abstracts_last_mtime
    mtime = os.path.getmtime(ABSTRACTS_PATH)
    if force_reload or _abstracts_cache is None or mtime != _abstracts_last_mtime:
        abstracts = []
        with open(ABSTRACTS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    a = json.loads(line)
                    if "sentence_results" not in a or not isinstance(a["sentence_results"], list):
                        a["sentence_results"] = []
                    for s in a["sentence_results"]:
                        if "assertions" not in s or not isinstance(s["assertions"], list):
                            s["assertions"] = []
                    abstracts.append(a)
        _abstracts_cache = abstracts
        _abstracts_last_mtime = mtime
    return _abstracts_cache

def get_abstract_by_id(abs_id):
    abst = next((a for a in load_abstracts() if str(a.get("pmid")) == str(abs_id)), None)
    if abst is not None:
        if "sentence_results" not in abst or not isinstance(abst["sentence_results"], list):
            abst["sentence_results"] = []
        for s in abst["sentence_results"]:
            if "assertions" not in s or not isinstance(s["assertions"], list):
                s["assertions"] = []
    return abst

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
                    if log.get("creator") == email or log.get("reviewer") == email:
                        logs.append(log)
    except Exception:
        pass
    return logs

def get_stats_for_reviewer(email):
    abs_ids = set()
    assertion_adds = 0
    logs = get_reviewer_logs(email)
    for log in logs:
        abs_ids.add(log.get("pmid") or log.get("abstract_id"))
        if log.get("action") == "add":
            assertion_adds += 1
    total = len(abs_ids)
    commission = total * PER_ABSTRACT + assertion_adds * PER_ASSERTION_ADD
    return {
        "reviewed_abstracts": total,
        "assertions_added": assertion_adds,
        "commission": round(commission, 2)
    }

def assertion_exists(assertion_id):
    try:
        with open(REVIEW_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                log = json.loads(line)
                if log.get("assertion_id") == assertion_id:
                    return True
    except Exception:
        pass
    return False

def get_log_by_assertion_id(assertion_id):
    try:
        with open(REVIEW_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                log = json.loads(line)
                if log.get("assertion_id") == assertion_id:
                    return log
    except Exception:
        pass
    return None


REVIEWERS_JSON = "data/reviewers.json"

def _ensure_reviewers_file():
    if not os.path.exists(REVIEWERS_JSON):
        with open(REVIEWERS_JSON, "w", encoding="utf-8") as f:
            json.dump([], f)

def load_reviewers():
    _ensure_reviewers_file()
    with open(REVIEWERS_JSON, "r", encoding="utf-8") as f:
        return json.load(f)

def save_reviewers(data):
    with open(REVIEWERS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_all_reviewers():
    """Return all reviewers (list of dicts)"""
    return load_reviewers()

def add_reviewer(email, name, active=True, role="reviewer", note=""):
    email = email.lower().strip()
    allr = load_reviewers()
    if any(r['email'] == email for r in allr):
        raise Exception("Reviewer already exists.")
    allr.append({
        "email": email,
        "name": name.strip(),
        "active": bool(active),
        "role": role,
        "note": note
    })
    save_reviewers(allr)
    return True

def update_reviewer(email, fields:dict):
    email = email.lower().strip()
    allr = load_reviewers()
    found = False
    for r in allr:
        if r["email"] == email:
            r.update(fields)
            found = True
            break
    if not found:
        raise Exception("Reviewer not found.")
    save_reviewers(allr)
    return True

def delete_reviewer(email):
    email = email.lower().strip()
    allr = load_reviewers()
    allr = [r for r in allr if r["email"] != email]
    save_reviewers(allr)
    return True

