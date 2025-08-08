# backend/routes/tasks.py
from __future__ import annotations

import time
import logging
from functools import wraps
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, request, session, jsonify

from ..services.assignment import assign_abstract_to_reviewer, release_expired_locks, release_assignment, touch_assignment
from ..models.abstracts import get_abstract_by_id
from ..models.logs import log_review_action
from ..services.stats import get_stats_for_reviewer   # <-- 改为服务层
from ..services.audit import audit_review_submission

task_api = Blueprint("task_api", __name__, url_prefix="/api")

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s task_api: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

def success_response(data: Any = None, message: Optional[str] = None) -> Tuple[Any, int]:
    payload: Dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    if message:
        payload["message"] = message
    return jsonify(payload), 200

def error_response(
    message: str,
    status: int = 400,
    error_code: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Tuple[Any, int]:
    payload: Dict[str, Any] = {"success": False, "message": message}
    if error_code:
        payload["error_code"] = error_code
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status

def require_login(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("email"):
            return error_response("Not authenticated", status=401, error_code="not_logged_in")
        return f(*args, **kwargs)
    return wrapper


def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return error_response("Not authorized", status=403, error_code="not_authorized")
        return f(*args, **kwargs)
    return wrapper

@task_api.route("/assigned_abstract", methods=["GET"])
@require_login
def api_assigned_abstract():
    email = session.get("email")
    name = session.get("name", "")
    if not email:
        return error_response("Missing session email", status=401)

    try:
        release_expired_locks()
        pmid = assign_abstract_to_reviewer(email, name)
        if not pmid:
            return success_response({"no_more_tasks": True}, message="No available abstracts to assign.")

        session["current_abs_id"] = pmid
        abstract = get_abstract_by_id(pmid)
        if not abstract:
            return error_response(f"Assigned abstract {pmid} not found", status=404, error_code="abstract_not_found")

        stats: Dict[str, Any] = {}
        try:
            stats = get_stats_for_reviewer(email)
        except Exception:
            logger.debug("Failed to fetch reviewer stats for %s", email)

        payload = {"abstract": abstract, "assigned_pmid": pmid, "reviewer_stats": stats}
        return success_response(payload)
    except Exception as e:
        logger.exception("Error in assigned_abstract for %s", email)
        return error_response("Failed to assign abstract", status=500, error_code="assignment_error")


@task_api.route("/heartbeat", methods=["POST"])  # keep lock alive
@require_login
def api_heartbeat():
    email = session.get("email")
    pmid = session.get("current_abs_id")
    if not email or not pmid:
        return error_response("No active assignment", status=400, error_code="no_active_assignment")
    try:
        touched = touch_assignment(email, str(pmid))
        return success_response({"touched": bool(touched)})
    except Exception:
        return error_response("Failed to refresh lock", status=500, error_code="heartbeat_failed")


@task_api.route("/abandon", methods=["POST"])  # voluntarily release current assignment
@require_login
def api_abandon():
    email = session.get("email")
    pmid = session.get("current_abs_id")
    if not email or not pmid:
        return error_response("No active assignment", status=400, error_code="no_active_assignment")
    try:
        ok = release_assignment(email=email, pmid=str(pmid))
    except Exception:
        ok = False
    session.pop("current_abs_id", None)
    return success_response({"abandoned": bool(ok)})

@task_api.route("/submit_review", methods=["POST"])
@require_login
def api_submit_review():
    """
    接收审核提交，调用 services.audit：
      - 成功：写入 logs，返回 {success, logs_written, violations(如有)}
      - 校验失败：返回 {success: false, error_code: "validation_failed", data: {violations}}
    """
    email = session.get("email")
    name = session.get("name", "")
    if not email:
        return error_response("Not authenticated", status=401)

    payload: Dict[str, Any] = request.get_json(force=True, silent=True) or {}

    pmid = payload.get("pmid") or session.get("current_abs_id")
    if not pmid:
        return error_response("No abstract specified or assigned", status=400, error_code="missing_pmid")

    # Ensure reviewer only submits for their current lock
    if session.get("current_abs_id") != pmid:
        return error_response("Not authorized for this abstract", status=403, error_code="wrong_assignment")

    abstract = get_abstract_by_id(pmid)
    if not abstract:
        return error_response(f"Abstract {pmid} not found", status=404, error_code="abstract_not_found")

    sentence_results = payload.get("sentence_results", abstract.get("sentence_results", []))
    review_states = payload.get("review_states", {}) or {}
    form_data = payload.get("form_data", {}) or {}
    reviewer_info = {"email": email, "name": name}

    try:
        result = audit_review_submission(
            abs_id=pmid,
            sentence_results=sentence_results,
            post_data=form_data,
            reviewer_info=reviewer_info,
            review_states=review_states,
        )

        if isinstance(result, dict):
            logs = result.get("logs", [])
            violations = result.get("violations", [])
            can_commit = bool(result.get("can_commit", True))
        else:
            logs = list(result)
            violations = []
            can_commit = True

        if not can_commit:
            return error_response(
                "Submission has validation errors; please resolve and resubmit.",
                status=400,
                error_code="validation_failed",
                data={"violations": violations},
            )

        # Only proceed to write when all assertions for this abstract are compliant; append-only
        written = 0
        for log in logs:
            try:
                log_review_action(log)
                written += 1
            except Exception as e:
                logger.error("Failed to write individual log: %s", e)

        session.pop("current_abs_id", None)
        release_expired_locks()

        return success_response({
            "message": "Review submitted",
            "logs_written": written,
            "submitted_at": time.time(),
            "violations": violations,
        })
    except Exception as e:
        logger.exception("Audit or persistence failure for reviewer %s on %s", email, pmid)
        return error_response("Audit failed", status=500, error_code="audit_error")