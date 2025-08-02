# tests/backend/test_assignment_minimal.py
from backend.services.assignment import (
    touch_assignment, who_has_abstract, release_assignment, get_current_locks_snapshot
)

def test_assignment_basic(monkeypatch):
    email, pmid = "u@b.ac.uk", "1001"

    # 创建/刷新
    touch_assignment(email=email, pmid=pmid)

    holder = who_has_abstract(pmid)
    # 兼容：你的实现返回 list；若未来改为 str 也能通过
    if isinstance(holder, list):
        assert email in holder
    else:
        assert holder == email

    snap = get_current_locks_snapshot()
    assert pmid in snap

    # 释放
    release_assignment(email=email, pmid=pmid)
    holder_after = who_has_abstract(pmid)
    assert holder_after in (None, [], "")