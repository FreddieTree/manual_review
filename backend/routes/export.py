# backend/routes/export.py
from __future__ import annotations

from flask import Blueprint, jsonify, current_app

from ..services.aggregation import export_final_consensus  # 见下方说明

export_api = Blueprint("export_api", __name__, url_prefix="/api")

@export_api.route("/export_consensus", methods=["GET"])
def api_export_consensus():
    try:
        count, out_path = export_final_consensus()
        return jsonify({"success": True, "exported_count": count, "path": str(out_path)})
    except Exception as e:
        current_app.logger.exception("Export consensus failed")
        return jsonify({"success": False, "error": "export_failed", "message": str(e)}), 500