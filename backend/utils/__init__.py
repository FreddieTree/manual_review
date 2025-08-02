# backend/utils/__init__.py
from __future__ import annotations

import re
from typing import Any, Iterable, Iterator, List, Optional, Tuple, Union

# ==== Email / identity helpers ============================================

DEFAULT_EMAIL_DOMAIN = "bristol.ac.uk"

# 预编译基础邮箱正则（简化版 RFC）
_EMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", re.IGNORECASE)


def _domain_matches(domain: str, allowed: Union[str, Iterable[str]]) -> bool:
    """
    支持三种形式（allowed 可以是 str / list / tuple / set）：
      1) 精确匹配: "bristol.ac.uk"
      2) 通配后缀: "*.bristol.ac.uk"  -> 允许 a.bristol.ac.uk（不包含 bristol.ac.uk）
      3) 后缀匹配: ".bristol.ac.uk"   -> 允许 a.bristol.ac.uk 与 bristol.ac.uk
    `domain` 可接受 email 或裸域名，email 会自动提取 @ 之后的部分。
    """
    d = (domain or "").strip().lower()
    if "@" in d:
        d = d.split("@", 1)[1]

    def _match_one(pat: str) -> bool:
        p = (pat or "").strip().lower()
        if not p:
            return False
        if p.startswith("*."):
            # 子域匹配，不包括根域
            suf = p[2:]
            return d.endswith("." + suf)
        if p.startswith("."):
            # 后缀匹配，包含根域
            suf = p[1:]
            return d == suf or d.endswith("." + suf)
        return d == p

    if isinstance(allowed, (set, list, tuple)):
        return any(_match_one(a) for a in allowed)
    return _match_one(str(allowed))


def normalize_email(raw: Any) -> str:
    """
    统一邮箱大小写与空白；非法输入返回空串。
    """
    if not isinstance(raw, str):
        return ""
    return raw.strip().lower()


def is_valid_email(
    email: Any,
    *,
    restrict_domain: bool = True,
    allowed_domains: Iterable[str] = (DEFAULT_EMAIL_DOMAIN,),
    allow_suffix_match: bool = True,  # 启用后缀/通配匹配
) -> bool:
    """
    基础邮箱校验。默认限制域名（如 bristol.ac.uk）。
    - restrict_domain=False 时跳过域限制
    - allowed_domains 可包含精确域、".suffix" 或 "*.suffix"
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

    # 支持从 config 动态读取允许域（若存在）
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
    """
    归一化字符串：转小写、去首尾空白、折叠连续空白。
    非字符串尝试转字符串；失败返回空串。
    """
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
    """
    将多种表示转为布尔。
    接受: bool, 数值, 字符串 ("true","1","yes","on"...)
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
    """
    安全地穿透多层 dict：
    safe_get(obj, 'a', 'b', 'c') == obj.get('a', {}).get('b', {}).get('c', default)
    """
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
    return cur


def chunked(iterable: Iterable, size: int) -> Iterator[List[Any]]:
    """
    将可迭代对象按 size 切块依次产出。
    注意：size 必须 >= 1。
    """
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
    "_domain_matches",  # 测试中会直接引用
]