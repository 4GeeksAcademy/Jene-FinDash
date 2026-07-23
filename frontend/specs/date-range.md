# Spec: Date Range Filter

| Field | Value |
|-------|--------|
| Spec ID | `FE-DATE-RANGE` |
| Status | Draft |
| Target area | Main dashboard (`frontend/src/App.tsx` + dashboard components) |
| Primary API | `GET /api/metrics/facets` |
| Downstream API | `GET /api/metrics` (existing dashboard load) must honor selected dates |

---

## 1. Goal

Add two optional date inputs (`start` / `end`) in `YYYY-MM-DD` format on the main financial dashboard. Near the inputs, display the available data range from the facets API so users know which dates contain data. When dates are set, reload dashboard metrics using those bounds.

---

## 2. Backend contract (source of truth)

### 2.1 Facets — available range

**Endpoint:** `GET /api/metrics/facets`  
**Handler:** `get_metrics_facets` → `build_metrics_facets` in `backend/app/routes.py`  
**Auth / body:** none  
**Query params:** none

**Response model `MetricsFacets`:**

| Field | Type | Meaning |
|-------|------|---------|
| `operation_types` | `string[]` | Distinct `income` / `outcome` |
| `business_types` | `string[]` | Distinct `B2B` / `B2C` |
| `categories` | `string[]` | Distinct category literals |
| `min_date` | `string` (ISO date `YYYY-MM-DD`) | Earliest `create_date` in seeded mock set |
| `max_date` | `string` (ISO date `YYYY-MM-DD`) | Latest `create_date` in seeded mock set |

Evidence: `build_metrics_facets` sorts movements chronologically and sets `min_date=ordered[0].create_date`, `max_date=ordered[-1].create_date`. Data comes from `generate_mock_movements(seed=42)` (dates are relative to `date.today()`, not a fixed calendar year).

**This spec uses from facets:** `min_date`, `max_date` (required for the “available data range” UI). Other facet fields may be ignored for this feature.

### 2.2 Metrics — filtered dashboard payload

**Endpoint:** `GET /api/metrics`  
**Query params (already implemented):**

| Param | Type | Required | Behavior |
|-------|------|----------|----------|
| `start_date` | date `YYYY-MM-DD` | No | Keep movements with `create_date >= start_date` |
| `end_date` | date `YYYY-MM-DD` | No | Keep movements with `create_date <= end_date` |
| `category` | Category | No | Not part of this spec’s UI |
| `operation_type` | OperationType | No | Not part of this spec’s UI |

Filter logic: `filter_movements_by_date` / `filter_movements` in `routes.py` (inclusive edges).

---

## 3. UI requirements

### 3.1 Placement

- Render a date-range control **above** the KPI row on the main dashboard (same composition root as today: `App.tsx`, or a new kebab-case component under `frontend/src/components/dashboard/`, e.g. `date-range-filter.tsx`).
- Follow `.agents/rules/dashboard-ui-structure.md`: props + loading; fetch orchestration in `App.tsx` or `frontend/src/lib/api.ts`.

### 3.2 Inputs

| Control | Behavior |
|---------|----------|
| Start date | Optional `<input type="date">` (or equivalent). Value format `YYYY-MM-DD`. Empty = no `start_date` query param. |
| End date | Optional `<input type="date">`. Value format `YYYY-MM-DD`. Empty = no `end_date` query param. |

**Constraints (client-side):**

1. If both are set and `start > end`, do **not** call the API; show an inline validation message (e.g. “Start date must be on or before end date”).
2. Prefer setting `min` / `max` HTML attributes from facets `min_date` / `max_date` when facets have loaded (guides the picker; does not replace validation).
3. Changing either date (after validation) re-fetches dashboard data with the new query string.

### 3.3 Available range display

Adjacent to the inputs (helper text or badge), show the available data range from facets, for example:

> Available data: `{min_date}` → `{max_date}`

- While facets are loading: show a compact skeleton or “Loading available range…”.
- If facets fail: show that range is unavailable; inputs may still work without `min`/`max` bounds.
- Replace the hardcoded header period `"2024 - Full Year"` when this feature lands: derive the header period from selected dates or from `min_date`–`max_date` when no selection.

### 3.4 Data flow

```text
mount / date change
  ├─ GET /api/metrics/facets          → set availableRange { min_date, max_date }
  └─ GET /api/metrics?start_date=&end_date=  → computeKPIs / computeMonthlyData (existing)
```

- Omit a query param when its input is empty.
- Keep existing KPI + chart pipeline; only the movements list is filtered by date.

### 3.5 Loading & errors

- Reuse existing dashboard `loading` / error banner patterns (`App.tsx`).
- Treat non-OK HTTP as failure; do not swallow errors (`.agents/rules/api-contracts-and-errors.md`).
- English user-facing copy only.

---

## 4. Types to add (frontend)

Align with backend; extend `frontend/src/lib/financial-types.ts`:

```ts
export interface MetricsFacets {
  operation_types: OperationType[]
  business_types: BusinessType[]
  categories: Category[]
  min_date: string // YYYY-MM-DD
  max_date: string // YYYY-MM-DD
}
```

---

## 5. Acceptance criteria

- [ ] Facets loaded on dashboard mount; available range shown as `min_date` → `max_date`.
- [ ] Start and end inputs accept / emit `YYYY-MM-DD`; both optional.
- [ ] Clearing both inputs loads unfiltered `/api/metrics` (current behavior).
- [ ] Setting dates requests `/api/metrics?start_date=…&end_date=…` as applicable; KPIs and charts update.
- [ ] Invalid range (`start > end`) blocks the request and shows validation copy.
- [ ] Loading and error states covered for facets and metrics fetches.

---

## 6. Out of scope

- Category / operation_type filters in this control.
- Backend changes (facets and metrics date filters already exist).
- Persisting selected dates to URL or localStorage (optional follow-up).
