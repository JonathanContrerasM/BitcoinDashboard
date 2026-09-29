import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HIDDEN, useUi } from '../context/ui'
import { buyMarkers } from '../lib/calculations'
import type { PricePoint, Transaction } from '../types'
import { Card, ChartEmpty, Segmented, Skeleton, TooltipBox } from './ui'

const RANGES = ['1M', '3M', '1Y', 'All'] as const
type Range = (typeof RANGES)[number]
const RANGE_DAYS: Record<Range, number | null> = { '1M': 30, '3M': 90, '1Y': 365, All: null }

export function PriceChart({
  prices,
  txs,
  avgPrice,
  avgLabel,
  loading,
  error,
  now,
}: {
  prices: PricePoint[]
  txs: Transaction[]
  avgPrice: number | null
  avgLabel: string
  loading: boolean
  error: string | null
  now: number
}) {
  const { fmt, colors, privacy } = useUi()
  const [range, setRange] = useState<Range>('1Y')

  const { line, buys } = useMemo(() => {
    const days = RANGE_DAYS[range]
    const from = days ? now - days * 86_400_000 : -Infinity
    const line = prices.filter(([t]) => t >= from).map(([t, price]) => ({ t, price }))
    return { line, buys: buyMarkers(txs, from) }
  }, [prices, txs, range, now])

  return (
    <Card
      title="BTC price & your buys"
      subtitle={`${buys.length} buy${buys.length === 1 ? '' : 's'} in range · dots show the price you paid`}
      action={<Segmented value={range} options={RANGES} onChange={setRange} />}
    >
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : line.length < 2 ? (
        <ChartEmpty>{error ? `Price history unavailable: ${error}` : 'No price data for this range.'}</ChartEmpty>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                allowDataOverflow
                tickFormatter={fmt.shortDate}
                stroke={colors.axis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                dataKey="price"
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => fmt.compactFiat(v)}
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
                  if (p.kind === 'buy') {
                    return (
                      <TooltipBox
                        title={`Buy · ${fmt.date(p.t)}`}
                        rows={[
                          { label: 'Price paid', value: fmt.fiat(p.price, { decimals: 0 }), color: colors.accent },
                          { label: 'Amount', value: fmt.sats(p.sats), sensitive: true },
                        ]}
                      />
                    )
                  }
                  return (
                    <TooltipBox
                      title={fmt.date(p.t)}
                      rows={[{ label: 'BTC price', value: fmt.fiat(p.price, { decimals: 0 }), color: colors.muted }]}
                    />
                  )
                }}
              />
              <Line
                data={line}
                dataKey="price"
                type="monotone"
                stroke={colors.muted}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {/* Y comes from the YAxis dataKey ("price"), so markers carry the paid price under that key. */}
              <Scatter
                data={buys}
                fill={colors.accent}
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number }) =>
                  props.cx == null || props.cy == null ? <g /> : (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill={colors.accent}
                      stroke={colors.tooltipBg}
                      strokeWidth={2}
                    />
                  )
                }
              />
              {avgPrice != null && (
                <ReferenceLine
                  y={avgPrice}
                  stroke={colors.accent}
                  strokeDasharray="6 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `${avgLabel}: ${privacy ? HIDDEN : fmt.fiat(avgPrice, { decimals: 0 })}`,
                    position: 'insideTopLeft',
                    fill: colors.accent,
                    fontSize: 11,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
