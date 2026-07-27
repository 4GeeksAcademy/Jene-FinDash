import { lazy, Suspense, useEffect, useId, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KPIRow } from "@/components/dashboard/kpi-row";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type FinancialMovement,
  type KPIMetrics,
  type MonthlyDataPoint,
} from "@/lib/financial-types";
import { computeKPIs, computeMonthlyData } from "@/lib/financial-utils";

const IncomeOutcomeChart = lazy(async () => {
  const module = await import("@/components/dashboard/income-outcome-chart");
  return { default: module.IncomeOutcomeChart };
});

const ProfitPercentChart = lazy(async () => {
  const module = await import("@/components/dashboard/profit-percent-chart");
  return { default: module.ProfitPercentChart };
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function fetchFinancialData(): Promise<FinancialMovement[]> {
  const response = await fetch(`${API_BASE_URL}/api/metrics`);
  if (!response.ok) {
    throw new Error(`Failed to fetch financial data: ${response.status}`);
  }
  return response.json();
}

function ChartSuspenseFallback({ label }: { label: string }) {
  return (
    <Card
      className="border-border/60"
      aria-busy="true"
      aria-label={label}
    >
      <CardHeader className="pb-4">
        <Skeleton className="h-5 w-52" aria-hidden="true" />
        <Skeleton className="h-3 w-64 mt-1" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="chart-plot">
          <Skeleton className="h-full w-full rounded-lg" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function App() {
  const titleId = useId();
  const [metrics, setMetrics] = useState<KPIMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData()
      .then((movements) => {
        setMetrics(computeKPIs(movements));
        setMonthlyData(computeMonthlyData(movements));
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(
          "Could not load financial information. Check that the backend API is available.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main
        id="main-content"
        className="min-h-screen bg-background text-foreground"
        aria-labelledby={titleId}
        aria-busy={loading}
      >
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            <DashboardHeader titleId={titleId} period="2024 - Full Year" />

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-destructive/40 bg-destructive/15 p-4 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <section
              aria-label="Key performance indicators"
              aria-busy={loading}
            >
              <KPIRow metrics={metrics} loading={loading} />
            </section>

            <section
              aria-label="Financial charts"
              aria-busy={loading}
              className="grid grid-cols-1 gap-4 xl:grid-cols-2"
            >
              <Suspense
                fallback={
                  <ChartSuspenseFallback label="Loading income versus outcome chart" />
                }
              >
                <IncomeOutcomeChart data={monthlyData} loading={loading} />
              </Suspense>
              <Suspense
                fallback={
                  <ChartSuspenseFallback label="Loading profit margin chart" />
                }
              >
                <ProfitPercentChart data={monthlyData} loading={loading} />
              </Suspense>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
