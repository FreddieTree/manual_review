# routes/arbitration.py
from flask import Blueprint, request, session, jsonify
from arbitration import get_arbitration_queue, set_arbitration_result

arbitration_api = Blueprint("arbitration_api", __name__)

@arbitration_api.route("/api/arbitration_queue", methods=["GET"])
def api_arbitration_queue():
    try:
        queue = get_arbitration_queue()
        if not isinstance(queue, list):
            queue = []
        return jsonify(queue)
    except Exception:
        return jsonify([])  # 无论如何都保证为list

@arbitration_api.route("/api/arbitrate", methods=["POST"])
def api_arbitrate():
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "Not authorized"}), 403
    data = request.json or {}
    pmid = data.get("pmid")
    assertion_id = data.get("assertion_id")
    decision = data.get("decision")
    comment = data.get("comment", "")
    admin = session.get("email")
    try:
        rec = set_arbitration_result(pmid, assertion_id, decision, admin, comment)
        return jsonify({"success": True, "log": rec})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500