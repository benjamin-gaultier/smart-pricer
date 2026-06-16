import { computePrice } from './computePrice'
import type { DayRow, Factors } from './types'

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

export function compareAll(
  calendar: DayRow[],
  factors: Factors,
  snapshotDate: string,
): Comparison[] {
  return calendar.map((row) => {
    const ours = computePrice(row.date, factors, calendar, snapshotDate).price
    const delta = ours - row.finalPrice
    return {
      date: row.date,
      ours,
      theirs: row.finalPrice,
      delta,
      pctErr: row.finalPrice === 0 ? 0 : delta / row.finalPrice,
      available: row.available,
    }
  })
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
