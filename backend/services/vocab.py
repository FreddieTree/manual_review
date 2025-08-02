# backend/services/vocab.py
from __future__ import annotations
from typing import Dict, List, Any, Tuple

"""
Single source of truth for vocabularies (predicates & entity types).

- Canonical predicates are stored in UMLS-style UPPERCASE.
- Canonical entity types are stored in lowercase.
- Validation helpers are case-insensitive.
- get_whitelists() exposes lists for legacy/config callers:
    * predicates LOWERCASED (to match older code paths)
    * entity types lowercase (canonical)
"""

# ---- Canonical lists -------------------------------------------------------

_PREDICATES: List[str] = [
    "PREDISPOSES","COEXISTS_WITH","TREATS","AFFECTS","ISA","PROCESS_OF","USES",
    "ASSOCIATED_WITH","CAUSES","DIAGNOSES","MANIFESTATION_OF","LOCATION_OF","PRECEDES",
    "PART_OF","PREVENTS","DISRUPTS","COMPLICATES","ADMINISTERED_TO","PRODUCES",
    "INTERACTS_WITH","OCCURS_IN","COMPARED_WITH","AUGMENTS","STIMULATES","SAME_AS",
    "METHOD_OF","MEASUREMENT_OF","INHIBITS","CONVERTS_TO"
]

_ENTITY_TYPES: List[str] = [
    "acab","anab","cgab","dsyn","emod","fndg","inpo","mobd","neop","orga","patf","phsu","sosy"
]

_PREDICATE_SET = set(_PREDICATES)          # UPPERCASE
_ENTITY_TYPE_SET = set(_ENTITY_TYPES)      # lowercase

# ---- Descriptions (optional) ----------------------------------------------

_PREDICATE_DESCRIPTIONS: Dict[str, str] = {
    "PREDISPOSES": "X increases the likelihood of Y.",
    "COEXISTS_WITH": "X and Y are observed together.",
    "TREATS": "X is used to treat Y.",
    "AFFECTS": "X has an effect on Y.",
    "ISA": "Taxonomic 'is a' relation.",
    "PROCESS_OF": "X is a process of Y.",
    "USES": "X uses Y.",
    "ASSOCIATED_WITH": "Non-causal association.",
    "CAUSES": "X causes Y.",
    "DIAGNOSES": "X diagnoses Y.",
    "MANIFESTATION_OF": "X is a manifestation of Y.",
    "LOCATION_OF": "X is the location of Y.",
    "PRECEDES": "X precedes Y.",
    "PART_OF": "X is part of Y.",
    "PREVENTS": "X prevents Y.",
    "DISRUPTS": "X disrupts Y.",
    "COMPLICATES": "X complicates Y.",
    "ADMINISTERED_TO": "X is administered to Y.",
    "PRODUCES": "X produces Y.",
    "INTERACTS_WITH": "X interacts with Y.",
    "OCCURS_IN": "X occurs in Y.",
    "COMPARED_WITH": "X is compared with Y.",
    "AUGMENTS": "X augments Y.",
    "STIMULATES": "X stimulates Y.",
    "SAME_AS": "Equivalence relation.",
    "METHOD_OF": "X is a method of Y.",
    "MEASUREMENT_OF": "X is a measurement of Y.",
    "INHIBITS": "X inhibits Y.",
    "CONVERTS_TO": "X converts to Y.",
}

_ENTITY_TYPE_DESCRIPTIONS: Dict[str, str] = {
    "acab": "Acquired abnormality.",
    "anab": "Anatomical abnormality.",
    "cgab": "Congenital abnormality.",
    "dsyn": "Disease or syndrome.",
    "emod": "Experimental model of disease.",
    "fndg": "Clinical/lab finding.",
    "inpo": "Injury or poisoning.",
    "mobd": "Mental/behavioral dysfunction.",
    "neop": "Neoplastic process.",
    "orga": "Organism attribute.",
    "patf": "Pathologic function.",
    "phsu": "Pharmacologic substance.",
    "sosy": "Sign or symptom.",
}

# ---- Normalization & validation -------------------------------------------

def normalize_predicate(p: str) -> str:
    return (p or "").strip().upper()

def normalize_entity_type(t: str) -> str:
    return (t or "").strip().lower()

def is_valid_predicate(p: str) -> bool:
    return normalize_predicate(p) in _PREDICATE_SET

def is_valid_entity_type(t: str) -> bool:
    return normalize_entity_type(t) in _ENTITY_TYPE_SET

def predicates() -> List[str]:
    """Canonical list (UPPERCASE)."""
    return list(_PREDICATES)

def entity_types() -> List[str]:
    """Canonical list (lowercase)."""
    return list(_ENTITY_TYPES)

# ---- Back-compat exports for config/audit ---------------------------------

def get_whitelists(*, predicates_lowercase: bool = True) -> Tuple[List[str], List[str]]:
    """
    Returns (predicate_list, entity_type_list).
    - By default, predicates are LOWERCASED for legacy callers that expect lowercase.
    - Entity types are lowercase (canonical).
    """
    preds = [p.lower() for p in _PREDICATES] if predicates_lowercase else list(_PREDICATES)
    ents = list(_ENTITY_TYPES)
    return preds, ents

# ---- API payloads ---------------------------------------------------------

def export_for_api() -> Dict[str, List[Dict[str, Any]]]:
    """
    For /api/meta/vocab: return id/label/description lists suitable for UI dropdowns.
    """
    return {
        "predicates": [
            {"id": pid, "label": pid, "description": _PREDICATE_DESCRIPTIONS.get(pid, "")}
            for pid in _PREDICATES
        ],
        "entity_types": [
            {"id": tid, "label": tid, "description": _ENTITY_TYPE_DESCRIPTIONS.get(tid, "")}
            for tid in _ENTITY_TYPES
        ],
    }

# Backward-compat alias used by routes.meta
def get_vocab_with_descriptions() -> Dict[str, List[Dict[str, Any]]]:
    return export_for_api()