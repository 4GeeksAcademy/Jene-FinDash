# Spec: Anomaly Alerts Table

| Field | Value |
|-------|--------|
| Spec ID | `FE-ANOMALY-ALERTS` |
| Status | Draft |
| Target area | Main dashboard, **below** the existing charts section |
| Primary API | `GET /api/metrics/alerts?threshold=<ratio>` |
| Related rules | `.agents/rules/dashboard-ui-structure.md`, `api-contracts-and-errors.md` |

---

## 1. Goal

Below the Income vs Outcome and Profit Margin charts, add an **anomaly alerts** section: a configurable threshold control and a four-column table of outcome spikes returned by the alerts API. When the API returns an empty list, show an explicit empty-state message (not a blank table).

---

## 2. Backend contract (source of truth)

### 2.1 Endpoint

**`GET /api/metrics/alerts`** — handler `get_metrics_alerts` in `backend/app/routes.py`.

| Query param | Type | Default | Constraints | Spec usage |
|-------------|------|---------|-------------|------------|
| `threshold` | `float` | `0.3` | `ge=0` (FastAPI) | **Required for UI** — user-configurable `0.01`–`1.0`, default `0.3` |
| `group_by` | `day` \| `week` \| `month` | `month` | Literal | Use default `month` unless product later adds a control |
| `start_date` | date | none | optional | Optional: pass through if date-range filter (`FE-DATE-RANGE`) is active |
| `end_date` | date | none | optional | Same as above |
| `business_type` | `B2B` \| `B2C` | none | optional | Out of scope for this spec |

### 2.2 Response model `MetricsAlert`

```json
[
  {
    "period": "2025-03",
    "outcome_total": 12345.67,
    "baseline_average": 10000.0,
    "increase_ratio": 0.2345
  }
]
```

| API field | Type | Meaning (from `detect_outcome_alerts`) |
|-----------|------|----------------------------------------|
| `period` | `string` | Period key from summary (`YYYY-MM` when `group_by=month`) |
| `outcome_total` | `float` | That period’s total outcome |
| `baseline_average` | `float` | Mean of **all prior periods’** outcomes in the summary series (see note below) |
| `increase_ratio` | `float` | `(outcome_total - baseline_average) / baseline_average`, rounded to 4 decimals; included only when ratio **>** `threshold` |

**Detection algorithm (evidence):** For each summary item in chronological order, if there is prior history and `baseline > 0`, compute `increase_ratio = (item.outcome - baseline) / baseline` where `baseline = sum(historical_outcomes) / len(historical_outcomes)`. Append current outcome to history afterward. Alert emitted only if `increase_ratio > threshold`.

**Important — product vs API wording:** The UI column may be labeled “Rolling average of previous 3 periods” for product copy, but the **current backend does not use a fixed 3-period window**. It uses the cumulative average of **every prior period** in the series. Implementers **must bind the column to `baseline_average`** from the API and must **not** recompute a 3-period average on the client unless the backend is changed in a separate task.

### 2.3 Example request

```http
GET /api/metrics/alerts?threshold=0.3
```

With optional date bounds (if date-range feature is live):

```http
GET /api/metrics/alerts?threshold=0.3&start_date=2025-01-01&end_date=2025-12-31
```

---

## 3. UI requirements

### 3.1 Placement

- Insert a new section **below** the charts grid in `App.tsx` (`aria-label` e.g. `Anomaly alerts`).
- New presentational component: `frontend/src/components/dashboard/anomaly-alerts-table.tsx` (kebab-case).
- Fetching/threshold state: `App.tsx` or `frontend/src/lib/api.ts` — not inside every child chart.

### 3.2 Threshold control

| Property | Requirement |
|----------|-------------|
| Control | Number input (or slider + number) labeled e.g. “Alert threshold” |
| Range | Minimum `0.01`, maximum `1.0` |
| Default | `0.3` (matches API default) |
| Step | `0.01` recommended |
| Semantics | Ratio: `0.3` means “outcome more than 30% above baseline” |
| Behavior | On change (debounced ~300ms or on blur/Apply), refetch alerts with `?threshold=<value>` |
| Invalid input | Clamp or block values outside `0.01`–`1.0`; do not call API with out-of-range UI values |

Note: API allows `threshold >= 0` including `0`; **this product UI** intentionally restricts to `0.01`–`1.0`.

### 3.3 Table columns

Exactly **four** columns, mapped as follows:

| Column header (UI) | API field | Display format |
|--------------------|-----------|----------------|
| Period | `period` | Raw string (e.g. `2025-03`) |
| Recorded outcome | `outcome_total` | Currency via `formatCurrency` |
| Rolling average of previous 3 periods | `baseline_average` | Currency via `formatCurrency` (see §2.2 note on algorithm) |
| Percentage increase | `increase_ratio` | Percent: `(increase_ratio * 100)` with one decimal, e.g. `23.5%` (or reuse/extend `formatPercent`) |

Sort order: keep API order (chronological by construction of `detect_outcome_alerts`).

### 3.4 Empty state (explicit)

When the response is `[]` (HTTP 200, empty list):

- Do **not** render an empty `<table>` with only headers, or a silent blank area.
- Show a clear message in the section body, e.g.:

> No outcome anomalies detected for the current threshold.

If threshold is high (e.g. `1.0`) and list is empty, the same empty state applies.

### 3.5 Loading & errors

- `loading`: skeleton rows or card skeleton consistent with chart cards.
- Non-OK response: surface error in section or shared banner; preserve error detail for debugging.
- English copy only.

---

## 4. Types to add (frontend)

```ts
export interface MetricsAlert {
  period: string
  outcome_total: number
  baseline_average: number
  increase_ratio: number
}
```

---

## 5. Acceptance criteria

- [ ] Alerts section appears below the two charts on the main dashboard.
- [ ] Threshold input defaults to `0.3`, accepts `0.01`–`1.0`, and refetches `GET /api/metrics/alerts?threshold=…`.
- [ ] Table has exactly the four columns specified, bound to the four API fields.
- [ ] Percentage column shows ratio × 100 as a percent string.
- [ ] Empty API list shows the explicit empty-state message.
- [ ] Loading and error states are handled without swallowing failures.

---

## 6. Out of scope

- Changing `detect_outcome_alerts` to a true 3-period rolling window (backend change; track separately if product insists on literal “3 periods”).
- `group_by` / `business_type` UI controls.
- Alert acknowledgment or persistence.
