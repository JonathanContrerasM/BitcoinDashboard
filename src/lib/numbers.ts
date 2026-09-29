export const SATS_PER_BTC = 100_000_000

/**
 * Normalizes a human-formatted decimal number into a canonical string like "-5488.11".
 *
 * Handles:
 * - Swiss apostrophe thousands separators: `5'488.11`, `5’488.11`
 * - Comma thousands separators: `5,488.11`, `1,234,567`
 * - European style: `5.488,11`, `5 488,11`
 * - Plain numbers, surrounding whitespace, currency codes/symbols and a leading sign.
 *
 * Returns null for anything that is not a number.
 */
export function normalizeDecimal(input: string | null | undefined): string | null {
  if (input == null) return null
  let s = String(input)
    .trim()
    .replace(/^[A-Za-z$€£¥₿]{1,4}\s*/, '')
    .replace(/\s*[A-Za-z$€£¥₿]{1,4}$/, '')
    .replace(/[\s\u00A0\u202F'’‘`´]/g, '')
  if (s === '') return null

  let sign = ''
  if (s.startsWith('-') || s.startsWith('−')) {
    sign = '-'
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // Only commas: grouping if it looks like 1,234 / 1,234,567, otherwise a decimal comma.
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else if (/^\d*,\d+$/.test(s)) s = s.replace(',', '.')
    else return null
  } else if (lastDot !== -1 && s.indexOf('.') !== lastDot) {
    // Several dots can only be thousands grouping: 1.234.567
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
    else return null
  }

  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null
  if (s.startsWith('.')) s = '0' + s
  if (s.endsWith('.')) s = s.slice(0, -1)
  return sign + s
}

/** Parses a fiat amount (see {@link normalizeDecimal}) into a number, or null. */
export function parseFiatNumber(input: string | null | undefined): number | null {
  const n = normalizeDecimal(input)
  if (n == null) return null
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

export type AmountUnit = 'satoshi' | 'btc'

export function normalizeUnit(unit: string | null | undefined): AmountUnit | null {
  const u = (unit ?? '').trim().toLowerCase()
  if (['satoshi', 'satoshis', 'sat', 'sats'].includes(u)) return 'satoshi'
  if (['btc', 'bitcoin', 'xbt'].includes(u)) return 'btc'
  return null
}

/**
 * Converts an amount string in the given unit to integer satoshis using string arithmetic
 * (no floating point). The sign is dropped: direction comes from the transaction type.
 * Returns null if the value is not a valid amount (e.g. fractional satoshis).
 */
export function toSats(amount: string | null | undefined, unit: AmountUnit): number | null {
  const n = normalizeDecimal(amount)
  if (n == null) return null
  const abs = n.replace(/^-/, '')
  const [intPart, fracPart = ''] = abs.split('.')

  if (unit === 'satoshi') {
    if (/[1-9]/.test(fracPart)) return null
    const v = Number(intPart)
    return Number.isSafeInteger(v) ? v : null
  }

  // BTC: at most 8 significant decimals (trailing zeros beyond that are fine).
  const trimmed = fracPart.replace(/0+$/, '')
  if (trimmed.length > 8) return null
  const sats = Number(intPart) * SATS_PER_BTC + Number(trimmed.padEnd(8, '0'))
  return Number.isSafeInteger(sats) ? sats : null
}

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC
}
