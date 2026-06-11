/* ============================================================
   COMP CALCULATION VALIDATION SUITE
   ------------------------------------------------------------
   Golden-fixture tests per docs/Comp_Calculation_Validation_Spec.md.
   Run: npm test   (node --test; no framework required)

   - per_row_cases: feed fixture inputs to src/utils/compMetrics.js,
     assert exact/1e-6-tolerance equality. expected_is_null → must be
     null (never 0).
   - aggregate_scenarios: fetch the live comps table (anon key from
     .env.local), apply the scenario filters with the PINNED as_of
     date, assert every aggregate. Skipped if .env.local is absent.
   - Pending/Under-Contract bucket: asserts the UC bucket is non-zero
     on real data (the literal status "Pending" does not exist).
   ============================================================ */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  askPriceUnit, soldPriceUnit, askPriceSF, soldPriceSF,
  askCap, soldCap, askGRM, soldGRM,
  daysToUC, escrowLength, totalDOM, askToSold,
  median, isUnderContract, computeAggregates, windowStart, parseDate,
} from '../src/utils/compMetrics.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/comp_validation_fixtures.json'), 'utf8'))

// fixture input names → app comp-row column names
function toComp(inputs) {
  const c = { ...inputs }
  if ('units' in c) { c.num_units = c.units; delete c.units }
  if ('noi' in c)   { c.adv_noi = c.noi; delete c.noi }
  if ('agi' in c)   { c.adv_agi = c.agi; delete c.agi }
  return c
}

const METRIC_FN = {
  AskPriceUnit:     askPriceUnit,
  SoldPriceUnit:    soldPriceUnit,
  AskPriceSF:       askPriceSF,
  SoldPriceSF:      soldPriceSF,
  AskCap:           askCap,
  SoldCap:          soldCap,
  AskGRM:           askGRM,
  SoldGRM:          soldGRM,
  PENDaysToUC:      daysToUC,
  SoldDaysToUC:     daysToUC,   // identical formula per spec §5 — does NOT use sale_date
  SoldEscrowLength: escrowLength,
  SoldTotalDOM:     totalDOM,
  AskToSold:        askToSold,
}
const DAY_METRICS = new Set(['PENDaysToUC', 'SoldDaysToUC', 'SoldEscrowLength', 'SoldTotalDOM'])
const TOL = 1e-6

/* ---- A. per-row golden cases ---- */
for (const tc of fixtures.per_row_cases) {
  test(`per-row ${tc.metric} (row ${tc.source_row})`, () => {
    const fn = METRIC_FN[tc.metric]
    assert.ok(fn, `no metric fn mapped for ${tc.metric}`)
    const actual = fn(toComp(tc.inputs))
    if (tc.expected_is_null) {
      assert.strictEqual(actual, null, `expected null, got ${actual} (must be null, NOT 0)`)
    } else if (DAY_METRICS.has(tc.metric)) {
      assert.strictEqual(actual, tc.expected, 'day counts must match exactly (integer)')
    } else {
      assert.ok(Math.abs(actual - tc.expected) < TOL, `expected ${tc.expected}, got ${actual}`)
    }
  })
}

/* ---- B. spec identities ---- */
test('identity: SoldTotalDOM = SoldDaysToUC + SoldEscrowLength', () => {
  const c = { listing_date: '2017-02-15', pending_date: '2017-03-13', sale_date: '2017-04-04' }
  assert.strictEqual(totalDOM(c), daysToUC(c) + escrowLength(c))
  assert.strictEqual(totalDOM(c), 48)
})
test('median: even-count set averages the two middle values (Excel MEDIAN)', () => {
  assert.strictEqual(median([1, 2, 3, 4]), 2.5)
  assert.strictEqual(median([5, 1, 3]), 3)
  assert.strictEqual(median([null, 2, undefined, 4]), 3) // nulls excluded, not zeros
  assert.strictEqual(median([]), null)
})
test('missing inputs → null, never 0', () => {
  assert.strictEqual(soldPriceUnit({ sale_price: null, num_units: 4 }), null)
  assert.strictEqual(soldPriceUnit({ sale_price: 0, num_units: 4 }), null)
  assert.strictEqual(soldCap({ adv_noi: 10000, sale_price: null, x_noi: false }), null)
  assert.strictEqual(askToSold({ sale_price: 100, original_listing_price: null }), null)
  assert.strictEqual(daysToUC({ listing_date: '2024-01-01', pending_date: null }), null)
})
test('exclusion flags suppress income metrics', () => {
  assert.strictEqual(soldCap({ adv_noi: 10000, sale_price: 200000, x_noi: true }), null)
  assert.strictEqual(soldGRM({ adv_agi: 20000, sale_price: 200000, x_agi: true }), null)
  // decimals, not percent
  assert.ok(Math.abs(soldCap({ adv_noi: 10000, sale_price: 200000, x_noi: false }) - 0.05) < TOL)
})
test('AskToSold uses ORIGINAL listing price, not current', () => {
  const c = { sale_price: 198400, original_listing_price: 199900, listing_price: 150000 }
  assert.ok(Math.abs(askToSold(c) - 0.992496248124062) < TOL)
})
test('window math: windowStart derives the fixture window_start dates', () => {
  for (const sc of fixtures.aggregate_scenarios) {
    const got = windowStart(sc.as_of, sc.window_days)
    const want = parseDate(sc.window_start)
    assert.strictEqual(got.getTime(), want.getTime(), `${sc.name}: ${got} != ${want}`)
  }
})

/* ---- C. aggregate scenarios against the live comps table ---- */
function loadEnv() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return null
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env.VITE_SUPABASE_URL && env.VITE_SUPABASE_KEY ? env : null
}

async function fetchAllComps(env) {
  const COLS = 'status,property_county,sub_market,zip_code,year_built_era,num_units,sale_price,listing_price,original_listing_price,building_sf,adv_noi,adv_agi,x_noi,x_agi,listing_date,pending_date,sale_date'
  let all = [], from = 0
  const PAGE = 1000
  while (true) {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/comps?select=${COLS}&order=id.asc`, {
      headers: { apikey: env.VITE_SUPABASE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_KEY}`, Range: `${from}-${from + PAGE - 1}` },
    })
    if (!res.ok) throw new Error(`comps fetch ${res.status}`)
    const page = await res.json()
    all = all.concat(page)
    if (page.length < PAGE) break
    from += PAGE
  }
  return all
}

const env = loadEnv()
const compsPromise = env ? fetchAllComps(env) : null

for (const sc of fixtures.aggregate_scenarios) {
  test(`aggregate ${sc.name}`, { skip: !env && '.env.local not found' }, async () => {
    const comps = await compsPromise
    const got = computeAggregates(comps, {
      asOf: sc.as_of,                       // pinned — never the real current date
      windowDays: sc.window_days,
      filters: {
        status: sc.filters.status,
        county: sc.filters.county,
        subMarket: sc.filters.sub_market,
        zip: sc.filters.zip,
        unitMin: sc.filters.unit_min,
        unitMax: sc.filters.unit_max,
        era: sc.filters.ybe,
      },
    })
    const errs = []
    for (const [key, want] of Object.entries(sc.expected)) {
      const have = got[key]
      const exact = key === 'sold_count' || key === 'sale_volume_sum'
      const ok = exact ? have === want : (have != null && Math.abs(have - want) < TOL)
      if (!ok) errs.push(`  ${key}: expected ${want}, got ${have}`)
    }
    assert.ok(errs.length === 0, `${sc.name} mismatches:\n${errs.join('\n')}`)
  })
}

/* ---- D. Pending / Under-Contract bucket (known bug) ---- */
test('UC bucket: status "Under Contract" is matched and non-zero', { skip: !env && '.env.local not found' }, async () => {
  const comps = await compsPromise
  // the literal status "Pending" does not exist in the data
  const literalPending = comps.filter(c => c.status === 'Pending').length
  const uc = comps.filter(c => isUnderContract(c.status))
  assert.strictEqual(literalPending, 0, 'data should contain no literal "Pending" status')
  assert.ok(uc.length > 0, `Under Contract bucket must be non-zero (got ${uc.length})`)
  // and for a real filter set (Multnomah county) it must also be non-zero
  const mult = uc.filter(c => c.property_county === 'Multnomah')
  assert.ok(mult.length > 0, `Multnomah Under Contract count must be non-zero (got ${mult.length})`)
})
