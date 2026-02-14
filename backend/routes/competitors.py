from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from database import get_db
from models import Competitor, Source, Theme, ActionItem
from schemas import CompetitorCreate, CompetitorOut

router = APIRouter(prefix="/api/competitors", tags=["competitors"])


@router.get("", response_model=List[CompetitorOut])
async def list_competitors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Competitor).order_by(Competitor.created_at.desc()))
    competitors = result.scalars().all()

    out = []
    for c in competitors:
        # Count related entities
        src_count = (await db.execute(
            select(func.count(Source.id)).where(Source.competitor_id == c.id)
        )).scalar() or 0
        theme_count = (await db.execute(
            select(func.count(Theme.id)).where(Theme.competitor_id == c.id)
        )).scalar() or 0
        action_count = (await db.execute(
            select(func.count(ActionItem.id)).where(ActionItem.competitor_id == c.id)
        )).scalar() or 0

        out.append(CompetitorOut(
            id=c.id, name=c.name, url=c.url, sector=c.sector,
            description=c.description, created_at=c.created_at,
            source_count=src_count, theme_count=theme_count, action_count=action_count,
        ))
    return out


@router.post("", response_model=CompetitorOut)
async def create_competitor(data: CompetitorCreate, db: AsyncSession = Depends(get_db)):
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Competitor name is required")
    comp = Competitor(
        name=data.name.strip(), url=data.url, sector=data.sector, description=data.description
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return CompetitorOut(
        id=comp.id, name=comp.name, url=comp.url, sector=comp.sector,
        description=comp.description, created_at=comp.created_at,
    )


@router.get("/{competitor_id}", response_model=CompetitorOut)
async def get_competitor(competitor_id: int, db: AsyncSession = Depends(get_db)):
    comp = await db.get(Competitor, competitor_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")

    src_count = (await db.execute(
        select(func.count(Source.id)).where(Source.competitor_id == comp.id)
    )).scalar() or 0
    theme_count = (await db.execute(
        select(func.count(Theme.id)).where(Theme.competitor_id == comp.id)
    )).scalar() or 0
    action_count = (await db.execute(
        select(func.count(ActionItem.id)).where(ActionItem.competitor_id == comp.id)
    )).scalar() or 0

    return CompetitorOut(
        id=comp.id, name=comp.name, url=comp.url, sector=comp.sector,
        description=comp.description, created_at=comp.created_at,
        source_count=src_count, theme_count=theme_count, action_count=action_count,
    )


@router.delete("/{competitor_id}")
async def delete_competitor(competitor_id: int, db: AsyncSession = Depends(get_db)):
    comp = await db.get(Competitor, competitor_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    await db.delete(comp)
    await db.commit()
    return {"status": "deleted", "id": competitor_id}
