import { useRef, useState } from 'react'
import { FileSpreadsheet, HardDrive, Lock, ShieldCheck, Upload, WifiOff } from 'lucide-react'

export function EmptyState({ onFiles, error }: { onFiles: (files: FileList) => void; error?: string | null }) {
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Your Bitcoin portfolio, <span className="text-orange-500">on your device only</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
          Import a wallet transaction export to see your holdings, true cost basis, fees and profit/loss. Everything
          runs in this browser tab — close or refresh it and the data is gone.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
        }}
        className={`mt-10 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging
            ? 'border-orange-500 bg-orange-500/5'
            : 'border-slate-300 bg-white hover:border-orange-400 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-orange-500/60'
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
          <Upload size={26} />
        </div>
        <div className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          Drop your CSV files here, or click to browse
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Multiple files are merged and de-duplicated by transaction ID
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: HardDrive, title: 'Parsed in memory', text: 'Files are read by your browser. Nothing is uploaded.' },
          { icon: Lock, title: 'Nothing stored', text: 'No cookies, no local storage. Refresh to wipe everything.' },
          { icon: WifiOff, title: 'Prices only', text: 'The only request fetches the public BTC price. Or go fully offline.' },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40"
          >
            <Icon size={18} className="text-orange-500" />
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        <div className="mb-2 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <FileSpreadsheet size={14} /> Expected columns
        </div>
        <code className="block overflow-x-auto font-mono text-[11px] whitespace-nowrap">
          Time, Type, Amount, Unit, Fee, Fee Unit, Address, Transaction ID, Historical value, Historical value
          currency, Note
        </code>
        <div className="mt-2 flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-500" />
          Try it with <span className="font-mono">sample-data.csv</span> from the repository (fake data).
        </div>
      </div>
    </div>
  )
}
