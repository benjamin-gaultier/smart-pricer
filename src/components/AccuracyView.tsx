import { useState } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Comparison } from '../domain/accuracy'
import { summarize } from '../domain/accuracy'

type Props = { comparisons: Comparison[] }

const stat = 'rounded-lg border border-gray-200 bg-white p-4'

export function AccuracyView({ comparisons }: Props) {
  const [threshold, setThreshold] = useState(0.05)
  const s = summarize(comparisons, threshold)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={stat}>
          <div className="text-xs text-gray-500">Dates compared</div>
          <div className="text-2xl font-semibold">{s.count}</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-gray-500">Mean abs error</div>
          <div className="text-2xl font-semibold">{s.mae.toFixed(0)} €</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-gray-500">Mean abs % error</div>
          <div className="text-2xl font-semibold">{(s.mape * 100).toFixed(1)}%</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-gray-500">
            Within {(threshold * 100).toFixed(0)}%
          </div>
          <div className="text-2xl font-semibold">
            {(s.pctWithin * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <label className="block text-sm text-gray-600">
        Accuracy threshold: {(threshold * 100).toFixed(0)}%
        <input
          type="range"
          min={0.01}
          max={0.2}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="ml-3 w-64 align-middle"
        />
      </label>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Ours vs PriceLabs</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={comparisons} margin={{ left: 8, right: 8 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="theirs"
              name="PriceLabs"
              stroke="#111827"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="ours"
              name="Ours"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
