# backend/scripts/reset_and_seed_one.py
from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path
from typing import Optional

from backend.models.db import db, abstracts_col  # uses MONGO_URI/MONGO_DB_NAME from env
from backend.services.import_service import fill_assertion_index
from backend.schemas.abstracts import Abstract
from backend.config import DATA_DIR, REVIEW_LOGS_PATH


def _find_jsonl(explicit_path: Optional[str]) -> Path:
    if explicit_path:
        p = Path(explicit_path)
        if not p.exists():
            raise FileNotFoundError(f"Input not found: {explicit_path}")
        return p
    # Prefer files under DATA_DIR; fall back to ./data
    candidates = []
    try:
        candidates.extend(sorted(Path(DATA_DIR).glob("*.jsonl")))
    except Exception:
        pass
    if not candidates:
        try:
            candidates.extend(sorted(Path("data").glob("*.jsonl")))
        except Exception:
            pass
    if not candidates:
        raise FileNotFoundError("No *.jsonl found in data directory. Place your file under data/.")
    # Pick the largest by size as likely main dataset
    candidates.sort(key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)
    return candidates[0]


def _pick_one_json_line(jsonl_path: Path) -> dict:
    # Reservoir sampling to avoid loading entire file into memory
    chosen: Optional[str] = None
    n = 0
    with jsonl_path.open("r", encoding="utf-8") as f:
        for line in f:
            s = (line or "").strip()
            if not s:
                continue
            n += 1
            if random.randint(1, n) == 1:
                chosen = s
    if not chosen:
        raise ValueError(f"No valid JSON lines found in {jsonl_path}")
    try:
        obj = json.loads(chosen)
    except Exception as e:
        raise ValueError(f"Failed to parse JSON from {jsonl_path}: {e}")
    if not isinstance(obj, dict):
        raise ValueError("Selected JSONL line is not an object")
    return obj


def reset_and_seed_one(input_path: Optional[str], *, clear_logs: bool = False) -> str:
    # 1) Clear Mongo collections (abstracts + volatile locks/logs if present)
    # Avoid dropping the whole DB to preserve other collections if used elsewhere.
    abstracts_col.delete_many({})
    try:
        db["locks"].delete_many({})
    except Exception:
        pass
    try:
        db["logs"].delete_many({})
    except Exception:
        pass

    # Optionally clear local JSONL review logs file
    if clear_logs:
        try:
            Path(REVIEW_LOGS_PATH).parent.mkdir(parents=True, exist_ok=True)
            with open(REVIEW_LOGS_PATH, "w", encoding="utf-8") as fh:
                fh.write("")
        except Exception:
            pass

    # 2) Choose source and pick one abstract
    src = _find_jsonl(input_path)
    raw = _pick_one_json_line(src)

    # 3) Normalize to DB shape and validate
    obj = fill_assertion_index(raw)
    abstract = Abstract.model_validate(obj)
    doc = abstract.model_dump()

    # DB uses `sentences` shape; Abstract schema already uses `sentences`
    # Ensure pmid is a string for consistent querying
    doc["pmid"] = str(doc.get("pmid"))

    # 4) Insert
    abstracts_col.insert_one(doc)

    return str(doc["pmid"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Clear Mongo collections and seed ONE random abstract from JSONL.")
    parser.add_argument("--file", dest="file", help="Path to JSONL file (defaults to largest *.jsonl under data/)")
    parser.add_argument("--clear-logs", action="store_true", help="Also truncate local JSON review log file")
    args = parser.parse_args()

    pmid = reset_and_seed_one(args.file, clear_logs=args.clear_logs)
    print(f"Seeded one abstract. PMID={pmid}")


if __name__ == "__main__":
    main()
