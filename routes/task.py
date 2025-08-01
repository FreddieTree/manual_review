# routes/task.py

import time
import logging
from functools import wraps
from typing import Any, Dict, Optional

from flask import Blueprint, request, session, jsonify, current_app

from task_manager import assign_abstract_to_reviewer, release_expired_locks, release_assignment
from models import get_abstract_by_id, log_review_action, get_stats_for_reviewer
from reviewer_utils import audit_review_submission

task_api = Blueprint("task_api", __name__, url_prefix="/api")

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s task_api: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


# --- Response helpers -------------------------------------------------------

def success_response(data: Any = None, message: Optional[str] = None):
    payload: Dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    if message:
        payload["message"] = message
    return jsonify(payload), 200


def error_response(message: str, status: int = 400, error_code: Optional[str] = None):
    payload: Dict[str, Any] = {"success": False, "message": message}
    if error_code:
        payload["error_code"] = error_code
    return jsonify(payload), status


# --- Authentication / session guard ---------------------------------------

def require_login(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("email"):
            return error_response("Not authenticated", status=401, error_code="not_logged_in")
        return f(*args, **kwargs)
    return wrapper


# --- Routes ---------------------------------------------------------------

@task_api.route("/assigned_abstract", methods=["GET"])
@require_login
def api_assigned_abstract():
    """
    Get or refresh assigned abstract for current reviewer.
    Returns:
      - abstract payload
      - assigned_pmid
      - optionally lock holders / reviewer stats
    """
    email = session.get("email")
    name = session.get("name", "")
    if not email:
        return error_response("Missing session email", status=401)

    try:
        # Clean stale locks first
        release_expired_locks()

        # Assign or refresh
        pmid = assign_abstract_to_reviewer(email, name)
        if not pmid:
            return success_response({"no_more_tasks": True}, message="No available abstracts to assign.")

        session["current_abs_id"] = pmid

        abstract = get_abstract_by_id(pmid)
        if not abstract:
            return error_response(f"Assigned abstract {pmid} not found", status=404, error_code="abstract_not_found")

        # Optional: include reviewer stats and current lock holders
        stats = {}
        try:
            stats = get_stats_for_reviewer(email)
        except Exception:
            logger.debug("Failed to fetch reviewer stats for %s", email)

        # build payload
        payload = {
            "abstract": abstract,
            "assigned_pmid": pmid,
            "reviewer_stats": stats,
        }

        return success_response(payload)
    except Exception as e:
        logger.exception("Error in assigned_abstract for %s", email)
        return error_response(f"Failed to assign abstract: {e}", status=500, error_code="assignment_error")


@task_api.route("/submit_review", methods=["POST"])
@require_login
def api_submit_review():
    """
    Accept review submission and persist atomic logs.

    Expected JSON structure:
    {
      pmid: optional string (falls back to session.current_abs_id),
      sentence_results: optional [...],  # usually provided for latest state
      review_states: optional structured decisions,
      form_data: optional legacy flat form field map
    }
    """
    email = session.get("email")
    name = session.get("name", "")
    if not email:
        return error_response("Not authenticated", status=401)

    payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}

    pmid = payload.get("pmid") or session.get("current_abs_id")
    if not pmid:
        return error_response("No abstract specified or assigned", status=400, error_code="missing_pmid")

    abstract = get_abstract_by_id(pmid)
    if not abstract:
        return error_response(f"Abstract {pmid} not found", status=404, error_code="abstract_not_found")

    sentence_results = payload.get("sentence_results", abstract.get("sentence_results", []))
    review_states = payload.get("review_states", {}) or {}
    form_data = payload.get("form_data", {}) or {}

    reviewer_info = {"email": email, "name": name}

    try:
        logs = audit_review_submission(
            abs_id=pmid,
            sentence_results=sentence_results,
            post_data=form_data,
            reviewer_info=reviewer_info,
            review_states=review_states,
        )
        if not isinstance(logs, list):
            logger.warning("audit_review_submission returned non-list for %s", email)
            return error_response("Invalid audit output", status=500, error_code="audit_malformed")

        # Persist logs
        written = 0
        for log in logs:
            try:
                log_review_action(log)
                written += 1
            except Exception as e:
                logger.error("Failed to write individual log: %s", e)

        # Release current assignment to allow next fetch
        session.pop("current_abs_id", None)
        release_expired_locks()

        return success_response(
            {
                "message": "Review submitted",
                "logs_written": written,
                "submitted_at": time.time(),
            }
        )
    except Exception as e:
        logger.exception("Audit or persistence failure for reviewer %s on %s", email, pmid)
        return error_response(f"Audit failed: {e}", status=500, error_code="audit_error")