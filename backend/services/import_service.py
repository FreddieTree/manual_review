# backend/services/import_service.py

import json
import traceback
import threading
import time
import uuid
from typing import Callable, Optional, Dict, Any
from backend.models.db import abstracts_col
from backend.schemas.abstracts import Abstract
from backend.models.logs import log_review_action
from backend.models.logs import log_review_action

def fill_assertion_index(obj):
    """补全历史脏数据，每个句子断言都保证 assertion_index 完整、assertions 字段存在。"""
    sent_key = "sentence_results" if "sentence_results" in obj else "sentences"
    new_sentences = []
    for sent in obj.get(sent_key, []):
        if "assertions" not in sent or not isinstance(sent["assertions"], list):
            sent["assertions"] = []
        for idx, assertion in enumerate(sent["assertions"], 1):
            if "assertion_index" not in assertion:
                assertion["assertion_index"] = idx
        new_sentences.append(sent)
    obj["sentences"] = new_sentences
    if sent_key == "sentence_results":
        obj.pop("sentence_results", None)
    return obj

def merge_abstract(existing_doc, new_doc):
    """合并已存在pmid的abstract，不重复添加断言。"""
    updated = False
    sent_map = {s['sentence_index']: s for s in existing_doc.get('sentences', [])}
    for new_sent in new_doc.get('sentences', []):
        idx = new_sent['sentence_index']
        if idx not in sent_map:
            existing_doc['sentences'].append(new_sent)
            updated = True
        else:
            db_sent = sent_map[idx]
            existing_indices = {a['assertion_index'] for a in db_sent.get('assertions', [])}
            for new_ass in new_sent['assertions']:
                if new_ass['assertion_index'] not in existing_indices:
                    db_sent['assertions'].append(new_ass)
                    updated = True
    return updated

def load_jsonl_to_db(jsonl_path, error_log_path="data/failed_imports.jsonl", batch_size=100, *, progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None):
    """
    极致健壮的批量导入。遇到异常自动记录错误，所有句子全部保留。
    支持断点续导/多次reimport error_log。
    """
    failed = 0
    total = 0
    success = 0
    started_at = time.time()
    with open(jsonl_path, 'r', encoding='utf-8') as f, \
         open(error_log_path, 'a', encoding='utf-8') as errf:
        for line in f:
            total += 1
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                obj = fill_assertion_index(obj)
                abstract = Abstract.model_validate(obj)
                pmid = abstract.pmid
                doc = abstracts_col.find_one({"pmid": pmid})
                doc_new = abstract.model_dump()
                if not doc:
                    abstracts_col.insert_one(doc_new)
                else:
                    updated = merge_abstract(doc, doc_new)
                    if updated:
                        abstracts_col.replace_one({"pmid": pmid}, doc)
                success += 1
            except Exception as e:
                failed += 1
                errf.write(json.dumps({
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "raw": line
                }, ensure_ascii=False) + "\n")
                errf.flush()
                try:
                    log_review_action({
                        "action": "admin_import_failed",
                        "error": str(e),
                        "created_at": __import__('time').time(),
                    })
                except Exception:
                    pass
            if (total % batch_size) == 0:
                print(f"Processed {total} items, with {success} successful and {failed} failed.")
                if progress_callback:
                    progress_callback({
                        "total": total,
                        "success": success,
                        "failed": failed,
                        "stage": "initial",
                        "started_at": started_at,
                        "updated_at": time.time(),
                    })
    print(f"\nImport complete: Total {total} items, successful {success} items, failed {failed} items. Failed samples logged to {error_log_path}.")
    if progress_callback:
        progress_callback({
            "total": total,
            "success": success,
            "failed": failed,
            "stage": "initial_done",
            "started_at": started_at,
            "updated_at": time.time(),
        })

def reimport_failed(error_log_path="data/failed_imports.jsonl"):
    """循环自动重导所有 failed_imports.jsonl，直到没有新pmid导入为止。"""
    import os
    import tempfile
    round = 0
    while True:
        round += 1
        print(f"\n==== Reimport failed_imports.jsonl (round {round}) ====")
        if not os.path.exists(error_log_path):
            print("No `failed_imports.jsonl` file found; no re-import needed.")
            break
        with open(error_log_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        if not lines:
            print("failed_imports.jsonl is empty; the import process is complete.")
            break
        # 备份旧的error_log，重新跑
        bak_path = error_log_path + ".bak"
        os.rename(error_log_path, bak_path)
        tmp_error_path = tempfile.mktemp(suffix=".jsonl")
        load_jsonl_to_db(bak_path, error_log_path=tmp_error_path)
        # 统计还剩多少
        if not os.path.exists(tmp_error_path) or os.path.getsize(tmp_error_path) == 0:
            print("All failed records have been successfully reloaded!")
            os.remove(bak_path)
            if os.path.exists(tmp_error_path):
                os.remove(tmp_error_path)
            break
        else:
            print(f"There are still records that have not been successfully imported, continue to the next round...")
            os.rename(tmp_error_path, error_log_path)
            os.remove(bak_path)

# ----------------- Background job management for real-time progress -----------------

_JOBS_LOCK = threading.RLock()
_IMPORT_JOBS: Dict[str, Dict[str, Any]] = {}


def _update_job(job_id: str, **fields):
    with _JOBS_LOCK:
        job = _IMPORT_JOBS.setdefault(job_id, {})
        job.update(fields)


def start_import_job(jsonl_path: str, error_log_path: str) -> str:
    job_id = str(uuid.uuid4())
    _update_job(job_id, status="starting", started_at=time.time(), attempts=0, total=0, success=0, failed=0)

    def progress_cb(stats: Dict[str, Any]):
        _update_job(job_id, **stats)

    def run():
        try:
            _update_job(job_id, status="running", attempts=1)
            load_jsonl_to_db(jsonl_path, error_log_path=error_log_path, progress_callback=progress_cb)
            # Up to 2 more attempts (total 3)
            for attempt in range(2):
                _update_job(job_id, status="retrying", attempts=2 + attempt)
                reimport_failed(error_log_path)
                # If error log is empty or gone, stop
                import os
                if not os.path.exists(error_log_path) or os.path.getsize(error_log_path) == 0:
                    break
            _update_job(job_id, status="completed", finished_at=time.time())
            try:
                log_review_action({
                    "action": "admin_import_completed",
                    "job_id": job_id,
                    "source_path": jsonl_path,
                    "error_log": error_log_path,
                    "created_at": time.time(),
                })
            except Exception:
                pass
        except Exception as e:
            _update_job(job_id, status="failed", error=str(e), finished_at=time.time())
            try:
                log_review_action({
                    "action": "admin_import_job_failed",
                    "job_id": job_id,
                    "error": str(e),
                    "created_at": time.time(),
                })
            except Exception:
                pass

    t = threading.Thread(target=run, daemon=True, name=f"ImportJob-{job_id}")
    t.start()
    return job_id


def get_import_progress(job_id: str) -> Dict[str, Any]:
    with _JOBS_LOCK:
        return dict(_IMPORT_JOBS.get(job_id, {}))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Bulk import PubMed abstracts into MongoDB (resumable)")
    parser.add_argument("input", help="Path to your input JSONL file")
    parser.add_argument("--error_log", default="data/failed_imports.jsonl", help="Where to log failed imports")
    parser.add_argument("--retry_failed", action="store_true", help="Auto retry all failed_imports until empty")
    args = parser.parse_args()
    load_jsonl_to_db(args.input, args.error_log)
    if args.retry_failed:
        reimport_failed(args.error_log)

# python -m backend.services.import_service data/sentence_level_gpt4.1.jsonl
# python -m backend.services.import_service data/failed_imports.jsonl
# python -m backend.services.import_service data/sentence_level_gpt4.1.jsonl --retry_failed
