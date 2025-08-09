# backend/services/stats.py
"""Thin service wrapper for stable API imports.

This module exposes a small set of helpers used by routes to avoid reaching
into model details directly. Pricing-related exports were removed.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from ..models.logs import get_stats_for_reviewer as _model_stats, load_logs
from ..config import get_default_pricing_descriptor as _pricing_from_cfg
from ..models.abstracts import get_abstract_by_id
from ..models import abstracts as abstracts_model
from ..services.aggregation import get_detailed_assertion_summary
from typing import List


def get_stats_for_reviewer(email: str) -> Dict[str, Any]:
    """
    Proxy to models.logs.get_stats_for_reviewer
    """
    return _model_stats(email)


def get_default_pricing_descriptor(abs_id_or_obj: Any) -> Dict[str, Any]:
    """Compatibility helper retained for minimal caller breakage.

    Returns a pricing-like descriptor object with basic counts. The platform
    no longer uses pricing, but some callers/tests may still reference it.
    """
    if isinstance(abs_id_or_obj, dict):
        return _pricing_from_cfg(abs_id_or_obj)
    abs_obj = get_abstract_by_id(abs_id_or_obj)
    return _pricing_from_cfg(abs_obj)


def _safe_lower(s: Any) -> str:
    try:
        return str(s).strip().lower()
    except Exception:
        return ""


def compute_platform_analytics(reviewer_email: str | None = None) -> Dict[str, Any]:
    """Compute platform or reviewer-scoped analytics.

    - When reviewer_email is None: global metrics
    - When reviewer_email is provided: filter activity metrics to that reviewer and
      summarize their contributions.
    """
    # 1) Abstract-level totals from Mongo/file via models
    abstracts = abstracts_model.load_abstracts()
    total_abstracts = len(abstracts)
    total_sentences = 0
    total_assertions = 0
    for a in abstracts:
        sents = a.get("sentence_results", []) or []
        total_sentences += len(sents)
        for s in sents:
            total_assertions += len(s.get("assertions", []) or [])

    # 2) Assertion consensus-status summary using aggregation per PMID
    status_counts = {"consensus": 0, "conflict": 0, "uncertain": 0, "pending": 0, "arbitrated": 0}
    try:
        from ..models.abstracts import get_all_pmids
        pmids: List[str] = list(get_all_pmids())
    except Exception:
        pmids = []
    for pid in pmids:
        try:
            detailed = get_detailed_assertion_summary(pid)
            for item in detailed:
                st = item.get("consensus_status")
                if st in status_counts:
                    status_counts[st] += 1
                else:
                    status_counts["pending"] += 1
        except Exception:
            continue

    # 3) Activity metrics from logs (optionally reviewer-scoped)
    logs = load_logs()
    if reviewer_email:
        email_lc = _safe_lower(reviewer_email)
        logs = [l for l in logs if _safe_lower(l.get("creator") or l.get("reviewer") or l.get("email")) == email_lc]

    actions_counter: Dict[str, int] = {}
    pmids_touched: set[str] = set()
    sentence_keys: set[tuple[str, int]] = set()
    last_ts = 0.0
    for l in logs:
        act = _safe_lower(l.get("action"))
        actions_counter[act] = actions_counter.get(act, 0) + 1
        pid = str(l.get("pmid") or "").strip()
        if pid:
            pmids_touched.add(pid)
        try:
            si = int(l.get("sentence_index")) if l.get("sentence_index") is not None else None
            if pid and si is not None:
                sentence_keys.add((pid, si))
        except Exception:
            pass
        try:
            ts = float(l.get("created_at") or l.get("timestamp") or 0)
            if ts > last_ts:
                last_ts = ts
        except Exception:
            pass

    activity = {
        "actions": actions_counter,
        "abstracts_touched": len(pmids_touched),
        "sentences_touched": len(sentence_keys),
        "last_activity": last_ts or None,
    }

    return {
        "totals": {
            "abstracts": total_abstracts,
            "sentences": total_sentences,
            "assertions": total_assertions,
        },
        "status_counts": status_counts,
        "activity": activity,
    }