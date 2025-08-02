# backend/services/pricing.py
from __future__ import annotations

from typing import Optional, Dict, Any

from ..models.abstracts import get_abstract_by_id
from ..config import get_default_pricing_descriptor, get_logger

logger = get_logger("services.pricing")

def compute_pricing_for_abstract(abs_id: str | int | Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    根据摘要信息计算计价：
      - 若传入的是摘要对象（dict），直接生成描述；
      - 若传入的是 pmid（str/int），查找摘要；找不到则返回 None（由路由层转 404）。
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
        # 服务层异常时稳妥返回 None，让上层按 500 或 404 处理
        return None

def compute_default_pricing() -> Dict[str, Any]:
    """
    无指定摘要时返回默认计价（空 pmid、0 句子等，占位用于前端展示）。
    """
    return get_default_pricing_descriptor(None)