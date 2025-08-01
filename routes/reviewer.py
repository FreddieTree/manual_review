from flask import Blueprint, request, jsonify, session
from models import (
    get_all_reviewers, add_reviewer, update_reviewer, delete_reviewer
)
from utils import is_valid_email

reviewer_api = Blueprint("reviewer_api", __name__)

# 获取所有审核员
@reviewer_api.route("/api/reviewers", methods=["GET"])
def api_get_all_reviewers():
    reviewers = get_all_reviewers()
    return jsonify(reviewers if isinstance(reviewers, list) else [])

# 新增审核员
@reviewer_api.route("/api/reviewers", methods=["POST"])
def api_add_reviewer():
    if not session.get("is_admin"):
        return jsonify({"success": False, "message": "Not authorized"}), 403
    data = request.json or {}
    email = (data.get("email") or "").lower().strip()
    name = (data.get("name") or "").strip()
    if not name or not email or not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid name or email"}), 400
    try:
        add_reviewer(email=email, name=name)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 409

# 更新审核员
@reviewer_api.route("/api/reviewers/<path:email>", methods=["PUT"])
def api_update_reviewer(email):
    if not session.get("is_admin"):
        return jsonify({"success": False, "message": "Not authorized"}), 403
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    try:
        update_reviewer(email=email.lower(), fields={"name": name})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 404

# 删除审核员
@reviewer_api.route("/api/reviewers/<path:email>", methods=["DELETE"])
def api_delete_reviewer(email):
    if not session.get("is_admin"):
        return jsonify({"success": False, "message": "Not authorized"}), 403
    try:
        delete_reviewer(email=email.lower())
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 404