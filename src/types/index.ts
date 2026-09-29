export type TxType = 'received' | 'sent'

/** A single normalized on-chain transaction. All BTC amounts are integer satoshis. */
export interface Transaction {
  /** Stable key used for deduplication and React keys. */
  key: string
  txid: string
  /** Unix epoch milliseconds. */
  timestamp: number
  /** Original ISO 8601 string from the file. */
  time: string
  type: TxType
  amountSats: number
  feeSats: number
  address: string
  /** Fiat value at the time of the transaction, in `currency`. */
  historicalValue: number | null
  currency: string | null
  note: string
  sourceFile: string
}

export type WarningLevel = 'warning' | 'error'

export interface ParseWarning {
  level: WarningLevel
  file: string
  /** 1-based line number in the source file (header = line 1). */
  line?: number
  message: string
}

export interface FileParseResult {
  file: string
  transactions: Transaction[]
  warnings: ParseWarning[]
  rowCount: number
  skipped: number
}

export interface ImportSummary {
  files: string[]
  rowCount: number
  imported: number
  skipped: number
  duplicates: number
  warnings: ParseWarning[]
}

export interface ImportResult {
  ok: boolean
  transactions: Transaction[]
  currency: string | null
  summary: ImportSummary
  /** Blocking error (e.g. mixed currencies). When set, `transactions` is the unchanged prior set. */
  error?: string
}

/** [timestamp ms, price] */
export type PricePoint = [number, number]

export interface CurrentPrice {
  price: number
  change24h: number | null
  /** Unix ms of the latest price candle. */
  updatedAt: number
}

export interface PortfolioMetrics {
  receivedSats: number
  sentSats: number
  networkFeeSats: number
  heldSats: number
  purchaseCount: number
  /** Sum of historical values of all received rows. */
  historicalValue: number
  /** Received rows without a historical value (excluded from fiat sums). */
  missingHistoricalValues: number
  avgBuyPriceMarket: number | null
  amountPaid: number | null
  avgBuyPriceEffective: number | null
  currentPrice: number | null
  currentValue: number | null
  pnl: number | null
  pnlPct: number | null
  feesSpread: number | null
  feesSpreadPct: number | null
  networkFeeFiatHistorical: number | null
  networkFeeFiatCurrent: number | null
  breakEvenPrice: number | null
}

export interface Lot {
  tx: Transaction
  /** Fiat price per 1 BTC at the time of the transaction. */
  pricePerBtc: number | null
  currentValue: number | null
  pnl: number | null
  pnlPct: number | null
}
