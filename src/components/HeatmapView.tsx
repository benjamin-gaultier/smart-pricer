import { MONTHS } from '../lib/defaultFactors'
import type { Comparison } from '../domain/accuracy'

type Props = {
  comparisons: Comparison[]
  onSelect: (date: string) => void
}

/** Color a cell by absolute % error: green (match) → amber → red (off). */
function deltaColor(pctErr: number): string {
  const a = Math.abs(pctErr)
  if (a <= 0.03) return 'bg-green-500'
  if (a <= 0.07) return 'bg-lime-400'
  if (a <= 0.12) return 'bg-amber-400'
  if (a <= 0.2) return 'bg-orange-500'
  return 'bg-red-600'
}

export function HeatmapView({ comparisons, onSelect }: Props) {
  // group by "YYYY-MM"
  const byMonth = new Map<string, Comparison[]>()
  for (const c of comparisons) {
    const key = c.date.slice(0, 7)
    const arr = byMonth.get(key) ?? []
    arr.push(c)
    byMonth.set(key, arr)
  }

  return (
    <div className="space-y-4">
      <Legend />
      <div className="space-y-5">
        {[...byMonth.entries()].map(([key, days]) => {
          const [y, m] = key.split('-').map(Number)
          return (
            <div key={key}>
              <h3 className="mb-2 text-sm font-medium text-gray-600">
                {MONTHS[m - 1]} {y}
              </h3>
              <div className="flex flex-wrap gap-1">
                {days.map((c) => (
                  <button
                    key={c.date}
                    type="button"
                    title={`${c.date} — ours ${c.ours}€ / PriceLabs ${c.theirs}€ (${(c.pctErr * 100).toFixed(1)}%)${c.available ? '' : ' — booked/blocked'}`}
                    onClick={() => onSelect(c.date)}
                    className={`relative h-9 w-9 rounded text-[10px] font-medium text-white ${deltaColor(c.pctErr)} ${c.available ? '' : 'opacity-40'} hover:ring-2 hover:ring-gray-800`}
                  >
                    {Number(c.date.slice(8))}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Legend() {
  const items: [string, string][] = [
    ['≤3%', 'bg-green-500'],
    ['≤7%', 'bg-lime-400'],
    ['≤12%', 'bg-amber-400'],
    ['≤20%', 'bg-orange-500'],
    ['>20%', 'bg-red-600'],
  ]
  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      <span>Abs % error vs PriceLabs:</span>
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded ${cls}`} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-gray-400 opacity-40" />
        booked/blocked
      </span>
    </div>
  )
}
