from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ── Competitors ──────────────────────────────────────────────
class CompetitorCreate(BaseModel):
    name: str
    url: Optional[str] = None
    sector: Optional[str] = None
    description: Optional[str] = None

class CompetitorOut(BaseModel):
    id: int
    name: str
    url: Optional[str]
    sector: Optional[str]
    description: Optional[str]
    created_at: datetime
    source_count: int = 0
    theme_count: int = 0
    action_count: int = 0

    class Config:
        from_attributes = True


# ── Sources ──────────────────────────────────────────────────
class SourceCreate(BaseModel):
    competitor_id: int
    url: Optional[str] = None
    source_type: str = "manual"  # reddit, g2, forum, blog, pricing, manual
    raw_content: Optional[str] = None

class SourceOut(BaseModel):
    id: int
    competitor_id: int
    url: Optional[str]
    source_type: str
    status: str
    error_message: Optional[str]
    raw_content: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Insights ─────────────────────────────────────────────────
class InsightOut(BaseModel):
    id: int
    source_id: int
    competitor_id: int
    text: str
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    persona: Optional[str]
    quote: Optional[str]
    confidence: float
    source_url: Optional[str]
    source_date: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Themes ───────────────────────────────────────────────────
class ThemeOut(BaseModel):
    id: int
    competitor_id: int
    name: str
    description: Optional[str]
    sentiment: Optional[str]
    severity_score: float
    frequency: int
    recency_days: int
    is_weakness: bool
    differentiation_move: Optional[str]
    created_at: datetime
    insight_count: int = 0
    insights: List[InsightOut] = []

    class Config:
        from_attributes = True


# ── Actions ──────────────────────────────────────────────────
class ActionCreate(BaseModel):
    theme_id: int
    competitor_id: int
    action_type: str  # battlecard, messaging, roadmap, ignore
    title: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None

class ActionUpdate(BaseModel):
    status: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
    title: Optional[str] = None

class ActionOut(BaseModel):
    id: int
    theme_id: Optional[int]
    competitor_id: int
    action_type: str
    title: Optional[str]
    owner: Optional[str]
    due_date: Optional[str]
    status: str
    created_at: datetime
    artifact: Optional["ArtifactOut"] = None
    theme: Optional[ThemeOut] = None

    class Config:
        from_attributes = True


# ── Artifacts ────────────────────────────────────────────────
class ArtifactOut(BaseModel):
    id: int
    action_id: int
    content: str
    artifact_type: str
    citations: Optional[str]
    accepted: bool
    created_at: datetime
    evaluation: Optional["EvaluationOut"] = None

    class Config:
        from_attributes = True

class ArtifactAccept(BaseModel):
    accepted: bool


# ── Evaluation ───────────────────────────────────────────────
class EvaluationOut(BaseModel):
    id: int
    artifact_id: int
    relevance: float
    evidence_coverage: float
    hallucination_risk: float
    actionability: float
    freshness: float
    overall_score: float
    flagged: bool
    flag_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Reports ──────────────────────────────────────────────────
class ReportCreate(BaseModel):
    competitor_id: int
    report_type: str = "snapshot"

class ReportOut(BaseModel):
    id: int
    competitor_id: int
    report_type: str
    title: Optional[str]
    content: str  # JSON string
    created_at: datetime

    class Config:
        from_attributes = True


# ── Monitoring ───────────────────────────────────────────────
class MonitoringSummary(BaseModel):
    total_artifacts: int = 0
    avg_relevance: float = 0.0
    avg_evidence_coverage: float = 0.0
    avg_hallucination_risk: float = 0.0
    avg_actionability: float = 0.0
    avg_freshness: float = 0.0
    avg_overall: float = 0.0
    flagged_count: int = 0
    accepted_count: int = 0
    pending_review: int = 0
    evaluations: List[EvaluationOut] = []


# ── Pipeline ─────────────────────────────────────────────────
class IngestRequest(BaseModel):
    competitor_id: int
    urls: List[str] = []
    raw_texts: List[str] = []
    source_type: str = "manual"

class IngestResponse(BaseModel):
    status: str
    sources_created: int = 0
    insights_extracted: int = 0
    themes_generated: int = 0
    message: str = ""


# Fix forward refs
ActionOut.model_rebuild()
ArtifactOut.model_rebuild()
