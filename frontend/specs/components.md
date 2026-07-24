# Component Specifications — Dashboard Extensions

## Shared shell (routing)

```text
main.tsx
  └─ AppRouter
       ├─ `/`             → OverviewDashboard
       └─ `/b2b-vs-b2c`   → B2BVsB2CPage
```

- **`AppRouter`** — mounts routes and a small nav (`Overview` | `B2B vs B2C`).
- **`OverviewDashboard`** — existing KPI + charts composition, plus Feature 1 and Feature 2.
- Presentational widgets live under `frontend/src/components/dashboard/` (kebab-case files).
- Fetch orchestration stays in page hosts or `frontend/src/lib/api.ts` — not inside table/chart children.

---

## Feature 1 — Date range filter (`FE-DATE-RANGE`)

### Components

| Component | File | Role |
|-----------|------|------|
| `DateRangeFilter` | `components/dashboard/date-range-filter.tsx` | Presentational start/end inputs + available-range hint |
| `OverviewDashboard` | `App.tsx` (overview route) | Owns date state, facets fetch, metrics refetch |

### Props — `DateRangeFilter`

```ts
import type { AvailableDateRange } from "../api-types"; // or mirrored from src/lib

interface DateRangeFilterProps {
  /** Controlled start value. Empty string means “no start bound”. Format when set: YYYY-MM-DD. */
  startDate: string;

  /** Controlled end value. Empty string means “no end bound”. Format when set: YYYY-MM-DD. */
  endDate: string;

  /**
   * Date window from FacetsResponse.min_date / max_date.
   * null when facets have not loaded successfully yet.
   */
  availableRange: AvailableDateRange | null;

  /** True while GET /api/metrics/facets is in flight. */
  availableRangeLoading: boolean;

  /** User-visible facets failure message; null when OK or still loading. */
  availableRangeError: string | null;

  /**
   * Client validation message (e.g. start after end).
   * null when the current start/end pair is valid or incomplete (one-sided).
   */
  validationError: string | null;

  /** Called with the raw input value (YYYY-MM-DD or ""). */
  onStartDateChange: (value: string) => void;

  /** Called with the raw input value (YYYY-MM-DD or ""). */
  onEndDateChange: (value: string) => void;

  /** Disables both inputs while metrics reload after a committed change. */
  disabled?: boolean;
}
```

### Visual / DOM layout

```text
<section aria-label="Date range filter" class="…">
  <div>                          <!-- controls row -->
    <label>
      Start
      <input type="date" name="start_date" value={startDate} min? max? />
    </label>
    <label>
      End
      <input type="date" name="end_date" value={endDate} min? max? />
    </label>
  </div>
  <p> or <span>                 <!-- available-range hint (see below) -->
  <p role="alert">              <!-- only if validationError !== null -->
</section>
```

Placement on the overview page:

```text
[ Nav ]
[ DashboardHeader ]
[ DateRangeFilter ]     ← directly above KPI row
[ KPIRow ]
[ Charts ]
[ AnomalyAlertsSection ]
```

- When `availableRange` is loaded, set each `<input type="date">` `min={availableRange.min_date}` and `max={availableRange.max_date}` (UX guidance; does not replace sequence validation).

### Available date range hint (from `FacetsResponse`)

Derive `AvailableDateRange` as:

```ts
{
  min_date: facets.min_date, // FacetsResponse
  max_date: facets.max_date,
}
```

| Facets UI state | What to render next to / below the inputs |
|-----------------|-------------------------------------------|
| `availableRangeLoading === true` | Compact text or skeleton: `Loading available range…` |
| `availableRangeError !== null` | Muted error text: `Available data range unavailable.` (inputs remain enabled) |
| `availableRange !== null` | Exact hint copy: **`Available data: {min_date} → {max_date}`** (ISO `YYYY-MM-DD` values interpolated as returned by the API) |
| `availableRange === null` and not loading and no error | Omit the hint line |

Do not invent a calendar year label (e.g. “2024”) for this hint; always use `min_date` / `max_date` from the facets payload.

### Exact behavior — only one date input filled

| User state | Query sent to `GET /api/metrics` | Validation | UI |
|------------|----------------------------------|------------|-----|
| Start filled, end empty | `?start_date={startDate}` only (`end_date` omitted) | **Valid** — no sequence error | Clear `validationError`. Refetch metrics. KPIs/charts update for `create_date >= startDate`. |
| End filled, start empty | `?end_date={endDate}` only (`start_date` omitted) | **Valid** — no sequence error | Clear `validationError`. Refetch metrics. KPIs/charts update for `create_date <= endDate`. |
| Both empty | No date query params | Valid | Full unfiltered metrics (current default). |
| Both filled and `startDate <= endDate` | `?start_date=…&end_date=…` | Valid | Refetch with both bounds (inclusive). |
| Both filled and `startDate > endDate` | **No request** | Invalid | Set `validationError` to: `Start date must be on or before end date.` Keep showing the last successful metrics/charts. Do not call alerts with this invalid pair either. |

One-sided fills must **not** show the start-after-end validation message.

---

## Feature 2 — Anomaly alerts table (`FE-ANOMALY-ALERTS`)

### Components

| Component | File | Role |
|-----------|------|------|
| `AnomalyAlertsSection` | `components/dashboard/anomaly-alerts-section.tsx` | Section chrome: title, threshold control, conditional body |
| `AlertThresholdInput` | `components/dashboard/alert-threshold-input.tsx` | Controlled threshold field + out-of-range messaging |
| `AnomalyAlertsTable` | `components/dashboard/anomaly-alerts-table.tsx` | Four-column table when `alerts.length > 0` |

### Props — `AlertThresholdInput`

```ts
interface AlertThresholdInputProps {
  /** Current threshold ratio. Product default: 0.3. */
  value: number;

  /**
   * Called only with values inside [0.01, 1.0] after successful validation,
   * or called with the attempted value while parent sets error — see out-of-range rules.
   */
  onChange: (value: number) => void;

  /**
   * Inline validation message when the typed/committed value is outside [0.01, 1.0].
   * null when the current value is in range.
   */
  rangeError: string | null;

  /** Disables the control while alerts are loading. */
  disabled?: boolean;
}
```

### Props — `AnomalyAlertsTable`

```ts
import type { AlertsResponse } from "../api-types";

interface AnomalyAlertsTableProps {
  /** Non-empty list of alert rows from GET /api/metrics/alerts. */
  alerts: AlertsResponse;
}
```

Parent must not mount `AnomalyAlertsTable` when `alerts.length === 0`.

### Props — `AnomalyAlertsSection`

```ts
import type { AlertsResponse } from "../api-types";
import type { DateRangeFilter } from "../param-types";

interface AnomalyAlertsSectionProps {
  threshold: number;
  onThresholdChange: (value: number) => void;
  thresholdRangeError: string | null;

  /** Optional date bounds forwarded into AlertsParams (from Feature 1). */
  dateRange: DateRangeFilter;

  alerts: AlertsResponse;
  loading: boolean;
  error: string | null;
}
```

### Table layout — exactly four columns

| # | Header label (exact) | Data field | Value type | Cell rendering |
|---|----------------------|------------|------------|----------------|
| 1 | `Period` | `period` | `string` | Plain text (e.g. `2025-03`) |
| 2 | `Recorded outcome` | `outcome_total` | `number` | Currency via `formatCurrency` |
| 3 | `Rolling average of previous 3 periods` | `baseline_average` | `number` | Currency via `formatCurrency` (bind API field; do not recompute a 3-period window) |
| 4 | `Percentage increase` | `increase_ratio` | `number` | `(increase_ratio * 100)` formatted to one decimal + `%` (e.g. `23.5%`) |

DOM sketch when data is present:

```text
<section aria-label="Anomaly alerts">
  <h2>Anomaly alerts</h2>
  <AlertThresholdInput … />
  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th>Recorded outcome</th>
        <th>Rolling average of previous 3 periods</th>
        <th>Percentage increase</th>
      </tr>
    </thead>
    <tbody>…one <tr> per AlertEntry…</tbody>
  </table>
</section>
```

### Conditional body rendering

| Condition | Render |
|-----------|--------|
| `loading === true` | Card/`Skeleton` block (or 3–4 skeleton table rows). Do not show the data table or empty copy. |
| `error !== null` | `<p role="alert">` with the error string. No table. |
| `!loading && !error && alerts.length === 0` | **Empty state** (below). No `<table>`. |
| `!loading && !error && alerts.length > 0` | `<AnomalyAlertsTable alerts={alerts} />` |

### Empty state (alerts array empty)

When `alerts` is `[]` (HTTP 200):

- **Do render:** section heading `Anomaly alerts`, and `AlertThresholdInput` (still interactive).
- **Do not render:** `<table>`, table headers alone, or a blank white gap with no explanation.
- **Do render exactly this empty body:**

```text
<p data-testid="anomaly-alerts-empty">
  No outcome anomalies detected for the current threshold.
</p>
```

No illustration/icon is required; plain text is the specified empty UI. Optional muted styling is allowed; content string must match above.

### Threshold out-of-range — validation & UI

**Allowed product range:** `0.01` ≤ threshold ≤ `1.0` (inclusive). Default `0.3`. Step `0.01`.

| Trigger | Constraint | UI / network behavior |
|---------|------------|------------------------|
| User enters / commits value `< 0.01` or `> 1.0` | Out of range | Set `thresholdRangeError` to: **`Threshold must be between 0.01 and 1.0.`** Do **not** call `GET /api/metrics/alerts`. Keep last successful `alerts` (or empty state from last success). |
| User enters non-numeric / empty commit | Invalid | Same error region: **`Enter a numeric threshold between 0.01 and 1.0.`** No API call. |
| Value in range | Valid | Clear `thresholdRangeError`. Debounce ~300ms (or on blur/Apply), then fetch with `AlertsParams.threshold`. |
| HTML attributes | Guidance | Prefer `min={0.01}` `max={1.0}` `step={0.01}` on the number input; still enforce in JS because browsers vary. |

`rangeError` / `thresholdRangeError` is shown immediately under the threshold control (`role="alert"`).

---

## Feature 3 — B2B vs B2C comparison view (`FE-B2B-VS-B2C`)

### Component breakdown

| Component | File | Role |
|-----------|------|------|
| `B2BVsB2CPage` | `components/dashboard/b2b-vs-b2c-page.tsx` | Page host: facets + two top-categories fetches; two-panel layout + chart |
| `TopIncomeCategoriesTable` | `components/dashboard/top-income-categories-table.tsx` | One panel’s top-5 income ranking table |
| `B2BB2CIncomeChart` | `components/dashboard/b2b-b2c-income-chart.tsx` | Single grouped comparison chart under both panels |

### Props — `B2BVsB2CPage` (orchestration surface)

Page may keep state internally; if props are used for testing/storybook:

```ts
import type {
  BusinessType,
  CategoryEntryWithShare,
  FacetsResponse,
} from "../api-types";

interface B2BVsB2CPageProps {
  /** Optional injection for tests; production page fetches itself. */
  initialFacets?: FacetsResponse | null;
}
```

Internal state (specified for implementers):

```ts
facets: FacetsResponse | null;
b2bRows: CategoryEntryWithShare[];
b2cRows: CategoryEntryWithShare[];
b2bLoading: boolean;
b2cLoading: boolean;
b2bError: string | null;
b2cError: string | null;
facetsLoading: boolean;
facetsError: string | null;
```

### Props — `TopIncomeCategoriesTable` (each panel)

```ts
import type { BusinessType, CategoryEntryWithShare } from "../api-types";

interface TopIncomeCategoriesTableProps {
  /** Panel identity and heading text: "B2B" or "B2C". */
  businessType: BusinessType;

  /** Top income categories with client-computed percentOfTotal. */
  rows: CategoryEntryWithShare[];

  loading: boolean;
  error: string | null;

  /**
   * Copy shown when !loading && !error && rows.length === 0.
   * B2B panel: "No income categories for B2B."
   * B2C panel: "No income categories for B2C."
   */
  emptyMessage: string;
}
```

### Props — `B2BB2CIncomeChart`

```ts
import type { CategoryEntryWithShare } from "../api-types";

interface B2BB2CIncomeChartProps {
  /** B2B series source (may be empty). */
  b2bRows: CategoryEntryWithShare[];

  /** B2C series source (may be empty). */
  b2cRows: CategoryEntryWithShare[];

  loading: boolean;
  error: string | null;
}
```

### Two-panel layout (DOM)

```text
[ Nav: Overview | B2B vs B2C ]
[ h1: B2B vs B2C Income ]
[ Optional subtitle from FacetsResponse: Available data: {min_date} → {max_date} ]

<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
  <section aria-label="B2B top income categories">
    <TopIncomeCategoriesTable businessType="B2B" … />
  </section>
  <section aria-label="B2C top income categories">
    <TopIncomeCategoriesTable businessType="B2C" … />
  </section>
</div>

<section aria-label="B2B vs B2C income comparison chart">
  <B2BB2CIncomeChart … />
</section>
```

Each ranking table columns:

| Header | Field | Type |
|--------|-------|------|
| `Category` | `category` | `Category` (string enum) |
| `Total income` | `total_amount` | `number` → `formatCurrency` |
| `Percentage of total` | `percentOfTotal` | `number` → `formatPercent` |

### Exact empty rendering per panel

When a panel’s `rows.length === 0` and `loading === false` and `error === null`:

**Still render:**

- The panel `<section>` and border/card chrome.
- Panel heading: exact text **`B2B`** or **`B2C`** (`businessType`).

**Do not render:**

- A `<table>` with headers only.
- Chart inside the panel (chart stays below, shared).

**Do render inside the panel body:**

```text
<p data-testid="top-categories-empty-{businessType}">
  {emptyMessage}
</p>
```

Required `emptyMessage` values:

- B2B panel → `No income categories for B2B.`
- B2C panel → `No income categories for B2C.`

If `loading`: skeleton rows inside the panel (heading still visible).  
If `error`: `<p role="alert">{error}</p>` inside that panel only; the other panel is unaffected.

### Comparison chart — visual display and two data series

**Visual:** one Recharts **grouped vertical bar chart** (single chart instance under both panels).

- **Title:** `Income by category: B2B vs B2C`
- **X-axis:** category names = union of `category` values from `b2bRows` and `b2cRows` (sorted stably, e.g. alphabetical or B2B-then-B2C insertion order documented in implementation).
- **Y-axis:** income amount (currency ticks, same `$…k` style as the overview income chart when practical).
- **Legend:** two entries — `B2B` and `B2C`.

**The two data series (explicit meaning):**

| Series key | Represents | Value per category |
|------------|------------|--------------------|
| `B2B` | Total income for that category in the **B2B** top-5 response (`business_type=B2B`, `operation_type=income`) | `total_amount` from the matching `CategoryEntryWithShare`, or **`0`** if that category is absent from `b2bRows` |
| `B2C` | Total income for that category in the **B2C** top-5 response (`business_type=B2C`, `operation_type=income`) | `total_amount` from the matching row, or **`0`** if absent from `b2cRows` |

These are **not** net profit, outcome, or period-comparison deltas — only **income totals by category**, segmented by business type.

| Chart data condition | Render |
|----------------------|--------|
| `loading` | Chart card skeleton |
| `error` | Alert text; no axes |
| Both `b2bRows` and `b2cRows` empty | Chart card with body text: `No data available to display` (no bars) |
| Only one side empty | Still draw the chart; missing side’s bars are `0` for shared categories; categories only on the non-empty side still appear with the other series at `0` |

---

## Conditional rendering cheat sheet

### Feature 1 (`DateRangeFilter`)

- Hint line ↔ facets loading / error / success (see table above).
- `validationError` alert ↔ only when both dates filled and start > end.
- One-sided dates ↔ valid refetch with a single query param.

### Feature 2 (`AnomalyAlertsSection`)

- loading → skeletons  
- error → alert  
- empty array → exact empty paragraph (no table)  
- non-empty → four-column table  
- out-of-range threshold → `thresholdRangeError` under input; no alerts fetch

### Feature 3 (`B2BVsB2CPage`)

- Per-panel loading / error / empty message / table  
- Shared chart with series `B2B` and `B2C` income by category

---

## Non-negotiables

- No `any` / loose `object` in feature TypeScript.
- No `fetch` inside `AnomalyAlertsTable`, `TopIncomeCategoriesTable`, or `B2BB2CIncomeChart`.
- English UI copy only.
- Preserve HTTP/error detail when catching failures (log or store); never empty `.catch(() => …)`.
