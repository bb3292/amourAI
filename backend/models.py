import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Table, Boolean
)
from sqlalchemy.orm import relationship
from database import Base


class Competitor(Base):
    __tablename__ = "competitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=True)
    sector = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    sources = relationship("Source", back_populates="competitor", cascade="all, delete-orphan")
    themes = relationship("Theme", back_populates="competitor", cascade="all, delete-orphan")
    actions = relationship("ActionItem", back_populates="competitor", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="competitor", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    url = Column(String(1000), nullable=True)
    source_type = Column(String(50), nullable=False)  # reddit, g2, forum, blog, pricing, manual
    status = Column(String(20), default="pending")  # pending, processing, done, failed
    raw_content = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    competitor = relationship("Competitor", back_populates="sources")
    insights = relationship("Insight", back_populates="source", cascade="all, delete-orphan")


class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    text = Column(Text, nullable=False)
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral, mixed
    sentiment_score = Column(Float, nullable=True)  # -1.0 to 1.0
    persona = Column(String(100), nullable=True)
    quote = Column(Text, nullable=True)
    confidence = Column(Float, default=0.5)
    source_url = Column(String(1000), nullable=True)
    source_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    source = relationship("Source", back_populates="insights")
    theme_links = relationship("ThemeInsight", back_populates="insight", cascade="all, delete-orphan")


class Theme(Base):
    __tablename__ = "themes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sentiment = Column(String(20), nullable=True)
    severity_score = Column(Float, default=0.0)  # 0-1
    frequency = Column(Integer, default=1)
    recency_days = Column(Integer, default=0)
    is_weakness = Column(Boolean, default=False)
    differentiation_move = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    competitor = relationship("Competitor", back_populates="themes")
    insight_links = relationship("ThemeInsight", back_populates="theme", cascade="all, delete-orphan")
    actions = relationship("ActionItem", back_populates="theme", cascade="all, delete-orphan")


class ThemeInsight(Base):
    __tablename__ = "theme_insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    theme_id = Column(Integer, ForeignKey("themes.id"), nullable=False)
    insight_id = Column(Integer, ForeignKey("insights.id"), nullable=False)

    theme = relationship("Theme", back_populates="insight_links")
    insight = relationship("Insight", back_populates="theme_links")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    theme_id = Column(Integer, ForeignKey("themes.id"), nullable=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # battlecard, messaging, roadmap, ignore
    title = Column(String(500), nullable=True)
    owner = Column(String(255), nullable=True)
    due_date = Column(String(50), nullable=True)
    status = Column(String(20), default="pending")  # pending, in_progress, done, flagged
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    theme = relationship("Theme", back_populates="actions")
    competitor = relationship("Competitor", back_populates="actions")
    artifact = relationship("Artifact", back_populates="action", uselist=False, cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action_id = Column(Integer, ForeignKey("action_items.id"), nullable=False)
    content = Column(Text, nullable=False)
    artifact_type = Column(String(50), nullable=False)  # battlecard, messaging, roadmap_ticket
    citations = Column(Text, nullable=True)  # JSON string of citations
    accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    action = relationship("ActionItem", back_populates="artifact")
    evaluation = relationship("EvaluationScore", back_populates="artifact", uselist=False, cascade="all, delete-orphan")


class EvaluationScore(Base):
    __tablename__ = "evaluation_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    artifact_id = Column(Integer, ForeignKey("artifacts.id"), nullable=False)
    relevance = Column(Float, default=0.0)
    evidence_coverage = Column(Float, default=0.0)
    hallucination_risk = Column(Float, default=1.0)  # 1.0 = no risk, 0.0 = high risk
    actionability = Column(Float, default=0.0)
    freshness = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)
    flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    artifact = relationship("Artifact", back_populates="evaluation")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    report_type = Column(String(50), default="snapshot")  # snapshot, swot, weekly
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)  # JSON string of report data
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    competitor = relationship("Competitor", back_populates="reports")
