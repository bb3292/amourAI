import os
from dotenv import load_dotenv

# Load .env from parent dir (local dev) or current dir (production)
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, '..', '.env'))
load_dotenv(os.path.join(_here, '.env'))  # fallback for production

# ── Core API Keys ──────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
BLAXEL_API_KEY = os.getenv("BLAXEL_API_KEY", "")
BLAXEL_WORKSPACE = os.getenv("BLAXEL_WORKSPACE", "")
WHITECIRCLE_API_KEY = os.getenv("WHITECIRCLE_API_KEY", "")

# ── Database ───────────────────────────────────────────────
_DB_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_DB_DIR, "dlcrc.db")
DATABASE_URL = f"sqlite+aiosqlite:///{_DB_PATH}"
SYNC_DATABASE_URL = f"sqlite:///{_DB_PATH}"
BACKEND_PORT = int(os.getenv("PORT", os.getenv("BACKEND_PORT", "8000")))

# ── Anthropic model config ─────────────────────────────────
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
BLAXEL_MODEL_NAME = os.getenv("BLAXEL_MODEL_NAME", "claude-sonnet")  # Model name on Blaxel
MAX_TOKENS = 4096

# ── Evaluation thresholds (White Circle rubrics) ───────────
EVAL_THRESHOLDS = {
    "relevance": 0.6,
    "evidence_coverage": 0.5,
    "hallucination_risk": 0.4,
    "actionability": 0.5,
    "freshness": 0.4,
}

# ── White Circle API config ────────────────────────────────
WHITECIRCLE_BASE_URL = os.getenv("WHITECIRCLE_BASE_URL", "https://api.whitecircle.ai/v1")

# ── Feature flags: which integrations are active ───────────
USE_BLAXEL = bool(BLAXEL_API_KEY and BLAXEL_WORKSPACE)
USE_WHITECIRCLE = bool(WHITECIRCLE_API_KEY)
