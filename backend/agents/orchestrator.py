"""
Orchestrator – coordinates the full agent pipeline.
Replaces Blaxel orchestration layer.
Pipeline: Collect → Cluster → (on action) Write → Evaluate
"""
import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import (
    Competitor, Source, Insight, Theme, ThemeInsight,
    ActionItem, Artifact, EvaluationScore,
)
from agents.collector import CollectorAgent
from agents.clusterer import ClustererAgent
from agents.writer import WriterAgent
from agents.evaluator import EvaluatorAgent

logger = logging.getLogger(__name__)


class Orchestrator:
    """Coordinates the full ingestion-to-artifact pipeline."""

    def __init__(self):
        self.collector = CollectorAgent()
        self.clusterer = ClustererAgent()
        self.writer = WriterAgent()
        self.evaluator = EvaluatorAgent()

    # ── Full Ingestion Pipeline ──────────────────────────────
    async def ingest_sources(
        self,
        db: AsyncSession,
        competitor_id: int,
        urls: List[str],
        raw_texts: List[str],
        source_type: str = "manual",
    ) -> Dict[str, Any]:
        """
        Run full pipeline: fetch URLs / process raw text → extract insights → cluster themes.
        Returns summary of what was created.
        """
        # Verify competitor exists
        comp = await db.get(Competitor, competitor_id)
        if not comp:
            return {"status": "error", "message": f"Competitor {competitor_id} not found"}

        all_chunks = []
        sources_created = 0
        errors = []

        # Process URLs
        for url in urls:
            source = Source(
                competitor_id=competitor_id,
                url=url,
                source_type=source_type if source_type != "manual" else "web",
                status="processing",
            )
            db.add(source)
            await db.flush()

            try:
                text, detected_type = await self.collector.fetch_url(url)
                text = self.collector.redact_pii(text)
                source.raw_content = text[:10000]  # Limit stored content
                source.source_type = detected_type
                source.status = "done"
                chunks = self.collector.chunk_text(text)
                all_chunks.extend([(chunk, url, source.id) for chunk in chunks])
                sources_created += 1
            except Exception as e:
                source.status = "failed"
                source.error_message = str(e)[:500]
                errors.append(f"URL {url}: {str(e)[:200]}")
                logger.error(f"Failed to fetch {url}: {e}")

        # Process raw texts
        for raw in raw_texts:
            source = Source(
                competitor_id=competitor_id,
                source_type="manual",
                status="processing",
            )
            db.add(source)
            await db.flush()

            try:
                text, stype = self.collector.parse_raw_text(raw)
                text = self.collector.redact_pii(text)
                source.raw_content = text[:10000]
                source.status = "done"
                chunks = self.collector.chunk_text(text)
                all_chunks.extend([(chunk, "manual", source.id) for chunk in chunks])
                sources_created += 1
            except Exception as e:
                source.status = "failed"
                source.error_message = str(e)[:500]
                errors.append(f"Raw text: {str(e)[:200]}")

        await db.commit()

        if not all_chunks:
            return {
                "status": "error" if errors else "warning",
                "sources_created": sources_created,
                "insights_extracted": 0,
                "themes_generated": 0,
                "message": "; ".join(errors) if errors else "No content to process",
            }

        # Extract insights from chunks
        chunk_texts = [c[0] for c in all_chunks]
        source_urls = [c[1] for c in all_chunks]
        source_ids = [c[2] for c in all_chunks]

        # Group by source for extraction
        combined_text = "\n\n---\n\n".join(chunk_texts[:10])  # Limit chunks
        primary_url = source_urls[0] if source_urls else "unknown"

        raw_insights = await self.clusterer.extract_insights(
            [combined_text], primary_url, comp.name
        )

        # Store insights
        insight_objects = []
        for raw_ins in raw_insights:
            insight = Insight(
                source_id=source_ids[0],
                competitor_id=competitor_id,
                text=raw_ins.get("text", ""),
                sentiment=raw_ins.get("sentiment", "neutral"),
                sentiment_score=raw_ins.get("sentiment_score", 0.0),
                persona=raw_ins.get("persona", "Unknown"),
                quote=raw_ins.get("quote", ""),
                confidence=raw_ins.get("confidence", 0.5),
                source_url=primary_url if primary_url != "manual" else None,
            )
            db.add(insight)
            insight_objects.append(insight)

        await db.flush()

        # Cluster into themes
        raw_themes = await self.clusterer.cluster_into_themes(raw_insights, comp.name)

        themes_created = 0
        for raw_theme in raw_themes:
            theme = Theme(
                competitor_id=competitor_id,
                name=raw_theme.get("name", "Unnamed Theme"),
                description=raw_theme.get("description", ""),
                sentiment=raw_theme.get("sentiment", "neutral"),
                severity_score=raw_theme.get("severity_score", 0.0),
                frequency=raw_theme.get("frequency", 1),
                recency_days=raw_theme.get("recency_days", 0),
                is_weakness=raw_theme.get("is_weakness", False),
                differentiation_move=raw_theme.get("differentiation_move", ""),
            )
            db.add(theme)
            await db.flush()

            # Link insights to theme
            indices = raw_theme.get("insight_indices", [])
            for idx in indices:
                if 0 <= idx < len(insight_objects):
                    link = ThemeInsight(theme_id=theme.id, insight_id=insight_objects[idx].id)
                    db.add(link)

            themes_created += 1

        await db.commit()

        return {
            "status": "success",
            "sources_created": sources_created,
            "insights_extracted": len(insight_objects),
            "themes_generated": themes_created,
            "message": f"Pipeline complete. {'; '.join(errors)}" if errors else "Pipeline complete.",
        }

    # ── PDF Ingestion Pipeline ─────────────────────────────────
    async def ingest_pdf(
        self,
        db: AsyncSession,
        competitor_id: int,
        file_bytes: bytes,
        filename: str,
    ) -> Dict[str, Any]:
        """
        Extract text from a PDF, then run through insights → themes pipeline.
        """
        comp = await db.get(Competitor, competitor_id)
        if not comp:
            return {"status": "error", "message": f"Competitor {competitor_id} not found"}

        # Create source record
        source = Source(
            competitor_id=competitor_id,
            url=None,
            source_type="pdf",
            status="processing",
        )
        db.add(source)
        await db.flush()

        try:
            text, stype = self.collector.extract_pdf(file_bytes, filename)
            text = self.collector.redact_pii(text)
            source.raw_content = text[:10000]
            source.status = "done"
        except Exception as e:
            source.status = "failed"
            source.error_message = str(e)[:500]
            await db.commit()
            return {
                "status": "error",
                "sources_created": 0,
                "insights_extracted": 0,
                "themes_generated": 0,
                "message": f"PDF extraction failed: {str(e)[:300]}",
            }

        await db.commit()

        chunks = self.collector.chunk_text(text)
        combined_text = "\n\n---\n\n".join(chunks[:10])

        raw_insights = await self.clusterer.extract_insights(
            [combined_text], f"pdf:{filename}", comp.name
        )

        insight_objects = []
        for raw_ins in raw_insights:
            insight = Insight(
                source_id=source.id,
                competitor_id=competitor_id,
                text=raw_ins.get("text", ""),
                sentiment=raw_ins.get("sentiment", "neutral"),
                sentiment_score=raw_ins.get("sentiment_score", 0.0),
                persona=raw_ins.get("persona", "Unknown"),
                quote=raw_ins.get("quote", ""),
                confidence=raw_ins.get("confidence", 0.5),
                source_url=None,
            )
            db.add(insight)
            insight_objects.append(insight)

        await db.flush()

        raw_themes = await self.clusterer.cluster_into_themes(raw_insights, comp.name)
        themes_created = 0
        for raw_theme in raw_themes:
            theme = Theme(
                competitor_id=competitor_id,
                name=raw_theme.get("name", "Unnamed Theme"),
                description=raw_theme.get("description", ""),
                sentiment=raw_theme.get("sentiment", "neutral"),
                severity_score=raw_theme.get("severity_score", 0.0),
                frequency=raw_theme.get("frequency", 1),
                recency_days=raw_theme.get("recency_days", 0),
                is_weakness=raw_theme.get("is_weakness", False),
                differentiation_move=raw_theme.get("differentiation_move", ""),
            )
            db.add(theme)
            await db.flush()
            indices = raw_theme.get("insight_indices", [])
            for idx in indices:
                if 0 <= idx < len(insight_objects):
                    link = ThemeInsight(theme_id=theme.id, insight_id=insight_objects[idx].id)
                    db.add(link)
            themes_created += 1

        await db.commit()

        return {
            "status": "success",
            "sources_created": 1,
            "insights_extracted": len(insight_objects),
            "themes_generated": themes_created,
            "message": f"PDF '{filename}' processed ({len(text)} chars, {len(chunks)} chunks).",
        }

    # ── Internet Research Pipeline ────────────────────────────
    async def research_and_ingest(
        self,
        db: AsyncSession,
        competitor_id: int,
    ) -> Dict[str, Any]:
        """
        Auto-research a competitor: search the web, fetch top results,
        extract insights, cluster into themes.
        """
        comp = await db.get(Competitor, competitor_id)
        if not comp:
            return {"status": "error", "message": f"Competitor {competitor_id} not found"}

        # Step 1: Search the internet
        try:
            search_results = await self.collector.research_competitor(
                comp.name, comp.sector or ""
            )
        except Exception as e:
            return {
                "status": "error",
                "sources_created": 0,
                "insights_extracted": 0,
                "themes_generated": 0,
                "message": f"Web research failed: {str(e)[:300]}",
            }

        if not search_results:
            return {
                "status": "warning",
                "sources_created": 0,
                "insights_extracted": 0,
                "themes_generated": 0,
                "message": "No search results found for this competitor.",
            }

        # Step 2: Fetch top results
        fetched = await self.collector.fetch_research_results(search_results, max_fetch=5)

        all_chunks = []
        sources_created = 0
        errors = []

        for text, stype, url in fetched:
            source = Source(
                competitor_id=competitor_id,
                url=url,
                source_type=f"research_{stype}",
                status="processing",
            )
            db.add(source)
            await db.flush()

            try:
                text = self.collector.redact_pii(text)
                source.raw_content = text[:10000]
                source.status = "done"
                chunks = self.collector.chunk_text(text)
                all_chunks.extend([(chunk, url, source.id) for chunk in chunks])
                sources_created += 1
            except Exception as e:
                source.status = "failed"
                source.error_message = str(e)[:500]
                errors.append(f"{url}: {str(e)[:100]}")

        # Also include search snippets as lightweight sources
        snippet_texts = []
        for r in search_results:
            if r.get("snippet"):
                snippet_texts.append(f"[{r.get('title', '')}] ({r['url']}): {r['snippet']}")

        if snippet_texts:
            snippet_source = Source(
                competitor_id=competitor_id,
                source_type="research_snippets",
                status="done",
                raw_content="\n\n".join(snippet_texts)[:10000],
            )
            db.add(snippet_source)
            await db.flush()
            combined_snippets = "\n\n".join(snippet_texts)
            all_chunks.append((combined_snippets, "search_snippets", snippet_source.id))
            sources_created += 1

        await db.commit()

        if not all_chunks:
            return {
                "status": "error" if errors else "warning",
                "sources_created": sources_created,
                "insights_extracted": 0,
                "themes_generated": 0,
                "message": "; ".join(errors) if errors else "Could not fetch any research results.",
            }

        # Step 3: Extract insights
        chunk_texts = [c[0] for c in all_chunks]
        source_ids = [c[2] for c in all_chunks]
        combined_text = "\n\n---\n\n".join(chunk_texts[:10])

        raw_insights = await self.clusterer.extract_insights(
            [combined_text], "internet_research", comp.name
        )

        insight_objects = []
        for raw_ins in raw_insights:
            insight = Insight(
                source_id=source_ids[0],
                competitor_id=competitor_id,
                text=raw_ins.get("text", ""),
                sentiment=raw_ins.get("sentiment", "neutral"),
                sentiment_score=raw_ins.get("sentiment_score", 0.0),
                persona=raw_ins.get("persona", "Unknown"),
                quote=raw_ins.get("quote", ""),
                confidence=raw_ins.get("confidence", 0.5),
                source_url="internet_research",
            )
            db.add(insight)
            insight_objects.append(insight)

        await db.flush()

        # Step 4: Cluster into themes
        raw_themes = await self.clusterer.cluster_into_themes(raw_insights, comp.name)
        themes_created = 0
        for raw_theme in raw_themes:
            theme = Theme(
                competitor_id=competitor_id,
                name=raw_theme.get("name", "Unnamed Theme"),
                description=raw_theme.get("description", ""),
                sentiment=raw_theme.get("sentiment", "neutral"),
                severity_score=raw_theme.get("severity_score", 0.0),
                frequency=raw_theme.get("frequency", 1),
                recency_days=raw_theme.get("recency_days", 0),
                is_weakness=raw_theme.get("is_weakness", False),
                differentiation_move=raw_theme.get("differentiation_move", ""),
            )
            db.add(theme)
            await db.flush()
            indices = raw_theme.get("insight_indices", [])
            for idx in indices:
                if 0 <= idx < len(insight_objects):
                    link = ThemeInsight(theme_id=theme.id, insight_id=insight_objects[idx].id)
                    db.add(link)
            themes_created += 1

        await db.commit()

        search_count = len(search_results)
        return {
            "status": "success",
            "sources_created": sources_created,
            "insights_extracted": len(insight_objects),
            "themes_generated": themes_created,
            "message": (
                f"Researched '{comp.name}': {search_count} search results found, "
                f"{sources_created} sources fetched, "
                f"{len(insight_objects)} insights extracted."
                + (f" Errors: {'; '.join(errors)}" if errors else "")
            ),
        }

    # ── Action + Artifact Generation ─────────────────────────
    async def create_action_with_artifact(
        self,
        db: AsyncSession,
        theme_id: int,
        competitor_id: int,
        action_type: str,
        title: Optional[str] = None,
        owner: Optional[str] = None,
        due_date: Optional[str] = None,
    ) -> Optional[ActionItem]:
        """Create an action and generate its artifact."""
        # Load theme with insights
        theme_result = await db.execute(
            select(Theme)
            .options(selectinload(Theme.insight_links).selectinload(ThemeInsight.insight))
            .where(Theme.id == theme_id)
        )
        theme = theme_result.scalar_one_or_none()
        if not theme:
            return None

        # Build theme dict and insights list
        theme_dict = {
            "name": theme.name,
            "description": theme.description,
            "sentiment": theme.sentiment,
            "severity_score": theme.severity_score,
            "frequency": theme.frequency,
            "is_weakness": theme.is_weakness,
        }

        insights_list = []
        for link in theme.insight_links:
            ins = link.insight
            insights_list.append({
                "text": ins.text,
                "sentiment": ins.sentiment,
                "sentiment_score": ins.sentiment_score,
                "persona": ins.persona,
                "quote": ins.quote,
                "confidence": ins.confidence,
                "source_url": ins.source_url,
                "source_date": ins.source_date,
            })

        # Get competitor name
        comp = await db.get(Competitor, competitor_id)
        comp_name = comp.name if comp else "Unknown"

        # Auto-generate title if not provided
        if not title:
            type_labels = {
                "battlecard": "Battlecard Update",
                "messaging": "Messaging Draft",
                "roadmap": "Roadmap Ticket",
                "ignore": "Ignored",
            }
            title = f"{type_labels.get(action_type, action_type)}: {theme.name}"

        # Create action
        action = ActionItem(
            theme_id=theme_id,
            competitor_id=competitor_id,
            action_type=action_type,
            title=title,
            owner=owner,
            due_date=due_date,
            status="pending" if action_type != "ignore" else "done",
        )
        db.add(action)
        await db.flush()

        if action_type == "ignore":
            await db.commit()
            return action

        # Generate artifact
        artifact_result = await self.writer.generate_artifact(
            action_type, theme_dict, insights_list, comp_name
        )

        artifact = Artifact(
            action_id=action.id,
            content=artifact_result["content"],
            artifact_type=action_type,
            citations=artifact_result["citations"],
        )
        db.add(artifact)
        await db.flush()

        # Evaluate artifact
        eval_result = await self.evaluator.evaluate_artifact(
            artifact.content,
            action_type,
            theme_dict,
            insights_list,
            artifact_result["citations"],
        )

        evaluation = EvaluationScore(
            artifact_id=artifact.id,
            relevance=eval_result["relevance"],
            evidence_coverage=eval_result["evidence_coverage"],
            hallucination_risk=eval_result["hallucination_risk"],
            actionability=eval_result["actionability"],
            freshness=eval_result["freshness"],
            overall_score=eval_result["overall_score"],
            flagged=eval_result["flagged"],
            flag_reason=eval_result.get("flag_reason"),
        )
        db.add(evaluation)

        # If flagged, update action status
        if eval_result["flagged"]:
            action.status = "flagged"

        await db.commit()
        return action

    # ── Report Generation ────────────────────────────────────
    async def generate_report(
        self, db: AsyncSession, competitor_id: int
    ) -> Optional[str]:
        """Generate a competitive snapshot report for a competitor."""
        comp = await db.get(Competitor, competitor_id)
        if not comp:
            return None

        # Load themes
        themes_result = await db.execute(
            select(Theme).where(Theme.competitor_id == competitor_id)
        )
        themes = themes_result.scalars().all()

        # Load insights
        insights_result = await db.execute(
            select(Insight).where(Insight.competitor_id == competitor_id)
        )
        insights = insights_result.scalars().all()

        themes_list = [
            {
                "name": t.name,
                "description": t.description,
                "sentiment": t.sentiment,
                "severity_score": t.severity_score,
                "frequency": t.frequency,
                "is_weakness": t.is_weakness,
                "differentiation_move": t.differentiation_move,
            }
            for t in themes
        ]

        insights_list = [
            {
                "text": i.text,
                "sentiment": i.sentiment,
                "sentiment_score": i.sentiment_score,
                "persona": i.persona,
                "quote": i.quote,
                "confidence": i.confidence,
            }
            for i in insights
        ]

        report_content = await self.writer.generate_snapshot_report(
            comp.name, themes_list, insights_list
        )
        return report_content
