#!/usr/bin/env bash
set -euo pipefail

# ========== helpers ==========
use_git_mv=0
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  use_git_mv=1
fi

mv_cmd() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ "$use_git_mv" -eq 1 ]; then
    git mv -k "$src" "$dst" 2>/dev/null || mv "$src" "$dst"
  else
    mv "$src" "$dst"
  fi
  echo "moved: $src -> $dst"
}

rename_cmd() {
  local src="$1" dst="$2"
  if [ -e "$src" ]; then
    if [ "$use_git_mv" -eq 1 ]; then
      git mv -k "$src" "$dst" 2>/dev/null || mv "$src" "$dst"
    else
      mv "$src" "$dst"
    fi
    echo "renamed: $src -> $dst"
  fi
}

touch_if_absent() {
  local path="$1"
  if [ ! -e "$path" ]; then
    mkdir -p "$(dirname "$path")"
    : > "$path"
    echo "created: $path"
  fi
}

write_file() {
  # usage: write_file path <<'EOF' ... EOF
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  echo "wrote: $path"
}

# ========== 1) create target directories ==========
mkdir -p \
  backend/{utils,models,services,domain,routes,schemas,templates} \
  data/{exports,} \
  .vscode \
  tests/{backend,frontend} \
  frontend/src/api \
  scripts

# ========== 2) move/rename backend top-level files if exist ==========
[ -f app.py ] && mv_cmd app.py backend/app.py || true
[ -f wsgi.py ] || write_file backend/wsgi.py <<'PY'
from backend.app import create_app  # adjust if you rename
app = create_app()
PY

[ -f config.py ] && mv_cmd config.py backend/config.py || true

# utils.py 先整体迁至 utils/__init__.py，后续你再拆分 email/strings/booleans
if [ -f utils.py ]; then
  mv_cmd utils.py backend/utils/__init__.py
fi

# models.py 先整体迁到备份，后续你再拆分 abstracts/reviewers/logs
if [ -f models.py ]; then
  mv_cmd models.py backend/models/models_OLD.py
fi

# 将这些服务层脚本移动到 services/domain
[ -f aggregate.py ] && mv_cmd aggregate.py backend/services/aggregation.py || true
[ -f task_manager.py ] && mv_cmd task_manager.py backend/services/assignment.py || true
[ -f reviewer_utils.py ] && mv_cmd reviewer_utils.py backend/services/audit.py || true
[ -f assertion_utils.py ] && mv_cmd assertion_utils.py backend/domain/assertions.py || true
[ -f arbitration.py ] && mv_cmd arbitration.py backend/services/arbitration.py || true

# ========== 3) move routes/* 到 backend/routes ==========
if [ -d routes ]; then
  [ -f routes/task.py ]        && mv_cmd routes/task.py        backend/routes/tasks.py        || true
  [ -f routes/reviewer.py ]    && mv_cmd routes/reviewer.py    backend/routes/reviewers.py    || true
  [ -f routes/arbitration.py ] && mv_cmd routes/arbitration.py backend/routes/arbitration.py  || true
  [ -f routes/export.py ]      && mv_cmd routes/export.py      backend/routes/export.py       || true
  [ -f routes/auth.py ]        && mv_cmd routes/auth.py        backend/routes/auth.py         || true
fi

# 有顶层重复的 reviewer.py（与 routes 下冲突），先改名备份
[ -f reviewer.py ] && rename_cmd reviewer.py reviewer_OLD.py

# ========== 4) skeleton files (placeholders) ==========
# backend/models/* 拆分骨架
write_file backend/models/abstracts.py <<'PY'
from typing import Any, Dict, List, Optional, Union
import os, json, threading
from functools import lru_cache

_ABSTRACTS_PATH = os.environ.get("ABSTRACTS_PATH", "data/sentence_level_gpt4.1.jsonl")
_cache = {"data": None, "mtime": 0.0}
_lock = threading.RLock()

def _load_jsonl(path: str) -> List[Dict[str, Any]]:
    items = []
    if not os.path.exists(path): return items
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    if "sentence_results" not in obj or not isinstance(obj["sentence_results"], list):
                        obj["sentence_results"] = []
                    for s in obj["sentence_results"]:
                        if "assertions" not in s or not isinstance(s["assertions"], list):
                            s["assertions"] = []
                    items.append(obj)
            except Exception:
                continue
    return items

def load_abstracts(force_reload: bool=False) -> List[Dict[str, Any]]:
    mtime = os.path.getmtime(_ABSTRACTS_PATH) if os.path.exists(_ABSTRACTS_PATH) else 0.0
    with _lock:
        if force_reload or _cache["data"] is None or _cache["mtime"] != mtime:
            _cache["data"] = _load_jsonl(_ABSTRACTS_PATH)
            _cache["mtime"] = mtime
        return _cache["data"] or []

def get_abstract_by_id(abs_id: Union[str,int]) -> Optional[Dict[str,Any]]:
    target = str(abs_id)
    for a in load_abstracts():
        if str(a.get("pmid")) == target:
            return a
    return None

def get_all_pmids() -> List[str]:
    return [str(a.get("pmid")) for a in load_abstracts()]
PY

write_file backend/models/reviewers.py <<'PY'
import json, os, tempfile, threading
from typing import Any, Dict, List, Optional

_REVIEWERS_JSON = os.environ.get("REVIEWERS_JSON", "data/reviewers.json")
_lock = threading.RLock()

def _ensure_file():
    os.makedirs(os.path.dirname(_REVIEWERS_JSON) or ".", exist_ok=True)
    if not os.path.exists(_REVIEWERS_JSON):
        with open(_REVIEWERS_JSON, "w", encoding="utf-8") as f:
            json.dump([], f)

def load_reviewers() -> List[Dict[str, Any]]:
    _ensure_file()
    with open(_REVIEWERS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data if isinstance(data, list) else []

def save_reviewers(reviewers: List[Dict[str, Any]]) -> None:
    _ensure_file()
    fd, tmp = tempfile.mkstemp(suffix=".tmp", dir=os.path.dirname(_REVIEWERS_JSON) or ".")
    os.close(fd)
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(reviewers, f, ensure_ascii=False, indent=2)
        os.replace(tmp, _REVIEWERS_JSON)
    finally:
        try: os.remove(tmp)
        except Exception: pass
PY

write_file backend/models/logs.py <<'PY'
import os, json
from typing import Any, Dict, List

_REVIEW_LOGS = os.environ.get("REVIEW_LOGS_PATH", "data/review_logs.jsonl")

def _ensure_dir():
    d = os.path.dirname(_REVIEW_LOGS)
    if d: os.makedirs(d, exist_ok=True)

def log_review_action(record: Dict[str, Any]) -> None:
    _ensure_dir()
    with open(_REVIEW_LOGS, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

def load_logs() -> List[Dict[str, Any]]:
    if not os.path.exists(_REVIEW_LOGS): return []
    out = []
    with open(_REVIEW_LOGS, "r", encoding="utf-8") as f:
        for line in f:
            line=line.strip()
            if not line: continue
            try: out.append(json.loads(line))
            except Exception: continue
    return out
PY

# backend/routes placeholders
write_file backend/routes/__init__.py <<'PY'
# Register blueprints in your app factory, e.g.:
#   from .tasks import bp as tasks_bp
#   app.register_blueprint(tasks_bp)
PY

write_file backend/routes/meta.py <<'PY'
from flask import Blueprint, jsonify
bp = Blueprint("meta_api", __name__, url_prefix="/api/meta")

@bp.get("/health")
def health():
    return jsonify({"success": True, "data": {"status": "ok"}}), 200

@bp.get("/vocab")
def vocab():
    # TODO: return predicate/entity-type vocab with descriptions
    return jsonify({"success": True, "data": {"predicates": [], "entity_types": []}}), 200
PY

write_file backend/routes/pricing.py <<'PY'
from flask import Blueprint, request, jsonify
bp = Blueprint("pricing_api", __name__, url_prefix="/api")

@bp.get("/review/pricing")
def pricing():
    # TODO: implement by calling services.pricing
    return jsonify({"success": True, "data": {"per_abstract": 0.3, "per_assertion_add": 0.05}}), 200
PY

write_file backend/services/vocab.py <<'PY'
# TODO: centralize predicate/entity-type whitelists and descriptions here.
PREDICATE_WHITELIST = []
ENTITY_TYPE_WHITELIST = []
PY

# backend/domain/assertions.py 若已移动则跳过（上面已 mv）
if [ ! -f backend/domain/assertions.py ]; then
  write_file backend/domain/assertions.py <<'PY'
# TODO: move your make_assertion_id / new_assertion / update_assertion / reject / uncertain here.
PY
fi

# ========== 5) frontend API re-layout ==========
# 如果旧的前端 api.js 在 frontend/src/ 下，迁至 client.js
if [ -f frontend/src/api.js ]; then
  mv_cmd frontend/src/api.js frontend/src/api/client.js
fi

# 创建模块化 API wrapper（空壳，先引用 client）
write_file frontend/src/api/tasks.js <<'JS'
import client from "./client";
export const getAssignedAbstract = () => client.get("/assigned_abstract");
export const submitReview = (data) => client.post("/submit_review", data);
export const releaseAssignment = (pmid) => client.post("/release_assignment", { pmid });
JS

write_file frontend/src/api/reviewers.js <<'JS'
import client from "./client";
export const getReviewers = () => client.get("/reviewers");
export const addReviewer = (data) => client.post("/reviewers", data);
export const updateReviewer = (email, data) => client.put(`/reviewers/${encodeURIComponent(email)}`, data);
export const deleteReviewer = (email) => client.delete(`/reviewers/${encodeURIComponent(email)}`);
JS

write_file frontend/src/api/pricing.js <<'JS'
import client from "./client";
export const getPricing = (abstractId) => client.get(`/review/pricing`, { params: { abstract: abstractId }});
JS

write_file frontend/src/api/auth.js <<'JS'
import client from "./client";
export const loginReviewer = (data) => client.post("/login", data);
export const logout = () => client.post("/logout");
export const whoami = () => client.get("/whoami");
JS

write_file frontend/src/api/meta.js <<'JS'
import client from "./client";
export const getVocab = () => client.get("/meta/vocab");
export const getHealth = () => client.get("/meta/health");
JS

# ========== 6) misc moves / cleanups ==========
# 拼写错误的 scipts → scripts
if [ -d frontend/scipts ]; then
  mv_cmd frontend/scipts scripts/frontend
fi

# tests 占位
touch_if_absent tests/backend/.gitkeep
touch_if_absent tests/frontend/.gitkeep

# vscode 占位
write_file .vscode/settings.json <<'JSON'
{
  "files.exclude": {
    "**/__pycache__": true,
    "**/.ipynb_checkpoints": true
  }
}
JSON

echo ""
echo "===== DONE ====="
echo "Next steps:"
echo "1) 按照 backend/models/* 与 services/* 的占位 TODO 拆分逻辑；"
echo "2) 在 backend/app.py 的 create_app() 中注册 backend/routes 下的蓝图；"
echo "3) 前端替换原有 import 到新的模块化 API；"
echo "4) 运行：tree -I 'node_modules|.git|__pycache__' -a -L 5 | less"