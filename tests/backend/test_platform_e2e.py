import json
import os
from pathlib import Path

import pytest
from backend.app import create_app


@pytest.fixture(scope="module")
def test_client(tmp_path_factory, monkeypatch):
    # Prepare temp abstracts JSONL with one abstract and one sentence/assertion
    tmp_dir = tmp_path_factory.mktemp("data")
    abstracts_path = tmp_dir / "abstracts.jsonl"
    abstract = {
        "pmid": "P1",
        "title": "Sample",
        "journal": "J",
        "year": "2025",
        "sentence_results": [
            {
                "sentence_index": 0,
                "sentence": "Morbid obesity causes risk of disease.",
                "assertions": [
                    {
                        "assertion_index": 1,
                        "subject": "morbid obesity",
                        "subject_type": "dsyn",
                        "predicate": "CAUSES",
                        "object": "risk",
                        "object_type": "fndg",
                        "negation": False,
                    }
                ],
            }
        ],
        "sentence_count": 1,
    }
    abstracts_path.write_text(json.dumps(abstract) + "\n", encoding="utf-8")

    # Env for backend
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(abstracts_path))
    monkeypatch.setenv("MANUAL_REVIEW_ADMIN_EMAIL", "admin@bristol.ac.uk")
    # Use a temp data dir for logs/exports
    data_dir = tmp_dir
    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(data_dir))

    app = create_app()
    app.config.update({"TESTING": True})
    with app.test_client() as client:
        yield client


def _login(client, name, email):
    return client.post(
        "/api/login", data=json.dumps({"name": name, "email": email}), content_type="application/json"
    )


def test_admin_login_and_whitelist(test_client):
    # Admin login
    resp = _login(test_client, "Admin", "admin@bristol.ac.uk")
    body = resp.get_json()
    assert resp.status_code == 200 and body["success"] and body.get("is_admin")

    # Add a reviewer to whitelist
    r = test_client.post(
        "/api/reviewers",
        data=json.dumps({"email": "r1@bristol.ac.uk", "name": "R1", "active": True, "role": "reviewer"}),
        content_type="application/json",
    )
    assert r.status_code == 200 and r.get_json()["success"]


def test_reviewer_assignment_and_submit_add(test_client):
    # Reviewer login
    r = _login(test_client, "R1", "r1@bristol.ac.uk")
    assert r.status_code == 200 and r.get_json()["success"] and not r.get_json().get("is_admin")

    # Assignment
    g = test_client.get("/api/assigned_abstract")
    assert g.status_code == 200 and g.get_json()["success"]
    data = g.get_json()["data"]
    assert data.get("assigned_pmid") == "P1"

    # Submit: add a compliant assertion via legacy flat fields
    payload = {
        "pmid": "P1",
        "sentence_results": data["abstract"]["sentence_results"],
        "form_data": {
            # add on sentence 0
            "useradd_subject_0": "obesity",
            "useradd_subject_type_0": "dsyn",
            "useradd_predicate_0": "causes",
            "useradd_object_0": "risk",
            "useradd_object_type_0": "fndg",
            "useradd_negation_0": "false",
            "useradd_comment_0": "new fact",
        },
        "review_states": {},
    }
    s = test_client.post("/api/submit_review", data=json.dumps(payload), content_type="application/json")
    assert s.status_code == 200 and s.get_json()["success"]
    assert s.get_json()["data"]["logs_written"] > 0


def test_second_reviewer_conflict_and_arbitration(test_client):
    # Admin adds a second reviewer
    _ = _login(test_client, "Admin", "admin@bristol.ac.uk")
    r = test_client.post(
        "/api/reviewers",
        data=json.dumps({"email": "r2@bristol.ac.uk", "name": "R2", "active": True}),
        content_type="application/json",
    )
    assert r.status_code == 200

    # Second reviewer logs in and gets assignment
    r2 = _login(test_client, "R2", "r2@bristol.ac.uk")
    assert r2.status_code == 200
    g = test_client.get("/api/assigned_abstract")
    assert g.status_code == 200
    abstract = g.get_json()["data"]["abstract"]

    # Submit a reject for an assertion snapshot matching the prior add (simulate by including same content)
    sent = abstract["sentence_results"][0]
    synthetic_assertion = {
        "assertion_index": 99,
        "subject": "obesity",
        "subject_type": "dsyn",
        "predicate": "causes",
        "object": "risk",
        "object_type": "fndg",
        "negation": False,
    }
    sent_mod = {
        "sentence_index": sent["sentence_index"],
        "sentence": sent["sentence"],
        "assertions": [synthetic_assertion],
    }
    payload = {
        "pmid": "P1",
        "sentence_results": [sent_mod],
        "form_data": {},
        "review_states": {"0": [{"review": "reject", "comment": "disagree"}]},
    }
    s = test_client.post("/api/submit_review", data=json.dumps(payload), content_type="application/json")
    assert s.status_code == 200 and s.get_json()["success"]

    # Admin arbitration queue and decide
    _ = _login(test_client, "Admin", "admin@bristol.ac.uk")
    q = test_client.get("/api/arbitration/queue?only_conflicts=true")
    assert q.status_code == 200 and q.get_json()["success"]
    items = q.get_json()["data"]["items"]
    if items:
        akey = items[0]["assertion_key"]
        decide = test_client.post(
            "/api/arbitration/decide",
            data=json.dumps({"pmid": "P1", "assertion_key": akey, "decision": "accept", "comment": "final"}),
            content_type="application/json",
        )
        assert decide.status_code == 200 and decide.get_json()["success"]


def test_export_consensus_snapshot(test_client):
    _ = _login(test_client, "Admin", "admin@bristol.ac.uk")
    ex = test_client.get("/api/export_consensus")
    assert ex.status_code == 200 and ex.get_json()["success"]
    path = ex.get_json()["path"]
    assert Path(path).exists()


