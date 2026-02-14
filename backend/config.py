import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATABASE_URL = "sqlite+aiosqlite:///./dlcrc.db"
SYNC_DATABASE_URL = "sqlite:///./dlcrc.db"
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))

# Anthropic model config
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 4096

# Evaluation thresholds (White Circle replacement)
EVAL_THRESHOLDS = {
    "relevance": 0.6,
    "evidence_coverage": 0.5,
    "hallucination_risk": 0.4,  # Below this = flagged (inverted: lower is worse)
    "actionability": 0.5,
    "freshness": 0.4,
}
