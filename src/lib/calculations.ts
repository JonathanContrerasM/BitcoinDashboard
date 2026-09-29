import type { Lot, PortfolioMetrics, PricePoint, Transaction } from '../types'
import { SATS_PER_BTC, satsToBtc } from './numbers'

const DAY_MS = 86_400_000

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function received(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.type === 'received')
}

export function sent(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.type === 'sent')
}

/** Fiat price per BTC implied by a transaction's historical value. */
export function impliedPrice(tx: Transaction): number | null {
  if (tx.historicalValue == null || tx.amountSats <= 0) return null
  return tx.historicalValue / satsToBtc(tx.amountSats)
}

/** BTC held = received − sent − network fees on sent. */
export function heldSats(txs: Transaction[]): number {
  let total = 0
  for (const t of txs) {
    total += t.type === 'received' ? t.amountSats : -(t.amountSats + t.feeSats)
  }
  return total
}

export function computeMetrics(
  txs: Transaction[],
  amountPaid: number | null,
  currentPrice: number | null,
): PortfolioMetrics {
  const rec = received(txs)
  const snt = sent(txs)
  const receivedSats = sum(rec.map((t) => t.amountSats))
  const sentSats = sum(snt.map((t) => t.amountSats))
  const networkFeeSats = sum(snt.map((t) => t.feeSats))
  const held = receivedSats - sentSats - networkFeeSats
  const heldBtc = satsToBtc(held)

  const valued = rec.filter((t) => t.historicalValue != null)
  const historicalValue = sum(valued.map((t) => t.historicalValue as number))
  const valuedBtc = satsToBtc(sum(valued.map((t) => t.amountSats)))

  const entered = amountPaid != null && Number.isFinite(amountPaid) && amountPaid > 0 ? amountPaid : null
  // Without an entered amount, the market value of purchases is a lower-bound estimate (excludes exchange fees).
  const estimated = entered == null && historicalValue > 0
  const paid = entered ?? (estimated ? historicalValue : null)
  const knownPaid = estimated ? null : paid
  const currentValue = currentPrice != null ? heldBtc * currentPrice : null
  const perBtcPaid = paid != null && held > 0 ? paid / heldBtc : null

  // Network fees in fiat at the time: use the price implied by each sent row's historical value.
  let networkFeeFiatHistorical: number | null = snt.some((t) => t.feeSats > 0) ? 0 : null
  for (const t of snt) {
    if (t.feeSats === 0) continue
    const p = impliedPrice(t)
    if (p == null) {
      networkFeeFiatHistorical = null
      break
    }
    networkFeeFiatHistorical = (networkFeeFiatHistorical ?? 0) + satsToBtc(t.feeSats) * p
  }

  return {
    receivedSats,
    sentSats,
    networkFeeSats,
    heldSats: held,
    purchaseCount: rec.length,
    historicalValue,
    missingHistoricalValues: rec.length - valued.length,
    avgBuyPriceMarket: valuedBtc > 0 ? historicalValue / valuedBtc : null,
    amountPaid: paid,
    amountPaidEstimated: estimated,
    avgBuyPriceEffective: perBtcPaid,
    currentPrice,
    currentValue,
    pnl: paid != null && currentValue != null ? currentValue - paid : null,
    pnlPct: paid != null && currentValue != null ? (currentValue - paid) / paid : null,
    // Unknown (not 0) when estimated: fees can only be derived from the real amount paid.
    feesSpread: knownPaid != null ? knownPaid - historicalValue : null,
    feesSpreadPct: knownPaid != null ? (knownPaid - historicalValue) / knownPaid : null,
    networkFeeFiatHistorical,
    networkFeeFiatCurrent: currentPrice != null ? satsToBtc(networkFeeSats) * currentPrice : null,
    breakEvenPrice: perBtcPaid,
  }
}

/** Per-transaction lot view for the table and buy distribution. */
export function computeLots(txs: Transaction[], currentPrice: number | null): Lot[] {
  return txs.map((tx) => {
    const pricePerBtc = impliedPrice(tx)
    const currentValue = currentPrice != null ? satsToBtc(tx.amountSats) * currentPrice : null
    const isBuy = tx.type === 'received' && tx.historicalValue != null && currentValue != null
    const pnl = isBuy ? currentValue - (tx.historicalValue as number) : null
    return {
      tx,
      pricePerBtc,
      currentValue,
      pnl,
      pnlPct: pnl != null && tx.historicalValue ? pnl / tx.historicalValue : null,
    }
  })
}

/**
 * Factor that turns market (historical) value into effective cost, spreading the
 * total amount paid across purchases proportionally. 1 when unknown.
 */
export function costScale(metrics: Pick<PortfolioMetrics, 'amountPaid' | 'historicalValue'>): number {
  if (metrics.amountPaid == null || metrics.historicalValue <= 0) return 1
  return metrics.amountPaid / metrics.historicalValue
}

export interface PortfolioPoint {
  t: number
  price: number
  holdingsBtc: number
  value: number
  invested: number
}

/**
 * Builds the portfolio-value-over-time series: holdings × price at each price point,
 * alongside cumulative invested capital (step function).
 */
export function portfolioSeries(
  txs: Transaction[],
  prices: PricePoint[],
  scale = 1,
): PortfolioPoint[] {
  if (txs.length === 0 || prices.length === 0) return []
  const sorted = [...txs].sort((a, b) => a.timestamp - b.timestamp)
  const first = sorted[0].timestamp
  const points: PortfolioPoint[] = []
  let i = 0
  let sats = 0
  let invested = 0
  for (const [t, price] of prices) {
    if (t < first - DAY_MS) continue
    while (i < sorted.length && sorted[i].timestamp <= t) {
      const tx = sorted[i]
      if (tx.type === 'received') {
        sats += tx.amountSats
        invested += (tx.historicalValue ?? 0) * scale
      } else {
        sats -= tx.amountSats + tx.feeSats
      }
      i++
    }
    const holdingsBtc = satsToBtc(sats)
    points.push({ t, price, holdingsBtc, value: holdingsBtc * price, invested })
  }
  return points
}

/**
 * Fills a price history with prices implied by transactions that fall before the
 * earliest available market data (e.g. when the free API only returns 365 days).
 */
export function withImpliedPrices(prices: PricePoint[], txs: Transaction[]): PricePoint[] {
  const start = prices.length > 0 ? prices[0][0] : Infinity
  const implied: PricePoint[] = txs
    .filter((t) => t.timestamp < start)
    .map((t) => [t.timestamp, impliedPrice(t)] as const)
    .filter((p): p is [number, number] => p[1] != null)
    .map(([t, p]) => [t, p])
  if (implied.length === 0) return prices
  return [...implied, ...prices].sort((a, b) => a[0] - b[0])
}

export interface MonthBucket {
  month: string // YYYY-MM
  sats: number
  spent: number
  buys: number
}

/** Monthly accumulation of received sats and fiat spent (scaled to effective cost). */
export function monthlyAccumulation(txs: Transaction[], scale = 1): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>()
  for (const t of received(txs)) {
    const d = new Date(t.timestamp)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(month) ?? { month, sats: 0, spent: 0, buys: 0 }
    b.sats += t.amountSats
    b.spent += (t.historicalValue ?? 0) * scale
    b.buys++
    buckets.set(month, b)
  }
  if (buckets.size === 0) return []

  // Include empty months so gaps are visible.
  const months = [...buckets.keys()].sort()
  let [y, m] = months[0].split('-').map(Number)
  const last = months[months.length - 1]
  const out: MonthBucket[] = []
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(buckets.get(key) ?? { month: key, sats: 0, spent: 0, buys: 0 })
    if (key >= last) return out
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
}

export interface PortfolioStats {
  purchases: number
  firstPurchase: Transaction | null
  lastPurchase: Transaction | null
  holdingDays: number | null
  avgPurchaseSats: number | null
  avgPurchaseFiat: number | null
  largestPurchase: Transaction | null
  bestBuy: { tx: Transaction; price: number } | null
  worstBuy: { tx: Transaction; price: number } | null
}

export function computeStats(txs: Transaction[], now = Date.now()): PortfolioStats {
  const rec = received(txs).sort((a, b) => a.timestamp - b.timestamp)
  const priced = rec
    .map((tx) => ({ tx, price: impliedPrice(tx) }))
    .filter((p): p is { tx: Transaction; price: number } => p.price != null)
    .sort((a, b) => a.price - b.price)
  const valued = rec.filter((t) => t.historicalValue != null)
  return {
    purchases: rec.length,
    firstPurchase: rec[0] ?? null,
    lastPurchase: rec[rec.length - 1] ?? null,
    holdingDays: rec.length ? Math.floor((now - rec[0].timestamp) / DAY_MS) : null,
    avgPurchaseSats: rec.length ? Math.round(sum(rec.map((t) => t.amountSats)) / rec.length) : null,
    avgPurchaseFiat: valued.length ? sum(valued.map((t) => t.historicalValue as number)) / valued.length : null,
    largestPurchase: rec.reduce<Transaction | null>((m, t) => (!m || t.amountSats > m.amountSats ? t : m), null),
    bestBuy: priced[0] ?? null,
    worstBuy: priced[priced.length - 1] ?? null,
  }
}

export interface WhatIf {
  price: number
  value: number
  pnl: number | null
  pnlPct: number | null
}

export function whatIf(heldSatsValue: number, amountPaid: number | null, price: number): WhatIf {
  const value = (heldSatsValue / SATS_PER_BTC) * price
  const pnl = amountPaid != null && amountPaid > 0 ? value - amountPaid : null
  return { price, value, pnl, pnlPct: pnl != null && amountPaid ? pnl / amountPaid : null }
}

export interface BuyMarker {
  t: number
  /** Price per BTC paid. Named `price` so it shares the price chart's Y axis dataKey. */
  price: number
  sats: number
  kind: 'buy'
}

/** Purchases (with a known price) at or after `from`, for plotting on the price chart. */
export function buyMarkers(txs: Transaction[], from = -Infinity): BuyMarker[] {
  return received(txs)
    .filter((t) => t.timestamp >= from)
    .map((t) => ({ t: t.timestamp, price: impliedPrice(t), sats: t.amountSats, kind: 'buy' as const }))
    .filter((b): b is BuyMarker => b.price != null)
    .sort((a, b) => a.t - b.t)
}
