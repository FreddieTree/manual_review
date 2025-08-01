# app.py
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from config import SECRET_KEY
from routes import (
    reviewer_api,
    admin_api,
    task_api,
    arbitration_api,
    export_api,
    auth_api,
)

def create_app():
    app = Flask(__name__)
    app.secret_key = SECRET_KEY

    # === Logging setup ===
    log_level = logging.DEBUG if os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true") else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    app.logger.setLevel(log_level)

    # === CORS ===
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    extra = os.environ.get("ALLOWED_ORIGINS")
    if extra:
        allowed_origins.extend([o.strip() for o in extra.split(",") if o.strip()])
    CORS(
        app,
        supports_credentials=True,
        origins=allowed_origins,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # === Register blueprints ===
    app.register_blueprint(auth_api)          # /api/login etc.
    app.register_blueprint(reviewer_api)      # /api/reviewers...
    app.register_blueprint(admin_api)
    app.register_blueprint(task_api)
    app.register_blueprint(arbitration_api)
    app.register_blueprint(export_api)

    # === Route logging hook with version compatibility ===
    def log_routes():
        app.logger.info("=== Registered routes ===")
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: (r.rule, r.endpoint)):
            methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
            app.logger.info(f"{rule.endpoint:30} [{methods:15}] -> {rule.rule}")
        app.logger.info("=========================")

    # Flask versions differ: prefer before_serving if available, else fallback safely
    if hasattr(app, "before_serving"):
        # Newer Flask
        app.before_serving(log_routes)
    else:
        # Older Flask or versions where before_first_request exists
        try:
            app.before_first_request(log_routes)
        except AttributeError:
            # Last-resort: log once on first actual request
            logged = {"done": False}

            @app.before_request
            def maybe_log_once():
                if not logged["done"]:
                    log_routes()
                    logged["done"] = True

    # === Per-request logging ===
    @app.before_request
    def log_request():
        app.logger.debug(f"Incoming {request.method} {request.path} from {request.remote_addr}")

    @app.after_request
    def apply_security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        return resp

    # === Error handlers ===
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Not found", "path": request.path}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "Method not allowed", "path": request.path}), 405

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.exception("Internal server error: %s", e)
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app

app = create_app()

if __name__ == "__main__":
    host = os.environ.get("FLASK_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_PORT", "5050"))
    debug_flag = os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true")
    app.run(debug=debug_flag, host=host, port=port, use_reloader=debug_flag)