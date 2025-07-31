# export.py

import json
from config import REVIEW_LOGS_PATH
from models import get_all_pmids
from aggregate import aggregate_final_decisions_for_pmid

def export_final_consensus(output_path="data/final_consensus.jsonl"):
    """
    批量导出所有abstract下，最终“共识/仲裁通过”的断言
    """
    pmids = get_all_pmids()
    final_records = []
    for pid in pmids:
        final_records.extend(aggregate_final_decisions_for_pmid(pid))
    # 导出为jsonl
    with open(output_path, "w", encoding="utf-8") as fout:
        for rec in final_records:
            fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return len(final_records)