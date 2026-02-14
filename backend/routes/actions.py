from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import ActionItem, Artifact, EvaluationScore, Theme, ThemeInsight, Insight
from schemas import (
    ActionCreate, ActionUpdate, ActionOut, ArtifactOut,
    ArtifactAccept, EvaluationOut, ThemeOut, InsightOut,
)
from agents.orchestrator import Orchestrator

router = APIRouter(prefix="/api/actions", tags=["actions"])
orchestrator = Orchestrator()


def _build_action_out(action: ActionItem) -> ActionOut:
    """Build ActionOut from ORM object with loaded relationships."""
    artifact_out = None
    if action.artifact:
        eval_out = None
        if action.artifact.evaluation:
            ev = action.artifact.evaluation
            eval_out = EvaluationOut(
                id=ev.id, artifact_id=ev.artifact_id,
                relevance=ev.relevance, evidence_coverage=ev.evidence_coverage,
                hallucination_risk=ev.hallucination_risk, actionability=ev.actionability,
                freshness=ev.freshness, overall_score=ev.overall_score,
                flagged=ev.flagged, flag_reason=ev.flag_reason,
                created_at=ev.created_at,
            )
        artifact_out = ArtifactOut(
            id=action.artifact.id, action_id=action.artifact.action_id,
            content=action.artifact.content, artifact_type=action.artifact.artifact_type,
            citations=action.artifact.citations, accepted=action.artifact.accepted,
            created_at=action.artifact.created_at, evaluation=eval_out,
        )

    theme_out = None
    if action.theme:
        theme_out = ThemeOut(
            id=action.theme.id, competitor_id=action.theme.competitor_id,
            name=action.theme.name, description=action.theme.description,
            sentiment=action.theme.sentiment, severity_score=action.theme.severity_score,
            frequency=action.theme.frequency, recency_days=action.theme.recency_days,
            is_weakness=action.theme.is_weakness,
            differentiation_move=action.theme.differentiation_move,
            created_at=action.theme.created_at,
        )

    return ActionOut(
        id=action.id, theme_id=action.theme_id, competitor_id=action.competitor_id,
        action_type=action.action_type, title=action.title, owner=action.owner,
        due_date=action.due_date, status=action.status, created_at=action.created_at,
        artifact=artifact_out, theme=theme_out,
    )


@router.get("", response_model=List[ActionOut])
async def list_actions(
    competitor_id: int = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ActionItem)
        .options(
            selectinload(ActionItem.artifact).selectinload(Artifact.evaluation),
            selectinload(ActionItem.theme),
        )
        .order_by(ActionItem.created_at.desc())
    )
    if competitor_id:
        query = query.where(ActionItem.competitor_id == competitor_id)
    if status:
        query = query.where(ActionItem.status == status)

    result = await db.execute(query)
    actions = result.scalars().unique().all()
    return [_build_action_out(a) for a in actions]


@router.post("", response_model=ActionOut)
async def create_action(data: ActionCreate, db: AsyncSession = Depends(get_db)):
    """Create action and auto-generate artifact + evaluation."""
    action = await orchestrator.create_action_with_artifact(
        db=db,
        theme_id=data.theme_id,
        competitor_id=data.competitor_id,
        action_type=data.action_type,
        title=data.title,
        owner=data.owner,
        due_date=data.due_date,
    )
    if not action:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Reload with relationships
    result = await db.execute(
        select(ActionItem)
        .options(
            selectinload(ActionItem.artifact).selectinload(Artifact.evaluation),
            selectinload(ActionItem.theme),
        )
        .where(ActionItem.id == action.id)
    )
    action = result.scalar_one()
    return _build_action_out(action)


@router.patch("/{action_id}", response_model=ActionOut)
async def update_action(
    action_id: int, data: ActionUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ActionItem)
        .options(
            selectinload(ActionItem.artifact).selectinload(Artifact.evaluation),
            selectinload(ActionItem.theme),
        )
        .where(ActionItem.id == action_id)
    )
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    if data.status is not None:
        action.status = data.status
    if data.owner is not None:
        action.owner = data.owner
    if data.due_date is not None:
        action.due_date = data.due_date
    if data.title is not None:
        action.title = data.title

    await db.commit()
    await db.refresh(action)

    # Reload with relationships
    result = await db.execute(
        select(ActionItem)
        .options(
            selectinload(ActionItem.artifact).selectinload(Artifact.evaluation),
            selectinload(ActionItem.theme),
        )
        .where(ActionItem.id == action.id)
    )
    action = result.scalar_one()
    return _build_action_out(action)


@router.post("/{action_id}/artifact/accept")
async def accept_artifact(
    action_id: int, data: ArtifactAccept, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ActionItem)
        .options(selectinload(ActionItem.artifact))
        .where(ActionItem.id == action_id)
    )
    action = result.scalar_one_or_none()
    if not action or not action.artifact:
        raise HTTPException(status_code=404, detail="Action or artifact not found")

    action.artifact.accepted = data.accepted
    if data.accepted:
        action.status = "done"
    await db.commit()
    return {"status": "accepted" if data.accepted else "rejected", "action_id": action_id}


@router.delete("/{action_id}")
async def delete_action(action_id: int, db: AsyncSession = Depends(get_db)):
    action = await db.get(ActionItem, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    await db.delete(action)
    await db.commit()
    return {"status": "deleted", "id": action_id}
