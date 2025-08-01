# utils.py
import re
from typing import Any, Iterable, Union

# ==== Email / identity helpers ====

DEFAULT_EMAIL_DOMAIN = "bristol.ac.uk"

def is_valid_email(email: Any, *, restrict_domain: bool = True, allowed_domains: Iterable[str] = (DEFAULT_EMAIL_DOMAIN,)) -> bool:
    """
    Basic email sanity check. By default restricts to specific domain(s)
    (e.g., bristol.ac.uk) to avoid spoofing. Can be relaxed by setting
    restrict_domain=False.
    """
    if not email or not isinstance(email, str):
        return False
    email = email.strip().lower()
    # Simple RFC-like username@domain validation (not full RFC)
    if not re.match(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", email):
        return False
    if restrict_domain:
        domain = email.split("@", 1)[1]
        return domain in allowed_domains
    return True

# ==== String normalization ====

def normalize_str(s: Any) -> str:
    """
    Normalize a value to a comparable string: lowercase, trim, collapse whitespace.
    Safe for non-string inputs.
    """
    if s is None:
        return ""
    if not isinstance(s, str):
        try:
            s = str(s)
        except Exception:
            return ""
    return " ".join(s.strip().lower().split())

# ==== Boolean coercion ====

def coerce_bool(val: Any) -> bool:
    """
    Coerce various representations into boolean.
    Accepts: bool, int/float, string like "true", "1", "yes", "on", etc.
    """
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    if isinstance(val, str):
        v = val.strip().lower()
        return v in ("1", "true", "yes", "y", "on")
    return False

# ==== Misc utilities ====

def safe_get(d: dict, *keys, default=None):
    """
    Traverses nested dictionaries safely.
    Example: safe_get(obj, 'a', 'b', 'c') is equivalent to obj.get('a', {}).get('b', {}).get('c', default)
    """
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
    return cur

def chunked(iterable: Iterable, size: int):
    """
    Yield successive chunks of given size from iterable.
    """
    it = iter(iterable)
    while True:
        chunk = []
        try:
            for _ in range(size):
                chunk.append(next(it))
        except StopIteration:
            if chunk:
                yield chunk
            break
        yield chunk