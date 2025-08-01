# routes/__init__.py
from .reviewer import reviewer_api
from .admin import admin_api
from .task import task_api
from .arbitration import arbitration_api
from .export import export_api
from .auth import auth_api
from .reviewer_manager import reviewer_manage_api

__all__ = [
    "reviewer_api", "admin_api", "task_api",
    "arbitration_api", "export_api", "auth_api", "reviewer_manage_api"
]