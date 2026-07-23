# Spec: B2B vs B2C Comparison Page

| Field | Value |
|-------|--------|
| Spec ID | `FE-B2B-VS-B2C` |
| Status | Draft |
| Target area | **New page/view** for side-by-side B2B vs B2C income comparison |
| Primary APIs | `GET /api/metrics/categories/top?operation_type=income&limit=5` (+ `business_type`) · `GET /api/metrics/facets` |
| Related rules | `.agents/rules/dashboard-ui-structure.md` (routing intentionally introduced), `api-contracts-and-errors.md`, `pure-domain-logic.md` |

---

## 1. Goal

Create a **new page** that compares **B2B** and **B2C** income side by side:

1. Two parallel sections (B2B \| B2C), each with a table of the **top 5 income categories** showing category name, total income, and percentage of total.
2. **Below** both tables, a **single** comparison chart for income (one chart, both business types).

---

## 2. Backend contracts (source of truth)

### 2.1 Facets

**`GET /api/metrics/facets`** → `MetricsFacets` (`backend/app/routes.py`).

| Field | Use on this page |
|-------|------------------|
| `business_types` | Expect `["B2B","B2C"]` (verified by `test_metrics_facets_returns_filter_options_and_date_range`). Guard UI if a type is missing. |
| `min_date` / `max_date` | Optional subtitle / period context for the page |
| `categories` / `operation_types` | Not required for layout |

No query params.

### 2.2 Top income categories

**`GET /api/metrics/categories/top`** — handler `get_top_categories`.

| Query param | Value for this spec |
|-------------|---------------------|
| `operation_type` | **`income`** (required for this feature; API default is `outcome` — must override) |
| `limit` | **`5`** |
| `business_type` | **`B2B`** for left section; **`B2C`** for right section |
| `start_date` / `end_date` | Optional; wire later if date-range is global |

**Response model `TopCategoryItem`:**

| Field | Type | UI use |
|-------|------|--------|
| `category` | Category literal | Category name column |
| `operation_type` | `"income"` | Assert / ignore in UI |
| `total_amount` | `float` | Total income column |

Sorted descending by `total_amount` (server-side in `build_top_categories`).

**Required calls:**

```http
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B
GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C
GET /api/metrics/facets
```

### 2.3 Percentage of total (client-derived)

The API does **not** return a percentage field. Compute on the client in a pure helper (e.g. `frontend/src/lib/financial-utils.ts`):

\[
\text{percentage} = \frac{\text{total\_amount}}{\sum \text{total\_amount over returned rows for that business type}} \times 100
\]

With `limit=5`, the denominator is the sum of the up-to-five returned income category totals for that `business_type` (share of top-5 income for that segment). Document this in the table helper text: “% of top income categories shown” if needed for clarity.

If a segment returns fewer than 5 rows, still compute against the sum of returned rows.

---

## 3. Navigation / page structure

### 3.1 New page (routing required)

Today the app is a single `App.tsx` screen with **no React Router**. This feature **intentionally introduces** a second view.

**Must:**

1. Add client routing (recommend `react-router` as a new dependency) **or** an equivalent explicit view switch in the shell with clear URLs.
2. Suggested routes:
   - `/` — existing Financial Overview dashboard
   - `/b2b-vs-b2c` — this comparison page
3. Add navigation links between Overview and B2B vs B2C (header or simple nav).
4. Page components under kebab-case paths, e.g.:
   - `frontend/src/components/dashboard/b2b-vs-b2c-page.tsx` (page composition)
   - `frontend/src/components/dashboard/top-income-categories-table.tsx`
   - `frontend/src/components/dashboard/b2b-b2c-income-chart.tsx`

Do **not** invent `src/pages/Dashboard.tsx` PascalCase trees that conflict with existing conventions; prefer `components/dashboard/*` + a thin router entry in `App.tsx` / `main.tsx`.

---

## 4. UI requirements

### 4.1 Layout — side-by-side tables

```text
[ Nav: Overview | B2B vs B2C ]
[ Page title: B2B vs B2C Income ]
[ Optional: Available data min_date → max_date from facets ]

┌─────────────────────────┐  ┌─────────────────────────┐
│ B2B                     │  │ B2C                     │
│ table (top 5 income)    │  │ table (top 5 income)    │
└─────────────────────────┘  └─────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Single income comparison chart (B2B vs B2C)          │
└──────────────────────────────────────────────────────┘
```

- Desktop: two columns (`grid` / `xl:grid-cols-2`).
- Mobile: stacked sections (B2B then B2C), then chart full width.

### 4.2 Table columns (each section)

| Column | Source |
|--------|--------|
| Category name | `category` |
| Total income | `total_amount` via `formatCurrency` |
| Percentage of total | Client-computed percent via `formatPercent` |

Section heading: **B2B** / **B2C** (match `business_types` literals exactly).

### 4.3 Empty / partial states per section

- Loading: skeleton table (reuse `Skeleton`).
- HTTP error: section-level error message; do not swallow errors.
- Empty array `[]`: explicit message, e.g. “No income categories for B2B.”
- Facets missing a business type: hide that column or show “Not available in data.”

### 4.4 Single comparison chart (below tables)

One chart under both tables comparing **income** for B2B and B2C:

| Requirement | Detail |
|-------------|--------|
| Library | Recharts (same as existing dashboard charts) |
| Suggested type | Grouped vertical bar chart |
| X-axis | Union of category names appearing in either top-5 list |
| Series | Two series: `B2B` and `B2C` (`total_amount`; missing category = `0`) |
| Y-axis | Currency (same `$…k` style as income/outcome chart if practical) |
| Title | e.g. “Income by category: B2B vs B2C” |

Do **not** place two separate charts side by side for this requirement — product asks for a **single** comparison chart.

Alternative acceptable chart if categories don’t align well: two bars for **total** B2B income vs **total** B2C income (sum of each top-5 list), still one chart. Prefer the per-category grouped bar when categories overlap (`sales`, `others`, etc.).

### 4.5 Data flow

```text
enter /b2b-vs-b2c
  ├─ GET /api/metrics/facets
  ├─ GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2B
  └─ GET /api/metrics/categories/top?operation_type=income&limit=5&business_type=B2C
       → pure helper maps rows + percentages
       → tables + comparison chart props
```

Respect Vite proxy: `fetch(`${VITE_API_BASE_URL ?? ""}/api/...`)` (see `vite.config.ts`).

---

## 5. Types to add (frontend)

```ts
export interface TopCategoryItem {
  category: Category
  operation_type: OperationType
  total_amount: number
}

export interface TopCategoryShare extends TopCategoryItem {
  percentOfTotal: number
}

// MetricsFacets — shared with FE-DATE-RANGE if already added
```

Pure helper (illustrative):

```ts
export function withIncomeShare(items: TopCategoryItem[]): TopCategoryShare[]
```

Cover with Vitest in `financial-utils.test.ts`.

---

## 6. Acceptance criteria

- [ ] Navigable page/view distinct from the main overview (URL or equivalent).
- [ ] Facets fetched; page can show available date range and confirms B2B/B2C exist.
- [ ] Two side-by-side (or stacked on mobile) tables, each loaded with `operation_type=income`, `limit=5`, and the correct `business_type`.
- [ ] Columns: category name, total income, percentage of total (client-calculated).
- [ ] One income comparison chart below both tables (Recharts), showing B2B vs B2C.
- [ ] Loading, error, and empty states are explicit per section.
- [ ] Domain math lives in `lib/` with a unit test; components stay presentational.

---

## 7. Out of scope

- Outcome top categories on this page.
- Editing threshold / alerts on this page.
- Backend changes to return percentages.
- Using `/api/metrics/b2b` or `/api/metrics/b2c` movement lists (not required by this spec; top + facets only).
