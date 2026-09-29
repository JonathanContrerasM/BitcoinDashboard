import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import {
  buyMarkers,
  computeLots,
  computeMetrics,
  computeStats,
  costScale,
  heldSats,
  monthlyAccumulation,
  portfolioSeries,
  whatIf,
  withImpliedPrices,
} from './calculations'

let n = 0
function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amountSats'>): Transaction {
  n++
  return {
    key: `k${n}`,
    txid: `test-tx-${n}`,
    timestamp: Date.parse('2025-01-01T00:00:00Z') + n * 86_400_000,
    time: '',
    feeSats: 0,
    address: 'test-addr',
    historicalValue: null,
    currency: 'CHF',
    note: '',
    sourceFile: 'test.csv',
    ...partial,
  }
}

// 0.5 BTC @ 40k (=20k), 0.5 BTC @ 60k (=30k), then send 0.2 BTC with a 10k sat fee.
const buys = [
  tx({ type: 'received', amountSats: 50_000_000, historicalValue: 20_000, timestamp: Date.parse('2024-06-15T00:00:00Z') }),
  tx({ type: 'received', amountSats: 50_000_000, historicalValue: 30_000, timestamp: Date.parse('2024-08-20T00:00:00Z') }),
]
const send = tx({
  type: 'sent',
  amountSats: 20_000_000,
  feeSats: 10_000,
  historicalValue: 10_000, // implies 50k/BTC
  timestamp: Date.parse('2024-09-01T00:00:00Z'),
})
const all = [...buys, send]

describe('heldSats', () => {
  it('subtracts sent amounts and their network fees', () => {
    expect(heldSats(all)).toBe(100_000_000 - 20_000_000 - 10_000)
  })

  it('can go to zero when everything is sent', () => {
    expect(
      heldSats([
        tx({ type: 'received', amountSats: 1000 }),
        tx({ type: 'sent', amountSats: 900, feeSats: 100 }),
      ]),
    ).toBe(0)
  })
})

describe('computeMetrics', () => {
  it('estimates amount paid from historical values when not entered', () => {
    const m = computeMetrics(all, null, 100_000)
    expect(m.heldSats).toBe(79_990_000)
    expect(m.networkFeeSats).toBe(10_000)
    expect(m.historicalValue).toBe(50_000)
    expect(m.avgBuyPriceMarket).toBeCloseTo(50_000)
    expect(m.currentValue).toBeCloseTo(79_990)
    expect(m.amountPaid).toBe(50_000)
    expect(m.amountPaidEstimated).toBe(true)
    expect(m.pnl).toBeCloseTo(79_990 - 50_000)
    expect(m.pnlPct).toBeCloseTo((79_990 - 50_000) / 50_000)
    expect(m.avgBuyPriceEffective).toBeCloseTo(50_000 / 0.7999)
    expect(m.breakEvenPrice).toBeCloseTo(50_000 / 0.7999)
    // Fees can't be derived from an estimate: unknown, not 0.
    expect(m.feesSpread).toBeNull()
    expect(m.feesSpreadPct).toBeNull()
  })

  it('has no amount paid at all without historical values', () => {
    const m = computeMetrics([tx({ type: 'received', amountSats: 1000 })], null, 100_000)
    expect(m.amountPaid).toBeNull()
    expect(m.amountPaidEstimated).toBe(false)
    expect(m.pnl).toBeNull()
  })

  it('computes cost basis, P/L and fees with amount paid', () => {
    const m = computeMetrics(all, 52_000, 100_000)
    expect(m.amountPaidEstimated).toBe(false)
    expect(m.feesSpread).toBeCloseTo(2_000)
    expect(m.feesSpreadPct).toBeCloseTo(2_000 / 52_000)
    expect(m.avgBuyPriceEffective).toBeCloseTo(52_000 / 0.7999)
    expect(m.breakEvenPrice).toBeCloseTo(52_000 / 0.7999)
    expect(m.pnl).toBeCloseTo(79_990 - 52_000)
    expect(m.pnlPct).toBeCloseTo((79_990 - 52_000) / 52_000)
  })

  it('values network fees at historical and current prices', () => {
    const m = computeMetrics(all, null, 100_000)
    expect(m.networkFeeFiatHistorical).toBeCloseTo(0.0001 * 50_000)
    expect(m.networkFeeFiatCurrent).toBeCloseTo(0.0001 * 100_000)
  })

  it('treats zero/invalid amount paid as empty (estimated)', () => {
    for (const v of [0, -5, Number.NaN]) {
      const m = computeMetrics(all, v, 100_000)
      expect(m.amountPaid).toBe(50_000)
      expect(m.amountPaidEstimated).toBe(true)
    }
  })

  it('handles missing price and missing historical values', () => {
    const m = computeMetrics([...all, tx({ type: 'received', amountSats: 1000 })], 1000, null)
    expect(m.currentValue).toBeNull()
    expect(m.pnl).toBeNull()
    expect(m.missingHistoricalValues).toBe(1)
  })

  it('returns null cost basis when nothing is held', () => {
    const m = computeMetrics(
      [tx({ type: 'received', amountSats: 1000, historicalValue: 1 }), tx({ type: 'sent', amountSats: 1000 })],
      10,
      100_000,
    )
    expect(m.heldSats).toBe(0)
    expect(m.avgBuyPriceEffective).toBeNull()
  })
})

describe('computeLots', () => {
  it('computes per-lot P/L for buys only', () => {
    const lots = computeLots(all, 100_000)
    expect(lots[0].pricePerBtc).toBeCloseTo(40_000)
    expect(lots[0].pnl).toBeCloseTo(30_000)
    expect(lots[0].pnlPct).toBeCloseTo(1.5)
    expect(lots[2].pnl).toBeNull()
  })
})

describe('costScale', () => {
  it('spreads amount paid proportionally', () => {
    expect(costScale({ amountPaid: 55_000, historicalValue: 50_000 })).toBeCloseTo(1.1)
    expect(costScale({ amountPaid: null, historicalValue: 50_000 })).toBe(1)
  })
})

describe('portfolioSeries', () => {
  it('tracks holdings and step-wise invested capital', () => {
    const prices: [number, number][] = [
      [Date.parse('2024-06-01T00:00:00Z'), 30_000], // before first tx → excluded
      [Date.parse('2024-07-01T00:00:00Z'), 50_000],
      [Date.parse('2024-08-25T00:00:00Z'), 60_000],
      [Date.parse('2024-09-10T00:00:00Z'), 70_000],
    ]
    const s = portfolioSeries(all, prices, 1.1)
    expect(s).toHaveLength(3)
    expect(s[0]).toMatchObject({ holdingsBtc: 0.5, value: 25_000 })
    expect(s[0].invested).toBeCloseTo(22_000)
    expect(s[1].invested).toBeCloseTo(55_000)
    expect(s[2].holdingsBtc).toBeCloseTo(0.7999)
    expect(s[2].invested).toBeCloseTo(55_000) // sends don't reduce invested capital
  })
})

describe('withImpliedPrices', () => {
  it('prepends transaction-implied prices before the market data starts', () => {
    const prices: [number, number][] = [[Date.parse('2024-08-01T00:00:00Z'), 55_000]]
    const merged = withImpliedPrices(prices, all)
    expect(merged).toHaveLength(2)
    expect(merged[0][1]).toBeCloseTo(40_000)
  })
})

describe('monthlyAccumulation', () => {
  it('buckets by month and fills gaps', () => {
    const months = monthlyAccumulation(all)
    expect(months.map((m) => m.month)).toEqual(['2024-06', '2024-07', '2024-08'])
    expect(months[1].sats).toBe(0)
    expect(months[2]).toMatchObject({ sats: 50_000_000, spent: 30_000, buys: 1 })
  })
})

describe('computeStats', () => {
  it('finds best and worst timed buys', () => {
    const s = computeStats(all, Date.parse('2024-06-25T00:00:00Z'))
    expect(s.purchases).toBe(2)
    expect(s.holdingDays).toBe(10)
    expect(s.bestBuy?.price).toBeCloseTo(40_000)
    expect(s.worstBuy?.price).toBeCloseTo(60_000)
    expect(s.avgPurchaseFiat).toBeCloseTo(25_000)
  })
})

describe('whatIf', () => {
  it('projects value and P/L at a hypothetical price', () => {
    const r = whatIf(50_000_000, 20_000, 80_000)
    expect(r.value).toBeCloseTo(40_000)
    expect(r.pnl).toBeCloseTo(20_000)
    expect(r.pnlPct).toBeCloseTo(1)
    expect(whatIf(50_000_000, null, 80_000).pnl).toBeNull()
  })
})

describe('buyMarkers', () => {
  it('plots received rows with a known price, keyed as `price` for the shared Y axis', () => {
    const noValue = tx({ type: 'received', amountSats: 1000, timestamp: Date.parse('2024-07-01T00:00:00Z') })
    const markers = buyMarkers([...all, noValue])
    expect(markers).toHaveLength(2)
    expect(markers.map((m) => m.price)).toEqual([40_000, 60_000])
    expect(markers[0]).toMatchObject({ kind: 'buy', sats: 50_000_000 })
  })

  it('respects the range start', () => {
    expect(buyMarkers(all, Date.parse('2024-07-01T00:00:00Z')).map((m) => m.price)).toEqual([60_000])
  })
})
