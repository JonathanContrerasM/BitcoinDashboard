import { useRef, useState } from 'react'
import {
  Bitcoin,
  EyeOff,
  Eye,
  Moon,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  WifiOff,
} from 'lucide-react'
import type { PriceState } from '../hooks/usePrice'
import { useUi } from '../context/ui'
import { Skeleton } from './ui'

interface Props {
  currency: string | null
  price: PriceState
  effectivePrice: number | null
  manualPrice: string
  onManualPrice: (v: string) => void
  offline: boolean
  onOffline: (v: boolean) => void
  onTogglePrivacy: () => void
  onToggleTheme: () => void
  onImport: (files: FileList) => void
  onClear: () => void
  hasData: boolean
}

const iconBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

export function Header(props: Props) {
  const { privacy, theme, fmt } = useUi()
  const fileInput = useRef<HTMLInputElement>(null)
  const [priceOpen, setPriceOpen] = useState(false)
  const { price, currency } = props
  const manual = props.manualPrice.trim() !== '' && props.effectivePrice != null
  const change = manual ? null : price.data?.change24h ?? null

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Bitcoin size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              Bitcoin Portfolio
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={12} />
              Local only · nothing stored or uploaded
            </div>
          </div>
        </div>

        {currency && (
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {currency}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPriceOpen((o) => !o)}
                className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Price source settings"
              >
                {props.effectivePrice != null ? (
                  <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                    {fmt.fiat(props.effectivePrice, { decimals: 0 })}
                  </span>
                ) : price.loading ? (
                  <Skeleton className="h-6 w-28" />
                ) : (
                  <span className="text-sm font-medium text-rose-500">No price</span>
                )}
                {change != null && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                      change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {fmt.percent(change, { signed: true })} 24h
                  </span>
                )}
                {manual && (
                  <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                    MANUAL
                  </span>
                )}
                {props.offline && <WifiOff size={14} className="self-center text-slate-400" />}
              </button>
              {priceOpen && (
                <PricePopover {...props} onClose={() => setPriceOpen(false)} />
              )}
            </div>
            {!props.offline && !manual && (
              <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex dark:text-slate-400">
                {price.error ? (
                  <span className="text-rose-500">{price.error}</span>
                ) : price.lastFetched ? (
                  <span>Updated {fmt.time(price.lastFetched)}</span>
                ) : null}
                <button
                  type="button"
                  onClick={price.refresh}
                  className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Refresh price"
                  aria-label="Refresh price"
                >
                  <RefreshCw size={14} className={price.loading ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={props.onTogglePrivacy}
            className={`${iconBtn} ${privacy ? 'border-orange-500/60 bg-orange-500/10 text-orange-600 dark:text-orange-400' : ''}`}
            title="Privacy mode: blur all amounts"
            aria-pressed={privacy}
          >
            {privacy ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">Privacy</span>
          </button>
          <button
            type="button"
            onClick={props.onToggleTheme}
            className={iconBtn}
            title="Toggle light / dark"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {props.hasData && (
            <button type="button" onClick={props.onClear} className={iconBtn} title="Clear all data from memory">
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) props.onImport(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}

function PricePopover(props: Props & { onClose: () => void }) {
  const { fmt } = useUi()
  return (
    <div className="absolute top-full left-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <PencilLine size={14} /> Price source
      </div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
        Manual BTC price ({props.currency})
        <input
          type="text"
          inputMode="decimal"
          value={props.manualPrice}
          onChange={(e) => props.onManualPrice(e.target.value)}
          placeholder={props.price.data ? fmt.number(props.price.data.price, 0) : 'e.g. 95000'}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        Overrides the live price while filled in. Clear it to go back to the live Kraken price.
      </p>
      <label className="mt-4 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={props.offline}
          onChange={(e) => props.onOffline(e.target.checked)}
          className="mt-0.5 accent-orange-500"
        />
        <span>
          <span className="font-medium">Offline mode</span> — make no network requests at all. Charts fall back
          to prices derived from your own transactions.
        </span>
      </label>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Done
        </button>
      </div>
    </div>
  )
}
