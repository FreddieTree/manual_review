# backend/routes/admin.py
from __future__ import annotations
from flask import Blueprint, jsonify, request, session
from pathlib import Path
import json
import time
import os

from backend.config import (
    ABSTRACTS_PATH,
    REVIEW_LOGS_PATH,
    REVIEWERS_JSON,
    FINAL_EXPORT_PATH,
)
from backend.services.export_service import export_passed_assertions
from backend.services.import_service import start_import_job, get_import_progress
from backend.models.logs import log_review_action

admin_api = Blueprint("admin_api", __name__, url_prefix="/api/admin")

def _require_admin_resp():
    if not session.get("is_admin"):
        return jsonify({"success": False, "message": "Not authorized"}), 403
    return None

def _count_jsonl(p: Path) -> int:
    try:
        p = Path(p)
        if not p.exists():
            return 0
        with p.open("r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())
    except Exception:
        return 0

@admin_api.get("/stats")
def admin_stats():
    guard = _require_admin_resp()
    if guard:
        return guard
    total_abstracts = _count_jsonl(Path(ABSTRACTS_PATH))

    total_reviewers = 0
    try:
        p = Path(REVIEWERS_JSON)
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, list):
                total_reviewers = len(data)
            elif isinstance(data, dict) and isinstance(data.get("reviewers"), list):
                total_reviewers = len(data["reviewers"])
    except Exception:
        pass

    # 如需真实统计可解析 REVIEW_LOGS_PATH；这里给出占位
    reviewed_count = 0
    reviewed_ratio = round((reviewed_count / total_abstracts) * 100, 1) if total_abstracts else 0.0

    payload = {
        "total_abstracts": total_abstracts,
        "total_reviewers": total_reviewers,
        "reviewed_count": reviewed_count,
        "reviewed_ratio": reviewed_ratio,
        "conflicts": 0,
        "abstracts_today": 0,
        "new_reviewers": 0,
        "arbitration_count": 0,
        "active_reviewers": 0,
        "last_export": None,
    }
    return jsonify({"success": True, "data": payload})


@admin_api.post("/export_snapshot")
def admin_export_snapshot():
    """Export compliant data only (jsonl) with audit log and snapshotting."""
    guard = _require_admin_resp()
    if guard:
        return guard

    # simple second confirmation gate
    confirm = request.json.get("confirm") if request.is_json else request.form.get("confirm")
    if str(confirm).lower() not in ("1", "true", "yes"): 
        return jsonify({"success": False, "message": "Confirmation required"}), 400

    actor = session.get("email", "admin")
    ts = int(time.time())
    out_path = FINAL_EXPORT_PATH.parent / f"final_consensus_snapshot_{ts}.jsonl"
    try:
        export_passed_assertions(str(out_path))
        try:
            log_review_action({
                "action": "admin_export_snapshot",
                "by": actor,
                "path": str(out_path),
                "created_at": time.time(),
            })
        except Exception:
            pass
        return jsonify({"success": True, "path": str(out_path)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api.post("/upload_abstracts")
def admin_upload_abstracts():
    """Admin bulk upload with local pre-validation and up to 3 retries for failures."""
    guard = _require_admin_resp()
    if guard:
        return guard

    # second confirmation gate
    confirm = request.form.get("confirm") or (request.json.get("confirm") if request.is_json else None)
    if str(confirm).lower() not in ("1", "true", "yes"):
        return jsonify({"success": False, "message": "Confirmation required"}), 400

    # accept either file upload or server-side path
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path: Path
    if "file" in request.files:
        f = request.files["file"]
        ts = int(time.time())
        saved_path = upload_dir / f"upload_{ts}.jsonl"
        f.save(str(saved_path))
    else:
        body = request.get_json(silent=True) or {}
        path_str = body.get("path")
        if not path_str or not os.path.exists(path_str):
            return jsonify({"success": False, "message": "Missing or invalid file/path"}), 400
        saved_path = Path(path_str)

    # local pre-validation: check JSONL format quickly
    invalid_lines = 0
    total_lines = 0
    try:
        with saved_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                s = line.strip()
                if not s:
                    continue
                total_lines += 1
                try:
                    json.loads(s)
                except Exception:
                    invalid_lines += 1
        if total_lines == 0 or invalid_lines > 0 and invalid_lines / max(1, total_lines) > 0.25:
            return jsonify({"success": False, "message": "Pre-validation failed: too many invalid JSON lines"}), 400
    except Exception:
        return jsonify({"success": False, "message": "Could not read uploaded file"}), 400

    # prepare error log path
    err_dir = Path("data")
    err_dir.mkdir(parents=True, exist_ok=True)
    err_log = err_dir / f"failed_imports_{int(time.time())}.jsonl"

    # run import with retries (up to 3 attempts for failed entries)
    try:
        job_id = start_import_job(str(saved_path), str(err_log))
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to start import: {e}"}), 500

    actor = session.get("email", "admin")
    try:
        log_review_action({
            "action": "admin_bulk_upload",
            "by": actor,
            "source_path": str(saved_path),
            "error_log": str(err_log),
            "created_at": time.time(),
        })
    except Exception:
        pass

    return jsonify({
        "success": True,
        "uploaded_path": str(saved_path),
        "error_log": str(err_log),
        "job_id": job_id,
    })


@admin_api.get("/import_progress/<job_id>")
def admin_import_progress(job_id: str):
    guard = _require_admin_resp()
    if guard:
        return guard
    try:
        progress = get_import_progress(job_id)
        if not progress:
            return jsonify({"success": False, "message": "Job not found"}), 404
        return jsonify({"success": True, "data": progress})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500