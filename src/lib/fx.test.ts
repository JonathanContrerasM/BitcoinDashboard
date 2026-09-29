import { describe, expect, it } from 'vitest'
import type { PricePoint, Transaction } from '../types'
import { computeMetrics } from './calculations'
import { buildFxSeries, fxAt, toUsdTransactions } from './fx'

const D = (s: string) => Date.parse(`${s}T00:00:00Z`)

describe('buildFxSeries', () => {
  it('joins BTC/local and BTC/USD by UTC day', () => {
    const local: PricePoint[] = [
      [D('2025-01-01'), 80_000],
      [D('2025-01-02'), 90_000],
      [D('2025-01-03'), 100_000], // no USD point → dropped
    ]
    const usd: PricePoint[] = [
      [D('2025-01-01') + 3_600_000, 100_000],
      [D('2025-01-02'), 99_000],
    ]
    expect(buildFxSeries(local, usd)).toEqual([
      [D('2025-01-01'), 1.25],
      [D('2025-01-02'), 1.1],
    ])
  })
})

describe('fxAt', () => {
  const series: PricePoint[] = [
    [D('2025-01-01'), 1.1],
    [D('2025-01-05'), 1.2],
    [D('2025-01-10'), 1.3],
  ]
  it('uses the latest rate at or before t', () => {
    expect(fxAt(series, D('2025-01-05'))).toBe(1.2)
    expect(fxAt(series, D('2025-01-07'))).toBe(1.2)
    expect(fxAt(series, D('2025-02-01'))).toBe(1.3)
  })
  it('clamps to the first rate before the series starts', () => {
    expect(fxAt(series, D('2024-01-01'))).toBe(1.1)
  })
  it('returns null without data', () => {
    expect(fxAt([], D('2025-01-01'))).toBeNull()
  })
})

describe('toUsdTransactions', () => {
  const base = {
    txid: '',
    time: '',
    feeSats: 0,
    address: '',
    currency: 'CHF',
    note: '',
    sourceFile: 't.csv',
  }
  const txs: Transaction[] = [
    { ...base, key: 'a', type: 'received', amountSats: 50_000_000, historicalValue: 20_000, timestamp: D('2024-06-01') },
    { ...base, key: 'b', type: 'received', amountSats: 50_000_000, historicalValue: 30_000, timestamp: D('2025-01-06') },
  ]
  const series: PricePoint[] = [
    [D('2025-01-01'), 1.1],
    [D('2025-01-05'), 1.2],
  ]

  it('converts each value at its own day rate and counts approximations', () => {
    const r = toUsdTransactions(txs, series)
    expect(r.transactions.map((t) => t.historicalValue)).toEqual([22_000, 36_000])
    expect(r.transactions.every((t) => t.currency === 'USD')).toBe(true)
    expect(r.approximated).toBe(1)
  })

  it('yields a USD cost basis and P/L via the regular metrics', () => {
    const usdTxs = toUsdTransactions(txs, series).transactions
    // CHF amount paid 55'000 over CHF 50'000 market value → same 10% premium in USD
    const paidUsd = 55_000 * (58_000 / 50_000)
    const m = computeMetrics(usdTxs, paidUsd, 120_000)
    expect(m.historicalValue).toBeCloseTo(58_000)
    expect(m.feesSpread).toBeCloseTo(5_800)
    expect(m.avgBuyPriceEffective).toBeCloseTo(63_800)
    expect(m.pnl).toBeCloseTo(120_000 - 63_800)
  })
})
