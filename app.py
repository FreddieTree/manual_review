# app.py
from flask import Flask, render_template, request, redirect, session, url_for, flash
import os
from config import SECRET_KEY, ADMIN_EMAIL, ADMIN_NAME
from task_manager import assign_abstract_to_reviewer, release_expired_locks
from models import load_abstracts, get_abstract_by_id
from utils import is_valid_email

app = Flask(__name__)
app.secret_key = SECRET_KEY

# ========= ROUTES ==========

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        if not name or not is_valid_email(email):
            flash("Please enter a valid name and @bristol.ac.uk email.")
            return render_template("login.html")
        session["name"] = name
        session["email"] = email
        session["is_admin"] = (email == ADMIN_EMAIL and name == ADMIN_NAME)
        # 分配任务
        abs_id = assign_abstract_to_reviewer(email, name)
        if abs_id is None:
            return render_template("no_more_tasks.html")
        session["current_abs_id"] = abs_id
        return redirect(url_for("review"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/review", methods=["GET", "POST"])
def review():
    if "name" not in session or "email" not in session:
        return redirect(url_for("login"))
    abs_id = session.get("current_abs_id")
    if not abs_id:
        flash("No abstract assigned. Please login again.")
        return redirect(url_for("login"))
    abstract = get_abstract_by_id(abs_id)
    if not abstract:
        flash("Assigned abstract not found. Please contact admin.")
        return redirect(url_for("logout"))
    # POST: 保存用户审核，后续补充
    if request.method == "POST":
        # 审核保存逻辑 (后续补充)
        flash("Review submitted! (Functionality under construction)")
        release_expired_locks()
        session.pop("current_abs_id", None)
        return redirect(url_for("login"))
    return render_template("review.html", abstract=abstract, reviewer_name=session["name"])

@app.route("/admin", methods=["GET", "POST"])
def admin():
    if not session.get("is_admin", False):
        flash("Admin login required.")
        return redirect(url_for("login"))
    # 后续补充 admin dashboard 展示
    return render_template("admin.html")

@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404

# ========== MAIN ===========
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")