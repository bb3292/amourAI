# ── Stage 1: Build frontend ────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + serve frontend ──────────────────
FROM python:3.12-slim
WORKDIR /app

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock* backend/
RUN cd backend && uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# Copy backend source
COPY backend/ backend/

# Copy built frontend into the expected location
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Railway injects PORT env var (default 8000)
ENV PORT=8000

EXPOSE ${PORT}

CMD ["sh", "-c", "cd backend && uv run uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
