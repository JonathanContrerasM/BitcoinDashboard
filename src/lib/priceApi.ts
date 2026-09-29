import type { CurrentPrice, PricePoint } from '../types'

/**
 * Kraken public market-data client.
 *
 * PRIVACY: requests only ever contain the trading pair (e.g. "XBTCHF"), a candle interval
 * and a start timestamp. No user data (addresses, tx IDs, amounts) is ever sent.
 * Responses are cached in memory only.
 */
export const PRICE_API_BASE = 'https://api.kraken.com/0/public'

/** Fiat currencies Kraken has a BTC market for. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'CHF', 'GBP', 'CAD', 'AUD', 'JPY'] as const

const CURRENT_TTL_MS = 50_000
const HISTORY_TTL_MS = 15 * 60_000
const DAY_S = 86_400

export class PriceApiError extends Error {
  readonly status: number | null
  readonly retryAfterMs: number | null

  constructor(message: string, status: number | null = null, retryAfterMs: number | null = null) {
    super(message)
    this.name = 'PriceApiError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }

  get isRateLimit(): boolean {
    return this.status === 429
  }
}

/** [time (s), open, high, low, close, vwap, volume, count] — numbers are strings. */
type Candle = [number, string, string, string, string, string, string, number]

interface KrakenResponse {
  error?: string[]
  result?: Record<string, unknown>
}

interface CacheEntry<T> {
  value: T
  expires: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export function clearPriceCache(): void {
  cache.clear()
}

export function krakenPair(currency: string): string {
  const cur = currency.toUpperCase()
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(cur)) {
    throw new PriceApiError(`Kraken has no BTC/${cur} market — enter a manual price instead.`)
  }
  return `XBT${cur}`
}

export function ohlcUrl(pair: string, intervalMinutes: number, sinceSeconds?: number): string {
  const since = sinceSeconds != null ? `&since=${Math.floor(sinceSeconds)}` : ''
  return `${PRICE_API_BASE}/OHLC?pair=${encodeURIComponent(pair)}&interval=${intervalMinutes}${since}`
}

/** Fetches JSON, cached in memory under `key` (the URL may vary, e.g. with a moving `since`). */
async function getJson<T>(key: string, url: string, ttl: number, force = false): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined
  if (!force && hit && hit.expires > Date.now()) return hit.value

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const request = (async () => {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      })
    } catch {
      throw new PriceApiError('Could not reach api.kraken.com (offline, blocked, or CORS).')
    }
    if (res.status === 429) throw new PriceApiError('Rate limited by Kraken. Retrying shortly…', 429, 60_000)
    if (!res.ok) throw new PriceApiError(`Price API error (HTTP ${res.status}).`, res.status)
    const value = (await res.json()) as T
    cache.set(key, { value, expires: Date.now() + ttl })
    return value
  })()

  inflight.set(key, request)
  try {
    return await request
  } finally {
    inflight.delete(key)
  }
}

/** Kraken replies HTTP 200 with an `error` array; the result key varies (e.g. XBTCHF vs XXBTZUSD). */
function candlesFrom(data: KrakenResponse): Candle[] {
  const errors = data.error ?? []
  if (errors.length > 0) {
    const msg = errors.join('; ')
    if (/too many requests|rate limit/i.test(msg)) {
      throw new PriceApiError('Rate limited by Kraken. Retrying shortly…', 429, 60_000)
    }
    if (/unknown asset pair/i.test(msg)) throw new PriceApiError('Kraken does not offer this currency pair.')
    throw new PriceApiError(`Kraken error: ${msg}`)
  }
  const key = Object.keys(data.result ?? {}).find((k) => k !== 'last')
  const candles = key ? data.result?.[key] : null
  if (!Array.isArray(candles)) throw new PriceApiError('Unexpected response from Kraken.')
  return candles as Candle[]
}

/** Current price and rolling 24h change from the last 24h of 15-minute candles (one request). */
export async function fetchCurrentPrice(currency: string, force = false): Promise<CurrentPrice> {
  const pair = krakenPair(currency)
  const since = Date.now() / 1000 - DAY_S
  const data = await getJson<KrakenResponse>(`current:${pair}`, ohlcUrl(pair, 15, since), CURRENT_TTL_MS, force)
  const candles = candlesFrom(data)
  const first = candles[0]
  const last = candles[candles.length - 1]
  const price = last ? Number(last[4]) : NaN
  if (!Number.isFinite(price)) throw new PriceApiError(`No BTC price available in ${currency.toUpperCase()}.`)
  const open = first ? Number(first[1]) : NaN
  return {
    price,
    change24h: Number.isFinite(open) && open > 0 ? price / open - 1 : null,
    updatedAt: last[0] * 1000,
  }
}

/** Daily closing prices (Kraken returns roughly the last 720 days). */
export async function fetchPriceHistory(currency: string): Promise<PricePoint[]> {
  const pair = krakenPair(currency)
  const data = await getJson<KrakenResponse>(`history:${pair}`, ohlcUrl(pair, 1440), HISTORY_TTL_MS)
  const prices = candlesFrom(data)
    .map((c): PricePoint => [c[0] * 1000, Number(c[4])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (prices.length === 0) throw new PriceApiError('Price history was empty.')
  return prices
}
