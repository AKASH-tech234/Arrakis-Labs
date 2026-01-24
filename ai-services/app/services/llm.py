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

# Rate limit tracking for Groq
_groq_rate_limit_until: float = 0.0


class LLMWithFallback(BaseChatModel):
    """
    LLM wrapper with automatic fallback on rate limits or errors.
    Primary: Groq (fast) | Fallback: Gemini (reliable)
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
        global _groq_rate_limit_until
        
        # Check if we're in rate limit cooldown
        if time.time() < _groq_rate_limit_until:
            logger.debug("Groq rate limited, using Gemini fallback")
            if self.fallback:
                return self.fallback._generate(messages, stop, run_manager, **kwargs)
        
        # Try primary (Groq)
        if self.primary and not self._use_fallback:
            try:
                return self.primary._generate(messages, stop, run_manager, **kwargs)
            except Exception as e:
                error_str = str(e).lower()
                
                # Handle rate limiting (429)
                if "429" in str(e) or "rate" in error_str or "limit" in error_str:
                    logger.warning(f"Groq rate limited, switching to Gemini fallback")
                    _groq_rate_limit_until = time.time() + 60  # 1 min cooldown
                    if self.fallback:
                        return self.fallback._generate(messages, stop, run_manager, **kwargs)
                
                # Handle other errors
                logger.error(f"Primary LLM error: {e}, trying fallback")
                if self.fallback:
                    return self.fallback._generate(messages, stop, run_manager, **kwargs)
                raise
        
        # Use fallback directly
        if self.fallback:
            return self.fallback._generate(messages, stop, run_manager, **kwargs)
        
        raise RuntimeError("No LLM available")
    
    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        """Async generate with automatic fallback."""
        global _groq_rate_limit_until
        
        # Check if we're in rate limit cooldown
        if time.time() < _groq_rate_limit_until:
            logger.debug("Groq rate limited, using Gemini fallback (async)")
            if self.fallback:
                return await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
        
        # Try primary (Groq)
        if self.primary and not self._use_fallback:
            try:
                return await self.primary._agenerate(messages, stop, run_manager, **kwargs)
            except Exception as e:
                error_str = str(e).lower()
                
                # Handle rate limiting (429)
                if "429" in str(e) or "rate" in error_str or "limit" in error_str:
                    logger.warning(f"Groq rate limited, switching to Gemini fallback (async)")
                    _groq_rate_limit_until = time.time() + 60  # 1 min cooldown
                    if self.fallback:
                        return await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
                
                # Handle other errors
                logger.error(f"Primary LLM error (async): {e}, trying fallback")
                if self.fallback:
                    return await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
                raise
        
        # Use fallback directly
        if self.fallback:
            return await self.fallback._agenerate(messages, stop, run_manager, **kwargs)
        
        raise RuntimeError("No LLM available")


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
    """Check if Groq is currently rate limited."""
    global _groq_rate_limit_until
    return time.time() < _groq_rate_limit_until


def reset_rate_limit():
    """Reset the rate limit cooldown (for testing)."""
    global _groq_rate_limit_until
    _groq_rate_limit_until = 0.0
