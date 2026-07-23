# Component Architecture — Dashboard Extensions

Spec-driven breakdown for implementing **FE-DATE-RANGE**, **FE-ANOMALY-ALERTS**, and **FE-B2B-VS-B2C**.  
Contracts: `frontend/specs/api-types.ts`, `frontend/specs/param-types.ts`.  
Conventions: `.agents/rules/dashboard-ui-structure.md`, `pure-domain-logic.md`, `api-contracts-and-errors.md`.

---

## 0. Shared layout & routing shell

### Current baseline

```text
main.tsx
  └─ App.tsx
       ├─ DashboardHeader
       ├─ KPIRow → KPICard×4
       ├─ IncomeOutcomeChart
       └─ ProfitPercentChart
```

### Target shell (after all three features)

```text
main.tsx
  └─ Router
       ├─ `/`                → OverviewDashboard (extended App composition)
       └─ `/b2b-vs-b2c`      → B2BVsB2CPage
```

| Piece | Responsibility |
|-------|----------------|
| Thin router entry | Mount routes in `App.tsx` or `main.tsx`; add nav links Overview \| B2B vs B2C |
| Fetch / API module | Prefer `frontend/src/lib/api.ts` for facets, metrics, alerts, top-categories |
| Pure utils | Date validation, `withIncomeShare`, percent formatting in `financial-utils.ts` |
| Presentational widgets | `frontend/src/components/dashboard/*.tsx` (kebab-case); props in, no child `fetch` |

**Shared state concerns (overview only):** `DateRangeFilter` selection can flow into metrics **and** alerts query params when both features live on `/`.

---

## 1. Date range filter (`FE-DATE-RANGE`)

### Components

| Component | Path (proposed) | Kind |
|-----------|-----------------|------|
| `DateRangeFilter` | `components/dashboard/date-range-filter.tsx` | Presentational control |
| Overview host | `App.tsx` (overview route) | Orchestration |

### `DateRangeFilter` — props

| Prop | Type | Role |
|------|------|------|
| `startDate` | `string` (`YYYY-MM-DD`) \| `""` | Controlled start value |
| `endDate` | `string` (`YYYY-MM-DD`) \| `""` | Controlled end value |
| `availableRange` | `AvailableDateRange` \| `null` | Facets `min_date` / `max_date` for label + input `min`/`max` |
| `availableRangeLoading` | `boolean` | Skeleton / “Loading available range…” |
| `availableRangeError` | `string` \| `null` | Range unavailable copy; inputs still usable |
| `validationError` | `string` \| `null` | e.g. start > end |
| `onStartDateChange` | `(value: string) => void` | Parent updates state |
| `onEndDateChange` | `(value: string) => void` | Parent updates state |
| `disabled` | `boolean` | Optional while metrics reload |

### Host state (`OverviewDashboard` / `App`)

| State | Type | Notes |
|-------|------|-------|
| `startDate` / `endDate` | `string` | Empty string = omit param |
| `facets` | `FacetsResponse` \| `null` | From `GET /api/metrics/facets` |
| `facetsLoading` / `facetsError` | `boolean` / `string` \| `null` | Facets-only |
| `metrics` / `monthlyData` | existing KPI types | From filtered `GET /api/metrics` |
| `loading` / `error` | existing | Metrics pipeline |

### Layout architecture

```text
[ Nav ]
[ DashboardHeader period derived from selection or facets min→max ]
[ DateRangeFilter ]          ← above KPIs
    inputs | “Available data: min → max”
[ KPIRow ]
[ Charts grid ]
[ AnomalyAlertsSection ]     ← feature 2
```

### Behavior summary

1. On mount: fetch facets + metrics (unfiltered).
2. On valid date change: refetch `GET /api/metrics` with `DateRangeFilter` query fields.
3. Invalid range: set `validationError`, **do not** call metrics.
4. Pass the same `DateRangeFilter` into alerts fetch when anomaly section is mounted.

---

## 2. Anomaly alerts (`FE-ANOMALY-ALERTS`)

### Components

| Component | Path (proposed) | Kind |
|-----------|-----------------|------|
| `AnomalyAlertsSection` | `components/dashboard/anomaly-alerts-section.tsx` | Section shell (threshold + table/empty) |
| `AnomalyAlertsTable` | `components/dashboard/anomaly-alerts-table.tsx` | Presentational table |
| `AlertThresholdInput` | inline in section or small child | Controlled number input |

Optional split: single `anomaly-alerts-table.tsx` exporting section + table if preferred; keep file kebab-case.

### `AnomalyAlertsTable` — props

| Prop | Type | Role |
|------|------|------|
| `alerts` | `AlertsResponse` (`AlertEntry[]`) | Rows from API |
| `loading` | `boolean` | Skeleton rows/card |
| `error` | `string` \| `null` | Section error |
| `empty` | derived | `!loading && !error && alerts.length === 0` → explicit empty message |

### `AnomalyAlertsSection` — props / local UI state

| Prop / state | Type | Role |
|--------------|------|------|
| `threshold` | `number` | Controlled `0.01`–`1.0`, default `0.3` |
| `onThresholdChange` | `(value: number) => void` | Parent or local then lift |
| `dateRange` | `DateRangeFilter` | Forwarded into `AlertsParams` |
| `alerts` | `AlertsResponse` | Fetch result |
| `loading` / `error` | `boolean` / `string` \| `null` | Fetch lifecycle |

### Host state additions

| State | Type | Notes |
|-------|------|-------|
| `threshold` | `number` | Default `0.3`; clamp to `[0.01, 1.0]` |
| `alerts` | `AlertEntry[]` | `AlertsResponse` |
| `alertsLoading` / `alertsError` | `boolean` / `string` \| `null` | Separate from metrics loading if desired |

### Layout architecture

```text
… charts grid (IncomeOutcomeChart | ProfitPercentChart) …
<section aria-label="Anomaly alerts">
  [ Threshold input 0.01–1.0 ]
  [ Table | Empty message | Skeleton | Error ]
</section>
```

**Table columns (fixed):** Period → Recorded outcome → Rolling average (bind `baseline_average`) → Percentage increase (`increase_ratio * 100`).

### Data flow

```text
threshold / dateRange change
  → GET /api/metrics/alerts?threshold=&start_date=&end_date=
  → AlertsResponse
  → table or empty state
```

Debounce threshold changes (~300ms) or commit on blur/Apply.

---

## 3. B2B vs B2C page (`FE-B2B-VS-B2C`)

### Components

| Component | Path (proposed) | Kind |
|-----------|-----------------|------|
| `B2BVsB2CPage` | `components/dashboard/b2b-vs-b2c-page.tsx` | Page orchestration |
| `TopIncomeCategoriesTable` | `components/dashboard/top-income-categories-table.tsx` | One segment table |
| `B2BB2CIncomeChart` | `components/dashboard/b2b-b2c-income-chart.tsx` | Single comparison chart |

### `TopIncomeCategoriesTable` — props

| Prop | Type | Role |
|------|------|------|
| `businessType` | `BusinessType` | Section heading `B2B` / `B2C` |
| `rows` | `CategoryEntryWithShare[]` | Category, total, % |
| `loading` | `boolean` | Skeleton table |
| `error` | `string` \| `null` | Section error |
| `emptyMessage` | `string` | When `rows.length === 0` |

### `B2BB2CIncomeChart` — props

| Prop | Type | Role |
|------|------|------|
| `b2b` | `CategoryEntry[]` \| shares | Series A amounts by category |
| `b2c` | `CategoryEntry[]` \| shares | Series B amounts by category |
| `loading` | `boolean` | Chart skeleton |
| `error` | `string` \| `null` | Chart error |

Build chart points as union of categories; missing side = `0`. Recharts grouped bar.

### `B2BVsB2CPage` — state

| State | Type | Notes |
|-------|------|-------|
| `facets` | `FacetsResponse` \| `null` | `business_types`, `availableRange` |
| `b2bCategories` / `b2cCategories` | `CategoryEntryWithShare[]` | After `withIncomeShare` |
| `loading` | `boolean` | Parallel fetches |
| `error` | `string` \| `null` | Page-level or per-section errors |
| Optional `dateRange` | `DateRangeFilter` | If global filter later applies |

Compose into `B2BVsB2CViewData` when all pieces succeed.

### Layout architecture

```text
[ Nav: Overview | B2B vs B2C ]
[ Title: B2B vs B2C Income ]
[ Optional: Available data min → max ]

┌──────────────────────┐  ┌──────────────────────┐
│ TopIncomeCategories  │  │ TopIncomeCategories  │
│ businessType=B2B     │  │ businessType=B2C     │
└──────────────────────┘  └──────────────────────┘
        grid-cols-1 → xl:grid-cols-2

┌────────────────────────────────────────────────┐
│ B2BB2CIncomeChart (single chart, full width)   │
└────────────────────────────────────────────────┘
```

### Data flow

```text
enter /b2b-vs-b2c
  ├─ GET /api/metrics/facets
  ├─ GET .../categories/top?operation_type=income&limit=5&business_type=B2B
  └─ GET .../categories/top?operation_type=income&limit=5&business_type=B2C
       → withIncomeShare each list
       → tables + one chart
```

Use `TopCategoriesParams` for each top-categories call (`operation_type: "income"`, `limit: 5`, `business_type` set).

---

## 4. Cross-feature state matrix

| Concern | Overview `/` | B2B vs B2C `/b2b-vs-b2c` |
|---------|--------------|---------------------------|
| Facets | Yes (range label + input bounds) | Yes (range subtitle + business type guard) |
| `DateRangeFilter` | Yes → metrics + alerts | Optional later |
| `AlertsParams` | Yes | No |
| `TopCategoriesParams` | No | Yes (×2 segments) |
| KPIs / monthly charts | Yes | No |
| Routing | Default | Dedicated page |

---

## 5. Implementation order (suggested)

1. Add `api-types.ts` / `param-types.ts` (done in specs) → mirror needed types into `src/lib` when implementing.
2. `DateRangeFilter` + wire `GET /api/metrics` + header period.
3. `AnomalyAlertsSection` below charts; share date bounds.
4. Introduce router + `B2BVsB2CPage` with tables and single income chart.
5. Vitest for `withIncomeShare` and date validation helpers.

---

## 6. Non-negotiables checklist

- [ ] No `any` / `object` in feature TypeScript.
- [ ] No `fetch` inside presentational table/chart children.
- [ ] Empty alerts → explicit message, not empty table chrome only.
- [ ] Top categories requests always send `operation_type=income` for the comparison page.
- [ ] Chart is **one** comparison visualization under both tables.
- [ ] English UI copy; preserve error details when catching failures.
