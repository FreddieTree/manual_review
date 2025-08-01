# routes/auth.py
from flask import Blueprint, request, session, jsonify
from config import SECRET_KEY, ADMIN_EMAIL, ADMIN_NAME
from utils import is_valid_email
from task_manager import assign_abstract_to_reviewer

auth_api = Blueprint("auth_api", __name__)

@auth_api.route("/api/login", methods=["POST"])
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

@auth_api.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})