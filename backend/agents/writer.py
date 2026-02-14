"""
Writer Agent – generates actionable artifacts (battlecards, messaging, roadmap tickets).
"""
import json
import logging
from typing import Dict, Any, List

import anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS

logger = logging.getLogger(__name__)


class WriterAgent:
    """Generates actionable artifacts from themes and insights via Claude."""

    def __init__(self):
        if not ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Add it to your .env file to use live analysis."
            )
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    async def generate_artifact(
        self,
        action_type: str,
        theme: Dict[str, Any],
        insights: List[Dict[str, Any]],
        competitor_name: str,
    ) -> Dict[str, str]:
        """Generate an artifact based on action type, theme, and evidence."""
        if action_type == "battlecard":
            return await self._generate_battlecard(theme, insights, competitor_name)
        elif action_type == "messaging":
            return await self._generate_messaging(theme, insights, competitor_name)
        elif action_type == "roadmap":
            return await self._generate_roadmap_ticket(theme, insights, competitor_name)
        else:
            return {"content": "No artifact generated for 'ignore' action type.", "citations": "[]"}

    async def _generate_battlecard(
        self, theme: Dict, insights: List[Dict], competitor_name: str
    ) -> Dict[str, str]:
        evidence = self._format_evidence(insights)
        prompt = f"""You are a competitive intelligence expert. Generate a detailed battlecard section for the sales team.

COMPETITOR: {competitor_name}
WEAKNESS THEME: {theme.get('name', 'Unknown')}
THEME DESCRIPTION: {theme.get('description', '')}
SEVERITY: {theme.get('severity_score', 0)}/1.0

EVIDENCE:
{evidence}

Generate a battlecard in Markdown with these sections:
1. **Competitor Weakness** - 2-3 sentence summary
2. **Key Evidence** - Bullet points with direct quotes, source, and date in [Source - Date] format
3. **Talk Track** - A natural sales conversation snippet (3-4 sentences in blockquote)
4. **Objection Handling** - Table with 2-3 common objections and responses
5. **Competitive Positioning** - Our advantages vs their weaknesses

Every claim MUST cite a source. Be specific and actionable. Use Markdown formatting."""

        return await self._call_llm(prompt, insights)

    async def _generate_messaging(
        self, theme: Dict, insights: List[Dict], competitor_name: str
    ) -> Dict[str, str]:
        evidence = self._format_evidence(insights)
        prompt = f"""You are a product marketing copywriter. Generate messaging recommendations based on competitor intelligence.

COMPETITOR: {competitor_name}
THEME: {theme.get('name', 'Unknown')}
DESCRIPTION: {theme.get('description', '')}

EVIDENCE:
{evidence}

Generate a messaging document in Markdown with:
1. **Headline** - Punchy positioning headline
2. **Subheadline** - Supporting statement
3. **Key Messages** - For different buyer personas (Technical, Business, Procurement)
4. **Evidence Points** - Cited facts supporting the messaging
5. **Channels** - Where to deploy this messaging

Cite all evidence with [Source - Date - URL] format."""

        return await self._call_llm(prompt, insights)

    async def _generate_roadmap_ticket(
        self, theme: Dict, insights: List[Dict], competitor_name: str
    ) -> Dict[str, str]:
        evidence = self._format_evidence(insights)
        prompt = f"""You are a product manager. Generate a roadmap ticket based on competitive intelligence.

COMPETITOR: {competitor_name}
THEME: {theme.get('name', 'Unknown')}
DESCRIPTION: {theme.get('description', '')}

EVIDENCE:
{evidence}

Generate a roadmap ticket in Markdown with:
1. **Title** - Clear, actionable ticket title
2. **Priority** - P0/P1/P2 with justification
3. **Context** - Why this matters competitively
4. **User Story** - "As a [persona], I want [feature] so I can [benefit]"
5. **Requirements** - Numbered list of specific requirements
6. **Success Criteria** - Measurable outcomes
7. **Competitive Evidence** - Cited quotes driving this request
8. **Estimated Effort** - Rough sizing

Cite all evidence with [Source - Date] format."""

        return await self._call_llm(prompt, insights)

    async def _call_llm(self, prompt: str, insights: List[Dict]) -> Dict[str, str]:
        """Call Claude and return content + citations."""
        try:
            response = self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.content[0].text.strip()

            # Build citations from insights
            citations = []
            for ins in insights:
                if ins.get("quote"):
                    citations.append({
                        "source": ins.get("persona", "Unknown"),
                        "date": ins.get("source_date", "Recent"),
                        "url": ins.get("source_url", ""),
                        "quote": ins["quote"],
                    })

            return {
                "content": content,
                "citations": json.dumps(citations),
            }
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return {
                "content": f"Error generating artifact: {str(e)}",
                "citations": "[]",
            }

    def _format_evidence(self, insights: List[Dict]) -> str:
        """Format insights as evidence for prompts."""
        parts = []
        for i, ins in enumerate(insights):
            parts.append(
                f"- Insight {i+1}: {ins.get('text', '')}\n"
                f"  Sentiment: {ins.get('sentiment', 'unknown')} ({ins.get('sentiment_score', 0)})\n"
                f"  Persona: {ins.get('persona', 'unknown')}\n"
                f"  Quote: \"{ins.get('quote', 'N/A')}\"\n"
                f"  Confidence: {ins.get('confidence', 0)}"
            )
        return "\n".join(parts) if parts else "No direct evidence available."

    async def generate_snapshot_report(
        self,
        competitor_name: str,
        themes: List[Dict[str, Any]],
        insights: List[Dict[str, Any]],
    ) -> str:
        """Generate a full competitive snapshot report using Claude."""
        themes_text = json.dumps(themes, indent=2)
        insights_text = json.dumps(insights[:20], indent=2)  # Limit for token budget

        prompt = f"""You are a competitive intelligence strategist. Generate a comprehensive competitive snapshot report for "{competitor_name}".

THEMES:
{themes_text}

KEY INSIGHTS (sample):
{insights_text}

Generate a JSON object with these fields:
- "title": report title with competitor name and current date
- "swot": object with "strengths", "weaknesses", "opportunities", "threats" (each an array of strings, based ONLY on the evidence provided)
- "positioning_angle": one-sentence positioning recommendation
- "top_weaknesses": array of objects with "name", "severity" (0-1), "evidence" (supporting quote/fact from the data)
- "recommended_actions": array of 3-5 concrete next-step actions
- "evidence_count": {len(insights)}
- "theme_count": {len(themes)}
- "avg_confidence": calculated average confidence from the insights

Return ONLY valid JSON. All claims must be supported by the themes/insights provided."""

        try:
            response = self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                json.loads(text[start:end])  # Validate JSON
                return text[start:end]
            return text
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return json.dumps({"error": str(e)})
