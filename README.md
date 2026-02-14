# RivalIQ — Competitive Research Copilot

A full-stack competitive intelligence platform that transforms competitor research into decision-linked actions and artifacts. Paste URLs or text, get AI-powered insights, weakness analysis, battlecards, messaging drafts, roadmap tickets, and quality-monitored reports — in minutes.

## Architecture

```
Frontend (React + Vite + Tailwind)  ──▶  Backend (FastAPI + SQLite)
     localhost:5173                           localhost:8000
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              Collector      Clusterer      Writer
                              (scraping)   (Anthropic)   (Anthropic)
                                    │             │             │
                                    └─────────────┼─────────────┘
                                                  ▼
                                             Evaluator
                                          (quality scoring)
```

| Layer | Tool (per PRD) | Implementation |
|-------|---------------|----------------|
| **UI / Dashboard** | Lovable | React + Vite + Tailwind CSS |
| **Agent Orchestration** | Blaxel | FastAPI + async pipeline |
| **LLM Provider** | Anthropic | Claude API (via `anthropic` SDK) |
| **Output Monitoring** | White Circle | Evaluator agent (LLM-as-judge + thresholds) |

## Features

- **Add Competitors** — track companies with name, URL, sector
- **Ingest Sources** — paste URLs (Reddit, G2, forums, blogs) or raw text
- **AI Pipeline** — automatically extract insights, cluster into themes, score severity
- **Weakness Mapping** — identify competitor weaknesses with evidence and differentiation moves
- **Action Workflow** — classify themes into battlecard / messaging / roadmap / ignore
- **Artifact Generation** — AI-drafted battlecards, messaging copy, roadmap tickets with citations
- **Quality Monitoring** — 5-rubric evaluation (relevance, evidence, hallucination, actionability, freshness)
- **Snapshot Reports** — one-click SWOT analysis, positioning, recommended actions
- **Human Review Queue** — flagged artifacts with low confidence for manual review
- **Demo Mode** — works fully without an API key using realistic mock data

## Quick Start

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) 18+
- (Optional) Anthropic API key for live AI mode

### 1. Setup

```bash
# Clone and enter the repo
cd amourAI

# Copy env file
cp .env.example .env
# Edit .env to add your ANTHROPIC_API_KEY (optional — demo mode works without it)
```

### 2. Start Backend

```bash
cd backend
uv sync
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App

Visit **http://localhost:5173** in your browser.

### Or use the one-line start script

```bash
./start.sh
```

## Demo Flow

1. Go to **Competitors** → Add a competitor (e.g. "Acme Corp", sector "SaaS")
2. Go to **Sources** → Click "Ingest Sources" → Paste URLs or raw text → Run pipeline
3. Go to **Themes** → See clustered themes with severity scores → Click to expand for evidence
4. Click **Create Action** on a weakness → Choose "Battlecard" / "Messaging" / "Roadmap"
5. Go to **Actions** → View generated artifact with quality scores → Accept or flag
6. Go to **Reports** → Generate a competitive snapshot (SWOT, positioning, recommendations)
7. Go to **Monitoring** → See aggregate quality metrics across all artifacts

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check + mode |
| GET/POST/DELETE | `/api/competitors` | Competitor CRUD |
| GET | `/api/sources` | List sources |
| POST | `/api/sources/ingest` | Run ingestion pipeline |
| GET | `/api/themes` | List themes with insights |
| GET | `/api/themes/insights/all` | List all insights |
| GET/POST/PATCH/DELETE | `/api/actions` | Action CRUD + artifact generation |
| POST | `/api/actions/:id/artifact/accept` | Accept/reject artifact |
| GET/POST | `/api/reports` | Report generation |
| GET | `/api/monitoring` | Quality monitoring summary |

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

## Project Structure

```
amourAI/
├── backend/
│   ├── pyproject.toml        # uv project config
│   ├── main.py               # FastAPI server
│   ├── config.py             # Configuration
│   ├── database.py           # SQLite + SQLAlchemy async
│   ├── models.py             # Database models
│   ├── schemas.py            # Pydantic schemas
│   ├── agents/
│   │   ├── collector.py      # Web scraping + text parsing
│   │   ├── clusterer.py      # Insight extraction + theme clustering
│   │   ├── writer.py         # Artifact generation (battlecard/messaging/roadmap)
│   │   ├── evaluator.py      # Quality evaluation (5 rubrics)
│   │   └── orchestrator.py   # Pipeline coordination
│   └── routes/
│       ├── competitors.py
│       ├── sources.py
│       ├── themes.py
│       ├── actions.py
│       ├── reports.py
│       └── monitoring.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts     # API client
│       ├── types/index.ts    # TypeScript types
│       ├── components/       # Shared UI components
│       └── pages/            # Dashboard, Competitors, Sources, Themes, Actions, Reports, Monitoring
├── .env.example
├── start.sh
└── PRD.md
```

## Modes

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Demo** | No `ANTHROPIC_API_KEY` in .env | Uses realistic mock data for all agent outputs |
| **Live** | Valid `ANTHROPIC_API_KEY` set | Real Anthropic Claude API calls for analysis, generation, evaluation |

## Evaluation Rubrics (White Circle Replacement)

| Metric | Description | Flag Threshold |
|--------|-------------|----------------|
| Relevance | Does artifact match the theme? | < 60% |
| Evidence Coverage | Are claims cited with evidence? | < 50% |
| Hallucination Risk | Likelihood of unsupported claims (inverted: high = safe) | < 40% |
| Actionability | Does it provide concrete next steps? | < 50% |
| Freshness | Are sources recent? | < 40% |

Artifacts below any threshold are automatically flagged for human review.
