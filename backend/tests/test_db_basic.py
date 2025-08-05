# backend/tests/test_db_basic.py
from pymongo import MongoClient
import os
import logging


logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

MONGO_URI = os.getenv(
    "MONGO_URI", "mongodb+srv://fredyu428:8cFD038spAQEDUUM@cluster0.ubmtrne.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
DB_NAME = "assertion_review"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
abstracts_col = db['abstracts']

def test_db_count():
    total = abstracts_col.count_documents({})
    print(f"Total abstracts: {total}")

def test_sample_abstract():
    doc = abstracts_col.find_one({})
    if doc:
        print(f"Sample pmid: {doc.get('pmid')}")
        print(f"Title: {doc.get('title')}")
        print(f"First sentence: {doc['sentences'][0]['sentence'] if doc.get('sentences') else ''}")
    else:
        print("No abstracts found.")

def test_find_by_pmid(pmid):
    doc = abstracts_col.find_one({"pmid": pmid})
    if doc:
        print(f"Found: {doc['title']}")
        print(f"Sentences: {len(doc.get('sentences', []))}")
        for s in doc['sentences']:
            print(f"  - {s['sentence']}")
    else:
        print(f"Not found: pmid={pmid}")

if __name__ == "__main__":
    test_db_count()
    test_sample_abstract()
    test_find_by_pmid("10607332")