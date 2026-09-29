import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUi } from '../context/ui'
import type { Lot } from '../types'
import { Card, ChartEmpty, TooltipBox } from './ui'

export function BuyDistribution({ lots, currentPrice }: { lots: Lot[]; currentPrice: number | null }) {
  const { fmt, colors, usd } = useUi()
  const data = useMemo(
    () =>
      lots
        .filter((l) => l.tx.type === 'received' && l.pricePerBtc != null)
        .map((l) => ({
          key: l.tx.key,
          t: l.tx.timestamp,
          label: fmt.date(l.tx.timestamp),
          price: l.pricePerBtc as number,
          sats: l.tx.amountSats,
          pct: currentPrice != null ? currentPrice / (l.pricePerBtc as number) - 1 : null,
        }))
        .sort((a, b) => a.price - b.price),
    [lots, currentPrice, fmt],
  )
  const inProfit = data.filter((d) => d.pct != null && d.pct >= 0).length

  return (
    <Card
      title="Buy price distribution"
      subtitle={
        currentPrice != null
          ? `${inProfit} of ${data.length} buys are below today's price`
          : 'Each purchase sorted by price per BTC'
      }
    >
      {data.length === 0 ? (
        <ChartEmpty>No purchases with a historical value.</ChartEmpty>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="key" tick={false} tickLine={false} axisLine={{ stroke: colors.grid }} height={8} />
              <YAxis
                tickFormatter={(v: number) => fmt.compactFiat(v)}
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                domain={[0, (max: number) => Math.max(max, currentPrice ?? 0) * 1.05]}
              />
              <Tooltip
                cursor={{ fill: colors.accentSoft }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox
                      title={p.label}
                      rows={[
                        { label: 'Price per BTC', value: fmt.fiat(p.price, { decimals: 0 }) },
                        ...(usd && usd.rateAt(p.t) != null
                          ? [{ label: 'In USD', value: usd.fmt.fiat(p.price * (usd.rateAt(p.t) as number), { decimals: 0 }) }]
                          : []),
                        { label: 'Amount', value: fmt.sats(p.sats), sensitive: true },
                        ...(p.pct != null
                          ? [{ label: 'vs. today', value: fmt.percent(p.pct, { signed: true }), color: p.pct >= 0 ? colors.gain : colors.loss }]
                          : []),
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey="price" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.pct == null ? colors.muted : d.pct >= 0 ? colors.gain : colors.loss} />
                ))}
              </Bar>
              {currentPrice != null && (
                <ReferenceLine
                  y={currentPrice}
                  stroke={colors.accent}
                  strokeDasharray="6 4"
                  label={{ value: 'Today', position: 'insideTopRight', fill: colors.accent, fontSize: 11 }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
