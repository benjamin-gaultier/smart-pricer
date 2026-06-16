import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Comparison } from '../domain/accuracy'
import { MONTHS, WEEKDAYS } from '../lib/defaultFactors'

type Props = { comparisons: Comparison[] }

type Bucket = { label: string; meanGapPct: number; count: number }

const weekday = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Mean signed gap (theirs - ours) / theirs, in %, grouped by a key. */
function bucketize(
  comparisons: Comparison[],
  keyOf: (c: Comparison) => number,
  labels: string[],
): Bucket[] {
  const sum = labels.map(() => 0)
  const n = labels.map(() => 0)
  for (const c of comparisons) {
    if (c.theirs === 0) continue
    const k = keyOf(c)
    sum[k] += -c.pctErr // pctErr = (ours-theirs)/theirs; flip to theirs-ours
    n[k] += 1
  }
  return labels.map((label, i) => ({
    label,
    meanGapPct: n[i] === 0 ? 0 : (sum[i] / n[i]) * 100,
    count: n[i],
  }))
}

const barColor = (v: number) =>
  v > 0 ? '#dc2626' /* we underprice */ : '#2563eb' /* we overprice */

function GapChart({ title, data }: { title: string; data: Bucket[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-1 font-medium">{title}</h3>
      <p className="mb-3 text-xs text-gray-500">
        Mean signed gap (PriceLabs − ours) as % of PriceLabs.
        <span className="ml-2 text-red-600">red = we underprice</span>,
        <span className="ml-1 text-blue-600">blue = we overprice</span>.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            labelFormatter={(l) => `${l}`}
          />
          <Bar dataKey="meanGapPct">
            {data.map((d) => (
              <Cell key={d.label} fill={barColor(d.meanGapPct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ResidualView({ comparisons }: Props) {
  const byMonth = bucketize(comparisons, (c) => Number(c.date.slice(5, 7)) - 1, MONTHS)
  const byWeekday = bucketize(comparisons, (c) => weekday(c.date), WEEKDAYS)

  // worst systematic biases, for a quick text callout
  const ranked = [...byMonth, ...byWeekday]
    .filter((b) => b.count > 0)
    .sort((a, b) => Math.abs(b.meanGapPct) - Math.abs(a.meanGapPct))
    .slice(0, 3)

  return (
    <div className="space-y-4">
      {ranked.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <span className="font-medium">Biggest systematic gaps: </span>
          {ranked
            .map(
              (b) =>
                `${b.label} ${b.meanGapPct > 0 ? '+' : ''}${b.meanGapPct.toFixed(1)}%`,
            )
            .join(' · ')}
          <p className="mt-1 text-xs text-gray-600">
            Large month gaps point to missing seasonal/event signal; large
            weekday gaps point to day-of-week tuning.
          </p>
        </div>
      )}
      <GapChart title="By month" data={byMonth} />
      <GapChart title="By weekday" data={byWeekday} />
    </div>
  )
}
