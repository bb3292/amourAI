from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import Theme, ThemeInsight, Insight
from schemas import ThemeOut, InsightOut

router = APIRouter(prefix="/api/themes", tags=["themes"])


@router.get("", response_model=List[ThemeOut])
async def list_themes(
    competitor_id: int = None, db: AsyncSession = Depends(get_db)
):
    query = (
        select(Theme)
        .options(selectinload(Theme.insight_links).selectinload(ThemeInsight.insight))
        .order_by(Theme.severity_score.desc())
    )
    if competitor_id:
        query = query.where(Theme.competitor_id == competitor_id)

    result = await db.execute(query)
    themes = result.scalars().unique().all()

    out = []
    for t in themes:
        insights = []
        for link in t.insight_links:
            ins = link.insight
            insights.append(InsightOut(
                id=ins.id, source_id=ins.source_id, competitor_id=ins.competitor_id,
                text=ins.text, sentiment=ins.sentiment, sentiment_score=ins.sentiment_score,
                persona=ins.persona, quote=ins.quote, confidence=ins.confidence,
                source_url=ins.source_url, source_date=ins.source_date,
                created_at=ins.created_at,
            ))

        out.append(ThemeOut(
            id=t.id, competitor_id=t.competitor_id, name=t.name,
            description=t.description, sentiment=t.sentiment,
            severity_score=t.severity_score, frequency=t.frequency,
            recency_days=t.recency_days, is_weakness=t.is_weakness,
            differentiation_move=t.differentiation_move,
            created_at=t.created_at, insight_count=len(insights),
            insights=insights,
        ))
    return out


@router.get("/{theme_id}", response_model=ThemeOut)
async def get_theme(theme_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.insight_links).selectinload(ThemeInsight.insight))
        .where(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    insights = []
    for link in theme.insight_links:
        ins = link.insight
        insights.append(InsightOut(
            id=ins.id, source_id=ins.source_id, competitor_id=ins.competitor_id,
            text=ins.text, sentiment=ins.sentiment, sentiment_score=ins.sentiment_score,
            persona=ins.persona, quote=ins.quote, confidence=ins.confidence,
            source_url=ins.source_url, source_date=ins.source_date,
            created_at=ins.created_at,
        ))

    return ThemeOut(
        id=theme.id, competitor_id=theme.competitor_id, name=theme.name,
        description=theme.description, sentiment=theme.sentiment,
        severity_score=theme.severity_score, frequency=theme.frequency,
        recency_days=theme.recency_days, is_weakness=theme.is_weakness,
        differentiation_move=theme.differentiation_move,
        created_at=theme.created_at, insight_count=len(insights),
        insights=insights,
    )


@router.get("/insights/all", response_model=List[InsightOut])
async def list_insights(
    competitor_id: int = None, db: AsyncSession = Depends(get_db)
):
    query = select(Insight).order_by(Insight.created_at.desc())
    if competitor_id:
        query = query.where(Insight.competitor_id == competitor_id)
    result = await db.execute(query)
    return result.scalars().all()
