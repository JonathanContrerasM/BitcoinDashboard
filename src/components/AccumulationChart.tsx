import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HIDDEN, useUi } from '../context/ui'
import { monthlyAccumulation } from '../lib/calculations'
import type { Transaction } from '../types'
import { Card, ChartEmpty, Segmented, TooltipBox } from './ui'

const MODES = ['Sats', 'Spent'] as const

export function AccumulationChart({ txs, scale, hasAmountPaid }: { txs: Transaction[]; scale: number; hasAmountPaid: boolean }) {
  const { fmt, colors, privacy, usd } = useUi()
  const [mode, setMode] = useState<(typeof MODES)[number]>('Sats')
  const data = useMemo(() => {
    const usdByMonth = usd ? new Map(monthlyAccumulation(usd.txs, usd.scale).map((b) => [b.month, b.spent])) : null
    return monthlyAccumulation(txs, scale).map((b) => ({ ...b, spentUsd: usdByMonth?.get(b.month) ?? null }))
  }, [txs, scale, usd])
  const key = mode === 'Sats' ? 'sats' : 'spent'

  return (
    <Card
      title="Monthly accumulation"
      subtitle={mode === 'Sats' ? 'Sats acquired per month' : `${fmt.currency} spent per month${hasAmountPaid ? ' (effective cost)' : ' (market value)'}`}
      action={<Segmented value={mode} options={MODES} onChange={setMode} />}
    >
      {data.length === 0 ? (
        <ChartEmpty>No purchases yet.</ChartEmpty>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={fmt.month}
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  privacy ? HIDDEN : mode === 'Sats' ? fmt.number(v / 1e6, 1) + 'M' : fmt.compactFiat(v)
                }
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ fill: colors.accentSoft }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox
                      title={fmt.month(p.month)}
                      rows={[
                        { label: 'Acquired', value: fmt.sats(p.sats), color: colors.accent, sensitive: true },
                        { label: 'Spent', value: fmt.fiat(p.spent), sensitive: true },
                        ...(usd && p.spentUsd != null
                          ? [{ label: 'Spent (USD)', value: usd.fmt.fiat(p.spentUsd), sensitive: true }]
                          : []),
                        { label: 'Buys', value: String(p.buys) },
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey={key} fill={colors.accent} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
