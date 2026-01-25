# ═══════════════════════════════════════════════════════════════════════════════
# LLM Service - Multi-Provider with Automatic Fallback
# Primary: Groq (fast, free tier) | Fallback: Gemini (reliable)
# ═══════════════════════════════════════════════════════════════════════════════

import os
import logging
import time
from typing import Optional, Any
from dotenv import load_dotenv

# Load .env file (not from terminal/setx)
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage

logger = logging.getLogger("llm_service")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")  # groq | gemini | openai

# Groq models (fast inference, free tier: 30 req/min)
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_FALLBACK_MODEL = "mixtral-8x7b-32768"

# Gemini models (reliable, good for complex tasks)
GEMINI_MODEL = "gemini-2.5-flash"

# Rate limit tracking for both providers
_groq_rate_limit_until: float = 0.0
_gemini_rate_limit_until: float = 0.0
_both_rate_limited_count: int = 0


class AllProvidersRateLimitedError(Exception):
    """Raised when all LLM providers are rate limited."""
    pass


def _is_rate_limit_error(error: Exception) -> bool:
    """Check if an exception is a rate limit error."""
    error_str = str(error).lower()
    return (
        "429" in str(error) or
        "rate" in error_str or
        "limit" in error_str or
        "quota" in error_str or
        "resource_exhausted" in error_str
    )


class LLMWithFallback(BaseChatModel):
    """
    LLM wrapper with automatic fallback on rate limits or errors.
    Primary: Groq (fast) | Fallback: Gemini (reliable)
    
    When both are rate limited, raises AllProvidersRateLimitedError
    so agents can return fallback responses immediately.
    """
    
    primary: Optional[BaseChatModel] = None
    fallback: Optional[BaseChatModel] = None
    _use_fallback: bool = False
    
    class Config:
        arbitrary_types_allowed = True
    
    @property
    def _llm_type(self) -> str:
        return "llm_with_fallback"
    
    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        """Generate with automatic fallback."""
        global _groq_rate_limit_until, _gemini_rate_limit_until, _both_rate_limited_count
        
        now = time.time()
        groq_limited = now < _groq_rate_limit_until
        gemini_limited = now < _gemini_rate_limit_until
        
        # If both are rate limited, fail fast
        if groq_limited and gemini_limited:
            _both_rate_limited_count += 1
            wait_time = min(_groq_rate_limit_until, _gemini_rate_limit_until) - now
            logger.warning(f"Both LLMs rate limited, wait {wait_time:.1f}s (count: {_both_rate_limited_count})")
            raise AllProvidersRateLimitedError(f"All LLM providers rate limited. Retry in {wait_time:.1f}s")
        
        # Try primary (Groq) if not rate limited
        if self.primary and not self._use_fallback and not groq_limited:
            try:
                result = self.primary._generate(messages, stop, run_manager, **kwargs)
                _both_rate_limited_count = 0  # Reset on success
                return result
            except Exception as e:
                if _is_rate_limit_error(e):
                    logger.warning(f"Groq rate limited, switching to Gemini fallback")
                    _groq_rate_limit_until = now + 60  # 1 min cooldown
                else:
                    logger.error(f"Primary LLM error: {e}, trying fallback")
                
                # Try fallback
                if self.fallback and not gemini_limited:
                    try:
                        result = self.fallback._generate(messages, stop, run_manager, **kwargs)
                        _both_rate_limited_count = 0
                        return result
                    except Exception as fallback_err:
                        if _is_rate_limit_error(fallback_err):
                            _gemini_rate_limit_until = now + 120  # 2 min cooldown for Gemini
                            logger.warning("Gemini also rate limited")
                            raise AllProvidersRateLimitedError("All LLM providers rate limited")
                        raise
                elif gemini_limited:
                    raise AllProvidersRateLimitedError("All LLM providers rate limited")
                raise
        
        # Use fallback directly if Groq is limited
        if self.fallback and not gemini_limited:
            try:
                result = self.fallback._generate(messages, stop, run_manager, **kwargs)
                _both_rate_limited_count = 0
                return result
            except Exception as e:
                if _is_rate_limit_error(e):
                    _gemini_rate_limit_until = now + 120
                    raise AllProvidersRateLimitedError("All LLM providers rate limited")
                raise
        
        raise AllProvidersRateLimitedError("All LLM providers rate limited or unavailable")
    
    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        """Async generate with automatic fallback."""
        global _groq_rate_limit_until, _gemini_rate_limit_until, _both_rate_limited_count
        
        now = time.time()
        groq_limited = now < _groq_rate_limit_until
        gemini_limited = now < _gemini_rate_limit_until
        
        # If both are rate limited, fail fast
        if groq_limited and gemini_limited:
            _both_rate_limited_count += 1
            wait_time = min(_groq_rate_limit_until, _gemini_rate_limit_until) - now
            logger.warning(f"Both LLMs rate limited (async), wait {wait_time:.1f}s")
            raise AllProvidersRateLimitedError(f"All LLM providers rate limited. Retry in {wait_time:.1f}s")
        
        # Try primary (Groq) if not rate limited
        if self.primary and not self._use_fallback and not groq_limited:
            try:
                result = await self.primary._agenerate(messages, stop, run_manager, **kwargs)
                _both_rate_limited_count = 0
                return result
            except Exception as e:
                if _is_rate_limit_error(e):
                    logger.warning(f"Groq rate limited (async), switching to Gemini fallback")
                    _groq_rate_limit_until = now + 60
                else:
                    logger.error(f"Primary LLM error (async): {e}, trying fallback")
                
                if self.fallback and not gemini_limited:
                    try:
                        result = await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
                        _both_rate_limited_count = 0
                        return result
                    except Exception as fallback_err:
                        if _is_rate_limit_error(fallback_err):
                            _gemini_rate_limit_until = now + 120
                            raise AllProvidersRateLimitedError("All LLM providers rate limited")
                        raise
                elif gemini_limited:
                    raise AllProvidersRateLimitedError("All LLM providers rate limited")
                raise
        
        # Use fallback directly
        if self.fallback and not gemini_limited:
            try:
                result = await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
                _both_rate_limited_count = 0
                return result
            except Exception as e:
                if _is_rate_limit_error(e):
                    _gemini_rate_limit_until = now + 120
                    raise AllProvidersRateLimitedError("All LLM providers rate limited")
                raise
        
        raise AllProvidersRateLimitedError("All LLM providers rate limited or unavailable")


def _create_groq_llm(temperature: float = 0.2) -> Optional[ChatGroq]:
    """Create Groq LLM instance."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set in .env")
        return None
    
    logger.debug(f"Creating Groq LLM (model={GROQ_MODEL}, temp={temperature})")
    return ChatGroq(
        model=GROQ_MODEL,
        temperature=temperature,
        api_key=api_key,
        max_retries=2,
    )


def _create_gemini_llm(temperature: float = 0.2) -> Optional[ChatGoogleGenerativeAI]:
    """Create Gemini LLM instance."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set in .env")
        return None
    
    logger.debug(f"Creating Gemini LLM (model={GEMINI_MODEL}, temp={temperature})")
    return ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=temperature,
        google_api_key=api_key,
        convert_system_message_to_human=True,
    )


def get_llm(temperature: float = 0.2) -> BaseChatModel:
    """
    Get LLM instance with automatic fallback.
    
    Configuration via LLM_PROVIDER env var:
    - "groq": Groq primary, Gemini fallback (default)
    - "gemini": Gemini only
    - "openai": Not implemented yet
    
    Returns:
        BaseChatModel with fallback support
    """
    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    
    if provider == "gemini":
        # Gemini only (no fallback)
        gemini = _create_gemini_llm(temperature)
        if not gemini:
            raise RuntimeError("GOOGLE_API_KEY is not set in .env")
        logger.info(f"Using Gemini LLM (model={GEMINI_MODEL})")
        return gemini
    
    elif provider == "groq":
        # Groq primary with Gemini fallback
        groq = _create_groq_llm(temperature)
        gemini = _create_gemini_llm(temperature)
        
        if not groq and not gemini:
            raise RuntimeError("Neither GROQ_API_KEY nor GOOGLE_API_KEY is set in .env")
        
        if groq and gemini:
            logger.info(f"Using Groq LLM with Gemini fallback (primary={GROQ_MODEL})")
            return LLMWithFallback(primary=groq, fallback=gemini)
        elif groq:
            logger.info(f"Using Groq LLM only (model={GROQ_MODEL})")
            return groq
        else:
            logger.info(f"Groq unavailable, using Gemini (model={GEMINI_MODEL})")
            return gemini
    
    else:
        # Unknown provider, try Gemini
        logger.warning(f"Unknown LLM_PROVIDER '{provider}', falling back to Gemini")
        gemini = _create_gemini_llm(temperature)
        if not gemini:
            raise RuntimeError(f"Unknown LLM_PROVIDER '{provider}' and GOOGLE_API_KEY not set")
        return gemini


# ─────────────────────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def get_current_provider() -> str:
    """Get the currently configured LLM provider."""
    return os.getenv("LLM_PROVIDER", "groq")


def is_rate_limited() -> bool:
    """Check if any LLM provider is currently rate limited."""
    global _groq_rate_limit_until, _gemini_rate_limit_until
    now = time.time()
    return now < _groq_rate_limit_until or now < _gemini_rate_limit_until


def are_all_rate_limited() -> bool:
    """Check if ALL LLM providers are currently rate limited."""
    global _groq_rate_limit_until, _gemini_rate_limit_until
    now = time.time()
    return now < _groq_rate_limit_until and now < _gemini_rate_limit_until


def get_rate_limit_status() -> dict:
    """Get detailed rate limit status for monitoring."""
    global _groq_rate_limit_until, _gemini_rate_limit_until, _both_rate_limited_count
    now = time.time()
    return {
        "groq_limited": now < _groq_rate_limit_until,
        "groq_wait_seconds": max(0, _groq_rate_limit_until - now),
        "gemini_limited": now < _gemini_rate_limit_until,
        "gemini_wait_seconds": max(0, _gemini_rate_limit_until - now),
        "both_limited_count": _both_rate_limited_count,
    }


def reset_rate_limit():
    """Reset all rate limit cooldowns (for testing)."""
    global _groq_rate_limit_until, _gemini_rate_limit_until, _both_rate_limited_count
    _groq_rate_limit_until = 0.0
    _gemini_rate_limit_until = 0.0
    _both_rate_limited_count = 0
