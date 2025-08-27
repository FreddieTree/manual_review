# backend/routes/arbitration.py
from __future__ import annotations

from flask import Blueprint, request, session, jsonify, current_app
from typing import Any, Dict, Optional

from ..services.arbitration import (
    get_arbitration_queue,
    set_arbitration_result,
    get_arbitration_history,
    undo_arbitration,
    ArbitrationError,
)

# 新版分组式蓝图：/api/arbitration/*
arbitration_api = Blueprint("arbitration_api", __name__, url_prefix="/api/arbitration")

def _resp(success: bool, **kwargs):
    payload: Dict[str, Any] = {"success": success}
    payload.update(kwargs)
    return jsonify(payload), (200 if success else kwargs.get("status", 400))

def _require_admin() -> Optional[tuple]:
    if not session.get("is_admin"):
        return _resp(False, message="Not authorized", status=403)
    return None

@arbitration_api.get("/queue")
def api_arbitration_queue():
    guard = _require_admin()
    if guard:
        return guard
    """
    获取仲裁队列（公开）。支持查询参数：
      - pmid
      - only_conflicts: 默认 true
      - include_pending: 默认 false
      - limit: 正整数
    """
    pmid = request.args.get("pmid")
    only_conflicts = (request.args.get("only_conflicts", "true").lower() in ("1", "true", "yes", "on"))
    include_pending = (request.args.get("include_pending", "false").lower() in ("1", "true", "yes", "on"))
    limit = request.args.get("limit")
    limit_int = int(limit) if (limit and limit.isdigit()) else None

    try:
        # 关键：显式失效聚合缓存，避免“刚写完看不见”的情况
        try:
            from ..services.aggregation import invalidate_cache as _invalidate_agg
            _invalidate_agg()
        except Exception:
            pass

        queue = get_arbitration_queue(
            pmid=pmid,
            only_conflicts=only_conflicts,
            include_pending=include_pending,
            limit=limit_int,
        )
        # 附带一个统计摘要，便于前端徽标显示
        summary = {
            "total": len(queue),
            "conflicts": sum(1 for it in queue if (it.get("status") == "conflict")),
            "pending": sum(1 for it in queue if (it.get("status") == "pending")),
        }
        return _resp(True, data={"items": queue, "summary": summary})
    except Exception as e:
        # 保证接口稳定返回，但记录详细日志便于排查
        current_app.logger.exception("Failed to build arbitration queue: %s", e)
        return _resp(True, data={"items": []})

@arbitration_api.post("/decide")
def api_arbitrate():
    guard = _require_admin()
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    pmid = data.get("pmid")
    # 兼容：支持 assertion_key / assertion_id
    assertion_key = data.get("assertion_key") or data.get("assertion_id")
    decision = data.get("decision")
    comment = data.get("comment", "")
    # Enforce append-only arbitration without overwrite capability
    overwrite = False
    admin = session.get("email")

    try:
        rec = set_arbitration_result(
            pmid=pmid,
            assertion_key=assertion_key,
            decision=decision,
            admin_email=admin,
            comment=comment,
            overwrite=overwrite,
        )
        return _resp(True, data={"log": rec})
    except ArbitrationError as e:
        return _resp(False, message=str(e), status=400)
    except Exception as e:
        current_app.logger.exception("Arbitrate failed: %s", e)
        return _resp(False, message=f"Internal error: {e}", status=500)

@arbitration_api.get("/history")
def api_history():
    guard = _require_admin()
    if guard:
        return guard

    pmid = request.args.get("pmid")
    assertion_key = request.args.get("assertion_key") or request.args.get("assertion_id")
    if not pmid or not assertion_key:
        return _resp(False, message="pmid and assertion_key are required", status=400)
    try:
        hist = get_arbitration_history(assertion_key, pmid)
        return _resp(True, data={"history": hist})
    except Exception as e:
        current_app.logger.exception("Fetch arbitration history failed: %s", e)
        return _resp(False, message=f"Internal error: {e}", status=500)

@arbitration_api.post("/undo")
def api_undo():
    guard = _require_admin()
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    pmid = data.get("pmid")
    assertion_key = data.get("assertion_key") or data.get("assertion_id")
    reason = data.get("reason", "")
    admin = session.get("email")

    if not pmid or not assertion_key:
        return _resp(False, message="pmid and assertion_key are required", status=400)

    try:
        rec = undo_arbitration(assertion_key, pmid, admin, reason)
        return _resp(True, data={"log": rec})
    except ArbitrationError as e:
        return _resp(False, message=str(e), status=400)
    except Exception as e:
        current_app.logger.exception("Undo arbitration failed: %s", e)
        return _resp(False, message=f"Internal error: {e}", status=500)


# ------------------------ 向后兼容蓝图 ------------------------
# 旧测试/前端仍访问：
#   GET  /api/arbitration_queue       -> 返回值为“列表”而不是 {success,data}
#   POST /api/arbitrate               -> 字段 assertion_id
arbitration_compat_api = Blueprint("arbitration_compat_api", __name__)

@arbitration_compat_api.get("/api/arbitration_queue")
def api_arbitration_queue_compat():
    # Restrict to admin for security; legacy route returns empty list on failure
    if not session.get("is_admin"):
        return jsonify([]), 403
    try:
        # 同样先失效缓存，保持行为一致
        try:
            from ..services.aggregation import invalidate_cache as _invalidate_agg
            _invalidate_agg()
        except Exception:
            pass

        queue = get_arbitration_queue(
            pmid=request.args.get("pmid"),
            only_conflicts=True,
            include_pending=False,
            limit=None,
        )
        # 老契约：直接返回 list
        if not isinstance(queue, list):
            queue = []
        return jsonify(queue), 200
    except Exception as e:
        current_app.logger.exception("Compat queue failed: %s", e)
        # 老契约：失败也返回空列表
        return jsonify([]), 200

@arbitration_compat_api.post("/api/arbitrate")
def api_arbitrate_compat():
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "Not authorized"}), 403
    data = request.get_json(silent=True) or {}
    pmid = data.get("pmid")
    assertion_id = data.get("assertion_id")  # 老字段名
    decision = data.get("decision")
    comment = data.get("comment", "")
    admin = session.get("email")
    try:
        rec = set_arbitration_result(
            pmid=pmid,
            assertion_key=assertion_id,  # 映射到新字段
            decision=decision,
            admin_email=admin,
            comment=comment,
            overwrite=False,
        )
        return jsonify({"success": True, "log": rec}), 200
    except ArbitrationError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        current_app.logger.exception("Compat arbitrate failed: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500