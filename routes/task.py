# routes/task.py
from flask import Blueprint, request, session, jsonify
from task_manager import assign_abstract_to_reviewer, release_expired_locks
from models import get_abstract_by_id, log_review_action
from reviewer import audit_review_submission

task_api = Blueprint("task_api", __name__)

@task_api.route("/api/assigned_abstract", methods=["GET"])
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

@task_api.route("/api/submit_review", methods=["POST"])
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