/* ============================================================
   COMP METRICS — canonical per-row formulas + aggregation layer
   ------------------------------------------------------------
   Single source of truth for every sales-comp calculation,
   validated by tests/comp-validation.test.js against the golden
   fixtures in tests/fixtures/comp_validation_fixtures.json
   (see docs/Comp_Calculation_Validation_Spec.md).

   Conventions (spec):
   - Missing required input → null, NEVER 0. Aggregations exclude nulls.
   - Cap rate / GRM / ratios are DECIMALS (0.0574 = 5.74%).
     Scale ×100 only at the display layer.
   - Day metrics are signed integer date differences.
   - x_noi TRUE suppresses cap rate; x_agi TRUE suppresses GRM.
   - AskToSold divides by ORIGINAL listing price (not current).
   - SoldDaysToUC ≡ PENDaysToUC = pending − listing (no sale date).
   - Central tendency = MEDIAN (Excel-style: even count → average
     of the two middle values). Sale Volume is the only SUM.
   ============================================================ */

// numeric coercion: null/undefined/'' → null (never 0)
export const num = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
// positive-or-null: prices, units, SF, income must be > 0 to be usable
const pos = v => { const n = num(v); return n != null && n > 0 ? n : null }
// guarded division — null if either side missing/non-positive
const ratio = (a, b) => { const x = pos(a), y = pos(b); return (x == null || y == null) ? null : x / y }

/* ---- dates ---------------------------------------------------------------
   Parse BOTH stored formats (M/D/YYYY from Salesforce CSV, YYYY-MM-DD ISO)
   to LOCAL midnight so date math never mixes UTC/local bases. */
export function parseDate(s) {
  if (!s) return null
  if (s instanceof Date) return isNaN(s) ? null : s
  const str = String(s).trim()
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2])
  const d = new Date(str)
  return isNaN(d) ? null : d
}
// signed integer day difference (b − a); round() absorbs DST offsets
export function daysBetween(a, b) {
  const da = parseDate(a), db = parseDate(b)
  if (!da || !db) return null
  return Math.round((db - da) / 86400000)
}

/* ---- per-row metrics (fns of an app-shaped comp row) -------------------- */
// §1 Price per Unit (dollars)
export const askPriceUnit  = c => ratio(c.listing_price, c.num_units)
export const soldPriceUnit = c => ratio(c.sale_price, c.num_units)
// §2 Price per SF (dollars)
export const askPriceSF  = c => ratio(c.listing_price, c.building_sf)
export const soldPriceSF = c => ratio(c.sale_price, c.building_sf)
// §3 Cap Rate (decimal) — suppressed by x_noi; requires positive NOI (app-wide convention)
export const askCap  = c => c.x_noi ? null : ratio(c.adv_noi, c.listing_price)
export const soldCap = c => c.x_noi ? null : ratio(c.adv_noi, c.sale_price)
// §4 GRM (multiple) — suppressed by x_agi
export const askGRM  = c => c.x_agi ? null : ratio(c.listing_price, c.adv_agi)
export const soldGRM = c => c.x_agi ? null : ratio(c.sale_price, c.adv_agi)
// §5 Timing (integer days)
export const daysToUC     = c => daysBetween(c.listing_date, c.pending_date)  // PENDaysToUC and SoldDaysToUC
export const escrowLength = c => daysBetween(c.pending_date, c.sale_date)
export const totalDOM     = c => daysBetween(c.listing_date, c.sale_date)
export const actDOM       = (c, asOf) => c.listing_date ? daysBetween(c.listing_date, asOf ?? new Date()) : null
// §6 Ask-to-Sold ratio (decimal) — ORIGINAL listing price, not current
export const askToSold = c => ratio(c.sale_price, c.original_listing_price)

/* ---- aggregation --------------------------------------------------------- */
// Excel-style median: even count → average of the two middle values
export function median(arr) {
  const f = arr.filter(v => v != null && isFinite(v))
  if (!f.length) return null
  const s = [...f].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// status bucket: data uses "Under Contract"; legacy literal "Pending" tolerated
export const isUnderContract = s => s === 'Under Contract' || s === 'Pending'

export const normEra = e => (e || '').replace(/[–—]/g, '-').trim().toLowerCase()

/* Scope filter shared by Market Snapshot + aggregates.
   Unit range: a comp with NO unit count is EXCLUDED when a range is set
   (Excel range criteria exclude blanks). */
export function inScope(c, f = {}) {
  if (f.county && f.county !== 'All' && c.property_county !== f.county) return false
  if (f.subMarket && f.subMarket !== 'All' && c.sub_market !== f.subMarket) return false
  if (f.zip && f.zip !== 'All' && String(c.zip_code) !== String(f.zip)) return false
  if (f.era && f.era !== 'All' && normEra(c.year_built_era) !== normEra(f.era)) return false
  const min = num(f.unitMin), max = num(f.unitMax)
  if (min != null || max != null) {
    const u = num(c.num_units)
    if (u == null) return false
    if (min != null && u < min) return false
    if (max != null && u > max) return false
  }
  return true
}

// window start = asOf − windowDays (calendar-day arithmetic, local)
export function windowStart(asOf, windowDays) {
  const end = parseDate(asOf)
  if (!end || windowDays == null) return null
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - windowDays)
}

/* Dashboard aggregate layer (spec §7). Current window = [asOf−W, asOf]
   inclusive (capped at asOf so live data stays reproducible against a
   pinned as_of). Prior/YOY windows are half-open per spec:
     prior: asOf−2W <= d < asOf−W      yoy: asOf−365−W <= d < asOf−365   */
export function computeAggregates(comps, { filters = {}, asOf, windowDays } = {}) {
  const end = parseDate(asOf) ?? new Date()
  const start = windowDays != null ? windowStart(end, windowDays) : null
  const status = filters.status ?? 'Sold'
  const sold = comps.filter(c => {
    if (status !== 'All' && c.status !== status) return false
    if (!inScope(c, filters)) return false
    const d = parseDate(c.sale_date)
    if (!d) return false
    if (start && d < start) return false
    if (d > end) return false
    return true
  })
  return {
    sold_count:             sold.length,
    median_price_per_unit:  median(sold.map(soldPriceUnit)),
    median_price_per_sf:    median(sold.map(soldPriceSF)),
    median_cap:             median(sold.map(soldCap)),
    median_grm:             median(sold.map(soldGRM)),
    median_sold_days_to_uc: median(sold.map(daysToUC)),
    median_escrow:          median(sold.map(escrowLength)),
    median_total_dom:       median(sold.map(totalDOM)),
    sale_volume_sum:        sold.reduce((s, c) => s + (num(c.sale_price) || 0), 0),
    median_ask_to_sold:     median(sold.map(askToSold)),
  }
}
