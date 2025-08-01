# routes/admin.py

import time
from functools import wraps
from flask import Blueprint, jsonify, request, session, current_app
from models import (
    get_all_pmids,
    get_all_reviewers,
    get_stats_for_reviewer,
)
from aggregate import find_assertion_conflicts, aggregate_final_decisions_for_pmid

admin_api = Blueprint("admin_api", __name__)

# ---------- helpers ----------

def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"success": False, "message": "Admin privileges required."}), 403
        return fn(*args, **kwargs)
    return wrapper

def standard_response(success=True, **kwargs):
    base = {"success": success}
    base.update(kwargs)
    return base

def paginate_list(items, default_limit=20):
    try:
        limit = int(request.args.get("limit", default_limit))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        limit = default_limit
        offset = 0
    paged = items[offset : offset + limit]
    return paged, {"limit": limit, "offset": offset, "total": len(items)}

# ---------- endpoints ----------

@admin_api.route("/api/admin_stats", methods=["GET"])
@require_admin
def api_admin_stats():
    """
    High-level snapshot for administrators.
    """
    try:
        total_abstracts = len(get_all_pmids())
        total_reviewers = len(get_all_reviewers())
        conflicts = find_assertion_conflicts()
        conflict_count = len(conflicts)

        # optional: breakdown of conflicts per PMIDs (top 5)
        conflict_per_pmid = {}
        for c in conflicts:
            pmid = str(c.get("pmid"))
            conflict_per_pmid[pmid] = conflict_per_pmid.get(pmid, 0) + 1
        top_conflict_pmids = sorted(
            conflict_per_pmid.items(), key=lambda x: x[1], reverse=True
        )[:5]
        top_conflict_pmids = [
            {"pmid": pmid, "conflict_count": count} for pmid, count in top_conflict_pmids
        ]

        return jsonify(
            standard_response(
                total_abstracts=total_abstracts,
                total_reviewers=total_reviewers,
                conflict_count=conflict_count,
                top_conflict_pmids=top_conflict_pmids,
                timestamp=time.time(),
            )
        )
    except Exception as e:
        current_app.logger.exception("Error in admin_stats")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api.route("/api/conflicts", methods=["GET"])
@require_admin
def api_conflict_list():
    """
    List all assertion conflicts (optionally filtered by PMID), with pagination.
    Query params:
      - pmid: optional, filter to a single abstract
      - limit, offset: pagination
    """
    try:
        pmid = request.args.get("pmid", None)
        raw = find_assertion_conflicts(pmid=pmid) if pmid else find_assertion_conflicts()
        # sort by newest conflict (assuming created_at in logs)
        raw_sorted = sorted(raw, key=lambda x: max((l.get("created_at", 0) for l in x.get("logs", []))), reverse=True)
        page, meta = paginate_list(raw_sorted)
        return jsonify(
            standard_response(
                conflicts=page,
                pagination=meta,
                total_conflicts=len(raw_sorted),
            )
        )
    except Exception as e:
        current_app.logger.exception("Error fetching conflicts")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api.route("/api/consensus/<pmid>", methods=["GET"])
@require_admin
def api_consensus_for_pmid(pmid):
    """
    Get final decisions (consensus/arbitrate) for all assertions in a given PMID.
    """
    try:
        final = aggregate_final_decisions_for_pmid(pmid)
        return jsonify(standard_response(final_decisions=final, count=len(final)))
    except Exception as e:
        current_app.logger.exception("Error fetching consensus for PMID %s", pmid)
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api.route("/api/reviewers", methods=["GET"])
@require_admin
def api_list_reviewers():
    """
    Return list of reviewers with optional enriched stats.
    Query: ?include_stats=1
    """
    try:
        reviewers = get_all_reviewers()
        include_stats = request.args.get("include_stats") in ("1", "true", "yes")
        enriched = []
        for r in reviewers:
            entry = dict(r)
            if include_stats:
                try:
                    entry["stats"] = get_stats_for_reviewer(r["email"])
                except Exception:
                    entry["stats"] = {}
            enriched.append(entry)
        return jsonify(standard_response(reviewers=enriched, total=len(enriched)))
    except Exception as e:
        current_app.logger.exception("Error listing reviewers")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api.route("/api/reviewer/<email>/stats", methods=["GET"])
@require_admin
def api_reviewer_stats(email):
    """
    Return review statistics for a single reviewer.
    """
    try:
        stats = get_stats_for_reviewer(email)
        return jsonify(standard_response(reviewer_email=email, stats=stats))
    except Exception as e:
        current_app.logger.exception("Error fetching stats for reviewer %s", email)
        return jsonify({"success": False, "message": str(e)}), 500