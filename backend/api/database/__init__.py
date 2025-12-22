# backend/api/database/__init__.py
"""
Database connection management module
"""

from .multi_connection_manager import (
    MultiConnectionManager,
    connection_manager,
    get_db
)

__all__ = [
    'MultiConnectionManager',
    'connection_manager',
    'get_db',
]