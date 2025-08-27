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
    all_logs = load_logs()

    def _who(log: dict) -> str:
        return _safe_lower(log.get("creator") or log.get("reviewer") or log.get("email"))

    def _pmid_of(log: dict) -> str:
        raw = log.get("pmid") or log.get("abstract_id") or log.get("abs_id")
        try:
            return str(raw).strip()
        except Exception:
            return ""

    def _is_valid_pmid(pid: str) -> bool:
        if not pid:
            return False
        l = pid.strip().lower()
        if l in ("none", "null", "nan"):
            return False
        # Most PMIDs are digits; accept digits-only to avoid garbage
        return l.isdigit()

    logs = list(all_logs)
    if reviewer_email:
        email_lc = _safe_lower(reviewer_email)
        logs = [l for l in all_logs if _who(l) == email_lc]

    actions_counter: Dict[str, int] = {}
    pmids_touched: set[str] = set()
    sentence_keys: set[tuple[str, int]] = set()
    last_ts = 0.0
    for l in (logs if reviewer_email else all_logs):
        # For global metrics use all logs; for reviewer-scoped, use filtered logs
        act = _safe_lower(l.get("action"))
        actions_counter[act] = actions_counter.get(act, 0) + 1
        pid = _pmid_of(l)
        if _is_valid_pmid(pid):
            pmids_touched.add(pid)
        try:
            si = l.get("sentence_index") if l.get("sentence_index") is not None else l.get("sentence_idx")
            if si is not None:
                si = int(si)
            if _is_valid_pmid(pid) and si is not None:
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

    # Per-abstract detailed summary for selected reviewer
    per_abstract: list[dict] | None = None
    if reviewer_email:
        email_lc = _safe_lower(reviewer_email)

        def _decision_counts(subset: list[dict]) -> dict:
            out = {"accept": 0, "modify": 0, "reject": 0, "uncertain": 0}
            for lg in subset:
                act = _safe_lower(lg.get("action"))
                if act in out:
                    out[act] += 1
            return out

        # Build a mapping from reviewer email to display name for nicer analytics output
        try:
            from ..models.reviewers import load_reviewers
            _name_by_email = { _safe_lower(r.get("email")): (r.get("name") or "") for r in load_reviewers() }
        except Exception:
            _name_by_email = {}

        # PMIDs that this reviewer touched (support multiple log field variants), filter invalids
        pmids_for_reviewer = sorted({ p for p in (_pmid_of(l) for l in logs) if _is_valid_pmid(p) }, key=lambda x: x)
        table: list[dict] = []
        for pid in pmids_for_reviewer:
            # all logs for this pmid from everyone (for determining reviewer order)
            all_for_pid = [l for l in all_logs if _pmid_of(l) == pid]
            # earliest touch per reviewer
            first_touch_by_reviewer: dict[str, float] = {}
            for lg in all_for_pid:
                who = _who(lg)
                try:
                    ts = float(lg.get("created_at") or lg.get("timestamp") or 0)
                except Exception:
                    ts = 0.0
                if who and (who not in first_touch_by_reviewer or ts < first_touch_by_reviewer[who]):
                    first_touch_by_reviewer[who] = ts
            reviewer_order_list = sorted(first_touch_by_reviewer.items(), key=lambda kv: kv[1])
            first_email = reviewer_order_list[0][0] if len(reviewer_order_list) > 0 else None
            second_email = reviewer_order_list[1][0] if len(reviewer_order_list) > 1 else None
            order_num = 1 if email_lc == first_email else 2 if email_lc == second_email else None

            # counts per reviewer restricted to this pmid
            sel_logs = [l for l in all_for_pid if _who(l) == email_lc]
            first_logs = [l for l in all_for_pid if _who(l) == (first_email or "")]
            second_logs = [l for l in all_for_pid if _who(l) == (second_email or "")]

            table.append({
                "pmid": pid,
                "reviewer_order": order_num,
                "selected_reviewer": email_lc,
                "selected_reviewer_name": _name_by_email.get(email_lc) or None,
                "first_reviewer": first_email,
                "first_reviewer_name": _name_by_email.get(first_email or "") or None,
                "second_reviewer": second_email,
                "second_reviewer_name": _name_by_email.get(second_email or "") or None,
                "selected_decisions": _decision_counts(sel_logs),
                "first_reviewer_decisions": _decision_counts(first_logs) if first_email else None,
                "second_reviewer_decisions": _decision_counts(second_logs) if second_email else None,
                "last_activity": max([float(l.get("created_at") or l.get("timestamp") or 0) for l in sel_logs] or [0]) or None,
            })

        # Sort by last activity desc then pmid
        table.sort(key=lambda r: (r.get("last_activity") or 0, r.get("pmid") or ""), reverse=True)
        per_abstract = table

    return {
        "totals": {
            "abstracts": total_abstracts,
            "sentences": total_sentences,
            "assertions": total_assertions,
        },
        "status_counts": status_counts,
        "activity": activity,
        **({"per_abstract": per_abstract} if per_abstract is not None else {}),
    }