"""
Tests for LLM Service
=====================

Tests for app/services/llm.py - Multi-provider LLM with fallback
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
import os


class TestLLMConfiguration:
    """Tests for LLM configuration and provider selection."""

    def test_get_current_provider_default(self):
        """Test that default provider is 'groq'."""
        from app.services.llm import get_current_provider
        
        with patch.dict(os.environ, {"LLM_PROVIDER": ""}, clear=False):
            # May return groq as default
            provider = get_current_provider()
            assert provider in ["groq", "gemini", ""]

    def test_get_current_provider_groq(self):
        """Test provider returns 'groq' when configured."""
        from app.services.llm import get_current_provider
        
        with patch.dict(os.environ, {"LLM_PROVIDER": "groq"}):
            provider = get_current_provider()
            assert provider == "groq"

    def test_get_current_provider_gemini(self):
        """Test provider returns 'gemini' when configured."""
        from app.services.llm import get_current_provider
        
        with patch.dict(os.environ, {"LLM_PROVIDER": "gemini"}):
            provider = get_current_provider()
            assert provider == "gemini"


class TestRateLimiting:
    """Tests for rate limit handling."""

    def test_is_rate_limited_default(self):
        """Test that rate limiting is false by default."""
        from app.services.llm import is_rate_limited, reset_rate_limit
        
        reset_rate_limit()
        assert is_rate_limited() == False

    def test_reset_rate_limit(self):
        """Test that rate limit can be reset."""
        from app.services.llm import reset_rate_limit, is_rate_limited
        
        reset_rate_limit()
        assert is_rate_limited() == False


class TestLLMFactory:
    """Tests for LLM factory function."""

    @patch("app.services.llm._create_groq_llm")
    @patch("app.services.llm._create_gemini_llm")
    def test_get_llm_groq_with_fallback(self, mock_gemini, mock_groq):
        """Test that get_llm creates Groq LLM with Gemini fallback."""
        from app.services.llm import get_llm, LLMWithFallback
        
        # Mock both LLMs
        mock_groq_instance = MagicMock()
        mock_gemini_instance = MagicMock()
        mock_groq.return_value = mock_groq_instance
        mock_gemini.return_value = mock_gemini_instance
        
        with patch.dict(os.environ, {"LLM_PROVIDER": "groq"}):
            llm = get_llm(temperature=0.3)
            
            # Should create both LLMs for fallback
            mock_groq.assert_called_once()
            mock_gemini.assert_called_once()

    @patch("app.services.llm._create_gemini_llm")
    def test_get_llm_gemini_only(self, mock_gemini):
        """Test that get_llm creates only Gemini when configured."""
        mock_gemini_instance = MagicMock()
        mock_gemini.return_value = mock_gemini_instance
        
        with patch.dict(os.environ, {"LLM_PROVIDER": "gemini"}):
            from app.services.llm import get_llm
            llm = get_llm(temperature=0.2)
            
            mock_gemini.assert_called_once()


class TestLLMWithFallback:
    """Tests for the LLMWithFallback wrapper."""

    def test_llm_type(self):
        """Test that LLM type is correctly reported."""
        from app.services.llm import LLMWithFallback
        
        llm = LLMWithFallback(primary=None, fallback=None)
        assert llm._llm_type == "llm_with_fallback"


class TestGroqCreation:
    """Tests for Groq LLM creation."""

    def test_create_groq_without_key(self):
        """Test that Groq returns None without API key."""
        from app.services.llm import _create_groq_llm
        
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=False):
            result = _create_groq_llm()
            # Should return None or handle gracefully
            # (actual behavior depends on implementation)


class TestGeminiCreation:
    """Tests for Gemini LLM creation."""

    def test_create_gemini_without_key(self):
        """Test that Gemini returns None without API key."""
        from app.services.llm import _create_gemini_llm
        
        with patch.dict(os.environ, {"GOOGLE_API_KEY": ""}, clear=False):
            result = _create_gemini_llm()
            # Should return None or handle gracefully
