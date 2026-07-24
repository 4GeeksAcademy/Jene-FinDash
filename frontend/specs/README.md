# Frontend Specs — Data Contract Documentation

> Spec-only documentation for Features 1–3. Verified against live OpenAPI at `GET http://localhost:8000/openapi.json` (FastAPI `/docs`).  
> Transport: relative `/api/...` via Vite proxy → `http://backend:8000`. All consumed endpoints are **GET** with **query parameters only** (no request bodies).

| Feature | Spec ID | Spec files |
|---------|---------|------------|
| Date Range Filter | `FE-DATE-RANGE` | This README + [`components.md`](./components.md) + types |
| Anomaly Alerts Table | `FE-ANOMALY-ALERTS` | This README + [`components.md`](./components.md) + types |
| B2B vs B2C Comparison View | `FE-B2B-VS-B2C` | This README + [`components.md`](./components.md) + types |

**Allowed files in this directory (spec-only; no React/UI implementation):**

- [`api-types.ts`](./api-types.ts) — response / view-model types + JSDoc
- [`param-types.ts`](./param-types.ts) — query-parameter types + JSDoc
- [`components.md`](./components.md) — component architecture (non-executable)
- [`README.md`](./README.md) — this data contract documentation

Do **not** add React components, hooks, fetch helpers, or other runtime UI code under `frontend/specs/` or as part of this specification workstream.

---

## Feature 1 — Date Range Filter (`FE-DATE-RANGE`)

### 1. Endpoints

| Role | Method | Path (OpenAPI `/docs`) | Body | Success | Error |
|------|--------|------------------------|------|---------|-------|
| Available data range | `GET` | `/api/metrics/facets` | none | `200` → `MetricsFacets` | — (no query params) |
| Filtered movements for KPIs/charts | `GET` | `/api/metrics` | none | `200` → `FinancialMovement[]` | `422` → `HTTPValidationError` |

```http
GET /api/metrics/facets
GET /api/metrics
GET /api/metrics?start_date=YYYY-MM-DD
GET /api/metrics?end_date=YYYY-MM-DD
GET /api/metrics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

This feature does **not** send `category` or `operation_type` on `/api/metrics` (those query params exist in OpenAPI but are out of scope).

### 2. TypeScript types

#### Request parameters

```ts
/** Calendar date string. Format: YYYY-MM-DD (OpenAPI `format: date`). */
type IsoDateString = string;

/**
 * Query object for GET /api/metrics (date bounds only).
 * Omit a property (or leave empty in the UI) to exclude that query key.
 */
interface DateRangeFilter {
  /** Inclusive lower bound → query `start_date`. Optional. */
  start_date?: IsoDateString;
  /** Inclusive upper bound → query `end_date`. Optional. */
  end_date?: IsoDateString;
}

/** GET /api/metrics/facets takes no request parameters. */
type FacetsRequestParams = Record<string, never>;
```

#### Response payloads

```ts
type OperationType = "income" | "outcome";
type Category =
  | "suppliers"
  | "sales"
  | "operational"
  | "administrative"
  | "others";
type BusinessType = "B2B" | "B2C";

/** OpenAPI schema title: MetricsFacets */
interface FacetsResponse {
  operation_types: OperationType[];
  business_types: BusinessType[];
  categories: Category[];
  /** YYYY-MM-DD — earliest create_date */
  min_date: IsoDateString;
  /** YYYY-MM-DD — latest create_date */
  max_date: IsoDateString;
}

/** Slice used for the available-range hint and input min/max. */
interface AvailableDateRange {
  min_date: IsoDateString;
  max_date: IsoDateString;
}

/** OpenAPI schema title: FinancialMovement (array element of GET /api/metrics) */
interface FinancialMovement {
  create_date: IsoDateString;
  amount: number;
  operation_type: OperationType;
  category: Category;
  business_type: BusinessType;
}

type MetricsResponse = FinancialMovement[];
```

### 3. Parameters & constraints

#### `GET /api/metrics/facets`

| Param | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| *(none)* | — | — | — | No query, path, or body fields |

#### `GET /api/metrics`

| Param | Type | Format | Required | Default | Constraints |
|-------|------|--------|----------|---------|-------------|
| `start_date` | `string` \| omitted | `YYYY-MM-DD` | No | omit | Inclusive `create_date >= start_date`. Invalid date → `422`. |
| `end_date` | `string` \| omitted | `YYYY-MM-DD` | No | omit | Inclusive `create_date <= end_date`. Invalid date → `422`. |
| `category` | enum \| null | — | No | null | **Not used** by this feature |
| `operation_type` | `income` \| `outcome` \| null | — | No | null | **Not used** by this feature |

#### Frontend-enforced rules

| Rule | Valid values / format | On violation |
|------|----------------------|--------------|
| Date format | `YYYY-MM-DD` when filled | Block request; field validation |
| One-sided fill | Start-only or end-only is **valid** | Send only the filled query key |
| Both filled | `start_date <= end_date` | Block request; show sequence error |
| UX bounds | Prefer facets `min_date`/`max_date` as input `min`/`max` | Guidance only |

### 4. UI edge cases

| # | API / data edge case | Exact UI render |
|---|----------------------|-----------------|
| 1 | **Empty filtered dataset** — `GET /api/metrics` returns `200` with `[]` for a valid date filter | Keep `DateRangeFilter` visible with current inputs. Show available-range hint if facets OK. KPIs show zero/em-dash empty metric presentation. Charts show existing empty body: `No data available to display`. Do **not** show a hard global error solely because the array is empty. |
| 2 | **Invalid date sequence** — both inputs filled and `start_date > end_date` | Do **not** call `/api/metrics`. Keep last successful KPIs/charts. Under the date controls render alert text: `Start date must be on or before end date.` |
| 3 | **Facets timeout / non-OK** | Inputs remain enabled without `min`/`max`. Hint line: `Available data range unavailable.` Metrics may still load (unfiltered or with typed dates). |
| 4 | **Only one date filled** | Refetch immediately with a single query param (`start_date` or `end_date` only). No sequence validation error. Hint unchanged. |

---

## Feature 2 — Anomaly Alerts Table (`FE-ANOMALY-ALERTS`)

### 1. Endpoints

| Role | Method | Path (OpenAPI `/docs`) | Body | Success | Error |
|------|--------|------------------------|------|---------|-------|
| Outcome anomaly rows | `GET` | `/api/metrics/alerts` | none | `200` → `MetricsAlert[]` | `422` → `HTTPValidationError` |

```http
GET /api/metrics/alerts?threshold=0.3
GET /api/metrics/alerts?threshold=0.3&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

OpenAPI also documents `group_by` (`day` \| `week` \| `month`, default `month`) and `business_type` (`B2B` \| `B2C`). This feature **does not expose UI** for those params; omit them (API defaults apply: `group_by=month`).

### 2. TypeScript types

#### Request parameters

```ts
type IsoDateString = string;

interface DateRangeFilter {
  start_date?: IsoDateString; // YYYY-MM-DD
  end_date?: IsoDateString;   // YYYY-MM-DD
}

/**
 * Query object for GET /api/metrics/alerts.
 * Extends shared date bounds when the overview date filter is active.
 */
interface AlertsParams extends DateRangeFilter {
  /**
   * Decimal ratio. UI default 0.3.
   * Product UI range: 0.01–1.0. API allows minimum 0.
   */
  threshold: number;
}
```

#### Response payloads

```ts
/** OpenAPI schema title: MetricsAlert */
interface AlertEntry {
  /** Period key (e.g. YYYY-MM when group_by=month) */
  period: string;
  /** Period outcome total */
  outcome_total: number;
  /**
   * Baseline average of prior periods in the series
   * (API field; UI column label may say “previous 3 periods”).
   */
  baseline_average: number;
  /**
   * (outcome_total - baseline_average) / baseline_average
   * Included only when ratio > threshold; API rounds to 4 decimals.
   */
  increase_ratio: number;
}

/** Wire shape: JSON array (not an envelope object) */
type AlertsResponse = AlertEntry[];
```

### 3. Parameters & constraints

| Param | Type | Format / values | Required (product) | Default | Constraints |
|-------|------|-----------------|--------------------|---------|-------------|
| `threshold` | `number` | Decimal ratio (e.g. `0.3`, not `30`) | **Yes** (UI always sends) | `0.3` | **UI:** `0.01`–`1.0` inclusive, step `0.01`. **API:** `minimum: 0`. Semantics: alert when increase ratio **>** threshold. |
| `start_date` | `string` \| omitted | `YYYY-MM-DD` | No | omit | Pass through from Feature 1 when set |
| `end_date` | `string` \| omitted | `YYYY-MM-DD` | No | omit | Must be `>= start_date` when both set (frontend gate) |
| `group_by` | `day` \| `week` \| `month` | enum | No (omit) | `month` | Not exposed in UI |
| `business_type` | `B2B` \| `B2C` \| null | enum | No (omit) | null | Not exposed in UI |

### 4. UI edge cases

| # | API / data edge case | Exact UI render |
|---|----------------------|-----------------|
| 1 | **Empty alerts list** — `200` with `[]` (e.g. high threshold, no spikes) | Keep section title `Anomaly alerts` and threshold input. **Do not** render a `<table>` or header-only table. Body text exactly: `No outcome anomalies detected for the current threshold.` |
| 2 | **Network timeout / non-OK** on `/api/metrics/alerts` | Keep threshold control. Replace table/empty area with `<p role="alert">` containing the failure message. Preserve error detail for debugging. Do not clear the rest of the overview dashboard. |
| 3 | **Out-of-range threshold** (`< 0.01` or `> 1.0`) | Under the input show: `Threshold must be between 0.01 and 1.0.` Do **not** call the alerts endpoint. Retain last successful alerts (or prior empty state). |
| 4 | **Non-empty alerts** | Four-column table only: `Period` (`string`), `Recorded outcome` (`number`→currency), `Rolling average of previous 3 periods` (`baseline_average`→currency), `Percentage increase` (`increase_ratio * 100`→ percent string). |

---

## Feature 3 — B2B vs B2C Comparison View (`FE-B2B-VS-B2C`)

### 1. Endpoints

| Role | Method | Path (OpenAPI `/docs`) | Body | Success | Error |
|------|--------|------------------------|------|---------|-------|
| Segment presence + date context | `GET` | `/api/metrics/facets` | none | `200` → `MetricsFacets` | — |
| Top income categories (B2B) | `GET` | `/api/metrics/categories/top` | none | `200` → `TopCategoryItem[]` | `422` |
| Top income categories (B2C) | `GET` | `/api/metrics/categories/top` | none | `200` → `TopCategoryItem[]` | `422` |

```http
GET /api/metrics/facets
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C
```

**Not consumed** by this feature: `/api/metrics/b2b`, `/api/metrics/b2c` (exist in `/docs` but out of scope).

### 2. TypeScript types

#### Request parameters

```ts
type IsoDateString = string;
type OperationType = "income" | "outcome";
type BusinessType = "B2B" | "B2C";

interface DateRangeFilter {
  start_date?: IsoDateString;
  end_date?: IsoDateString;
}

/**
 * Query object for GET /api/metrics/categories/top.
 * For this feature always send operation_type: "income", limit: 5,
 * and business_type: "B2B" | "B2C" on separate requests.
 */
interface TopCategoriesParams extends DateRangeFilter {
  operation_type: OperationType;
  /** Integer 1–20 (OpenAPI). Feature value: 5. */
  limit: number;
  business_type?: BusinessType;
}

/** Facets request: no parameters */
type FacetsRequestParams = Record<string, never>;
```

#### Response payloads

```ts
type Category =
  | "suppliers"
  | "sales"
  | "operational"
  | "administrative"
  | "others";

/** OpenAPI: MetricsFacets */
interface FacetsResponse {
  operation_types: OperationType[];
  business_types: BusinessType[];
  categories: Category[];
  min_date: IsoDateString;
  max_date: IsoDateString;
}

/** OpenAPI: TopCategoryItem */
interface CategoryEntry {
  category: Category;
  operation_type: OperationType;
  /** Aggregated amount; API rounds to 2 decimals */
  total_amount: number;
}

/** Wire shape: JSON array */
type TopCategoriesResponse = CategoryEntry[];

/** Client-enriched row for ranking tables (not on the wire) */
interface CategoryEntryWithShare extends CategoryEntry {
  /**
   * (total_amount / sum(total_amount in same response)) * 100
   * Range 0–100 when sum > 0.
   */
  percentOfTotal: number;
}

interface B2BVsB2CViewData {
  availableRange: { min_date: IsoDateString; max_date: IsoDateString };
  businessTypesPresent: BusinessType[];
  b2bCategories: CategoryEntryWithShare[];
  b2cCategories: CategoryEntryWithShare[];
}
```

### 3. Parameters & constraints

#### `GET /api/metrics/facets`

No parameters (same as Feature 1).

#### `GET /api/metrics/categories/top`

| Param | Type | Valid values | Required (product) | Default (API) | Constraints |
|-------|------|--------------|--------------------|---------------|-------------|
| `operation_type` | enum string | `income` \| `outcome` | **Yes** — always `income` | `outcome` | Omitting yields outcome totals — **invalid for this page** |
| `limit` | integer | `1`–`20` | **Yes** — always `5` | `5` | Outside range → `422` |
| `business_type` | enum string | `B2B` \| `B2C` | **Yes** per call | null | Exact casing; one request per segment |
| `start_date` | string \| omitted | `YYYY-MM-DD` | No | omit | `format: date`; bad value → `422` |
| `end_date` | string \| omitted | `YYYY-MM-DD` | No | omit | Frontend: `>= start_date` when both set |

### 4. UI edge cases

| # | API / data edge case | Exact UI render |
|---|----------------------|-----------------|
| 1 | **Empty top-5 for one segment** — e.g. B2B `[]`, B2C has rows | Keep two-panel grid. B2B panel: heading `B2B` + body text `No income categories for B2B.` (no header-only table). B2C panel: normal 3-column ranking table. Shared chart still mounts; B2B series values are `0` where categories exist only on B2C (and vice versa). |
| 2 | **Both segments empty `[]`** | Both panels show their empty messages (`No income categories for B2B.` / `No income categories for B2C.`). Single comparison chart card body: `No data available to display` (no bars). |
| 3 | **Timeout / non-OK on one top-categories call** | Failed panel: `<p role="alert">` with error text; heading remains. Other panel renders normally if successful. Chart uses available series or shows chart-level error — never a blank page with no explanation. |
| 4 | **Facets omit a business type** | Hide that panel or show `Not available in data.` Do not invent empty ranking data for a missing segment. Optional subtitle still uses `Available data: {min_date} → {max_date}` when facets succeed. |

**Comparison chart data series (contract reminder):**

| Series | Meaning |
|--------|---------|
| `B2B` | Income `total_amount` by category from `business_type=B2B` top-5 response (`0` if category absent) |
| `B2C` | Income `total_amount` by category from `business_type=B2C` top-5 response (`0` if category absent) |

---

## Cross-cutting rules

1. No request bodies on any feature endpoint (OpenAPI: query-only GETs).
2. Treat non-OK HTTP as failure; never ignore `response.ok`; never swallow errors in empty `.catch(() => …)`.
3. Wire field names are `snake_case` to match OpenAPI/Pydantic.
4. Interactive schema: `http://localhost:8000/docs`. Proxy: `frontend/vite.config.ts` (`/api` → `http://backend:8000`).
