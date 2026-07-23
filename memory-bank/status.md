# Engineering Status

> Current engineering state based on code, tests, and agent scaffolding in this checkout.  
> Update this file when features land or gaps close.

## Snapshot

| Dimension | State |
|-----------|--------|
| Runnable locally | Yes — `docker compose up --build` (`README.md`) |
| Frontend dashboard MVP | Implemented (KPIs + 2 charts + loading/error) |
| Metrics API surface | Implemented (9 routes including health) |
| Persistence | Not implemented (in-memory mock only) |
| Auth / multi-tenant | Not implemented |
| Agent rules | Present (3 files under `.agents/rules`) |
| Agent skills | Missing (`.agents/skills` absent) |
| CI pipelines | Not present in this checkout |

---

## Implemented features

### Backend API (`backend/app/routes.py` + `main.py`)

| Feature | Status | Notes |
|---------|--------|-------|
| Health check `GET /health` | Done | Returns `{"status":"ok"}` |
| List/filter movements `GET /api/metrics` | Done | Filters: `start_date`, `end_date`, `category`, `operation_type` |
| Facets `GET /api/metrics/facets` | Done | Distinct types + min/max dates |
| Summary `GET /api/metrics/summary` | Done | `group_by` day/week/month; optional `business_type` |
| Top categories `GET /api/metrics/categories/top` | Done | `operation_type`, `limit` 1–20 |
| Period comparison `GET /api/metrics/comparison` | Done | Requires `start_date`/`end_date`; computes prior window |
| Outcome alerts `GET /api/metrics/alerts` | Done | Threshold vs rolling baseline |
| B2B / B2C slices | Done | `/api/metrics/b2b`, `/api/metrics/b2c` |
| CORS middleware | Done | `allow_origins=["*"]` |
| OpenAPI docs | Done | FastAPI `/docs` |
| Deterministic mock data | Done | `seed=42`, 360 movements |
| Route/unit tests | Done | `backend/tests/test_routes.py` (health, filters, facets, summary, top, comparison, alerts, B2B/B2C) |
| Debug attach | Done | debugpy `:5678` in container |

### Frontend dashboard (`frontend/src`)

| Feature | Status | Notes |
|---------|--------|-------|
| Single-page dashboard shell | Done | `App.tsx` + `main.tsx` |
| Header with period badge | Done | `dashboard-header.tsx` |
| Four KPI cards | Done | Income, Outcome, Profit, Profit Margin |
| Income vs Outcome line chart | Done | `income-outcome-chart.tsx` (Recharts) |
| Profit margin % chart | Done | `profit-percent-chart.tsx` |
| Client-side KPI/monthly aggregation | Done | `computeKPIs`, `computeMonthlyData` |
| Loading skeletons | Done | KPI + charts |
| Fetch error banner | Done | Sets error if `/api/metrics` fails |
| Vite `/api` proxy | Done | `vite.config.ts` → `backend:8000` |
| Vitest for utils | Done | `financial-utils.test.ts` |
| Tailwind + dark dashboard theme | Done | `index.css` CSS variables; `App` uses `dark` class |
| shadcn-style Card/Skeleton | Done | `components/ui/*` |

### Agent / docs scaffolding

| Item | Status |
|------|--------|
| `AGENTS.md` pointing at rules/skills/memory-bank | Done |
| `.agents/rules` (pure domain, API contracts, dashboard UI) | Done |
| `practices.md` audit + draft rules | Done |
| `summary.md` handover summary | Done |
| This `memory-bank/` | Done (this set of docs) |

---

## Known architectural and code gaps

Evidence-backed gaps (see also `practices.md` and `.agents/rules`):

### Architecture

| Gap | Evidence | Impact |
|-----|----------|--------|
| God-module backend | Models, mock gen, helpers, and all handlers in `routes.py` | Harder to navigate/extend |
| Duplicated load/filter in handlers | Repeated `generate_mock_movements(seed=42)` + inline `business_type` filters | Drift risk, noisy diffs |
| No database / real data source | Mock generator only | Demo-only fidelity |
| UI ↔ API mismatch | UI calls only `/api/metrics`; other metrics endpoints unused by React | Dead capability from product perspective |
| No React Router / multi-view | Single `App.tsx` | Fine for MVP; blocks multi-page workflows |
| No auth | Open CORS + public API | Unsafe for real deployments |
| Unpinned Python deps | `requirements.txt` has no versions | Reproducibility risk |
| No Compose healthchecks | `depends_on` only | Frontend may start before API is ready |
| No CI workflows in checkout | No `.github/workflows` | No automated gate on PRs |
| `.agents/skills` missing | README expects skills tree | Incomplete agent automation surface |

### Code quality / correctness

| Gap | Evidence | Impact |
|-----|----------|--------|
| Swallowed fetch errors | `App.tsx` `.catch(() => setError(...))` discards error object | Harder to debug failures |
| Mixed UI language | Spanish error string; English chrome | Inconsistent UX |
| Hardcoded period label | `"2024 - Full Year"` while API dates follow `date.today()` | Misleading header |
| Unused `mock-data.ts` | Exported, not imported by `App.tsx` | Dead code |
| Unvalidated JSON on client | `response.json()` typed only by TS | Runtime shape drift possible |
| Facets empty-list risk | `build_metrics_facets` uses `ordered[0]`/`[-1]` | Potential 500 if ever empty |
| No `start_date > end_date` rejection | No `HTTPException` for bad ranges | Ambiguous empty results |
| Client/server type duplication | Literals in Python and `financial-types.ts` | Manual sync required |

---

## Immediate technical priorities

Ordered for leverage against current gaps and existing rules (`.agents/rules/*`):

1. **Close the silent-failure path in `App.tsx`**  
   Keep `response.ok` checks; log/retain error detail; standardize English user-facing copy (`api-contracts-and-errors` rule).

2. **Align header period with API data**  
   Derive period from facets (`min_date`/`max_date`) or from loaded movements instead of hardcoding 2024.

3. **Extract shared backend data loader**  
   One helper for `generate_mock_movements(seed=42)` + optional `business_type` filter; thin routes (`pure-domain-logic` rule).

4. **Add explicit 400 for invalid date ranges + empty-safe facets**  
   Prevent ambiguous empties / indexing crashes (`api-contracts-and-errors` rule).

5. **Wire or remove dead frontend pieces**  
   Either use `/api/metrics/summary` (and related) for charts/KPIs, or document why client aggregation stays; delete or connect `mock-data.ts`.

6. **Optional product expansion (after 1–5)**  
   Surface unused API capabilities in the UI (facets-driven filters, top categories chart, alerts, B2B/B2C toggle) following `dashboard-ui-structure`.

7. **Hardening for real use (later)**  
   Pin `requirements.txt` versions; add healthcheck to Compose; add CI running `pytest` + `vitest`; introduce `.agents/skills` if agent workflows need repeatable playbooks.

---

## Quick verification commands

```bash
# Stack
docker compose up --build

# Backend tests (inside backend env / container)
pytest

# Frontend tests
cd frontend && npm test
```

URLs: frontend `http://localhost:5173`, API `http://localhost:8000`, docs `http://localhost:8000/docs`.
