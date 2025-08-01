# config.py
"""
Central configuration for the Manual Assertion Review Platform.

Features:
  * Typed and validated environment-derived configuration.
  * Lazy creation of required directories.
  * Consistent naming and fallback defaults.
  * Helper utilities for feature flags and rate configuration.
"""

import os
import logging
from pathlib import Path
from functools import lru_cache
from typing import Any, Optional, List, Union

# ---- Helpers --------------------------------------------------------------

def _env(key: str, default: Optional[str] = None) -> Optional[str]:
    return os.environ.get(key, default)

def _env_bool(key: str, default: bool = False) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.lower() in ("1", "true", "yes", "on")

def _env_int(key: str, default: int = 0) -> int:
    val = os.environ.get(key)
    try:
        return int(val) if val is not None else default
    except ValueError:
        return default

def _env_float(key: str, default: float = 0.0) -> float:
    val = os.environ.get(key)
    try:
        return float(val) if val is not None else default
    except ValueError:
        return default

# ---- Base paths ----------------------------------------------------------

BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = Path(_env("MANUAL_REVIEW_DATA_DIR", str(BASE_DIR / "data")))

# Ensure directories exist early
EXPORTS_DIR: Path = DATA_DIR / "exports"
for d in (DATA_DIR, EXPORTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ---- Core data file paths ------------------------------------------------

ABSTRACTS_PATH: Path = Path(_env("MANUAL_REVIEW_ABSTRACTS_PATH", str(DATA_DIR / "sentence_level_gpt4.1.jsonl")))
REVIEW_LOGS_PATH: Path = Path(_env("MANUAL_REVIEW_REVIEW_LOGS_PATH", str(DATA_DIR / "review_logs.jsonl")))
REVIEWERS_JSON: Path = Path(_env("MANUAL_REVIEW_REVIEWERS_JSON", str(DATA_DIR / "reviewers.json")))
FINAL_EXPORT_PATH: Path = Path(_env("MANUAL_REVIEW_FINAL_EXPORT_PATH", str(EXPORTS_DIR / "final_consensus.jsonl")))

# ---- Security / Identity -------------------------------------------------

SECRET_KEY: str = _env("MANUAL_REVIEW_SECRET_KEY", "replace-with-a-random-secret-key")
ADMIN_EMAIL: str = _env("MANUAL_REVIEW_ADMIN_EMAIL", "nd23942@bristol.ac.uk")
ADMIN_NAME: str = _env("MANUAL_REVIEW_ADMIN_NAME", "Freddie")

# ---- Reviewer / Task Settings --------------------------------------------

REVIEW_TIMEOUT_MINUTES: int = _env_int("MANUAL_REVIEW_TIMEOUT", 30)
MAX_REVIEWERS_PER_ABSTRACT: int = _env_int("MANUAL_REVIEWERS_PER_ABSTRACT", 2)

# ---- Reward / Commission -------------------------------------------------

REWARD_PER_ABSTRACT: float = _env_float("REWARD_PER_ABSTRACT", 0.3)
REWARD_PER_ASSERTION_ADD: float = _env_float("REWARD_PER_ASSERTION_ADD", 0.05)

# ---- Assertion Whitelists (shared source of truth) ------------------------

PREDICATE_WHITELIST: List[str] = [
    "causes",
    "increases",
    "reduces",
    "decreases",
    "associated_with",
    "inhibits",
    "induces",
    "related_to",
    "no_effect",
    "prevents",
]

ENTITY_TYPE_WHITELIST: List[str] = [
    "dsyn", "neop", "chem", "phsu", "gngm", "aapp", "sosy", "patf"
]

# ---- UI / Site -----------------------------------------------------------

SITE_TITLE: str = _env("MANUAL_REVIEW_SITE_TITLE", "Manual Assertion Review Platform")

# ---- Logging -------------------------------------------------------------

LOG_LEVEL: Union[int, str] = _env("MANUAL_REVIEW_LOG_LEVEL", "INFO")

# Optional: configured logger for modules to import
@lru_cache(maxsize=1)
def get_logger(name: Optional[str] = None) -> logging.Logger:
    level = LOG_LEVEL if isinstance(LOG_LEVEL, int) else getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    logger = logging.getLogger(name or __name__)
    if not logger.hasHandlers():
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)-5s [%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger

# ---- Derived / Utility Properties ---------------------------------------

def get_default_pricing_descriptor(abstract_obj: Optional[dict]) -> dict:
    """
    Helper to compute a consistent pricing object from an abstract.
    Can be reused by API and front-end stubs.
    """
    sentence_count = 0
    if abstract_obj:
        sentence_count = abstract_obj.get("sentence_count") or len(abstract_obj.get("sentence_results", []))
    base = round(REWARD_PER_ABSTRACT, 3)
    per_assertion = round(REWARD_PER_ASSERTION_ADD, 3)
    # Example estimation logic; can be replaced
    estimated_total = round(base + sentence_count * 0.01, 3)
    return {
        "per_abstract": base,
        "per_assertion_add": per_assertion,
        "sentence_count": sentence_count,
        "total_base": base,
        "estimated_for_this": estimated_total,
        "currency": "£",
    }

# ---- Validation utilities ------------------------------------------------

def validate_predicate(predicate: str) -> bool:
    return predicate in PREDICATE_WHITELIST

def validate_entity_type(et: str) -> bool:
    return et in ENTITY_TYPE_WHITELIST

# ---- Feature flags (example) ---------------------------------------------

FEATURE_FLAGS = {
    "ENABLE_PROACTIVE_ARBITRATION": _env_bool("ENABLE_PROACTIVE_ARBITRATION", False),
    "SHOW_DEBUG_TOOLTIPS": _env_bool("SHOW_DEBUG_TOOLTIPS", False),
    # Add more flags as needed.
}

# ---- Safety checks / initialization --------------------------------------

def assert_integrity():
    """
    Runtime sanity checks to fail early if key paths/configs are invalid.
    """
    if not ABSTRACTS_PATH.exists():
        raise FileNotFoundError(f"Abstracts file missing: {ABSTRACTS_PATH}")
    # review log can be created lazily; ensure its directory exists
    REVIEW_LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEWERS_JSON.parent.mkdir(parents=True, exist_ok=True)

# Run integrity check at import time in safe mode (optional)
try:
    assert_integrity()
except Exception:
    # swallow here to avoid breaking imports in some contexts; callers can explicitly call assert_integrity
    pass