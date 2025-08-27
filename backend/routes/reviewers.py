# backend/routes/reviewers.py
from __future__ import annotations

from flask import Blueprint, request, jsonify, session
import time
from functools import wraps
from typing import Any, Dict, Optional, Tuple, List

from ..models.reviewers import (
    get_all_reviewers,
    add_reviewer as _add_reviewer,
    update_reviewer as _update_reviewer,
    delete_reviewer as _delete_reviewer,
    get_reviewer_by_email as _get_reviewer_by_email,
)
from ..utils import is_valid_email
from ..config import get_logger, EMAIL_ALLOWED_DOMAINS
from ..models.logs import log_review_action

reviewer_api = Blueprint("reviewer_api", __name__, url_prefix="/api/reviewers")
logger = get_logger("routes.reviewer_api")

# -------------------- Helpers --------------------

def _resp(
    success: bool = True,
    data: Any = None,
    message: str = "",
    error_code: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    status: Optional[int] = None,
) -> Tuple[Any, int]:
    payload: Dict[str, Any] = {"success": success}
    if data is not None:
        payload["data"] = data
    if message:
        payload["message"] = message
    if error_code:
        payload["error_code"] = error_code
    if meta is not None:
        payload["meta"] = meta
    if status is None:
        status = 200 if success else 400
    return jsonify(payload), status


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return _resp(False, message="Not authorized", error_code="not_authorized", status=403)
        return f(*args, **kwargs)
    return decorated


def _normalize_email(raw: Any) -> str:
    return (raw or "").strip().lower() if isinstance(raw, str) else ""


def _sanitize_role(role: Any) -> str:
    r = (str(role or "").strip().lower()) or "reviewer"
    return r if r in ("reviewer", "admin") else "reviewer"


def _email_allowed(email: str) -> bool:
    """统一的邮箱校验：当白名单非空时启用域名限制。"""
    return is_valid_email(
        email,
        restrict_domain=bool(EMAIL_ALLOWED_DOMAINS),
        allowed_domains=EMAIL_ALLOWED_DOMAINS,
    )

# Auto-append domain if admin submits a prefix only
_DEF_DOMAIN = EMAIL_ALLOWED_DOMAINS[0] if EMAIL_ALLOWED_DOMAINS else "bristol.ac.uk"

def _coerce_email(email_or_prefix: str) -> str:
    e = (email_or_prefix or "").strip().lower()
    if not e:
        return ""
    if "@" in e:
        return e
    return f"{e}@{_DEF_DOMAIN}"

# -------------------- Routes --------------------

@reviewer_api.route("", methods=["GET"])
@require_admin
def list_reviewers():
    """
    List reviewers with search, pagination, optional sorting.
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
        sort = (request.args.get("sort", "email") or "").strip()
        reverse = False
        if sort.startswith("-"):
            reverse = True
            sort = sort[1:]
        sort = sort if sort in ("email", "name") else "email"
        active_param = request.args.get("active")
        active_filter: Optional[bool] = None
        if active_param is not None:
            val = (active_param or "").strip().lower()
            active_filter = val in ("1", "true", "yes", "on")

        items: List[Dict[str, Any]] = get_all_reviewers() or []
        if q:
            items = [r for r in items if q in (r.get("name") or "").lower() or q in (r.get("email") or "").lower()]
        if active_filter is not None:
            items = [r for r in items if bool(r.get("active", True)) == active_filter]
        try:
            items.sort(key=lambda r: (r.get(sort) or "").lower(), reverse=reverse)
        except Exception:
            pass
        total = len(items)
        start = (page - 1) * per_page
        page_items = items[start : start + per_page]
        meta = {
            "page": page,
            "per_page": per_page,
            "total": total,
            "returned": len(page_items),
            "sort": ("-" if reverse else "") + sort,
            "active": active_filter,
        }
        return _resp(True, data={"reviewers": page_items}, meta=meta)
    except Exception:
        logger.exception("Error listing reviewers")
        return _resp(False, message="Internal error", error_code="internal_error", status=500)


@reviewer_api.route("/<path:email>", methods=["GET"])
@require_admin
def get_reviewer(email: str):
    normalized = _normalize_email(email)
    from_format_ok = is_valid_email(normalized, restrict_domain=False)
    if not normalized or not from_format_ok:
        return _resp(False, message="Invalid email", error_code="invalid_email", status=400)
    try:
        reviewer = _get_reviewer_by_email(normalized)
        if not reviewer:
            return _resp(False, message="Reviewer not found", error_code="not_found", status=404)
        return _resp(True, data=reviewer)
    except Exception:
        logger.exception("Error fetching reviewer %s", email)
        return _resp(False, message="Server error", error_code="internal_error", status=500)


@reviewer_api.route("", methods=["POST"])
@require_admin
def add_reviewer_route():
    payload = request.get_json(silent=True) or {}
    email_input = (payload.get("email", "") or "").strip()
    email = _normalize_email(_coerce_email(email_input))
    name = (payload.get("name") or "").strip()
    active = bool(payload.get("active", True))
    role = _sanitize_role(payload.get("role"))
    note = str(payload.get("note", "") or "")

    if not name:
        return _resp(False, message="Name required", error_code="missing_name", status=400)
    if not email or not _email_allowed(email):
        return _resp(False, message="Invalid email", error_code="invalid_email", status=400)

    try:
        _add_reviewer(email=email, name=name, active=active, role=role, note=note)
        actor = session.get("email", "admin")
        logger.info("Reviewer %s added by %s", email, actor)
        try:
            log_review_action({
                "action": "admin_whitelist_add",
                "target_email": email,
                "by": actor,
                "created_at": time.time(),
            })
        except Exception:
            pass
        return _resp(True, data={"email": email}, message="Reviewer added")
    except ValueError as e:
        return _resp(False, message=str(e), error_code="conflict", status=409)
    except Exception:
        logger.exception("Failed to add reviewer %s", email)
        return _resp(False, message="Could not add reviewer", error_code="internal_error", status=500)


@reviewer_api.route("/<path:email>", methods=["PUT"])
@require_admin
def update_reviewer_route(email: str):
    payload = request.get_json(silent=True) or {}
    normalized = _normalize_email(email)
    if not normalized or not is_valid_email(normalized, restrict_domain=False):
        return _resp(False, message="Invalid reviewer email", error_code="invalid_email", status=400)

    try:
        existing = _get_reviewer_by_email(normalized)
    except Exception:
        logger.exception("Error fetching reviewer before update: %s", normalized)
        return _resp(False, message="Server error", error_code="internal_error", status=500)
    if not existing:
        return _resp(False, message="Reviewer not found", error_code="not_found", status=404)

    update_fields: Dict[str, Any] = {}
    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            return _resp(False, message="Name cannot be empty", error_code="missing_name", status=400)
        update_fields["name"] = name
    if "active" in payload:
        update_fields["active"] = bool(payload.get("active"))
    if "role" in payload:
        update_fields["role"] = "reviewer"
    if "note" in payload:
        update_fields["note"] = str(payload.get("note", "") or "")

    new_email = _normalize_email(payload.get("email"))
    if new_email and new_email != normalized:
        if not _email_allowed(new_email):
            return _resp(False, message="Invalid email", error_code="invalid_email", status=400)

    if not update_fields and not new_email:
        return _resp(False, message="No fields to update", error_code="nothing_to_update", status=400)

    try:
        _update_reviewer(email=normalized, fields=update_fields)
        actor = session.get("email", "admin")
        logger.info("Reviewer %s updated by %s (%s)", normalized, actor, update_fields)
        try:
            log_review_action({
                "action": "admin_whitelist_update",
                "target_email": normalized,
                "fields": update_fields,
                "by": actor,
                "created_at": time.time(),
            })
        except Exception:
            pass
        return _resp(True, data={"email": normalized}, message="Reviewer updated")
    except ValueError as e:
        return _resp(False, message=str(e), error_code="bad_request", status=400)
    except Exception:
        logger.exception("Failed to update reviewer %s", normalized)
        return _resp(False, message="Could not update reviewer", error_code="internal_error", status=500)


@reviewer_api.route("/<path:email>", methods=["DELETE"])
@require_admin
def delete_reviewer_route(email: str):
    normalized = _normalize_email(email)
    if not normalized or not is_valid_email(normalized, restrict_domain=False):
        return _resp(False, message="Invalid email", error_code="invalid_email", status=400)
    try:
        _delete_reviewer(email=normalized)
        actor = session.get("email", "admin")
        logger.info("Reviewer %s deleted by %s", normalized, actor)
        try:
            log_review_action({
                "action": "admin_whitelist_delete",
                "target_email": normalized,
                "by": actor,
                "created_at": time.time(),
            })
        except Exception:
            pass
        return _resp(True, message="Reviewer deleted")
    except Exception:
        logger.exception("Failed to delete reviewer %s", normalized)
        return _resp(False, message="Could not delete reviewer", error_code="internal_error", status=500)