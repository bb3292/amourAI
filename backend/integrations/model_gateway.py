"""
Model Gateway – Routes LLM calls through Blaxel (if configured) or direct Anthropic.

Blaxel provides:
  - Unified credential management (API keys stored securely on Blaxel)
  - Model routing with telemetry, fallback, and observability
  - Agent orchestration infrastructure

When BLAXEL_API_KEY + BLAXEL_WORKSPACE are set, all calls go through Blaxel's
model gateway proxy (https://run.blaxel.ai/<workspace>/models/<model>).
Otherwise, falls back to direct Anthropic SDK calls.
"""
import logging
from typing import Dict, Any, Optional

import anthropic
from config import (
    ANTHROPIC_API_KEY,
    BLAXEL_API_KEY,
    BLAXEL_WORKSPACE,
    BLAXEL_MODEL_NAME,
    CLAUDE_MODEL,
    MAX_TOKENS,
    USE_BLAXEL,
)

logger = logging.getLogger(__name__)

# ── Blaxel SDK (optional) ──────────────────────────────────
_blaxel_available = False
_bl_model_fn = None
_bl_settings = None

if USE_BLAXEL:
    try:
        import os
        os.environ["BL_API_KEY"] = BLAXEL_API_KEY
        os.environ["BL_WORKSPACE"] = BLAXEL_WORKSPACE
        from blaxel.core import bl_model as _bl_model_fn_import
        from blaxel.core.common import settings as _bl_settings_import
        _bl_model_fn = _bl_model_fn_import
        _bl_settings = _bl_settings_import
        _blaxel_available = True
        logger.info("Blaxel SDK loaded – routing through Blaxel model gateway")
    except ImportError:
        logger.warning("Blaxel SDK not installed – using direct Anthropic")
    except Exception as e:
        logger.warning(f"Blaxel SDK init failed ({e}) – using direct Anthropic")


class ModelGateway:
    """
    Unified LLM client that routes through Blaxel when available,
    falls back to direct Anthropic otherwise.

    Blaxel routing works by:
      1. Using bl_model() to resolve the proxy URL and model metadata
      2. Creating a standard Anthropic client pointed at the Blaxel proxy URL
      3. Passing Blaxel auth headers (X-Blaxel-Authorization, X-Blaxel-Workspace)
    """

    def __init__(self):
        self.mode = "blaxel" if _blaxel_available else "anthropic"
        self._blaxel_client: Optional[anthropic.Anthropic] = None
        self._blaxel_model_name: Optional[str] = None

        # Always keep a direct Anthropic client as fallback
        if ANTHROPIC_API_KEY:
            self._anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        else:
            self._anthropic_client = None

        if self.mode == "anthropic":
            if not ANTHROPIC_API_KEY:
                raise RuntimeError(
                    "Neither Blaxel nor Anthropic API key configured. "
                    "Set BLAXEL_API_KEY+BLAXEL_WORKSPACE or ANTHROPIC_API_KEY."
                )
            logger.info(f"ModelGateway initialized: Direct Anthropic → {CLAUDE_MODEL}")
        else:
            logger.info(f"ModelGateway initialized: Blaxel → {BLAXEL_MODEL_NAME}")

    async def _ensure_blaxel_client(self) -> None:
        """Lazily initialize the Blaxel-proxied Anthropic client."""
        if self._blaxel_client is not None:
            return
        bl_model = _bl_model_fn(BLAXEL_MODEL_NAME)
        url, type_, model = await bl_model.get_parameters()
        auth_headers = _bl_settings.auth.get_headers()
        self._blaxel_client = anthropic.Anthropic(
            base_url=url,
            api_key="blaxel-proxy",  # Auth is via Blaxel headers
            default_headers=auth_headers,
        )
        self._blaxel_model_name = model
        logger.info(f"[BLAXEL] Proxy client ready → {url} (model: {model})")

    async def chat(
        self,
        prompt: str,
        max_tokens: int = MAX_TOKENS,
        system: Optional[str] = None,
    ) -> str:
        """
        Send a message and return the text response.
        Routes through Blaxel or direct Anthropic based on configuration.
        """
        if self.mode == "blaxel":
            return await self._chat_blaxel(prompt, max_tokens, system)
        else:
            return self._chat_anthropic(prompt, max_tokens, system)

    async def _chat_blaxel(
        self, prompt: str, max_tokens: int, system: Optional[str]
    ) -> str:
        """Call LLM through Blaxel model gateway proxy."""
        prompt_preview = prompt[:80].replace('\n', ' ')
        logger.info(
            f"[BLAXEL] Sending request to model '{BLAXEL_MODEL_NAME}' "
            f"via Blaxel gateway… (prompt: {prompt_preview}…)"
        )
        try:
            await self._ensure_blaxel_client()

            messages = [{"role": "user", "content": prompt}]
            kwargs: Dict[str, Any] = {
                "model": self._blaxel_model_name or BLAXEL_MODEL_NAME,
                "max_tokens": max_tokens,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system

            response = self._blaxel_client.messages.create(**kwargs)
            result = response.content[0].text.strip()
            logger.info(f"[BLAXEL] ✓ Response received via Blaxel ({len(result)} chars)")
            return result

        except Exception as e:
            logger.warning(f"[BLAXEL] ✗ Call failed ({e}), falling back to direct Anthropic")
            if self._anthropic_client:
                return self._chat_anthropic(prompt, max_tokens, system)
            raise

    def _chat_anthropic(
        self, prompt: str, max_tokens: int, system: Optional[str]
    ) -> str:
        """Call Anthropic directly."""
        prompt_preview = prompt[:80].replace('\n', ' ')
        logger.info(f"[ANTHROPIC] Sending request to '{CLAUDE_MODEL}'… (prompt: {prompt_preview}…)")
        messages = [{"role": "user", "content": prompt}]
        kwargs: Dict[str, Any] = {
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        response = self._anthropic_client.messages.create(**kwargs)
        result = response.content[0].text.strip()
        logger.info(f"[ANTHROPIC] ✓ Response received ({len(result)} chars)")
        return result

    @property
    def gateway_mode(self) -> str:
        """Return which gateway is active."""
        return self.mode


# Singleton gateway instance
_gateway: Optional[ModelGateway] = None


def get_model_gateway() -> ModelGateway:
    """Get or create the singleton model gateway."""
    global _gateway
    if _gateway is None:
        _gateway = ModelGateway()
    return _gateway
