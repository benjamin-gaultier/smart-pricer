import { useState } from 'react'
import { parseCsv } from './domain/parseCsv'
import { compareAll, manualOverrideStats } from './domain/accuracy'
import type { DayRow, Target } from './domain/types'
import { useLocalStorage } from './lib/useLocalStorage'
import { DEFAULT_FACTORS } from './lib/defaultFactors'
import { ConfigPanel } from './components/ConfigPanel'
import { AccuracyView } from './components/AccuracyView'
import { HeatmapView } from './components/HeatmapView'
import { WaterfallView } from './components/WaterfallView'
import { ResidualView } from './components/ResidualView'

type Tab = 'heatmap' | 'waterfall' | 'accuracy' | 'residual' | 'config'
const TABS: { id: Tab; label: string }[] = [
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'residual', label: 'Residual' },
  { id: 'config', label: 'Config' },
]

export default function App() {
  const [factors, setFactors] = useLocalStorage('factors', DEFAULT_FACTORS)
  const [calendar, setCalendar] = useLocalStorage<DayRow[]>('calendar', [])
  const [tab, setTab] = useState<Tab>('heatmap')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [target, setTarget] = useState<Target>('final')

  const snapshotDate = calendar[0]?.date ?? ''
  const comparisons =
    calendar.length > 0
      ? compareAll(calendar, factors, snapshotDate, target)
      : []
  const overrides = manualOverrideStats(calendar)

  const onUpload = async (file: File) => {
    const rows = parseCsv(await file.text())
    setCalendar(rows)
    setSelectedDate(rows[0]?.date ?? null)
  }

  const openWaterfall = (date: string) => {
    setSelectedDate(date)
    setTab('waterfall')
  }

  const hasData = calendar.length > 0

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Airbnb Pricing Agent</h1>
            <p className="text-xs text-gray-500">
              Entire place · shadow mode vs PriceLabs
              {snapshotDate && ` · snapshot ${snapshotDate}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded border border-gray-300 text-sm">
              {(['final', 'default'] as Target[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  title={
                    t === 'final'
                      ? 'PriceLabs Final Price (algorithm + your manual overrides)'
                      : 'PriceLabs algorithmic price before your manual overrides'
                  }
                  className={`px-3 py-1.5 first:rounded-l last:rounded-r ${target === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {t === 'final' ? 'vs Final' : 'vs Default'}
                </button>
              ))}
            </div>
            <label className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
              Upload PriceLabs CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onUpload(f)
                }}
              />
            </label>
          </div>
        </div>
        <nav className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1 text-sm ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {!hasData && tab !== 'config' ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
            Upload a PriceLabs CSV export to begin.
          </div>
        ) : tab === 'config' ? (
          <ConfigPanel factors={factors} onChange={setFactors} />
        ) : tab === 'accuracy' ? (
          <AccuracyView
            comparisons={comparisons}
            target={target}
            overrides={overrides}
          />
        ) : tab === 'residual' ? (
          <ResidualView comparisons={comparisons} />
        ) : tab === 'heatmap' ? (
          <HeatmapView comparisons={comparisons} onSelect={openWaterfall} />
        ) : (
          selectedDate && (
            <WaterfallView
              selectedDate={selectedDate}
              calendar={calendar}
              factors={factors}
              snapshotDate={snapshotDate}
              onSelectDate={setSelectedDate}
            />
          )
        )}
      </main>
    </div>
  )
}
