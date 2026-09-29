import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPriceCache, fetchCurrentPrice, fetchPriceHistory, PriceApiError } from './priceApi'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const candle = (t: number, open: number, close: number) => [t, String(open), '0', '0', String(close), '0', '0', 1]
const ok = (key: string, candles: unknown[]) => json({ error: [], result: { [key]: candles, last: 123 } })

describe('priceApi (Kraken)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearPriceCache()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('derives price and rolling 24h change from 15m candles, sending only public parameters', async () => {
    fetchMock.mockResolvedValue(ok('XBTCHF', [candle(1000, 80_000, 80_500), candle(2000, 80_500, 84_000)]))
    const p = await fetchCurrentPrice('CHF')
    expect(p.price).toBe(84_000)
    expect(p.change24h).toBeCloseTo(0.05)
    expect(p.updatedAt).toBe(2_000_000)

    await fetchCurrentPrice('CHF')
    expect(fetchMock).toHaveBeenCalledTimes(1) // cached

    const [url, init] = fetchMock.mock.calls[0]
    const u = new URL(String(url))
    expect(u.origin + u.pathname).toBe('https://api.kraken.com/0/public/OHLC')
    expect([...u.searchParams.keys()].sort()).toEqual(['interval', 'pair', 'since'])
    expect(u.searchParams.get('pair')).toBe('XBTCHF')
    expect(u.searchParams.get('interval')).toBe('15')
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
  })

  it('handles the legacy XXBTZUSD result key', async () => {
    fetchMock.mockResolvedValue(ok('XXBTZUSD', [candle(1, 100, 110)]))
    expect((await fetchCurrentPrice('usd')).price).toBe(110)
  })

  it('maps daily candles to [ms, close] history', async () => {
    fetchMock.mockResolvedValue(ok('XBTEUR', [candle(86_400, 1, 5), candle(172_800, 5, 6)]))
    expect(await fetchPriceHistory('EUR')).toEqual([
      [86_400_000, 5],
      [172_800_000, 6],
    ])
    const u = new URL(String(fetchMock.mock.calls[0][0]))
    expect([...u.searchParams.keys()].sort()).toEqual(['interval', 'pair'])
    expect(u.searchParams.get('interval')).toBe('1440')
  })

  it('treats Kraken rate-limit errors as rate limits', async () => {
    fetchMock.mockResolvedValue(json({ error: ['EAPI:Rate limit exceeded'] }))
    const err = await fetchCurrentPrice('CHF').catch((e) => e)
    expect(err).toBeInstanceOf(PriceApiError)
    expect(err.isRateLimit).toBe(true)
    expect(err.retryAfterMs).toBe(60_000)
  })

  it('reports unknown pairs clearly', async () => {
    fetchMock.mockResolvedValue(json({ error: ['EQuery:Unknown asset pair'] }))
    await expect(fetchPriceHistory('CHF')).rejects.toThrow(/does not offer/)
  })

  it('rejects unsupported currencies without any request', async () => {
    await expect(fetchCurrentPrice('SEK')).rejects.toThrow(/no BTC\/SEK market/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports network / CORS failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchCurrentPrice('CHF')).rejects.toThrow(/Could not reach api.kraken.com/)
  })
})
