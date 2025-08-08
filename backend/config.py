# backend/config.py
from __future__ import annotations

import os
import logging
from pathlib import Path
from functools import lru_cache
from typing import Any, Optional, List, Sequence, Union, Iterable

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
    v = os.environ.get(varname)
    return Path(v) if v else default

# ---- paths -----------------------------------------------------------------

BACKEND_DIR: Path = Path(__file__).resolve().parent
PROJECT_ROOT: Path = BACKEND_DIR.parent

DATA_DIR: Path = Path(_env("MANUAL_REVIEW_DATA_DIR", str(PROJECT_ROOT / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

EXPORTS_DIR: Path = DATA_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Primary abstracts file: default to the versioned one
ABSTRACTS_PATH: Path = Path(_env("MANUAL_REVIEW_ABSTRACTS_PATH", str(DATA_DIR / "sentence_level_gpt4.1.jsonl")))
REVIEW_LOGS_PATH: Path = Path(_env("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(DATA_DIR / "review_logs.jsonl")))
REVIEWERS_JSON: Path = Path(_env("MANUAL_REVIEW_REVIEWERS_JSON", str(DATA_DIR / "reviewers.json")))
FINAL_EXPORT_PATH: Path = Path(_env("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(EXPORTS_DIR / "final_consensus.jsonl")))

# ---- security / identity ---------------------------------------------------

SECRET_KEY: str = _env("MANUAL_REVIEW_SECRET_KEY", "replace-with-a-random-secret-key")

EMAIL_ALLOWED_DOMAINS: List[str] = _env_list("EMAIL_ALLOWED_DOMAINS", ["bristol.ac.uk"])
ADMIN_EMAIL: str = _env("MANUAL_REVIEW_ADMIN_EMAIL", "nd23942@bristol.ac.uk")
ADMIN_NAME: str = _env("MANUAL_REVIEW_ADMIN_NAME", "Freddie")

SESSION_COOKIE_NAME: str = _env("SESSION_COOKIE_NAME", "reviewer_session")
SESSION_COOKIE_SAMESITE: str = _env("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE: bool = _env_bool("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_HTTPONLY: bool = _env_bool("SESSION_COOKIE_HTTPONLY", True)

# ---- reviewer / task settings ---------------------------------------------

# Lock duration: 60 minutes default (1 hour)
REVIEW_TIMEOUT_MINUTES: int = _env_int("MANUAL_REVIEW_TIMEOUT", 60)
# Concurrency per abstract: default 1 (exclusive lock); total reviewers across time is a process rule, not enforced here
MAX_REVIEWERS_PER_ABSTRACT: int = _env_int("MANUAL_REVIEWERS_PER_ABSTRACT", 1)

# ---- rewards (legacy placeholders; pricing removed) ------------------------

REWARD_PER_ABSTRACT: float = _env_float("REWARD_PER_ABSTRACT", 0.0)
REWARD_PER_ASSERTION_ADD: float = _env_float("REWARD_PER_ASSERTION_ADD", 0.0)

# ---- vocab ---------------------------------------------------------------

try:
    from backend.services.vocab import get_whitelists as _get_whitelists  # noqa
    PREDICATE_WHITELIST, ENTITY_TYPE_WHITELIST = _get_whitelists()
except Exception:
    PREDICATE_WHITELIST = [
        "PREDISPOSES","COEXISTS_WITH","TREATS","AFFECTS","ISA","PROCESS_OF","USES",
    "ASSOCIATED_WITH","CAUSES","DIAGNOSES","MANIFESTATION_OF","LOCATION_OF","PRECEDES",
    "PART_OF","PREVENTS","DISRUPTS","COMPLICATES","ADMINISTERED_TO","PRODUCES",
    "INTERACTS_WITH","OCCURS_IN","COMPARED_WITH","AUGMENTS","STIMULATES","SAME_AS",
    "METHOD_OF","MEASUREMENT_OF","INHIBITS","CONVERTS_TO",
    ]
    ENTITY_TYPE_WHITELIST = ["acab","anab","cgab","dsyn","emod","fndg","inpo","mobd","neop","orga","patf","phsu","sosy"]

def validate_predicate(predicate: str) -> bool:
    return predicate in PREDICATE_WHITELIST

def validate_entity_type(et: str) -> bool:
    return et in ENTITY_TYPE_WHITELIST

# ---- UI / site -------------------------------------------------------------

SITE_TITLE: str = _env("MANUAL_REVIEW_SITE_TITLE", "Manual Assertion Review Platform")

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

# ---- descriptor helper (legacy, retained for minimal breakage) -------------

def get_default_pricing_descriptor(abstract_obj: Optional[dict]) -> dict:
    """Return a neutral descriptor; pricing is removed but some callers use shape."""
    sentence_count = 0
    if abstract_obj:
        sentence_count = abstract_obj.get("sentence_count") or len(abstract_obj.get("sentence_results", []))
    return {
        "per_abstract": 0.0,
        "per_assertion_add": 0.0,
        "sentence_count": sentence_count,
        "total_base": 0.0,
        "estimated_for_this": 0.0,
        "currency": "GBP",
        "amount": 0.0,
        "units": {},
        "pmid": abstract_obj.get("pmid") if isinstance(abstract_obj, dict) else None,
    }

# ---- feature flags ---------------------------------------------------------

FEATURE_FLAGS = {
    "ENABLE_PROACTIVE_ARBITRATION": _env_bool("ENABLE_PROACTIVE_ARBITRATION", False),
    "SHOW_DEBUG_TOOLTIPS": _env_bool("SHOW_DEBUG_TOOLTIPS", False),
}

# ---- integrity check ------------------------------------------------------

def assert_integrity(raise_on_missing: bool = False) -> bool:
    """
    校验关键文件。abstracts 文件必须存在；其他只是确保目录结构。
    """
    ok = True
    missing = []

    if not ABSTRACTS_PATH.exists():
        missing.append(str(ABSTRACTS_PATH))
        ok = False

    # 确保其他目录存在（但不强制它们已有文件）
    REVIEW_LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEWERS_JSON.parent.mkdir(parents=True, exist_ok=True)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if not ok and raise_on_missing:
        raise FileNotFoundError(f"Missing required path(s): {', '.join(missing)}")
    if not ok:
        get_logger(__name__).warning(f"Missing required path(s): {', '.join(missing)}")
    return ok