"""
DL-CRC Backend – Decision-Linked Competitive Research Copilot
FastAPI server with agent pipeline, evaluation, and full CRUD.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import BACKEND_PORT, ANTHROPIC_API_KEY
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

    if not ANTHROPIC_API_KEY:
        logger.error(
            "ANTHROPIC_API_KEY is not set! "
            "Add it to .env — the app cannot function without it."
        )
    else:
        logger.info("DL-CRC backend starting in LIVE mode (Anthropic)")
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
    }


@app.get("/api/config")
async def get_config():
    return {
        "mode": "live" if ANTHROPIC_API_KEY else "no_api_key",
        "has_api_key": bool(ANTHROPIC_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
