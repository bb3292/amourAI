"""
White Circle AI Integration – Quality monitoring, guardrails, and evaluation.

White Circle provides:
  - Hallucination detection on LLM outputs
  - Content quality evaluation (relevance, evidence, actionability)
  - Input/output guardrails (PII, jailbreak, data leak prevention)
  - Custom metrics and risk scoring

When WHITECIRCLE_API_KEY is set, artifact evaluation is routed through
White Circle's API. Otherwise, falls back to the built-in Claude-based evaluator.
"""
import json
import logging
from typing import Dict, Any, List, Optional

import httpx
from config import (
    WHITECIRCLE_API_KEY,
    WHITECIRCLE_BASE_URL,
    EVAL_THRESHOLDS,
    USE_WHITECIRCLE,
)

logger = logging.getLogger(__name__)


class WhiteCircleClient:
    """
    Client for White Circle AI's evaluation and guardrails API.
    Handles artifact quality scoring, hallucination detection, and content guardrails.
    """

    def __init__(self):
        self.api_key = WHITECIRCLE_API_KEY
        self.base_url = WHITECIRCLE_BASE_URL
        self.enabled = USE_WHITECIRCLE
        self._client: Optional[httpx.AsyncClient] = None

        if self.enabled:
            logger.info("White Circle AI client initialized – live evaluation enabled")
        else:
            logger.info("White Circle AI not configured – using built-in evaluator")

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "X-Source": "rivaliq-backend",
                },
                timeout=30.0,
            )
        return self._client

    async def evaluate_artifact(
        self,
        artifact_content: str,
        artifact_type: str,
        theme: Dict[str, Any],
        insights: List[Dict[str, Any]],
        citations_json: str,
    ) -> Dict[str, Any]:
        """
        Evaluate an artifact through White Circle's quality monitoring API.

        Sends the artifact + context to White Circle for scoring on:
        - Relevance, Evidence Coverage, Hallucination Risk,
          Actionability, Freshness

        Returns scores dict compatible with our EvaluationScore model.
        """
        if not self.enabled:
            raise RuntimeError("White Circle is not configured")

        client = await self._get_client()

        # Build the evaluation request payload
        evidence_items = []
        for ins in insights[:10]:
            evidence_items.append({
                "text": ins.get("text", ""),
                "quote": ins.get("quote", ""),
                "sentiment": ins.get("sentiment", "neutral"),
                "confidence": ins.get("confidence", 0.5),
            })

        citations = []
        try:
            citations = json.loads(citations_json) if citations_json else []
        except json.JSONDecodeError:
            pass

        payload = {
            "content": artifact_content[:5000],  # Respect API limits
            "content_type": artifact_type,
            "context": {
                "theme_name": theme.get("name", ""),
                "theme_description": theme.get("description", ""),
                "theme_severity": theme.get("severity_score", 0),
                "is_weakness": theme.get("is_weakness", False),
            },
            "evidence": evidence_items,
            "citations": citations,
            "rubrics": {
                "relevance": {
                    "description": "Does the artifact address the theme correctly?",
                    "threshold": EVAL_THRESHOLDS["relevance"],
                },
                "evidence_coverage": {
                    "description": "Are claims supported by cited evidence?",
                    "threshold": EVAL_THRESHOLDS["evidence_coverage"],
                },
                "hallucination_risk": {
                    "description": "Likelihood of unsupported claims (1.0 = safe)",
                    "threshold": EVAL_THRESHOLDS["hallucination_risk"],
                },
                "actionability": {
                    "description": "Does it provide concrete next steps?",
                    "threshold": EVAL_THRESHOLDS["actionability"],
                },
                "freshness": {
                    "description": "Are sources recent and timely?",
                    "threshold": EVAL_THRESHOLDS["freshness"],
                },
            },
        }

        try:
            logger.info(f"[WHITE CIRCLE] Sending evaluation request for {artifact_type} artifact ({len(artifact_content)} chars)…")
            response = await client.post("/evaluate", json=payload)
            response.raise_for_status()
            data = response.json()
            result = self._process_whitecircle_response(data)
            logger.info(
                f"[WHITE CIRCLE] ✓ Evaluation complete — "
                f"overall={result['overall_score']:.2f}, "
                f"relevance={result['relevance']:.2f}, "
                f"hallucination_safety={result['hallucination_risk']:.2f}, "
                f"flagged={result['flagged']}"
            )
            return result

        except httpx.HTTPStatusError as e:
            logger.error(f"[WHITE CIRCLE] ✗ API error: {e.response.status_code} – {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"[WHITE CIRCLE] ✗ Evaluation failed: {e}")
            raise

    async def check_guardrails(
        self,
        text: str,
        direction: str = "output",
    ) -> Dict[str, Any]:
        """
        Run text through White Circle's guardrails (input or output protection).

        Checks for:
        - PII leakage
        - Hallucination markers
        - Unsafe content
        - Data leak risks

        Returns: {"safe": bool, "issues": [...], "risk_score": float}
        """
        if not self.enabled:
            return {"safe": True, "issues": [], "risk_score": 0.0}

        client = await self._get_client()

        try:
            response = await client.post("/protect", json={
                "content": text[:5000],
                "direction": direction,
                "policies": ["pii", "hallucination", "data_leak", "unsafe_content"],
            })
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.warning(f"White Circle guardrails check failed ({e}), allowing through")
            return {"safe": True, "issues": [], "risk_score": 0.0}

    def _process_whitecircle_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process White Circle API response into our evaluation format."""
        scores = data.get("scores", data)

        result = {
            "relevance": self._clamp(scores.get("relevance", 0.5)),
            "evidence_coverage": self._clamp(scores.get("evidence_coverage", 0.5)),
            "hallucination_risk": self._clamp(scores.get("hallucination_risk", 0.5)),
            "actionability": self._clamp(scores.get("actionability", 0.5)),
            "freshness": self._clamp(scores.get("freshness", 0.5)),
            "flag_reason": scores.get("flag_reason") or data.get("flag_reason"),
        }

        # Overall weighted score
        result["overall_score"] = round(
            (result["relevance"] * 0.25
             + result["evidence_coverage"] * 0.25
             + result["hallucination_risk"] * 0.2
             + result["actionability"] * 0.2
             + result["freshness"] * 0.1),
            3,
        )

        # Check against thresholds
        flagged = False
        reasons = []
        for metric, threshold in EVAL_THRESHOLDS.items():
            if result.get(metric, 1.0) < threshold:
                flagged = True
                reasons.append(f"{metric} ({result[metric]:.2f}) below threshold ({threshold})")

        result["flagged"] = flagged
        if flagged and not result["flag_reason"]:
            result["flag_reason"] = "; ".join(reasons)

        return result

    def _clamp(self, val: Any) -> float:
        try:
            v = float(val)
            return max(0.0, min(1.0, v))
        except (TypeError, ValueError):
            return 0.5

    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton client
_whitecircle: Optional[WhiteCircleClient] = None


def get_whitecircle_client() -> WhiteCircleClient:
    """Get or create the singleton White Circle client."""
    global _whitecircle
    if _whitecircle is None:
        _whitecircle = WhiteCircleClient()
    return _whitecircle
