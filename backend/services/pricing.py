from __future__ import annotations
from typing import Optional, Dict, Any

from ..models.abstracts import get_abstract_by_id
from ..config import get_default_pricing_descriptor, get_logger

logger = get_logger("services.pricing")

def compute_pricing_for_abstract(abs_id: str | int | Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    给定摘要 pmid 或对象，输出标准 pricing dict
    """
    try:
        if isinstance(abs_id, dict):
            return get_default_pricing_descriptor(abs_id)
        pmid = str(abs_id)
        abstract = get_abstract_by_id(pmid)
        if not abstract:
            return None
        return get_default_pricing_descriptor(abstract)
    except Exception:
        logger.exception("compute_pricing_for_abstract failed")
        return None

def compute_default_pricing() -> Dict[str, Any]:
    """
    返回标准 default pricing dict（无摘要时）
    """
    return get_default_pricing_descriptor(None)