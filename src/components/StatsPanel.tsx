import type { ReactNode } from 'react'
import { useUi } from '../context/ui'
import type { PortfolioStats } from '../lib/calculations'
import { Card, Sensitive } from './ui'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-slate-900 dark:text-white">{children}</dd>
    </div>
  )
}

export function StatsPanel({ s }: { s: PortfolioStats }) {
  const { fmt } = useUi()
  const years = s.holdingDays != null ? s.holdingDays / 365.25 : null
  return (
    <Card title="Stats">
      <dl>
        <Row label="Purchases">{s.purchases}</Row>
        <Row label="First purchase">{s.firstPurchase ? fmt.date(s.firstPurchase.timestamp) : '—'}</Row>
        <Row label="Last purchase">{s.lastPurchase ? fmt.date(s.lastPurchase.timestamp) : '—'}</Row>
        <Row label="Holding period">
          {s.holdingDays != null
            ? `${fmt.number(s.holdingDays)} days${years != null && years >= 1 ? ` (${fmt.number(years, 1)} y)` : ''}`
            : '—'}
        </Row>
        <Row label="Average purchase">
          <Sensitive>
            {s.avgPurchaseSats != null ? fmt.sats(s.avgPurchaseSats) : '—'}
            {s.avgPurchaseFiat != null && (
              <span className="block text-xs font-normal text-slate-500">{fmt.fiat(s.avgPurchaseFiat)}</span>
            )}
          </Sensitive>
        </Row>
        <Row label="Largest purchase">
          {s.largestPurchase ? (
            <Sensitive>
              {fmt.sats(s.largestPurchase.amountSats)}
              <span className="block text-xs font-normal text-slate-500">{fmt.date(s.largestPurchase.timestamp)}</span>
            </Sensitive>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Best-timed buy">
          {s.bestBuy ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              {fmt.fiat(s.bestBuy.price, { decimals: 0 })}
              <span className="block text-xs font-normal text-slate-500">{fmt.date(s.bestBuy.tx.timestamp)}</span>
            </span>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Worst-timed buy">
          {s.worstBuy ? (
            <span className="text-rose-600 dark:text-rose-400">
              {fmt.fiat(s.worstBuy.price, { decimals: 0 })}
              <span className="block text-xs font-normal text-slate-500">{fmt.date(s.worstBuy.tx.timestamp)}</span>
            </span>
          ) : (
            '—'
          )}
        </Row>
      </dl>
    </Card>
  )
}
