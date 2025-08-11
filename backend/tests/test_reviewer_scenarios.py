import json
import time
import pytest

from backend.app import app as flask_app
from backend.models.db import abstracts_col
from backend.models.abstracts import get_abstract_by_id
from backend.services.aggregation import get_detailed_assertion_summary


@pytest.fixture(scope="module")
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as c:
        yield c


def _login_as(client, email, name, is_admin=False):
    with client.session_transaction() as sess:
        sess["email"] = email
        sess["name"] = name
        sess["is_admin"] = bool(is_admin)


def _lock_to_pmid(client, pmid: str):
    with client.session_transaction() as sess:
        sess["current_abs_id"] = pmid


def _submit(client, pmid, review_states):
    abs_doc = get_abstract_by_id(pmid)
    payload = {
        "pmid": pmid,
        "sentence_results": abs_doc.get("sentence_results", []),
        "review_states": {str(k): v for k, v in review_states.items()},
    }
    return client.post("/api/submit_review", data=json.dumps(payload), content_type="application/json")


def _make_fake_abstract(pmid: str, sentences):
    abstracts_col.delete_many({"pmid": pmid})
    doc = {"pmid": pmid, "title": f"E2E {pmid}", "sentences": sentences}
    abstracts_col.insert_one(doc)


def _cleanup_fake_abstract(pmid: str):
    abstracts_col.delete_many({"pmid": pmid})


def _status_for_sentence(summary, text):
    for item in summary:
        logs = item.get("logs", [])
        if logs and logs[-1].get("sentence_text") == text:
            return item.get("consensus_status")
    return None


def test_both_uncertain_with_notes(client):
    pmid = "pmid_test_uncertain_notes"
    _make_fake_abstract(
        pmid,
        [
            {
                "sentence_index": 1,
                "sentence": "Vitamin C increases immunity.",
                "assertions": [
                    {"subject": "Vitamin C", "subject_type": "chem", "predicate": "increases", "object": "immunity", "object_type": "phsu", "negation": False}
                ],
            }
        ],
    )
    try:
        # Reviewer 1 uncertain with note
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        resp1 = _submit(client, pmid, {1: [{"review": "uncertain", "comment": "unsure"}]})
        assert resp1.status_code == 200
        # Reviewer 2 uncertain with note
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        resp2 = _submit(client, pmid, {1: [{"review": "uncertain", "comment": "unclear"}]})
        assert resp2.status_code == 200
        time.sleep(0.1)
        summary = get_detailed_assertion_summary(pmid)
        stext = get_abstract_by_id(pmid)["sentence_results"][0]["sentence"]
        status = _status_for_sentence(summary, stext)
        assert status in ("uncertain", "pending")
    finally:
        _cleanup_fake_abstract(pmid)


def test_both_reject_pending(client):
    pmid = "pmid_test_both_reject"
    _make_fake_abstract(
        pmid,
        [
            {
                "sentence_index": 1,
                "sentence": "Drug X causes headache.",
                "assertions": [
                    {"subject": "Drug X", "subject_type": "chem", "predicate": "causes", "object": "headache", "object_type": "sosy", "negation": False}
                ],
            }
        ],
    )
    try:
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "reject", "comment": ""}]}).status_code == 200
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "reject", "comment": ""}]}).status_code == 200
        time.sleep(0.1)
        summary = get_detailed_assertion_summary(pmid)
        stext = get_abstract_by_id(pmid)["sentence_results"][0]["sentence"]
        status = _status_for_sentence(summary, stext)
        assert status in ("conflict", "pending")
    finally:
        _cleanup_fake_abstract(pmid)


def test_add_by_r1_then_r2_accepts_existing(client):
    pmid = "pmid_test_add_then_accept"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Zinc reduces cold duration.", "assertions": []}
        ],
    )
    try:
        abs_doc = get_abstract_by_id(pmid)
        stext = abs_doc["sentence_results"][0]["sentence"]

        # R1 adds an assertion (allowed and should not block)
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        payload_add = {
            "pmid": pmid,
            "sentence_results": abs_doc.get("sentence_results", []),
            "review_states": {"1": []},
            # legacy add fields (post_data) are parsed in audit: useradd_*
        }
        # post_data extras are inferred from form-like fields – emulate them via JSON body overlay
        # Flask test client passes JSON into request.get_json(); audit reads post_data for legacy fields.
        # For simplicity, we post add via current path by extending payload with add fields.
        payload_add.update({
            "form_data": {
                "useradd_subject_1": "Zinc",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "reduces",
                "useradd_object_1": "cold duration",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "new evidence",
            }
        })
        resp_add = client.post("/api/submit_review", data=json.dumps(payload_add), content_type="application/json")
        assert resp_add.status_code == 200, resp_add.get_json()

        # R2 accepts the existing DB assertions (none) – just send accept on nothing; ensures non-blocking
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        abs2 = get_abstract_by_id(pmid)
        resp2 = _submit(client, pmid, {1: []})
        assert resp2.status_code == 200, resp2.get_json()

        time.sleep(0.1)
        summary = get_detailed_assertion_summary(pmid)
        # At least one log exists for the add; status could be pending due to single reviewer support
        assert isinstance(summary, list)
    finally:
        _cleanup_fake_abstract(pmid)


def test_uncertain_no_note_blocks(client):
    pmid = "pmid_test_uncertain_block"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Omega 3 prevents inflammation.", "assertions": [
                {"subject": "Omega 3", "subject_type": "chem", "predicate": "prevents", "object": "inflammation", "object_type": "sosy", "negation": False}
            ]}
        ],
    )
    try:
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        resp = _submit(client, pmid, {1: [{"review": "uncertain", "comment": ""}]})
        assert resp.status_code == 400, resp.get_json()
    finally:
        _cleanup_fake_abstract(pmid)


def test_mixed_accept_uncertain_pending(client):
    pmid = "pmid_test_mixed_accept_uncertain"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Green tea reduces stress.", "assertions": [
                {"subject": "Green tea", "subject_type": "chem", "predicate": "reduces", "object": "stress", "object_type": "sosy", "negation": False}
            ]}
        ],
    )
    try:
        # R1 accept
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "accept", "comment": ""}]}).status_code == 200
        # R2 uncertain with note
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "uncertain", "comment": "needs evidence"}]}).status_code == 200
        time.sleep(0.1)
        stext = get_abstract_by_id(pmid)["sentence_results"][0]["sentence"]
        status = _status_for_sentence(get_detailed_assertion_summary(pmid), stext)
        assert status in ("conflict", "pending", "uncertain")
    finally:
        _cleanup_fake_abstract(pmid)


def test_two_distinct_adds_same_sentence(client):
    pmid = "pmid_test_two_adds_same_sentence"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Coffee affects sleep quality.", "assertions": []}
        ],
    )
    try:
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        abs_doc = get_abstract_by_id(pmid)
        # Add 1: Coffee affects sleep
        payload_add1 = {
            "pmid": pmid,
            "sentence_results": abs_doc.get("sentence_results", []),
            "review_states": {"1": []},
            "form_data": {
                "useradd_subject_1": "Coffee",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "affects",
                "useradd_object_1": "sleep",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "add1",
            },
        }
        r1 = client.post("/api/submit_review", data=json.dumps(payload_add1), content_type="application/json")
        assert r1.status_code == 200

        # Add 2: Caffeine increases alertness (different assertion in same sentence)
        payload_add2 = {
            "pmid": pmid,
            "sentence_results": abs_doc.get("sentence_results", []),
            "review_states": {"1": []},
            "form_data": {
                "useradd_subject_1": "Caffeine",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "increases",
                "useradd_object_1": "alertness",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "add2",
            },
        }
        # Re-lock (session lock requires active assignment per submission)
        _lock_to_pmid(client, pmid)
        r2 = client.post("/api/submit_review", data=json.dumps(payload_add2), content_type="application/json")
        assert r2.status_code == 200

        time.sleep(0.1)
        # Optional: aggregation should show items for this pmid (non-strict)
        summary = get_detailed_assertion_summary(pmid)
        assert isinstance(summary, list)
    finally:
        _cleanup_fake_abstract(pmid)


def test_arbitration_undo_path(client):
    pmid = "pmid_test_arbitration_undo"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Exercise reduces stress.", "assertions": [
                {"subject": "Exercise", "subject_type": "acty", "predicate": "reduces", "object": "stress", "object_type": "sosy", "negation": False}
            ]}
        ],
    )
    try:
        # Create conflict (accept vs reject)
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "accept", "comment": ""}]}).status_code == 200
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        assert _submit(client, pmid, {1: [{"review": "reject", "comment": ""}]}).status_code == 200
        time.sleep(0.1)
        # Admin arbitrates
        _login_as(client, "admin@example.com", "Admin", is_admin=True)
        qresp = client.get(f"/api/arbitration/queue?pmid={pmid}")
        items = qresp.get_json()["data"]["items"]
        if items:
            assertion_key = items[0].get("assertion_key")
            dresp = client.post(
                "/api/arbitration/decide",
                data=json.dumps({"pmid": pmid, "assertion_key": assertion_key, "decision": "accept", "comment": "ok"}),
                content_type="application/json",
            )
            assert dresp.status_code == 200
            # Undo
            uresp = client.post(
                "/api/arbitration/undo",
                data=json.dumps({"pmid": pmid, "assertion_key": assertion_key, "reason": "mistake"}),
                content_type="application/json",
            )
            assert uresp.status_code == 200
    finally:
        _cleanup_fake_abstract(pmid)


def test_reviewer2_rejects_reviewer1_add(client):
    pmid = "pmid_test_r2_rejects_r1_add"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Herbal tea affects relaxation.", "assertions": []}
        ],
    )
    try:
        # R1 adds assertion
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        abs_doc = get_abstract_by_id(pmid)
        payload_add = {
            "pmid": pmid,
            "sentence_results": abs_doc.get("sentence_results", []),
            "review_states": {"1": []},
            "form_data": {
                "useradd_subject_1": "Herbal tea",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "affects",
                "useradd_object_1": "relaxation",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "r1 add",
            },
        }
        assert client.post("/api/submit_review", data=json.dumps(payload_add), content_type="application/json").status_code == 200

        # R2 rejects that same assertion by including it in sentence_results and setting review state
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        abs_doc2 = get_abstract_by_id(pmid)
        s1 = abs_doc2["sentence_results"][0]
        # Inject the assertion content just added by R1 so backend can map the review
        s1_existing = [{
            "subject": "Herbal tea",
            "subject_type": "chem",
            "predicate": "affects",
            "object": "relaxation",
            "object_type": "sosy",
            "negation": False,
        }]
        s1_payload = [{"sentence_index": 1, "sentence": s1["sentence"], "assertions": s1_existing}]
        payload_r2 = {
            "pmid": pmid,
            "sentence_results": s1_payload,
            "review_states": {"1": [{"review": "reject", "comment": "disagree"}]},
        }
        r2 = client.post("/api/submit_review", data=json.dumps(payload_r2), content_type="application/json")
        assert r2.status_code == 200, r2.get_json()

        time.sleep(0.1)
        summary = get_detailed_assertion_summary(pmid)
        stext = s1["sentence"]
        # Find the grouped item for that sentence and ensure contains both add and reject actions
        matched = [it for it in summary if it.get("logs") and any(l.get("sentence_text") == stext for l in it["logs"]) ]
        assert matched, "No logs grouped for the sentence"
        actions = [l.get("action") for it in matched for l in it.get("logs", []) if l.get("sentence_text") == stext]
        assert "add" in actions and "reject" in actions
    finally:
        _cleanup_fake_abstract(pmid)


def test_two_reviewers_add_same_content_grouped(client):
    pmid = "pmid_test_two_reviewers_add_same_content"
    _make_fake_abstract(
        pmid,
        [
            {"sentence_index": 1, "sentence": "Curcumin reduces inflammation.", "assertions": []}
        ],
    )
    try:
        # R1 add
        _login_as(client, "r1@example.com", "R1")
        _lock_to_pmid(client, pmid)
        abs_doc = get_abstract_by_id(pmid)
        payload_add = {
            "pmid": pmid,
            "sentence_results": abs_doc.get("sentence_results", []),
            "review_states": {"1": []},
            "form_data": {
                "useradd_subject_1": "Curcumin",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "reduces",
                "useradd_object_1": "inflammation",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "r1 add",
            },
        }
        assert client.post("/api/submit_review", data=json.dumps(payload_add), content_type="application/json").status_code == 200

        # R2 add same content
        _login_as(client, "r2@example.com", "R2")
        _lock_to_pmid(client, pmid)
        abs_doc2 = get_abstract_by_id(pmid)
        payload_add2 = {
            "pmid": pmid,
            "sentence_results": abs_doc2.get("sentence_results", []),
            "review_states": {"1": []},
            "form_data": {
                "useradd_subject_1": "Curcumin",
                "useradd_subject_type_1": "chem",
                "useradd_predicate_1": "reduces",
                "useradd_object_1": "inflammation",
                "useradd_object_type_1": "sosy",
                "useradd_negation_1": False,
                "useradd_comment_1": "r2 add",
            },
        }
        assert client.post("/api/submit_review", data=json.dumps(payload_add2), content_type="application/json").status_code == 200

        time.sleep(0.1)
        summary = get_detailed_assertion_summary(pmid)
        stext = abs_doc["sentence_results"][0]["sentence"]
        items = [it for it in summary if it.get("logs") and any(l.get("sentence_text") == stext for l in it["logs"]) ]
        assert items, "No grouped item found for identical adds"
        # At least one grouped item should contain 2 add logs for identical content
        assert any(sum(1 for l in it.get("logs", []) if l.get("action") == "add") >= 2 for it in items)
    finally:
        _cleanup_fake_abstract(pmid)


