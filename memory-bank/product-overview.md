# Product Overview

> Source of truth: repository code and docs as of the current checkout.  
> Evidence: `README.md`, `frontend/src/App.tsx`, `backend/app/routes.py`, `docker-compose.yml`.

## What this product is

**Financial Metrics Dashboard** — a full-stack learning/demo application that shows executive-style income, outcome, and profit metrics for a year of mock financial movements.

Described in `README.md` as:

> Financial metrics dashboard with a React + TypeScript frontend and a FastAPI backend.

Origin context (from README): maintained for 4Geeks Academy AI Engineering / related programs; students are expected to fork, inspect frontend/backend with an AI agent, and document rules + memory bank in their fork.

## Problem it addresses

Operators need a single screen to understand:

- Total income vs outcome
- Net profit and profit margin
- How income and outcome evolve month over month
- How profit margin changes over time

The app solves that with a **read-only dashboard** backed by a **metrics API**. There is no user authentication, no write API, and no real database in this repository.

## Primary users / usage mode

| Audience | How they use it |
|----------|-----------------|
| Local / Codespaces developers | `docker compose up --build`, then open the frontend |
| API consumers / learners | Hit FastAPI routes or OpenAPI at `:8000/docs` |
| AI agents / contributors | Follow `AGENTS.md` → `.agents/rules` and this `memory-bank/` |

## Product surfaces

| Surface | URL (local) | Evidence |
|---------|-------------|----------|
| Dashboard UI | http://localhost:5173 | `README.md`, `frontend` Vite app |
| Metrics API | http://localhost:8000 | `backend` uvicorn |
| Interactive API docs | http://localhost:8000/docs | FastAPI auto-docs (`README.md`) |
| Debugger port | localhost:5678 | `backend/Dockerfile` exposes debugpy |

## Core domain concepts

Defined in backend Pydantic models (`backend/app/routes.py`) and mirrored in `frontend/src/lib/financial-types.ts`:

| Concept | Values / meaning |
|---------|------------------|
| `FinancialMovement` | Dated money event with `amount`, `operation_type`, `category`, `business_type` |
| `operation_type` | `income` \| `outcome` |
| `category` | `suppliers` \| `sales` \| `operational` \| `administrative` \| `others` |
| `business_type` | `B2B` \| `B2C` |
| KPI metrics (UI) | `totalIncome`, `totalOutcome`, `profit`, `profitPercent` |
| Monthly series (UI) | Per-month `income`, `outcome`, `profitPercent` |

Data is **generated in-process** via `generate_mock_movements(seed=42)` (360 movements: 12 months × 30). No persistence layer exists.

## User-visible features (what the UI actually shows)

From `frontend/src/App.tsx` composition:

1. **Header** — “Financial Overview” with a period badge (`DashboardHeader`; period currently hardcoded as `"2024 - Full Year"`).
2. **KPI row** — Total Income, Total Outcome, Profit, Profit Margin (`KPIRow` / `KPICard`).
3. **Income vs Outcome chart** — monthly dual line chart (Recharts).
4. **Profit Margin % chart** — monthly profit-percent line chart.
5. **Loading skeletons** and an **error banner** if `/api/metrics` fails.

The UI loads data with a single call: `GET /api/metrics` (via Vite `/api` proxy unless `VITE_API_BASE_URL` is set).

## Capabilities exposed by the API (product capability map)

Implemented in `backend/app/routes.py` (broader than what the UI currently consumes):

| Endpoint | Product capability |
|----------|-------------------|
| `GET /health` | Liveness check |
| `GET /api/metrics` | List/filter movements |
| `GET /api/metrics/facets` | Filter option lists + date bounds |
| `GET /api/metrics/summary` | Period aggregates (day/week/month) |
| `GET /api/metrics/categories/top` | Top categories by amount |
| `GET /api/metrics/comparison` | Current vs previous period net |
| `GET /api/metrics/alerts` | Outcome spike alerts vs baseline |
| `GET /api/metrics/b2b` | B2B-only movements |
| `GET /api/metrics/b2c` | B2C-only movements |

## Explicit non-goals (absent from the codebase)

- No authentication/authorization
- No database, ORM, or external data warehouse
- No multi-page routing / navigation
- No create/update/delete of movements
- No CI workflow files in-repo (no `.github/workflows` present in this checkout)
- No agent skills yet (`.agents/skills` not present; rules exist under `.agents/rules`)

## How to run (product delivery)

From `README.md`:

```bash
docker compose up --build
```

Default local wiring: Vite proxies `/api` → `http://backend:8000` (`frontend/vite.config.ts`), so no env vars are required for Compose/Codespaces. Optional override: `frontend/.env.example` → `VITE_API_BASE_URL`.
