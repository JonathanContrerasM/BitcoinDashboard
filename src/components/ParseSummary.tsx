import { useState } from 'react'
import { CheckCircle2, ChevronDown, X } from 'lucide-react'
import type { ImportSummary } from '../types'

export function ParseSummary({
  summary,
  error,
  onDismiss,
}: {
  summary: ImportSummary
  error?: string
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(false)
  const warnings = summary.warnings
  const tone = error
    ? 'border-rose-300/60 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
    : warnings.length
      ? 'border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
      : 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
          <CheckCircle2 size={16} className={error ? 'text-rose-500' : 'text-emerald-500'} />
          {error ? 'Import rejected' : 'Import complete'}
        </span>
        <span className="text-slate-600 dark:text-slate-300">
          {summary.files.length} file{summary.files.length === 1 ? '' : 's'} · {summary.rowCount} rows ·{' '}
          <b>{summary.imported}</b> imported · {summary.skipped} skipped · {summary.duplicates} duplicates ·{' '}
          {warnings.length} warning{warnings.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {warnings.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Details <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-rose-800 dark:text-rose-200">{error}</p>}
      {open && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300">
          {warnings.map((w, i) => (
            <li key={i}>
              <span className={w.level === 'error' ? 'text-rose-600' : 'text-amber-600'}>{w.level}</span>{' '}
              {w.file}
              {w.line ? `:${w.line}` : ''} — {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
