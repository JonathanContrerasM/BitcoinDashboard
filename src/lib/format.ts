import { SATS_PER_BTC } from './numbers'

const LOCALES: Record<string, string> = {
  CHF: 'de-CH',
  EUR: 'de-DE',
  USD: 'en-US',
  GBP: 'en-GB',
  CAD: 'en-CA',
  AUD: 'en-AU',
  JPY: 'ja-JP',
  SEK: 'sv-SE',
  NOK: 'nb-NO',
  DKK: 'da-DK',
  PLN: 'pl-PL',
  CZK: 'cs-CZ',
}

export function localeFor(currency: string): string {
  return LOCALES[currency.toUpperCase()] ?? 'en-US'
}

export interface Formatters {
  currency: string
  locale: string
  fiat: (v: number | null | undefined, opts?: { decimals?: number; signed?: boolean }) => string
  compactFiat: (v: number) => string
  number: (v: number, decimals?: number) => string
  btc: (sats: number, opts?: { signed?: boolean }) => string
  sats: (sats: number, opts?: { signed?: boolean }) => string
  percent: (v: number | null | undefined, opts?: { signed?: boolean }) => string
  date: (ts: number) => string
  dateTime: (ts: number) => string
  time: (ts: number) => string
  month: (yyyyMm: string) => string
  shortDate: (ts: number) => string
}

export const DASH = '—'

/** Builds locale-aware formatters for the detected display currency. */
export function createFormatters(currency: string): Formatters {
  const locale = localeFor(currency)
  const cache = new Map<string, Intl.NumberFormat>()
  const nf = (key: string, opts: Intl.NumberFormatOptions) => {
    let f = cache.get(key)
    if (!f) {
      f = new Intl.NumberFormat(locale, opts)
      cache.set(key, f)
    }
    return f
  }
  const sign = (signed: boolean | undefined): Intl.NumberFormatOptions['signDisplay'] =>
    signed ? 'exceptZero' : 'auto'

  return {
    currency,
    locale,
    fiat: (v, opts = {}) => {
      if (v == null || !Number.isFinite(v)) return DASH
      const d = opts.decimals ?? 2
      return nf(`fiat:${d}:${opts.signed}`, {
        style: 'currency',
        currency,
        minimumFractionDigits: d,
        maximumFractionDigits: d,
        signDisplay: sign(opts.signed),
      }).format(v)
    },
    compactFiat: (v) =>
      nf('compact', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v),
    number: (v, decimals = 0) =>
      nf(`num:${decimals}`, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v),
    btc: (sats, opts = {}) =>
      `${nf(`btc:${opts.signed}`, {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
        signDisplay: sign(opts.signed),
      }).format(sats / SATS_PER_BTC)} BTC`,
    sats: (sats, opts = {}) =>
      `${nf(`sats:${opts.signed}`, { maximumFractionDigits: 0, signDisplay: sign(opts.signed) }).format(sats)} sats`,
    percent: (v, opts = {}) => {
      if (v == null || !Number.isFinite(v)) return DASH
      return nf(`pct:${opts.signed}`, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: sign(opts.signed),
      }).format(v)
    },
    date: (ts) => new Date(ts).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    dateTime: (ts) =>
      new Date(ts).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    time: (ts) => new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    month: (yyyyMm) => {
      const [y, m] = yyyyMm.split('-').map(Number)
      return new Date(y, m - 1, 1).toLocaleDateString(locale, { year: '2-digit', month: 'short' })
    },
    shortDate: (ts) => new Date(ts).toLocaleDateString(locale, { year: '2-digit', month: 'short' }),
  }
}

/** Masks an address or transaction ID, e.g. `bc1q0s…ee59w`. */
export function maskIdentifier(value: string, head = 6, tail = 5): string {
  if (!value) return ''
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}
