import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type MonthlyDataPoint } from '@/lib/financial-types'
import { formatPercent } from '@/lib/financial-utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface ProfitPercentChartProps {
  data: MonthlyDataPoint[]
  loading?: boolean
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div
      className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm text-card-foreground"
      role="status"
    >
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: 'var(--chart-profit)' }}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">Profit margin:</span>
        <span className="font-medium text-foreground ml-auto pl-4">{value.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function ProfitPercentChart({ data, loading }: ProfitPercentChartProps) {
  if (loading) {
    return (
      <Card
        className="border-border/60"
        aria-busy="true"
        aria-label="Loading profit margin chart"
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
    )
  }

  const hasData = data.some((d) => d.profitPercent !== 0)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">
          <h2 className="text-base font-semibold m-0">Profit Margin %</h2>
        </CardTitle>
        <CardDescription>Monthly profit as a percentage of total income</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div
            className="chart-plot flex items-center justify-center text-muted-foreground text-sm"
            role="status"
          >
            No data available to display
          </div>
        ) : (
          <figure
            className="m-0"
            aria-label="Line chart of monthly profit margin percent"
          >
            <details className="mb-3 rounded-md border border-border bg-secondary/40 text-sm">
              <summary className="cursor-pointer select-none px-3 py-2 font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                View profit margin data table
              </summary>
              <div className="overflow-x-auto border-t border-border px-3 py-2">
                <table className="w-full text-left text-sm text-foreground">
                  <caption className="sr-only">Monthly profit margin percentages</caption>
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="py-1 pr-4 font-medium">Month</th>
                      <th scope="col" className="py-1 font-medium">Profit margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.month} className="border-t border-border/60">
                        <th scope="row" className="py-1 pr-4 font-normal">{row.month}</th>
                        <td className="py-1">{formatPercent(row.profitPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="chart-plot" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    width={40}
                    domain={['auto', 'auto']}
                  />
                  <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 4" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="profitPercent"
                    name="profitPercent"
                    stroke="var(--chart-profit)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--chart-profit)', strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="sr-only">
              Visual line chart. Use the data table disclosure above for exact monthly values.
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
  )
}
