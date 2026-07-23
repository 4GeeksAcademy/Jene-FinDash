# Frontend Specs — Data Contract Documentation

> **Scope:** This document specifies the frontend data contracts for three dashboard extension features. It does **not** implement React components, application runtime logic, or live client calls.  
> **Verified against:** Live OpenAPI at `http://localhost:8000/openapi.json` (FastAPI `/docs`), `backend/app/routes.py`, and typed contracts in `api-types.ts` / `param-types.ts`.  
> **Transport:** Browser calls relative `/api/...` (Vite proxies to `http://backend:8000`). Optional absolute base: `VITE_API_BASE_URL`. All feature endpoints are **GET** with **query parameters only** — no request bodies.

| Feature | Spec ID | Detail spec |
|---------|---------|-------------|
| Date range filter | `FE-DATE-RANGE` | [`date-range.md`](./date-range.md) |
| Anomaly alerts table | `FE-ANOMALY-ALERTS` | [`anomaly-alerts.md`](./anomaly-alerts.md) |
| B2B vs B2C comparison page | `FE-B2B-VS-B2C` | [`b2bvsb2c.md`](./b2bvsb2c.md) |

Shared TypeScript contracts:

- Responses & view models → [`api-types.ts`](./api-types.ts)
- Query parameter objects → [`param-types.ts`](./param-types.ts)
- Component architecture (non-executable) → [`components.md`](./components.md)

---

## Feature 1 — Date Range Filter (`FE-DATE-RANGE`)

### 1.1 Consumed endpoints

| Role | Method | Path (OpenAPI) | Request body | Success | Validation failure |
|------|--------|----------------|--------------|---------|-------------------|
| Available data range | `GET` | `/api/metrics/facets` | none | `200` → `MetricsFacets` | none listed (no query params) |
| Filtered dashboard movements | `GET` | `/api/metrics` | none | `200` → `FinancialMovement[]` | `422` → `HTTPValidationError` |

OpenAPI confirmation (`/openapi.json`):

- `GET /api/metrics/facets` — no parameters; response schema `MetricsFacets`.
- `GET /api/metrics` — optional query: `start_date`, `end_date`, `category`, `operation_type` (this feature uses **only** the date pair).

Proxy form used by the frontend:

```http
GET /api/metrics/facets
GET /api/metrics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

Omit a date query key when the corresponding input is empty.

### 1.2 Data mappings

| Network concern | TypeScript type | Module |
|-----------------|-----------------|--------|
| Facets response (wire) | `FacetsResponse` | `api-types.ts` |
| Date-range UI slice | `AvailableDateRange` (`min_date`, `max_date`) | `api-types.ts` |
| Metrics query params | `DateRangeFilter` | `param-types.ts` |
| Metrics response (wire) | `FinancialMovement[]` (existing app type in `src/lib/financial-types.ts`; same shape as OpenAPI `FinancialMovement`) | app lib |
| Request payload | *None* — GET only | — |

**`FacetsResponse` ↔ OpenAPI `MetricsFacets`**

| Property | TS type | OpenAPI |
|----------|---------|---------|
| `operation_types` | `OperationType[]` | `string[]` enum `income` \| `outcome` |
| `business_types` | `BusinessType[]` | `string[]` enum `B2B` \| `B2C` |
| `categories` | `Category[]` | `string[]` enum of five categories |
| `min_date` | `IsoDateString` | `string` `format: date` |
| `max_date` | `IsoDateString` | `string` `format: date` |

**`DateRangeFilter` → query string**

| Property | Query name | Sent when |
|----------|------------|-----------|
| `start_date` | `start_date` | Defined non-empty string |
| `end_date` | `end_date` | Defined non-empty string |

**`FinancialMovement` (metrics response element)**

| Property | Type | OpenAPI |
|----------|------|---------|
| `create_date` | `string` (`format: date`) | required |
| `amount` | `number` | required |
| `operation_type` | `"income"` \| `"outcome"` | required |
| `category` | Category enum | required |
| `business_type` | `"B2B"` \| `"B2C"` | required |

### 1.3 Parameter validations

#### `GET /api/metrics/facets`

| Parameter | Constraints |
|-----------|-------------|
| *(none)* | No query, path, or body parameters. |

#### `GET /api/metrics` (feature-used params)

| Parameter | Data type | Format | Required | Constraints |
|-----------|-----------|--------|----------|-------------|
| `start_date` | `string` \| omitted | `YYYY-MM-DD` (`format: date`) | No | Inclusive lower bound; invalid date string → API `422` |
| `end_date` | `string` \| omitted | `YYYY-MM-DD` (`format: date`) | No | Inclusive upper bound; invalid date string → API `422` |
| `category` | — | — | — | **Not used** by this feature |
| `operation_type` | — | — | — | **Not used** by this feature |

#### Frontend-enforced (before calling metrics)

| Rule | Constraint | On violation |
|------|------------|--------------|
| Date format | Each filled input must be `YYYY-MM-DD` | Block request; show field validation |
| Sequence | If both set: `start_date <= end_date` | Block request; inline message e.g. “Start date must be on or before end date” |
| UX bounds | Prefer `min`/`max` from `FacetsResponse.min_date` / `max_date` | Guidance only; does not replace sequence validation |

### 1.4 Edge case scenarios

| # | Scenario | Required UI state / layout |
|---|----------|----------------------------|
| 1 | **Invalid date sequence** — user sets `start_date` after `end_date` | Do **not** call `/api/metrics`. Keep previous KPI/chart data visible (or last-good snapshot). Show inline validation on the date-range control. Available-range label from facets (if loaded) remains visible. |
| 2 | **Empty filtered dataset** — valid range yields `[]` from `/api/metrics` (HTTP 200) | KPIs show zero / em-dash per existing empty metric rules; charts show their established “No data available to display” empty bodies; date inputs and “Available data: min → max” remain. Do not show a global hard-error banner solely because the list is empty. |
| 3 | **Facets network failure / timeout** | Date inputs stay usable without `min`/`max` attributes. Show “available range unavailable” (or equivalent) beside inputs. Metrics may still load unfiltered or with user-typed dates. Surface facets failure without discarding metrics error detail if both fail. |
| 4 | **Metrics network failure / timeout** after a date change | Show the shared dashboard error banner (English). Retain prior successful metrics on screen if the product chooses stale-while-revalidate; otherwise clear KPIs/charts to loading→error. Never use an empty `.catch` that drops the error object. |

---

## Feature 2 — Anomaly Alerts (`FE-ANOMALY-ALERTS`)

### 2.1 Consumed endpoints

| Role | Method | Path (OpenAPI) | Request body | Success | Validation failure |
|------|--------|----------------|--------------|---------|-------------------|
| Outcome anomaly rows | `GET` | `/api/metrics/alerts` | none | `200` → `MetricsAlert[]` | `422` → `HTTPValidationError` |

OpenAPI confirmation:

- Path: `/api/metrics/alerts`
- Query: `threshold` (number, `minimum: 0`, default `0.3`), `group_by` (enum `day`\|`week`\|`month`, default `month`), `start_date`, `end_date`, `business_type`
- This feature **consumes** `threshold` (required by product UI) and optionally `start_date` / `end_date` when the date-range filter is active
- This feature **does not** expose UI for `group_by` or `business_type` (defaults / omitted)

```http
GET /api/metrics/alerts?threshold=0.3
GET /api/metrics/alerts?threshold=0.3&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

### 2.2 Data mappings

| Network concern | TypeScript type | Module |
|-----------------|-----------------|--------|
| Query params | `AlertsParams` (`threshold` + `DateRangeFilter`) | `param-types.ts` |
| Single row | `AlertEntry` | `api-types.ts` |
| Response list | `AlertsResponse` (`AlertEntry[]`) | `api-types.ts` |
| Request payload | *None* — GET only | — |

**`AlertEntry` ↔ OpenAPI `MetricsAlert` (all required)**

| Property | TS type | UI column | Display |
|----------|---------|-----------|---------|
| `period` | `string` | Period | Raw (e.g. `YYYY-MM` when `group_by=month`) |
| `outcome_total` | `number` | Recorded outcome | Currency |
| `baseline_average` | `number` | “Rolling average of previous 3 periods” (label) | Currency — **bind API field; do not recompute a 3-period window** |
| `increase_ratio` | `number` | Percentage increase | `(increase_ratio * 100)` → percent string |

**`AlertsParams` → query string**

| Property | Query name | Notes |
|----------|------------|-------|
| `threshold` | `threshold` | Decimal ratio, e.g. `0.3` |
| `start_date` | `start_date` | Optional; from shared date filter |
| `end_date` | `end_date` | Optional; from shared date filter |

OpenAPI also allows `group_by` and `business_type`; they are **out of scope** for this feature’s TypeScript param object unless extended later.

### 2.3 Parameter validations

| Parameter | Data type | Format / values | Required (product) | Constraints |
|-----------|-----------|-----------------|--------------------|-------------|
| `threshold` | `number` | Decimal ratio | **Yes** (UI always sends) | **UI:** `0.01`–`1.0` inclusive, step `0.01`, default `0.3`. **API:** `minimum: 0`, default `0.3`. Do not send UI values outside `0.01`–`1.0`. |
| `start_date` | `string` \| omitted | `YYYY-MM-DD` | No | Same as date-range feature; API `422` on bad format |
| `end_date` | `string` \| omitted | `YYYY-MM-DD` | No | Must be `>= start_date` when both set (frontend) |
| `group_by` | — | `day` \| `week` \| `month` | No (omit; API default `month`) | Not exposed in UI for this feature |
| `business_type` | — | `B2B` \| `B2C` | No | Not exposed in UI for this feature |

### 2.4 Edge case scenarios

| # | Scenario | Required UI state / layout |
|---|----------|----------------------------|
| 1 | **Completely empty alerts list** — HTTP `200` with `[]` (e.g. high threshold such as `1.0`, or no spikes) | Render the anomaly **section** (title + threshold control). Do **not** show a header-only empty `<table>`. Show explicit empty copy in the body, e.g. “No outcome anomalies detected for the current threshold.” |
| 2 | **Network timeout / non-OK alerts response** | Keep threshold control visible. Replace table with section-level error message; log/retain status or error detail. Do not clear the rest of the dashboard solely because alerts failed. |
| 3 | **Out-of-range threshold input** (e.g. `0` or `1.5`) | Clamp or block before fetch; do not call the API with values outside `0.01`–`1.0`. Show control validation feedback. |
| 4 | **Invalid date sequence** inherited from the shared date filter while alerts are mounted | Do not call `/api/metrics/alerts` with that invalid pair; same validation gate as Feature 1. Alerts section may show last-good alerts or a short “fix dates to refresh alerts” note. |

---

## Feature 3 — B2B vs B2C Comparison Page (`FE-B2B-VS-B2C`)

### 3.1 Consumed endpoints

| Role | Method | Path (OpenAPI) | Request body | Success | Validation failure |
|------|--------|----------------|--------------|---------|-------------------|
| Segment presence + date context | `GET` | `/api/metrics/facets` | none | `200` → `MetricsFacets` | — |
| Top income categories (B2B) | `GET` | `/api/metrics/categories/top` | none | `200` → `TopCategoryItem[]` | `422` |
| Top income categories (B2C) | `GET` | `/api/metrics/categories/top` | none | `200` → `TopCategoryItem[]` | `422` |

OpenAPI confirmation for `/api/metrics/categories/top`:

- Query: `operation_type` (enum, default **`outcome`**), `limit` (integer `1`–`20`, default `5`), `start_date`, `end_date`, `business_type` (`B2B`\|`B2C`\|null)
- Response: array of `TopCategoryItem`

**Required calls for this feature:**

```http
GET /api/metrics/facets
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C
```

**Not consumed** by this feature’s contract: `/api/metrics/b2b`, `/api/metrics/b2c` (movement lists exist in OpenAPI but are out of scope per `b2bvsb2c.md`).

### 3.2 Data mappings

| Network concern | TypeScript type | Module |
|-----------------|-----------------|--------|
| Facets response | `FacetsResponse` | `api-types.ts` |
| Top-categories query | `TopCategoriesParams` | `param-types.ts` |
| Top-categories row | `CategoryEntry` | `api-types.ts` |
| Top-categories response | `TopCategoriesResponse` (`CategoryEntry[]`) | `api-types.ts` |
| Table row (+ client %) | `CategoryEntryWithShare` | `api-types.ts` |
| Page view model | `B2BVsB2CViewData` | `api-types.ts` |
| Request payload | *None* — GET only | — |

**`CategoryEntry` ↔ OpenAPI `TopCategoryItem`**

| Property | TS / OpenAPI | UI |
|----------|--------------|----|
| `category` | Category enum | Category name |
| `operation_type` | `income` \| `outcome` | Expect `income` for this page |
| `total_amount` | `number` | Total income (currency) |

**Client-only mapping (not on the wire):**

| Derived field | Type | Rule |
|---------------|------|------|
| `percentOfTotal` | `number` | `(total_amount / Σ total_amount in that segment’s response) * 100` |

**`TopCategoriesParams` → query (per segment request)**

| Property | Query name | Feature value |
|----------|------------|---------------|
| `operation_type` | `operation_type` | Always `"income"` (must override API default `"outcome"`) |
| `limit` | `limit` | `5` |
| `business_type` | `business_type` | `"B2B"` or `"B2C"` |
| `start_date` / `end_date` | same | Optional later; omit unless date filter is wired globally |

### 3.3 Parameter validations

#### `GET /api/metrics/facets`

Same as Feature 1 — no parameters.

#### `GET /api/metrics/categories/top`

| Parameter | Data type | Valid values | Required (product) | Constraints |
|-----------|-----------|--------------|--------------------|-------------|
| `operation_type` | `string` enum | `income` \| `outcome` | **Yes** — always send `income` | OpenAPI default is `outcome` if omitted — omitting is a **spec defect** for this page |
| `limit` | `integer` | `1`–`20` | **Yes** — send `5` | OpenAPI `minimum: 1`, `maximum: 20`, default `5`; values outside range → `422` |
| `business_type` | `string` enum \| omitted | `B2B` \| `B2C` | **Yes** for each of the two calls | Exact casing; null/omit returns unsegmented top categories (wrong for this UI) |
| `start_date` | `string` \| omitted | `YYYY-MM-DD` | No | `format: date`; bad value → `422` |
| `end_date` | `string` \| omitted | `YYYY-MM-DD` | No | Frontend: `>= start_date` when both set |

### 3.4 Edge case scenarios

| # | Scenario | Required UI state / layout |
|---|----------|----------------------------|
| 1 | **Empty top-categories for one segment** — e.g. B2B returns `[]`, B2C returns rows | Side-by-side layout remains. B2B section shows explicit empty message (“No income categories for B2B.”). B2C table renders normally. Comparison chart still mounts: B2B series all zeros / no B2B bars; B2C series from data. |
| 2 | **Network timeout on one or both top-categories calls** | Page chrome (nav, title) stays. Failed section(s) show section-level error; successful section can still render. Chart shows error or degrades to available series only — never a silent blank page. Preserve error detail for debugging. |
| 3 | **Facets omit a business type** (e.g. `business_types` lacks `B2C`) | Do not pretend the missing segment exists: hide that column or show “Not available in data.” Still allow fetching top-categories only for types present in facets (or show unavailable without calling). |
| 4 | **Both segments empty `[]`** | Both tables show explicit empty states. Single comparison chart shows chart empty state (“No data available to display”), not two empty chart cards. |

---

## Cross-cutting contract rules

1. **No request bodies** on any consumed endpoint (OpenAPI: query-only GETs).
2. **`422` responses** use schema `HTTPValidationError` (`detail` array). Frontend must treat non-OK as failure and must not ignore `response.ok`.
3. **Type sources of truth for implementers:** `frontend/specs/api-types.ts` and `frontend/specs/param-types.ts`; wire names must match OpenAPI/Pydantic field names (`snake_case`).
4. **Proxy:** relative `/api` → backend `:8000` (`frontend/vite.config.ts`). Interactive schema browser: `http://localhost:8000/docs`.

---

## Spec index

| File | Purpose |
|------|---------|
| [`README.md`](./README.md) | This data contract documentation |
| [`date-range.md`](./date-range.md) | Feature behavior / acceptance |
| [`anomaly-alerts.md`](./anomaly-alerts.md) | Feature behavior / acceptance |
| [`b2bvsb2c.md`](./b2bvsb2c.md) | Feature behavior / acceptance |
| [`api-types.ts`](./api-types.ts) | Response & view-model TypeScript |
| [`param-types.ts`](./param-types.ts) | Query parameter TypeScript |
| [`components.md`](./components.md) | Non-executable component architecture |
