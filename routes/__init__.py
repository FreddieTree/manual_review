# -*- coding: utf-8 -*-
"""
Compatibility shims so imports like `routes.reviewer` keep working.
They simply re-export blueprints from the new backend.routes.* modules.
"""

from backend.routes.auth import auth_api as auth_api  # noqa: F401
from backend.routes.tasks import task_api as task_api  # noqa: F401
from backend.routes.reviewers import reviewer_api as reviewer_api  # noqa: F401
from backend.routes.meta import meta_api as meta_api  # noqa: F401
from backend.routes.pricing import pricing_api as pricing_api  # noqa: F401
from backend.routes.arbitration import arbitration_api as arbitration_api  # noqa: F401
from backend.routes.export import export_api as export_api  # noqa: F401

__all__ = [
    "auth_api",
    "task_api",
    "reviewer_api",
    "meta_api",
    "pricing_api",
    "arbitration_api",
    "export_api",
]