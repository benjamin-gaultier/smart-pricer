import type { StayRow } from './parseStayDates'

export type MonthlyStat = {
  month: number // 0 = Jan
  occupancy: number // booked / (booked + vacant), 0..1
  adr: number // revenue / booked (0 if never booked)
  bookedNights: number
}

export type ListingStats = {
  listingId: string
  isWhole: boolean
  adr: number // overall ADR across all data
  peakNightly: number // max single-night revenue (identifies the whole place)
  byMonth: MonthlyStat[] // length 12
}

const monthlyFrom = (rows: StayRow[]): MonthlyStat[] => {
  const acc = Array.from({ length: 12 }, () => ({ booked: 0, vacant: 0, rev: 0 }))
  for (const r of rows) {
    const m = Number(r.date.slice(5, 7)) - 1
    acc[m].booked += r.booked
    acc[m].vacant += r.vacant
    acc[m].rev += r.revenue
  }
  return acc.map((a, month) => {
    const bookable = a.booked + a.vacant
    return {
      month,
      occupancy: bookable > 0 ? a.booked / bookable : 0,
      adr: a.booked > 0 ? a.rev / a.booked : 0,
      bookedNights: a.booked,
    }
  })
}

/**
 * Group the occupancy panel by listing and compute monthly occupancy/ADR.
 * The whole-apartment listing is identified by its peak nightly revenue (its top
 * rate is ~2× the priciest room), which is far more robust than mean ADR — the
 * whole place's average is dragged down by cheap bookings. This avoids hardcoding
 * the private listing ids in source.
 */
export function listingStats(rows: StayRow[]): ListingStats[] {
  const byListing = new Map<string, StayRow[]>()
  for (const r of rows) {
    const arr = byListing.get(r.listingId)
    if (arr) arr.push(r)
    else byListing.set(r.listingId, [r])
  }

  const stats: ListingStats[] = [...byListing.entries()].map(([listingId, rs]) => {
    const booked = rs.reduce((a, r) => a + r.booked, 0)
    const rev = rs.reduce((a, r) => a + r.revenue, 0)
    return {
      listingId,
      isWhole: false,
      adr: booked > 0 ? rev / booked : 0,
      peakNightly: rs.reduce((m, r) => Math.max(m, r.revenue), 0),
      byMonth: monthlyFrom(rs),
    }
  })

  const wholeId = stats.reduce(
    (best, s) => (s.peakNightly > best.peakNightly ? s : best),
    stats[0],
  )
  for (const s of stats) s.isWhole = s.listingId === wholeId?.listingId

  return stats
}

export type ReserveRow = {
  month: number
  /** Expected per-night revenue if rooms are sold instead of the whole place. */
  roomsReserve: number
  /** Historical ADR the whole place actually fetched that month (0 if idle). */
  wholeAdr: number
  /** wholeAdr − roomsReserve; positive = whole booking beat the rooms. */
  edge: number
}

/**
 * The core allocation signal: for each month, the whole-apartment's realized ADR
 * vs the expected room revenue for the same night (Σ room occupancy × room ADR).
 * Positive edge = keeping the place whole paid off; negative = selling rooms
 * would have earned more (a bad whole-booking trade).
 */
export function reserveSignal(stats: ListingStats[]): ReserveRow[] {
  const whole = stats.find((s) => s.isWhole)
  const rooms = stats.filter((s) => !s.isWhole)
  return Array.from({ length: 12 }, (_, month) => {
    const roomsReserve = rooms.reduce((a, r) => {
      const m = r.byMonth[month]
      return a + m.occupancy * m.adr
    }, 0)
    const wholeAdr = whole?.byMonth[month].adr ?? 0
    return { month, roomsReserve, wholeAdr, edge: wholeAdr - roomsReserve }
  })
}
