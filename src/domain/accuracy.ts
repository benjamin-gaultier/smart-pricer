import { computePrice } from './computePrice'
import type { DayRow, Factors, Target } from './types'

export type Comparison = {
  date: string
  ours: number
  theirs: number
  delta: number // ours - theirs
  pctErr: number // signed, fraction of theirs
  available: boolean
}

export type Summary = {
  count: number
  mae: number // mean absolute error, EUR
  mape: number // mean absolute % error
  pctWithin: number // fraction within `threshold`
  threshold: number
}

const targetPrice = (row: DayRow, target: Target): number =>
  target === 'default' ? (row.defaultPrice ?? row.finalPrice) : row.finalPrice

export function compareAll(
  calendar: DayRow[],
  factors: Factors,
  snapshotDate: string,
  target: Target = 'final',
): Comparison[] {
  return calendar.map((row) => {
    const ours = computePrice(row.date, factors, calendar, snapshotDate).price
    const theirs = targetPrice(row, target)
    const delta = ours - theirs
    return {
      date: row.date,
      ours,
      theirs,
      delta,
      pctErr: theirs === 0 ? 0 : delta / theirs,
      available: row.available,
    }
  })
}

/**
 * How much the host's manual overrides move Final away from PriceLabs' algorithmic
 * (Default) price — the irreducible floor when targeting Final.
 */
export function manualOverrideStats(calendar: DayRow[]): {
  pctOfDates: number
  meanAbsPct: number
} {
  let n = 0
  let differ = 0
  let absPct = 0
  for (const row of calendar) {
    if (row.defaultPrice == null || row.defaultPrice === 0) continue
    n++
    if (row.finalPrice !== row.defaultPrice) differ++
    absPct += Math.abs(row.finalPrice - row.defaultPrice) / row.defaultPrice
  }
  return n === 0
    ? { pctOfDates: 0, meanAbsPct: 0 }
    : { pctOfDates: differ / n, meanAbsPct: absPct / n }
}

export function summarize(comparisons: Comparison[], threshold = 0.05): Summary {
  const n = comparisons.length
  if (n === 0) return { count: 0, mae: 0, mape: 0, pctWithin: 0, threshold }
  let absErr = 0
  let absPct = 0
  let within = 0
  for (const c of comparisons) {
    absErr += Math.abs(c.delta)
    absPct += Math.abs(c.pctErr)
    if (Math.abs(c.pctErr) <= threshold) within++
  }
  return {
    count: n,
    mae: absErr / n,
    mape: absPct / n,
    pctWithin: within / n,
    threshold,
  }
}
