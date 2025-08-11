# backend/routes/export.py
from __future__ import annotations

from flask import Blueprint, jsonify, current_app, session, request, send_file
from io import BytesIO
import time
import json

from ..services.aggregation import export_final_consensus, aggregate_final_decisions_for_pmid  # 见下方说明
from ..models.abstracts import get_all_pmids
from ..models.logs import log_review_action
from ..services.export_service import export_passed_assertions

export_api = Blueprint("export_api", __name__, url_prefix="/api")

@export_api.route("/export_consensus", methods=["GET"])
def api_export_consensus():
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "not_authorized"}), 403
    try:
        download = str(request.args.get("download", "0")).lower() in ("1", "true", "yes")
        if download:
            # Build content in-memory and return as attachment
            finals = []
            for pid in get_all_pmids():
                finals.extend(aggregate_final_decisions_for_pmid(pid))
            buf = BytesIO()
            for rec in finals:
                rec.pop("_id", None)
                buf.write((json.dumps(rec, ensure_ascii=False) + "\n").encode("utf-8"))
            buf.seek(0)
            ts = int(time.time())
            prefix = request.args.get("prefix", "final_consensus") or "final_consensus"
            # very light sanitization
            prefix = "".join(c for c in prefix if c.isalnum() or c in ("_", "-")) or "final_consensus"
            filename = f"{prefix}_{ts}.jsonl"
            try:
                log_review_action({
                    "action": "admin_export_consensus",
                    "by": session.get("email", "admin"),
                    "path": filename,
                    "created_at": time.time(),
                })
            except Exception:
                pass
            return send_file(buf, as_attachment=True, download_name=filename, mimetype="application/json")

        count, out_path = export_final_consensus()
        try:
            log_review_action({
                "action": "admin_export_consensus",
                "by": session.get("email", "admin"),
                "path": str(out_path),
                "created_at": time.time(),
            })
        except Exception:
            pass
        return jsonify({"success": True, "exported_count": count, "path": str(out_path)})
    except Exception as e:
        current_app.logger.exception("Export consensus failed")
        return jsonify({"success": False, "error": "export_failed", "message": str(e)}), 500


@export_api.route("/export_passed", methods=["GET"])
def api_export_passed():
    """Export all compliant + arbitrated-passed assertions to jsonl with timestamped filename and SHA1."""
    if not session.get("is_admin"):
        return jsonify({"success": False, "error": "not_authorized"}), 403
    try:
        download = str(request.args.get("download", "0")).lower() in ("1", "true", "yes")
        if download:
            # Build content from Mongo directly, in-memory
            from ..models.db import abstracts_col
            buf = BytesIO()
            total = 0
            for abs_doc in abstracts_col.find({}):
                pmid = abs_doc.get("pmid")
                for s in abs_doc.get("sentences", []) or []:
                    sent_idx = s.get("sentence_index")
                    sent_text = s.get("sentence")
                    for a in s.get("assertions", []) or []:
                        if a.get("final_status") == "consensus" and a.get("final_decision") in ("accept", "add"):
                            out = {
                                "pmid": pmid,
                                "sentence_index": sent_idx,
                                "sentence": sent_text,
                                "assertion": a,
                            }
                            out.pop("_id", None)
                            buf.write((json.dumps(out, ensure_ascii=False) + "\n").encode("utf-8"))
                            total += 1
            buf.seek(0)
            ts = int(time.time())
            filename = f"passed_assertions_{ts}.jsonl"
            try:
                log_review_action({
                    "action": "admin_export_passed",
                    "by": session.get("email", "admin"),
                    "path": filename,
                    "created_at": time.time(),
                    "total_records": total,
                })
            except Exception:
                pass
            return send_file(buf, as_attachment=True, download_name=filename, mimetype="application/json")

        path, total, sha1 = export_passed_assertions("data/exports")
        try:
            log_review_action({
                "action": "admin_export_passed",
                "by": session.get("email", "admin"),
                "path": str(path),
                "created_at": time.time(),
                "total_records": total,
                "sha1": sha1,
            })
        except Exception:
            pass
        return jsonify({
            "success": True,
            "path": path,
            "total": total,
            "sha1": sha1,
        }), 200
    except Exception as e:
        current_app.logger.exception("Export passed failed")
        return jsonify({"success": False, "error": "export_failed", "message": str(e)}), 500