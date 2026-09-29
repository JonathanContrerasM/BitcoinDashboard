import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useUi } from '../context/ui'
import type { PortfolioMetrics } from '../types'
import { Alt, Card, ChartEmpty, Sensitive, TooltipBox } from './ui'

export function CostBreakdown({ m }: { m: PortfolioMetrics }) {
  const { fmt, colors, usd } = useUi()
  const um = usd?.metrics
  const network = m.networkFeeFiatHistorical ?? m.networkFeeFiatCurrent ?? 0
  const slices = [
    {
      name: 'Market value of purchases',
      value: m.historicalValue,
      usd: um?.historicalValue,
      color: colors.accent,
    },
    {
      name: 'Fees, spread & exchange costs',
      value: Math.max(0, m.feesSpread ?? 0),
      usd: um ? Math.max(0, um.feesSpread ?? 0) : undefined,
      color: colors.loss,
    },
    {
      name: 'Network fees',
      value: network,
      usd: um ? (um.networkFeeFiatHistorical ?? um.networkFeeFiatCurrent ?? 0) : undefined,
      color: colors.network,
    },
  ]
  const total = slices.reduce((s, x) => s + x.value, 0)

  return (
    <Card title="Cost breakdown" subtitle="Where your money went">
      {total <= 0 ? (
        <ChartEmpty>No historical values to break down.</ChartEmpty>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
          <div className="relative h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices.filter((s) => s.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices
                    .filter((s) => s.value > 0)
                    .map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload
                    if (!p) return null
                    return (
                      <TooltipBox
                        title={p.name}
                        rows={[
                          { label: 'Amount', value: fmt.fiat(p.value), color: p.color, sensitive: true },
                          ...(usd && p.usd != null
                            ? [{ label: 'USD', value: usd.fmt.fiat(p.usd), sensitive: true }]
                            : []),
                          { label: 'Share', value: fmt.percent(p.value / total) },
                        ]}
                      />
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Total cost</span>
              <Sensitive className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {fmt.fiat(total, { decimals: 0 })}
              </Sensitive>
            </div>
          </div>
          <ul className="w-full space-y-3 text-sm">
            {slices.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="text-right tabular-nums">
                  <Sensitive className="block font-medium text-slate-900 dark:text-white">{fmt.fiat(s.value)}</Sensitive>
                  {usd && s.usd != null && <Alt>{usd.fmt.fiat(s.usd)}</Alt>}
                  <span className="text-xs text-slate-500">{fmt.percent(s.value / total)}</span>
                </span>
              </li>
            ))}
            {m.amountPaidEstimated && (
              <li className="text-xs text-slate-500 italic dark:text-slate-400">
                Enter amount paid to see fees & spread.
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  )
}
