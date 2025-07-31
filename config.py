"""
config.py
Centralized configuration for the manual_review Flask platform.
Edit this file (or use environment variables) to adjust project settings.
"""
import os

# ==== Basic Security ====
SECRET_KEY = os.environ.get("MANUAL_REVIEW_SECRET_KEY", "replace-with-a-random-secret-key")

# ==== Admin Settings ====
ADMIN_EMAIL = os.environ.get("MANUAL_REVIEW_ADMIN_EMAIL", "nd23942@bristol.ac.uk")
ADMIN_NAME = os.environ.get("MANUAL_REVIEW_ADMIN_NAME", "Freddie")

# ==== Data File Paths ====
DATA_DIR = "data"
ABSTRACTS_PATH = os.path.join(DATA_DIR, "sentence_level_gpt4.1.jsonl")
REVIEW_LOGS_PATH = os.path.join(DATA_DIR, "review_logs.jsonl")
EXPORTS_DIR = os.path.join(DATA_DIR, "exports")  # For future batch exports
FINAL_EXPORT_PATH = os.path.join(EXPORTS_DIR, "final_consensus.jsonl")

# 路径自动创建
for d in [DATA_DIR, EXPORTS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

# ==== Reviewer/Task Settings ====
REVIEW_TIMEOUT_MINUTES = int(os.environ.get("MANUAL_REVIEW_TIMEOUT", 30))
MAX_REVIEWERS_PER_ABSTRACT = 2

# ==== Assertion White List ====
# 合法谓语、实体类型，统一由此配置，便于后端/前端共享
PREDICATE_WHITELIST = [
    "causes", "increases", "reduces", "decreases", "associated_with", "inhibits",
    "induces", "related_to", "no_effect", "prevents"
]
ENTITY_TYPE_WHITELIST = [
    "dsyn", "neop", "chem", "phsu", "gngm", "aapp", "sosy", "patf"
    # ...可按实际补充
]

# ==== Reward Calculation ====
REWARD_PER_ABSTRACT = float(os.environ.get("REWARD_PER_ABSTRACT", 0.3))
REWARD_PER_ASSERTION_ADD = float(os.environ.get("REWARD_PER_ASSERTION_ADD", 0.05))

# ==== Logging and Debugging ====
LOG_LEVEL = os.environ.get("MANUAL_REVIEW_LOG_LEVEL", "INFO")
SITE_TITLE = "Manual Assertion Review Platform"

# ==== For Future Features ====
# SQLITE_PATH = os.path.join(DATA_DIR, "manual_review.db")
# REDIS_URL = os.environ.get("MANUAL_REVIEW_REDIS_URL", "")

# ---- Add other project-wide constants here as needed ----