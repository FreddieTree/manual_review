import time
import os
import json
from functools import wraps
from flask import Blueprint, request, session, jsonify, current_app
from config import ADMIN_EMAIL, ADMIN_NAME
from utils import is_valid_email
from task_manager import assign_abstract_to_reviewer
from models import get_stats_for_reviewer, log_review_action

auth_api = Blueprint("auth_api", __name__, url_prefix="/api")

# reviewers.json 路径
REVIEWERS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "reviewers.json"))

def load_reviewers():
    try:
        with open(REVIEWERS_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"[AUTH DEBUG] Failed to load reviewers.json: {e}")
        return None

def find_reviewer(email):
    reviewers = load_reviewers()
    if not reviewers:
        return None
    for r in reviewers:
        if r.get("email", "").strip().lower() == email:
            return r
    return None

# In-memory rate limiting; swap to Redis/more robust store in prod
_LOGIN_ATTEMPTS: dict = {}
LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW = 60
COOLDOWN_SECONDS = 120

def standard_response(success: bool = True, **kwargs):
    payload = {"success": success}
    payload.update(kwargs)
    return jsonify(payload)

def rate_limit_login(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr or "unknown"
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").lower()
        key = f"{ip}:{email}"
        now = time.time()
        entry = _LOGIN_ATTEMPTS.get(key, {"attempts": [], "locked_until": 0})

        # Check lockout
        if entry.get("locked_until", 0) > now:
            current_app.logger.warning(f"[AUTH DEBUG] Rate limit triggered for {key}")
            return standard_response(False, message="Too many failed login attempts. Try again later."), 429

        resp_tuple = f(*args, **kwargs)
        if isinstance(resp_tuple, tuple) and len(resp_tuple) == 2:
            resp_obj, status = resp_tuple
        else:
            return resp_tuple

        # Determine if it was a failure
        is_success = False
        try:
            json_body = resp_obj.get_json() if hasattr(resp_obj, "get_json") else {}
            is_success = bool(json_body.get("success", False))
        except Exception:
            is_success = status == 200

        if not is_success:
            entry["attempts"] = [t for t in entry.get("attempts", []) if now - t < LOCKOUT_WINDOW]
            entry["attempts"].append(now)
            if len(entry["attempts"]) >= LOCKOUT_THRESHOLD:
                entry["locked_until"] = now + COOLDOWN_SECONDS
            _LOGIN_ATTEMPTS[key] = entry
        else:
            _LOGIN_ATTEMPTS.pop(key, None)

        return resp_obj, status
    return wrapper

@auth_api.route("/login", methods=["POST"])
@rate_limit_login
def api_login():
    data = request.get_json(silent=True) or request.form or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    current_app.logger.debug(f"[LOGIN DEBUG] got name={name!r}, email={email!r}")
    current_app.logger.debug(f"[LOGIN DEBUG] ADMIN_EMAIL={ADMIN_EMAIL!r}, ADMIN_NAME={ADMIN_NAME!r}")

    if not name or not is_valid_email(email):
        current_app.logger.debug("[LOGIN DEBUG] Invalid name or email")
        return standard_response(False, message="Invalid name or email"), 400

    # 1. 管理员校验（只用环境变量，不走reviewers.json）
    if email == ADMIN_EMAIL and name == ADMIN_NAME:
        session.clear()
        session["name"] = name
        session["email"] = email
        session["is_admin"] = True
        session.permanent = True
        try:
            log_review_action({
                "action": "login",
                "email": email,
                "name": name,
                "is_admin": True,
                "timestamp": time.time(),
                "ip": request.remote_addr,
                "user_agent": request.headers.get("User-Agent", ""),
            })
        except Exception:
            current_app.logger.warning(f"[LOGIN DEBUG] Failed to record login for admin {email}")
        current_app.logger.info(f"[LOGIN DEBUG] Admin login success: {email}")
        return standard_response(True, is_admin=True), 200

    # 2. Reviewer 校验（严格按照reviewers.json判定）
    reviewer = find_reviewer(email)
    current_app.logger.debug(f"[LOGIN DEBUG] reviewer found: {reviewer}")
    if reviewer is None:
        current_app.logger.warning(f"[LOGIN DEBUG] Reviewer not found: {email}")
        return standard_response(False, message="Not a valid reviewer account."), 403

    # 检查状态/角色/名字完全一致
    if (
        not reviewer.get("active", True)
        or reviewer.get("role", "reviewer") != "reviewer"
        or reviewer.get("name", "").strip() != name
    ):
        current_app.logger.warning(f"[LOGIN DEBUG] Reviewer status/name/role failed: {reviewer}")
        return standard_response(False, message="Not a valid reviewer account."), 403

    # 成功登陆/分配任务/写session
    session.clear()
    session["name"] = name
    session["email"] = email
    session["is_admin"] = False
    session.permanent = True

    try:
        log_review_action({
            "action": "login",
            "email": email,
            "name": name,
            "is_admin": False,
            "timestamp": time.time(),
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", ""),
        })
    except Exception:
        current_app.logger.warning(f"[LOGIN DEBUG] Failed to record login for reviewer {email}")

    assigned = assign_abstract_to_reviewer(email, name)
    if not assigned:
        current_app.logger.info(f"[LOGIN DEBUG] No available abstract for reviewer {email}")
        return standard_response(True, is_admin=False, no_more_tasks=True, message="No available abstracts to assign."), 200

    session["current_abs_id"] = assigned
    stats = {}
    try:
        stats = get_stats_for_reviewer(email)
    except Exception:
        current_app.logger.debug(f"[LOGIN DEBUG] Could not fetch reviewer stats for {email}")

    current_app.logger.info(f"[LOGIN DEBUG] Reviewer login+assignment success: {email}, assigned {assigned}")
    return standard_response(
        True,
        is_admin=False,
        assigned_abstract=assigned,
        reviewer_stats=stats,
    ), 200

@auth_api.route("/logout", methods=["POST"])
def api_logout():
    email = session.get("email")
    try:
        log_review_action({
            "action": "logout",
            "email": email,
            "timestamp": time.time(),
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", ""),
        })
    except Exception:
        current_app.logger.debug(f"[LOGIN DEBUG] Failed to log logout for {email}")
    session.clear()
    return standard_response(True, message="Logged out"), 200

@auth_api.route("/whoami", methods=["GET"])
def api_whoami():
    if "email" not in session:
        return standard_response(False, message="Not authenticated"), 401

    email = session.get("email")
    name = session.get("name")
    is_admin = session.get("is_admin", False)
    current_assignment = session.get("current_abs_id")
    stats = {}
    if not is_admin:
        try:
            stats = get_stats_for_reviewer(email)
        except Exception:
            current_app.logger.debug(f"[LOGIN DEBUG] Failed to get reviewer stats for {email}")

    user = {
        "email": email,
        "name": name,
        "is_admin": is_admin,
        "current_assignment": current_assignment,
        "stats": stats,
    }
    return standard_response(True, user=user), 200