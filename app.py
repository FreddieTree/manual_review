# app.py
from flask import Flask
from flask_cors import CORS
from routes import (
    reviewer_api, admin_api, task_api,
    arbitration_api, export_api, auth_api, reviewer_manage_api)
from config import SECRET_KEY

app = Flask(__name__)
app.secret_key = SECRET_KEY
CORS(app, supports_credentials=True)

# 注册所有蓝图
app.register_blueprint(auth_api)
app.register_blueprint(reviewer_api)
app.register_blueprint(admin_api)
app.register_blueprint(task_api)
app.register_blueprint(arbitration_api)
app.register_blueprint(export_api)
app.register_blueprint(reviewer_manage_api)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)