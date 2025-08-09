# backend/models/db.py
import os
try:
    # Load environment from .env if present (helps local dev)
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Mongo configuration via environment variables only.
# Example:
#   export MONGO_URI="mongodb+srv://USER:PASS@host/db?options"
#   export MONGO_DB_NAME="assertion_review"

MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI is required. Please set it in your environment (e.g., export MONGO_URI=... or put it in a .env file).")

DB_NAME = os.environ.get("MONGO_DB_NAME", "assertion_review")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

abstracts_col = db["abstracts"]
reviewers_col = db["reviewers"]
logs_col = db["logs"]


def ensure_indexes() -> None:
    """Create required MongoDB indexes if missing.

    - abstracts.pmid unique
    - locks.expire_at TTL index (if locks collection exists)
    """
    try:
        abstracts_col.create_index("pmid", unique=True, name="pmid_unique")
    except PyMongoError:
        pass
    try:
        locks = db["locks"]
        # TTL index requires datetime field; expire documents at expire_at timestamp
        locks.create_index("expire_at", expireAfterSeconds=0, name="locks_ttl")
        locks.create_index("pmid", unique=True, name="locks_pmid_unique")
    except PyMongoError:
        pass


# Attempt to ensure indexes on import; guarded to avoid breaking tests without Mongo
try:
    ensure_indexes()
except Exception:
    pass
