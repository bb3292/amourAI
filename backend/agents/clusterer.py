"""
Clusterer Agent – extracts insights and clusters them into themes.
Routes LLM calls through Blaxel model gateway (if configured) or direct Anthropic.
"""
import json
import logging
from typing import List, Dict, Any

from integrations.model_gateway import get_model_gateway

logger = logging.getLogger(__name__)


class ClustererAgent:
    """Extracts insights from text chunks and clusters them into themes via LLM."""

    def __init__(self):
        self.gateway = get_model_gateway()
        logger.info(f"ClustererAgent initialized (gateway: {self.gateway.gateway_mode})")

    async def extract_insights(
        self, chunks: List[str], source_url: str, competitor_name: str
    ) -> List[Dict[str, Any]]:
        """Extract structured insights from text chunks using LLM."""
        all_insights = []
        for i, chunk in enumerate(chunks):
            try:
                insights = await self._extract_from_chunk(chunk, source_url, competitor_name)
                all_insights.extend(insights)
            except Exception as e:
                logger.error(f"Error extracting insights from chunk {i}: {e}")
                continue

        # Deduplicate by text similarity
        seen_texts = set()
        unique = []
        for ins in all_insights:
            key = ins.get("text", "")[:80].lower().strip()
            if key not in seen_texts:
                seen_texts.add(key)
                unique.append(ins)

        logger.info(f"Extracted {len(unique)} unique insights from {len(chunks)} chunks")
        return unique

    async def _extract_from_chunk(
        self, chunk: str, source_url: str, competitor_name: str
    ) -> List[Dict[str, Any]]:
        """Use LLM to extract insights from a single chunk."""
        prompt = f"""Analyze the following text about competitor "{competitor_name}" and extract competitive insights.

TEXT:
{chunk}

SOURCE URL: {source_url}

Extract each distinct competitive insight as a JSON object with these fields:
- "text": concise summary of the insight (1-2 sentences)
- "sentiment": one of "positive", "negative", "neutral", "mixed"
- "sentiment_score": float from -1.0 (very negative) to 1.0 (very positive). Calculate this precisely:
  * -1.0 to -0.7: Strongly negative — explicit complaints, severe criticisms, deal-breakers mentioned
  * -0.7 to -0.3: Moderately negative — notable shortcomings, frustrations, unmet expectations
  * -0.3 to -0.1: Mildly negative — minor issues, caveats, small concerns
  * -0.1 to 0.1: Neutral — factual observations, neither positive nor negative
  * 0.1 to 0.3: Mildly positive — decent aspects, adequate performance
  * 0.3 to 0.7: Moderately positive — clear praise, notable strengths, satisfied users
  * 0.7 to 1.0: Strongly positive — enthusiastic endorsement, major differentiator, exceptional praise
  The score MUST be grounded in the actual language and tone of the source text. Do not default to round numbers — use precise values (e.g. -0.65, 0.42, -0.15).
- "persona": likely job role of the person expressing this (e.g. "DevOps Engineer", "Product Manager", "Customer"). Infer from context clues in the text.
- "quote": the most relevant direct quote from the text (verbatim, 1-2 sentences max). If no direct quote available, use the most relevant phrase.
- "confidence": float 0.0-1.0 indicating how confident you are in this insight. Base this on:
  * 0.9-1.0: Direct quote with clear attribution, verifiable claim
  * 0.7-0.9: Clear statement but indirect or partial attribution
  * 0.5-0.7: Implied or inferred from context, some ambiguity
  * 0.3-0.5: Weak signal, heavily inferred
  * Below 0.3: Speculative, barely supported

Return ONLY a JSON array of insight objects. If no meaningful insights, return [].
Do not include any explanatory text outside the JSON array."""

        text = await self.gateway.chat(prompt)

        try:
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            return []
        except json.JSONDecodeError:
            logger.error(f"Failed to parse insights JSON: {text[:200]}")
            return []

    async def cluster_into_themes(
        self, insights: List[Dict[str, Any]], competitor_name: str
    ) -> List[Dict[str, Any]]:
        """Cluster insights into themes with severity scoring using LLM."""
        if not insights:
            return []

        insights_text = json.dumps(insights, indent=2)

        prompt = f"""You are a competitive intelligence analyst. Given these insights about competitor "{competitor_name}", cluster them into distinct competitive themes.

INSIGHTS:
{insights_text}

For each theme, provide:
- "name": short theme name (3-6 words)
- "description": 1-2 sentence description
- "sentiment": overall sentiment ("positive", "negative", "neutral", "mixed")
- "severity_score": float 0.0-1.0 — calculate this genuinely using the formula:
  severity = (frequency_weight * 0.4) + (sentiment_intensity * 0.4) + (recency_weight * 0.2)
  Where:
  * frequency_weight = min(1.0, number_of_insights_in_theme / total_insights). More mentions = higher weight.
  * sentiment_intensity = average absolute sentiment_score of insights in this theme (e.g. avg of |-0.8|, |-0.6| = 0.7). Stronger negative/positive language = higher.
  * recency_weight = 1.0 if signals appear very recent, 0.5 if moderately recent, 0.2 if old.
  Show your calculation reasoning in the description. The score MUST reflect the actual data — do NOT use placeholder values.
- "frequency": actual count of insights belonging to this theme (not estimated — count them)
- "recency_days": estimated days since most recent signal based on any date clues in the source text. If no date clues, use 30 as default.
- "is_weakness": boolean, true if this is a competitor weakness we can exploit (based on negative sentiment insights)
- "differentiation_move": if is_weakness, suggest a concrete differentiation action (1-2 sentences). If not a weakness, suggest how to counter this competitor strength.
- "insight_indices": array of 0-based indices into the insights array that belong to this theme

Return ONLY a JSON array of theme objects. Merge similar insights into the same theme. Every insight should belong to at least one theme."""

        text = await self.gateway.chat(prompt)

        try:
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            return []
        except json.JSONDecodeError:
            logger.error(f"Failed to parse themes JSON: {text[:200]}")
            return []
