/**
 * Strict query-parameter contracts for dashboard extension API calls.
 *
 * Derived from `frontend/specs/date-range.md`, `anomaly-alerts.md`, and `b2bvsb2c.md`,
 * aligned with FastAPI `Query` definitions in `backend/app/routes.py`.
 *
 * Serialize only defined properties into the query string; omit `undefined` keys.
 * Do not use `any` or `object`.
 */

import type { BusinessType, IsoDateString, OperationType } from "./api-types";

/**
 * Optional inclusive date bounds shared by metrics, alerts, and top-categories requests.
 *
 * @remarks
 * Maps to FastAPI query names `start_date` and `end_date`.
 * When both are set, clients must enforce `start_date <= end_date` before calling the API.
 */
export interface DateRangeFilter {
  /**
   * Inclusive lower bound on movement `create_date`.
   *
   * @remarks
   * - **Query name:** `start_date`.
   * - **Format:** `YYYY-MM-DD` ({@link IsoDateString}).
   * - **Required:** No — omit the query param when unset/empty.
   * - **Valid range:** Any ISO calendar date; preferably within facets `min_date`…`max_date` for UX.
   * - **API behavior:** Keeps rows with `create_date >= start_date`.
   */
  start_date?: IsoDateString;

  /**
   * Inclusive upper bound on movement `create_date`.
   *
   * @remarks
   * - **Query name:** `end_date`.
   * - **Format:** `YYYY-MM-DD` ({@link IsoDateString}).
   * - **Required:** No — omit the query param when unset/empty.
   * - **Valid range:** Any ISO calendar date; must be `>= start_date` when both are present.
   * - **API behavior:** Keeps rows with `create_date <= end_date`.
   */
  end_date?: IsoDateString;
}

/**
 * Query parameters for `GET /api/metrics/alerts`.
 *
 * Combines the product threshold control with optional {@link DateRangeFilter} bounds
 * (for example when FE-DATE-RANGE is active on the main dashboard).
 */
export interface AlertsParams extends DateRangeFilter {
  /**
   * Minimum relative outcome increase required to emit an alert row.
   *
   * @remarks
   * - **Query name:** `threshold`.
   * - **Required:** Yes for the product UI (API defaults to `0.3` if omitted).
   * - **UI valid range:** `0.01`–`1.0` inclusive (product restriction).
   * - **API valid range:** `>= 0` (`Query(ge=0)`); do not send UI values outside `0.01`–`1.0`.
   * - **Default (UI + API):** `0.3` (30% above baseline).
   * - **Step (UI):** `0.01` recommended.
   * - **Semantics:** Alert when `(outcome - baseline) / baseline > threshold`.
   * - **Formatting:** Pass as a decimal ratio in the query string (example: `0.3`), not as a percent integer.
   */
  threshold: number;
}

/**
 * Query parameters for `GET /api/metrics/categories/top`.
 *
 * Used by the B2B vs B2C page with `operation_type: "income"` and `limit: 5`,
 * plus optional {@link DateRangeFilter} bounds.
 */
export interface TopCategoriesParams extends DateRangeFilter {
  /**
   * Which movement direction to aggregate.
   *
   * @remarks
   * - **Query name:** `operation_type`.
   * - **Valid values:** `"income"` | `"outcome"` ({@link OperationType}).
   * - **API default:** `"outcome"` if omitted — **must set `"income"`** for FE-B2B-VS-B2C.
   * - **Required (this product feature):** Yes — always send explicitly.
   */
  operation_type: OperationType;

  /**
   * Maximum number of category rows to return, highest `total_amount` first.
   *
   * @remarks
   * - **Query name:** `limit`.
   * - **API valid range:** Integer `1`–`20` inclusive (`Query(ge=1, le=20)`).
   * - **API default:** `5`.
   * - **B2B vs B2C page:** Use `5`.
   * - **Formatting:** Integer query value (example: `5`).
   */
  limit: number;

  /**
   * Optional commercial segment filter.
   *
   * @remarks
   * - **Query name:** `business_type`.
   * - **Valid values:** `"B2B"` | `"B2C"` ({@link BusinessType}).
   * - **Required:** No for the raw API; **required in practice** for FE-B2B-VS-B2C
   *   (one request with `"B2B"`, one with `"B2C"`).
   * - **Formatting:** Exact uppercase literals `B2B` / `B2C`.
   */
  business_type?: BusinessType;
}
