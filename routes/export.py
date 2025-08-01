# routes/export.py
from flask import Blueprint, jsonify
from export import export_final_consensus

export_api = Blueprint("export_api", __name__)

@export_api.route("/api/export_consensus", methods=["GET"])
def api_export_consensus():
    count = export_final_consensus()
    return jsonify({"success": True, "exported_count": count})