import time
from backend.models.logs import log_review_action
from backend.services.aggregation import (
    get_conflict_overview, get_detailed_assertion_summary,
    export_final_consensus, export_summary_to_json, aggregate_final_decisions_for_pmid
)

def _log(pmid, action, **kw):
    log_review_action({"pmid": pmid, "action": action, **kw, "created_at": time.time()})

def test_aggregation_and_export(logs_path, tmp_path):
    pmid = "1001"
    # 共识：两个 accept
    _log(pmid, "add", subject="A", subject_type="dsyn", predicate="TREATS", object="B", object_type="phsu")
    _log(pmid, "accept", reviewer="r1@bristol.ac.uk")
    _log(pmid, "accept", reviewer="r2@bristol.ac.uk")
    # 冲突：accept + reject
    _log(pmid, "add", subject="X", subject_type="dsyn", predicate="TREATS", object="Y", object_type="phsu")
    _log(pmid, "accept", reviewer="r1@bristol.ac.uk")
    _log(pmid, "reject", reviewer="r2@bristol.ac.uk")

    over = get_conflict_overview()
    assert over["total_pmids"] >= 1 and over["conflicts"] >= 1

    detail = get_detailed_assertion_summary(pmid)
    assert any(d["consensus_status"] == "consensus" for d in detail)
    assert any(d["consensus_status"] == "conflict" for d in detail)

    finals = aggregate_final_decisions_for_pmid(pmid)
    assert any(d["final_decision"] in ("consensus", "arbitrated") for d in finals)

    out = tmp_path / "one.json"
    assert export_summary_to_json(pmid, str(out)) is True and out.exists()

    count, out_path = export_final_consensus()
    assert count >= 1 and out_path.exists()