from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from database import get_db
from models import EvaluationScore, Artifact, ActionItem
from schemas import MonitoringSummary, EvaluationOut

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("", response_model=MonitoringSummary)
async def get_monitoring_summary(db: AsyncSession = Depends(get_db)):
    """Get aggregate quality metrics across all artifacts."""
    # Count totals
    total = (await db.execute(select(func.count(Artifact.id)))).scalar() or 0
    accepted = (await db.execute(
        select(func.count(Artifact.id)).where(Artifact.accepted == True)
    )).scalar() or 0

    # Averages from evaluation scores
    avg_result = await db.execute(
        select(
            func.avg(EvaluationScore.relevance),
            func.avg(EvaluationScore.evidence_coverage),
            func.avg(EvaluationScore.hallucination_risk),
            func.avg(EvaluationScore.actionability),
            func.avg(EvaluationScore.freshness),
            func.avg(EvaluationScore.overall_score),
            func.count(EvaluationScore.id),
        )
    )
    row = avg_result.one()

    flagged = (await db.execute(
        select(func.count(EvaluationScore.id)).where(EvaluationScore.flagged == True)
    )).scalar() or 0

    # Pending review = flagged but not accepted
    pending = (await db.execute(
        select(func.count(EvaluationScore.id))
        .join(Artifact)
        .where(EvaluationScore.flagged == True, Artifact.accepted == False)
    )).scalar() or 0

    # Get all evaluations for detail view
    eval_result = await db.execute(
        select(EvaluationScore).order_by(EvaluationScore.created_at.desc()).limit(50)
    )
    evaluations = eval_result.scalars().all()

    eval_list = [
        EvaluationOut(
            id=e.id, artifact_id=e.artifact_id,
            relevance=e.relevance, evidence_coverage=e.evidence_coverage,
            hallucination_risk=e.hallucination_risk, actionability=e.actionability,
            freshness=e.freshness, overall_score=e.overall_score,
            flagged=e.flagged, flag_reason=e.flag_reason,
            created_at=e.created_at,
        )
        for e in evaluations
    ]

    return MonitoringSummary(
        total_artifacts=total,
        avg_relevance=round(row[0] or 0, 3),
        avg_evidence_coverage=round(row[1] or 0, 3),
        avg_hallucination_risk=round(row[2] or 0, 3),
        avg_actionability=round(row[3] or 0, 3),
        avg_freshness=round(row[4] or 0, 3),
        avg_overall=round(row[5] or 0, 3),
        flagged_count=flagged,
        accepted_count=accepted,
        pending_review=pending,
        evaluations=eval_list,
    )
