from pydantic import BaseModel, Field
from typing import List, Optional

class Assertion(BaseModel):
    assertion_index: int
    subject: str
    subject_type: str
    predicate: str
    object: str
    object_type: str
    negation: bool
    created_by: Optional[str] = None
    reviews: Optional[list] = []
    final_status: Optional[str] = None
    final_decision: Optional[str] = None

class Sentence(BaseModel):
    sentence_index: int
    sentence: str
    assertions: List[Assertion]

class Abstract(BaseModel):
    pmid: str
    title: str
    journal: str
    year: Optional[str]
    doi: Optional[str]
    sentences: List[Sentence]
    sentence_count: int
    meta: Optional[dict] = {}