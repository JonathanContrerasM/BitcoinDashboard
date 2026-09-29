import type { PricePoint, Transaction } from '../types'

const DAY_MS = 86_400_000

/**
 * Daily exchange rate series (USD per 1 unit of local currency), derived from two BTC price
 * series: rate = BTC/USD ÷ BTC/local on the same UTC day.
 */
export function buildFxSeries(local: PricePoint[], usd: PricePoint[]): PricePoint[] {
  const usdByDay = new Map(usd.map(([t, p]) => [Math.floor(t / DAY_MS), p]))
  const out: PricePoint[] = []
  for (const [t, p] of local) {
    const u = usdByDay.get(Math.floor(t / DAY_MS))
    if (u != null && p > 0 && u > 0) out.push([t, u / p])
  }
  return out.sort((a, b) => a[0] - b[0])
}

/**
 * Rate in effect at `t`: the latest point at or before `t`. Before the series starts, the
 * earliest rate is used (approximation). Null for an empty series.
 */
export function fxAt(series: PricePoint[], t: number): number | null {
  if (series.length === 0) return null
  if (t < series[0][0]) return series[0][1]
  let lo = 0
  let hi = series.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (series[mid][0] <= t) lo = mid
    else hi = mid - 1
  }
  return series[lo][1]
}

/** True if `t` is earlier than the FX data (with a one-day grace period). */
export function isBeforeFxData(series: PricePoint[], t: number): boolean {
  return series.length > 0 && t < series[0][0] - DAY_MS
}

/**
 * Converts transactions' historical values to USD at each transaction's own day rate, so the
 * regular metric functions yield a true USD cost basis.
 */
export function toUsdTransactions(
  txs: Transaction[],
  series: PricePoint[],
): { transactions: Transaction[]; approximated: number } {
  let approximated = 0
  const transactions = txs.map((tx) => {
    if (tx.historicalValue == null) return { ...tx, currency: 'USD' }
    const rate = fxAt(series, tx.timestamp)
    if (rate == null) return { ...tx, historicalValue: null, currency: 'USD' }
    if (isBeforeFxData(series, tx.timestamp)) approximated++
    return { ...tx, historicalValue: tx.historicalValue * rate, currency: 'USD' }
  })
  return { transactions, approximated }
}
