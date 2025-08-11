# -*- coding: utf-8 -*-
"""
Backend package init.

Avoid importing submodules at import time to prevent runpy warning when executing
`python -m backend.app`. We expose a lazy wrapper for `create_app` instead.
"""

from typing import Any

def create_app(*args: Any, **kwargs: Any):  # type: ignore[override]
    # Lazy import to avoid `backend.app` being imported during package import
    from .app import create_app as _create_app
    return _create_app(*args, **kwargs)

__all__ = ["create_app"]