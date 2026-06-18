import type { DayRow, Factors, PriceResult, PriceStep } from './types'

const MS_PER_DAY = 86_400_000
const OCCUPANCY_WINDOW = 7 // days each side, for local fill rate

/** Parse 'yyyy-mm-dd' as a UTC date (no timezone drift). */
const parseDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const daysBetween = (from: string, to: string): number =>
  Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / MS_PER_DAY)

/** First curve entry whose threshold covers `value` (entries scanned in order). */
const pickLeadtime = (curve: Factors['leadtime'], daysOut: number): number => {
  for (const c of curve) if (daysOut <= c.maxDaysOut) return c.multiplier
  return 1
}

const pickOccupancy = (curve: Factors['occupancy'], fill: number): number => {
  for (const c of curve) if (fill <= c.maxFill) return c.multiplier
  return 1
}

/** First event whose date range covers `date` (ISO strings compare correctly). */
const pickEvent = (
  events: Factors['events'],
  date: string,
): Factors['events'][number] | null => {
  for (const e of events) if (date >= e.from && date <= e.to) return e
  return null
}

/** Fraction of unavailable (booked/blocked) days in a window around `date`. */
export function localFill(date: string, calendar: DayRow[]): number {
  const center = parseDate(date).getTime()
  let total = 0
  let booked = 0
  for (const row of calendar) {
    const diff = Math.abs(parseDate(row.date).getTime() - center) / MS_PER_DAY
    if (diff <= OCCUPANCY_WINDOW) {
      total++
      if (!row.available) booked++
    }
  }
  return total === 0 ? 0 : booked / total
}

/**
 * Reproduce PriceLabs' price as a multiplicative stack on the base price.
 * `snapshotDate` is the date the calendar was exported (drives lead-time).
 */
export function computePrice(
  date: string,
  factors: Factors,
  calendar: DayRow[],
  snapshotDate: string,
): PriceResult {
  const d = parseDate(date)
  const month = d.getUTCMonth()
  const weekday = d.getUTCDay()
  const daysOut = daysBetween(snapshotDate, date)
  const fill = localFill(date, calendar)

  const event = pickEvent(factors.events ?? [], date)

  const factorList: { label: string; multiplier: number }[] = [
    { label: 'Seasonal', multiplier: factors.seasonal[month] ?? 1 },
    { label: 'Day of week', multiplier: factors.dow[weekday] ?? 1 },
    { label: 'Last-minute', multiplier: pickLeadtime(factors.leadtime, daysOut) },
    { label: 'Occupancy', multiplier: pickOccupancy(factors.occupancy, fill) },
    {
      label: event ? `Event: ${event.label}` : 'Event',
      multiplier: event?.multiplier ?? 1,
    },
  ]

  let running = factors.base
  const steps: PriceStep[] = []
  for (const f of factorList) {
    running *= f.multiplier
    steps.push({ label: f.label, multiplier: f.multiplier, runningPrice: running })
  }

  const raw = running
  const clamped = Math.min(factors.max, Math.max(factors.min, raw))
  const price = Math.round(clamped)

  return {
    date,
    base: factors.base,
    steps,
    clampedFrom: clamped !== raw ? Math.round(raw) : null,
    price,
  }
}
