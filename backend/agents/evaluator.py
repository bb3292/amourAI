"""
Evaluator Agent – scores artifacts for quality, hallucination, evidence, etc.
Uses White Circle AI (if configured) or built-in LLM-as-judge via model gateway.
"""
import json
import logging
from typing import Dict, Any, List

from config import EVAL_THRESHOLDS, USE_WHITECIRCLE
from integrations.model_gateway import get_model_gateway
from integrations.whitecircle import get_whitecircle_client

logger = logging.getLogger(__name__)


class EvaluatorAgent:
    """
    Evaluates generated artifacts using White Circle AI (preferred)
    or built-in LLM-as-judge through Blaxel/Anthropic model gateway.
    """

    def __init__(self):
        self.whitecircle = get_whitecircle_client()
        self.gateway = get_model_gateway()

        if self.whitecircle.enabled:
            logger.info("EvaluatorAgent initialized (White Circle AI)")
        else:
            logger.info(f"EvaluatorAgent initialized (LLM-as-judge via {self.gateway.gateway_mode})")

    async def evaluate_artifact(
        self,
        artifact_content: str,
        artifact_type: str,
        theme: Dict[str, Any],
        insights: List[Dict[str, Any]],
        citations_json: str,
    ) -> Dict[str, Any]:
        """
        Evaluate an artifact on 5 rubrics (0-1 each).
        Returns scores + flagged status + reason.

        Priority:
          1. White Circle API (if WHITECIRCLE_API_KEY is set)
          2. LLM-as-judge via Blaxel/Anthropic gateway (fallback)
        """

        # ── Try White Circle first ────────────────────────────
        if self.whitecircle.enabled:
            try:
                logger.info("━━━ EVALUATOR: Using White Circle AI for artifact evaluation ━━━")
                result = await self.whitecircle.evaluate_artifact(
                    artifact_content, artifact_type, theme, insights, citations_json
                )
                logger.info(f"━━━ EVALUATOR: White Circle result — overall={result.get('overall_score', '?')}, flagged={result.get('flagged', '?')} ━━━")
                return result
            except Exception as e:
                logger.warning(f"━━━ EVALUATOR: White Circle failed ({e}), falling back to LLM-as-judge ━━━")

        # ── Fallback: LLM-as-judge via gateway ────────────────
        logger.info("━━━ EVALUATOR: Using LLM-as-judge via model gateway ━━━")
        return await self._evaluate_with_llm(
            artifact_content, artifact_type, theme, insights, citations_json
        )

    async def _evaluate_with_llm(
        self,
        artifact_content: str,
        artifact_type: str,
        theme: Dict[str, Any],
        insights: List[Dict[str, Any]],
        citations_json: str,
    ) -> Dict[str, Any]:
        """Evaluate using LLM-as-judge through the model gateway."""
        evidence_summary = self._build_evidence_summary(insights, citations_json)

        prompt = f"""You are a competitive intelligence quality auditor. Evaluate the following artifact rigorously.

ARTIFACT TYPE: {artifact_type}
ARTIFACT CONTENT:
{artifact_content[:3000]}

THEME: {theme.get('name', 'Unknown')} — {theme.get('description', '')}

AVAILABLE EVIDENCE:
{evidence_summary}

Score the artifact on these 5 rubrics (0.0 to 1.0 each):

1. **relevance**: Does the artifact correctly address the theme? (1.0 = perfectly relevant)
2. **evidence_coverage**: Are all major claims supported by cited evidence? (1.0 = fully cited)
3. **hallucination_risk**: Likelihood of unsupported claims. Score as SAFETY: 1.0 = no hallucination risk, 0.0 = high hallucination risk
4. **actionability**: Does the artifact provide concrete, usable next steps? (1.0 = immediately actionable)
5. **freshness**: Are sources recent and timely? (1.0 = all sources within 30 days, 0.5 = within 90 days, 0.0 = stale)

Also provide:
- "flag_reason": If ANY score is below its threshold, explain why (1-2 sentences). Otherwise null.

Thresholds: relevance>{EVAL_THRESHOLDS['relevance']}, evidence>{EVAL_THRESHOLDS['evidence_coverage']}, hallucination_risk>{EVAL_THRESHOLDS['hallucination_risk']}, actionability>{EVAL_THRESHOLDS['actionability']}, freshness>{EVAL_THRESHOLDS['freshness']}

Return ONLY a JSON object with keys: relevance, evidence_coverage, hallucination_risk, actionability, freshness, flag_reason (string or null)."""

        try:
            text = await self.gateway.chat(prompt, max_tokens=1024)
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                scores = json.loads(text[start:end])
                return self._process_scores(scores)
            logger.error(f"Could not parse evaluation JSON: {text[:200]}")
            return self._fallback_evaluation()
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return self._fallback_evaluation()

    def _process_scores(self, scores: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize scores and determine flagged status."""
        result = {
            "relevance": self._clamp(scores.get("relevance", 0.5)),
            "evidence_coverage": self._clamp(scores.get("evidence_coverage", 0.5)),
            "hallucination_risk": self._clamp(scores.get("hallucination_risk", 0.5)),
            "actionability": self._clamp(scores.get("actionability", 0.5)),
            "freshness": self._clamp(scores.get("freshness", 0.5)),
            "flag_reason": scores.get("flag_reason"),
        }

        # Calculate overall weighted score
        result["overall_score"] = round(
            (result["relevance"] * 0.25
             + result["evidence_coverage"] * 0.25
             + result["hallucination_risk"] * 0.2
             + result["actionability"] * 0.2
             + result["freshness"] * 0.1),
            3,
        )

        # Determine if flagged
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
        """Clamp a value to 0.0-1.0."""
        try:
            v = float(val)
            return max(0.0, min(1.0, v))
        except (TypeError, ValueError):
            return 0.5

    def _build_evidence_summary(self, insights: List[Dict], citations_json: str) -> str:
        """Summarize available evidence for evaluation."""
        parts = []
        for ins in insights[:10]:
            parts.append(f"- {ins.get('text', '')} (quote: \"{ins.get('quote', 'N/A')}\")")

        try:
            citations = json.loads(citations_json) if citations_json else []
            for cit in citations:
                parts.append(f"- Citation: [{cit.get('source', '')} - {cit.get('date', '')}] \"{cit.get('quote', '')}\"")
        except json.JSONDecodeError:
            pass

        return "\n".join(parts) if parts else "No evidence provided."

    def _fallback_evaluation(self) -> Dict[str, Any]:
        """Return conservative scores when evaluation fails."""
        return {
            "relevance": 0.5,
            "evidence_coverage": 0.5,
            "hallucination_risk": 0.5,
            "actionability": 0.5,
            "freshness": 0.5,
            "overall_score": 0.5,
            "flagged": True,
            "flag_reason": "Automated evaluation failed — manual review required",
        }
