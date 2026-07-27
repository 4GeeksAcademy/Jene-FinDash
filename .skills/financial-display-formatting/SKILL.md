---
name: financial-display-formatting
description: >-
  Enforce FinDash financial money/percent display rules, KPI profit-margin math,
  and domain naming (income/outcome). Use when formatting currency or percents,
  adding KPI/chart labels, editing financial-utils, or reviewing dashboard UI
  for money presentation consistency.
---

# Financial Display Formatting

Domain skill for the Financial Metrics Dashboard. General React/a11y skills do not encode this project's money presentation, profit-margin definition, or API vocabulary.

## Objective

Ensure every user-visible money and percentage value on the dashboard:

1. Uses the shared formatters in `frontend/src/lib/financial-utils.ts` (not ad-hoc `$` / `%` string building in components), except documented chart-axis abbreviations.
2. Treats **profit margin** as `(income - outcome) / income * 100`, returning `0` when income is `0`.
3. Preserves API/domain naming: `income` / `outcome` (not `revenue` / `expense` / `cost` on wire types or query params that mirror the backend).
4. Keeps monetary **display** in USD (`en-US`) with **zero** fraction digits; keeps percentage **display** with **exactly one** fraction digit and a trailing `%`.

## Defined Inputs

### Primary targets (must comply)

| Path | Why |
|------|-----|
| `frontend/src/lib/financial-utils.ts` | Canonical `formatCurrency`, `formatPercent`, `computeKPIs`, `computeMonthlyData` |
| `frontend/src/lib/financial-types.ts` | Domain unions and movement/KPI shapes |
| `frontend/src/lib/financial-utils.test.ts` | Locks formatter + margin behavior |
| `frontend/src/components/dashboard/kpi-row.tsx` | KPI currency / percent display |
| `frontend/src/components/dashboard/kpi-card.tsx` | Presents preformatted value strings |
| `frontend/src/components/dashboard/income-outcome-chart.tsx` | Tooltips / data tables for money |
| `frontend/src/components/dashboard/profit-percent-chart.tsx` | Tooltips / data tables for percents |
| `frontend/src/App.tsx` | Orchestrates KPI computation via utils |

### Secondary targets (vocabulary alignment)

| Path | Why |
|------|-----|
| `backend/app/routes.py` | Source of `operation_type`, amount rounding, alert ratios |
| `frontend/specs/api-types.ts` / `param-types.ts` | Spec contracts must keep `income` / `outcome` literals |

### Snippets agents must recognize

```ts
// Canonical currency display
formatCurrency(value) // Intl en-US USD, 0 fraction digits → "$1,235"

// Canonical percent display (value is already a percent number, e.g. 15.555)
formatPercent(value) // → "15.6%"

// Canonical margin
profitPercent = totalIncome > 0 ? (profit / totalIncome) * 100 : 0
```

```ts
// ❌ Forbidden in dashboard UI for full money/percent labels
`$${amount}`
amount.toFixed(2)
`${ratio * 100}%`        // wrong when value is already a percent
value.toFixed(1) + '%'   // bypasses formatPercent
```

**Allowed exception:** compact chart **axis** tick formatters may use abbreviated forms such as `` `$${(v / 1000).toFixed(0)}k` `` or `` `${v.toFixed(0)}%` `` for axis density only. Tooltips, tables, KPI cards, and body text must use `formatCurrency` / `formatPercent`.

## Expected Output

### Currency

```ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
```

Examples: `1234.56` → `"$1,235"`; `0` → `"$0"`.

### Percent (display)

```ts
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
```

Examples: `15.555` → `"15.6%"`; `80` → `"80.0%"`.

### KPI / monthly margin

```ts
const profit = totalIncome - totalOutcome;
const profitPercent = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
```

### Component usage

```tsx
// KPI row
value={metrics ? formatCurrency(metrics.totalIncome) : "—"}
value={metrics ? formatPercent(metrics.profitPercent) : "—"}

 // Chart tooltip / accessible table cell
{formatCurrency(entry.value)}
{formatPercent(row.profitPercent)}
```

### Domain naming

- Prefer labels “Income” / “Outcome” when reflecting `operation_type`.
- Do not rename API fields to `revenue` / `expense` in TypeScript types that mirror `/api/metrics`.

## Acceptance Criteria

A file **passes** this skill only if all applicable rules hold:

1. **Formatter centralization**  
   Any new or edited dashboard UI that shows a full money amount imports and calls `formatCurrency` from `@/lib/financial-utils` (or `./financial-utils`).  
   Any new or edited dashboard UI that shows a full percentage label imports and calls `formatPercent` (except axis tick exceptions above).

2. **No ad-hoc money strings in KPI / tooltip / table cells**  
   Disallow in those contexts: template literals starting with `` `$` ``, `toLocaleString` used for currency without going through `formatCurrency`, or `toFixed` used to build percent labels instead of `formatPercent`.

3. **Currency contract**  
   `formatCurrency` remains `en-US` + `USD` + `minimumFractionDigits: 0` + `maximumFractionDigits: 0`.

4. **Percent contract**  
   `formatPercent` remains `` `${value.toFixed(1)}%` `` (exactly one decimal place).

5. **Zero-income margin**  
   `computeKPIs` / `computeMonthlyData` return `profitPercent === 0` when the relevant income total is `0` (no `NaN` / `Infinity`).

6. **Tests exist**  
   `financial-utils.test.ts` continues to assert currency rounding (`1234.56` → `$1,235`) and percent rounding (`15.555` → `15.6%`) and zero-income margin.

7. **Vocabulary**  
   Wire/domain types keep `operation_type: "income" | "outcome"`; UI copy for those series should not silently rename them to unrelated terms in code identifiers bound to API fields.

## Audit procedure (agents)

When this skill is loaded, run this checklist against the Defined Inputs:

1. Open `financial-utils.ts` and confirm formatter + margin implementations match Expected Output.
2. Search dashboard components for `formatCurrency` / `formatPercent` usage on KPI values, tooltips, and data tables.
3. Search for violations: `` `$``{ ``, `.toFixed(` used next to `%` outside axis tick formatters.
4. Report each violation with file path, line context, and the required replacement (`formatCurrency` / `formatPercent`).
5. Confirm `financial-utils.test.ts` still covers the formatter contracts.

## Non-goals

- Backend amount storage precision (`round(..., 2)` in Python) — separate from UI display digits.
- Alert `increase_ratio` (unitless ratio) vs percent display — convert with `formatPercent(ratio * 100)` only when showing a percent label for ratios.
- Changing chart libraries or visual themes.
