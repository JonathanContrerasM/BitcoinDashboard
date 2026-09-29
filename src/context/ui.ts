import { createContext, useContext } from 'react'
import type { PortfolioStats } from '../lib/calculations'
import type { Formatters } from '../lib/format'
import type { Lot, PortfolioMetrics, Transaction } from '../types'

export type Theme = 'dark' | 'light'

export interface ChartColors {
  accent: string
  accentSoft: string
  muted: string
  grid: string
  axis: string
  gain: string
  loss: string
  network: string
  tooltipBg: string
  tooltipBorder: string
  text: string
}

export const CHART_COLORS: Record<Theme, ChartColors> = {
  dark: {
    accent: '#f7931a',
    accentSoft: 'rgba(247,147,26,0.18)',
    muted: '#94a3b8',
    grid: '#1e293b',
    axis: '#64748b',
    gain: '#10b981',
    loss: '#f43f5e',
    network: '#6366f1',
    tooltipBg: '#0f172a',
    tooltipBorder: '#334155',
    text: '#e2e8f0',
  },
  light: {
    accent: '#ea7c07',
    accentSoft: 'rgba(234,124,7,0.15)',
    muted: '#64748b',
    grid: '#e2e8f0',
    axis: '#64748b',
    gain: '#059669',
    loss: '#e11d48',
    network: '#4f46e5',
    tooltipBg: '#ffffff',
    tooltipBorder: '#cbd5e1',
    text: '#0f172a',
  },
}

/** Secondary USD view of the portfolio (null when the import currency is USD or no rate is known). */
export interface UsdView {
  fmt: Formatters
  /** Transactions with historical values converted at each day's rate. */
  txs: Transaction[]
  metrics: PortfolioMetrics
  lotsByKey: Map<string, Lot>
  stats: PortfolioStats
  /** costScale for the USD view (amount paid ÷ market value, in USD). */
  scale: number
  /** USD per 1 unit of local currency at time t (historical). */
  rateAt: (t: number) => number | null
  /** USD per 1 unit of local currency now. */
  rateNow: number
  priceNow: number | null
  change24h: number | null
  /** Transactions older than the available FX data (converted at the earliest known rate). */
  approximated: number
}

export interface UiState {
  privacy: boolean
  revealIds: boolean
  setRevealIds: (v: boolean) => void
  theme: Theme
  colors: ChartColors
  fmt: Formatters
  usd: UsdView | null
}

export const UiContext = createContext<UiState | null>(null)

export function useUi(): UiState {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used inside UiContext')
  return ctx
}

/** Placeholder shown instead of sensitive values in chart axes and tooltips. */
export const HIDDEN = '•••••'
