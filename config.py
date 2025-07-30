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

# ==== Reviewer/Task Settings ====
REVIEW_TIMEOUT_MINUTES = int(os.environ.get("MANUAL_REVIEW_TIMEOUT", 30))   # Task lock timeout (minutes)
MAX_REVIEWERS_PER_ABSTRACT = 2  # For future flexibility, do not hardcode in business logic

# ==== Logging and Debugging ====
LOG_LEVEL = os.environ.get("MANUAL_REVIEW_LOG_LEVEL", "INFO")  # "DEBUG" for development

# ==== UI Customization ====
SITE_TITLE = "Manual Assertion Review Platform"

# ==== For Future Features ====
# SQLITE_PATH = os.path.join(DATA_DIR, "manual_review.db")
# REDIS_URL = os.environ.get("MANUAL_REVIEW_REDIS_URL", "")

# ---- Add other project-wide constants here as needed ----