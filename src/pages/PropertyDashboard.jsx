import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ── Code maps (mirror Financials.jsx) ────────────────────────────────────────
const INCOME_GROUP_DETAIL = {
  collected_rent:['collected_rent'],
  rubs:['rubs_electric','rubs_water_sewer','rubs_gas','rubs_trash','rubs_combined'],
  parking:['park_parking'],
  storage:['storage_income'],
  other_income:['oi_tenant_chargeback','oi_application_fees','oi_insurance_services',
                'oi_deposit_forfeit','oi_interest','oi_late_charges','oi_nsf_fees',
                'oi_laundry','oi_pet_rent','oi_misc'],
}
const EXPENSE_GROUP_DETAIL = {
  administrative:['admin_licenses','admin_collection','admin_dues','admin_postage',
                  'admin_bank','admin_onboarding','admin_supplies'],
  property_taxes:['ptax_property'],
  other_taxes:['otax_state_local','otax_other'],
  insurance:['ins_property'],
  utilities:['uti_electric','uti_electric_vacant','uti_water_sewer','uti_gas','uti_trash','uti_combined'],
  property_mgmt:['pm_mgmt_fees','pm_lease_up','pm_misc_fees'],
  repairs_maintenance:['rm_general_maint','rm_general_repair','rm_cleaning','rm_supplies',
                       'rm_painting','rm_hvac','rm_plumbing','rm_appliance','rm_labor','rm_pest','rm_misc'],
  landscaping:['land_landscaping'],
  turnover:['turn_misc'],
  capital_reserves:['capres_reserves'],
  security:['sec_security'],
  contract_services:['conserv_services'],
  advertising:['mark_leasing','mark_advertising','mark_internet'],
  payroll:['pay_payroll'],
  misc:['misc_expenses'],
}
const INCOME_SOURCES = ['Stated','T-12','Last Year','Scheduled','Stabilized','Market']

// ── Math helpers ─────────────────────────────────────────────────────────────
function pmtCalc(ratePct, amortYrs, loanAmt) {
  const r = Number(ratePct)/100/12, n = Number(amortYrs)*12, P = Number(loanAmt)
  if (!r || !n || !P) return 0
  return P * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)
}
function loanBalance(ratePct, amortYrs, loanAmt, yrsElapsed) {
  const r = Number(ratePct)/100/12, n = Number(amortYrs)*12, k = Number(yrsElapsed)*12, P = Number(loanAmt)
  if (!r || !n || !P) return P * Math.max(0, 1-k/n)
  return P * (Math.pow(1+r,n)-Math.pow(1+r,k)) / (Math.pow(1+r,n)-1)
}
function annDSF(ratePct, amortYrs) {
  const r = Number(ratePct)/100/12, n = Number(amortYrs)*12
  if (!r || !n) return 0
  return 12 * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)
}
function irrCalc(cfs) {
  if (cfs.length < 2) return null
  let r = 0.1
  for (let i = 0; i < 200; i++) {
    const npv  = cfs.reduce((s,c,t) => s + c/Math.pow(1+r,t), 0)
    const dnpv = cfs.reduce((s,c,t) => s - t*c/Math.pow(1+r,t+1), 0)
    if (Math.abs(dnpv) < 1e-12) break
    const nr = r - npv/dnpv
    if (Math.abs(nr-r) < 0.00001) return nr
    r = Math.min(Math.max(nr,-0.99),10)
  }
  return r
}
function roundTo5k(v) { return Math.round(v/5000)*5000 }
function nv(v, fb=0) { const x=Number(v); return isNaN(x)?fb:x }

// ── Format helpers ────────────────────────────────────────────────────────────
const fmtC  = v => { const x=nv(v); if(!x) return '—'; return (x<0?'-$':'$')+Math.abs(Math.round(x)).toLocaleString() }
const fmtP  = v => { const x=nv(v); if(!x) return '—'; return (x*100).toFixed(2)+'%' }
const fmtN  = v => { const x=nv(v); if(!x) return '—'; return x.toFixed(2) }
const fmtX  = v => { const x=nv(v); if(!x) return '—'; return x.toFixed(2)+'x' }
const dc    = v => !v||isNaN(v)?'#888':v>=1.25?'#27500A':v>=1.0?'#633806':'#791F1F'
// DSCR → token class (mirrors dc() thresholds; presentational only)
const dscrCls = v => (!v||isNaN(v)) ? '' : v>=1.25 ? 'ok' : v>=1.0 ? 'warn' : 'bad'

// Parse a sale date string in any common format → timestamp (ms), or null
function parseSaleDate(str) {
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str).getTime()
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[1]-1, +m[2]).getTime()
  return new Date(str).getTime() || null
}

// Compute median stats for a set of comps — mirrors CompAnalysis exact computation
// x_noi / x_agi are EXCLUSION FLAGS (boolean 1/0), not dollar values — must check !x_noi/!x_agi first
function geoStats(comps) {
  if (!comps.length) return null
  function median(arr) { const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 }
  const pu = comps.filter(c => c.sale_price && c.num_units  > 0).map(c => nv(c.sale_price)/nv(c.num_units))
  const ps = comps.filter(c => c.sale_price && c.building_sf > 0).map(c => nv(c.sale_price)/nv(c.building_sf))
  // Cap rate: exclude if x_noi flag is set, require positive adv_noi
  const cp = comps.filter(c => !c.x_noi && nv(c.adv_noi) > 0 && c.sale_price).map(c => nv(c.adv_noi)/nv(c.sale_price))
  // GRM: exclude if x_agi flag is set, require positive adv_agi
  const gr = comps.filter(c => !c.x_agi && nv(c.adv_agi) > 0 && c.sale_price).map(c => nv(c.sale_price)/nv(c.adv_agi))
  return {
    count:   comps.length,
    perUnit: pu.length ? median(pu) : null,
    perSF:   ps.length ? median(ps) : null,
    capRate: cp.length ? median(cp) : null,
    grm:     gr.length ? median(gr) : null,
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Class-based styling (token reskin). Amber = editable, plain = computed.
const card = 'uw-card'
const sHdr = 'uw-card-head'
const inp  = 'uw-input'
const ro   = 'uw-ro'
// Required field className — amber base, warn border when empty (unchanged logic)
const reqInp = (val) => (val != null && val !== '' && val !== 0) ? 'uw-input' : 'uw-input is-empty'

function KV({ label, value, bold, color }) {
  const empty = !value || value === '—'
  return (
    <div className="uw-kv">
      <span className="uw-kv-l">{label}</span>
      <span className="uw-kv-v" style={{ ...(bold ? { fontWeight: 700 } : {}), ...(color ? { color } : empty ? { color: 'var(--mute-2)' } : {}) }}>{value || '—'}</span>
    </div>
  )
}

export default function PropertyDashboard({ proposal, benchStats, benchDateRange, onBenchDateRangeChange, opModel, onOpModelRefresh, onDashSaved, view = 'all' }) {
  const [dash,       setDash]       = useState({})
  const [finRow,     setFinRow]     = useState(null)
  const [rrUnits,    setRrUnits]    = useState([])
  const [defs,       setDefs]       = useState({})
  const [benchComps, setBenchComps] = useState([])
  // benchDateRange and benchStats are lifted from CompAnalysis via ProposalDetail
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')

  const pr = proposal.properties || {}

  // Split into Pricing / Acquisition Model tabs (§4b). One mounted instance serves
  // both views (shared dash state, no recompute) — gate which section groups render.
  const showPricing = view === 'pricing' || view === 'all'
  const showAcq     = view === 'acquisition' || view === 'all'

  useEffect(() => { loadData() }, [proposal.id])

  async function loadData() {
    setLoading(true)
    try {
      const [dRes, fRes, rRes, sRes] = await Promise.all([
        supabase.from('proposal_dashboard').select('*').eq('proposal_id',proposal.id).maybeSingle(),
        supabase.from('proposal_financials').select('*').eq('proposal_id',proposal.id).maybeSingle(),
        supabase.from('rent_roll_units').select('*').eq('proposal_id',proposal.id),
        supabase.from('app_settings').select('*').eq('key','growth_assumptions').maybeSingle(),
      ])
      if (dRes.error) console.warn('dashboard:', dRes.error.message)
      if (fRes.error) console.warn('financials:', fRes.error.message)
      if (rRes.error) console.warn('rent_roll:', rRes.error.message)
      // Comps loaded by CompAnalysis; bench stats passed in via props — no comp loading here

      const loadedDash  = dRes.data?.data || {}

      // Pricing target auto-fill now handled via useEffect watching benchStats prop

      setDash(loadedDash)
      setFinRow(fRes.data)
      setRrUnits(rRes.data || [])
      if (sRes.data?.value) setDefs(sRes.data.value)

    } catch(e) { console.error('PropertyDashboard load:', e) }
    finally { setLoading(false) }
  }

  // Auto-fill pricing targets from bench stats when they first arrive from CompAnalysis
  useEffect(() => {
    if (!benchStats || !benchStats.length) return
    setDash(prev => {
      const existPT = prev.pricing_targets || {}
      const needsFill = !existPT.target_per_unit || !existPT.target_per_sf ||
                        !existPT.target_cap_rate || !existPT.target_grm ||
                        !existPT.target_dscr     || !existPT.target_return_pct
      if (!needsFill) return prev
      // Use MSA column (first) as reference for defaults
      const msaCol = benchStats.find(c => c.label === 'Market / MSA') || benchStats[0]
      const updates = {}
      if (!existPT.target_per_unit  && msaCol.ppu  > 0) updates.target_per_unit  = String(Math.round(msaCol.ppu))
      if (!existPT.target_per_sf    && msaCol.psf  > 0) updates.target_per_sf    = msaCol.psf.toFixed(0)
      if (!existPT.target_cap_rate  && msaCol.cap  > 0) updates.target_cap_rate  = (msaCol.cap * 100).toFixed(2)
      if (!existPT.target_grm       && msaCol.grm  > 0) updates.target_grm       = msaCol.grm.toFixed(2)
      if (!existPT.target_dscr)       updates.target_dscr       = '1.25'
      if (!existPT.target_return_pct) updates.target_return_pct = '10'
      if (!Object.keys(updates).length) return prev
      return { ...prev, pricing_targets: { ...existPT, ...updates } }
    })
  }, [benchStats])

  async function upsertDash(dataObj) {
    const { data:ex } = await supabase.from('proposal_dashboard').select('id').eq('proposal_id',proposal.id).maybeSingle()
    if (ex) await supabase.from('proposal_dashboard').update({ data:dataObj }).eq('proposal_id',proposal.id)
    else    await supabase.from('proposal_dashboard').insert({ proposal_id:proposal.id, data:dataObj })
  }

  async function save() {
    setSaving(true)
    await upsertDash(dash)
    setSaving(false); setMsg('Saved'); setTimeout(() => setMsg(''), 2500)
    if (onDashSaved) onDashSaved()  // recompute operating model with updated exit year etc.
  }
  async function handleIncomeSourceChange(src) {
    const nd = { ...dash, income_source:src }
    setDash(nd)
    await upsertDash(nd).catch(() => {})
  }

  const setD   = (k,v) => setDash(p => ({ ...p, [k]:v }))
  const setAcq = (k,v) => setDash(p => ({ ...p, acquisition:{...(p.acquisition||{}),[k]:v} }))
  const setPT  = (k,v) => setDash(p => ({ ...p, pricing_targets:{...(p.pricing_targets||{}),[k]:v} }))
  const setMP  = (k,v) => setDash(p => ({ ...p, market_pricing:{...(p.market_pricing||{}),[k]:v} }))
  const setRefi= (k,v) => setDash(p => ({ ...p, refinance:{...(p.refinance||{}),[k]:v} }))
  const setIR  = (k,v) => setDash(p => ({ ...p, inv_returns:{...(p.inv_returns||{}),[k]:v} }))

  // ── Growth assumptions ──────────────────────────────────────────────────────
  function ga(code) {
    const ov = finRow?.growth_assumptions?.[code]
    return ov!=null&&ov!=='' ? nv(ov) : nv(defs[code])
  }

  // ── T-12 (with group fallback) ──────────────────────────────────────────────
  const t12M = Object.values(finRow?.t12_monthly || {})
  const t12c = code => t12M.reduce((s,m) => s+nv(m?.[code]), 0)
  const t12gs= (grp,codes) => { const ds=codes.reduce((s,c) => s+t12c(c),0); return ds!==0?ds:t12c(grp) }
  const t12RawGross = Object.entries(INCOME_GROUP_DETAIL).reduce((s,[g,cs]) => s+t12gs(g,cs), 0)
  const t12Collected = t12gs('collected_rent',['collected_rent'])
  const t12EGR = t12RawGross - t12Collected*ga('vacancy_rate') - t12Collected*ga('concessions_pct')
  const t12Exp = Object.entries(EXPENSE_GROUP_DETAIL).reduce((s,[g,cs]) => s+t12gs(g,cs), 0)

  // ── Last Year ───────────────────────────────────────────────────────────────
  const lyIS = finRow?.income_statement?.[String(new Date().getFullYear()-1)] || {}
  const lyGross = Object.entries(INCOME_GROUP_DETAIL).reduce((s,[g,cs]) => { const d=cs.reduce((a,c)=>a+nv(lyIS[c]),0); return s+(d!==0?d:nv(lyIS[g])) }, 0)
  const lyExp   = Object.entries(EXPENSE_GROUP_DETAIL).reduce((s,[g,cs]) => { const d=cs.reduce((a,c)=>a+nv(lyIS[c]),0); return s+(d!==0?d:nv(lyIS[g])) }, 0)

  // ── Projection engine ───────────────────────────────────────────────────────
  const totalUnits = rrUnits.length || nv(pr.total_units)
  const rrActual   = rrUnits.reduce((s,u) => s+nv(u.actual_rent),0)*12
  const rrMarket   = rrUnits.reduce((s,u) => s+nv(u.market_rent),0)*12
  const rrRubs     = rrUnits.reduce((s,u) => s+nv(u.current_rubs),0)*12
  const rrMktRubs  = rrUnits.reduce((s,u) => s+nv(u.market_rubs),0)*12

  function projGross(period) {
    const ey = period==='market'?2:period==='stabilized'?1:0
    const base = period==='scheduled'?rrActual:period==='stabilized'?rrMarket:rrMarket*(1+ga('market_rent_growth'))
    const rubs = period==='scheduled'?rrRubs:rrMktRubs
    const park = t12gs('parking',['park_parking'])*(1+ga('parking_growth'))
    const stor = t12gs('storage',['storage_income'])*(1+ga('storage_growth'))
    const oi   = t12gs('other_income',INCOME_GROUP_DETAIL.other_income)*Math.pow(1+ga('other_income_growth'),ey+1)
    return (base+rubs+park+stor+oi) - base*ga('vacancy_rate') - base*ga('concessions_pct')
  }
  function projExp(period) {
    const ey = period==='market'?2:period==='stabilized'?1:0
    const base = period==='scheduled'?rrActual:period==='stabilized'?rrMarket:rrMarket*(1+ga('market_rent_growth'))
    const egr  = base - base*ga('vacancy_rate') - base*ga('concessions_pct')
    let exp = 0
    for (const [grp,codes] of Object.entries(EXPENSE_GROUP_DETAIL)) {
      const v = t12gs(grp,codes)
      if      (grp==='property_taxes')      exp += v*Math.pow(1+ga('property_tax_growth'),ey+1)
      else if (grp==='insurance')           exp += ga('insurance_per_unit')*totalUnits*Math.pow(1+ga('insurance_growth'),ey)
      else if (grp==='utilities')           exp += ga('utilities_per_unit')*totalUnits*Math.pow(1+ga('utilities_growth'),ey)
      else if (grp==='repairs_maintenance') exp += v*Math.pow(1+ga('rm_growth'),ey+1)
      else if (grp==='turnover')            exp += ga('turnover_per_unit')*totalUnits*Math.pow(1+ga('turnover_growth'),ey)
      else if (grp==='capital_reserves')    exp += ga('cap_reserves_per_unit')*totalUnits*Math.pow(1+ga('cap_reserves_growth'),ey)
      else if (grp==='property_mgmt')       exp += egr>0?egr*ga('property_mgmt_pct'):0
      else                                  exp += v*Math.pow(1+ga('controllable_growth'),ey+1)
    }
    return exp
  }

  // ── Source map (compute all, pick best default) ─────────────────────────────
  const allSrcs = {
    Stated:    { gross:nv(dash.stated_income), expenses:nv(dash.stated_expenses), noi:nv(dash.stated_income)-nv(dash.stated_expenses) },
    'T-12':    { gross:t12EGR, expenses:t12Exp, noi:t12EGR-t12Exp },
    'Last Year':{ gross:lyGross||t12EGR, expenses:lyExp||t12Exp, noi:(lyGross||t12EGR)-(lyExp||t12Exp) },
    Scheduled: { gross:projGross('scheduled'),  expenses:projExp('scheduled'),  noi:projGross('scheduled') -projExp('scheduled')  },
    Stabilized:{ gross:projGross('stabilized'), expenses:projExp('stabilized'), noi:projGross('stabilized')-projExp('stabilized') },
    Market:    { gross:projGross('market'),      expenses:projExp('market'),     noi:projGross('market')    -projExp('market')     },
  }
  const autoSrc  = INCOME_SOURCES.find(s => (allSrcs[s]?.noi||0) > 0) || 'Stated'
  const incSrc   = dash.income_source || autoSrc
  const src      = allSrcs[incSrc] || allSrcs.Stated
  const srcNOI   = src.noi, srcGross = src.gross, srcExp = src.expenses

  // ── Acquisition parameters ──────────────────────────────────────────────────
  const acq         = dash.acquisition       || {}
  const pt          = dash.pricing_targets   || {}
  const mp          = dash.market_pricing    || {}
  const refi        = dash.refinance         || {}
  const ir          = dash.inv_returns       || {}
  const askPrice    = nv(proposal.asking_price)
  const propUnits   = Math.max(nv(totalUnits), 1)
  const propSF      = Math.max(nv(pr.building_sf), 1)
  const downPct     = nv(acq.down_pmt_pct,      25)   // default 25%
  const ltv         = (100-downPct)/100
  const annRate     = nv(acq.interest_rate,     6.5)  // default 6.5%
  const amortYrs    = nv(acq.amortization,      25)   // default 25yr
  const loanTermYrs = nv(acq.loan_term,         10)   // default 10yr
  const ioPeriod    = nv(acq.io_period,         0)
  const loanFeesPct   = nv(acq.loan_fees_pct,   1)    // default 1%
  const closeCostsPct = nv(acq.closing_costs_pct, 2)  // default 2%
  const acqCostPct    = (downPct/100) + ltv*(loanFeesPct/100) + (closeCostsPct/100)
  const dsFactor      = annDSF(annRate, amortYrs)

  // ── Pricing rows (before selPrice) ─────────────────────────────────────────
  function pricingCalc(price) {
    if (!price || price <= 0) return {}
    const ads = pmtCalc(annRate, amortYrs, price*ltv)*12
    return { price, cap:srcNOI>0?srcNOI/price:null, grm:srcGross>0?price/srcGross:null,
             dscr:ads>0?srcNOI/ads:null, perUnit:price/propUnits, perSF:price/propSF }
  }

  // Target: Return % — cash-on-cash back-calc (works even with dsFactor=0)
  const targetReturnPrice = (() => {
    const tgt = nv(pt.target_return_pct)/100
    if (!tgt || !acqCostPct) return null
    const denom = tgt*acqCostPct + ltv*dsFactor
    return denom > 0 ? srcNOI/denom : null
  })()

  const pricingRows = [
    { label:'Asking price',       key:'asking',          isFixed:true, price:askPrice },
    { label:'Target: Return %',   key:'target_return_pct',  pct:true, val:pt.target_return_pct,  price:targetReturnPrice },
    { label:'Target: $ / unit',   key:'target_per_unit',    dol:true, val:pt.target_per_unit,    price:nv(pt.target_per_unit)?nv(pt.target_per_unit)*propUnits:null },
    { label:'Target: $ / SF',     key:'target_per_sf',      dol:true, val:pt.target_per_sf,      price:nv(pt.target_per_sf)?nv(pt.target_per_sf)*propSF:null },
    { label:'Target: Cap rate %', key:'target_cap_rate',    pct:true, val:pt.target_cap_rate,    price:nv(pt.target_cap_rate)?srcNOI/(nv(pt.target_cap_rate)/100):null },
    { label:'Target: GRM',        key:'target_grm',         num:true, val:pt.target_grm,         price:nv(pt.target_grm)?srcGross*nv(pt.target_grm):null },
    { label:'Target: DSCR',       key:'target_dscr',        num:true, val:pt.target_dscr,        price:(() => { const td=nv(pt.target_dscr); if(!td||!dsFactor||!ltv) return null; return srcNOI/(td*ltv*dsFactor) })() },
  ]

  // ── selPrice: derived from price_source dropdown ────────────────────────────
  const priceSourceKey = acq.price_source || 'asking'
  const selPrice = (() => {
    const row = pricingRows.find(r => r.key === priceSourceKey)
    return row?.price || askPrice || 0
  })()

  // ── Derived acquisition values (all based on selPrice) ─────────────────────
  const loanAmt     = selPrice * ltv
  const downAmt     = selPrice * (downPct/100)
  const loanFeesAmt = loanAmt * (loanFeesPct/100)
  const closeCostAmt= selPrice * (closeCostsPct/100)
  const totalAcq    = downAmt + loanFeesAmt + closeCostAmt
  const moAmort     = pmtCalc(annRate, amortYrs, loanAmt)
  const moIO        = loanAmt>0&&annRate>0 ? loanAmt*(annRate/100/12) : 0
  const annualDS    = moAmort*12


  // ── Market benchmarks — 4-column geo breakdown (geoStats is module-level) ──────────

  // Map CompAnalysis bench stats (passed as prop) into display format.
  // These are computed by CompAnalysis using the exact same logic — no recalculation here.
  const benchData = (() => {
    if (!benchStats || !benchStats.length) return { cols: [], hasAny: false }
    const cols = benchStats.map(col => ({
      label: col.label,
      stats: col.count > 0 ? {
        count:   col.count,
        perUnit: col.ppu,
        perSF:   col.psf,
        capRate: col.cap,
        grm:     col.grm,
      } : null,
    }))
    return { cols, hasAny: cols.some(c => c.stats) }
  })()


  // ── Market Pricing Band auto-calc ──────────────────────────────────────────
  function calcBandDefaults() {
    const vp = pricingRows.map(r => r.price).filter(p => p&&p>0)
    if (!vp.length) return
    const minP = Math.min(...vp), maxP = Math.max(...vp)
    const dscrRow = pricingRows.find(r => r.key==='target_dscr')
    const floor = roundTo5k(minP)
    const aggressive = roundTo5k(maxP*0.90)
    const newMP = {
      investor_floor:   floor,
      band_low:         roundTo5k(floor*1.25),
      band_high:        roundTo5k(aggressive*0.90),
      suggested_price:  dscrRow?.price ? roundTo5k(dscrRow.price) : floor,
      aggressive_price: aggressive,
    }
    setDash(p => {
      const updated = { ...p, market_pricing: { ...(p.market_pricing||{}), ...newMP } }
      // Persist immediately so values survive page reload
      upsertDash(updated).catch(() => {})
      return updated
    })
  }

  // Stable price summary for useEffect dependency — avoids inline computation in dep array
  const priceSummary = pricingRows.map(r => Math.round(r.price||0)).join(',')

  // Recompute band defaults whenever pricing rows change
  useEffect(() => {
    const vp = pricingRows.map(r => r.price).filter(p => p&&p>0)
    if (vp.length >= 2) calcBandDefaults()
  }, [priceSummary])

  // ── Investor returns ────────────────────────────────────────────────────────
  const exitYear    = nv(ir.exit_year, 5)
  // going_out_cap entered as whole % (e.g. "8" = 8%) — divide by 100; no default so user must enter
  const goingOutCap = nv(ir.going_out_cap, 0) / 100
  const saleExpPct  = nv(ir.sale_expense, 5) / 100

  // Use operating model annual projections when available; fall back to constant NOI
  const hasOpModel  = opModel?.annualProjections?.length > 0
  const yr1NOI      = hasOpModel ? (opModel.annualProjections[0]?.noi || srcNOI) : srcNOI

  // Sale price = Year(exitYear+1) NOI / going-out cap.
  // annualProjections is 0-indexed: index 0 = Year 1, index exitYear = Year exitYear+1
  const exitNOI = (() => {
    if (hasOpModel) {
      const yr = opModel.annualProjections[exitYear]   // index exitYear = Year exitYear+1
      if (yr?.noi) return yr.noi
    }
    // Fallback: grow srcNOI by market_rent_growth for exitYear+1 years
    const growthRate = nv(defs.market_rent_growth || ga('market_rent_growth'), 0.0325)
    return srcNOI * Math.pow(1 + growthRate, exitYear + 1)
  })()
  const salePrice   = goingOutCap > 0 && exitNOI > 0 ? exitNOI / goingOutCap : 0

  // ── Refi (must come before exit balance / IRR) ────────────────────────────
  const refiEnabled  = refi.enabled === true
  const refiMonth    = nv(refi.refi_month, 60)
  const refiYear     = Math.ceil(refiMonth / 12)
  const refiCapRate  = nv(refi.refi_cap_rate, 0) / 100
  const refiFeesPct  = nv(refi.refi_fees_pct, 1) / 100

  const refiNOI = (() => {
    if (hasOpModel && opModel.annualProjections[refiYear - 1])
      return opModel.annualProjections[refiYear - 1].noi
    return srcNOI * Math.pow(1 + nv(ga('market_rent_growth'), 0.0325), refiYear)
  })()

  const refiValue    = refiCapRate > 0 && refiNOI > 0 ? refiNOI / refiCapRate : selPrice
  const refiLoanLTV  = refiValue * (nv(refi.loan_pct, 75) / 100)
  const refiDSF      = annDSF(nv(refi.interest_rate, 6.5), nv(refi.amortization, 30))
  const refiLoanDSCR = nv(refi.target_dscr) > 0 && refiDSF > 0
    ? refiNOI / (nv(refi.target_dscr) * refiDSF) : Infinity
  const refiLoan     = refiEnabled ? Math.min(refiLoanLTV, refiLoanDSCR === Infinity ? refiLoanLTV : refiLoanDSCR) : 0
  const refiBinding  = refiEnabled && refiLoanDSCR < refiLoanLTV ? 'DSCR' : 'LTV'

  const refiMoAmort  = pmtCalc(nv(refi.interest_rate, 6.5), nv(refi.amortization, 30), refiLoan)
  const refiMoIO     = refiLoan > 0 && nv(refi.interest_rate) > 0 ? refiLoan * (nv(refi.interest_rate) / 100 / 12) : 0
  const refiAnnualDS = refiMoAmort * 12

  const oldBalAtRefi = loanBalance(annRate, amortYrs, loanAmt, refiYear)
  const refiCosts    = refiLoan * refiFeesPct
  const refiProceeds = refiLoan - oldBalAtRefi - refiCosts
  const refiDSCRval  = refiAnnualDS > 0 ? refiNOI / refiAnnualDS : null

  // ── Exit calculations ─────────────────────────────────────────────────────
  const remBal = (() => {
    if (refiEnabled && refiYear <= exitYear)
      return loanBalance(nv(refi.interest_rate, 6.5), nv(refi.amortization, 30), refiLoan, exitYear - refiYear)
    return loanBalance(annRate, amortYrs, loanAmt, exitYear)
  })()
  const netProceeds = salePrice>0 ? salePrice*(1-saleExpPct)-remBal : 0
  const annCF       = yr1NOI - annualDS
  const coc         = totalAcq>0 ? annCF/totalAcq : null

  // Stabilized info from operating model
  const stabMonth   = opModel?.propertyStabilizedMonth
  const stabNOI     = opModel?.stabilizedYear?.noi

  // Helper: debt service for a given year, accounting for refi
  function dsForYear(yr) {
    if (refiEnabled && yr > refiYear) return refiAnnualDS
    return annualDS
  }

  const levIRR = (() => {
    if (!totalAcq||exitYear<1||!salePrice) return null
    const cfs = [-totalAcq]
    for (let yr=1; yr<=exitYear; yr++) {
      const yNOI = hasOpModel ? (opModel.annualProjections[yr-1]?.noi || srcNOI) : srcNOI
      const yDS  = dsForYear(yr)
      let yCF = yNOI - yDS
      if (refiEnabled && yr === refiYear) yCF += refiProceeds
      if (yr === exitYear) yCF += netProceeds
      cfs.push(yCF)
    }
    return irrCalc(cfs)
  })()
  const unlevIRR = (() => {
    if (!selPrice||exitYear<1||!salePrice) return null
    const cfs = [-selPrice]
    for (let yr=1; yr<=exitYear; yr++) {
      const yNOI = hasOpModel ? (opModel.annualProjections[yr-1]?.noi || srcNOI) : srcNOI
      cfs.push(yNOI + (yr===exitYear ? salePrice*(1-saleExpPct) : 0))
    }
    return irrCalc(cfs)
  })()
  const levEM = totalAcq>0&&exitYear>0 ? (() => {
    let totalCF = 0
    for (let yr=1; yr<=exitYear; yr++) {
      const yNOI = hasOpModel ? (opModel.annualProjections[yr-1]?.noi || srcNOI) : srcNOI
      totalCF += yNOI - dsForYear(yr)
      if (refiEnabled && yr === refiYear) totalCF += refiProceeds
    }
    return (totalCF + netProceeds) / totalAcq
  })() : null

  // ── CapEx ──────────────────────────────────────────────────────────────────
  const blankRow  = () => ({ id:Date.now().toString()+Math.random(), label:'', cost:'', month_start:'', month_end:'' })
  const initRows  = () => [blankRow(), blankRow(), blankRow()]
  const vaCapex   = dash.value_add_capex?.length ? dash.value_add_capex  : initRows()
  const resCapex  = dash.reserve_capex?.length   ? dash.reserve_capex    : initRows()
  const vaTotal   = vaCapex .reduce((s,r) => s+nv(r.cost), 0)
  const resTotal  = resCapex.reduce((s,r) => s+nv(r.cost), 0)
  function updCapex(key,idx,field,val) { setDash(p => { const rs=[...(p[key]||[])]; rs[idx]={...rs[idx],[field]:val}; return {...p,[key]:rs} }) }
  function addRow(key)       { setDash(p => ({ ...p, [key]:[...(p[key]||[]), blankRow()] })) }
  function removeRow(key,i)  { setDash(p => ({ ...p, [key]:(p[key]||[]).filter((_,j)=>j!==i) })) }

  if (loading) return <div style={{ padding:'3rem', textAlign:'center', color:'var(--mute)', fontSize:13 }}>Loading dashboard…</div>

  return (
    <div>
      {msg && <div className="uw-msg">{msg}</div>}

      {showPricing && (<>
      {/* ═══ MARKET BENCHMARKS ════════════════════════════════════════════ */}
      <div className={card}>
        <div className="uw-card-head">
          <span>Market Benchmarks {pr.year_built_era ? `— ${pr.year_built_era}` : ''}</span>
          <div className="uw-head-note">
            {benchDateRange >= 99999 ? 'All time'
              : benchDateRange >= 730 ? 'Last 2 years'
              : benchDateRange >= 365 ? 'Last 1 year'
              : benchDateRange >= 180 ? 'Last 6 months'
              : benchDateRange >= 90  ? 'Last 3 months'
              : `Last ${benchDateRange} days`}
            {' · reflects Comp Analysis filters'}
          </div>
        </div>
        {!benchData.hasAny
          ? <div className="uw-empty">No sold comp data available — check Comp Analysis tab filters.</div>
          : <table className="uw-table">
              <thead>
                <tr>
                  <th className="l">Metric</th>
                  {benchData.cols.map(col => (
                    <th key={col.label}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Sold count */}
                <tr>
                  <td className="lbl">Sold count</td>
                  {benchData.cols.map(col => (
                    <td key={col.label} className={col.stats ? '' : 'dim'}>
                      {col.stats ? col.stats.count : '—'}
                    </td>
                  ))}
                </tr>
                {[
                  { label:'$ / Unit',  fmt: s => s.perUnit  ? fmtC(s.perUnit)                  : '—' },
                  { label:'$ / SF',    fmt: s => s.perSF    ? '$'+Math.round(s.perSF).toLocaleString() : '—' },
                  { label:'Cap Rate',  fmt: s => s.capRate  ? fmtP(s.capRate)                    : '—' },
                  { label:'GRM',       fmt: s => s.grm      ? fmtN(s.grm)                      : '—' },
                ].map(({ label, fmt }) => (
                  <tr key={label}>
                    <td className="lbl">{label}</td>
                    {benchData.cols.map(col => (
                      <td key={col.label} className={col.stats ? 'fig' : 'dim'}>
                        {col.stats ? fmt(col.stats) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* ═══ VALUATION SCENARIOS ═════════════════════════════════════════ */}
      <div className={card}>
        <div className={sHdr}>Valuation Scenarios</div>

        {/* Income source inline row (amber = editable source) */}
        <div className="uw-incomerow">
          <div>
            <div className="uw-income-l">Income Source</div>
            <select value={incSrc} onChange={e=>handleIncomeSourceChange(e.target.value)} className="uw-income-select">
              {INCOME_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {[{ label:'Gross Income',val:srcGross },{ label:'Op Ex',val:srcExp },{ label:'NOI',val:srcNOI,bold:true,color:srcNOI>0?'var(--pos)':'var(--neg)' }].map(({ label,val,bold,color }) => (
            <div key={label}>
              <div className="uw-income-l">{label}</div>
              <div className="uw-income-v" style={color ? { color } : undefined}>{fmtC(val)}</div>
            </div>
          ))}
        </div>

        {/* Pricing targets */}
        <div style={{ overflowX:'auto' }}>
          <table className="uw-table">
            <thead><tr>{['Scenario','Target','Price','$/Unit','$/SF','Cap Rate','GRM','DSCR'].map((h,i) => <th key={h} className={i===0?'l':''}>{h}</th>)}</tr></thead>
            <tbody>
              {pricingRows.map(row => {
                const c = pricingCalc(row.price)
                const isSelected = priceSourceKey === row.key
                return (
                  <tr key={row.key} className={(isSelected || row.isFixed) ? 'uw-table-asking' : ''}>
                    <td className="l">{row.label}</td>
                    <td>
                      {row.isFixed
                        ? <span className="uw-muted">{fmtC(askPrice)}</span>
                        : <input type="number" value={row.val||''} onChange={e=>setPT(row.key,e.target.value)}
                            placeholder={row.pct?'0.00':row.dol?'0':'0.00'} className="uw-target-input"/>
                      }
                    </td>
                    <td className="fig">{fmtC(c.price)}</td>
                    <td className="lbl">{fmtC(c.perUnit)}</td>
                    <td className="lbl">{c.perSF?'$'+Math.round(c.perSF).toLocaleString():'—'}</td>
                    <td className="lbl">{fmtP(c.cap)}</td>
                    <td className="lbl">{fmtN(c.grm)}</td>
                    <td className={`uw-dscr ${dscrCls(c.dscr)}`}>{fmtN(c.dscr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="uw-note">* Target: Return % = cash-on-cash back-calculation. Full IRR available after operating model is built.</div>
      </div>
      </>)}

      {showAcq && (<>
      {/* ═══ ACQUISITION DETAILS ════════════════════════════════════════ */}
      <div className={card}>
        <div className={sHdr}>Acquisition Details</div>
        <div className="acq-grid">
          {/* headers */}
          {['','Input / Selection','Computed'].map((h,i) => (
            <div key={i} className={`acq-colhead ${i>0?'r':''}`}>{h}</div>
          ))}

          {/* Close Date */}
          <div className="acq-l">Anticipated close date</div>
          <div className="acq-in"><input type="date" value={acq.close_date||''} onChange={e=>setAcq('close_date',e.target.value)} className={reqInp(acq.close_date) + ' r'}/></div>
          <div className="acq-comp"></div>

          {/* Purchase Price — dropdown */}
          <div className="acq-l">Purchase price</div>
          <div className="acq-in">
            <select value={priceSourceKey} onChange={e=>setAcq('price_source',e.target.value)}
              className="uw-input r">
              {pricingRows.map(row => (
                <option key={row.key} value={row.key} disabled={!row.price}>{row.label}</option>
              ))}
            </select>
          </div>
          <div className="acq-comp strong">{fmtC(selPrice||null)}</div>

          {/* Down Payment */}
          <div className="acq-l">Down payment</div>
          <div className="acq-in">
            <input type="number" value={acq.down_pmt_pct||''} onChange={e=>setAcq('down_pmt_pct',e.target.value)} placeholder="25" className={reqInp(acq.down_pmt_pct) + ' r'}/><span className="acq-unit">%</span>
          </div>
          <div className="acq-comp">{fmtC(downAmt||null)}</div>

          {/* Loan Amount */}
          <div className="acq-l">Loan amount</div>
          <div className="acq-mid">{ltv?(ltv*100).toFixed(0)+'% LTV':''}</div>
          <div className="acq-comp">{fmtC(loanAmt||null)}</div>

          {/* Loan Fees */}
          <div className="acq-l">Loan fees</div>
          <div className="acq-in">
            <input type="number" value={acq.loan_fees_pct||''} onChange={e=>setAcq('loan_fees_pct',e.target.value)} placeholder="1" step="0.25" className="uw-input r"/><span className="acq-unit">%</span>
          </div>
          <div className="acq-comp">{fmtC(loanFeesAmt||null)}</div>

          {/* Closing Costs */}
          <div className="acq-l">Closing costs</div>
          <div className="acq-in">
            <input type="number" value={acq.closing_costs_pct||''} onChange={e=>setAcq('closing_costs_pct',e.target.value)} placeholder="2" step="0.25" className="uw-input r"/><span className="acq-unit">%</span>
          </div>
          <div className="acq-comp">{fmtC(closeCostAmt||null)}</div>

          {/* Total Acq Costs */}
          <div className="acq-l is-total">Total acquisition costs</div>
          <div className="acq-mid is-total">
            {acqCostPct ? (acqCostPct*100).toFixed(2)+'%' : ''}
          </div>
          <div className="acq-comp is-total">{fmtC(totalAcq||null)}</div>
          <div className="acq-spacer"></div>

          {/* Interest Rate */}
          <div className="acq-l">Fixed interest rate</div>
          <div className="acq-in">
            <input type="number" value={acq.interest_rate||''} onChange={e=>setAcq('interest_rate',e.target.value)} placeholder="6.5" step="0.125" className={reqInp(acq.interest_rate) + ' r'}/><span className="acq-unit">% / yr</span>
          </div>
          <div className="acq-mid">Annually</div>

          {/* Amortization */}
          <div className="acq-l">Amortization</div>
          <div className="acq-in">
            <input type="number" value={acq.amortization||''} onChange={e=>setAcq('amortization',e.target.value)} placeholder="25" className={reqInp(acq.amortization) + ' r'}/><span className="acq-unit">Years</span>
          </div>
          <div className="acq-mid">{amortYrs?amortYrs*12+' Months':''}</div>

          {/* Loan Term */}
          <div className="acq-l">Loan term</div>
          <div className="acq-in">
            <input type="number" value={acq.loan_term||''} onChange={e=>setAcq('loan_term',e.target.value)} placeholder="10" className={reqInp(acq.loan_term) + ' r'}/><span className="acq-unit">Years</span>
          </div>
          <div className="acq-mid">{loanTermYrs?loanTermYrs*12+' Months':''}</div>

          {/* I/O Period */}
          <div className="acq-l">Interest-only period</div>
          <div className="acq-in">
            <input type="number" value={acq.io_period||''} onChange={e=>setAcq('io_period',e.target.value)} placeholder="0" className="uw-input r"/><span className="acq-unit">Months</span>
          </div>
          <div className="acq-mid">{ioPeriod?ioPeriod+' Months':'0 Months'}</div>
          <div className="acq-spacer"></div>

          {/* Amortizing Payment */}
          <div className="acq-l">Amortizing payment</div>
          <div className="acq-comp">{fmtC(moAmort||null)} <span className="acq-unit small">/mo</span></div>
          <div className="acq-comp">{fmtC(moAmort?moAmort*12:null)} <span className="acq-unit small">/yr</span></div>

          {/* I/O Payment */}
          <div className="acq-l">Interest-only payment</div>
          <div className="acq-comp">{fmtC(moIO||null)} <span className="acq-unit small">/mo</span></div>
          <div className="acq-comp">{fmtC(moIO?moIO*12:null)} <span className="acq-unit small">/yr</span></div>

          {/* DSCR */}
          {srcNOI>0&&annualDS>0&&<>
            <div className="acq-l is-total">DSCR ({incSrc})</div>
            <div className="acq-mid is-total"></div>
            <div className={`acq-comp is-total uw-dscr ${dscrCls(srcNOI/annualDS)}`}>{fmtN(srcNOI/annualDS)}</div>
          </>}
        </div>
      </div>

      {/* ═══ CAPEX ══════════════════════════════════════════════════════ */}
      <div className="acq-capex-grid">
        {[
          { title:'Value-Add CapEx Assumptions', key:'value_add_capex', rows:vaCapex, total:vaTotal },
          { title:'Reserve / Replacement CapEx',  key:'reserve_capex',   rows:resCapex, total:resTotal },
        ].map(({ title, key, rows:capexRows, total }) => (
          <div key={key} className={card}>
            <div className={sHdr}>{title}</div>
            <table className="uw-table" style={{ marginBottom:8 }}>
              <thead><tr>
                <th className="l">Description</th>
                <th>Cost Est.</th>
                <th>Start Mo.</th>
                <th>End Mo.</th>
                <th></th>
              </tr></thead>
              <tbody>
                {capexRows.map((row,idx) => (
                  <tr key={row.id||idx}>
                    {[['label','text','left'],['cost','number','right'],['month_start','number','center'],['month_end','number','center']].map(([field,type,align]) => (
                      <td key={field} style={{ padding:'3px 2px' }}>
                        <input type={type} value={row[field]||''} placeholder={field==='label'?'Description':field==='cost'?'0':'1'}
                          onChange={e=>updCapex(key,idx,field,e.target.value)}
                          className="uw-capex-input" style={{ textAlign:align }}/>
                      </td>
                    ))}
                    <td style={{ padding:'3px 2px', textAlign:'center' }}>
                      {capexRows.length>1&&<button onClick={()=>removeRow(key,idx)} className="uw-rm">×</button>}
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td className="l" style={{ fontWeight:600 }}>Total</td>
                  <td style={{ fontWeight:700 }}>{fmtC(total)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <button onClick={()=>addRow(key)} className="uw-addrow">+ Add row</button>
          </div>
        ))}
      </div>
      </>)}

      {showPricing && (<>
      {/* ═══ MARKET PRICING BAND ════════════════════════════════════════ */}
      <div className={card}>
        <div className="uw-card-head">
          <span>Market Pricing Band</span>
          <button onClick={calcBandDefaults} className="uw-mini-btn">
            ↻ Reset to defaults
          </button>
        </div>
        <div className="uw-band-grid">
          {[
            { label:'Investor floor price',  key:'investor_floor'   },
            { label:'Market band — low',     key:'band_low'         },
            { label:'Market band — high',    key:'band_high'        },
            { label:'Aggressive list price', key:'aggressive_price' },
            { label:'Suggested list price',  key:'suggested_price'  },
                    ].map(({ label, key }) => (
            <div key={key}>
              <div className="uw-band-l">{label}</div>
              <input type="number" value={mp[key]||''} onChange={e=>setMP(key,e.target.value)} className={inp}/>
              {mp[key] && <div className="uw-band-fig">{fmtC(mp[key])}</div>}
            </div>
          ))}
        </div>
      </div>
      </>)}

      {showAcq && (<>
      {/* ═══ INVESTOR RETURNS ═══════════════════════════════════════════ */}
      <div className={card}>
        <div className={sHdr}>Investor Returns</div>

        {/* Stabilized summary bar — from operating model */}
        {hasOpModel && stabMonth != null && (
          <div className="uw-summary-bar" style={{ marginBottom: refiEnabled?8:16 }}>
            <span className="uw-summary-l">Stabilized</span>
            <span>Month <strong>{stabMonth}</strong></span>
            {stabNOI > 0 && <span>Stabilized NOI <strong style={{color:'var(--pos)'}}>{fmtC(stabNOI)}</strong></span>}
            {stabNOI > 0 && selPrice > 0 && <span>Stabilized cap <strong>{fmtP(stabNOI/selPrice)}</strong></span>}
          </div>
        )}
        {refiEnabled && refiLoan > 0 && (
          <div className="uw-summary-bar accent">
            <span className="uw-summary-l">Refinance</span>
            <span>Year <strong>{refiYear}</strong></span>
            <span>Cash-out <strong style={{color:refiProceeds>=0?'var(--pos)':'var(--neg)'}}>{fmtC(refiProceeds)}</strong></span>
            <span>New DS <strong>{fmtC(refiAnnualDS)}</strong>/yr</span>
            {refiDSCRval && <span>DSCR <strong className={`uw-dscr ${dscrCls(refiDSCRval)}`}>{fmtN(refiDSCRval)}</strong></span>}
          </div>
        )}

        <div className="uw-ir-grid">
          <div>
            <div className="uw-kv-sub">Purchase Summary</div>
            <KV label="Purchase price"          value={fmtC(selPrice||null)} />
            <KV label="Loan amount"             value={fmtC(loanAmt||null)} />
            <KV label="Total acquisition costs" value={fmtC(totalAcq||null)} bold />
            <div style={{ height:12 }}/>
            <div className="uw-kv-sub">
              {hasOpModel ? 'Year 01 — Operating model' : `Year 01 — ${incSrc} (static)`}
            </div>
            <KV label="NOI"                  value={fmtC(yr1NOI||null)} />
            <KV label="Annual debt service"  value={fmtC(annualDS||null)} />
            <KV label="Cash flow"            value={fmtC(annCF||null)} />
            <KV label="Cash-on-Cash return"  value={coc!=null?fmtP(coc):'—'} bold
              color={coc!=null?(coc>=0.08?'var(--pos)':coc>=0.04?'var(--warn)':'var(--neg)'):undefined} />
            <KV label="Going-in cap rate"    value={selPrice&&yr1NOI?fmtP(yr1NOI/selPrice):'—'} />
            {/* Year-by-year NOI table when op model available */}
            {hasOpModel && opModel.annualProjections.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div className="uw-kv-sub">Projected NOI by Year</div>
                <table className="uw-table" style={{ fontSize:11 }}>
                  <thead><tr>
                    <th className="l">Year</th>
                    <th>EGR</th>
                    <th>Expenses</th>
                    <th>NOI</th>
                  </tr></thead>
                  <tbody>
                    {opModel.annualProjections.map((yr, i) => (
                      <tr key={i} className={i === exitYear ? 'exit' : ''}>
                        <td className="l">
                          Yr {yr.year}{i===exitYear?' (exit)':i===exitYear+1?' (sale NOI)':''}
                        </td>
                        <td>{fmtC(yr.egr)}</td>
                        <td className="lbl">{fmtC(yr.expenses)}</td>
                        <td style={{ color:yr.noi>0?'var(--pos)':'var(--neg)' }}>{fmtC(yr.noi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <div className="uw-kv-sub">Exit Assumptions</div>
            <div className="uw-2col">
              <div><div className="uw-band-l">Anticipated exit year</div>
                <input type="number" value={ir.exit_year||''} onChange={e=>setIR('exit_year',e.target.value)} placeholder="5" className={reqInp(ir.exit_year)}/></div>
              <div><div className="uw-band-l">Going-out cap rate %</div>
                <input type="number" value={ir.going_out_cap||''} onChange={e=>setIR('going_out_cap',e.target.value)} placeholder="8.0" step="0.25" className={reqInp(ir.going_out_cap)}/></div>
            </div>
            <div style={{ marginBottom:12 }}><div className="uw-band-l">Sale expense %</div>
              <input type="number" value={ir.sale_expense||''} onChange={e=>setIR('sale_expense',e.target.value)} placeholder="5" step="0.5" className={reqInp(ir.sale_expense)}/></div>
            <KV label={`Year ${exitYear+1} NOI (sale basis)`} value={fmtC(exitNOI||null)} />
            <KV label="Sale price"           value={fmtC(salePrice||null)} />
            <KV label="Remaining loan balance" value={fmtC(remBal||null)} />
            <KV label="Sale proceeds (net)"  value={fmtC(netProceeds||null)} bold />
          </div>
        </div>
        {(levIRR!=null||unlevIRR!=null)&&(
          <div className="uw-stats">
            {[
              { label:'Unlevered IRR',   val:unlevIRR!=null?fmtP(unlevIRR):'—', col:unlevIRR!=null&&unlevIRR>=0.08?'var(--pos)':unlevIRR>=0.05?'var(--warn)':'var(--neg)' },
              { label:'Levered IRR',     val:levIRR!=null?fmtP(levIRR):'—',     col:levIRR!=null&&levIRR>=0.15?'var(--pos)':levIRR>=0.08?'var(--warn)':'var(--neg)' },
              { label:'Equity multiple', val:levEM!=null?fmtX(levEM):'—',       col:levEM!=null&&levEM>=2?'var(--pos)':levEM>=1.5?'var(--warn)':'var(--neg)' },
              { label:'Cash-on-Cash',    val:coc!=null?fmtP(coc):'—',           col:coc!=null&&coc>=0.08?'var(--pos)':coc>=0.04?'var(--warn)':'var(--neg)' },
            ].map(({ label,val,col }) => (
              <div key={label} className="uw-stat">
                <div className="uw-stat-l">{label}</div>
                <div className="uw-stat-v" style={{ color:col }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {!hasOpModel && <div className="uw-note" style={{ marginTop:8 }}>* Add rent roll + growth assumptions to enable operating model projections.</div>}
      </div>

      {/* ═══ REFINANCE ══════════════════════════════════════════════════ */}
      <div className={card}>
        <div className="uw-card-head">
          <span>Refinance Details</span>
          <label className="uw-checkbox-label">
            <span>Include refinance</span>
            <input type="checkbox" checked={refiEnabled} onChange={e=>setRefi('enabled',e.target.checked)} style={{ width:15, height:15, cursor:'pointer' }}/>
          </label>
        </div>
        {!refiEnabled
          ? <div className="uw-empty">Refinance not included in this analysis.</div>
          : <>
              <div className="uw-refi-grid">
                <div className="uw-col">
                  <div className="uw-2col">
                    <div><div className="uw-band-l">Refi month</div>
                      <input type="number" value={refi.refi_month||''} onChange={e=>setRefi('refi_month',e.target.value)} placeholder="60" className={inp}/></div>
                    <div><div className="uw-band-l">Refi cap rate %</div>
                      <input type="number" value={refi.refi_cap_rate||''} onChange={e=>setRefi('refi_cap_rate',e.target.value)} placeholder="6.0" step="0.25" className={reqInp(refi.refi_cap_rate)}/></div>
                  </div>
                  <div className="uw-2col">
                    <div><div className="uw-band-l">Loan LTV %</div>
                      <input type="number" value={refi.loan_pct||''} onChange={e=>setRefi('loan_pct',e.target.value)} placeholder="75" className={inp}/></div>
                    <div><div className="uw-band-l">Target DSCR</div>
                      <input type="number" value={refi.target_dscr||''} onChange={e=>setRefi('target_dscr',e.target.value)} placeholder="1.25" step="0.05" className={inp}/></div>
                  </div>
                  <div><div className="uw-band-l">Refi fees %</div>
                    <input type="number" value={refi.refi_fees_pct||''} onChange={e=>setRefi('refi_fees_pct',e.target.value)} placeholder="1" step="0.25" className={inp}/></div>
                </div>
                <div className="uw-col">
                  <div><div className="uw-band-l">Fixed interest rate %</div>
                    <input type="number" value={refi.interest_rate||''} onChange={e=>setRefi('interest_rate',e.target.value)} placeholder="7.0" step="0.125" className={inp}/></div>
                  <div className="uw-2col">
                    <div><div className="uw-band-l">Amortization (years)</div>
                      <input type="number" value={refi.amortization||''} onChange={e=>setRefi('amortization',e.target.value)} placeholder="30" className={inp}/></div>
                    <div><div className="uw-band-l">Loan term (years)</div>
                      <input type="number" value={refi.loan_term||''} onChange={e=>setRefi('loan_term',e.target.value)} placeholder="10" className={inp}/></div>
                  </div>
                  <KV label="Amortizing payment / month" value={fmtC(refiMoAmort||null)} />
                  <KV label="Amortizing payment / year"  value={fmtC(refiMoAmort?refiMoAmort*12:null)} bold/>
                  <KV label="I/O payment / month"        value={fmtC(refiMoIO||null)}/>
                </div>
              </div>
              <div className="uw-stats c5">
                {[
                  { label:'Appraised value', val:fmtC(refiValue||null) },
                  { label:`Refi loan (${refiBinding})`, val:fmtC(refiLoan||null) },
                  { label:'Cash-out proceeds', val:fmtC(refiProceeds), col:refiProceeds>=0?'var(--pos)':'var(--neg)' },
                  { label:'Refi DSCR', val:refiDSCRval?fmtN(refiDSCRval):'—', col:refiDSCRval?(refiDSCRval>=1.25?'var(--pos)':refiDSCRval>=1.0?'var(--warn)':'var(--neg)'):undefined },
                  { label:'NOI at refi', val:fmtC(refiNOI||null) },
                ].map(({ label,val,col }) => (
                  <div key={label} className="uw-stat">
                    <div className="uw-stat-l">{label}</div>
                    <div className="uw-stat-v" style={col ? { color:col } : undefined}>{val}</div>
                  </div>
                ))}
              </div>
            </>
        }
      </div>
      </>)}

      <div style={{ display:'flex', justifyContent:'flex-end', paddingBottom:32 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving?'Saving…':'Save dashboard'}
        </button>
      </div>
    </div>
  )
}