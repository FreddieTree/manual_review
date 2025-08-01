# routes/admin.py
from flask import Blueprint, jsonify
from models import get_all_pmids, get_all_reviewers
from aggregate import find_assertion_conflicts

admin_api = Blueprint("admin_api", __name__)

@admin_api.route("/api/admin_stats", methods=["GET"])
def api_admin_stats():
    stats = {
        "total_abstracts": len(get_all_pmids()),
        "total_reviewers": len(get_all_reviewers()),
        "conflicts": len(find_assertion_conflicts()),
        # 可补充更多
    }
    return jsonify(stats)