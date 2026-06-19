import Papa from 'papaparse'

/** One night of the PriceLabs "Stay Dates" occupancy panel, per listing. */
export type StayRow = {
  listingId: string
  date: string // ISO yyyy-mm-dd
  booked: number // 1 if the night was booked, else 0
  blocked: number // 1 if blocked (incl. inventory-link blocking), else 0
  vacant: number // 1 if bookable and unsold
  revenue: number // nightly revenue (>0 iff booked)
}

const num = (v: string | undefined): number =>
  v == null || v.trim() === '' ? 0 : Number(v) || 0

/**
 * Parse the PriceLabs "Stay Dates" export (daily occupancy per listing,
 * across all listings and years). Rows without a listing id or date are dropped.
 */
export function parseStayDates(csvText: string): StayRow[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows: StayRow[] = []
  for (const r of data) {
    const listingId = r['Listing ID']?.trim()
    const date = r['Date']?.slice(0, 10)
    if (!listingId || !date) continue
    rows.push({
      listingId,
      date,
      booked: num(r['No. Booked']),
      blocked: num(r['No. Blocked']),
      vacant: num(r['Vacant Units']),
      revenue: num(r['nightly_revenue']),
    })
  }
  return rows
}
