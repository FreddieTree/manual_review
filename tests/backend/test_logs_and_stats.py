import json
import os

def _read_lines(path):
    txt = path.read_text(encoding="utf-8")
    return [json.loads(l) for l in txt.strip().splitlines() if l.strip()]

def test_stats_after_add_and_modify(client, login_reviewer, logs_path):
    login_reviewer()
    # 领取
    abs_resp = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents = abs_resp["sentence_results"]

    # 新增一条（第二句）
    form_add = {
        "useradd_subject_1": "Paracetamol",
        "useradd_subject_type_1": "phsu",
        "useradd_predicate_1": "INHIBITS",
        "useradd_object_1": "pain",
        "useradd_object_type_1": "sosy",
        "useradd_negation_1": "false"
    }
    r1 = client.post("/api/submit_review", json={
        "pmid": abs_resp["pmid"],
        "sentence_results": sents,
        "form_data": form_add
    })
    assert r1.status_code == 200

    # 再次领取（同 pmid 会刷新/复用）
    abs_resp2 = client.get("/api/assigned_abstract").get_json()["data"]["abstract"]
    sents2 = abs_resp2["sentence_results"]

    # 修改一处（第一句）
    form_mod = {
        "review_0_0": "modify",
        "predicate_0_0": "INHIBITS"
    }
    r2 = client.post("/api/submit_review", json={
        "pmid": abs_resp2["pmid"],
        "sentence_results": sents2,
        "form_data": form_mod
    })
    assert r2.status_code == 200

    # 日志至少 2 条：add + modify
    logs = _read_lines(logs_path)
    actions = [l.get("action") for l in logs]
    assert "add" in actions and "modify" in actions

    # 检查统计函数（通过接口无法直接取，这里检日志算即可）
    adds = sum(1 for a in actions if a == "add")
    assert adds >= 1