import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ListingStats } from '../domain/listingStats'
import { reserveSignal } from '../domain/listingStats'
import { MONTHS } from '../lib/defaultFactors'

type Props = { stats: ListingStats[] }

const card = 'rounded-lg border border-gray-200 bg-white p-4'

/** Whole = "Entire place"; rooms labelled by descending ADR (no real names). */
function labelFor(s: ListingStats, rooms: ListingStats[]): string {
  if (s.isWhole) return 'Entire place'
  const rank = rooms.findIndex((r) => r.listingId === s.listingId)
  return `Room ${String.fromCharCode(65 + rank)}`
}

const barColor = (v: number) =>
  v >= 0 ? '#16a34a' /* whole beat rooms */ : '#dc2626' /* bad trade */

export function ListingsView({ stats }: Props) {
  const rooms = [...stats.filter((s) => !s.isWhole)].sort((a, b) => b.adr - a.adr)
  const whole = stats.find((s) => s.isWhole)
  const reserve = reserveSignal(stats)

  const chartData = reserve.map((r) => ({
    month: MONTHS[r.month],
    edge: Math.round(r.edge),
    reserve: Math.round(r.roomsReserve),
    wholeAdr: Math.round(r.wholeAdr),
  }))

  const badTrades = reserve.filter((r) => r.wholeAdr > 0 && r.edge < 0)

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="mb-1 font-medium">
          Allocation signal — whole-apartment ADR vs. expected room revenue
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          Per month: the whole place's realized nightly rate minus Σ(room
          occupancy × room ADR) for the same night.{' '}
          <span className="text-green-600">green = the whole booking beat the rooms</span>,{' '}
          <span className="text-red-600">red = selling rooms would have earned more</span>.
          Months where the whole place never booked show a 0 bar.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="€" />
            <Tooltip
              formatter={(v, name) => [
                `${Number(v)} €`,
                name === 'edge' ? 'Edge (whole − rooms)' : String(name),
              ]}
            />
            <Bar dataKey="edge">
              {chartData.map((d) => (
                <Cell key={d.month} fill={barColor(d.edge)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {badTrades.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-medium">Bad whole-apartment trades: </span>
          {badTrades
            .map(
              (r) =>
                `${MONTHS[r.month]} (€${Math.round(r.wholeAdr)} vs €${Math.round(r.roomsReserve)} rooms)`,
            )
            .join(' · ')}
          <p className="mt-1 text-xs text-gray-600">
            In these months the whole place booked below what the rooms would
            have earned — set the whole-apartment floor above the room reserve.
          </p>
        </div>
      )}

      <div className={card}>
        <h3 className="mb-3 font-medium">Per-listing monthly occupancy &amp; ADR</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-3">Listing</th>
                <th className="py-1 pr-3">ADR</th>
                {MONTHS.map((m) => (
                  <th key={m} className="px-1 text-center font-normal">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...(whole ? [whole] : []), ...rooms].map((s) => (
                <tr key={s.listingId} className="border-t border-gray-100">
                  <td className="py-1 pr-3 font-medium">{labelFor(s, rooms)}</td>
                  <td className="py-1 pr-3">€{Math.round(s.adr)}</td>
                  {s.byMonth.map((m) => (
                    <td
                      key={m.month}
                      className="px-1 text-center tabular-nums text-gray-700"
                      title={`${(m.occupancy * 100).toFixed(0)}% occ · €${Math.round(m.adr)} ADR · ${m.bookedNights.toFixed(0)} nights`}
                    >
                      {(m.occupancy * 100).toFixed(0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Cells show occupancy %; hover for ADR and booked nights. Pooled across
          all years in the export.
        </p>
      </div>
    </div>
  )
}
