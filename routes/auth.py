# routes/auth.py
import time
from functools import wraps
from flask import Blueprint, request, session, jsonify, current_app
from config import ADMIN_EMAIL, ADMIN_NAME
from utils import is_valid_email
from task_manager import assign_abstract_to_reviewer
from models import get_stats_for_reviewer, log_review_action

auth_api = Blueprint("auth_api", __name__, url_prefix="/api")

# In-memory rate limiting; swap to Redis/more robust store in prod
_LOGIN_ATTEMPTS: dict = {}
LOCKOUT_THRESHOLD = 5  # failures before cooldown
LOCKOUT_WINDOW = 60  # seconds to keep past attempts
COOLDOWN_SECONDS = 120  # lockout duration

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
            return standard_response(False, message="Too many failed login attempts. Try again later."), 429

        resp_tuple = f(*args, **kwargs)
        # Expect (response, status)
        if isinstance(resp_tuple, tuple) and len(resp_tuple) == 2:
            resp_obj, status = resp_tuple
        else:
            # fallback: assume success
            return resp_tuple

        # Determine if it was a failure
        is_success = False
        try:
            json_body = resp_obj.get_json() if hasattr(resp_obj, "get_json") else {}
            is_success = bool(json_body.get("success", False))
        except Exception:
            is_success = status == 200

        if not is_success:
            # prune old
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

    if not name or not is_valid_email(email):
        return standard_response(False, message="Invalid name or email"), 400

    # Reset session
    session.clear()
    session["name"] = name
    session["email"] = email
    is_admin = (email == ADMIN_EMAIL and name == ADMIN_NAME)
    session["is_admin"] = is_admin
    session.permanent = True  # optional if session lifetime configured

    # Audit login (non-blocking)
    try:
        log_review_action({
            "action": "login",
            "email": email,
            "name": name,
            "is_admin": is_admin,
            "timestamp": time.time(),
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", ""),
        })
    except Exception:
        current_app.logger.warning("Failed to record login for %s", email)

    if is_admin:
        return standard_response(True, is_admin=True), 200

    assigned = assign_abstract_to_reviewer(email, name)
    if not assigned:
        return standard_response(True, is_admin=False, no_more_tasks=True, message="No available abstracts to assign."), 200

    session["current_abs_id"] = assigned

    # Reviewer stats best-effort
    stats = {}
    try:
        stats = get_stats_for_reviewer(email)
    except Exception:
        current_app.logger.debug("Could not fetch reviewer stats for %s", email)

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
        current_app.logger.debug("Failed to log logout for %s", email)
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
            current_app.logger.debug("Failed to get reviewer stats for %s", email)

    user = {
        "email": email,
        "name": name,
        "is_admin": is_admin,
        "current_assignment": current_assignment,
        "stats": stats,
    }
    return standard_response(True, user=user), 200