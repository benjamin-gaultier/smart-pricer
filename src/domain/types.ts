/** One day of the PriceLabs export for the Entire-place listing. */
export type DayRow = {
  date: string // ISO yyyy-mm-dd
  finalPrice: number // PriceLabs' pushed price — our reproduction target
  available: boolean // false = booked/blocked
  minStay: number
  adrLastYear: number | null // last-year average daily rate, if present
}

/** Multiplicative pricing factors, copied from the PriceLabs UI. */
export type Factors = {
  base: number
  min: number
  max: number
  /** Multiplier per calendar month, index 0 = January. */
  seasonal: number[] // length 12
  /** Multiplier per weekday, index 0 = Sunday. */
  dow: number[] // length 7
  /** Last-minute curve: applied when daysOut <= maxDaysOut (first match wins). */
  leadtime: { maxDaysOut: number; multiplier: number }[]
  /** Occupancy curve: applied when local fill rate <= maxFill (first match wins). */
  occupancy: { maxFill: number; multiplier: number }[]
}

/** One step in the price breakdown, for the waterfall view. */
export type PriceStep = {
  label: string
  multiplier: number
  runningPrice: number
}

export type PriceResult = {
  date: string
  base: number
  steps: PriceStep[]
  clampedFrom: number | null // raw price before clamp, if clamping changed it
  price: number
}
