# backend/routes/meta.py
from __future__ import annotations

from flask import Blueprint, jsonify, current_app
from ..services.vocab import get_vocab_with_descriptions

bp = Blueprint("meta_api", __name__, url_prefix="/api/meta")

@bp.get("/health")
def health():
    return jsonify({"success": True, "data": {"status": "ok"}}), 200

@bp.get("/vocab")
def vocab():
    try:
        vocab = get_vocab_with_descriptions()
        return jsonify({"success": True, "data": vocab}), 200
    except Exception as e:
        current_app.logger.exception("Failed to get vocab")
        return jsonify({"success": False, "error_code": "vocab_error", "message": str(e)}), 500