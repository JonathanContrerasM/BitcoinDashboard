import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccumulationChart } from './components/AccumulationChart'
import { AmountPaidInput } from './components/AmountPaidInput'
import { BuyDistribution } from './components/BuyDistribution'
import { CostBreakdown } from './components/CostBreakdown'
import { EmptyState } from './components/EmptyState'
import { Header } from './components/Header'
import { KpiCards } from './components/KpiCards'
import { ParseSummary } from './components/ParseSummary'
import { PortfolioChart } from './components/PortfolioChart'
import { PriceChart } from './components/PriceChart'
import { StatsPanel } from './components/StatsPanel'
import { TransactionTable } from './components/TransactionTable'
import { Notice } from './components/ui'
import { WhatIfSimulator } from './components/WhatIfSimulator'
import { CHART_COLORS, type Theme, UiContext, type UiState } from './context/ui'
import { useCurrentPrice, usePriceHistory } from './hooks/usePrice'
import { computeLots, computeMetrics, computeStats, costScale, withImpliedPrices } from './lib/calculations'
import { createFormatters } from './lib/format'
import { parseFiatNumber } from './lib/numbers'
import { mergeImports, parseCsv } from './lib/parse'
import type { ImportSummary, PricePoint, Transaction } from './types'

export default function App() {
  // All state lives in memory only. Refreshing the page clears everything.
  const [txs, setTxs] = useState<Transaction[]>([])
  const [currency, setCurrency] = useState<string | null>(null)
  const [importInfo, setImportInfo] = useState<{ summary: ImportSummary; error?: string } | null>(null)
  const [amountPaidText, setAmountPaidText] = useState('')
  const [manualPriceText, setManualPriceText] = useState('')
  const [offline, setOffline] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [revealIds, setRevealIds] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const hasData = txs.length > 0
  const manualPrice = parseFiatNumber(manualPriceText)
  const manualValid = manualPrice != null && manualPrice > 0 ? manualPrice : null
  const amountPaid = parseFiatNumber(amountPaidText)
  const amountPaidInvalid = amountPaidText.trim() !== '' && (amountPaid == null || amountPaid <= 0)

  const price = useCurrentPrice(hasData ? currency : null, !offline && manualValid == null)
  const history = usePriceHistory(hasData ? currency : null, !offline)
  const effectivePrice = manualValid ?? price.data?.price ?? null

  const fmt = useMemo(() => createFormatters(currency ?? 'USD'), [currency])
  const ui: UiState = useMemo(
    () => ({ privacy, revealIds, setRevealIds, theme, colors: CHART_COLORS[theme], fmt }),
    [privacy, revealIds, theme, fmt],
  )

  const metrics = useMemo(
    () => computeMetrics(txs, amountPaidInvalid ? null : amountPaid, effectivePrice),
    [txs, amountPaid, amountPaidInvalid, effectivePrice],
  )
  const lots = useMemo(() => computeLots(txs, effectivePrice), [txs, effectivePrice])
  const stats = useMemo(() => computeStats(txs, now), [txs, now])
  const scale = costScale(metrics)

  // Price series for charts: market data, back-filled with prices implied by the user's own transactions.
  const { chartPrices, note } = useMemo(() => {
    if (history.prices.length > 0) {
      const merged = withImpliedPrices(history.prices, txs)
      const start = history.prices[0][0]
      return {
        chartPrices: merged,
        note:
          merged.length > history.prices.length
            ? `Market data starts ${fmt.date(start)}. Earlier points use the prices implied by your own transactions.`
            : null,
      }
    }
    const implied: PricePoint[] = withImpliedPrices([], txs)
    if (effectivePrice != null) implied.push([Math.max(now, implied.at(-1)?.[0] ?? 0), effectivePrice])
    return {
      chartPrices: implied,
      note: offline
        ? 'Offline mode: the chart uses prices implied by your own transactions plus the current price.'
        : history.error
          ? `Price history unavailable (${history.error}). Showing prices implied by your transactions.`
          : null,
    }
  }, [history.prices, history.error, txs, effectivePrice, offline, now, fmt])

  const importFiles = useCallback(
    async (files: FileList) => {
      const results = await Promise.all(
        [...files].map(async (f) => parseCsv(await f.text(), f.name)),
      )
      const r = mergeImports(txs, results)
      setImportInfo({ summary: r.summary, error: r.error })
      if (r.ok) {
        setTxs(r.transactions)
        setCurrency(r.currency ?? currency ?? 'USD')
      }
    },
    [txs, currency],
  )

  const clearAll = () => {
    setTxs([])
    setCurrency(null)
    setImportInfo(null)
    setAmountPaidText('')
    setManualPriceText('')
    setRevealIds(false)
  }

  const avgPrice = metrics.avgBuyPriceEffective ?? metrics.avgBuyPriceMarket
  const avgLabel = metrics.avgBuyPriceEffective != null ? 'Avg buy (effective)' : 'Avg buy (market)'
  const noCurrencyInFile = hasData && txs.every((t) => !t.currency)

  return (
    <UiContext.Provider value={ui}>
      <div
        className="min-h-screen"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files)
        }}
      >
        <Header
          currency={hasData ? currency : null}
          price={price}
          effectivePrice={effectivePrice}
          manualPrice={manualPriceText}
          onManualPrice={setManualPriceText}
          offline={offline}
          onOffline={setOffline}
          onTogglePrivacy={() => setPrivacy((p) => !p)}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onImport={(f) => void importFiles(f)}
          onClear={clearAll}
          hasData={hasData}
        />

        {!hasData ? (
          <>
            {importInfo && (
              <div className="mx-auto max-w-3xl px-4 pt-8">
                <ParseSummary
                  summary={importInfo.summary}
                  error={importInfo.error ?? (importInfo.summary.imported === 0 ? 'No valid transactions found in the file(s).' : undefined)}
                  onDismiss={() => setImportInfo(null)}
                />
              </div>
            )}
            <EmptyState onFiles={(f) => void importFiles(f)} />
          </>
        ) : (
          <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {importInfo && (
              <ParseSummary summary={importInfo.summary} error={importInfo.error} onDismiss={() => setImportInfo(null)} />
            )}
            {noCurrencyInFile && (
              <Notice>
                No "Historical value currency" found in the file — defaulting to {currency}.
              </Notice>
            )}
            {metrics.missingHistoricalValues > 0 && (
              <Notice>
                {metrics.missingHistoricalValues} received transaction(s) have no historical value and are excluded
                from fiat totals.
              </Notice>
            )}
            {!offline && manualValid == null && price.error && !price.data && (
              <Notice tone="error">
                {price.error} You can enter a manual price by clicking the price in the header.
              </Notice>
            )}

            <AmountPaidInput
              value={amountPaidText}
              onChange={setAmountPaidText}
              metrics={metrics}
              invalid={amountPaidInvalid}
            />

            <KpiCards m={metrics} priceLoading={price.loading} />

            <div className="grid gap-6 xl:grid-cols-2">
              <PortfolioChart
                txs={txs}
                prices={chartPrices}
                scale={scale}
                hasAmountPaid={metrics.amountPaid != null}
                loading={history.loading}
                note={note}
              />
              <PriceChart
                prices={chartPrices}
                txs={txs}
                avgPrice={avgPrice}
                avgLabel={avgLabel}
                loading={history.loading}
                error={history.error}
                now={now}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              <CostBreakdown m={metrics} />
              <AccumulationChart txs={txs} scale={scale} hasAmountPaid={metrics.amountPaid != null} />
              <BuyDistribution lots={lots} currentPrice={effectivePrice} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <WhatIfSimulator m={metrics} />
              <StatsPanel s={stats} />
            </div>

            <TransactionTable lots={lots} />

            <footer className="pt-4 pb-8 text-center text-xs text-slate-500 dark:text-slate-500">
              Data lives only in this tab's memory. Prices from Kraken
              {offline ? ' (offline mode — no requests)' : ''}. Not financial advice.
            </footer>
          </main>
        )}
      </div>
    </UiContext.Provider>
  )
}
