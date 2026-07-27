# Recent Changes - Activity Log by Jenefa

> Daily log of agent/engineering work on branch `feature/agent-skills`.  
> Companion to `product-overview.md`, `tech-stack.md`, and `status.md`.

## Session summary

Focused on **agent skills**: installing frontend skills, applying accessibility and performance guidance to the Vite/React dashboard, then authoring a **FinDash-specific** financial display skill under `.skills/`.

---

## Skills applied


| Skill                           | Location                                               | How it was used                                                                                                      |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **accessibility** (WCAG 2.2)    | `frontend/.agents/skills/accessibility/`               | Audited and fixed dashboard ARIA, keyboard reachability, decorative icons, contrast, and chart data alternatives     |
| **vercel-react-best-practices** | `frontend/.agents/skills/vercel-react-best-practices/` | Performance pass adapted for **Vite** (not Next.js): meta/description, font loading, CLS reserves, lazy chart chunks |
| **best-practices**              | `frontend/.agents/skills/best-practices/`              | Available via `frontend/skills-lock.json`; not the primary driver of today’s code edits                              |
| **convex-performance-audit**    | `frontend/.agents/skills/convex-performance-audit/`    | Present in the lockfile; **not applicable** (no Convex backend) — skipped for runtime changes                        |


Lockfile: `frontend/skills-lock.json` (sources: addyosmani/web-quality-skills, vercel-labs/agent-skills, get-convex/agent-skills).

---

Reason to add new skill - Performance

-  Integrating the **performance** skill is highly relevant to the development goals for the financial dashboard. It provides the agent with specific constraints to optimize images via `next/image`, eliminate layout-shift vulnerabilities, and rectify unoptimized font imports."

## Skill authored today


| Field         | Detail                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| **Name**      | `financial-display-formatting`                                              |
| **Path**      | `.skills/financial-display-formatting/SKILL.md`                             |
| **Validator** | `.skills/financial-display-formatting/scripts/validate.py`                  |
| **Focus**     | Domain money/percent display rules not covered by general React/a11y skills |




### What the skill encodes

1. **Currency** — `formatCurrency`: `en-US` / `USD` / 0 fraction digits via `frontend/src/lib/financial-utils.ts`
2. **Percent** — `formatPercent`: exactly one decimal + `%`
3. **Margin math** — `(income - outcome) / income * 100`, with `profitPercent = 0` when income is `0`
4. **Vocabulary** — keep API/domain `income` / `outcome` (not revenue/expense on wire types)
5. **Centralization** — KPI/tooltip/table cells must use shared formatters; compact chart **axis** ticks may stay abbreviated



### Validation result (skill loaded against codebase)

Ran `python3 .skills/financial-display-formatting/scripts/validate.py`:

- **9 passes** — formatters, zero-income guards, unit tests, `kpi-row`, income chart usage
- **1 failure surfaced as guidance** — `profit-percent-chart.tsx` tooltip still uses `value.toFixed(1)%` instead of `formatPercent(value)` (axis `tickFormatter` correctly treated as an allowed exception)

---



## Code / product changes today



### Accessibility (dashboard)

Touched: `App.tsx`, `dashboard-header.tsx`, `kpi-card.tsx`, `kpi-row.tsx`, `income-outcome-chart.tsx`, `profit-percent-chart.tsx`, `index.css`.

Notable outcomes:

- Skip link + ARIA landmarks / labels; error UI as `role="alert"`
- Decorative icons `aria-hidden`; chart SVGs treated as decorative with keyboard-accessible data tables (`<details>` / `<summary>`)
- Contrast tweaks for muted / badge / destructive text; focus-visible and reduced-motion support



### Performance (Vite adaptations)

Touched: `index.html`, `main.tsx`, `index.css`, `package.json` / lockfile, chart components (lazy load), layout CSS.

Notable outcomes:

- Meta description in `index.html`; dark class on `<html>` to reduce FOUC
- `@fontsource-variable/inter` with `font-display: swap`
- CLS reserves (e.g. `.chart-plot`, KPI content min-heights)
- Lazy-loaded Recharts chart components; production `npm run build` verified after split
- Explicitly **did not** adopt `next/image` / Next Metadata API — app is Vite + React, not Next.js



### Specs / prior workstream (context, not re-done today)

`frontend/specs/` remains the four-file specs set (`api-types.ts`, `param-types.ts`, `components.md`, `README.md`) from the earlier feature-spec branch work.

---



## Working tree note (end of day)

Uncommitted / new at time of this log:

- Modified frontend dashboard + HTML/CSS/package files (a11y + performance)
- Untracked: `.skills/` (authored skill), `frontend/.agents/` (installed skills), `frontend/skills-lock.json`

Branch: `feature/agent-skills`.

---



## Follow-ups suggested by today’s skill audit

1. Replace profit chart tooltip `value.toFixed(1)%` with `formatPercent(value)` to fully satisfy `financial-display-formatting`
2. Optionally re-run `validate.py` after that fix (expect exit code 0)
3. Update `memory-bank/status.md` when skills land on the branch (status still notes `.agents/skills` as missing at repo root — frontend skills now live under `frontend/.agents/skills/`, plus project skill under `.skills/`)

