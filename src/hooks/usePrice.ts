import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentPrice, fetchPriceHistory, PriceApiError } from '../lib/priceApi'
import type { CurrentPrice, PricePoint } from '../types'

const REFRESH_MS = 60_000

export interface PriceState {
  data: CurrentPrice | null
  loading: boolean
  error: string | null
  lastFetched: number | null
  refresh: () => void
}

/** Live BTC price in `currency`, refreshed every 60s. Disabled when `enabled` is false (offline mode). */
export function useCurrentPrice(currency: string | null, enabled: boolean): PriceState {
  const [data, setData] = useState<CurrentPrice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const force = useRef(false)

  useEffect(() => {
    if (!currency || !enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const load = async () => {
      setLoading(true)
      let delay = REFRESH_MS
      try {
        const p = await fetchCurrentPrice(currency, force.current)
        if (cancelled) return
        setData(p)
        setError(null)
        setLastFetched(Date.now())
      } catch (e) {
        if (cancelled) return
        const err = e instanceof PriceApiError ? e : new PriceApiError(String(e))
        setError(err.message)
        if (err.retryAfterMs) delay = Math.max(err.retryAfterMs, 15_000)
      } finally {
        force.current = false
        if (!cancelled) {
          setLoading(false)
          timer = setTimeout(load, delay)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [currency, enabled, tick])

  const refresh = useCallback(() => {
    force.current = true
    setTick((t) => t + 1)
  }, [])

  const hasPrice = currency != null && enabled
  return {
    data: hasPrice ? data : null,
    loading: hasPrice && loading,
    error: hasPrice ? error : null,
    lastFetched: hasPrice ? lastFetched : null,
    refresh,
  }
}

export interface HistoryState {
  prices: PricePoint[]
  loading: boolean
  error: string | null
}

/** Full daily BTC price history in `currency`. Fetched once per currency, cached in memory. */
export function usePriceHistory(currency: string | null, enabled: boolean): HistoryState {
  const [state, setState] = useState<HistoryState & { key: string | null }>({
    key: null,
    prices: [],
    loading: false,
    error: null,
  })
  const key = currency && enabled ? currency : null

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const load = async () => {
      setState((s) => ({ ...s, key, loading: true, error: null }))
      try {
        const prices = await fetchPriceHistory(key)
        if (!cancelled) setState({ key, prices, loading: false, error: null })
      } catch (e) {
        if (!cancelled) {
          setState({
            key,
            prices: [],
            loading: false,
            error: e instanceof Error ? e.message : 'Could not load price history.',
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key || state.key !== key) return { prices: [], loading: !!key, error: null }
  return { prices: state.prices, loading: state.loading, error: state.error }
}
