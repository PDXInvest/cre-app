import { supabase } from '../supabase'
import {
  parseDate, median, inScope,
  askPriceUnit, askPriceSF, soldPriceUnit, soldPriceSF,
  askCap, soldCap, askGRM, soldGRM,
  daysToUC, escrowLength, totalDOM, actDOM, askToSold, isUnderContract,
} from './compMetrics'

/* ============================================================
   MARKET SNAPSHOT — data-binding seam (§7)
   ------------------------------------------------------------
   This is the SINGLE swappable module the Snapshot UI binds to.
   The numbers below are PLACEHOLDER (illustrative SE Portland
   2–4 unit, pre-1940). Snapshot's metrics are comp-derived
   aggregates; wiring is deferred until the comp module's fields
   stabilize (post-Salesforce). When real data is wired, produce
   this same shape — { key, group, name, fmt, downIsGood,
   series[20q], optional ask[] } — or reshape to it here, so the
   rest of the UI never changes. Do NOT scatter these numbers
   into components.
   ============================================================ */

/* Rolling quarter grid — the last N quarters ENDING IN THE CURRENT QUARTER,
   rebuilt at load so the chart calendar never goes stale. (It was previously
   hardcoded Q1·21–Q4·25, which silently dropped every sale dated after 2025.) */
const QUARTER_COUNT = 20
const _qNow = new Date()
const _qEndAbs = _qNow.getFullYear() * 4 + Math.floor(_qNow.getMonth() / 3)   // absolute quarter index of today
const _qStartAbs = _qEndAbs - (QUARTER_COUNT - 1)
export const MS_QUARTERS = Array.from({ length: QUARTER_COUNT }, (_, i) => {
  const abs = _qStartAbs + i
  return `Q${(abs % 4) + 1}·${String(Math.floor(abs / 4)).slice(-2)}`
})

/* timeframe → how many trailing quarters define the "current window" */
export const MS_TF_WIN = { '30d': 1, '90d': 1, '180d': 2, '365d': 4 }
export const MS_TF_LABEL = { '30d': '30 days', '90d': '90 days', '180d': '180 days', '365d': '12 months' }
export const MS_TF_PRIOR = { '30d': 'prior 30d', '90d': 'prior 90d', '180d': 'prior 180d', '365d': 'prior year' }
export const MS_TF_N = { '30d': 3, '90d': 8, '180d': 15, '365d': 31 }

/* Comparison dimensions — "split by". Real data attaches m.split[key] =
   { series, cohorts } computed from actual cohort pools in fetchSnapshotData;
   `factor` only drives the pre-fetch placeholder fallback. */
export const MS_SPLITS = [
  { key: 'asksold',   label: 'Asking vs Sold',        primary: 'Sold',        comp: 'Asking',         factor: 1.03 },
  { key: 'cash',      label: 'Cash vs Financed',      primary: 'This filter', comp: 'All cash',       factor: 0.965 },
  { key: 'buyer',     label: 'Owner-occ vs Investor', primary: 'This filter', comp: 'Owner-occ',      factor: 1.02 },
  { key: 'county',    label: 'vs County',             primary: 'This filter', comp: 'County avg',     factor: 0.945 },
  { key: 'submarket', label: 'vs Sub-market',         primary: 'This filter', comp: 'Sub-market avg', factor: 0.985 },
  { key: 'era',       label: 'vs Era',                primary: 'This filter', comp: 'All eras',       factor: 1.045 },
]

export const MS_METRICS = [
  {
    key: 'ppu', group: 'Pricing', name: '$ / Unit', focusName: 'Sold Price per Unit',
    eyebrow: 'Pricing · Median', fmt: 'k$', dFmt: 'pct', downIsGood: false,
    series: [298, 305, 312, 322, 331, 348, 358, 366, 362, 355, 349, 346, 352, 358, 355, 349, 344, 340, 339, 337],
    ask:    [305, 311, 319, 330, 340, 357, 368, 378, 377, 372, 365, 360, 364, 369, 366, 361, 357, 354, 353, 355],
    insight: 'Per-unit pricing has cooled __dPrior__ off its 2022 peak as financed buyers reprice debt — but stock here still clears above the metro.',
  },
  {
    key: 'psf', group: 'Pricing', name: '$ / SF', focusName: 'Sold Price per SF',
    eyebrow: 'Pricing · Median', fmt: '$', dFmt: 'pct', downIsGood: false,
    series: [300, 305, 310, 316, 322, 330, 336, 340, 338, 335, 331, 329, 332, 335, 333, 330, 328, 326, 325, 324],
    ask:    [308, 313, 318, 324, 330, 338, 344, 348, 347, 344, 340, 338, 340, 343, 341, 338, 336, 334, 333, 332],
    insight: 'Price per square foot has held remarkably flat — buyers are underwriting on income, not size, in this vintage pool.',
  },
  {
    key: 'cap', group: 'Pricing', name: 'Cap Rate', focusName: 'Median Cap Rate',
    eyebrow: 'Pricing · Median', fmt: '%', dFmt: 'bps', downIsGood: false,
    series: [4.70, 4.78, 4.85, 4.92, 5.00, 5.05, 5.12, 5.18, 5.22, 5.28, 5.33, 5.40, 5.44, 5.48, 5.52, 5.56, 5.58, 5.60, 5.61, 5.62],
    insight: 'Cap rates have widened __dYoY__ over the year as buyers demand more yield — Southeast pre-war stock now prices ahead of the broader pool.',
  },
  {
    key: 'grm', group: 'Pricing', name: 'GRM', focusName: 'Gross Rent Multiplier',
    eyebrow: 'Pricing · Median', fmt: 'x', dFmt: 'x', downIsGood: true,
    series: [14.0, 13.9, 13.8, 13.8, 13.7, 13.6, 13.6, 13.5, 13.4, 13.4, 13.3, 13.2, 13.2, 13.1, 13.1, 13.0, 13.0, 12.9, 12.9, 12.8],
    insight: 'Gross rent multiples have compressed to 12.8× — the cheapest entry on income in three years as rents catch up to price.',
  },
  {
    key: 'asksold', group: 'Pricing', name: 'Ask→Sold', focusName: 'Asking → Sold Spread',
    eyebrow: 'Pricing · Negotiation', fmt: 'dpct', dFmt: 'pts', downIsGood: false,
    series: [-0.8, -1.0, -1.1, -1.2, -1.4, -1.6, -1.8, -1.9, -2.0, -2.2, -2.4, -2.6, -2.7, -2.9, -3.0, -3.1, -3.2, -3.3, -3.3, -3.4],
    insight: 'Sellers are conceding more at the table — the gap between ask and sold has widened to −3.4%, the most buyer-friendly in the cycle.',
  },
  {
    key: 'activedom', group: 'Velocity', name: 'Active DOM', focusName: 'Active Days on Market',
    eyebrow: 'Velocity · Median', fmt: 'd', dFmt: 'd', downIsGood: true,
    series: [92, 90, 89, 88, 86, 84, 82, 79, 76, 74, 72, 70, 68, 66, 65, 64, 63, 62, 62, 61],
    insight: 'Listings are moving faster — active days on market are down to 61, the tightest in two years.',
  },
  {
    key: 'dom', group: 'Velocity', name: 'Total DOM', focusName: 'Total Days on Market',
    eyebrow: 'Velocity · Median', fmt: 'd', dFmt: 'd', downIsGood: true,
    series: [128, 126, 124, 122, 120, 118, 116, 112, 108, 106, 104, 102, 98, 96, 94, 93, 91, 90, 89, 87],
    insight: 'From list to close, deals are running __dYoY__ faster year-over-year — a sign demand is absorbing quality stock quickly.',
  },
  {
    key: 'escrow', group: 'Velocity', name: 'Escrow', focusName: 'Escrow Length',
    eyebrow: 'Velocity · Average', fmt: 'd', dFmt: 'd', downIsGood: true,
    series: [58, 57, 56, 55, 54, 53, 52, 50, 49, 48, 47, 46, 45, 45, 44, 44, 43, 43, 43, 43],
    insight: 'Escrows are closing in 43 days on average — clean, well-underwritten deals with fewer financing hiccups.',
  },
  {
    key: 'nsold', group: 'Volume', name: 'No. Sold', focusName: 'Closed Sales',
    eyebrow: 'Volume · Count', fmt: 'int', dFmt: 'int', downIsGood: false,
    series: [5, 6, 5, 7, 6, 7, 8, 7, 6, 7, 8, 7, 9, 8, 7, 8, 7, 8, 7, 8],
    insight: 'Transaction count is holding steady — liquidity in this niche has not dried up despite higher rates.',
  },
  {
    key: 'nlisted', group: 'Volume', name: 'No. Listed', focusName: 'New Listings',
    eyebrow: 'Volume · Count', fmt: 'int', dFmt: 'int', downIsGood: true,
    series: [16, 15, 15, 14, 15, 14, 13, 13, 12, 12, 11, 12, 11, 10, 10, 11, 10, 10, 9, 9],
    insight: 'New supply keeps thinning — fewer owners are listing, tightening the pool of quality pre-war fourplexes.',
  },
  {
    key: 'volume', group: 'Volume', name: 'Sale Volume', focusName: 'Sale Volume',
    eyebrow: 'Volume · Dollars', fmt: '$M', dFmt: 'pct', downIsGood: false,
    series: [9.2, 10.1, 9.8, 11.0, 10.6, 11.4, 12.0, 11.6, 11.2, 12.1, 12.7, 12.0, 13.4, 12.9, 12.4, 13.1, 12.7, 13.6, 13.1, 14.2],
    insight: 'Dollar volume is back near cycle highs — bigger, cleaner assets are trading even as unit pricing softens.',
  },
  {
    key: 'cashshare', group: 'Volume', name: 'Cash Share', focusName: 'Cash Buyer Share',
    eyebrow: 'Volume · Mix', fmt: 'pct', dFmt: 'pts', downIsGood: false,
    series: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 35, 36, 36, 37, 37, 38, 38, 38],
    insight: 'Cash now makes up 38% of closings — buyers are sidestepping debt costs entirely to win in a thin market.',
  },
]

/* ---- formatting ---- */
export function msFmt(v, t) {
  if (v == null || (typeof v === 'number' && isNaN(v))) return '—'   // null quarter → gap
  switch (t) {
    case 'k$':   return '$' + Math.round(v) + 'k'
    case '$':    return '$' + Math.round(v)
    case '%':    return v.toFixed(2) + '%'
    case 'x':    return v.toFixed(1) + '×'
    case 'd':    return Math.round(v) + 'd'
    case 'int':  return '' + Math.round(v)
    case '$M':   return '$' + v.toFixed(1) + 'M'
    case 'pct':  return Math.round(v) + '%'
    case 'dpct': return (v > 0 ? '+' : '') + v.toFixed(1) + '%'
    default:     return '' + v
  }
}

// mean that ignores null/non-finite quarters; returns null if the window is empty
const msMean = a => { const f = a.filter(v => v != null && isFinite(v)); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : null }

/* current / prior / yoy stats for a timeframe.
   Real data (fetchSnapshotData) attaches m.win[tf] = { cur, prior, yoy, n }
   computed over TRUE day windows per the validation spec — current window is
   the last W days by sale date; prior and YOY windows are half-open. The
   quarter-mean fallback below only serves the synchronous placeholder state
   before the first fetch resolves. */
export function msStats(m, tf) {
  if (m.win && m.win[tf]) return m.win[tf]
  const s = m.series, n = s.length, w = MS_TF_WIN[tf] || 1
  const cur   = msMean(s.slice(n - w))
  const prior = msMean(s.slice(Math.max(0, n - 2 * w), n - w))
  const yoyW  = s.slice(Math.max(0, n - w - 4), n - 4)
  const yoy   = yoyW.length ? msMean(yoyW) : prior
  return { cur, prior, yoy }
}

/* format a delta between two values per the metric's delta style */
export function msDelta(m, a, b) {
  if (a == null || b == null || isNaN(a) || isNaN(b)) return { txt: '—', dir: 'flat', arrow: '' }
  const d = a - b
  let txt, dir
  switch (m.dFmt) {
    case 'pct': { const p = b ? (d / Math.abs(b)) * 100 : 0; txt = (p >= 0 ? '+' : '') + p.toFixed(1) + '%'; break }
    case 'bps': txt = (d >= 0 ? '+' : '') + Math.round(d * 100) + ' bps'; break
    case 'x':   txt = (d >= 0 ? '+' : '') + d.toFixed(1) + '×'; break
    case 'd':   txt = (d >= 0 ? '+' : '') + Math.round(d) + 'd'; break
    case 'int': txt = (d >= 0 ? '+' : '') + Math.round(d); break
    case 'pts': txt = (d >= 0 ? '+' : '') + d.toFixed(1) + ' pts'; break
    default:    txt = (d >= 0 ? '+' : '') + d.toFixed(1)
  }
  const up = d > 0.0001, down = d < -0.0001
  if (!up && !down) dir = 'flat'
  else dir = ((up && !m.downIsGood) || (down && m.downIsGood)) ? 'pos' : 'neg'
  const arrow = up ? '▲' : down ? '▼' : '■'
  return { txt, dir, arrow }
}

/* Comparison series for a split dimension. With real data (m.split present),
   the overlay is the actual cohort's quarterly series — or null when the
   comparison doesn't exist for this metric (e.g. Asking-side DOM), which hides
   the overlay rather than faking one. The factor path only serves the
   pre-fetch placeholder state. */
export function msCompSeries(m, splitKey) {
  const sp = MS_SPLITS.find(s => s.key === splitKey)
  if (!sp) return null
  if (m.split) {
    const d = m.split[splitKey]
    if (!d || !d.series || d.series.every(v => v == null)) return null
    return { label: sp.comp, primaryLabel: sp.primary, data: d.series }
  }
  if (splitKey === 'asksold' && m.ask) return { label: sp.comp, primaryLabel: sp.primary, data: m.ask }
  return { label: sp.comp, primaryLabel: sp.primary, data: m.series.map(v => (v == null || !isFinite(v)) ? null : v * sp.factor) }
}

/* Comparison bars for the active split — real cohort medians over the current
   timeframe window (placeholder multipliers only before the first fetch). */
export function msCompBars(m, tf, splitKey) {
  const sp = MS_SPLITS.find(s => s.key === splitKey) || MS_SPLITS[3]
  if (m.split) {
    const cur = msStats(m, tf).cur
    const rows = [
      { label: sp.primary, val: cur, accent: true },
      ...(m.split[splitKey]?.cohorts || []).map(ch => ({ label: ch.label, val: ch.win?.[tf] ?? null })),
    ]
    const max = Math.max(...rows.map(r => Math.abs(r.val ?? 0)), 1e-9)
    return rows.map(r => ({
      label: r.label,
      val: r.val == null ? '—' : msFmt(r.val, m.fmt),
      pct: r.val == null ? 0 : Math.round((Math.abs(r.val) / max) * 100),
      accent: !!r.accent,
    }))
  }
  const { cur } = msStats(m, tf)
  const rows = [
    { label: sp.primary === 'This filter' ? 'This filter set' : sp.primary, mult: 1.0, accent: true },
    { label: sp.comp, mult: sp.factor },
  ]
  const max = Math.max(...rows.map(r => Math.abs(cur * r.mult)))
  return rows.map(r => {
    const val = cur * r.mult
    return { label: r.label, val: msFmt(val, m.fmt), pct: Math.round((Math.abs(val) / max) * 100), accent: !!r.accent }
  })
}

/* ============================================================
   REAL DATA — fetchSnapshotData(filters)
   Queries the comps table and returns the SAME MS_METRICS shape
   with real quarterly series. Used by MarketSnapshot once mounted;
   MS_METRICS (above) is the synchronous initial/loading state.
   Field names verified against CompDatabase.jsx calcFields.
   ============================================================ */

const _median = median
// index into the rolling grid (0..QUARTER_COUNT-1) or -1 if before the grid starts
function _quarterIdx(s) { const d = parseDate(s); if (!d) return -1; const i = (d.getFullYear() * 4 + Math.floor(d.getMonth() / 3)) - _qStartAbs; return (i >= 0 && i < MS_QUARTERS.length) ? i : -1 }
// active DOM: listing→pending if pending exists, else listing→today (Excel quirk —
// the dashboard's "Active DOM" tile is sourced from SoldDaysToUC; spec §8.4)
function _activeDom(c) { if (!c.listing_date) return null; return c.pending_date ? daysToUC(c) : actDOM(c) }

/* Per-comp value for each median metric — canonical formulas from compMetrics
   (validated against the golden fixtures by tests/comp-validation.test.js).
   Metrics are decimals/dollars at the calc layer; DISPLAY scaling for the
   series shape happens here: ppu → $k, cap → %, asksold → spread %. */
const scaled = (fn, mult) => c => { const v = fn(c); return v == null ? null : v * mult }
const _MVAL = {
  ppu:       scaled(soldPriceUnit, 1 / 1000),                       // dollars → $k/unit
  psf:       soldPriceSF,
  cap:       scaled(soldCap, 100),                                  // decimal → %
  grm:       soldGRM,
  // Ask→Sold spread % = (sale / ORIGINAL list − 1) × 100 (spec §6: original, not current)
  asksold:   c => { const r = askToSold(c); return r == null ? null : (r - 1) * 100 },
  activedom: _activeDom,
  dom:       totalDOM,
  escrow:    escrowLength,
}
// asking-price analogues (for the Asking-vs-Sold split) — same display scaling
const _AVAL = {
  ppu: scaled(askPriceUnit, 1 / 1000),
  psf: askPriceSF,
  cap: scaled(askCap, 100),
  grm: askGRM,
}

export async function fetchSnapshotData(filters = {}) {
  // paginated fetch — 1,000-row pages, stable sort (sale_date DESC nulls last, id ASC)
  let all = [], from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase.from('comps').select('*')
      .order('sale_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  // scope filters from the Snapshot filter strip — canonical inScope applies
  // county / sub-market / ZIP / era / unit range uniformly. Note: zip is now
  // actually applied (it previously was collected by the UI but never filtered),
  // and comps with no unit count are excluded when a unit range is set
  // (matching Excel range criteria, which exclude blanks).
  const f = filters || {}
  const scoped = all.filter(c => inScope(c, f))

  /* ---- Metric engine — quarterly series + true day-window stats for ONE pool.
     Used for the primary filtered pool AND for every split-comparison cohort,
     so all cohorts get identical, fixture-validated math (spec §7 windows:
     current = [today−W, today]; prior/YOY half-open so edges never double-count). */
  const TF_DAYS = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 }
  function makeEngine(pool) {
    const soldByQ   = MS_QUARTERS.map(() => [])
    const listedByQ = MS_QUARTERS.map(() => [])
    for (const c of pool) {
      if (c.status === 'Sold') { const q = _quarterIdx(c.sale_date); if (q >= 0) soldByQ[q].push(c) }
      const lq = _quarterIdx(c.listing_date); if (lq >= 0) listedByQ[lq].push(c)
    }
    // median series with the <3-comps-per-quarter → null rule
    const medSeries = key => soldByQ.map(b => (b.length < 3 ? null : _median(b.map(_MVAL[key]))))
    const seriesFor = key => {
      switch (key) {
        case 'nsold':     return soldByQ.map(b => b.length)                                   // count of closed sales
        case 'nlisted':   return listedByQ.map(b => b.length)                                 // count of new listings
        case 'volume':    return soldByQ.map(b => b.reduce((s, c) => s + (Number(c.sale_price) || 0), 0) / 1e6) // sum $M
        case 'cashshare': return soldByQ.map(b => b.length < 3 ? null : (b.filter(c => !Number(c.loan_amount)).length / b.length) * 100)
        default:          return _MVAL[key] ? medSeries(key) : (MS_METRICS.find(m => m.key === key)?.series || [])
      }
    }
    const today = new Date()
    const ago = days => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
    const soldDated   = pool.filter(c => c.status === 'Sold').map(c => ({ c, d: parseDate(c.sale_date) })).filter(x => x.d)
    const listedDated = pool.map(c => ({ c, d: parseDate(c.listing_date) })).filter(x => x.d)
    const winSets = {}
    for (const [tf, W] of Object.entries(TF_DAYS)) {
      const t0 = ago(W), p0 = ago(2 * W), y1 = ago(365), y0 = ago(365 + W)
      winSets[tf] = {
        curS: soldDated.filter(x => x.d >= t0 && x.d <= today).map(x => x.c),
        priS: soldDated.filter(x => x.d >= p0 && x.d < t0).map(x => x.c),    // half-open
        yoyS: soldDated.filter(x => x.d >= y0 && x.d < y1).map(x => x.c),    // half-open
        curL: listedDated.filter(x => x.d >= t0 && x.d <= today).map(x => x.c),
        priL: listedDated.filter(x => x.d >= p0 && x.d < t0).map(x => x.c),
        yoyL: listedDated.filter(x => x.d >= y0 && x.d < y1).map(x => x.c),
      }
    }
    function val(key, soldSet, listedSet) {
      switch (key) {
        case 'nsold':     return soldSet.length
        case 'nlisted':   return listedSet.length
        case 'volume':    return soldSet.reduce((s, c) => s + (Number(c.sale_price) || 0), 0) / 1e6
        case 'cashshare': return soldSet.length ? (soldSet.filter(c => !Number(c.loan_amount)).length / soldSet.length) * 100 : null
        default:          return _MVAL[key] ? _median(soldSet.map(_MVAL[key])) : null
      }
    }
    const winFor = (key, tf) => {
      const s = winSets[tf]
      return { cur: val(key, s.curS, s.curL), prior: val(key, s.priS, s.priL), yoy: val(key, s.yoyS, s.yoyL), n: s.curS.length }
    }
    // ask-side analogues (listing-price formulas over the same sold pool)
    const askSeriesFor = key => _AVAL[key] ? soldByQ.map(b => (b.length < 3 ? null : _median(b.map(_AVAL[key])))) : null
    const askWinCur = (key, tf) => _AVAL[key] ? _median(winSets[tf].curS.map(_AVAL[key])) : null
    return { seriesFor, winFor, askSeriesFor, askWinCur }
  }

  const eng = makeEngine(scoped)

  /* ---- Split-comparison cohorts — REAL pools, not factor multipliers ----
     cash/buyer partition the filtered pool; the geo/era splits re-run the
     filter set with exactly that one dimension widened, so the comparison is
     always "this filter vs the broader slice it sits inside". */
  // geography actually present in the filtered slice (drives the geo cohorts)
  const geoCounties = new Set(scoped.map(c => c.property_county).filter(Boolean))
  const geoSubMkts  = new Set(scoped.map(c => c.sub_market).filter(Boolean))
  const prodF = { era: f.era, unitMin: f.unitMin, unitMax: f.unitMax }   // product-type filters only

  const SPLIT_COHORTS = {
    cash: [
      { label: 'All cash', eng: makeEngine(scoped.filter(c => !Number(c.loan_amount))) },
      { label: 'Financed', eng: makeEngine(scoped.filter(c => Number(c.loan_amount) > 0)) },
    ],
    buyer: [
      { label: 'Owner-occ', eng: makeEngine(scoped.filter(c => !!c.owner_occ_purchase)) },
      { label: 'Investor',  eng: makeEngine(scoped.filter(c => !c.owner_occ_purchase)) },
    ],
    // Geo cohorts are INFERRED from the filtered slice, not read off the filter
    // controls: "vs County" = comps in the county/ies the current slice actually
    // sits in (so picking a sub-market compares against ITS county even when the
    // County filter is All), and "vs Sub-market" = the sub-market(s) a zip slice
    // sits in. Product-type filters (era + unit range) are kept so the
    // comparison stays apples-to-apples.
    county:    [{ label: 'County avg',     eng: makeEngine(all.filter(c => geoCounties.has(c.property_county) && inScope(c, prodF))) }],
    submarket: [{ label: 'Sub-market avg', eng: makeEngine(all.filter(c => geoSubMkts.has(c.sub_market) && inScope(c, prodF))) }],
    era:       [{ label: 'All eras',       eng: makeEngine(all.filter(c => inScope(c, { ...f, era: 'All' }))) }],
  }
  const TFS = Object.keys(TF_DAYS)
  const winCurMap = (e, key) => Object.fromEntries(TFS.map(tf => [tf, e.winFor(key, tf).cur]))

  const metrics = MS_METRICS.map(m => {
    const out = { ...m, series: eng.seriesFor(m.key) }
    out.win = {}
    for (const tf of TFS) out.win[tf] = eng.winFor(m.key, tf)
    // real comparison data per split; presence of out.split (even empty) tells
    // msCompSeries/msCompBars that real data is loaded — no factor fallbacks
    out.split = {}
    const askSeries = eng.askSeriesFor(m.key)
    if (askSeries) {
      out.ask = askSeries
      out.split.asksold = {
        series: askSeries,
        cohorts: [{ label: 'Asking', win: Object.fromEntries(TFS.map(tf => [tf, eng.askWinCur(m.key, tf)])) }],
      }
    }
    for (const [sk, cohorts] of Object.entries(SPLIT_COHORTS)) {
      out.split[sk] = {
        series:  cohorts[0].eng.seriesFor(m.key),   // chart overlay = first cohort
        cohorts: cohorts.map(ch => ({ label: ch.label, win: winCurMap(ch.eng, m.key) })),
      }
    }
    return out
  })

  // ---- "Right now" stats — current Active / Under-Contract pools + months of supply ----
  // Point-in-time on CURRENT status; computed from the SAME scoped pool as the sold metrics,
  // so they respond to every scope filter (county / sub-market / zip / era / unit range).
  // Asking-based pricing uses listing_price (these haven't sold yet), guarded by the same
  // exclusion flags as the sold formulas.
  const _ask_ppu = scaled(askPriceUnit, 1 / 1000)   // $k/unit (display scaling)
  const _ask_cap = scaled(askCap, 100)              // decimal → % (display scaling)
  const _ask_grm = askGRM

  const activePool = scoped.filter(c => c.status === 'Active')
  // data uses "Under Contract" — there is no literal "Pending" status (spec §D)
  const ucPool     = scoped.filter(c => isUnderContract(c.status))

  const active = {
    count: activePool.length,
    ppu:   _median(activePool.map(_ask_ppu)),
    cap:   _median(activePool.map(_ask_cap)),
    grm:   _median(activePool.map(_ask_grm)),
    dom:   _median(activePool.map(_activeDom)),
  }
  const uc = {
    count:    ucPool.length,
    ppu:      _median(ucPool.map(_ask_ppu)),
    cap:      _median(ucPool.map(_ask_cap)),
    grm:      _median(ucPool.map(_ask_grm)),
    daysToUC: _median(ucPool.map(daysToUC)),
  }

  // Months of supply = current active inventory ÷ monthly sold pace over the trailing 12 months.
  const _now = new Date()
  const _yearAgo = new Date(_now.getFullYear() - 1, _now.getMonth(), _now.getDate())
  const soldLast12 = scoped.filter(c => { if (c.status !== 'Sold') return false; const d = parseDate(c.sale_date); return d && d >= _yearAgo && d <= _now }).length
  const monthlyPace = soldLast12 / 12
  const monthsOfInventory = monthlyPace > 0 ? active.count / monthlyPace : null

  const now = { active, uc, monthsOfInventory, matchedCount: scoped.length }

  // Distinct filter option lists from the UNFILTERED pool (so options never disappear when a
  // filter is applied). Used to populate the Sub-Market dropdown and the Zip type-ahead.
  const _uniqSorted = arr => Array.from(new Set(arr.filter(v => v != null && String(v).trim() !== '').map(String))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const options = {
    subMarkets: _uniqSorted(all.map(c => c.sub_market)),
    zips:       _uniqSorted(all.map(c => c.zip_code)),
  }

  return { metrics, now, options }
}
