import type { Factors } from '../domain/types'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export { MONTHS, WEEKDAYS }

/** Neutral starting point — overwrite from PriceLabs' UI in the Config tab. */
export const DEFAULT_FACTORS: Factors = {
  base: 500,
  min: 350,
  max: 700,
  seasonal: Array(12).fill(1),
  dow: [1, 1, 1, 1, 1, 1.15, 1.15], // Sun..Sat, weekend uplift
  leadtime: [
    { maxDaysOut: 3, multiplier: 0.85 },
    { maxDaysOut: 7, multiplier: 0.92 },
    { maxDaysOut: 14, multiplier: 0.97 },
  ],
  occupancy: [
    { maxFill: 0.3, multiplier: 0.95 },
    { maxFill: 0.7, multiplier: 1.0 },
    { maxFill: 1.0, multiplier: 1.08 },
  ],
}
