import { describe, expect, it } from 'vitest'
import { normalizeUnit, parseFiatNumber, toSats } from './numbers'

describe('parseFiatNumber', () => {
  it.each([
    ["5'488.11", 5488.11],
    ['5’488.11', 5488.11],
    ["1'234'567.89", 1234567.89],
    ['5,488.11', 5488.11],
    ['1,234,567', 1234567],
    ['5488.11', 5488.11],
    ['5488', 5488],
    ['5.488,11', 5488.11],
    ['5 488,11', 5488.11],
    ['12,5', 12.5],
    ['-42.10', -42.1],
    ['CHF 1\'000.00', 1000],
    ['.5', 0.5],
    ['  99.90  ', 99.9],
  ])('parses %s', (input, expected) => {
    expect(parseFiatNumber(input)).toBeCloseTo(expected, 10)
  })

  it.each(['', 'abc', '1.2.3,4,5', '12..3', null, undefined])('rejects %s', (input) => {
    expect(parseFiatNumber(input)).toBeNull()
  })
})

describe('toSats', () => {
  it('handles satoshi amounts', () => {
    expect(toSats('2659237', 'satoshi')).toBe(2659237)
    expect(toSats("2'659'237", 'satoshi')).toBe(2659237)
    expect(toSats('-1500', 'satoshi')).toBe(1500)
    expect(toSats('100.0', 'satoshi')).toBe(100)
  })

  it('rejects fractional satoshis', () => {
    expect(toSats('100.5', 'satoshi')).toBeNull()
  })

  it('converts BTC without floating point error', () => {
    expect(toSats('0.02659237', 'btc')).toBe(2659237)
    expect(toSats('1', 'btc')).toBe(100_000_000)
    expect(toSats('0.1', 'btc')).toBe(10_000_000)
    expect(toSats('0.3', 'btc')).toBe(30_000_000) // 0.1 + 0.2 style traps
    expect(toSats('21.00000001', 'btc')).toBe(2_100_000_001)
    expect(toSats('0,5', 'btc')).toBe(50_000_000)
    expect(toSats('0.123456780', 'btc')).toBe(12_345_678)
  })

  it('rejects more than 8 decimals of BTC', () => {
    expect(toSats('0.123456789', 'btc')).toBeNull()
  })
})

describe('normalizeUnit', () => {
  it('recognises units', () => {
    expect(normalizeUnit('satoshi')).toBe('satoshi')
    expect(normalizeUnit('SATS')).toBe('satoshi')
    expect(normalizeUnit('BTC')).toBe('btc')
    expect(normalizeUnit('eth')).toBeNull()
  })
})
