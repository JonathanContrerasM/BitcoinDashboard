import type { ReactNode } from 'react'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { maskIdentifier } from '../lib/format'
import { useUi } from '../context/ui'

export function Card({
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** Wraps an amount so it is blurred in privacy mode. */
export function Sensitive({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { privacy } = useUi()
  return (
    <span
      className={`transition-[filter] ${privacy ? 'pointer-events-none blur-[7px] select-none' : ''} ${className}`}
      aria-hidden={privacy || undefined}
    >
      {children}
    </span>
  )
}

/** Secondary (USD) figure: small, muted, blurred in privacy mode. */
export function Alt({
  children,
  sensitive = true,
  className = '',
}: {
  children: ReactNode
  sensitive?: boolean
  className?: string
}) {
  const { privacy } = useUi()
  const hide = sensitive && privacy
  return (
    <span
      className={`block text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400 ${
        hide ? 'pointer-events-none blur-[6px] select-none' : ''
      } ${className}`}
      aria-hidden={hide || undefined}
    >
      ≈ {children}
    </span>
  )
}

/** Address / tx ID, masked unless the user reveals identifiers. */
export function Masked({ value }: { value: string }) {
  const { revealIds, privacy } = useUi()
  if (!value) return <span className="text-slate-400">—</span>
  const shown = revealIds && !privacy ? value : maskIdentifier(value)
  return (
    <span className="font-mono text-xs break-all" title={revealIds && !privacy ? value : undefined}>
      {shown}
    </span>
  )
}

export function RevealToggle() {
  const { revealIds, setRevealIds } = useUi()
  return (
    <button
      type="button"
      onClick={() => setRevealIds(!revealIds)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {revealIds ? <EyeOff size={14} /> : <Eye size={14} />}
      {revealIds ? 'Mask IDs' : 'Reveal IDs'}
    </button>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
}

export function Notice({
  tone = 'warning',
  children,
}: {
  tone?: 'warning' | 'error' | 'info'
  children: ReactNode
}) {
  const styles = {
    warning: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    error: 'border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    info: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  }[tone]
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${styles}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div className="max-w-xs px-4">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

interface TooltipRow {
  label: string
  value: string
  color?: string
  sensitive?: boolean
}

/** Theme-aware tooltip body used by all charts. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  const { privacy } = useUi()
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1 font-medium text-slate-900 dark:text-slate-100">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {r.sensitive && privacy ? '•••••' : r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
