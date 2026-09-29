import { useState } from 'react'
import { useUi } from '../context/ui'
import { whatIf } from '../lib/calculations'
import { parseFiatNumber } from '../lib/numbers'
import type { PortfolioMetrics } from '../types'
import { Alt, Card, ChartEmpty, Sensitive } from './ui'

const QUICK = [-0.5, -0.25, 0.25, 0.5, 1]

export function WhatIfSimulator({ m }: { m: PortfolioMetrics }) {
  const { fmt, usd } = useUi()
  const base = m.currentPrice
  // null = follow the current price
  const [override, setOverride] = useState<number | null>(null)
  const [text, setText] = useState('')

  if (base == null) {
    return (
      <Card title="What-if simulator">
        <ChartEmpty>Needs a current BTC price (live or manual).</ChartEmpty>
      </Card>
    )
  }

  const price = override ?? base
  const r = whatIf(m.heldSats, m.amountPaid, price)
  const ru = usd ? whatIf(m.heldSats, usd.metrics.amountPaid, price * usd.rateNow) : null
  const max = Math.max(base * 4, price)
  const set = (p: number) => {
    const v = Math.max(0, Math.round(p))
    setOverride(v)
    setText(fmt.number(v, 0))
  }
  const change = price / base - 1
  const tone = (v: number | null) =>
    v == null ? 'text-slate-900 dark:text-white' : v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'

  return (
    <Card
      title="What-if simulator"
      subtitle="Portfolio value at a hypothetical BTC price"
      action={
        override != null && (
          <button
            type="button"
            onClick={() => {
              setOverride(null)
              setText('')
            }}
            className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
          >
            Reset to current
          </button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => set(base * (1 + q))}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
              override != null && Math.abs(change - q) < 0.0005
                ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {q > 0 ? '+' : '−'}
            {Math.abs(q * 100)}%
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={max}
          step={Math.max(1, Math.round(base / 200))}
          value={price}
          onChange={(e) => set(Number(e.target.value))}
          className="flex-1 accent-orange-500"
          aria-label="Hypothetical BTC price"
        />
        <div className="relative w-40">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold text-slate-400">
            {fmt.currency}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={override == null ? fmt.number(base, 0) : text}
            onChange={(e) => {
              setText(e.target.value)
              const v = parseFiatNumber(e.target.value)
              if (v != null && v >= 0) setOverride(v)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-2 pl-11 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      {ru && (
        <div className="mt-1 text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
          ≈ {usd?.fmt.fiat(ru.price, { decimals: 0 })} per BTC
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Portfolio value</div>
          <Sensitive className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {fmt.fiat(r.value)}
          </Sensitive>
          {ru && usd && <Alt>{usd.fmt.fiat(ru.value)}</Alt>}
          <div className={`text-xs tabular-nums ${tone(change)}`}>{fmt.percent(change, { signed: true })} vs. today</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Profit / Loss</div>
          {r.pnl == null ? (
            <div className="text-sm text-slate-400 italic">Enter amount paid</div>
          ) : (
            <>
              <Sensitive className={`text-xl font-semibold tabular-nums ${tone(r.pnl)}`}>
                {fmt.fiat(r.pnl, { signed: true })}
              </Sensitive>
              {ru?.pnl != null && usd && (
                <Alt>
                  {usd.fmt.fiat(ru.pnl, { signed: true })} ({fmt.percent(ru.pnlPct, { signed: true })})
                </Alt>
              )}
              <div className={`text-xs tabular-nums ${tone(r.pnl)}`}>{fmt.percent(r.pnlPct, { signed: true })}</div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
