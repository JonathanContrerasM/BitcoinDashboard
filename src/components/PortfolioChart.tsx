import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HIDDEN, useUi } from '../context/ui'
import { portfolioSeries } from '../lib/calculations'
import type { PricePoint, Transaction } from '../types'
import { Card, ChartEmpty, Notice, Skeleton, TooltipBox } from './ui'

export function PortfolioChart({
  txs,
  prices,
  scale,
  hasAmountPaid,
  loading,
  note,
}: {
  txs: Transaction[]
  prices: PricePoint[]
  scale: number
  hasAmountPaid: boolean
  loading: boolean
  /** Explains where prices came from when market data is incomplete. */
  note: string | null
}) {
  const { fmt, colors, privacy, usd } = useUi()
  const data = useMemo(() => {
    const local = portfolioSeries(txs, prices, scale)
    // USD invested uses each purchase converted at its own day's rate; value uses that day's rate.
    const investedUsd = usd ? portfolioSeries(usd.txs, prices, usd.scale) : null
    return local.map((p, i) => ({
      ...p,
      valueUsd: usd ? p.value * (usd.rateAt(p.t) ?? NaN) : null,
      investedUsd: investedUsd?.[i]?.invested ?? null,
    }))
  }, [txs, prices, scale, usd])
  const investedLabel = hasAmountPaid ? 'Invested (effective cost)' : 'Invested (market value)'

  return (
    <Card
      title="Portfolio value over time"
      subtitle={`Holdings × BTC price vs. cumulative ${hasAmountPaid ? 'amount paid' : 'market value of purchases'}`}
    >
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : data.length < 2 ? (
        <ChartEmpty>Not enough price data to draw the chart.</ChartEmpty>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmt.shortDate}
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => (privacy ? HIDDEN : fmt.compactFiat(v))}
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox
                      title={fmt.date(p.t)}
                      rows={[
                        { label: 'Value', value: fmt.fiat(p.value), color: colors.accent, sensitive: true },
                        ...(usd && Number.isFinite(p.valueUsd)
                          ? [{ label: 'Value (USD)', value: usd.fmt.fiat(p.valueUsd), sensitive: true }]
                          : []),
                        { label: investedLabel, value: fmt.fiat(p.invested), color: colors.muted, sensitive: true },
                        ...(usd && p.investedUsd != null
                          ? [{ label: 'Invested (USD)', value: usd.fmt.fiat(p.investedUsd), sensitive: true }]
                          : []),
                        { label: 'Holdings', value: fmt.btc(p.holdingsBtc * 1e8), sensitive: true },
                        { label: 'BTC price', value: fmt.fiat(p.price, { decimals: 0 }) },
                      ]}
                    />
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                name="Portfolio value"
                dataKey="value"
                type="monotone"
                stroke={colors.accent}
                strokeWidth={2}
                fill="url(#valueFill)"
                isAnimationActive={false}
              />
              <Line
                name={investedLabel}
                dataKey="invested"
                type="stepAfter"
                stroke={colors.muted}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {note && !loading && (
        <div className="mt-3">
          <Notice tone="info">{note}</Notice>
        </div>
      )}
    </Card>
  )
}
