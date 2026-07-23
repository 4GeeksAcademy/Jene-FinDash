# Rule: Pure Domain Logic, Thin I/O Boundaries

## Name

`pure-domain-logic`

## Scope

**When it applies**

- Adding or changing financial calculations, filters, aggregations, comparisons, or alerts
- Adding or changing FastAPI route handlers under `backend/app/`
- Adding or changing React dashboard data derivation or `useEffect` data loading under `frontend/src/`

**Where it applies**

| Area | Paths |
|------|--------|
| Backend domain + routes | `backend/app/**/*.py` |
| Backend tests for helpers | `backend/tests/**/*.py` |
| Frontend utils + App orchestration | `frontend/src/lib/**/*.ts`, `frontend/src/App.tsx` |
| Frontend dashboard components | `frontend/src/components/dashboard/**/*.tsx` |

**Does not apply** to Dockerfile/Compose changes, CSS-only edits (`frontend/src/index.css`), or unrelated tooling config (`eslint.config.js`, `tsconfig*.json`) unless those changes alter how domain code is imported or tested.

## Rationale

This repo already works well when money logic is pure and I/O is thin:

- Backend: `filter_movements`, `summarize_movements`, `build_top_categories`, `calculate_net_value`, and `detect_outcome_alerts` in `backend/app/routes.py` take lists in and return data out (no HTTP).
- Frontend: `computeKPIs` / `computeMonthlyData` in `frontend/src/lib/financial-utils.ts` are unit-tested; charts/KPI cards mostly receive props.

The anti-pattern also exists today: every metrics handler repeats `generate_mock_movements(seed=42)` and inline `business_type` filters; `App.tsx` mixes `fetch`, error state, and KPI derivation. Without this rule, new features tend to bury logic inside handlers or JSX, which is harder to test and duplicates across `/api/metrics/*` endpoints.

## Requirements

### Must

1. Implement filtering, aggregation, comparison, and alert logic as **pure functions** (inputs → outputs). They must not call `fetch`, touch FastAPI `Request`/`Response`, or use React hooks.
2. Keep FastAPI handlers to this sequence only: validate query params → load movements → call domain helper(s) → return a typed response.
3. Keep React dashboard components focused on rendering props and local UI state (`loading`, display toggles). Put derived metrics in `frontend/src/lib/` (e.g. extend `financial-utils.ts`), not as multi-step math inside JSX or `useEffect` beyond one orchestration call.
4. Add or update unit tests with the feature:
   - Backend pure helpers → `backend/tests/` (pytest, same style as `test_routes.py`)
   - Frontend utils → `frontend/src/lib/*.test.ts` (Vitest, same style as `financial-utils.test.ts`)

### Should

1. Reuse one shared “load + optional business_type filter” helper instead of copying `generate_mock_movements(seed=42)` into each new `/api/metrics/*` handler.
2. If `backend/app/routes.py` grows further (models + data access + many handlers), split into modules such as `models.py`, `services.py` / `metrics.py`, and `routes.py` rather than adding more god-file logic.
3. Do not leave unused alternate datasets (like an unwired `mock-data.ts`) unless they are the documented fallback path for offline UI.

## Concrete examples (this repo)

```python
# ❌ BAD — aggregation only inside the handler, untested, duplicated seed call
@router.get("/api/metrics/net-by-month")
def get_net_by_month():
    movements = generate_mock_movements(seed=42)
    totals = {}
    for m in movements:
        key = m.create_date.strftime("%Y-%m")
        totals[key] = totals.get(key, 0) + (
            m.amount if m.operation_type == "income" else -m.amount
        )
    return totals

# ✅ GOOD — pure helper + thin handler (same pattern as summarize_movements)
def summarize_net_by_month(movements: list[FinancialMovement]) -> list[MetricsSummaryItem]:
    ...

@router.get("/api/metrics/summary", response_model=list[MetricsSummaryItem])
def get_metrics_summary(...):
    movements = generate_mock_movements(seed=42)  # prefer shared loader when extracting
    filtered = filter_movements(movements, start_date, end_date, category, operation_type)
    return summarize_movements(filtered, group_by)
```

```tsx
# ❌ BAD — KPI math inside the component
useEffect(() => {
  fetch("/api/metrics").then(async (r) => {
    const data = await r.json();
    setProfit(data.filter(...).reduce(...));
  });
}, []);

# ✅ GOOD — fetch once, derive via lib (App.tsx + financial-utils.ts pattern)
const movements = await fetchFinancialData();
setMetrics(computeKPIs(movements));
setMonthlyData(computeMonthlyData(movements));
```

## Agent checklist

Before finishing a related change, confirm:

- [ ] New calculation lives in a pure helper (backend and/or `financial-utils.ts`)
- [ ] Route/component does not contain the core formula
- [ ] Tests added/updated for the helper
- [ ] No new copy-paste of seed generation + filter blocks without extracting/reuse
