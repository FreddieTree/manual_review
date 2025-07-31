import uuid
import copy
import time

def make_assertion_id(subject, subject_type, predicate, object_, object_type):
    return f"{subject}|{subject_type}|{predicate}|{object_}|{object_type}"

def new_assertion(subject, subject_type, predicate, object_, object_type, negation, creator, pmid, sentence_idx, sentence_text, comment=""):
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
        "related_to": None,
        "comment": comment,
    }

def update_assertion(original, updated_fields, updater, pmid, sentence_idx, sentence_text, comment=""):
    fields = ["subject", "subject_type", "predicate", "object", "object_type", "negation"]
    changed = [f for f in fields if original[f] != updated_fields.get(f, original[f])]
    action_type = "modify" if len(changed) == 1 else "add"
    updated = copy.deepcopy(original)
    for k in fields:
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
    updated["comment"] = comment
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
    # 处理所有原有断言的review
    for sent_idx, sent in enumerate(sentence_results):
        for ass_idx, assertion in enumerate(sent.get("assertions", [])):
            review_key = f"review_{sent_idx}_{ass_idx}"
            comment_key = f"comment_{sent_idx}_{ass_idx}"
            subject_key = f"subject_{sent_idx}_{ass_idx}"
            predicate_key = f"predicate_{sent_idx}_{ass_idx}"
            object_key = f"object_{sent_idx}_{ass_idx}"
            negation_key = f"negation_{sent_idx}_{ass_idx}"
            subject_type_key = f"subject_type_{sent_idx}_{ass_idx}"
            object_type_key = f"object_type_{sent_idx}_{ass_idx}"
            user_op = post_data.get(review_key)
            comment = post_data.get(comment_key, "")
            changed = (
                assertion["subject"] != post_data.get(subject_key, assertion["subject"]) or
                assertion["predicate"] != post_data.get(predicate_key, assertion["predicate"]) or
                assertion["object"] != post_data.get(object_key, assertion["object"]) or
                str(assertion["negation"]).lower() != str(post_data.get(negation_key, assertion["negation"])).lower()
            )
            updated_fields = {
                "subject": post_data.get(subject_key, assertion["subject"]),
                "subject_type": post_data.get(subject_type_key, assertion["subject_type"]),
                "predicate": post_data.get(predicate_key, assertion["predicate"]),
                "object": post_data.get(object_key, assertion["object"]),
                "object_type": post_data.get(object_type_key, assertion["object_type"]),
                "negation": post_data.get(negation_key, str(assertion["negation"])).lower() == "true",
            }
            if user_op == "accept" and not changed:
                continue  # 纯接受
            elif user_op == "modify" or (user_op == "accept" and changed):
                logs.append(update_assertion(
                    original=assertion,
                    updated_fields=updated_fields,
                    updater=reviewer_info["email"],
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sent.get("sentence", ""),
                    comment=comment,
                ))
            elif user_op == "uncertain":
                logs.append(uncertain_assertion(
                    original=assertion,
                    reviewer=reviewer_info["email"],
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sent.get("sentence", ""),
                    comment=comment,
                ))
            elif user_op == "reject":
                logs.append(reject_assertion(
                    original=assertion,
                    reviewer=reviewer_info["email"],
                    pmid=abs_id,
                    sentence_idx=sent_idx,
                    sentence_text=sent.get("sentence", ""),
                    reason=comment,
                ))
    # 检查新增断言 useradd_ 开头字段
    for sent_idx, sent in enumerate(sentence_results):
        subj = post_data.get(f"useradd_subject_{sent_idx}", "").strip()
        pred = post_data.get(f"useradd_predicate_{sent_idx}", "").strip()
        obj = post_data.get(f"useradd_object_{sent_idx}", "").strip()
        subj_type = ""  # 可扩展类型选项
        obj_type = ""
        neg = post_data.get(f"useradd_negation_{sent_idx}", "false").lower() == "true"
        comment = post_data.get(f"useradd_comment_{sent_idx}", "")
        if subj and pred and obj:
            logs.append(new_assertion(
                subject=subj,
                subject_type=subj_type,
                predicate=pred,
                object_=obj,
                object_type=obj_type,
                negation=neg,
                creator=reviewer_info["email"],
                pmid=abs_id,
                sentence_idx=sent_idx,
                sentence_text=sent.get("sentence", ""),
                comment=comment,
            ))
    return logs