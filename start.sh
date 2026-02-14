#!/bin/bash
# RivalIQ — Competitive Research Copilot
# Start both backend and frontend servers

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  RivalIQ — Competitive Research Copilot"
echo "============================================"
echo ""

# Check for .env
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "No .env file found. Creating from .env.example..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Edit .env to add your ANTHROPIC_API_KEY for live mode."
  echo "Running in DEMO mode (mock data) for now."
  echo ""
fi

# Backend
echo "[1/2] Starting backend (FastAPI)..."
cd "$ROOT_DIR/backend"

if ! command -v uv &> /dev/null; then
  echo "Error: 'uv' not found. Install it: https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi

uv sync --quiet
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID (http://localhost:8000)"

# Wait for backend to be ready
echo "  Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "  Backend ready!"
    break
  fi
  sleep 1
done

# Frontend
echo ""
echo "[2/2] Starting frontend (Vite + React)..."
cd "$ROOT_DIR/frontend"
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID (http://localhost:5173)"

echo ""
echo "============================================"
echo "  RivalIQ is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to kill both
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
