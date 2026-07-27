#!/usr/bin/env python3
"""Validate FinDash codebase against financial-display-formatting skill rules."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FRONTEND_SRC = ROOT / "frontend" / "src"
UTILS = FRONTEND_SRC / "lib" / "financial-utils.ts"
TESTS = FRONTEND_SRC / "lib" / "financial-utils.test.ts"
DASHBOARD = FRONTEND_SRC / "components" / "dashboard"

failures: list[str] = []
guidance: list[str] = []
passes: list[str] = []


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_formatters() -> None:
    text = read(UTILS)
    if 'currency: "USD"' in text and "minimumFractionDigits: 0" in text and "maximumFractionDigits: 0" in text:
        passes.append("formatCurrency uses en-US USD with 0 fraction digits")
    else:
        failures.append("formatCurrency must be en-US USD with 0 fraction digits")

    if 'return `${value.toFixed(1)}%`' in text or "return `${value.toFixed(1)}%`" in text:
        passes.append("formatPercent uses exactly one decimal place")
    elif "toFixed(1)" in text and "%" in text:
        passes.append("formatPercent uses toFixed(1) and percent sign")
    else:
        failures.append("formatPercent must use toFixed(1) with trailing %")

    if "totalIncome > 0 ? (profit / totalIncome) * 100 : 0" in text:
        passes.append("computeKPIs zero-income margin guard present")
    else:
        failures.append("computeKPIs missing zero-income profitPercent => 0 guard")

    if "income > 0 ? (profit / income) * 100 : 0" in text:
        passes.append("computeMonthlyData zero-income margin guard present")
    else:
        failures.append("computeMonthlyData missing zero-income profitPercent => 0 guard")


def check_tests() -> None:
    text = read(TESTS)
    if 'formatCurrency(1234.56)).toBe("$1,235")' in text.replace(" ", ""):
        # tolerate spacing
        pass
    if '"$1,235"' in text and '"15.6%"' in text:
        passes.append("Tests lock currency and percent formatting contracts")
    else:
        failures.append("financial-utils.test.ts missing currency/percent contract assertions")
    if "profitPercent).toBe(0)" in text or "profitPercent).toBe(0)" in text:
        passes.append("Tests cover zero-income profitPercent")
    elif "returns 0 profitPercent" in text:
        passes.append("Tests cover zero-income profitPercent")
    else:
        failures.append("Missing zero-income profitPercent test")


def check_dashboard_violations() -> None:
    """Flag tooltip/table/KPI ad-hoc percent/money formatting outside axis ticks."""
    axis_context = re.compile(r"tickFormatter")
    for path in sorted(DASHBOARD.glob("*.tsx")):
        lines = read(path).splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Axis tick exception
            if "tickFormatter" in line:
                continue
            # Look at nearby previous lines for tickFormatter multi-line
            window = "\n".join(lines[max(0, i - 4) : i])
            if "tickFormatter" in window:
                continue

            if re.search(r"toFixed\(\s*1\s*\)\s*\}\s*%", line) or re.search(
                r"toFixed\(\s*1\s*\)\s*%", line
            ):
                failures.append(
                    f"{path.relative_to(ROOT)}:{i}: percent label uses toFixed(1) instead of formatPercent — {stripped}"
                )
                guidance.append(
                    f"Replace `{stripped}` with formatPercent(...) from @/lib/financial-utils"
                )

            # Literal `$` + interpolation, e.g. `$${amount}` — not `${id}` templates
            if re.search(r"`\$\$\{", line):
                if "tickFormatter" in window:
                    continue
                failures.append(
                    f"{path.relative_to(ROOT)}:{i}: ad-hoc money template — {stripped}"
                )
                guidance.append(
                    f"Use formatCurrency(...) instead of ad-hoc $ formatting at {path.name}:{i}"
                )

        content = read(path)
        if path.name == "kpi-row.tsx":
            if "formatCurrency" in content and "formatPercent" in content:
                passes.append("kpi-row.tsx uses formatCurrency and formatPercent")
            else:
                failures.append("kpi-row.tsx must use formatCurrency and formatPercent")

        if path.name == "income-outcome-chart.tsx" and "formatCurrency" in content:
            passes.append("income-outcome-chart.tsx uses formatCurrency for money cells/tooltips")

        if path.name == "profit-percent-chart.tsx":
            if "formatPercent" in content:
                passes.append("profit-percent-chart.tsx imports/uses formatPercent in table")
            # tooltip violation detected per-line above


def main() -> int:
    if not UTILS.exists():
        print("FAIL: financial-utils.ts missing")
        return 1

    check_formatters()
    check_tests()
    check_dashboard_violations()

    print("=== financial-display-formatting skill audit ===\n")
    for item in passes:
        print(f"PASS  {item}")
    for item in failures:
        print(f"FAIL  {item}")
    if guidance:
        print("\n=== guidance ===")
        for item in guidance:
            print(f"→ {item}")

    print(f"\nsummary: passes={len(passes)} failures={len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
