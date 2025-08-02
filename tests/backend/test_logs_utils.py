# tests/backend/test_logs_utils.py
from backend.models.logs import _to_float_ts

def test_to_float_ts_variants():
    assert _to_float_ts(123.4) == 123.4
    assert _to_float_ts("123.4") == 123.4
    assert _to_float_ts("bad") == 0.0
    assert _to_float_ts(None) == 0.0