from __future__ import annotations

from flask import Blueprint, request, jsonify, current_app

from ..config import (
    REWARD_PER_ABSTRACT,
    REWARD_PER_ASSERTION_ADD,
    get_logger,
)
from ..services import pricing as _pricing_service

# —— monkeypatch 支持（for test）——
compute_pricing_for_abstract = _pricing_service.compute_pricing_for_abstract
compute_default_pricing = _pricing_service.compute_default_pricing

pricing_api = Blueprint("pricing_api", __name__, url_prefix="/api")
logger = get_logger("routes.pricing")


@pricing_api.get("/review/pricing")
def api_pricing():
    """
    查询参数：
      - abstract / abstractId / abstract_id / pmid

    无参数时返回默认计价，data 必含 per_abstract/per_assertion_add/default_descriptor/total/currency/units
    有参数时返回摘要专属计价，data 必含 total/currency/units/pmid/default_descriptor
    """
    print("===> /review/pricing 被调用，参数：", dict(request.args))
    abs_id = (
        request.args.get("abstract")
        or request.args.get("abstractId")
        or request.args.get("abstract_id")
        or request.args.get("pmid")
    )

    if not abs_id:
        try:
            descriptor = compute_default_pricing()
            data = {
                "per_abstract": float(REWARD_PER_ABSTRACT),
                "per_assertion_add": float(REWARD_PER_ASSERTION_ADD),
                "currency": descriptor.get("currency", "GBP"),
                "total": descriptor.get("amount", 0.0),
                "units": descriptor.get("units", {}),
                "default_descriptor": descriptor,
            }
        except Exception:
            current_app.logger.exception("Failed to compute default pricing descriptor")
            data = {
                "per_abstract": 0.0,
                "per_assertion_add": 0.0,
                "currency": "GBP",
                "total": 0.0,
                "units": {},
                "default_descriptor": {},
            }
        return jsonify({"success": True, "data": data}), 200

    try:
        result = compute_pricing_for_abstract(abs_id)
        if result is None:
            return jsonify({"success": False, "message": "Abstract not found"}), 404
        data = {
            "currency": result.get("currency", "GBP"),
            "total": result.get("amount", 0.0),
            "units": result.get("units", {}),
            "pmid": result.get("pmid"),
            "default_descriptor": result,
        }
        return jsonify({"success": True, "data": data}), 200
    except Exception as e:
        current_app.logger.exception("Pricing computation failed for %s", abs_id)
        return (
            jsonify(
                {
                    "success": False,
                    "message": str(e),
                }
            ),
            500,
        )
    print("===> 返回的 data：", data)