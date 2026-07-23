# Engineering Practices Audit

Evidence-based audit of `/frontend` and `/backend`. Findings are drawn only from the current codebase.

---

## 1. Good practices already in use

### Backend

| Practice | Evidence |
|----------|----------|
| Explicit typing with modern Python unions | `routes.py` uses `date \| None`, `float \| None`, and `Literal[...]` aliases (`OperationType`, `Category`, `BusinessType`, `GroupBy`) |
| Pydantic response contracts | Every metrics route declares `response_model=...` (`FinancialMovement`, `MetricsFacets`, `MetricsSummaryItem`, etc.) |
| Query-param validation via FastAPI | `Query(default=...)`, required params with `Query(...)`, bounds like `limit: int = Query(default=5, ge=1, le=20)` and `threshold: float = Query(default=0.3, ge=0)` |
| Pure, testable domain helpers | `filter_movements`, `summarize_movements`, `build_top_categories`, `calculate_net_value`, `detect_outcome_alerts` take data in / return data out with no I/O |
| Deterministic mock data for tests | `generate_mock_movements(seed=42)` makes API responses reproducible |
| Route tests with `TestClient` | `backend/tests/test_routes.py` asserts status codes, filter semantics, payload shapes, and sorting |
| CORS configured at app entry | `main.py` attaches `CORSMiddleware` once; router is mounted via `include_router` |

### Frontend

| Practice | Evidence |
|----------|----------|
| Shared domain types | `lib/financial-types.ts` mirrors backend literals/interfaces (`FinancialMovement`, `KPIMetrics`, `MonthlyDataPoint`) |
| Pure computation separated from UI | `computeKPIs` / `computeMonthlyData` / formatters live in `lib/financial-utils.ts`; components receive props |
| Unit tests for money logic | `lib/financial-utils.test.ts` covers totals, zero-income edge case, chronological monthly aggregation, formatters |
| Typed component props | Dashboard components declare interfaces (`KPICardProps`, `KPIRowProps`, chart props) |
| Loading / empty / error UI states | Skeletons while `loading`; chart empty copy when no data; error banner in `App.tsx` |
| Path alias and UI primitives | `@/` alias; shadcn-style `Card` / `Skeleton`; `cn()` helper |
| Strict TS / lint tooling | `tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`; ESLint + TypeScript recommended configs |
| Consistent file naming (frontend) | kebab-case component files (`kpi-card.tsx`, `income-outcome-chart.tsx`) under `components/dashboard` and `components/ui` |

---

## 2. Gaps and bad practices to enforce against

### Backend

| Gap | Evidence |
|-----|----------|
| God-module architecture | Models, mock generation, aggregation, and HTTP handlers all live in a single `routes.py` (~390 lines) |
| Duplicated handler boilerplate | Every metrics endpoint calls `generate_mock_movements(seed=42)`; `business_type` filtering is copy-pasted in summary/top/comparison/alerts |
| No explicit HTTP error mapping | No `HTTPException` usage; invalid ranges (e.g. `start_date > end_date`) are not rejected |
| Empty-collection crash risk | `build_metrics_facets` indexes `ordered[0]` / `ordered[-1]` with no guard if movements were empty |
| Mixed concerns in route layer | Domain helpers are pure, but handlers still own data-sourcing and ad-hoc filters instead of a shared service/data access function |
| Unversioned dependency pins | `requirements.txt` lists packages without versions (`fastapi`, `uvicorn[standard]`, etc.) |

### Frontend

| Gap | Evidence |
|-----|----------|
| Unvalidated API payloads | `fetchFinancialData` returns `response.json()` cast only by TypeScript return type; no runtime shape check |
| Swallowed fetch errors | `.catch(() => { setError("...") })` discards the thrown `Error` (status/message never logged or shown) |
| Dead / unused mock data | `lib/mock-data.ts` exports `mockMovements` but nothing imports it |
| Hardcoded period vs live data | `DashboardHeader period="2024 - Full Year"` while backend dates are relative to `date.today()` |
| Quote / style inconsistency | `App.tsx` uses double quotes + semicolons; many components use single quotes without semicolons |
| Client/server type drift risk | Identical domain literals are redefined in `financial-types.ts` and `routes.py` with no shared contract or sync check |
| Backend endpoints unused by UI | Facets, summary, top categories, comparison, alerts, B2B/B2C exist and are tested but never called from React |
| No shared API client module | Fetch URL construction and error handling live inline in `App.tsx` |

### Cross-cutting

| Gap | Evidence |
|-----|----------|
| No project rules/skills yet | `AGENTS.md` / README expect `.agents/rules` and `.agents/skills`; directories are absent |
| Spanish error string in otherwise English UI | `"No se pudo cargar la informacion financiera..."` in `App.tsx` |

---

## 3. Draft project rules (to enforce later)

These two rules turn the strongest existing patterns into explicit Must/Should requirements and close the highest-risk gaps.

---

### Rule 1 — Pure domain logic, thin I/O boundaries

**Title:** Keep financial domain logic pure; keep routes and React views thin

**Context:**  
The codebase already separates calculation from I/O in places that work well: backend helpers like `filter_movements` / `summarize_movements` are pure and tested; frontend KPIs/charts are computed in `financial-utils.ts` and covered by Vitest. The opposite pattern also appears: every FastAPI handler regenerates mock data and reimplements filters, and `App.tsx` mixes fetching, error state, and orchestration. Enforcing the good pattern prevents logic from accumulating only inside HTTP handlers or React effects.

**Must**

- Put filtering, aggregation, comparison, and alert detection in pure functions that accept data and return data (no `Request`, no `fetch`, no React hooks inside them).
- Keep FastAPI route handlers limited to: parse/validate inputs → obtain movements → call domain helpers → return response models.
- Keep React components limited to rendering props and local UI state; put derived metrics in `lib/` utilities (or equivalent), not inline in JSX/`useEffect` bodies beyond a single orchestration call.
- Cover new domain helpers with unit tests (pytest for backend pure functions; Vitest for frontend utils) before or with the feature that uses them.

**Should**

- Extract repeated “load + filter” sequences (e.g. `generate_mock_movements(seed=42)` + `business_type` filter) into one shared accessor used by all metrics routes.
- Prefer splitting large modules when models, data access, and routes grow beyond a single file (`models` / `services` / `routes`, or equivalent).
- Avoid dead alternate data sources (`mock-data.ts`-style) unless they are wired to a documented fallback path or removed.

---

### Rule 2 — Typed API contracts and explicit failure handling

**Title:** Declare typed API contracts and surface failures explicitly

**Context:**  
Backend routes consistently declare Pydantic `response_model` and constrained `Query` params, which FastAPI validates. The frontend mirrors shapes in `financial-types.ts` and checks `response.ok`, but then trusts JSON blindly and swallows errors in `.catch`. Domain enums exist twice (Python `Literal` vs TypeScript unions) and can drift. Empty or invalid edge cases (e.g. facets on empty lists, `start_date > end_date`) lack explicit error responses. This rule locks in typed contracts and requires failures to be handled, not discarded.

**Must**

- Declare a `response_model` (or equivalent typed response) on every public API endpoint that returns structured data.
- Type query/body inputs with FastAPI/Pydantic (including bounds and required fields where applicable); reject invalid input with HTTP 4xx rather than silently returning empty or crashing.
- On the frontend, treat non-OK HTTP responses as failures (`throw` or return a typed `Result`); do not ignore `response.ok`.
- Preserve failure detail for debugging (log or retain `status` / message) while still showing a user-visible error state; do not use empty `.catch(() => ...)` that discards the error object.
- Keep frontend domain unions/interfaces aligned with backend models when either side changes (same field names and literal values for `operation_type`, `category`, `business_type`, etc.).

**Should**

- Centralize API calls in a small client module (base URL from `VITE_API_BASE_URL`, path constants, shared error mapping) instead of ad-hoc `fetch` in page components.
- Prefer using existing aggregated endpoints (`/api/metrics/summary`, `/facets`, etc.) when the UI needs aggregates, rather than re-aggregating large payloads only on the client—unless a documented reason requires client-side computation.
- Guard domain helpers against empty inputs (or document and enforce non-empty preconditions) so routes never raise unhandled `IndexError`/`KeyError` on valid empty filters.
- Use one UI language for user-facing strings within a screen (avoid mixing Spanish and English error copy without i18n).

---

## 4. Suggested next step

Convert Rule 1 and Rule 2 into files under `.agents/rules/` (as described in `AGENTS.md` / README) when ready to enforce them for agents and contributors.
