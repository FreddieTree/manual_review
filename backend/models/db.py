# backend/models/db.py
import os
from pymongo import MongoClient

MONGO_URI = os.getenv(
    "MONGO_URI", "mongodb+srv://fredyu428:8cFD038spAQEDUUM@cluster0.ubmtrne.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
DB_NAME = "assertion_review"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

abstracts_col = db['abstracts']
reviewers_col = db['reviewers']
logs_col = db['logs']

def test_connection():
    abstracts_col.insert_one({"test": "connection"})
    found = list(abstracts_col.find({"test": "connection"}))
    print("Test found:", found)
    abstracts_col.delete_many({"test": "connection"})

if __name__ == "__main__":
    test_connection()