# Project Handover Summary — Jene-FinDash

Financial metrics dashboard: React + TypeScript frontend and FastAPI backend, orchestrated with Docker Compose. Data is **mock-generated in-process** (seeded RNG); there is **no database**.

---

## Repository layout

```text
Jene-FinDash/
├── backend/          # FastAPI + uvicorn + debugpy
├── frontend/         # Vite + React 19 + TypeScript + Tailwind 4
├── docker-compose.yml
├── README.md / README.es.md
└── AGENTS.md         # Points agents at .agents/rules, .agents/skills, memory-bank
```

`.agents/rules`, `.agents/skills`, and `memory-bank` are referenced in `AGENTS.md` / README but are **not present** in this checkout.

---

## Backend (`/backend`)

### Entry point

| File | Role |
|------|------|
| `backend/app/main.py` | Creates `FastAPI(title="Financial Metrics API")`, adds CORS (`allow_origins=["*"]`), mounts the router |
| `backend/app/routes.py` | All route handlers, Pydantic models, and mock-data logic |
| `backend/app/__init__.py` | Package marker only |

Uvicorn target (from `Dockerfile`): `app.main:app` on `0.0.0.0:8000`, with **debugpy** listening on `5678` and `--reload`.

Dependencies (`requirements.txt`): `fastapi`, `uvicorn[standard]`, `debugpy`, `pytest`, `pytest-cov`, `httpx`.

### Models (Pydantic, in `routes.py`)

| Model | Fields |
|-------|--------|
| `FinancialMovement` | `create_date`, `amount`, `operation_type`, `category`, `business_type` |
| `MetricsFacets` | `operation_types`, `business_types`, `categories`, `min_date`, `max_date` |
| `MetricsSummaryItem` | `period`, `income`, `outcome`, `net` |
| `TopCategoryItem` | `category`, `operation_type`, `total_amount` |
| `MetricsComparison` | `current_period`, `previous_period`, `delta_abs`, `delta_pct` |
| `MetricsAlert` | `period`, `outcome_total`, `baseline_average`, `increase_ratio` |

Literals: `OperationType` (`income` \| `outcome`), `Category` (`suppliers` \| `sales` \| `operational` \| `administrative` \| `others`), `BusinessType` (`B2B` \| `B2C`), `GroupBy` (`day` \| `week` \| `month`).

### Data source

`generate_mock_movements(seed=42)` builds **360 movements** (12 months × 30), sorted by date. Every metrics endpoint regenerates from that same seed, then filters/aggregates. No persistence layer.

### API surface

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | `{"status": "ok"}` |
| `GET` | `/api/metrics` | Filtered movement list |
| `GET` | `/api/metrics/facets` | Distinct filter values + date range |
| `GET` | `/api/metrics/summary` | Aggregated income/outcome/net by day/week/month |
| `GET` | `/api/metrics/categories/top` | Top categories by amount |
| `GET` | `/api/metrics/comparison` | Net for range vs prior equal-length period |
| `GET` | `/api/metrics/alerts` | Outcome spikes vs rolling historical baseline |
| `GET` | `/api/metrics/b2b` | B2B-only movements |
| `GET` | `/api/metrics/b2c` | B2C-only movements |

Common query params where applicable: `start_date`, `end_date`, `category`, `operation_type`, `business_type`, `group_by`, `threshold`, `limit`.

### Tests

`backend/tests/test_routes.py` covers health, date/category/operation filters, B2B/B2C, facets, summary, top categories, comparison, and alerts via `TestClient(app)`.

---

## Frontend (`/frontend`)

### Stack

- **React 19** + **TypeScript**, bootstrapped via Vite 8
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Recharts** for charts
- **shadcn/ui-style** primitives (`components.json` → new-york / zinc; `Card`, `Skeleton`)
- Path alias `@` → `./src` (Vite + tsconfig)

### Architecture / routing

**Single-page app — no React Router.**  
`main.tsx` mounts `<App />` into `#root`. All UI lives in `App.tsx`.

### Component tree

```text
App
├── DashboardHeader          # Title + period badge
├── KPIRow                   # 4 KPICards
│   └── KPICard × 4
├── IncomeOutcomeChart       # Recharts dual line (income/outcome)
└── ProfitPercentChart       # Recharts profit % line
```

UI primitives: `components/ui/card.tsx`, `components/ui/skeleton.tsx`.

### State management

**Local React state only** — no Redux/Zustand/Context in application code:

```ts
metrics: KPIMetrics | null
monthlyData: MonthlyDataPoint[]
loading: boolean
error: string | null
```

On mount, `useEffect` calls `GET ${VITE_API_BASE_URL ?? ""}/api/metrics`, then:

1. `computeKPIs(movements)` → KPI cards  
2. `computeMonthlyData(movements)` → charts  

Aggregation happens **on the client**; backend summary/facets/alerts endpoints are **not consumed** by the current UI.

### Lib layer

| File | Role |
|------|------|
| `lib/financial-types.ts` | Shared TS types mirroring API shapes |
| `lib/financial-utils.ts` | `computeKPIs`, `computeMonthlyData`, currency/percent formatters |
| `lib/financial-utils.test.ts` | Vitest coverage for utils |
| `lib/mock-data.ts` | Static 2024 sample movements — **exported but unused by `App.tsx`** |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) |

### Scripts (`package.json`)

`dev`, `build` (`tsc -b && vite build`), `lint`, `preview`, `test` / `test:watch` / `test:coverage` (Vitest).

---

## Integration

### Vite `/api` proxy

In `frontend/vite.config.ts`:

```ts
proxy: {
  "/api": {
    target: "http://backend:8000",
    changeOrigin: true,
  },
}
```

With default `VITE_API_BASE_URL` empty (see `.env.example`), the browser requests `/api/metrics` on the Vite host; Vite forwards to the Docker service hostname `backend:8000`. Optional override: set `VITE_API_BASE_URL` to call another origin directly.

CORS on the backend allows all origins, so direct browser→`:8000` calls also work.

### Docker Compose

```yaml
frontend  # build ./frontend, ports 5173:5173, volume-mounted, depends_on: backend
backend   # build ./backend, ports 8000:8000 and 5678:5678, volume-mounted
```

| Service | Image base | Runtime command |
|---------|------------|-----------------|
| frontend | `node:24-alpine` | `npm run dev -- --host 0.0.0.0 --port 5173` |
| backend | `python:3.13-slim` | `debugpy` + `uvicorn app.main:app --reload` |

`frontend` depends on `backend` start order only (no healthcheck). Host volumes sync local code; anonymous `/app/node_modules` volume preserves container deps.

### Local URLs (from README)

| Surface | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |

Run: `docker compose up --build`.

---

## Handover notes (evidence-based)

1. **UI ↔ API gap**: Frontend uses only `/api/metrics`. Facets, summary, top categories, comparison, alerts, and B2B/B2C routes exist and are tested but unused by the React app.
2. **No DB / auth**: Mock seed data only; CORS wide open; no auth middleware.
3. **Agent scaffolding expected**: README/`AGENTS.md` describe documenting rules and a memory bank under `.agents/` — those directories are empty/missing here.
4. **Dead frontend mock**: `mock-data.ts` is available for offline/dev use but is not wired into `App.tsx`.
