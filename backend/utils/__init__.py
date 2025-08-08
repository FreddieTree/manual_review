# backend/utils/__init__.py
from __future__ import annotations

import re
from typing import Any, Iterable, Iterator, List, Optional, Tuple, Union

# ==== Email / identity helpers ============================================

DEFAULT_EMAIL_DOMAIN = "bristol.ac.uk"

# Precompiled email regex (simplified RFC)
_EMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", re.IGNORECASE)


def _domain_matches(domain: str, allowed: Union[str, Iterable[str]]) -> bool:
    """Domain matching helper supporting three forms (allowed may be str/list/tuple/set):
    1) Exact match: "bristol.ac.uk"
    2) Wildcard subdomain: "*.bristol.ac.uk" -> allows a.bristol.ac.uk (not the bare domain)
    3) Suffix match: ".bristol.ac.uk" -> allows both bristol.ac.uk and subdomains

    The `domain` parameter may be an email or a bare domain; if email, the part after '@' is used.
    """
    d = (domain or "").strip().lower()
    if "@" in d:
        d = d.split("@", 1)[1]

    def _match_one(pat: str) -> bool:
        p = (pat or "").strip().lower()
        if not p:
            return False
        if p.startswith("*."):
            # Subdomain-only match, not including the root domain
            suf = p[2:]
            return d.endswith("." + suf)
        if p.startswith("."):
            # Suffix match including the root domain
            suf = p[1:]
            return d == suf or d.endswith("." + suf)
        return d == p

    if isinstance(allowed, (set, list, tuple)):
        return any(_match_one(a) for a in allowed)
    return _match_one(str(allowed))


def normalize_email(raw: Any) -> str:
    """Normalize email lowercasing and whitespace; invalid input returns empty string."""
    if not isinstance(raw, str):
        return ""
    return raw.strip().lower()


def is_valid_email(
    email: Any,
    *,
    restrict_domain: bool = True,
    allowed_domains: Iterable[str] = (DEFAULT_EMAIL_DOMAIN,),
    allow_suffix_match: bool = True,  # Enable suffix/wildcard matching
) -> bool:
    """Basic email validation. Defaults to enforcing an allowed domain list.
    - When restrict_domain=False, skip domain restrictions
    - allowed_domains may include exact domain, ".suffix" or "*.suffix"
    """
    if not isinstance(email, str):
        return False
    email = email.strip().lower()
    if not _EMAIL_RE.match(email):
        return False

    if not restrict_domain:
        return True

    try:
        domain = email.split("@", 1)[1]
    except Exception:
        return False

    # Supports reading allowed domains from config dynamically if available
    try:
        from ..config import EMAIL_ALLOWED_DOMAINS as _CONF_ALLOWED  # 延迟导入避免环依赖
        if _CONF_ALLOWED:
            allowed_domains = tuple(_CONF_ALLOWED)
    except Exception:
        pass

    allowed_clean = [str(d or "").strip().lower() for d in allowed_domains if str(d or "").strip()]
    if not allowed_clean:
        allowed_clean = [DEFAULT_EMAIL_DOMAIN]

    if allow_suffix_match:
        return any(_domain_matches(domain, a) for a in allowed_clean)
    else:
        return domain in allowed_clean


# ==== String normalization ==================================================

def normalize_str(s: Any) -> str:
    """Normalize string: lowercase, strip, collapse whitespace. Non-strings are cast; failures return empty string."""
    if s is None:
        return ""
    if not isinstance(s, str):
        try:
            s = str(s)
        except Exception:
            return ""
    return " ".join(s.strip().lower().split())


# ==== Boolean coercion ======================================================

def coerce_bool(val: Any) -> bool:
    """Coerce multiple representations into boolean.
    Accepts: bool, numbers, strings ("true","1","yes","on"...)
    """
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    if isinstance(val, str):
        v = val.strip().lower()
        return v in ("1", "true", "yes", "y", "on")
    return False


# ==== Numeric coercion ======================================================

def safe_int(val: Any, default: int = 0) -> int:
    try:
        return int(val)
    except Exception:
        return default


def safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except Exception:
        return default


# ==== Misc utilities ========================================================

def safe_get(d: dict, *keys, default=None):
    """Safe nested dict getter:
    safe_get(obj, 'a', 'b', 'c') == obj.get('a', {}).get('b', {}).get('c', default)
    """
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
    return cur


def chunked(iterable: Iterable, size: int) -> Iterator[List[Any]]:
    """Yield chunks of the iterable of given size (size must be >= 1)."""
    if size < 1:
        raise ValueError("chunk size must be >= 1")

    it = iter(iterable)
    while True:
        chunk: List[Any] = []
        try:
            for _ in range(size):
                chunk.append(next(it))
        except StopIteration:
            if chunk:
                yield chunk
            break
        yield chunk


__all__ = [
    "DEFAULT_EMAIL_DOMAIN",
    "normalize_email",
    "is_valid_email",
    "normalize_str",
    "coerce_bool",
    "safe_int",
    "safe_float",
    "safe_get",
    "chunked",
    "_domain_matches",  # tests may directly import this
]