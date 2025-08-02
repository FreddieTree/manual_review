# tests/backend/test_arbitration_queue_pending.py
import time
from backend.domain.assertions import make_assertion_id
from backend.models.logs import log_review_action

def test_arbitration_queue_include_pending(client):
    pmid = "PEND-1"
    aid = make_assertion_id("S", "dsyn", "TREATS", "O", "phsu")
    now = time.time()
    # add + uncertain -> UNCERTAIN
    log_review_action({"pmid": pmid, "action": "add", "subject": "S", "subject_type": "dsyn",
                       "predicate": "TREATS", "object": "O", "object_type": "phsu",
                       "assertion_id": aid, "created_at": now})
    log_review_action({"pmid": pmid, "action": "uncertain", "assertion_id": aid,
                       "reviewer": "r@bristol.ac.uk", "created_at": now + 1})

    r = client.get("/api/arbitration/queue?only_conflicts=false&include_pending=true")
    assert r.status_code == 200
    items = r.get_json()["data"]["items"]
    assert any(it["pmid"] == pmid and it["assertion_id"] == aid for it in items)