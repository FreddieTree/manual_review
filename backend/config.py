# backend/config.py
"""
Central configuration for the Manual Assertion Review Platform.

- Single source of truth for file paths, rewards, vocab whitelists, CORS, session policy.
- Reads from environment with sane defaults suitable for local dev.
- Whitelists are sourced from backend.services.vocab to avoid duplication.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from functools import lru_cache
from typing import Any, Optional, List, Sequence, Union

# ---- env helpers -----------------------------------------------------------

def _env(key: str, default: Optional[str] = None) -> Optional[str]:
    return os.environ.get(key, default)

def _env_bool(key: str, default: bool = False) -> bool:
    val = os.environ.get(key)
    return default if val is None else val.strip().lower() in ("1", "true", "yes", "on")

def _env_int(key: str, default: int = 0) -> int:
    try:
        val = os.environ.get(key)
        return int(val) if val is not None else default
    except Exception:
        return default

def _env_float(key: str, default: float = 0.0) -> float:
    try:
        val = os.environ.get(key)
        return float(val) if val is not None else default
    except Exception:
        return default

def _env_list(key: str, default: Sequence[str] = ()) -> List[str]:
    raw = os.environ.get(key)
    if not raw:
        return list(default)
    return [s.strip() for s in raw.split(",") if s.strip()]

def _env_path(varname: str, default: Path) -> Path:
    """优先取环境变量（若存在），否则用默认路径。"""
    v = os.environ.get(varname)
    return Path(v) if v else default

# ---- paths -----------------------------------------------------------------

BACKEND_DIR: Path = Path(__file__).resolve().parent
PROJECT_ROOT: Path = BACKEND_DIR.parent

DATA_DIR: Path = Path(_env("MANUAL_REVIEW_DATA_DIR", str(PROJECT_ROOT / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

EXPORTS_DIR: Path = DATA_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

ABSTRACTS_PATH: Path = Path(_env("MANUAL_REVIEW_ABSTRACTS_PATH", str(DATA_DIR / "sentence_level_gpt4.1.jsonl")))
REVIEW_LOGS_PATH: Path = Path(_env("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(DATA_DIR / "review_logs.jsonl")))
REVIEWERS_JSON: Path = Path(_env("MANUAL_REVIEW_REVIEWERS_JSON", str(DATA_DIR / "reviewers.json")))
FINAL_EXPORT_PATH: Path = Path(_env("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(EXPORTS_DIR / "final_consensus.jsonl")))

# ---- security / identity ---------------------------------------------------

SECRET_KEY: str = _env("MANUAL_REVIEW_SECRET_KEY", "replace-with-a-random-secret-key")

EMAIL_ALLOWED_DOMAINS: List[str] = _env_list("EMAIL_ALLOWED_DOMAINS", ["bristol.ac.uk"])
ADMIN_EMAIL: str = _env("MANUAL_REVIEW_ADMIN_EMAIL", "nd23942@bristol.ac.uk")
ADMIN_NAME: str = _env("MANUAL_REVIEW_ADMIN_NAME", "Freddie")

# session cookie policy (Flask 会读取这些值)
SESSION_COOKIE_NAME: str = _env("SESSION_COOKIE_NAME", "reviewer_session")
SESSION_COOKIE_SAMESITE: str = _env("SESSION_COOKIE_SAMESITE", "Lax")  # Lax/Strict/None
SESSION_COOKIE_SECURE: bool = _env_bool("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_HTTPONLY: bool = _env_bool("SESSION_COOKIE_HTTPONLY", True)

# ---- reviewer / task settings ---------------------------------------------

REVIEW_TIMEOUT_MINUTES: int = _env_int("MANUAL_REVIEW_TIMEOUT", 30)
MAX_REVIEWERS_PER_ABSTRACT: int = _env_int("MANUAL_REVIEWERS_PER_ABSTRACT", 2)

# ---- rewards ---------------------------------------------------------------

REWARD_PER_ABSTRACT: float = _env_float("REWARD_PER_ABSTRACT", 0.3)
REWARD_PER_ASSERTION_ADD: float = _env_float("REWARD_PER_ASSERTION_ADD", 0.05)

# ---- vocab (single source of truth) ---------------------------------------
# 关键改动：从 services.vocab 统一获取白名单，防止与 meta/audit 出现不一致
try:
    from backend.services.vocab import get_whitelists as _get_whitelists  # noqa
    PREDICATE_WHITELIST, ENTITY_TYPE_WHITELIST = _get_whitelists()
except Exception:
    # 兜底（本地最小集合；建议优先修复 services.vocab）
    PREDICATE_WHITELIST: List[str] = [
        "causes", "increases", "reduces", "decreases",
        "associated_with", "inhibits", "induces", "related_to",
        "no_effect", "prevents",
    ]
    ENTITY_TYPE_WHITELIST: List[str] = ["dsyn", "neop", "chem", "phsu", "gngm", "aapp", "sosy", "patf"]

def validate_predicate(predicate: str) -> bool:
    return predicate in PREDICATE_WHITELIST

def validate_entity_type(et: str) -> bool:
    return et in ENTITY_TYPE_WHITELIST

# ---- UI / site -------------------------------------------------------------

SITE_TITLE: str = _env("MANUAL_REVIEW_SITE_TITLE", "Manual Assertion Review Platform")

# CORS：默认允许本地前端，可通过环境变量 ALLOWED_ORIGINS 追加
CORS_ORIGINS: List[str] = list({
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *_env_list("ALLOWED_ORIGINS", []),
})

# ---- logging ---------------------------------------------------------------

def _parse_log_level(val: Union[int, str], default: int = logging.INFO) -> int:
    if isinstance(val, int):
        return val
    s = str(val).strip()
    # 既支持 "DEBUG"/"INFO"，也支持 "20"/"10"
    if s.isdigit():
        try:
            return int(s)
        except Exception:
            return default
    return getattr(logging, s.upper(), default)

LOG_LEVEL: Union[int, str] = _env("MANUAL_REVIEW_LOG_LEVEL", "INFO")

@lru_cache(maxsize=1)
def get_logger(name: Optional[str] = None) -> logging.Logger:
    level = _parse_log_level(LOG_LEVEL)
    logger = logging.getLogger(name or __name__)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s %(levelname)-5s [%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger

# ---- pricing helper --------------------------------------------------------

def get_default_pricing_descriptor(abstract_obj: Optional[dict]) -> dict:
    """
    Compute a simple pricing object from an abstract (can be replaced with your own logic).
    """
    sentence_count = 0
    if abstract_obj:
        sentence_count = abstract_obj.get("sentence_count") or len(abstract_obj.get("sentence_results", []))
    base = round(REWARD_PER_ABSTRACT, 3)
    per_assertion = round(REWARD_PER_ASSERTION_ADD, 3)
    estimated_total = round(base + sentence_count * 0.01, 3)
    return {
        "per_abstract": base,
        "per_assertion_add": per_assertion,
        "sentence_count": sentence_count,
        "total_base": base,
        "estimated_for_this": estimated_total,
        "currency": "£",
    }

# ---- feature flags ---------------------------------------------------------

FEATURE_FLAGS = {
    "ENABLE_PROACTIVE_ARBITRATION": _env_bool("ENABLE_PROACTIVE_ARBITRATION", False),
    "SHOW_DEBUG_TOOLTIPS": _env_bool("SHOW_DEBUG_TOOLTIPS", False),
}

# ---- integrity checks ------------------------------------------------------

def assert_integrity(raise_on_missing: bool = False) -> bool:
    """
    Sanity checks for important paths. Returns True if ok.
    If raise_on_missing=True, will raise on missing abstracts file.
    """
    ok = True
    if not ABSTRACTS_PATH.exists():
        msg = f"Abstracts file missing: {ABSTRACTS_PATH}"
        if raise_on_missing:
            raise FileNotFoundError(msg)
        get_logger(__name__).warning(msg)
        ok = False
    # Ensure parents exist for writable files
    REVIEW_LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEWERS_JSON.parent.mkdir(parents=True, exist_ok=True)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return ok

def _resolve_runtime_paths():
    """
    每次调用都基于“当前环境变量”解析运行时路径，避免模块级常量在
    单测中被早绑定而无法感知 monkeypatch 的修改。
    """
    data_dir = Path(os.environ.get("MANUAL_REVIEW_DATA_DIR", "data"))
    abstracts = _env_path("MANUAL_REVIEW_ABSTRACTS_PATH", data_dir / "abstracts.jsonl")
    logs      = _env_path("MANUAL_REVIEW_REVIEW_LOGS_PATH", data_dir / "review_logs.jsonl")
    reviewers = _env_path("MANUAL_REVIEW_REVIEWERS_JSON", data_dir / "reviewers.json")
    final_out = _env_path("MANUAL_REVIEW_FINAL_EXPORT_PATH", data_dir / "exports" / "final.jsonl")
    return {
        "ABSTRACTS_PATH": abstracts,
        "REVIEW_LOGS_PATH": logs,
        "REVIEWERS_JSON": reviewers,
        "FINAL_EXPORT_PATH": final_out,
    }

def assert_integrity(raise_on_missing: bool = True) -> bool:
    """
    校验关键路径是否就绪。
    规则（与测试期望对齐）：
      - ABSTRACTS_PATH：必须存在文件；缺失 => 返回 False / 或抛异常（当 raise_on_missing=True）
      - 其他文件允许不存在（项目其他模块已能容忍空缺）；这里只进行轻量存在性检查但不影响最终布尔值。
    """
    paths = _resolve_runtime_paths()

    ok = True
    missing = []

    # 关键：abstracts 必须存在
    if not paths["ABSTRACTS_PATH"].exists():
        ok = False
        missing.append(str(paths["ABSTRACTS_PATH"]))

    # 其他路径仅做提示性检查（不影响 ok）
    # logs/reviewers/final 输出路径的父目录是否存在并不强制

    if not ok and raise_on_missing:
        raise FileNotFoundError(f"Missing required path(s): {', '.join(missing)}")

    return ok