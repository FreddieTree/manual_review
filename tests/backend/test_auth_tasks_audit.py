def test_login_invalid_domain_rejected(client):
    r = client.post("/api/login", json={"name": "X", "email": "x@gmail.com"})
    assert r.status_code == 400
    j = r.get_json()
    assert j["success"] is False

def test_login_and_assign(client, login_reviewer):
    login_reviewer()
    r = client.get("/api/assigned_abstract")
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"]
    payload = data["data"]
    assert payload["assigned_pmid"] == "1001"
    assert payload["abstract"]["pmid"] == "1001"

def test_uncertain_requires_reason(client, login_reviewer):
    login_reviewer()
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 标记 uncertain 但不提供理由 -> 阻断
    form_data = {"review_0_0": "uncertain", "comment_0_0": ""}
    r = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 400
    body = r.get_json()
    assert body["error_code"] == "validation_failed"
    vios = body["data"]["violations"]
    assert any(v["code"] == "uncertain_reason_required" for v in vios)

def test_accept_disallowed_when_errors(client, login_reviewer):
    login_reviewer()
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 不提供 review_states，使用表单把 predicate 改成非白名单，同时仍选择 accept
    # 这会被判定：存在 error（白名单不通过）+ decision=accept -> 阻断
    form_data = {
        "review_0_0": "accept",
        "predicate_0_0": "FOO"  # 非白名单
    }
    r = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 400
    j = r.get_json()
    assert j["error_code"] == "validation_failed"
    vios = j["data"]["violations"]
    assert any(v["code"] == "predicate_not_whitelisted" for v in vios)
    assert any(v["code"] == "accept_disallowed_due_to_issues" for v in vios)

def test_modify_single_change_allowed_logs_written(client, login_reviewer, logs_path):
    login_reviewer()
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 单一变更：predicate 从 TREATS -> INHIBITS，其余保持不变，选择 modify
    form_data = {
        "review_0_0": "modify",
        "predicate_0_0": "INHIBITS"
    }
    r = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"] is True
    assert j["data"]["logs_written"] == 1

    # 检查日志内容
    content = logs_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(content) >= 1
    import json
    last = json.loads(content[-1])
    assert last["action"] == "modify"
    assert last["predicate"] == "INHIBITS"
    assert last["pmid"] == "1001"
    assert last["sentence_idx"] == 0

def test_modify_multiple_changes_warn_and_block_on_exact_match_error(client, login_reviewer):
    login_reviewer()
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 多处变更 + 对象不再为精确子串 -> 有 warning(multiple_changes) + error(object_not_found) -> 阻断
    form_data = {
        "review_0_0": "modify",
        "predicate_0_0": "INHIBITS",              # 变更1
        "object_0_0": "headache and pain"         # 变更2 且不在句内
    }
    r = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 400
    data = r.get_json()["data"]
    vios = data["violations"]
    assert any(v["code"] == "object_not_found" and v["level"] == "error" for v in vios)
    assert any(v["code"] == "multiple_changes" and v["level"] == "warning" for v in vios)

def test_add_new_assertion_fuzzy_suggestion_blocks(client, login_reviewer):
    login_reviewer()
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 第 1 句： "Paracetamol inhibits pain."
    # 故意拼写错 subject 触发 fuzzy 提示，但必须阻断
    form_data = {
        "useradd_subject_1": "Paracetmol",    # 拼写错（应为 Paracetamol）
        "useradd_subject_type_1": "phsu",
        "useradd_predicate_1": "INHIBITS",
        "useradd_object_1": "pain",
        "useradd_object_type_1": "sosy",
        "useradd_negation_1": "false"
    }
    r = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 400
    vios = r.get_json()["data"]["violations"]
    # 有 subject_not_found 错误，且带 fuzzy 建议
    assert any(v["code"] == "subject_not_found" and v.get("addition") for v in vios)
    assert any(v["code"] == "subject_fuzzy_match" and v.get("fuzzy_suggestion") for v in vios)

def test_add_new_assertion_success(client, login_reviewer, logs_path):
    login_reviewer()
    abs_payload = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_payload["sentence_results"]

    form_data = {
        "useradd_subject_1": "Paracetamol",
        "useradd_subject_type_1": "phsu",
        "useradd_predicate_1": "INHIBITS",
        "useradd_object_1": "pain",
        "useradd_object_type_1": "sosy",
        "useradd_negation_1": "false",
        "useradd_comment_1": "add new assertion"
    }

    r = client.post("/api/submit_review", json={
        "pmid": abs_payload["pmid"],
        "sentence_results": sents,
        "form_data": form_data
    })
    assert r.status_code == 200
    j = r.get_json()
    assert j["success"] is True
    assert j["data"]["logs_written"] >= 1

    # 检查一条 add 日志
    import json
    lines = logs_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) >= 1
    last = json.loads(lines[-1])
    assert last["action"] == "add"
    assert last["subject"] == "Paracetamol"
    assert last["predicate"] == "INHIBITS"
    assert last["object"] == "pain"