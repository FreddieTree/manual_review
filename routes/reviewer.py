# routes/reviewer.py
from flask import Blueprint, request, jsonify, session
from functools import wraps
import logging
from typing import Any, Dict, List, Optional, Tuple

from models import (
    get_all_reviewers,
    add_reviewer,
    update_reviewer,
    delete_reviewer,
    get_reviewer_by_email,
)
from utils import is_valid_email

reviewer_api = Blueprint("reviewer_api", __name__, url_prefix="/api/reviewers")

# --- Logger setup ----------------------------------------------------------
logger = logging.getLogger("reviewer_api")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s reviewer_api: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- Helpers ---------------------------------------------------------------

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return _resp(False, message="Not authorized", error_code="not_authorized"), 403
        return f(*args, **kwargs)
    return decorated

def _normalize_email(raw: Any) -> str:
    if not raw or not isinstance(raw, str):
        return ""
    return raw.strip().lower()

def _resp(success: bool = True,
          data: Any = None,
          message: str = "",
          error_code: Optional[str] = None,
          meta: Optional[Dict[str, Any]] = None) -> Tuple[Any, int]:
    payload: Dict[str, Any] = {"success": success}
    if data is not None:
        payload["data"] = data
    if message:
        payload["message"] = message
    if error_code:
        payload["error_code"] = error_code
    if meta is not None:
        payload["meta"] = meta
    status = 200 if success else 400
    return jsonify(payload), status

def _sanitize_role(role: Any) -> str:
    role_str = str(role).lower() if role else "reviewer"
    return role_str if role_str in ("reviewer", "admin") else "reviewer"

# --- Routes ---------------------------------------------------------------

@reviewer_api.route("", methods=["GET"])
@require_admin
def list_reviewers():
    """
    List reviewers with search, pagination, optional sorting.
    Query params:
      - q: fuzzy match on name/email
      - page: 1-based
      - per_page: items per page (5..200)
      - sort: field to sort by (email/name), prefix '-' for desc
    """
    try:
        q = (request.args.get("q", "") or "").strip().lower()
        try:
            page = max(1, int(request.args.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            per_page = max(5, min(200, int(request.args.get("per_page", 50))))
        except (ValueError, TypeError):
            per_page = 50
        sort = request.args.get("sort", "email").strip()
        reverse = False
        if sort.startswith("-"):
            reverse = True
            sort = sort[1:]
        sort = sort if sort in ("email", "name") else "email"

        all_reviewers = get_all_reviewers() or []
        if q:
            filtered = [
                r for r in all_reviewers
                if q in (r.get("name") or "").lower() or q in (r.get("email") or "").lower()
            ]
        else:
            filtered = all_reviewers

        # sort
        try:
            filtered.sort(key=lambda r: (r.get(sort) or "").lower(), reverse=reverse)
        except Exception:
            pass  # fallback if unexpected structure

        total = len(filtered)
        start = (page - 1) * per_page
        paginated = filtered[start: start + per_page]

        meta = {
            "page": page,
            "per_page": per_page,
            "total": total,
            "returned": len(paginated),
            "sort": ("-" if reverse else "") + sort,
        }
        return _resp(True, data={"reviewers": paginated}, meta=meta)
    except Exception as e:
        logger.exception("Error listing reviewers")
        return _resp(False, message="Internal error", error_code="internal_error"), 500

@reviewer_api.route("/<path:email>", methods=["GET"])
@require_admin
def get_reviewer(email: str):
    normalized = _normalize_email(email)
    if not normalized or not is_valid_email(normalized):
        return _resp(False, message="Invalid email", error_code="invalid_email"), 400
    try:
        reviewer = get_reviewer_by_email(normalized)
        if not reviewer:
            return _resp(False, message="Reviewer not found", error_code="not_found"), 404
        return _resp(True, data=reviewer)
    except Exception:
        logger.exception("Error fetching reviewer %s", email)
        return _resp(False, message="Server error", error_code="internal_error"), 500

@reviewer_api.route("", methods=["POST"])
@require_admin
def add_reviewer_route():
    payload = request.get_json(silent=True) or {}
    email = _normalize_email(payload.get("email", ""))
    name = (payload.get("name") or "").strip()
    active = payload.get("active", True)
    role = _sanitize_role(payload.get("role"))
    note = payload.get("note", "")

    if not name:
        return _resp(False, message="Name required", error_code="missing_name"), 400
    if not email or not is_valid_email(email):
        return _resp(False, message="Valid email required", error_code="invalid_email"), 400

    try:
        add_reviewer(email=email, name=name, active=bool(active), role=role, note=str(note))
        actor = session.get("email", "unknown")
        logger.info("Reviewer %s added by %s", email, actor)
        return _resp(True, data={"email": email}, message="Reviewer added")
    except Exception as e:
        logger.exception("Failed to add reviewer %s", email)
        # Could differentiate ConflictError vs others if model exposes types
        return _resp(False, message="Could not add reviewer. Possibly already exists.", error_code="conflict"), 409

@reviewer_api.route("/<path:email>", methods=["PUT"])
@require_admin
def update_reviewer_route(email: str):
    payload = request.get_json(silent=True) or {}
    normalized = _normalize_email(email)
    if not normalized or not is_valid_email(normalized):
        return _resp(False, message="Invalid reviewer email", error_code="invalid_email"), 400

    update_fields: Dict[str, Any] = {}
    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            return _resp(False, message="Name cannot be empty", error_code="missing_name"), 400
        update_fields["name"] = name
    if "active" in payload:
        update_fields["active"] = bool(payload.get("active"))
    if "role" in payload:
        role = _sanitize_role(payload.get("role"))
        update_fields["role"] = role
    if "note" in payload:
        update_fields["note"] = payload.get("note")

    if not update_fields:
        return _resp(False, message="No fields to update", error_code="nothing_to_update"), 400

    try:
        update_reviewer(email=normalized, fields=update_fields)
        actor = session.get("email", "unknown")
        logger.info("Reviewer %s updated by %s (%s)", normalized, actor, update_fields)
        return _resp(True, data={"email": normalized}, message="Reviewer updated")
    except Exception:
        logger.exception("Failed to update reviewer %s", normalized)
        return _resp(False, message="Could not update reviewer", error_code="internal_error"), 500

@reviewer_api.route("/<path:email>", methods=["DELETE"])
@require_admin
def delete_reviewer_route(email: str):
    normalized = _normalize_email(email)
    if not normalized or not is_valid_email(normalized):
        return _resp(False, message="Invalid email", error_code="invalid_email"), 400
    try:
        delete_reviewer(email=normalized)
        actor = session.get("email", "unknown")
        logger.info("Reviewer %s deleted by %s", normalized, actor)
        return _resp(True, message="Reviewer deleted")
    except Exception:
        logger.exception("Failed to delete reviewer %s", normalized)
        return _resp(False, message="Could not delete reviewer", error_code="internal_error"), 500