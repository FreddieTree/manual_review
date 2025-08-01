# routes/reviewer.py
from flask import Blueprint, request, session, jsonify
from functools import wraps
from typing import Any, Dict, Optional
import traceback
import logging

from utils import is_valid_email
from models import (
    get_all_reviewers,
    add_reviewer,
    update_reviewer,
    delete_reviewer,
    get_reviewer_by_email,
    get_stats_for_reviewer,
    get_abstract_by_id,
    log_review_action,
)
from task_manager import assign_abstract_to_reviewer, release_assignment, who_has_abstract, release_expired_locks
from aggregate import get_detailed_assertion_summary

reviewer_api = Blueprint("reviewer_api", __name__, url_prefix="/api")

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def standard_response(data: Any = None, success: bool = True, error: Optional[str] = None) -> Dict[str, Any]:
    resp: Dict[str, Any] = {"success": success}
    if success:
        if data is not None:
            resp["data"] = data
    else:
        resp["error"] = error or "Unknown error"
    return resp


def require_login(f):
    @wraps(f)
    def inner(*args, **kwargs):
        if not session.get("email"):
            return jsonify(standard_response(success=False, error="Unauthorized")), 401
        return f(*args, **kwargs)
    return inner


def require_admin(f):
    @wraps(f)
    def inner(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify(standard_response(success=False, error="Not authorized")), 403
        return f(*args, **kwargs)
    return inner


def handle_exception(e):
    logger.exception("Unhandled exception: %s", e)
    msg = getattr(e, "args", [None])[0] or str(e)
    return jsonify(standard_response(success=False, error=msg)), 500


# ---- Reviewer management ----

@reviewer_api.route("/reviewers", methods=["GET"])
@require_admin
def api_get_all_reviewers():
    try:
        reviewers = get_all_reviewers()
        return jsonify(standard_response(data=reviewers))
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/reviewers", methods=["POST"])
@require_admin
def api_add_reviewer():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email", "") or "").lower().strip()
        name = (payload.get("name", "") or "").strip()
        if not name or not is_valid_email(email):
            return jsonify(standard_response(success=False, error="Invalid name or email")), 400
        add_reviewer(email=email, name=name)
        return jsonify(standard_response(data={"email": email}))
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/reviewers/<path:email>", methods=["PUT"])
@require_admin
def api_update_reviewer(email):
    try:
        payload = request.get_json(force=True, silent=True) or {}
        name = (payload.get("name", "") or "").strip()
        if not name:
            return jsonify(standard_response(success=False, error="Name required")), 400
        update_fields: Dict[str, Any] = {"name": name}
        if "active" in payload:
            update_fields["active"] = bool(payload.get("active"))
        if "role" in payload:
            update_fields["role"] = payload.get("role")
        if "note" in payload:
            update_fields["note"] = payload.get("note")
        update_reviewer(email=email.lower(), fields=update_fields)
        return jsonify(standard_response(data={"email": email.lower()}))
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/reviewers/<path:email>", methods=["DELETE"])
@require_admin
def api_delete_reviewer(email):
    try:
        delete_reviewer(email=email.lower())
        return jsonify(standard_response(data={"email": email.lower()}))
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/whoami", methods=["GET"])
@require_login
def api_whoami():
    try:
        email = session.get("email")
        user = get_reviewer_by_email(email)
        if not user:
            user = {"email": email, "name": session.get("name", ""), "active": True}
        return jsonify(standard_response(data=user))
    except Exception as e:
        return handle_exception(e)


# ---- Assignment & abstract retrieval ----

@reviewer_api.route("/assigned_abstract", methods=["GET"])
@require_login
def api_get_assigned_abstract():
    try:
        email = session.get("email")
        name = session.get("name", "")
        pmid = assign_abstract_to_reviewer(email=email, name=name)
        if not pmid:
            return jsonify(standard_response(success=False, error="No available abstracts")), 404
        abstract = get_abstract_by_id(pmid)
        if not abstract:
            return jsonify(standard_response(success=False, error="Assigned abstract missing")), 404
        release_expired_locks()
        holders = who_has_abstract(pmid)
        return jsonify(
            standard_response(
                data={
                    "abstract": abstract,
                    "lock_holders": [{"email": h[0], "last_seen": h[1]} for h in holders],
                }
            )
        )
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/release_assignment", methods=["POST"])
@require_login
def api_release_assignment():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        pmid = payload.get("pmid")
        if not pmid:
            return jsonify(standard_response(success=False, error="pmid required")), 400
        email = session.get("email")
        ok = release_assignment(email=email, pmid=pmid)
        return jsonify(standard_response(data={"released": ok}))
    except Exception as e:
        return handle_exception(e)


# ---- Pricing ----

@reviewer_api.route("/review/pricing", methods=["GET"])
@require_login
def api_pricing():
    try:
        abstract_id = (
            request.args.get("abstract")
            or request.args.get("abstractId")
            or request.args.get("abstract_id")
        )
        if not abstract_id:
            return jsonify(standard_response(success=False, error="abstract query parameter required")), 400
        abstract_obj = get_abstract_by_id(abstract_id)
        if not abstract_obj:
            return jsonify(standard_response(success=False, error="Abstract not found")), 404

        from config import REWARD_PER_ABSTRACT, REWARD_PER_ASSERTION_ADD

        sentence_count = abstract_obj.get("sentence_count") or len(abstract_obj.get("sentence_results", []))
        per_abstract = float(REWARD_PER_ABSTRACT)
        per_assertion_add = float(REWARD_PER_ASSERTION_ADD)
        estimated_for_this = round(per_abstract + sentence_count * 0.01, 3)
        total_base = round(per_abstract, 3)

        return jsonify(
            standard_response(
                data={
                    "per_abstract": per_abstract,
                    "per_assertion_add": per_assertion_add,
                    "sentence_count": sentence_count,
                    "total_base": total_base,
                    "estimated_for_this": estimated_for_this,
                    "currency": "£",
                }
            )
        )
    except Exception as e:
        return handle_exception(e)


@reviewer_api.route("/reviewer_stats", methods=["GET"])
@require_login
def api_reviewer_stats():
    try:
        email = session.get("email")
        stats = get_stats_for_reviewer(email)
        return jsonify(standard_response(data=stats))
    except Exception as e:
        return handle_exception(e)