from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from database import get_db, async_session
from models import Source
from schemas import SourceCreate, SourceOut, IngestRequest, IngestResponse, ReportCreate
from agents.orchestrator import Orchestrator

router = APIRouter(prefix="/api/sources", tags=["sources"])
orchestrator = Orchestrator()

ALLOWED_PDF_TYPES = {"application/pdf", "application/x-pdf"}
MAX_PDF_SIZE = 20 * 1024 * 1024  # 20MB


@router.get("", response_model=List[SourceOut])
async def list_sources(
    competitor_id: int = None, db: AsyncSession = Depends(get_db)
):
    query = select(Source).order_by(Source.created_at.desc())
    if competitor_id:
        query = query.where(Source.competitor_id == competitor_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{source_id}", response_model=SourceOut)
async def get_source(source_id: int, db: AsyncSession = Depends(get_db)):
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.post("/ingest", response_model=IngestResponse)
async def ingest_sources(data: IngestRequest, db: AsyncSession = Depends(get_db)):
    """Run the full ingestion pipeline: fetch → extract → cluster."""
    if not data.urls and not data.raw_texts:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one URL or raw text to ingest"
        )

    result = await orchestrator.ingest_sources(
        db=db,
        competitor_id=data.competitor_id,
        urls=data.urls,
        raw_texts=data.raw_texts,
        source_type=data.source_type,
    )

    return IngestResponse(
        status=result["status"],
        sources_created=result.get("sources_created", 0),
        insights_extracted=result.get("insights_extracted", 0),
        themes_generated=result.get("themes_generated", 0),
        message=result.get("message", ""),
    )


@router.post("/upload-pdf", response_model=IngestResponse)
async def upload_pdf(
    competitor_id: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF report and run it through the ingestion pipeline."""
    # Validate file type
    if file.content_type and file.content_type not in ALLOWED_PDF_TYPES:
        # Also accept by extension
        if not (file.filename and file.filename.lower().endswith(".pdf")):
            raise HTTPException(
                status_code=400,
                detail=f"Only PDF files are accepted. Got: {file.content_type}"
            )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes) // (1024*1024)}MB). Max is {MAX_PDF_SIZE // (1024*1024)}MB."
        )

    filename = file.filename or "upload.pdf"

    result = await orchestrator.ingest_pdf(
        db=db,
        competitor_id=competitor_id,
        file_bytes=file_bytes,
        filename=filename,
    )

    return IngestResponse(
        status=result["status"],
        sources_created=result.get("sources_created", 0),
        insights_extracted=result.get("insights_extracted", 0),
        themes_generated=result.get("themes_generated", 0),
        message=result.get("message", ""),
    )


@router.post("/research", response_model=IngestResponse)
async def research_competitor(
    data: ReportCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Auto-research a competitor on the internet: search for reviews, complaints,
    comparisons, and ingest the results through the pipeline.
    """
    result = await orchestrator.research_and_ingest(db=db, competitor_id=data.competitor_id)

    return IngestResponse(
        status=result["status"],
        sources_created=result.get("sources_created", 0),
        insights_extracted=result.get("insights_extracted", 0),
        themes_generated=result.get("themes_generated", 0),
        message=result.get("message", ""),
    )


@router.delete("/{source_id}")
async def delete_source(source_id: int, db: AsyncSession = Depends(get_db)):
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "deleted", "id": source_id}
