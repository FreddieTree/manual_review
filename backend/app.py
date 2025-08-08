import os
import logging
from collections.abc import Iterable
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv


def _compute_cors_origins(app_config: dict, extra_env: str) -> list[str]:
    default_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    cfg_origins = set(app_config.get("CORS_ORIGINS", [])) if isinstance(app_config.get("CORS_ORIGINS", []), Iterable) else set()
    if extra_env:
        cfg_origins |= {o.strip() for o in extra_env.split(",") if o.strip()}
    combined = sorted(default_origins | cfg_origins)
    return combined


def create_app() -> Flask:
    # Load .env (if present) so MONGO_URI and others are available
    try:
        load_dotenv()
    except Exception:
        pass
    app = Flask(__name__)

    # === Config ===
    app.config.from_object("backend.config")
    app.secret_key = app.config.get("SECRET_KEY", "dev-secret")

    # === Proxy support ===
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    # === Logging ===
    debug_flag = str(os.environ.get("FLASK_DEBUG", os.environ.get("DEBUG", "1"))).lower() in ("1", "true", "yes")
    log_level = logging.DEBUG if debug_flag else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    app.logger.setLevel(log_level)

    # === CORS ===
    origins = _compute_cors_origins(app.config, os.environ.get("ALLOWED_ORIGINS", ""))
    CORS(
        app,
        supports_credentials=True,
        origins=origins,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )
    app.logger.info("CORS origins: %s", origins)

    # === Blueprints ===
    from backend.routes.auth import auth_api
    from backend.routes.tasks import task_api
    from backend.routes.reviewers import reviewer_api

    # pricing removed
    pricing_api = None  # type: ignore

    try:
        from backend.routes.meta import bp as meta_api  # type: ignore
    except ImportError:
        from backend.routes.meta import meta_api  # type: ignore

    from backend.routes.export import export_api
    from backend.routes.arbitration import arbitration_api, arbitration_compat_api
    from backend.routes.admin import admin_api

    app.register_blueprint(auth_api)
    app.register_blueprint(task_api)
    app.register_blueprint(reviewer_api)
    if pricing_api:
        app.register_blueprint(pricing_api)
    app.register_blueprint(meta_api)
    app.register_blueprint(export_api)
    app.register_blueprint(arbitration_api)
    app.register_blueprint(arbitration_compat_api)
    app.register_blueprint(admin_api)

    # === Route logging (once) ===
    def _log_routes():
        app.logger.info("=== Registered routes ===")
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: (r.rule, r.endpoint)):
            methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
            app.logger.info(f"{rule.endpoint:32} [{methods:15}] -> {rule.rule}")
        app.logger.info("=========================")

    if hasattr(app, "before_serving"):
        app.before_serving(_log_routes)  # type: ignore
    else:
        _logged = {"done": False}

        @app.before_request
        def _maybe_log_once():
            if not _logged["done"]:
                _log_routes()
                _logged["done"] = True

    # === Per-request debug logging ===
    @app.before_request
    def _log_request():
        if app.logger.isEnabledFor(logging.DEBUG):
            app.logger.debug("Incoming %s %s from %s", request.method, request.path, request.remote_addr)

    # === Security headers ===
    @app.after_request
    def _security_headers(resp):
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-site",
        }
        for k, v in headers.items():
            resp.headers.setdefault(k, v)
        return resp

    # === Health fallback ===
    @app.get("/api/meta/health")
    def _health():
        return jsonify({"success": True, "data": {"status": "ok"}}), 200

    # === Error handlers helpers ===
    def _error_response(message: str, status: int, path: str | None = None):
        payload: dict[str, Any] = {"success": False, "message": message}
        if path:
            payload["path"] = path
        return jsonify(payload), status

    app.register_error_handler(404, lambda e: _error_response("Not found", 404, request.path))
    app.register_error_handler(405, lambda e: _error_response("Method not allowed", 405, request.path))

    @app.errorhandler(500)
    def _internal_error(e):
        app.logger.exception("Internal server error")
        return _error_response("Internal server error", 500)

    @app.errorhandler(Exception)
    def _unhandled(e):
        app.logger.exception("Unhandled exception")
        return _error_response("Server error", 500)

    # === Session / JSON defaults ===
    app.config.setdefault("SESSION_COOKIE_NAME", "reviewer_session")
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault(
        "SESSION_COOKIE_SECURE",
        str(os.environ.get("SESSION_COOKIE_SECURE", "0")).lower() in ("1", "true"),
    )
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("JSON_AS_ASCII", False)
    app.config.setdefault("JSON_SORT_KEYS", False)

    return app


# 全局实例
app = create_app()

if __name__ == "__main__":
    host = os.environ.get("FLASK_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_PORT", "5050"))
    debug_flag = str(os.environ.get("FLASK_DEBUG", "1")).lower() in ("1", "true")
    app.run(debug=debug_flag, host=host, port=port, use_reloader=debug_flag)