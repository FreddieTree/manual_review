# backend/app.py
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix


def create_app() -> Flask:
    app = Flask(__name__)

    # === Config ===
    app.config.from_object("backend.config")
    app.secret_key = app.config.get("SECRET_KEY", "dev-secret")

    # 信任一层反代
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
    default_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    cfg_origins = set(app.config.get("CORS_ORIGINS", []))
    env_extra = os.environ.get("ALLOWED_ORIGINS", "")
    if env_extra:
        cfg_origins |= {o.strip() for o in env_extra.split(",") if o.strip()}
    origins = sorted(default_origins | cfg_origins)
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

    # 兼容 pricing 蓝图命名 (bp / pricing_api)
    try:
        from backend.routes.pricing import bp as pricing_api  # type: ignore
    except Exception:
        from backend.routes.pricing import pricing_api  # type: ignore

    # 兼容 meta 蓝图命名 (bp / meta_api)
    try:
        from backend.routes.meta import bp as meta_api  # type: ignore
    except Exception:
        from backend.routes.meta import meta_api  # type: ignore

    from backend.routes.export import export_api
    from backend.routes.arbitration import arbitration_api, arbitration_compat_api

    app.register_blueprint(auth_api)
    app.register_blueprint(task_api)
    app.register_blueprint(reviewer_api)
    app.register_blueprint(pricing_api)
    app.register_blueprint(meta_api)
    app.register_blueprint(export_api)
    app.register_blueprint(arbitration_api)
    app.register_blueprint(arbitration_compat_api)

    # === 路由列表日志（首请求前打印一次） ===
    def _log_routes():
        app.logger.info("=== Registered routes ===")
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: (r.rule, r.endpoint)):
            methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
            app.logger.info(f"{rule.endpoint:32} [{methods:15}] -> {rule.rule}")
        app.logger.info("=========================")

    if hasattr(app, "before_serving"):
        app.before_serving(_log_routes)
    else:
        try:
            app.before_first_request(_log_routes)
        except Exception:
            _logged = {"done": False}

            @app.before_request
            def _maybe_log_once():
                if not _logged["done"]:
                    _log_routes()
                    _logged["done"] = True

    # === 每请求调试日志 + 安全响应头 ===
    @app.before_request
    def _log_request():
        if app.logger.isEnabledFor(logging.DEBUG):
            app.logger.debug("Incoming %s %s from %s", request.method, request.path, request.remote_addr)

    @app.after_request
    def _security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        return resp

    # 兜底健康检查（若 meta 蓝图缺失仍可用）
    @app.get("/api/meta/health")
    def _health():
        return jsonify({"success": True, "data": {"status": "ok"}}), 200

    @app.errorhandler(404)
    def _not_found(e):
        return jsonify({"success": False, "message": "Not found", "path": request.path}), 404

    @app.errorhandler(405)
    def _method_not_allowed(e):
        return jsonify({"success": False, "message": "Method not allowed", "path": request.path}), 405

    @app.errorhandler(500)
    def _internal_error(e):
        app.logger.exception("Internal server error")
        return jsonify({"success": False, "message": "Internal server error"}), 500

    @app.errorhandler(Exception)
    def _unhandled(e):
        app.logger.exception("Unhandled exception")
        return jsonify({"success": False, "message": "Server error"}), 500

    # 会话 Cookie 基础设置（可由 config 覆盖）
    app.config.setdefault("SESSION_COOKIE_NAME", "reviewer_session")
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault(
        "SESSION_COOKIE_SECURE",
        str(os.environ.get("SESSION_COOKIE_SECURE", "0")).lower() in ("1", "true"),
    )
    app.config.setdefault("JSON_AS_ASCII", False)
    app.config.setdefault("JSON_SORT_KEYS", False)

    return app


app = create_app()

if __name__ == "__main__":
    host = os.environ.get("FLASK_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_PORT", "5050"))
    debug_flag = str(os.environ.get("FLASK_DEBUG", "1")).lower() in ("1", "true")
    app.run(debug=debug_flag, host=host, port=port, use_reloader=debug_flag)