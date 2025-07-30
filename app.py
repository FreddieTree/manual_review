from flask import (
    Flask, render_template, request, redirect, session, url_for, flash
)
import os
from config import SECRET_KEY, ADMIN_EMAIL, ADMIN_NAME
from task_manager import assign_abstract_to_reviewer, release_expired_locks
from models import (
    load_abstracts, get_abstract_by_id, log_review_action, get_stats_for_reviewer
)
from utils import is_valid_email

app = Flask(__name__)
app.secret_key = SECRET_KEY

def current_user():
    if "name" in session and "email" in session:
        return {
            "name": session["name"],
            "email": session["email"],
            "is_admin": session.get("is_admin", False)
        }
    return None

def require_login(func):
    from functools import wraps
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not current_user():
            flash("Please log in first.")
            return redirect(url_for("login"))
        return func(*args, **kwargs)
    return wrapper

@app.route("/", methods=["GET", "POST"])
def login():
    if "name" in session and "email" in session:
        if session.get("is_admin"):
            return redirect(url_for("admin"))
        if not session.get("current_abs_id"):
            abs_id = assign_abstract_to_reviewer(session["email"], session["name"])
            if abs_id is None:
                return render_template("no_more_tasks.html")
            session["current_abs_id"] = abs_id
        return redirect(url_for("review"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        if not name or not is_valid_email(email):
            flash("Please enter a valid name and @bristol.ac.uk email.")
            return render_template("login.html")
        session.clear()
        session["name"] = name
        session["email"] = email
        session["is_admin"] = (email == ADMIN_EMAIL and name == ADMIN_NAME)
        if session["is_admin"]:
            return redirect(url_for("admin"))
        abs_id = assign_abstract_to_reviewer(email, name)
        if abs_id is None:
            return render_template("no_more_tasks.html")
        session["current_abs_id"] = abs_id
        return redirect(url_for("review"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    flash("You have logged out.")
    return redirect(url_for("login"))

@app.route("/review", methods=["GET", "POST"])
@require_login
def review():
    if session.get("is_admin", False):
        flash("Admin cannot review as reviewer.")
        return redirect(url_for("admin"))
    abs_id = session.get("current_abs_id")
    if not abs_id:
        flash("No abstract assigned. Please login again.")
        return redirect(url_for("login"))
    abstract = get_abstract_by_id(abs_id)
    if not abstract:
        flash("Assigned abstract not found. Please contact admin.")
        return redirect(url_for("logout"))
    stats = get_stats_for_reviewer(session["email"])
    if request.method == "POST":
        from reviewer import audit_review_submission
        logs = audit_review_submission(
            abs_id=abs_id,
            sentence_results=abstract["sentence_results"],
            post_data=request.form,
            reviewer_info={
                "name": session["name"],
                "email": session["email"]
            }
        )
        for log in logs:
            log_review_action(log)
        release_expired_locks()
        session.pop("current_abs_id", None)
        abs_id = assign_abstract_to_reviewer(session["email"], session["name"])
        if abs_id is None:
            flash("All abstracts reviewed. Thank you for your contributions!")
            return render_template("no_more_tasks.html", stats=stats)
        session["current_abs_id"] = abs_id
        flash("Review submitted. Next abstract assigned.")
        abstract = get_abstract_by_id(abs_id)
        stats = get_stats_for_reviewer(session["email"])
    return render_template(
        "review.html", abstract=abstract, reviewer_name=session["name"], stats=stats
    )

@app.route("/admin", methods=["GET", "POST"])
@require_login
def admin():
    if not session.get("is_admin", False):
        flash("Admin login required.")
        return redirect(url_for("login"))
    # TODO: Add admin dashboard logic
    return render_template("admin.html", admin_name=ADMIN_NAME)

@app.route("/no_more_tasks")
@require_login
def no_more_tasks():
    stats = get_stats_for_reviewer(session["email"])
    return render_template("no_more_tasks.html", stats=stats)

@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)