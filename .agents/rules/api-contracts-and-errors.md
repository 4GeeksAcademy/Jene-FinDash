# Rule: Typed API Contracts and Explicit Failure Handling

## Name

`api-contracts-and-errors`

## Scope

**When it applies**

- Adding, changing, or consuming any HTTP endpoint under `/health` or `/api/metrics*`
- Changing Pydantic models or `Literal` domain unions in the backend
- Changing `frontend/src/lib/financial-types.ts` or any `fetch` to the backend
- Handling loading/error UI for financial data

**Where it applies**

| Area | Paths |
|------|--------|
| FastAPI app + routes | `backend/app/main.py`, `backend/app/routes.py` (and future `backend/app/*.py` modules) |
| Backend API tests | `backend/tests/test_routes.py` |
| Frontend types + data loading | `frontend/src/lib/financial-types.ts`, `frontend/src/App.tsx` (and any new API helper under `frontend/src/lib/`) |
| Env / proxy contract | `frontend/vite.config.ts`, `frontend/.env.example` |

**Does not apply** to pure CSS, chart styling-only changes, or Dockerfiles unless they change service ports/proxy targets.

## Rationale

Backend contracts are already strong: routes declare `response_model`, and query params use typed `Query(...)` with bounds (`limit` ge/le, `threshold` ge=0). Frontend mirrors domain shapes in `financial-types.ts` and checks `response.ok` in `fetchFinancialData`, but then:

- Trusts `response.json()` without runtime validation
- Uses `.catch(() => setError(...))` in `App.tsx`, discarding the thrown error
- Duplicates domain literals (`OperationType`, `Category`, `BusinessType`) in Python and TypeScript, so they can drift
- Does not reject invalid date ranges (`start_date > end_date`) with HTTP 4xx
- `build_metrics_facets` assumes a non-empty list (`ordered[0]` / `ordered[-1]`)

This rule keeps OpenAPI-accurate APIs and prevents silent UI failures when the proxy (`/api` → `http://backend:8000`) or backend is down.

## Requirements

### Must

1. Every public endpoint that returns structured JSON **must** declare a Pydantic `response_model` (follow existing routes: `FinancialMovement`, `MetricsFacets`, `MetricsSummaryItem`, `TopCategoryItem`, `MetricsComparison`, `MetricsAlert`).
2. Type all query/body inputs with FastAPI/Pydantic. Prefer constrained `Query` (defaults, `ge`/`le`, required `Query(...)`) like `/api/metrics/categories/top` and `/api/metrics/comparison`.
3. Reject invalid client input with **HTTP 4xx** (`HTTPException`), not empty success payloads or unhandled exceptions. At minimum, if both `start_date` and `end_date` are provided and `start_date > end_date`, return `400`.
4. Frontend: treat non-OK HTTP as failure (`throw` or typed Result). Never ignore `response.ok`.
5. Frontend: when catching fetch failures, **retain** status/message for debugging (`console.error` or store detail) **and** set a user-visible error string. Do not use empty `.catch(() => { ... })` that discards the error.
6. When changing domain fields or literals on either side, update **both** `backend/app/routes.py` models/`Literal`s **and** `frontend/src/lib/financial-types.ts` so names and values stay identical (`income`/`outcome`, category set, `B2B`/`B2C`).

### Should

1. When `App.tsx` would gain a second `fetch` call site, extract a shared helper module (recommended path: create `frontend/src/lib/api.ts`) that uses `import.meta.env.VITE_API_BASE_URL ?? ""` and paths under `/api/metrics...`. Vite already proxies `/api` → `http://backend:8000` in Compose (`frontend/vite.config.ts`); do not hardcode `http://localhost:8000` in components.
2. Prefer existing aggregate endpoints (`/api/metrics/summary`, `/api/metrics/facets`, `/api/metrics/categories/top`, `/api/metrics/comparison`, `/api/metrics/alerts`) when the UI needs aggregates, instead of only downloading full `/api/metrics` and re-aggregating—unless client-side aggregation is intentionally documented (current `App.tsx` KPI/charts do client aggregation via `computeKPIs` / `computeMonthlyData`; new features should justify the same choice).
3. Guard helpers that index first/last items (e.g. `build_metrics_facets` using `ordered[0]` / `ordered[-1]`) against empty lists, or return an explicit empty/404 contract documented in OpenAPI.
4. Keep user-facing dashboard copy in one language per screen (current UI chrome is English; the Spanish string in `App.tsx`'s `.catch` should be replaced with English when that error path is touched, unless i18n is introduced).

## Concrete examples (this repo)

```python
# ❌ BAD — no response_model, no range validation
@router.get("/api/metrics/custom")
def get_custom(start_date: date | None = None, end_date: date | None = None):
    return generate_mock_movements(seed=42)

# ✅ GOOD — typed contract + explicit 400
@router.get("/api/metrics/custom", response_model=list[FinancialMovement])
def get_custom(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> list[FinancialMovement]:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    movements = generate_mock_movements(seed=42)
    return ensure_chronological_order(
        filter_movements(movements, start_date, end_date, None, None)
    )
```

```typescript
# ❌ BAD — ignores status detail and swallows the error
fetch(`${API_BASE_URL}/api/metrics`)
  .then((r) => r.json())
  .catch(() => setError("Failed"));

# ✅ GOOD — check ok, keep detail, show user message
async function fetchFinancialData(): Promise<FinancialMovement[]> {
  const response = await fetch(`${API_BASE_URL}/api/metrics`);
  if (!response.ok) {
    throw new Error(`Failed to fetch financial data: ${response.status}`);
  }
  return response.json();
}

// in effect:
.catch((err: unknown) => {
  console.error(err);
  setError("Could not load financial information. Check the backend API.");
});
```

## Known endpoints agents must not invent replacements for without reason

| Method | Path | Response model |
|--------|------|----------------|
| GET | `/health` | `{ status: string }` |
| GET | `/api/metrics` | `list[FinancialMovement]` |
| GET | `/api/metrics/facets` | `MetricsFacets` |
| GET | `/api/metrics/summary` | `list[MetricsSummaryItem]` |
| GET | `/api/metrics/categories/top` | `list[TopCategoryItem]` |
| GET | `/api/metrics/comparison` | `MetricsComparison` |
| GET | `/api/metrics/alerts` | `list[MetricsAlert]` |
| GET | `/api/metrics/b2b` | `list[FinancialMovement]` |
| GET | `/api/metrics/b2c` | `list[FinancialMovement]` |

Proxy: browser calls `/api/...` on port `5173`; Vite forwards to `http://backend:8000` (`frontend/vite.config.ts`).

## Agent checklist

- [ ] New/changed route has `response_model` and typed `Query`/`Body`
- [ ] Invalid dates/ranges return 400 (or other explicit 4xx)
- [ ] Frontend fetch checks `response.ok` and does not discard errors
- [ ] `financial-types.ts` updated in lockstep with Pydantic/`Literal` changes
- [ ] Tests cover the new contract (status + shape) in `backend/tests/test_routes.py`
