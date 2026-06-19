# Decision & assumption log

A running record of the choices behind smart-pricer and *why* we made them, so
future work doesn't relitigate settled questions or violate constraints we
adopted for good reasons. Newest decisions can be appended at the bottom.

Format: each entry is **Decision → Why → Status**.

---

## Context

- **Owner:** one host with a single physical Paris apartment, listed as
  **4 Airbnb listings**: 3 individual rooms + 1 whole-apartment ("Entire place").
  Airbnb auto-blocks the others when one is booked. (A 5th listing in Nancy is
  out of scope — no access.)
- **Today:** the host uses PriceLabs (~€70/mo) for dynamic pricing.
- **2025 actuals** (from the Airbnb earnings report): whole-apartment booked only
  **17 nights** all year; rooms dominate (Medium 251, Small 241, Grande 68).
  Whole-apartment ADR ≈ €364; the CSV we work from shows €400–680 prices,
  confirming it is the whole-apartment listing.

---

## Strategy

**1. Write path: never touch Airbnb directly.**
→ Airbnb has no host-level pricing API; PriceLabs has it via an official partner
program we can't get. Scraping / unofficial APIs risk the host account.
→ *Why it matters:* the account earns 7k+/month. Saving €70/mo is not worth any
account risk. Writes (Phase 2) will go through an official channel-manager API
(Beds24 scouted first). **Status: adopted.**

**2. v1 is read-only "shadow mode."**
→ Two pricing tools can't drive one listing. Keep PriceLabs authoritative; treat
its output as ground truth and measure our error against it.
→ *Why:* gives a concrete success metric ("how close to PriceLabs?") and zero
write risk. **Status: adopted, implemented.**

**3. No test/throwaway Airbnb account.**
→ A fake listing has no real calendar/demand and can't change the real listing's
price. Shadow mode on real data is safer *and* more useful. **Status: adopted.**

**4. Target the whole-apartment listing only for v1.**
→ The 4 listings are inventory-linked; pricing them jointly (room-vs-whole
allocation) is the hard problem. Defer it. The whole-apartment price is the
cleanest single thing to reproduce. **Status: adopted.**

---

## Model

**5. Multiplicative factor stack copied from PriceLabs' UI.**
→ `price = clamp(base × seasonal × dow × leadtime × occupancy, min, max)`.
→ *Why:* PriceLabs literally shows each factor as a % weight on base, so copying
is just transcribing ~a dozen numbers; it's interpretable (drives the Waterfall
view); no overfitting; no cold start. Fitting factors from data is deferred until
we have enough snapshots and a reason. **Status: adopted, implemented.**

**6. The proprietary demand signal is unreproducible — measure the residual.**
→ PriceLabs' edge is aggregated booking pace across millions of listings.
→ *Why:* we can't replicate it, so we quantify it. The Residual view buckets the
gap by month/weekday to tell us if it's tunable or structural. **Status: adopted.**

**7. Tiered demand data; v1 = Tier 1 only (the listing's own calendar).**
→ Tier 1 (own occupancy/pace, day-of-week, seasonality) is free and highest
signal. Tier 2 (FR holidays, Paris events) added only where the residual shows
systematic gaps. Tier 3 (paid comp-set like AirDNA) avoided; scraping comps =
Airbnb ToS risk → never. **Status: adopted (Tier 1 implemented).**

---

## Data

**8. The PriceLabs CSV is the single data source for v1.**
→ It provides `Final Price` (target), `Available` (occupancy), and `Date`.
→ The Airbnb **earnings PDF is context only** (annual aggregates, no per-date
rows) — not wired into the model. **Status: adopted.**

**9. Snapshot date = earliest `Date` row.**
→ The export is generated "today" forward, so the first row is the snapshot day;
this drives the lead-time factor. **Status: adopted, implemented.**

**10. Capture one CSV snapshot per day, starting immediately.**
→ A single snapshot can't separate lead-time from seasonality (perfect
collinearity). Daily snapshots let us later observe the same target date at
different lead times and *fit* curves. Payoff compounds with calendar time, so
start now even though v1 doesn't consume them. **Status: adopted (`pnpm run
snapshot`).**

---

## Stack & ops

**11. Client-only React + Vite + TS + Tailwind; no backend in v1.**
→ Data is tiny (one listing × ~1.5 yrs), no secrets, no writes. A backend is
introduced only in Phase 2 when it's actually needed (cron, channel-manager API,
secrets). Same stack as the owner's day job = fast. **Status: adopted,
implemented.**

**12. Persistence via `localStorage`; no DB.**
→ Sufficient for a single-user local tool. **Status: adopted.**

**13. Separate repo, not inside the work monorepo.**
→ Unrelated codebase. Personal GitHub repo `benjamin-gaultier/smart-pricer`,
committed with personal email. **Status: adopted.**

**14. HTTPS git remote, not SSH.**
→ This network firewalls GitHub SSH (port 22 times out, SSH-over-443 closed).
HTTPS works; macOS keychain holds the token. **Status: adopted.**

**15. Real listing data is gitignored (`sample-data/`).**
→ Contains listing ID + actual prices (private business data). Not committed even
to a private repo. **Status: adopted.**

---

**16. Add a Final ⇄ Default target toggle; keep Final as default target.**
→ The CSV's `Price with Default Customization` is PriceLabs' *algorithmic* price;
`Final Price` = that + the host's manual overrides. In the 2026-06-16 export the
two differ on **44% of dates, mean 4.0%** (€24).
→ *Why:* targeting Final imposes a ~4% accuracy floor (manual tweaks aren't
predictable from factors). Targeting Default strips that noise so true factor
error is visible and tunable. With *untuned* defaults both score ~13.5% MAPE
(factor error dominates), so the toggle's value is realized **during tuning**,
not before. `ADR Last Year` remains unused (mostly empty in forward rows).
**Status: adopted, implemented (toggle defaults to Final).**

**17. "Suggest from data" seeds base/seasonal/dow by fitting the target prices.**
→ A multiplicative two-factor fit (alternating geometric means, seasonal & dow
normalized to geomean 1 so base carries the level). Lead-time & occupancy are
**neutralized** (one snapshot can't separate lead-time from seasonality); min/max
set to the observed price range so they don't clip.
→ *Why:* gives a data-driven starting point instead of hand-transcribing every
number. It's a *seed*, not a replacement for copy-from-UI (decision #5 stands).
On the 2026-06-16 Default prices it cut MAPE 13.4% → **8.4%** (within-5% 24% →
40%). The residual 8.4% is the neutralized curves + PriceLabs' demand signal.
**Status: adopted, implemented (button in Config, overwrites with confirm).**

**18. Add a Tier-2 events overlay (date-range × multiplier), promoted from deferred.**
→ After seeding (decision #17), the residual is **structural, not noise**: the
biggest signed gaps cluster on the **New Year's week** (2026-12-27 → 2027-01-02,
PriceLabs +39% to +80%; NYE €1025 vs our €619) plus apparent Paris events
(2027-10-01→03, 2027-06-13/14), and a last-minute dip on the snapshot-edge dates
(2026-06-16/17/19, −35%). Events are a per-date `{from,to,multiplier,label}`
curve (first match wins), applied as the last step of the stack, defaulting to
`[]` so existing behavior is unchanged.
→ *Why now:* decision #7 said add Tier-2 "only where the residual shows
systematic gaps" — it now clearly does. **Caveat:** the overlay moves aggregate
MAPE only **8.4% → 7.8%** because the spikes are ~13 of 541 dates; MAPE weights
all dates equally and so understates the value. The real payoff is not
under-pricing peak nights by ~€400, which is where the host earns most. The host
enters their own events (we do not hardcode a calendar). **Status: adopted,
implemented (Events editor in Config).**

**19. Fit the short-horizon (≤14d) lead-time curve in the seeder; keep >14d neutral.**
→ With a second snapshot filed (decision #10 paying off), the last-minute discount
is now both *measurable* and *confirmed causal*: deseasonalized price/seed by
days-out is **d0 0.63, d1 0.67, d2–3 0.78, d4–7 0.90, d8–14 0.92, then ~1.0**. The
cross-snapshot panel proves it's lead-time not a date effect — every fixed target
date drops as the snapshot advances toward it (e.g. 2026-06-18: €563→€493 −12%;
06-19 −8%). A date-specific event wouldn't move; a last-minute discount does.
→ *Why this overrides #10's collinearity caveat (only for the short horizon):* a
last-minute discount is a sharp local dip against the smooth seasonal curve, so
the ≤14d range is identifiable from one snapshot; the second snapshot confirmed
it. The >14d range still shows no clean signal, so the seeder leaves it neutral.
`fitFactors` now buckets the deseasonalized ratio into cutoffs [1,3,7,14]
(≥2 rows/band, clamped 0.5–1.5). Impact: overall MAPE 8.4%→8.0%, but **≤14d MAPE
collapses 18.4%→2.5%** — the dates the host can actually act on now. Occupancy
stays neutralized. **Status: adopted, implemented.**

**20. Pivot reproduce → beat; C is forward-accumulation-only; D becomes the active
workstream. PriceLabs analytics is a partial backfill for C.**
→ Goal restated: shadow mode is now a *context-gathering phase with an exit
condition*, not the end. PriceLabs stays the permanent **benchmark**; the factor
stack becomes the interpretable **base layer** our own rules sit on. Layered
engine: L0 base curve (today) → L1 demand corrections (C) → L2 allocation (D).
→ *Reservation history is unavailable via any non-risky route.* Airbnb exposes no
host reservation API; scraping is off the table (account earns ~€70k/yr, day-one
constraint); channel-manager APIs (Beds24 etc.) are legitimate but Phase-2 and
**don't backfill history**. So **C (pace/lead-time model) can't be built from
history** — it accrues forward via daily snapshot diffs (a night flipping
`Available: True→False` = a booking event at a known price/lead-time). C is
parked, fed passively; revisit once snapshots accumulate.
→ *But PriceLabs Portfolio Analytics (the May-27 PDF) already shows the
reservation-derived aggregates we wanted:* **avg booking window 41 days**, a
booking-window histogram (mode 1–2 months; 7–13d:18, 2–4wk:20, 1–2mo:28,
2–4mo:20 booked-nights), LOS distribution, and per-listing occupancy/ADR. It's
aggregate (PDF, not per-booking) so it can't drive a row-level model, but it
*validates* the lead-time shape and is a cheap sanity check. PriceLabs clearly
holds the underlying booking-creation data — a future export path worth probing.
→ *D is now active — and we have enough data for it.* `Stay Dates.csv` gives 4.5
yrs daily occupancy × all 4 listings; Portfolio Analytics confirms the thesis
hard: **May 2026 occupancy — Small 96.7%, Medium 100%, Grande 82.6%, Entire place
0% (last booked: N/A)**; ADR Small €85 / Medium €104 / Grande €115. The whole
place is dormant by design (rooms out-earn it), exactly the "price it as a reserve
option" setup. D needs realized occupancy by listing×date (in hand), not
booking-made dates.
→ *Inventory locked:* the 4 IDs in our data are the Paris inventory (3 rooms +
"Entire place · Unique Garden House"). The standalone "unique garden house" in the
earnings PDF (0 nights, €0) is a **stale duplicate** of the entire-place listing,
being deleted host-side; it has no rows in our data, so nothing to strip.
→ *Two rigor upgrades to apply as D is built:* revenue-/booking-weight the loss
(MAPE understates peak nights — see #18), and use a time-based holdout once
snapshots accumulate. **Status: adopted (direction); D implementation pending.**

---

## Explicitly deferred (do NOT build yet)

- Channel-manager **write** integration + backend + daily cron (Phase 2).
- Room-vs-whole **allocation** (D) is now the **active workstream** (#20), no
  longer deferred. The demand/pace model (C) is parked but fed by daily snapshots.
- Tier-2 events overlay shipped (#18); **auto-populating** holidays/events from a
  calendar feed and Tier-3 (paid comp-set) remain deferred.
- **Fitting** factors from snapshot history instead of copying from PriceLabs.
- Tests (the owner tests manually first; tests added on request).
- Mock data.
