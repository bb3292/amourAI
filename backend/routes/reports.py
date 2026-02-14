from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import Report, Competitor
from schemas import ReportCreate, ReportOut
from agents.orchestrator import Orchestrator

router = APIRouter(prefix="/api/reports", tags=["reports"])
orchestrator = Orchestrator()


@router.get("", response_model=List[ReportOut])
async def list_reports(
    competitor_id: int = None, db: AsyncSession = Depends(get_db)
):
    query = select(Report).order_by(Report.created_at.desc())
    if competitor_id:
        query = query.where(Report.competitor_id == competitor_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ReportOut)
async def generate_report(data: ReportCreate, db: AsyncSession = Depends(get_db)):
    """Generate a competitive snapshot report."""
    comp = await db.get(Competitor, data.competitor_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")

    content = await orchestrator.generate_report(db, data.competitor_id)
    if content is None:
        raise HTTPException(status_code=500, detail="Failed to generate report")

    report = Report(
        competitor_id=data.competitor_id,
        report_type=data.report_type,
        title=f"{comp.name} — Competitive Snapshot",
        content=content,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.delete("/{report_id}")
async def delete_report(report_id: int, db: AsyncSession = Depends(get_db)):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.commit()
    return {"status": "deleted", "id": report_id}
