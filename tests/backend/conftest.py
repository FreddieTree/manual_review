import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]  # project root
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
# ------------------------------------------------------------

import os
import json
import pytest

@pytest.fixture(scope="session")
def _seed_sample_files(tmp_path_factory):
    """
    生成一次基础样本数据（抽象、审稿人、空日志）。
    其他用例会把它复制到各自的隔离目录。
    """
    d = tmp_path_factory.mktemp("seed_data")
    abstracts = d / "sentence_level_gpt4.1.jsonl"
    reviewers = d / "reviewers.json"
    logs = d / "review_logs.jsonl"

    abs_obj = {
        "pmid": "1001",
        "sentence_results": [
            {
                "sentence_index": 0,
                "sentence": "Aspirin treats headache.",
                "assertions": [
                    {
                        "assertion_id": "a1",
                        "subject": "Aspirin",
                        "subject_type": "phsu",
                        "predicate": "TREATS",
                        "object": "headache",
                        "object_type": "sosy",
                        "negation": False
                    }
                ]
            },
            {
                "sentence_index": 1,
                "sentence": "Paracetamol inhibits pain.",
                "assertions": []
            }
        ]
    }
    with abstracts.open("w", encoding="utf-8") as f:
        f.write(json.dumps(abs_obj, ensure_ascii=False) + "\n")

    reviewers.write_text(json.dumps([{
        "email": "alice@bristol.ac.uk",
        "name": "Alice Reviewer",
        "active": True,
        "role": "reviewer",
        "note": ""
    }], ensure_ascii=False, indent=2), encoding="utf-8")

    logs.write_text("", encoding="utf-8")

    return {
        "ABSTRACTS": abstracts,
        "REVIEWERS": reviewers,
        "LOGS": logs,
        "DATA_DIR": d
    }


@pytest.fixture()
def app(tmp_path, _seed_sample_files, monkeypatch):
    """
    为每个测试方法提供隔离的 Flask app 与数据目录。
    在 import backend.app 之前设置所有路径型环境变量。
    """
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "exports").mkdir(parents=True, exist_ok=True)

    abstracts = data_dir / "sentence_level_gpt4.1.jsonl"
    reviewers = data_dir / "reviewers.json"
    logs = data_dir / "review_logs.jsonl"

    abstracts.write_text(_seed_sample_files["ABSTRACTS"].read_text(encoding="utf-8"), encoding="utf-8")
    reviewers.write_text(_seed_sample_files["REVIEWERS"].read_text(encoding="utf-8"), encoding="utf-8")
    logs.write_text("", encoding="utf-8")

    # 在 import 之前设置
    monkeypatch.setenv("MANUAL_REVIEW_DATA_DIR", str(data_dir))
    monkeypatch.setenv("MANUAL_REVIEW_ABSTRACTS_PATH", str(abstracts))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(logs))
    monkeypatch.setenv("MANUAL_REVIEW_REVIEWERS_JSON", str(reviewers))
    monkeypatch.setenv("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(data_dir / "exports" / "final_consensus.jsonl"))

    # 管理员身份
    monkeypatch.setenv("MANUAL_REVIEW_ADMIN_EMAIL", "admin@bristol.ac.uk")
    monkeypatch.setenv("MANUAL_REVIEW_ADMIN_NAME", "Admin User")
    # 邮箱域限制
    monkeypatch.setenv("EMAIL_ALLOWED_DOMAINS", "bristol.ac.uk")

    # 审核模糊阈值
    monkeypatch.setenv("REVIEW_FUZZY_THRESHOLD", "0.80")

    from backend.app import create_app
    app = create_app()
    app.config.update(TESTING=True)
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def login_reviewer(client):
    def _login(name="Alice Reviewer", email="alice@bristol.ac.uk"):
        resp = client.post("/api/login", json={"name": name, "email": email})
        assert resp.status_code == 200, resp.get_data(as_text=True)
        j = resp.get_json()
        assert j["success"] and j.get("is_admin") is False
        return j
    return _login


@pytest.fixture()
def login_admin(client):
    def _login(name="Admin User", email="admin@bristol.ac.uk"):
        resp = client.post("/api/login", json={"name": name, "email": email})
        assert resp.status_code == 200, resp.get_json()
        j = resp.get_json()
        assert j["success"] and j.get("is_admin") is True
        return j
    return _login


@pytest.fixture()
def logs_path(monkeypatch):
    return Path(os.environ["MANUAL_REVIEW_REVIEW_LOGS_PATH"])