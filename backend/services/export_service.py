# backend/services/export_service.py
import json
from backend.models.db import abstracts_col

def export_passed_assertions(export_path):
    with open(export_path, 'w', encoding='utf-8') as f:
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

if __name__ == "__main__":
    export_passed_assertions("data/exported_passed.jsonl")
    print("Export finished.")