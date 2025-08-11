import json
import time
import pytest

from backend.app import app as flask_app
from backend.models.db import abstracts_col
from backend.services.aggregation import get_detailed_assertion_summary
from backend.models.abstracts import get_abstract_by_id


@pytest.fixture(scope="module")
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as c:
        yield c


@pytest.fixture()
def fake_abstract_pmid():
    pmid = "pmid_test_e2e_001"
    # Clean up before
    abstracts_col.delete_many({"pmid": pmid})
    doc = {
        "pmid": pmid,
        "title": "Test Abstract for Two Reviewer Flow",
        "sentences": [
            {
                "sentence_index": 1,
                "sentence": "Aspirin reduces pain in patients.",
                "assertions": [
                    {"subject": "Aspirin", "subject_type": "chem", "predicate": "reduces", "object": "pain", "object_type": "sosy", "negation": False}
                ],
            },
            {
                "sentence_index": 2,
                "sentence": "Ibuprofen causes nausea in rare cases.",
                "assertions": [
                    {"subject": "Ibuprofen", "subject_type": "chem", "predicate": "causes", "object": "nausea", "object_type": "sosy", "negation": False}
                ],
            },
        ],
    }
    abstracts_col.insert_one(doc)
    try:
        yield pmid
    finally:
        # Cleanup: remove fake abstract
        abstracts_col.delete_many({"pmid": pmid})


def _login_as(client, email, name, is_admin=False):
    with client.session_transaction() as sess:
        sess["email"] = email
        sess["name"] = name
        sess["is_admin"] = bool(is_admin)


def _lock_to_pmid(client, pmid: str):
    with client.session_transaction() as sess:
        sess["current_abs_id"] = pmid


def _submit_review(client, payload):
    resp = client.post("/api/submit_review", data=json.dumps(payload), content_type="application/json")
    return resp


def test_two_reviewer_flow_consensus_then_arbitration(client, fake_abstract_pmid):
    pmid = fake_abstract_pmid

    # Reviewer 1 logs in and gets assignment
    _login_as(client, "r1@example.com", "Reviewer1")
    _lock_to_pmid(client, pmid)
    abs1 = get_abstract_by_id(pmid)

    # Reviewer 1: accept S1, reject S2
    review_states_r1 = {
        1: [{"review": "accept", "comment": ""}],
        2: [{"review": "reject", "comment": ""}],
    }
    payload1 = {
        "pmid": pmid,
        "sentence_results": abs1.get("sentence_results", []),
        "review_states": {str(k): v for k, v in review_states_r1.items()},
    }
    resp1 = _submit_review(client, payload1)
    assert resp1.status_code == 200, resp1.get_json()

    # Reviewer 2 logs in and gets assignment
    _login_as(client, "r2@example.com", "Reviewer2")
    _lock_to_pmid(client, pmid)
    abs2 = get_abstract_by_id(pmid)

    # Reviewer 2: accept both -> S1 consensus (two distinct reviewers), S2 conflict (accept vs reject)
    review_states_r2 = {
        1: [{"review": "accept", "comment": ""}],
        2: [{"review": "accept", "comment": ""}],
    }
    payload2 = {
        "pmid": pmid,
        "sentence_results": abs2.get("sentence_results", []),
        "review_states": {str(k): v for k, v in review_states_r2.items()},
    }
    resp2 = _submit_review(client, payload2)
    assert resp2.status_code == 200, resp2.get_json()

    time.sleep(0.1)
    summary = get_detailed_assertion_summary(pmid)

    # Helper to read status by matching sentence text of last log
    sents = {s.get("sentence_index"): s.get("sentence") for s in abs2.get("sentence_results", [])}

    def _status_for_sentence_text(text):
        for item in summary:
            logs = item.get("logs", [])
            if logs and logs[-1].get("sentence_text") == text:
                return item.get("consensus_status")
        return None

    assert _status_for_sentence_text(sents[1]) == "consensus"
    s2_status = _status_for_sentence_text(sents[2])
    assert s2_status in ("conflict", "pending", "arbitrated")

    # Admin arbitrates conflict if any
    _login_as(client, "admin@example.com", "Admin", is_admin=True)
    qresp = client.get(f"/api/arbitration/queue?pmid={pmid}")
    qdata = qresp.get_json()
    assert qdata["success"]
    items = qdata["data"]["items"]

    if items:
        conflict_item = items[0]
        assertion_key = conflict_item.get("assertion_key")
        dresp = client.post(
            "/api/arbitration/decide",
            data=json.dumps({"pmid": pmid, "assertion_key": assertion_key, "decision": "accept", "comment": "admin consensus"}),
            content_type="application/json",
        )
        assert dresp.status_code == 200, dresp.get_json()

        time.sleep(0.1)
        final_summary = get_detailed_assertion_summary(pmid)
        # Ensure arbitrated or consensus
        assert any(item.get("consensus_status") in ("consensus", "arbitrated") for item in final_summary)


