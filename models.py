# models.py

import json
from config import ABSTRACTS_PATH

def load_abstracts():
    """Load all abstracts as a list of dicts."""
    abstracts = []
    with open(ABSTRACTS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            abstracts.append(json.loads(line))
    return abstracts

def get_abstract_by_id(abs_id):
    """Find an abstract by its id (pmid)."""
    for abstract in load_abstracts():
        if str(abstract.get("pmid")) == str(abs_id):
            return abstract
    return None