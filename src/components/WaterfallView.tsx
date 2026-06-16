import { computePrice } from '../domain/computePrice'
import type { DayRow, Factors } from '../domain/types'

type Props = {
  selectedDate: string
  calendar: DayRow[]
  factors: Factors
  snapshotDate: string
  onSelectDate: (date: string) => void
}

export function WaterfallView({
  selectedDate,
  calendar,
  factors,
  snapshotDate,
  onSelectDate,
}: Props) {
  const row = calendar.find((r) => r.date === selectedDate)
  const result = computePrice(selectedDate, factors, calendar, snapshotDate)
  const theirs = row?.finalPrice ?? null

  // bars: base, then running price after each step, then final
  const bars = [
    { label: 'Base', value: result.base, mult: null as number | null },
    ...result.steps.map((s) => ({
      label: s.label,
      value: s.runningPrice,
      mult: s.multiplier,
    })),
  ]
  const maxVal = Math.max(
    ...bars.map((b) => b.value),
    result.price,
    theirs ?? 0,
    factors.max,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Date</label>
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={selectedDate}
          onChange={(e) => onSelectDate(e.target.value)}
        >
          {calendar.map((r) => (
            <option key={r.date} value={r.date}>
              {r.date} {r.available ? '' : '(blocked)'}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <div className="w-28 text-right text-xs text-gray-500">
                {b.label}
                {b.mult != null && (
                  <span className="ml-1 text-gray-400">×{b.mult}</span>
                )}
              </div>
              <div className="relative h-6 flex-1 rounded bg-gray-100">
                <div
                  className="h-6 rounded bg-blue-500"
                  style={{ width: `${(b.value / maxVal) * 100}%` }}
                />
              </div>
              <div className="w-16 text-right text-sm tabular-nums">
                {b.value.toFixed(0)} €
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 text-sm">
          <div>
            <span className="text-gray-500">Our price: </span>
            <span className="font-semibold">{result.price} €</span>
            {result.clampedFrom != null && (
              <span className="ml-2 text-amber-600">
                (clamped from {result.clampedFrom} €)
              </span>
            )}
          </div>
          {theirs != null && (
            <div>
              <span className="text-gray-500">PriceLabs: </span>
              <span className="font-semibold">{theirs} €</span>
              <span
                className={`ml-2 ${Math.abs(result.price - theirs) / theirs <= 0.05 ? 'text-green-600' : 'text-red-600'}`}
              >
                {result.price - theirs >= 0 ? '+' : ''}
                {result.price - theirs} €
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
