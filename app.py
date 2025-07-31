from flask import Flask, request, session, jsonify
from flask_cors import CORS
from config import SECRET_KEY, ADMIN_EMAIL, ADMIN_NAME
from task_manager import assign_abstract_to_reviewer, release_expired_locks
from models import (
    load_abstracts, get_abstract_by_id, log_review_action, get_stats_for_reviewer, get_all_pmids, get_all_reviewers
)
from utils import is_valid_email
from reviewer import audit_review_submission

# 新增功能
from aggregate import find_assertion_conflicts
from arbitration import get_arbitration_queue, set_arbitration_result
from export import export_final_consensus

app = Flask(__name__)
app.secret_key = SECRET_KEY
CORS(app, supports_credentials=True)

# --------- 用户登录 ----------
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or request.form
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    if not name or not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid name/email"}), 400
    session.clear()
    session["name"] = name
    session["email"] = email
    session["is_admin"] = (email == ADMIN_EMAIL and name == ADMIN_NAME)
    if session["is_admin"]:
        return jsonify({"is_admin": True})
    abs_id = assign_abstract_to_reviewer(email, name)
    if abs_id is None:
        return jsonify({"no_more_tasks": True})
    session["current_abs_id"] = abs_id
    return jsonify({"success": True})

# --------- 领取任务 ----------
@app.route("/api/assigned_abstract", methods=["GET"])
def api_assigned_abstract():
    if not ("email" in session):
        return jsonify({"error": "not logged in"}), 403
    abs_id = session.get("current_abs_id")
    if not abs_id:
        abs_id = assign_abstract_to_reviewer(session["email"], session["name"])
        if abs_id is None:
            return jsonify({"no_more_tasks": True})
        session["current_abs_id"] = abs_id
    abst = get_abstract_by_id(abs_id)
    if not abst:
        return jsonify({"error": "abstract not found"}), 404
    return jsonify(abst)

# --------- 提交审核结果 ----------
@app.route("/api/submit_review", methods=["POST"])
def api_submit_review():
    if not ("email" in session):
        return jsonify({"error": "not logged in"}), 403
    data = request.json
    abs_id = session.get("current_abs_id")
    if not abs_id:
        return jsonify({"error": "no abstract assigned"}), 400
    abstract = get_abstract_by_id(abs_id)
    if not abstract:
        return jsonify({"error": "abstract not found"}), 404
    logs = audit_review_submission(
        abs_id=abs_id,
        sentence_results=abstract["sentence_results"],
        post_data=data,
        reviewer_info={
            "name": session["name"],
            "email": session["email"]
        }
    )
    for log in logs:
        log_review_action(log)
    release_expired_locks()
    session.pop("current_abs_id", None)
    return jsonify({"success": True})

# --------- 审核员数据统计与管理后台 ---------
@app.route("/api/admin_stats", methods=["GET"])
def api_admin_stats():
    total_abstracts = len(get_all_pmids())
    total_reviewers = len(get_all_reviewers())
    conflicts = len(find_assertion_conflicts())
    # 可扩展统计更多字段
    stats = {
        "total_abstracts": total_abstracts,
        "total_reviewers": total_reviewers,
        "conflicts": conflicts
    }
    return jsonify(stats)

# --------- 仲裁队列API ---------
@app.route("/api/arbitration_queue", methods=["GET"])
def api_arbitration_queue():
    return jsonify(get_arbitration_queue())

@app.route("/api/arbitrate", methods=["POST"])
def api_arbitrate():
    if not session.get("is_admin"):
        return jsonify({"error": "not authorized"}), 403
    data = request.json
    pmid = data.get("pmid")
    assertion_id = data.get("assertion_id")
    decision = data.get("decision")  # "accept"/"reject"/"modify"
    comment = data.get("comment", "")
    admin = session.get("email")
    rec = set_arbitration_result(pmid, assertion_id, decision, admin, comment)
    return jsonify({"success": True, "log": rec})

# --------- 导出最终共识/仲裁数据 ---------
@app.route("/api/export_consensus", methods=["GET"])
def api_export_consensus():
    count = export_final_consensus()
    return jsonify({"success": True, "exported_count": count})

# --------- 登出 ----------
@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)