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
 * Lead-time and occupancy are neutralized: a single snapshot can't separate
 * lead-time from seasonality, so we don't pretend to fit them here. min/max are
 * set to the observed price range so they don't clip the seeded prices.
 */
export function fitFactors(
  calendar: DayRow[],
  target: Target,
  existing: Factors,
): Factors {
  const rows = calendar
    .map((r) => ({
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

  return {
    ...existing,
    base: Math.round(base),
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
    seasonal: seasonal.map(round2),
    dow: dow.map(round2),
    leadtime: [], // neutralized — see docstring
    occupancy: [],
  }
}
