"""
DL-CRC Backend – Decision-Linked Competitive Research Copilot
FastAPI server with agent pipeline, evaluation, and full CRUD.

Tech Stack:
  - Blaxel: Agent orchestration & model gateway (if configured)
  - Anthropic: LLM provider (Claude) for all agent logic
  - White Circle AI: Quality monitoring & evaluation (if configured)
  - Lovable: Frontend UI framework
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import (
    BACKEND_PORT,
    ANTHROPIC_API_KEY,
    USE_BLAXEL,
    USE_WHITECIRCLE,
    BLAXEL_WORKSPACE,
)
from database import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Initializing database...")
    await init_db()

    # ── Report integration status ──────────────────────────
    if not ANTHROPIC_API_KEY:
        logger.error(
            "ANTHROPIC_API_KEY is not set! "
            "Add it to .env — the app cannot function without it."
        )
    else:
        logger.info("Anthropic API key configured")

    if USE_BLAXEL:
        logger.info(f"Blaxel integration ACTIVE (workspace: {BLAXEL_WORKSPACE})")
        logger.info("  → LLM calls routed through Blaxel model gateway")
    else:
        logger.info("Blaxel integration not configured — using direct Anthropic")

    if USE_WHITECIRCLE:
        logger.info("White Circle AI integration ACTIVE")
        logger.info("  → Artifact evaluation via White Circle guardrails")
    else:
        logger.info("White Circle AI not configured — using built-in LLM-as-judge")

    logger.info("DL-CRC backend ready")
    yield
    logger.info("DL-CRC backend shutting down")


app = FastAPI(
    title="DL-CRC API",
    description="Decision-Linked Competitive Research Copilot",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
from routes.competitors import router as competitors_router
from routes.sources import router as sources_router
from routes.themes import router as themes_router
from routes.actions import router as actions_router
from routes.reports import router as reports_router
from routes.monitoring import router as monitoring_router

app.include_router(competitors_router)
app.include_router(sources_router)
app.include_router(themes_router)
app.include_router(actions_router)
app.include_router(reports_router)
app.include_router(monitoring_router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "mode": "live" if ANTHROPIC_API_KEY else "no_api_key",
        "version": "1.0.0",
        "integrations": {
            "blaxel": USE_BLAXEL,
            "anthropic": bool(ANTHROPIC_API_KEY),
            "whitecircle": USE_WHITECIRCLE,
            "lovable": True,  # Frontend UI framework
        },
    }


@app.get("/api/config")
async def get_config():
    return {
        "mode": "live" if ANTHROPIC_API_KEY else "no_api_key",
        "has_api_key": bool(ANTHROPIC_API_KEY),
        "integrations": {
            "blaxel": USE_BLAXEL,
            "anthropic": bool(ANTHROPIC_API_KEY),
            "whitecircle": USE_WHITECIRCLE,
            "lovable": True,
        },
    }


# ── Serve frontend static build (production) ──────────────────
# In production, the frontend is pre-built into ../frontend/dist.
# FastAPI serves it as a SPA with a catch-all fallback.
# This MUST be registered last so /api/* routes take priority.
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIR.is_dir():
    from fastapi.responses import FileResponse

    # Serve Vite-hashed assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{catch_all:path}")
    async def spa_fallback(catch_all: str):
        """Serve index.html for all non-API routes (SPA client-side routing)."""
        file = _FRONTEND_DIR / catch_all
        if catch_all and file.is_file():
            return FileResponse(file)
        return FileResponse(_FRONTEND_DIR / "index.html")

    logger.info(f"Serving frontend from {_FRONTEND_DIR}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
