import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { CHART_COLORS, UiContext, type UiState, type UsdView } from '../context/ui'
import { computeLots, computeMetrics, computeStats, costScale } from '../lib/calculations'
import { createFormatters } from '../lib/format'
import { toUsdTransactions } from '../lib/fx'
import { mergeImports, parseCsv } from '../lib/parse'
import type { PricePoint } from '../types'
import { AccumulationChart } from './AccumulationChart'
import { AmountPaidInput } from './AmountPaidInput'
import { BuyDistribution } from './BuyDistribution'
import { CostBreakdown } from './CostBreakdown'
import { EmptyState } from './EmptyState'
import { Header } from './Header'
import { KpiCards } from './KpiCards'
import { ParseSummary } from './ParseSummary'
import { PortfolioChart } from './PortfolioChart'
import { PriceChart } from './PriceChart'
import { StatsPanel } from './StatsPanel'
import { TransactionTable } from './TransactionTable'
import { WhatIfSimulator } from './WhatIfSimulator'

const noop = () => {}
const imported = mergeImports([], [parseCsv(readFileSync('sample-data.csv', 'utf8'), 'sample-data.csv')])
const txs = imported.transactions

const RATE = 1.25 // fake USD per CHF

function usdView(amountPaid: number | null, price: number | null): UsdView {
  const usdTxs = toUsdTransactions(txs, [[0, RATE]]).transactions
  const priceUsd = price != null ? price * RATE : null
  const metrics = computeMetrics(usdTxs, amountPaid != null ? amountPaid * RATE : null, priceUsd)
  return {
    fmt: createFormatters('USD'),
    txs: usdTxs,
    metrics,
    lotsByKey: new Map(computeLots(usdTxs, priceUsd).map((l) => [l.tx.key, l])),
    stats: computeStats(usdTxs, 0),
    scale: costScale(metrics),
    rateAt: () => RATE,
    rateNow: RATE,
    priceNow: priceUsd,
    change24h: 0.01,
    approximated: 0,
  }
}

function renderDashboard(amountPaid: number | null, price: number | null, privacy: boolean, withUsd = false): string {
  const m = computeMetrics(txs, amountPaid, price)
  const lots = computeLots(txs, price)
  const ui: UiState = {
    privacy,
    revealIds: false,
    setRevealIds: noop,
    theme: 'dark',
    colors: CHART_COLORS.dark,
    fmt: createFormatters('CHF'),
    usd: withUsd ? usdView(amountPaid, price) : null,
  }
  const prices: PricePoint[] = txs.map((t) => [t.timestamp, 60_000])
  return renderToString(
    <UiContext.Provider value={ui}>
      <Header
        currency="CHF"
        price={{ data: null, loading: false, error: null, lastFetched: null, refresh: noop }}
        effectivePrice={price}
        manualPrice=""
        onManualPrice={noop}
        offline={false}
        onOffline={noop}
        onTogglePrivacy={noop}
        onToggleTheme={noop}
        usdAvailable={withUsd}
        showUsd={withUsd}
        onToggleUsd={noop}
        onImport={noop}
        onClear={noop}
        hasData
      />
      <ParseSummary summary={imported.summary} onDismiss={noop} />
      <AmountPaidInput value="" onChange={noop} metrics={m} invalid={false} />
      <KpiCards m={m} priceLoading={false} />
      <PortfolioChart txs={txs} prices={prices} scale={1} hasAmountPaid loading={false} note={null} />
      <PriceChart prices={prices} txs={txs} avgPrice={60_000} avgLabel="Avg" loading={false} error={null} now={0} />
      <CostBreakdown m={m} />
      <AccumulationChart txs={txs} scale={1} hasAmountPaid={amountPaid != null} />
      <BuyDistribution lots={lots} currentPrice={price} />
      <WhatIfSimulator m={m} />
      <StatsPanel s={computeStats(txs, 0)} />
      <TransactionTable lots={lots} />
      <EmptyState onFiles={noop} />
    </UiContext.Provider>,
  )
}

describe('dashboard render (smoke)', () => {
  it('renders with amount paid and a price', () => {
    const html = renderDashboard(12_000, 90_000, false)
    expect(html).toContain('Local only · nothing stored or uploaded')
    expect(html).toContain('Fees, spread &amp; exchange costs')
    expect(html).not.toContain('Enter amount paid')
  })

  it('shows placeholders without amount paid or price', () => {
    const html = renderDashboard(null, null, true)
    expect(html).toContain('Enter amount paid')
    expect(html).toContain('blur-[7px]')
  })

  it('masks identifiers by default', () => {
    const html = renderDashboard(null, 90_000, false)
    const [first] = txs
    expect(html).not.toContain(first.address)
    expect(html).not.toContain(first.txid)
  })

  it('shows USD alongside CHF when a USD view is available', () => {
    const html = renderDashboard(12_000, 90_000, false, true)
    const usdLine = /≈ (<!-- -->)?\$\d/ // SSR separates adjacent text nodes with comments
    expect(html).toMatch(usdLine)
    expect(html).toContain('$112,500') // 90'000 CHF × 1.25 in the header
    expect(renderDashboard(12_000, 90_000, false, false)).not.toMatch(usdLine)
  })

  it('renders the empty app', () => {
    expect(renderToString(<App />)).toContain('Drop your CSV files here')
  })
})
