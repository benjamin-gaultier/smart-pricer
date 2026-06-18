import type { DayRow, Factors, Target } from './types'

const parseDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const geomean = (xs: number[]): number => {
  if (xs.length === 0) return 1
  const sumLog = xs.reduce((a, x) => a + Math.log(x), 0)
  return Math.exp(sumLog / xs.length)
}

/**
 * Seed base / seasonal / day-of-week from the target prices by fitting the
 * multiplicative model  price ≈ base × seasonal[month] × dow[weekday]  via a
 * few rounds of alternating geometric means (seasonal & dow normalized to
 * geomean 1, so `base` carries the overall level).
 *
 * The short-horizon (≤14 days) lead-time curve IS fitted: a last-minute discount
 * is a sharp local dip against the smooth seasonal curve, identifiable from one
 * snapshot (and confirmed across snapshots — see DECISIONS #19). The far range
 * (>14 days) shows no clean signal, so it stays neutral. Occupancy is still
 * neutralized. min/max are set to the observed price range so they don't clip.
 */
const LEADTIME_CUTOFFS = [1, 3, 7, 14] as const

export function fitFactors(
  calendar: DayRow[],
  target: Target,
  existing: Factors,
): Factors {
  const rows = calendar
    .map((r) => ({
      date: r.date,
      price: target === 'default' ? (r.defaultPrice ?? r.finalPrice) : r.finalPrice,
      month: parseDate(r.date).getUTCMonth(),
      weekday: parseDate(r.date).getUTCDay(),
    }))
    .filter((r) => Number.isFinite(r.price) && r.price > 0)

  if (rows.length === 0) return existing

  const prices = rows.map((r) => r.price)
  let base = geomean(prices)
  const seasonal = Array(12).fill(1)
  const dow = Array(7).fill(1)

  for (let iter = 0; iter < 5; iter++) {
    // seasonal given base & dow
    for (let m = 0; m < 12; m++) {
      const rs = rows.filter((r) => r.month === m)
      if (rs.length) seasonal[m] = geomean(rs.map((r) => r.price / (base * dow[r.weekday])))
    }
    const sg = geomean(seasonal)
    for (let m = 0; m < 12; m++) seasonal[m] /= sg
    base *= sg

    // dow given base & seasonal
    for (let w = 0; w < 7; w++) {
      const rs = rows.filter((r) => r.weekday === w)
      if (rs.length) dow[w] = geomean(rs.map((r) => r.price / (base * seasonal[r.month])))
    }
    const dg = geomean(dow)
    for (let w = 0; w < 7; w++) dow[w] /= dg
    base *= dg
  }

  const round2 = (x: number) => Math.round(x * 100) / 100

  // Lead-time: deseasonalize each row, bucket the leftover ratio by days-out
  // (from the earliest/snapshot date) into the short-horizon cutoffs.
  const snapshot = rows.reduce((min, r) => (r.date < min ? r.date : min), rows[0].date)
  const dayMs = 86_400_000
  const daysOut = (d: string) =>
    Math.round((parseDate(d).getTime() - parseDate(snapshot).getTime()) / dayMs)
  const leadtime: Factors['leadtime'] = []
  let prevCutoff = -1
  for (const cutoff of LEADTIME_CUTOFFS) {
    const ratios = rows
      .filter((r) => {
        const o = daysOut(r.date)
        return o > prevCutoff && o <= cutoff
      })
      .map((r) => r.price / (base * seasonal[r.month] * dow[r.weekday]))
    if (ratios.length >= 2) {
      const m = Math.min(1.5, Math.max(0.5, geomean(ratios)))
      leadtime.push({ maxDaysOut: cutoff, multiplier: round2(m) })
    }
    prevCutoff = cutoff
  }

  return {
    ...existing,
    base: Math.round(base),
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
    seasonal: seasonal.map(round2),
    dow: dow.map(round2),
    leadtime,
    occupancy: [], // neutralized — single snapshot can't isolate it from fill noise
  }
}
