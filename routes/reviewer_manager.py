# routes/reviewer_manage.py
from flask import Blueprint, request, jsonify
import json, os

REVIEWERS_PATH = "data/reviewers.json"
reviewer_manage_api = Blueprint("reviewer_manage_api", __name__)

def load_reviewers():
    if not os.path.exists(REVIEWERS_PATH):
        return []
    with open(REVIEWERS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_reviewers(reviewers):
    with open(REVIEWERS_PATH, "w", encoding="utf-8") as f:
        json.dump(reviewers, f, indent=2, ensure_ascii=False)

@reviewer_manage_api.route("/api/reviewers", methods=["GET"])
def get_reviewers():
    return jsonify(load_reviewers())

@reviewer_manage_api.route("/api/reviewers", methods=["POST"])
def add_reviewer():
    data = request.json
    reviewers = load_reviewers()
    # 检查重复
    if any(r["email"] == data["email"] for r in reviewers):
        return jsonify({"error": "Reviewer already exists"}), 409
    reviewers.append(data)
    save_reviewers(reviewers)
    return jsonify({"success": True})

@reviewer_manage_api.route("/api/reviewers/<email>", methods=["PUT"])
def edit_reviewer(email):
    reviewers = load_reviewers()
    for r in reviewers:
        if r["email"] == email:
            r.update(request.json)
            save_reviewers(reviewers)
            return jsonify({"success": True})
    return jsonify({"error": "Reviewer not found"}), 404

@reviewer_manage_api.route("/api/reviewers/<email>", methods=["DELETE"])
def del_reviewer(email):
    reviewers = load_reviewers()
    reviewers = [r for r in reviewers if r["email"] != email]
    save_reviewers(reviewers)
    return jsonify({"success": True})