"""
User Profile Module
===================

Provides user profile building from RAG memory chunks.
"""

from app.user_profile.profile_builder import build_user_profile, derive_mistakes_from_memory

__all__ = ["build_user_profile", "derive_mistakes_from_memory"]
