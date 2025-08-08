# backend/services/export_service.py
import json
import time
import hashlib
from pathlib import Path
from backend.models.db import abstracts_col
from backend.models.logs import log_review_action

def export_passed_assertions(export_path):
    # add timestamped path if a directory is provided
    export_path = str(export_path)
    out_path = Path(export_path)
    if out_path.is_dir():
        ts = int(time.time())
        out_path = out_path / f"export_{ts}.jsonl"

    total = 0
    with open(out_path, 'w', encoding='utf-8') as f:
        for abs_doc in abstracts_col.find({}):
            pmid = abs_doc['pmid']
            for s in abs_doc.get('sentences', []):
                sent_idx = s['sentence_index']
                sent_text = s['sentence']
                for a in s.get('assertions', []):
                    if a.get('final_status') == "consensus" and a.get('final_decision') in ("accept", "add"):
                        out = {
                            "pmid": pmid,
                            "sentence_index": sent_idx,
                            "sentence": sent_text,
                            "assertion": a
                        }
                        f.write(json.dumps(out, ensure_ascii=False) + '\n')
                        total += 1

    # compute file hash for traceability
    file_hash = None
    try:
        h = hashlib.sha1()
        with open(out_path, 'rb') as rf:
            while True:
                chunk = rf.read(1024 * 1024)
                if not chunk:
                    break
                h.update(chunk)
        file_hash = h.hexdigest()
    except Exception:
        file_hash = None

    try:
        log_review_action({
            "action": "admin_export",
            "path": str(out_path),
            "created_at": time.time(),
            "sha1": file_hash,
            "total_records": total,
        })
    except Exception:
        pass
    return str(out_path), total, file_hash

if __name__ == "__main__":
    export_passed_assertions("data/exported_passed.jsonl")
    print("Export finished.")