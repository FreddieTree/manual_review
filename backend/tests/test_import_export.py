# backend/tests/test_import_export.py
from backend.models.db import abstracts_col
from backend.services.import_service import load_jsonl_to_db
from backend.services.export_service import export_passed_assertions
import os

def test_import_and_export(tmp_path):
    test_file = "data/sentence_level_gpt4.1.jsonl"
    load_jsonl_to_db(test_file)
    # Verify write to database
    assert abstracts_col.count_documents({}) > 0
    # export
    export_file = tmp_path / "exported.jsonl"
    export_passed_assertions(str(export_file))
    # Verify that the exported file is not empty.
    assert export_file.exists()
    assert export_file.stat().st_size > 0

if __name__ == "__main__":
    import pytest
    pytest.main([__file__])