# backend/routes/export.py
from __future__ import annotations

from flask import Blueprint, jsonify, current_app, session

from ..services.aggregation import export_final_consensus  # 见下方说明
from ..services.export_service import export_passed_assertions

export_api = Blueprint("export_api", __name__, url_prefix="/api")

@export_api.route("/export_consensus", methods=["GET"])
def api_export_consensus():
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "not_authorized"}), 403
    try:
        count, out_path = export_final_consensus()
        return jsonify({"success": True, "exported_count": count, "path": str(out_path)})
    except Exception as e:
        current_app.logger.exception("Export consensus failed")
        return jsonify({"success": False, "error": "export_failed", "message": str(e)}), 500


@export_api.route("/export_passed", methods=["GET"])
def api_export_passed():
    """Export all compliant + arbitrated-passed assertions to jsonl with timestamped filename and SHA1."""
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "not_authorized"}), 403
    try:
        path, total, sha1 = export_passed_assertions("data/exports")
        return jsonify({
            "success": True,
            "path": path,
            "total": total,
            "sha1": sha1,
        }), 200
    except Exception as e:
        current_app.logger.exception("Export passed failed")
        return jsonify({"success": False, "error": "export_failed", "message": str(e)}), 500