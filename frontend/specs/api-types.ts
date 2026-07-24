/**
 * Strict API response contracts for dashboard extension features.
 *
 * Spec-only module: types and JSDoc only (no runtime values, functions, or framework imports).
 * Aligned with Pydantic / OpenAPI schemas from `backend/app/routes.py` and `/docs`.
 * See `README.md` and `components.md` in this directory.
 *
 * Do not use `any` or `object`.
 */

/**
 * Calendar date string in ISO-8601 calendar-date form.
 *
 * @remarks
 * - **Format:** `YYYY-MM-DD` (example: `"2025-03-15"`).
 * - **Valid range:** Any date FastAPI’s `date` query/parser and HTML `<input type="date">` accept.
 * - Used for facets bounds, date-range filters, and movement `create_date` values over the wire.
 */
export type IsoDateString = string;

/**
 * Movement direction literal matching backend `OperationType`.
 *
 * @remarks
 * - **Valid values:** `"income"` | `"outcome"` only.
 */
export type OperationType = "income" | "outcome";

/**
 * Expense/revenue category literal matching backend `Category`.
 *
 * @remarks
 * - **Valid values:** `"suppliers"` | `"sales"` | `"operational"` | `"administrative"` | `"others"`.
 */
export type Category = "suppliers" | "sales" | "operational" | "administrative" | "others";

/**
 * Commercial segment literal matching backend `BusinessType`.
 *
 * @remarks
 * - **Valid values:** `"B2B"` | `"B2C"` only (exact casing).
 */
export type BusinessType = "B2B" | "B2C";

/**
 * Date-only slice of {@link FacetsResponse} used by date-range UI labels and input bounds.
 *
 * @see FE-DATE-RANGE — display “Available data: {min_date} → {max_date}”.
 */
export interface AvailableDateRange {
  /**
   * Earliest movement `create_date` in the seeded dataset.
   *
   * @remarks
   * - **Format:** `YYYY-MM-DD`.
   * - **Source:** {@link FacetsResponse.min_date} from `GET /api/metrics/facets`.
   * - **Valid range:** Always `<= max_date` when facets succeed; dates track `date.today()`-relative mock generation, not a fixed calendar year.
   * - **UI use:** Label for available range; preferred `min` attribute on date inputs.
   */
  min_date: IsoDateString;

  /**
   * Latest movement `create_date` in the seeded dataset.
   *
   * @remarks
   * - **Format:** `YYYY-MM-DD`.
   * - **Source:** {@link FacetsResponse.max_date} from `GET /api/metrics/facets`.
   * - **Valid range:** Always `>= min_date` when facets succeed.
   * - **UI use:** Label for available range; preferred `max` attribute on date inputs.
   */
  max_date: IsoDateString;
}

/**
 * Response body of `GET /api/metrics/facets` (backend `MetricsFacets`).
 *
 * Serves as the shared contract for:
 * - **Date range reference** (`min_date` / `max_date`) on the main dashboard filter.
 * - **B2B/B2C view data** (`business_types`, plus optional period context from the date bounds).
 *
 * @see FE-DATE-RANGE, FE-B2B-VS-B2C
 */
export interface FacetsResponse {
  /**
   * Distinct operation types present in mock movements.
   *
   * @remarks
   * - **Valid element values:** `"income"` | `"outcome"`.
   * - **Expected (tests):** both values, sorted ascending.
   * - **Date-range feature:** Not required for the filter control itself.
   * - **B2B/B2C page:** Optional context; income tables use `categories/top` instead.
   */
  operation_types: OperationType[];

  /**
   * Distinct business segments present in mock movements.
   *
   * @remarks
   * - **Valid element values:** `"B2B"` | `"B2C"`.
   * - **Expected (tests):** `["B2B", "B2C"]`.
   * - **B2B/B2C page:** Guard or empty-state a section when its literal is missing.
   * - **Date-range feature:** Unused by the date inputs.
   */
  business_types: BusinessType[];

  /**
   * Distinct categories present in mock movements.
   *
   * @remarks
   * - **Valid element values:** members of {@link Category}.
   * - **Expected (tests):** administrative, operational, others, sales, suppliers (sorted).
   * - **B2B/B2C page:** Informational; top-income rows still come from `categories/top`.
   */
  categories: Category[];

  /**
   * Earliest available movement date — date-range reference lower bound.
   *
   * @remarks
   * - **Format:** `YYYY-MM-DD`.
   * - Same semantics as {@link AvailableDateRange.min_date}.
   * - **UI (date range):** “Available data” start; preferred input `min`.
   * - **UI (B2B vs B2C):** Optional page subtitle start.
   */
  min_date: IsoDateString;

  /**
   * Latest available movement date — date-range reference upper bound.
   *
   * @remarks
   * - **Format:** `YYYY-MM-DD`.
   * - Same semantics as {@link AvailableDateRange.max_date}.
   * - **UI (date range):** “Available data” end; preferred input `max`.
   * - **UI (B2B vs B2C):** Optional page subtitle end.
   */
  max_date: IsoDateString;
}

/**
 * One anomaly row for the alerts table (`MetricsAlert` in the backend).
 *
 * Bound 1:1 to columns in FE-ANOMALY-ALERTS; do not recompute `baseline_average` on the client.
 */
export interface AlertEntry {
  /**
   * Period key for the anomalous outcome bucket.
   *
   * @remarks
   * - **Format when `group_by=month` (default):** `YYYY-MM` (example: `"2025-03"`).
   * - **Format when `group_by=day`:** `YYYY-MM-DD`.
   * - **Format when `group_by=week`:** `YYYY-Www` (ISO week, example: `"2025-W12"`).
   * - **UI:** Render as-is in the “Period” column.
   */
  period: string;

  /**
   * Total outcome amount recorded for {@link AlertEntry.period}.
   *
   * @remarks
   * - **Formatting:** Display with currency formatter (USD, no required fractional digits in UI).
   * - **Valid range:** Finite number `>= 0` (outcomes are non-negative sums from the API).
   * - **API field:** `outcome_total`.
   */
  outcome_total: number;

  /**
   * Baseline outcome average compared against {@link AlertEntry.outcome_total}.
   *
   * @remarks
   * - **Meaning:** Mean of **all prior periods’** outcomes in the summary series (backend
   *   `detect_outcome_alerts`), not a fixed trailing window of three periods.
   * - **Formatting:** Currency, same as `outcome_total`.
   * - **Valid range:** Finite number `> 0` for rows that appear (alerts require `baseline > 0`).
   * - **UI column label (product):** “Rolling average of previous 3 periods” — bind this field; do not invent a 3-period client average.
   * - **API field:** `baseline_average`.
   */
  baseline_average: number;

  /**
   * Relative increase of outcome over the baseline.
   *
   * @remarks
   * - **Formula:** `(outcome_total - baseline_average) / baseline_average`.
   * - **Formatting:** Display as percent: `increase_ratio * 100` with one decimal (example: `0.2345` → `"23.5%"`).
   * - **Valid range:** Finite number; API rounds to 4 decimal places. Rows are emitted only when
   *   `increase_ratio > threshold` (strict greater-than).
   * - **Semantics:** `0.3` means 30% above baseline.
   * - **API field:** `increase_ratio`.
   */
  increase_ratio: number;
}

/**
 * Ordered list of anomaly rows returned by `GET /api/metrics/alerts`.
 *
 * @remarks
 * - **Wire shape:** JSON array of {@link AlertEntry} (not an envelope object).
 * - **Ordering:** Chronological by period (construction order in `detect_outcome_alerts`).
 * - **Empty list:** Valid HTTP 200 with `[]` — UI must show an explicit empty state, not a header-only table.
 * - **Length:** Unbounded; typically small relative to the number of summary periods.
 */
export type AlertsResponse = AlertEntry[];

/**
 * One top-category row from `GET /api/metrics/categories/top` (`TopCategoryItem` in the backend).
 *
 * Used by the B2B vs B2C comparison tables and as the source series for the income comparison chart.
 */
export interface CategoryEntry {
  /**
   * Category name for the aggregated income (or outcome) total.
   *
   * @remarks
   * - **Valid values:** {@link Category} literals only.
   * - **UI:** “Category name” column (raw literal; title-case in presentation is optional).
   * - **API field:** `category`.
   */
  category: Category;

  /**
   * Whether this total is income or outcome.
   *
   * @remarks
   * - **Valid values:** `"income"` | `"outcome"`.
   * - **B2B vs B2C page:** Requests must use `"income"`; treat any other value as unexpected.
   * - **API field:** `operation_type`.
   */
  operation_type: OperationType;

  /**
   * Aggregated amount for {@link CategoryEntry.category} and {@link CategoryEntry.operation_type}.
   *
   * @remarks
   * - **Formatting:** Currency via `formatCurrency` (total income column).
   * - **Valid range:** Finite number `>= 0`; API rounds to 2 decimal places.
   * - **Ordering:** Server returns rows sorted by `total_amount` descending.
   * - **API field:** `total_amount`.
   */
  total_amount: number;
}

/**
 * Collection of top-category rows from `GET /api/metrics/categories/top`.
 *
 * @remarks
 * - **Wire shape:** JSON array of {@link CategoryEntry} (not an envelope object).
 * - **Length:** Between `0` and `limit` inclusive (`limit` query default `5`, API max `20`).
 * - **B2B vs B2C:** Issue separate requests with `business_type=B2B` and `business_type=B2C`.
 * - **Percentage of total:** Not returned by the API — derive client-side as
 *   `total_amount / sum(rows.total_amount) * 100` for that segment’s response.
 */
export type TopCategoriesResponse = CategoryEntry[];

/**
 * {@link CategoryEntry} enriched with a client-computed share of the segment total.
 *
 * Used only in the B2B/B2C comparison table view model (not an API wire type).
 */
export interface CategoryEntryWithShare extends CategoryEntry {
  /**
   * Share of this row’s `total_amount` within the sum of amounts in the same
   * {@link TopCategoriesResponse} used to render the table.
   *
   * @remarks
   * - **Formula:** `(total_amount / Σ total_amount of sibling rows) * 100`.
   * - **Formatting:** One decimal percent string via `formatPercent` (example: `42.5` → `"42.5%"`).
   * - **Valid range:** `0`–`100` when the sibling sum is `> 0`; define helper behavior for a zero sum (typically `0`).
   * - **Not an API field** — computed in `financial-utils` (or equivalent pure helper).
   */
  percentOfTotal: number;
}

/**
 * Side-by-side view model for the B2B vs B2C income comparison page.
 *
 * Aggregates facets date context plus each segment’s top income categories.
 */
export interface B2BVsB2CViewData {
  /**
   * Available movement date window from facets, for optional page subtitle.
   *
   * @remarks
   * - **Source:** `min_date` / `max_date` of {@link FacetsResponse}.
   * - **Optional in UI:** May be omitted from rendering if facets fail; tables can still load.
   */
  availableRange: AvailableDateRange;

  /**
   * Business types reported by {@link FacetsResponse.business_types} for presence checks.
   *
   * @remarks
   * - **Valid element values:** `"B2B"` | `"B2C"`.
   * - Hide or empty-state a column when its literal is absent.
   */
  businessTypesPresent: BusinessType[];

  /**
   * Top income categories for the B2B segment (`business_type=B2B`).
   *
   * @remarks
   * - **Source:** {@link TopCategoriesResponse} for B2B, optionally mapped to {@link CategoryEntryWithShare}.
   * - **Expected length:** `0`–`5` when requested with `limit=5`.
   */
  b2bCategories: CategoryEntryWithShare[];

  /**
   * Top income categories for the B2C segment (`business_type=B2C`).
   *
   * @remarks
   * - **Source:** {@link TopCategoriesResponse} for B2C, optionally mapped to {@link CategoryEntryWithShare}.
   * - **Expected length:** `0`–`5` when requested with `limit=5`.
   */
  b2cCategories: CategoryEntryWithShare[];
}
