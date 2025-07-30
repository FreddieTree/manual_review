import uuid
import copy
import time

def make_assertion_id(subject, subject_type, predicate, object_, object_type):
    return f"{subject}|{subject_type}|{predicate}|{object_}|{object_type}"

def new_assertion(subject, subject_type, predicate, object_, object_type, negation, creator, pmid, sentence_idx, sentence_text):
    return {
        "assertion_id": str(uuid.uuid4()),
        "subject": subject,
        "subject_type": subject_type,
        "predicate": predicate,
        "object": object_,
        "object_type": object_type,
        "negation": negation,
        "creator": creator,
        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,
        "created_at": time.time(),
        "action": "add",
        "related_to": None
    }

def update_assertion(original, updated_fields, updater, pmid, sentence_idx, sentence_text):
    fields = ["subject", "subject_type", "predicate", "object", "object_type"]
    changed = [f for f in fields if original[f] != updated_fields.get(f, original[f])]
    action_type = "modify" if len(changed) == 1 else "add"
    updated = copy.deepcopy(original)
    for k in fields + ["negation"]:
        if k in updated_fields:
            updated[k] = updated_fields[k]
    updated["assertion_id"] = str(uuid.uuid4())
    updated["creator"] = updater
    updated["pmid"] = pmid
    updated["sentence_idx"] = sentence_idx
    updated["sentence_text"] = sentence_text
    updated["created_at"] = time.time()
    updated["action"] = action_type
    updated["related_to"] = original["assertion_id"]
    return updated

def reject_assertion(original, reviewer, pmid, sentence_idx, sentence_text, reason=""):
    return {
        "assertion_id": str(uuid.uuid4()),
        "action": "reject",
        "related_to": original["assertion_id"],
        "reviewer": reviewer,
        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,
        "created_at": time.time(),
        "reason": reason
    }

def uncertain_assertion(original, reviewer, pmid, sentence_idx, sentence_text, comment=""):
    return {
        "assertion_id": str(uuid.uuid4()),
        "action": "uncertain",
        "related_to": original["assertion_id"],
        "reviewer": reviewer,
        "pmid": pmid,
        "sentence_idx": sentence_idx,
        "sentence_text": sentence_text,
        "created_at": time.time(),
        "comment": comment
    }

def audit_review_submission(abs_id, sentence_results, post_data, reviewer_info):
    logs = []
    for sent_idx, sent in enumerate(sentence_results):
        for ass_idx, assertion in enumerate(sent.get("assertions", [])):
            review_key = f"review_{sent_idx}_{ass_idx}"
            comment_key = f"comment_{sent_idx}_{ass_idx}"
            user_op = post_data.get(review_key)
            comment = post_data.get(comment_key, "")
            if user_op == "accept":
                continue
            elif user_op == "uncertain":
                logs.append(uncertain_assertion(
                    original=assertion,
                    reviewer=reviewer_info["email"],
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sent.get("sentence", ""),
                    comment=comment
                ))
            elif user_op == "reject":
                logs.append(reject_assertion(
                    original=assertion,
                    reviewer=reviewer_info["email"],
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sent.get("sentence", ""),
                    reason=comment
                ))
    # TODO: 处理前端新增断言（post_data中以useradd_开头的键值对）
    # 建议在form里传递subject/subject_type/predicate/object/object_type/negation等
    return logs