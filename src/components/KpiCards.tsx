import type { ReactNode } from 'react'
import { Bitcoin, Coins, Receipt, Scale, Target, TrendingDown, TrendingUp, Wallet, Zap } from 'lucide-react'
import { useUi } from '../context/ui'
import type { PortfolioMetrics } from '../types'
import { Alt, Sensitive, Skeleton } from './ui'

const ENTER = 'Enter amount paid'

function Kpi({
  label,
  icon,
  value,
  sub,
  tone,
  loading,
  sensitive = true,
  placeholder,
  alt,
}: {
  label: string
  icon: ReactNode
  value?: ReactNode
  sub?: ReactNode
  tone?: 'gain' | 'loss'
  loading?: boolean
  sensitive?: boolean
  placeholder?: string
  /** Secondary USD line (already formatted). */
  alt?: ReactNode
}) {
  const color =
    tone === 'gain'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'loss'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-white'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <span className="text-orange-500">{icon}</span>
        {label}
      </div>
      <div className="mt-3 min-h-[2.25rem]">
        {loading ? (
          <Skeleton className="h-8 w-36" />
        ) : placeholder ? (
          <span className="text-sm font-medium text-slate-400 italic dark:text-slate-500">{placeholder}</span>
        ) : (
          <div className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`}>
            {sensitive ? <Sensitive>{value}</Sensitive> : value}
          </div>
        )}
      </div>
      {alt != null && !placeholder && !loading && <Alt className="mt-0.5">{alt}</Alt>}
      {sub && !placeholder && (
        <div className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
          {sensitive ? <Sensitive>{sub}</Sensitive> : sub}
        </div>
      )}
    </div>
  )
}

export function KpiCards({ m, priceLoading }: { m: PortfolioMetrics; priceLoading: boolean }) {
  const { fmt, usd } = useUi()
  const u = usd?.metrics
  const usdFiat = (v: number | null | undefined, decimals?: number, signed?: boolean) =>
    usd && v != null && Number.isFinite(v) ? usd.fmt.fiat(v, { decimals, signed }) : undefined
  const needPrice = m.currentPrice == null
  const pnlTone = m.pnl == null ? undefined : m.pnl >= 0 ? 'gain' : 'loss'

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="BTC held"
        icon={<Bitcoin size={14} />}
        value={fmt.btc(m.heldSats)}
        sub={fmt.sats(m.heldSats)}
      />
      <Kpi
        label="Current value"
        icon={<Coins size={14} />}
        loading={priceLoading && needPrice}
        placeholder={!priceLoading && needPrice ? 'Price unavailable' : undefined}
        value={fmt.fiat(m.currentValue)}
        alt={usdFiat(u?.currentValue)}
        sub={m.currentPrice != null ? `@ ${fmt.fiat(m.currentPrice, { decimals: 0 })} / BTC` : undefined}
      />
      <Kpi
        label="Total paid"
        icon={<Wallet size={14} />}
        placeholder={m.amountPaid == null ? ENTER : undefined}
        value={fmt.fiat(m.amountPaid)}
        alt={usdFiat(u?.amountPaid)}
        sub="incl. all fees"
      />
      <Kpi
        label="Profit / Loss"
        icon={pnlTone === 'loss' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
        tone={pnlTone}
        loading={priceLoading && needPrice && m.amountPaid != null}
        placeholder={m.amountPaid == null ? ENTER : needPrice && !priceLoading ? 'Price unavailable' : undefined}
        value={fmt.fiat(m.pnl, { signed: true })}
        alt={
          u?.pnl != null ? (
            <>
              {usdFiat(u.pnl, 2, true)} ({fmt.percent(u.pnlPct, { signed: true })})
            </>
          ) : undefined
        }
        sub={<span className={pnlTone === 'loss' ? 'text-rose-500' : 'text-emerald-500'}>{fmt.percent(m.pnlPct, { signed: true })}</span>}
      />
      <Kpi
        label="Avg buy price (effective)"
        icon={<Target size={14} />}
        placeholder={m.amountPaid == null ? ENTER : undefined}
        value={fmt.fiat(m.avgBuyPriceEffective, { decimals: 0 })}
        alt={usdFiat(u?.avgBuyPriceEffective, 0)}
        sub={
          <>
            Market avg: {fmt.fiat(m.avgBuyPriceMarket, { decimals: 0 })}
            {u?.avgBuyPriceMarket != null && <> · {usdFiat(u.avgBuyPriceMarket, 0)}</>}
          </>
        }
      />
      <Kpi
        label="Break-even price"
        icon={<Scale size={14} />}
        placeholder={m.amountPaid == null ? ENTER : undefined}
        value={fmt.fiat(m.breakEvenPrice, { decimals: 0 })}
        alt={usdFiat(u?.breakEvenPrice, 0)}
        sub={
          m.breakEvenPrice != null && m.currentPrice != null
            ? `${fmt.percent(m.currentPrice / m.breakEvenPrice - 1, { signed: true })} vs. current price`
            : undefined
        }
      />
      <Kpi
        label="Fees, spread & exchange costs"
        icon={<Receipt size={14} />}
        placeholder={m.amountPaid == null ? ENTER : undefined}
        value={fmt.fiat(m.feesSpread)}
        alt={usdFiat(u?.feesSpread)}
        sub={`${fmt.percent(m.feesSpreadPct)} of amount paid`}
      />
      <Kpi
        label="Network fees"
        icon={<Zap size={14} />}
        value={fmt.sats(m.networkFeeSats)}
        alt={u ? <>{usdFiat(u.networkFeeFiatHistorical) ?? '—'} at the time · {usdFiat(u.networkFeeFiatCurrent) ?? '—'} today</> : undefined}
        sub={
          <>
            {fmt.fiat(m.networkFeeFiatHistorical)} at the time · {fmt.fiat(m.networkFeeFiatCurrent)} today
          </>
        }
      />
    </div>
  )
}
