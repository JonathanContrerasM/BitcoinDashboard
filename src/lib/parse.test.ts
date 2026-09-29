import { describe, expect, it } from 'vitest'
import { mergeImports, parseCsv } from './parse'

// Fixtures use obviously fake identifiers (no real addresses or transaction IDs).
const HEADER =
  'Time,Type,Amount,Unit,Fee,Fee Unit,Address,Transaction ID,Historical value,Historical value currency,Note'

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n')
}

describe('parseCsv', () => {
  it('parses a received row with Swiss formatting', () => {
    const r = parseCsv(
      csv("2025-08-11T14:16:20+01:00,received,2659237,satoshi,,,test-addr-1,test-tx-1,5'488.11,CHF,"),
      'a.csv',
    )
    expect(r.skipped).toBe(0)
    expect(r.transactions).toHaveLength(1)
    const tx = r.transactions[0]
    expect(tx.type).toBe('received')
    expect(tx.amountSats).toBe(2659237)
    expect(tx.feeSats).toBe(0)
    expect(tx.historicalValue).toBeCloseTo(5488.11)
    expect(tx.currency).toBe('CHF')
    expect(tx.timestamp).toBe(Date.parse('2025-08-11T13:16:20Z'))
  })

  it('handles quoted fields containing commas', () => {
    const r = parseCsv(
      csv('2025-01-01T10:00:00+01:00,received,0.01,BTC,,,test-addr-2,test-tx-2,"1,234.50",CHF,"DCA, January"'),
      'a.csv',
    )
    expect(r.transactions[0].historicalValue).toBeCloseTo(1234.5)
    expect(r.transactions[0].amountSats).toBe(1_000_000)
    expect(r.transactions[0].note).toBe('DCA, January')
  })

  it('parses sent rows with fees in a different unit', () => {
    const r = parseCsv(
      csv('2025-03-01T10:00:00Z,sent,0.005,BTC,1200,satoshi,test-addr-3,test-tx-3,400.00,CHF,'),
      'a.csv',
    )
    expect(r.transactions[0]).toMatchObject({ type: 'sent', amountSats: 500_000, feeSats: 1200 })
  })

  it('defaults fee unit to the amount unit', () => {
    const r = parseCsv(csv('2025-03-01T10:00:00Z,sent,500000,satoshi,850,,x,test-tx-4,400,CHF,'), 'a.csv')
    expect(r.transactions[0].feeSats).toBe(850)
  })

  it('warns and skips unknown types without crashing', () => {
    const r = parseCsv(
      csv(
        '2025-03-01T10:00:00Z,staking,1000,satoshi,,,x,test-tx-5,1,CHF,',
        '2025-03-02T10:00:00Z,received,1000,satoshi,,,x,test-tx-6,1,CHF,',
      ),
      'a.csv',
    )
    expect(r.transactions).toHaveLength(1)
    expect(r.skipped).toBe(1)
    expect(r.warnings.some((w) => w.message.includes('Unknown transaction type "staking"') && w.line === 2)).toBe(true)
  })

  it('skips invalid dates and amounts', () => {
    const r = parseCsv(
      csv(
        'not-a-date,received,1000,satoshi,,,x,t1,1,CHF,',
        '2025-03-02T10:00:00Z,received,abc,satoshi,,,x,t2,1,CHF,',
        '2025-03-02T10:00:00Z,received,1000,doge,,,x,t3,1,CHF,',
      ),
      'a.csv',
    )
    expect(r.transactions).toHaveLength(0)
    expect(r.skipped).toBe(3)
  })

  it('reports a missing required column as an error', () => {
    const r = parseCsv('foo,bar\n1,2', 'bad.csv')
    expect(r.transactions).toHaveLength(0)
    expect(r.warnings[0].level).toBe('error')
  })

  it('tolerates a BOM and header whitespace/case', () => {
    const r = parseCsv('\uFEFF time , TYPE ,amount,unit\n2025-01-01T00:00:00Z,received,5,satoshi', 'a.csv')
    expect(r.transactions).toHaveLength(1)
  })
})

describe('mergeImports', () => {
  const a = parseCsv(
    csv(
      '2025-01-01T00:00:00Z,received,1000,satoshi,,,x,dup-tx,10,CHF,',
      '2025-02-01T00:00:00Z,received,2000,satoshi,,,x,tx-b,20,CHF,',
    ),
    'a.csv',
  )
  const b = parseCsv(
    csv(
      '2025-01-01T00:00:00Z,received,1000,satoshi,,,x,dup-tx,10,CHF,',
      '2024-12-01T00:00:00Z,received,3000,satoshi,,,x,tx-c,30,CHF,',
    ),
    'b.csv',
  )

  it('deduplicates by transaction ID across files and sorts by time', () => {
    const r = mergeImports([], [a, b])
    expect(r.ok).toBe(true)
    expect(r.currency).toBe('CHF')
    expect(r.transactions.map((t) => t.txid)).toEqual(['tx-c', 'dup-tx', 'tx-b'])
    expect(r.summary.duplicates).toBe(1)
    expect(r.summary.imported).toBe(3)
  })

  it('deduplicates against previously imported data', () => {
    const first = mergeImports([], [a])
    const second = mergeImports(first.transactions, [a])
    expect(second.transactions).toHaveLength(2)
    expect(second.summary.duplicates).toBe(2)
  })

  it('rejects mixed currencies with a clear error', () => {
    const eur = parseCsv(csv('2025-01-05T00:00:00Z,received,1000,satoshi,,,x,tx-eur,10,EUR,'), 'eur.csv')
    const r = mergeImports([], [a, eur])
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/CHF, EUR/)
    expect(r.transactions).toEqual([])
  })
})

describe('sample-data.csv', () => {
  it('parses the bundled fake sample file cleanly', async () => {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(new URL('../../sample-data.csv', import.meta.url), 'utf8')
    const r = mergeImports([], [parseCsv(text, 'sample-data.csv')])
    expect(r.ok).toBe(true)
    expect(r.currency).toBe('CHF')
    expect(r.summary.skipped).toBe(0)
    expect(r.summary.warnings).toEqual([])
    expect(r.transactions).toHaveLength(15)
    expect(r.transactions.filter((t) => t.type === 'sent').every((t) => t.feeSats > 0)).toBe(true)
  })
})
