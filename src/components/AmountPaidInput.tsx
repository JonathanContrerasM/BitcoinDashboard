import { Wallet } from 'lucide-react'
import { useUi } from '../context/ui'
import type { PortfolioMetrics } from '../types'
import { Sensitive } from './ui'

export function AmountPaidInput({
  value,
  onChange,
  metrics,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  metrics: PortfolioMetrics
  invalid: boolean
}) {
  const { fmt, privacy, usd } = useUi()
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/[0.07] to-transparent p-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
          <Wallet size={20} />
        </div>
        <div>
          <label htmlFor="amount-paid" className="text-sm font-semibold text-slate-900 dark:text-white">
            Total amount paid (incl. all fees)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Everything you actually spent buying BTC — bank transfers to exchanges, card payments, etc.
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 lg:items-end">
        <div className="relative w-full lg:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">
            {fmt.currency}
          </span>
          <input
            id="amount-paid"
            type={privacy ? 'password' : 'text'}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 12'500.00"
            className={`w-full rounded-xl border bg-white py-2.5 pr-3 pl-14 text-right text-lg font-semibold tabular-nums text-slate-900 outline-none focus:ring-2 dark:bg-slate-950 dark:text-white ${
              invalid
                ? 'border-rose-400 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-orange-500 focus:ring-orange-500/20 dark:border-slate-700'
            }`}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {invalid ? (
            <span className="text-rose-500">Not a valid number</span>
          ) : (
            <>
              Market value of your purchases:{' '}
              <Sensitive className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {fmt.fiat(metrics.historicalValue)}
              </Sensitive>
              {usd && (
                <Sensitive className="tabular-nums">
                  {' '}
                  (≈ {usd.fmt.fiat(usd.metrics.historicalValue)}
                  {usd.metrics.amountPaid != null && <>; paid ≈ {usd.fmt.fiat(usd.metrics.amountPaid)}</>})
                </Sensitive>
              )}
            </>
          )}
        </p>
      </div>
    </section>
  )
}
