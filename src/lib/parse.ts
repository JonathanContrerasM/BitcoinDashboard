import Papa from 'papaparse'
import type {
  FileParseResult,
  ImportResult,
  ParseWarning,
  Transaction,
  TxType,
} from '../types'
import { normalizeUnit, parseFiatNumber, toSats } from './numbers'

/** Canonical column names, matched case-insensitively after trimming. */
const COLUMNS = {
  time: 'time',
  type: 'type',
  amount: 'amount',
  unit: 'unit',
  fee: 'fee',
  feeUnit: 'fee unit',
  address: 'address',
  txid: 'transaction id',
  historicalValue: 'historical value',
  historicalCurrency: 'historical value currency',
  note: 'note',
} as const

const REQUIRED = [COLUMNS.time, COLUMNS.type, COLUMNS.amount, COLUMNS.unit] as const

type Row = Record<string, string | undefined>

function field(row: Row, col: string): string {
  return (row[col] ?? '').trim()
}

function parseType(raw: string): TxType | null {
  const t = raw.toLowerCase()
  if (t === 'received' || t === 'receive' || t === 'in' || t === 'deposit') return 'received'
  if (t === 'sent' || t === 'send' || t === 'out' || t === 'withdrawal') return 'sent'
  return null
}

/** Parses a single CSV file's text. Never throws; problems are reported as warnings. */
export function parseCsv(text: string, file: string): FileParseResult {
  const warnings: ParseWarning[] = []
  const transactions: Transaction[] = []

  const parsed = Papa.parse<Row>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const headers = parsed.meta.fields ?? []
  const missing = REQUIRED.filter((c) => !headers.includes(c))
  if (missing.length > 0) {
    warnings.push({
      level: 'error',
      file,
      message: `Missing required column(s): ${missing.join(', ')}. Is this a wallet transaction export?`,
    })
    return { file, transactions, warnings, rowCount: parsed.data.length, skipped: parsed.data.length }
  }

  for (const err of parsed.errors) {
    // Field-count mismatches are common in hand-edited files; rows are still validated below.
    warnings.push({
      level: 'warning',
      file,
      line: err.row != null ? err.row + 2 : undefined,
      message: `CSV: ${err.message}`,
    })
  }

  let skipped = 0
  parsed.data.forEach((row, i) => {
    const line = i + 2
    const skip = (message: string) => {
      skipped++
      warnings.push({ level: 'warning', file, line, message: `${message} — row skipped` })
    }

    const rawType = field(row, COLUMNS.type)
    const type = parseType(rawType)
    if (!type) return skip(`Unknown transaction type "${rawType}"`)

    const time = field(row, COLUMNS.time)
    const timestamp = Date.parse(time)
    if (!time || Number.isNaN(timestamp)) return skip(`Invalid time "${time}"`)

    const unit = normalizeUnit(field(row, COLUMNS.unit))
    if (!unit) return skip(`Unsupported unit "${field(row, COLUMNS.unit)}" (expected satoshi or BTC)`)

    const amountSats = toSats(field(row, COLUMNS.amount), unit)
    if (amountSats == null) return skip(`Invalid amount "${field(row, COLUMNS.amount)}"`)
    if (amountSats === 0) return skip('Zero amount')

    let feeSats = 0
    const rawFee = field(row, COLUMNS.fee)
    if (rawFee) {
      const feeUnit = field(row, COLUMNS.feeUnit) ? normalizeUnit(field(row, COLUMNS.feeUnit)) : unit
      const fee = feeUnit ? toSats(rawFee, feeUnit) : null
      if (fee == null) {
        warnings.push({ level: 'warning', file, line, message: `Invalid fee "${rawFee}" — treated as 0` })
      } else {
        feeSats = fee
      }
    }

    const rawValue = field(row, COLUMNS.historicalValue)
    let historicalValue: number | null = null
    if (rawValue) {
      historicalValue = parseFiatNumber(rawValue)
      if (historicalValue == null) {
        warnings.push({ level: 'warning', file, line, message: `Unreadable historical value "${rawValue}"` })
      } else {
        historicalValue = Math.abs(historicalValue)
      }
    } else if (type === 'received') {
      warnings.push({ level: 'warning', file, line, message: 'Missing historical value' })
    }

    const currency = field(row, COLUMNS.historicalCurrency).toUpperCase() || null
    const txid = field(row, COLUMNS.txid)

    transactions.push({
      key: txid ? `${txid}:${type}` : `${file}:${line}:${timestamp}:${type}:${amountSats}`,
      txid,
      timestamp,
      time,
      type,
      amountSats,
      feeSats,
      address: field(row, COLUMNS.address),
      historicalValue,
      currency,
      note: field(row, COLUMNS.note),
      sourceFile: file,
    })
  })

  return { file, transactions, warnings, rowCount: parsed.data.length, skipped }
}

/**
 * Merges newly parsed files into the existing transaction set.
 * Deduplicates by transaction ID (+ direction, so a self-transfer can appear as both
 * sent and received) and enforces a single fiat currency across everything.
 */
export function mergeImports(existing: Transaction[], results: FileParseResult[]): ImportResult {
  const warnings = results.flatMap((r) => r.warnings)
  const summary = {
    files: results.map((r) => r.file),
    rowCount: results.reduce((s, r) => s + r.rowCount, 0),
    imported: 0,
    skipped: results.reduce((s, r) => s + r.skipped, 0),
    duplicates: 0,
    warnings,
  }

  const byKey = new Map(existing.map((t) => [t.key, t]))
  for (const tx of results.flatMap((r) => r.transactions)) {
    if (byKey.has(tx.key)) {
      summary.duplicates++
      continue
    }
    byKey.set(tx.key, tx)
    summary.imported++
  }

  const merged = [...byKey.values()].sort((a, b) => a.timestamp - b.timestamp)
  const currencies = detectCurrencies(merged)

  if (currencies.length > 1) {
    return {
      ok: false,
      transactions: existing,
      currency: detectCurrencies(existing)[0] ?? null,
      summary: { ...summary, imported: 0 },
      error: `Mixed currencies found (${currencies.join(', ')}). All rows must use the same "Historical value currency". Export your data in a single currency and try again.`,
    }
  }

  return { ok: true, transactions: merged, currency: currencies[0] ?? null, summary }
}

export function detectCurrencies(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => t.currency).filter((c): c is string => !!c))].sort()
}
