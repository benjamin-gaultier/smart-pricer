# smart-pricer

A self-hosted, dynamic-pricing tool for a short-term rental listing. It
reproduces [PriceLabs](https://pricelabs.co)' nightly price recommendations as
an **interpretable factor stack**, and scores how closely our reproduction
tracks PriceLabs — without ever writing back to Airbnb.

> **Goals (in priority order):** a better UI than PriceLabs, the fun of building
> it, and learning. Saving the PriceLabs subscription (~€70/mo) is a nice-to-have,
> not the driver.

See [`DECISIONS.md`](./DECISIONS.md) for the full log of design decisions and
assumptions behind everything below.

---

## What v1 is (and is not)

**Is:** a 100% client-side React app. You upload a PriceLabs CSV export, enter
PriceLabs' configured factor percentages, and the app computes our price per
date and compares it to PriceLabs'.

**Is not:** there is **no backend, no scheduler, no writes to Airbnb, and no
scraping**. It is a manual, interactive tool — not a running agent. Those come
in later phases (see Roadmap).

### Why "shadow mode"

PriceLabs currently pushes prices to the listing. Two pricing tools cannot drive
one listing without fighting, so we keep PriceLabs authoritative and run
alongside it: we treat **PriceLabs' actual output as ground truth** and measure
our error against it. "How close are we to PriceLabs?" is the v1 success metric.

---

## The pricing model

A multiplicative stack on a base price — the same mental model PriceLabs exposes
in its UI (each factor shown as a % weight), which makes it interpretable:

```
price(date) = clamp(
    base
    × seasonal(month)        // e.g. June = 1.15
    × dow(weekday)           // e.g. Fri/Sat = 1.20
    × leadtime(days_out)     // last-minute discount curve
    × occupancy(local_fill), // local calendar fill rate
  min, max)
```

Factors are **copied from PriceLabs' UI**, not fitted from data (yet). The CSV is
used to *validate* the reproduction, not to derive the factors.

The one thing we structurally **cannot** reproduce is PriceLabs' proprietary
market-demand signal (aggregated booking pace across millions of listings). That
shows up as a **residual** — measuring its size and shape is the point of the
Accuracy and Residual views.

---

## The 5 views

| Tab | Purpose |
|-----|---------|
| **Heatmap** | Calendar grid colored by our-vs-PriceLabs % gap (green = match → red = off). Booked/blocked days dimmed. Click a day → Waterfall. |
| **Waterfall** | For one date: `base → ×seasonal → ×dow → ×leadtime → ×occupancy → final`, plus the PriceLabs comparison. The interpretability PriceLabs hides. |
| **Accuracy** | MAE, MAPE, and % of dates within an adjustable threshold; line chart of ours vs PriceLabs. The success metric. |
| **Residual** | Mean signed gap (PriceLabs − ours) bucketed by month and weekday. Tells us whether the gap is *tunable* (fix seasonal/dow in Config) or *structural* (needs event/holiday data). |
| **Config** | Edit base/min/max, 12 seasonal multipliers, 7 day-of-week multipliers, and the last-minute + occupancy curves. Persisted to `localStorage`. |

---

## Data

### Input: PriceLabs CSV export

The app reads these columns (others are ignored):

| Column | Use |
|--------|-----|
| `Date` | derive month, weekday, days-out |
| `Final Price` | **target** — PriceLabs' pushed price |
| `Available` (True/False) | occupancy signal (False = booked/blocked) |
| `Min Stay` | carried through |
| `ADR Last Year` | last-year reference (not yet used in the model) |

The **snapshot date** = the earliest `Date` row (the export was generated that
day), which drives the lead-time factor.

### Daily snapshots

A single export can't separate lead-time from seasonality (for one snapshot,
"days out" is perfectly collinear with the calendar date). Capturing one export
per day builds a dataset where the same target date is seen at different lead
times — which later lets us *fit* our own curves.

```bash
pnpm run snapshot path/to/PriceLabs_export.csv
# → sample-data/snapshots/YYYY-MM-DD.csv  (date read from the CSV; never overwrites)
```

> `sample-data/` is gitignored — it holds your real, private listing data.

---

## Running

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc + vite production build
pnpm snapshot   # file a daily PriceLabs export
```

Requires Node 20+ (developed on Node 24). No environment variables, no secrets.

---

## Architecture

Pure domain core, thin UI. The core is plain functions with no React/DOM deps,
so it's trivially testable and reusable by a future backend.

```
src/
  domain/
    types.ts         DayRow, Factors, PriceResult
    parseCsv.ts      PriceLabs CSV → DayRow[]
    computePrice.ts  (date, factors, calendar, snapshotDate) → price + breakdown   ← the heart
    accuracy.ts      compareAll + summarize (ours vs PriceLabs)
  lib/
    defaultFactors.ts  neutral starting factors + month/weekday labels
    useLocalStorage.ts persistence hook
  components/        one file per view
  App.tsx            tabs + CSV upload, wires state
scripts/snapshot.mjs  daily capture
```

`computePrice` returns the full factor breakdown, so the Waterfall view is just a
render of it — single source of truth for the number and its explanation.

---

## Known limitations (v1)

- **Single physical apartment, 4 linked listings** (3 rooms + whole-apartment;
  booking one blocks the others). v1 targets **only the whole-apartment
  ("Entire place") listing**. Room-vs-whole revenue allocation is deferred.
- **Whole-apartment listing is low-occupancy** (~17 booked nights/year), so the
  occupancy factor carries little signal on it.
- **Static factors can't track a live demand signal** — even a perfect copy of
  PriceLabs' factors will drift, because PriceLabs adjusts demand daily. Expect
  "close, not exact."

---

## Roadmap

- **Phase 1 (now):** reproduce + score PriceLabs in shadow mode. Collect daily
  snapshots.
- **Phase 2:** add a backend + a channel-manager API (e.g. Beds24/Hospitable —
  *not* Airbnb directly, to stay within ToS and protect the account) to actually
  **write** prices, on a daily cron. Gate behind a feature flag; cut over from
  PriceLabs only once accuracy is trusted.
- **Phase 3:** the room-vs-whole-apartment allocation optimization.
- **Later / as-needed:** Tier-2 demand data (French public + school holidays,
  Paris events) added only where the Residual view shows systematic gaps; fitting
  our own factors from the snapshot history.

---

## Hard constraints

- **Never risk the Airbnb host account** (it generates real income). No scraping,
  no unofficial Airbnb API — writes only ever go through an official
  channel-manager partner.
- **Never commit real listing data** — `sample-data/` is gitignored.
