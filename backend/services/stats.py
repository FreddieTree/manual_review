# backend/services/stats.py
"""Thin service wrapper for stable API imports.

This module exposes a small set of helpers used by routes to avoid reaching
into model details directly. Pricing-related exports were removed.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from ..models.logs import get_stats_for_reviewer as _model_stats
from ..config import get_default_pricing_descriptor as _pricing_from_cfg
from ..models.abstracts import get_abstract_by_id


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