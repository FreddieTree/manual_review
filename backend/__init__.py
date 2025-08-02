# -*- coding: utf-8 -*-
"""
Backend package init.

Exports:
- create_app: Flask app factory
"""
from .app import create_app  # noqa: F401

__all__ = ["create_app"]