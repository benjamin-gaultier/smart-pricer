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

---

## Explicitly deferred (do NOT build yet)

- Channel-manager **write** integration + backend + daily cron (Phase 2).
- Room-vs-whole-apartment **allocation** optimization (Phase 3).
- Tier-2 (holidays/events) and Tier-3 (paid comp-set) demand data.
- **Fitting** factors from snapshot history instead of copying from PriceLabs.
- Tests (the owner tests manually first; tests added on request).
- Mock data.
