import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useUi } from '../context/ui'
import type { Lot } from '../types'
import { Card, Masked, RevealToggle, Segmented, Sensitive } from './ui'

type SortKey = 'date' | 'type' | 'amount' | 'price' | 'value' | 'current' | 'pnl' | 'fee'
const FILTERS = ['All', 'Received', 'Sent'] as const
const PAGE_SIZE = 15

const sorters: Record<SortKey, (l: Lot) => number | string> = {
  date: (l) => l.tx.timestamp,
  type: (l) => l.tx.type,
  amount: (l) => l.tx.amountSats,
  price: (l) => l.pricePerBtc ?? -Infinity,
  value: (l) => l.tx.historicalValue ?? -Infinity,
  current: (l) => l.currentValue ?? -Infinity,
  pnl: (l) => l.pnl ?? -Infinity,
  fee: (l) => l.tx.feeSats,
}

export function TransactionTable({ lots }: { lots: Lot[] }) {
  const { fmt } = useUi()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = lots.filter((l) => {
      if (filter === 'Received' && l.tx.type !== 'received') return false
      if (filter === 'Sent' && l.tx.type !== 'sent') return false
      if (!q) return true
      return (
        l.tx.note.toLowerCase().includes(q) ||
        l.tx.time.toLowerCase().includes(q) ||
        fmt.date(l.tx.timestamp).toLowerCase().includes(q) ||
        l.tx.address.toLowerCase().includes(q) ||
        l.tx.txid.toLowerCase().includes(q)
      )
    })
    const get = sorters[sort.key]
    return filtered.sort((a, b) => {
      const x = get(a)
      const y = get(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [lots, filter, query, sort, fmt])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <th className={`px-3 py-2.5 font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => {
          setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))
          setPage(0)
        }}
        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
      >
        {label}
        {sort.key !== key ? (
          <ArrowUpDown size={12} className="opacity-40" />
        ) : sort.dir === 1 ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )}
      </button>
    </th>
  )

  const pnlClass = (v: number | null) =>
    v == null ? '' : v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'

  return (
    <Card
      title="Transactions"
      subtitle={`${rows.length} of ${lots.length} transactions`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Filter by note, date, ID…"
              className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pr-2 pl-8 text-xs outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <Segmented
            value={filter}
            options={FILTERS}
            onChange={(v) => {
              setFilter(v)
              setPage(0)
            }}
          />
          <RevealToggle />
        </div>
      }
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm tabular-nums">
          <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {header('date', 'Date', 'left')}
              {header('type', 'Type', 'left')}
              {header('amount', 'Amount')}
              {header('price', 'Price / BTC')}
              {header('value', 'Fiat value')}
              {header('current', 'Current value')}
              {header('pnl', 'P/L')}
              {header('fee', 'Fee')}
              <th className="px-3 py-2.5 text-left font-medium">Address / Tx ID</th>
              <th className="px-3 py-2.5 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {visible.map((l) => (
              <tr key={l.tx.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {fmt.dateTime(l.tx.timestamp)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                      l.tx.type === 'received'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {l.tx.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Sensitive>
                    <span className="block text-slate-900 dark:text-white">
                      {fmt.btc(l.tx.type === 'sent' ? -l.tx.amountSats : l.tx.amountSats, { signed: true })}
                    </span>
                    <span className="block text-xs text-slate-500">{fmt.sats(l.tx.amountSats)}</span>
                  </Sensitive>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {fmt.fiat(l.pricePerBtc, { decimals: 0 })}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Sensitive>{fmt.fiat(l.tx.historicalValue)}</Sensitive>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Sensitive>{fmt.fiat(l.currentValue)}</Sensitive>
                </td>
                <td className={`px-3 py-2.5 text-right whitespace-nowrap ${pnlClass(l.pnl)}`}>
                  <Sensitive>
                    <span className="block">{fmt.fiat(l.pnl, { signed: true })}</span>
                  </Sensitive>
                  {l.pnlPct != null && <span className="block text-xs">{fmt.percent(l.pnlPct, { signed: true })}</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                  {l.tx.feeSats ? <Sensitive>{fmt.sats(l.tx.feeSats)}</Sensitive> : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700 dark:text-slate-300">
                    <Masked value={l.tx.address} />
                  </div>
                  <div className="text-slate-500">
                    <Masked value={l.tx.txid} />
                  </div>
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400" title={l.tx.note}>
                  {l.tx.note || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Page {current + 1} of {pages}
          </span>
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-slate-200 p-1 disabled:opacity-40 dark:border-slate-700"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="rounded-md border border-slate-200 p-1 disabled:opacity-40 dark:border-slate-700"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </Card>
  )
}
