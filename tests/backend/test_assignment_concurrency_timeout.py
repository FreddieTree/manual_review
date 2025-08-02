# tests/backend/test_assignment_concurrency_timeout.py
import time
import backend.services.assignment as assign

def _reset_state():
    assign._LOCKS.clear()

def test_prefer_current_and_refresh(monkeypatch):
    _reset_state()
    # 仅两个摘要
    monkeypatch.setattr(assign, "load_abstracts", lambda: [{"pmid": "P1"}, {"pmid": "P2"}])
    e = "a@b.com"; n = "A"

    # 首次分配
    p = assign.assign_abstract_to_reviewer(e, n)
    assert p in {"P1", "P2"}

    # 指定 prefer_current，应保持在同一 pmid 上并刷新心跳
    p2 = assign.assign_abstract_to_reviewer(e, n, prefer_current=p)
    assert p2 == p
    assert dict(assign.who_has_abstract(p)).get(e)  # 有心跳时间戳

def test_concurrency_limit_and_fallback(monkeypatch):
    _reset_state()
    monkeypatch.setattr(assign, "load_abstracts", lambda: [{"pmid": "P1"}, {"pmid": "P2"}])
    # 限制每个摘要仅 1 人
    monkeypatch.setattr(assign, "_MAX_CONCURRENT_REVIEWERS", 1)

    p1 = assign.assign_abstract_to_reviewer("r1@b.com", "R1")
    # 第二人应落到另一个 pmid（因为 P1 已满）
    p2 = assign.assign_abstract_to_reviewer("r2@b.com", "R2")
    assert p1 != p2

def test_expiration_release(monkeypatch):
    _reset_state()
    monkeypatch.setattr(assign, "load_abstracts", lambda: [{"pmid": "P1"}])

    p = assign.assign_abstract_to_reviewer("x@b.com", "X")
    assert p == "P1" and assign.who_has_abstract("P1")

    # 让锁过期
    now = time.time()
    future = now + assign._DEFAULT_TIMEOUT_SECONDS + 5
    assign.release_expired_locks_locked(now=future)
    assert assign.who_has_abstract("P1") == []