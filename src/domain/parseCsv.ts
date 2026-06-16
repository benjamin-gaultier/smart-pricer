import Papa from 'papaparse'
import type { DayRow } from './types'

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse a PriceLabs CSV export into DayRow[].
 * Only rows with a valid Date and Final Price are kept.
 */
export function parseCsv(csvText: string): DayRow[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows: DayRow[] = []
  for (const r of data) {
    const date = r['Date']?.trim()
    const finalPrice = num(r['Final Price'])
    if (!date || finalPrice == null) continue
    rows.push({
      date,
      finalPrice,
      defaultPrice: num(r['Price with Default Customization']),
      available: r['Available']?.trim().toLowerCase() === 'true',
      minStay: num(r['Min Stay']) ?? 1,
      adrLastYear: num(r['ADR Last Year']),
    })
  }
  return rows
}
