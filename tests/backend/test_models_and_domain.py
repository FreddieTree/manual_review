from backend.models import abstracts as A
from backend.domain.assertions import make_assertion_id, reject_assertion

def test_abstracts_misc_and_assertion_helpers():
    sample = {"sentence_results":[{"assertions":[{"a":1}]}, {"assertions":[]}]}
    assert A.sentence_count(sample) == 2
    A.invalidate_cache()  # 覆盖即可

    aid = make_assertion_id("A","dsyn","TREATS","B","phsu")
    assert isinstance(aid, str) and aid
    rec = {"subject":"A","predicate":"TREATS","object":"B"}
    rej = reject_assertion(original=rec, reviewer="x@b.a", pmid="1001", sentence_idx=0, sentence_text="t", reason="no")
    assert rej["action"] == "reject"