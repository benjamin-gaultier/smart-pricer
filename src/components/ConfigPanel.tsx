import type { Factors, Target } from '../domain/types'
import { MONTHS, WEEKDAYS, DEFAULT_FACTORS } from '../lib/defaultFactors'

type Props = {
  factors: Factors
  onChange: (f: Factors) => void
  onSuggest?: () => void
  suggestTarget: Target
}

const card = 'rounded-lg border border-gray-200 bg-white p-4'
const label = 'block text-xs font-medium text-gray-500 mb-1'
const input =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none'

export function ConfigPanel({ factors, onChange, onSuggest, suggestTarget }: Props) {
  const patch = (p: Partial<Factors>) => onChange({ ...factors, ...p })
  const setArr = (key: 'seasonal' | 'dow', i: number, v: number) => {
    const next = [...factors[key]]
    next[i] = v
    patch({ [key]: next } as Partial<Factors>)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Copy these from PriceLabs' UI. Multipliers stack on the base price.
        </p>
        <div className="flex gap-2">
          {onSuggest && (
            <button
              type="button"
              title={`Fit base/seasonal/day-of-week from the uploaded ${suggestTarget === 'default' ? 'Default' : 'Final'} prices (neutralizes lead-time & occupancy)`}
              className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
              onClick={() => {
                if (
                  confirm(
                    `Overwrite base, min/max, seasonal and day-of-week with a fit from the ${suggestTarget === 'default' ? 'Default' : 'Final'} prices? Lead-time and occupancy curves will be cleared.`,
                  )
                )
                  onSuggest()
              }}
            >
              Suggest from data
            </button>
          )}
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
            onClick={() => onChange(DEFAULT_FACTORS)}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 font-medium">Base &amp; guardrails</h3>
        <div className="grid grid-cols-3 gap-3">
          {(['base', 'min', 'max'] as const).map((k) => (
            <div key={k}>
              <span className={label}>{k} (€)</span>
              <input
                type="number"
                className={input}
                value={factors[k]}
                onChange={(e) => patch({ [k]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 font-medium">Seasonal (×, per month)</h3>
        <div className="grid grid-cols-6 gap-2">
          {MONTHS.map((m, i) => (
            <div key={m}>
              <span className={label}>{m}</span>
              <input
                type="number"
                step="0.01"
                className={input}
                value={factors.seasonal[i]}
                onChange={(e) => setArr('seasonal', i, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 font-medium">Day of week (×)</h3>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d, i) => (
            <div key={d}>
              <span className={label}>{d}</span>
              <input
                type="number"
                step="0.01"
                className={input}
                value={factors.dow[i]}
                onChange={(e) => setArr('dow', i, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <CurveEditor
        title="Last-minute (× when days-out ≤ threshold, first match wins)"
        thresholdLabel="≤ days out"
        rows={factors.leadtime.map((r) => ({
          threshold: r.maxDaysOut,
          multiplier: r.multiplier,
        }))}
        onChange={(rows) =>
          patch({
            leadtime: rows.map((r) => ({
              maxDaysOut: r.threshold,
              multiplier: r.multiplier,
            })),
          })
        }
      />

      <CurveEditor
        title="Occupancy (× when local fill ≤ threshold, first match wins)"
        thresholdLabel="≤ fill (0–1)"
        rows={factors.occupancy.map((r) => ({
          threshold: r.maxFill,
          multiplier: r.multiplier,
        }))}
        onChange={(rows) =>
          patch({
            occupancy: rows.map((r) => ({
              maxFill: r.threshold,
              multiplier: r.multiplier,
            })),
          })
        }
      />

      <EventEditor
        events={factors.events ?? []}
        onChange={(events) => patch({ events })}
      />
    </div>
  )
}

function EventEditor({
  events,
  onChange,
}: {
  events: Factors['events']
  onChange: (events: Factors['events']) => void
}) {
  const update = (i: number, p: Partial<Factors['events'][number]>) =>
    onChange(events.map((e, j) => (j === i ? { ...e, ...p } : e)))
  return (
    <div className={card}>
      <h3 className="mb-3 font-medium">
        Events (× over a date range — holidays, fairs; first match wins)
      </h3>
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <span className={label}>label</span>
              <input
                className={input}
                value={e.label}
                onChange={(ev) => update(i, { label: ev.target.value })}
              />
            </div>
            <div>
              <span className={label}>from</span>
              <input
                type="date"
                className={input}
                value={e.from}
                onChange={(ev) => update(i, { from: ev.target.value })}
              />
            </div>
            <div>
              <span className={label}>to</span>
              <input
                type="date"
                className={input}
                value={e.to}
                onChange={(ev) => update(i, { to: ev.target.value })}
              />
            </div>
            <div className="w-24">
              <span className={label}>multiplier ×</span>
              <input
                type="number"
                step="0.01"
                className={input}
                value={e.multiplier}
                onChange={(ev) => update(i, { multiplier: Number(ev.target.value) })}
              />
            </div>
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
              onClick={() => onChange(events.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          onClick={() =>
            onChange([
              ...events,
              { label: '', from: '', to: '', multiplier: 1.2 },
            ])
          }
        >
          + Add event
        </button>
      </div>
    </div>
  )
}

type CurveRow = { threshold: number; multiplier: number }

function CurveEditor({
  title,
  thresholdLabel,
  rows,
  onChange,
}: {
  title: string
  thresholdLabel: string
  rows: CurveRow[]
  onChange: (rows: CurveRow[]) => void
}) {
  const update = (i: number, patch: Partial<CurveRow>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  return (
    <div className={card}>
      <h3 className="mb-3 font-medium">{title}</h3>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <span className={label}>{thresholdLabel}</span>
              <input
                type="number"
                step="0.01"
                className={input}
                value={r.threshold}
                onChange={(e) => update(i, { threshold: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1">
              <span className={label}>multiplier ×</span>
              <input
                type="number"
                step="0.01"
                className={input}
                value={r.multiplier}
                onChange={(e) => update(i, { multiplier: Number(e.target.value) })}
              />
            </div>
            <button
              type="button"
              className="mt-4 rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          onClick={() => onChange([...rows, { threshold: 0, multiplier: 1 }])}
        >
          + Add row
        </button>
      </div>
    </div>
  )
}
