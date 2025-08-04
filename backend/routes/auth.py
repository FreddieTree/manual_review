from __future__ import annotations

import time
from functools import wraps
from typing import Any, Dict

from flask import Blueprint, request, session, jsonify, current_app, make_response

from backend.config import ADMIN_EMAIL, ADMIN_NAME, EMAIL_ALLOWED_DOMAINS
from backend.utils import is_valid_email
from backend.services.assignment import assign_abstract_to_reviewer, release_assignment
from backend.models.reviewers import get_reviewer_by_email
from backend.models.logs import log_review_action, get_stats_for_reviewer

auth_api = Blueprint("auth_api", __name__, url_prefix="/api")


def standard_response(success: bool = True, **kwargs):
    """统一 JSON 结构体（不负责状态码）。"""
    payload = {"success": success}
    payload.update(kwargs)
    return jsonify(payload)


# ---- In-memory rate limiting (可替换为 Redis/外部) ----
_LOGIN_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
LOCKOUT_THRESHOLD = 5  # 窗口内失败次数
LOCKOUT_WINDOW = 60  # 秒
COOLDOWN_SECONDS = 120  # 锁定时长


def rate_limit_login(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr or "unknown"
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        key = f"{ip}:{email}"
        now = time.time()

        entry = _LOGIN_ATTEMPTS.get(key, {"attempts": [], "locked_until": 0})
        if entry.get("locked_until", 0) > now:
            retry_after = int(entry["locked_until"] - now)
            current_app.logger.warning("Rate limit active for %s, retry_after=%ss", key, retry_after)
            resp = make_response(
                standard_response(
                    False,
                    message="Too many failed login attempts. Try again later.",
                    error_code="rate_limited",
                    retry_after=retry_after,
                    locked_until=int(entry["locked_until"]),
                ),
                429,
            )
            resp.headers["Retry-After"] = str(retry_after)
            return resp

        result = f(*args, **kwargs)

        # 解析返回值（可能是 tuple 或 flask response）
        if isinstance(result, tuple):
            resp_obj, status = result[0], result[1]
        else:
            resp_obj = result
            status = getattr(resp_obj, "status_code", 200)

        # 判断是否成功登录
        is_success = False
        try:
            body = resp_obj.get_json() if hasattr(resp_obj, "get_json") else {}
            is_success = bool(body.get("success", False)) and status == 200
        except Exception:
            is_success = status == 200

        if not is_success:
            recent = [t for t in entry.get("attempts", []) if now - t < LOCKOUT_WINDOW]
            recent.append(now)
            entry["attempts"] = recent
            if len(recent) >= LOCKOUT_THRESHOLD:
                entry["locked_until"] = now + COOLDOWN_SECONDS
            _LOGIN_ATTEMPTS[key] = entry
        else:
            _LOGIN_ATTEMPTS.pop(key, None)

        return resp_obj, status

    return wrapper


# ---- helpers ----

ADMIN_LIKE_LOCALPARTS = {"admin", "administrator", "root"}


def _looks_like_admin_email(email: str) -> bool:
    try:
        local, _, domain = email.partition("@")
        if not local or not domain:
            return False
        if domain not in EMAIL_ALLOWED_DOMAINS:
            return False
        return local.lower() in ADMIN_LIKE_LOCALPARTS
    except Exception:
        return False


def _log_login(email: str, name: str, is_admin: bool) -> None:
    try:
        log_review_action(
            {
                "action": "login",
                "email": email,
                "name": name,
                "is_admin": is_admin,
                "created_at": time.time(),
                "ip": request.remote_addr,
                "user_agent": request.headers.get("User-Agent", ""),
            }
        )
    except Exception:
        current_app.logger.debug("Failed to log login for %s", email)


def _log_logout(email: str | None) -> None:
    try:
        log_review_action(
            {
                "action": "logout",
                "email": email,
                "created_at": time.time(),
                "ip": request.remote_addr,
                "user_agent": request.headers.get("User-Agent", ""),
            }
        )
    except Exception:
        current_app.logger.debug("Failed to log logout for %s", email)


# ---- Routes ----

@auth_api.route("/login", methods=["POST"])
@rate_limit_login
def api_login():
    data = request.get_json(silent=True) or request.form or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()

    current_app.logger.debug("LOGIN attempt name=%r email=%r", name, email)

    if not name or not is_valid_email(
        email,
        restrict_domain=bool(EMAIL_ALLOWED_DOMAINS),
        allowed_domains=EMAIL_ALLOWED_DOMAINS,
    ):
        return standard_response(False, message="Invalid name or email"), 400

    # 1) 精确匹配 admin email
    if ADMIN_EMAIL and email == ADMIN_EMAIL:
        session.clear()
        session.update({"name": name or ADMIN_NAME or "", "email": email, "is_admin": True})
        session.permanent = True
        _log_login(email, name or (ADMIN_NAME or ""), True)
        current_app.logger.info("Admin login via ADMIN_EMAIL: %s", email)
        return standard_response(True, is_admin=True), 200

    # 2) reviewer 登录
    reviewer = get_reviewer_by_email(email)
    if reviewer:
        if not reviewer.get("active", True):
            current_app.logger.warning("Inactive reviewer attempted login: %s", email)
            return standard_response(False, message="Not a valid reviewer account."), 403

        role = (reviewer.get("role") or "reviewer").strip().lower()
        display_name = (reviewer.get("name") or "").strip()
        if display_name and name != display_name:
            current_app.logger.warning("Reviewer name mismatch: %s != %s", name, display_name)
            return standard_response(False, message="Not a valid reviewer account."), 403

        is_admin = role == "admin"
        session.clear()
        session.update({"name": name or display_name, "email": email, "is_admin": is_admin})
        session.permanent = True

        _log_login(email, name or display_name, is_admin)

        if is_admin:
            current_app.logger.info("Admin reviewer login: %s", email)
            return standard_response(True, is_admin=True), 200

        assigned = None
        try:
            assigned = assign_abstract_to_reviewer(email, name or display_name)
        except Exception:
            current_app.logger.exception("Assignment error for %s", email)

        if not assigned:
            current_app.logger.info("No available abstract for reviewer %s", email)
            return (
                standard_response(
                    True,
                    is_admin=False,
                    no_more_tasks=True,
                    message="No available abstracts to assign.",
                ),
                200,
            )

        session["current_abs_id"] = assigned

        stats: Dict[str, Any] = {}
        try:
            stats = get_stats_for_reviewer(email)
        except Exception:
            current_app.logger.debug("Failed to get reviewer stats for %s", email)

        current_app.logger.info("Reviewer login + assignment: %s -> %s", email, assigned)
        return (
            standard_response(
                True,
                is_admin=False,
                assigned_abstract=assigned,
                reviewer_stats=stats,
            ),
            200,
        )

    # 3) 管理员兜底（localpart fallback）
    if _looks_like_admin_email(email):
        session.clear()
        session.update({"name": name, "email": email, "is_admin": True})
        session.permanent = True
        _log_login(email, name, True)
        current_app.logger.info("Admin login via fallback: %s", email)
        return standard_response(True, is_admin=True), 200

    current_app.logger.warning("Login rejected, reviewer not found: %s", email)
    return standard_response(False, message="Not a valid reviewer account."), 403


@auth_api.route("/logout", methods=["POST"])
def api_logout():
    email = session.get("email")
    pmid = session.get("current_abs_id")

    if email and pmid:
        try:
            release_assignment(email=email, pmid=str(pmid))
        except Exception:
            current_app.logger.debug("Failed to release assignment for %s", email)

    _log_logout(email)
    session.clear()
    return standard_response(True, message="Logged out"), 200


@auth_api.route("/whoami", methods=["GET"])
def api_whoami():
    if "email" not in session:
        return standard_response(False, message="Not authenticated"), 401

    email = session.get("email")
    name = session.get("name")
    is_admin = bool(session.get("is_admin", False))

    stats = {}
    if not is_admin:
        try:
            stats = get_stats_for_reviewer(email)
        except Exception:
            current_app.logger.debug("Could not fetch reviewer stats for %s", email)

    return (
        standard_response(
            True,
            user={
                "email": email,
                "name": name,
                "is_admin": is_admin,
                "current_assignment": session.get("current_abs_id"),
                "stats": stats,
            },
        ),
        200,
    )