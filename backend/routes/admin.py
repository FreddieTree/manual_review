# backend/routes/admin.py
from __future__ import annotations
from flask import Blueprint, jsonify
from pathlib import Path
import json

from backend.config import (
    ABSTRACTS_PATH,
    REVIEW_LOGS_PATH,
    REVIEWERS_JSON,
    FINAL_EXPORT_PATH,
)

admin_api = Blueprint("admin_api", __name__, url_prefix="/api/admin")

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