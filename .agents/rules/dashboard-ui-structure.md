# Rule: Dashboard UI Structure and Naming

## Name

`dashboard-ui-structure`

## Scope

**When it applies**

- Adding or renaming React components for the financial dashboard
- Changing layout composition in `App.tsx`
- Adding UI primitives used by KPI/chart cards

**Where it applies**

| Area | Paths |
|------|--------|
| App shell | `frontend/src/App.tsx`, `frontend/src/main.tsx` |
| Dashboard feature components | `frontend/src/components/dashboard/**/*` |
| Shared UI primitives | `frontend/src/components/ui/**/*` |
| Types/utils for UI | `frontend/src/lib/financial-types.ts`, `frontend/src/lib/financial-utils.ts`, `frontend/src/lib/utils.ts` |

**Does not apply** to backend Python or Docker Compose.

## Rationale

The frontend is a **single-page dashboard** (no React Router). Structure is already conventional and easy to automate against:

- Feature widgets live under `components/dashboard/` with **kebab-case** filenames (`kpi-card.tsx`, `income-outcome-chart.tsx`)
- Primitives live under `components/ui/` (`card.tsx`, `skeleton.tsx`) following shadcn-style (`components.json`)
- Imports use the `@/` alias (`vite.config.ts` / `tsconfig.app.json`)
- KPI and chart components accept `loading?: boolean` and render `Skeleton` placeholders

Agents that invent `src/pages/`, PascalCase filenames, or Redux for this app fight the existing architecture. This rule keeps UI changes drop-in compatible with `App.tsx`.

## Requirements

### Must

1. Place new dashboard widgets in `frontend/src/components/dashboard/` using **kebab-case** file names (e.g. `top-categories-chart.tsx`).
2. Place reusable presentational primitives (Card, Skeleton, Button) in `frontend/src/components/ui/`, not inside `dashboard/`.
3. Export a named function component from each dashboard file; compose them from `App.tsx` (still the only screen) unless routing is intentionally introduced.
4. Import with `@/` (e.g. `@/components/dashboard/kpi-row`, `@/lib/financial-utils`).
5. For data-backed widgets, accept explicit props (`data`, `metrics`, `loading`) rather than fetching inside every child; keep fetch orchestration in `App.tsx` or a dedicated `lib` API module.
6. Support `loading` with existing `Skeleton` patterns used by `KPICard` / chart components.

### Should

1. Prefer extending `KPIRow` / chart cards over creating a second parallel layout system.
2. Derive display strings with `formatCurrency` / `formatPercent` from `financial-utils.ts`.
3. Keep period labels consistent with actual data range (avoid hardcoding `"2024 - Full Year"` when movements follow `date.today()` from the API) when touching the header.
4. Match surrounding quote/semicolon style within a file you edit; do not mass-reformat unrelated files.

## Concrete examples (this repo)

```text
# ❌ BAD
frontend/src/components/KPICard.tsx
frontend/src/pages/Dashboard.tsx
frontend/src/components/dashboard/IncomeOutcomeChart/index.tsx

# ✅ GOOD
frontend/src/components/dashboard/kpi-card.tsx
frontend/src/components/dashboard/income-outcome-chart.tsx
frontend/src/App.tsx   # composition root
```

```tsx
# ❌ BAD — child fetches and ignores loading UX
export function NewChart() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch("/api/metrics").then(...); }, []);
  return <LineChart data={data} />;
}

# ✅ GOOD — props in, loading supported (see IncomeOutcomeChart)
export function NewChart({ data, loading }: { data: MonthlyDataPoint[]; loading?: boolean }) {
  if (loading) return (/* Skeleton card */);
  return (/* Recharts using data */);
}
```

## Current composition map (do not invent a parallel tree)

| Widget | File | Parent |
|--------|------|--------|
| Header | `dashboard-header.tsx` | `App.tsx` |
| KPI row | `kpi-row.tsx` → `kpi-card.tsx` | `App.tsx` |
| Income/outcome chart | `income-outcome-chart.tsx` | `App.tsx` |
| Profit % chart | `profit-percent-chart.tsx` | `App.tsx` |

Charts use **Recharts** (`LineChart`, etc.). Prefer the same library for new time-series widgets unless a dependency change is explicitly requested.

## Agent checklist

- [ ] New file path uses `components/dashboard/` + kebab-case (or `components/ui/` for primitives)
- [ ] `@/` imports
- [ ] No per-widget fetch unless justified; props + `loading` supported
- [ ] Wired into `App.tsx` composition if user-visible
- [ ] Domain field types still come from `financial-types.ts`, not inline string unions in the component
