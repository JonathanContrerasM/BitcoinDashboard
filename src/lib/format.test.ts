import { describe, expect, it } from 'vitest'
import { createFormatters, maskIdentifier } from './format'

// Normalise the various apostrophe / space characters ICU may emit.
const norm = (s: string) => s.replace(/[’\u00A0\u202F]/g, (c) => (c === '’' ? "'" : ' '))

describe('formatters', () => {
  it('formats CHF with Swiss grouping', () => {
    const f = createFormatters('CHF')
    expect(norm(f.fiat(5488.11))).toBe("CHF 5'488.11")
  })

  it('formats BTC and sats', () => {
    const f = createFormatters('USD')
    expect(f.btc(2659237)).toBe('0.02659237 BTC')
    expect(f.sats(2659237)).toBe('2,659,237 sats')
  })

  it('formats signed percentages', () => {
    const f = createFormatters('USD')
    expect(f.percent(0.1234, { signed: true })).toBe('+12.34%')
    expect(f.percent(null)).toBe('—')
  })
})

describe('maskIdentifier', () => {
  it('masks long identifiers', () => {
    expect(maskIdentifier('bc1qabcdefghijklmnopqrstuvwxyz')).toBe('bc1qab…vwxyz')
  })
  it('leaves short values alone', () => {
    expect(maskIdentifier('short')).toBe('short')
  })
})
