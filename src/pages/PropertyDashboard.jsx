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
const card = { background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.25rem', marginBottom:16 }
const sHdr = { fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'0.75rem', paddingBottom:6, borderBottom:'0.5px solid rgba(0,0,0,0.08)' }
const inp  = { width:'100%', padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:12, boxSizing:'border-box', background:'#fff' }
const ro   = { padding:'7px 10px', border:'0.5px solid #eee', borderRadius:8, fontSize:12, background:'#f9f9f9', color:'#111', minHeight:34 }

function KV({ label, value, bold, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
      <span style={{ color:'#888', fontSize:12 }}>{label}</span>
      <span style={{ fontWeight:bold?600:400, fontSize:12, color:color||((value&&value!=='—')?'#111':'#ccc') }}>{value||'—'}</span>
    </div>
  )
}

export default function PropertyDashboard({ proposal, benchStats, benchDateRange, onBenchDateRangeChange }) {
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
  const downPct     = nv(acq.down_pmt_pct, 25)
  const ltv         = (100-downPct)/100
  const annRate     = nv(acq.interest_rate)
  const amortYrs    = nv(acq.amortization, 25)
  const loanTermYrs = nv(acq.loan_term, 10)
  const ioPeriod    = nv(acq.io_period)
  const loanFeesPct   = nv(acq.loan_fees_pct)
  const closeCostsPct = nv(acq.closing_costs_pct)
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
    setDash(p => ({
      ...p, market_pricing:{
        ...(p.market_pricing||{}),
        investor_floor:   floor,
        band_low:         roundTo5k(floor*1.25),
        band_high:        roundTo5k(aggressive*0.90),
        suggested_price:  dscrRow?.price ? roundTo5k(dscrRow.price) : floor,
        aggressive_price: aggressive,
      }
    }))
  }

  // Auto-fill band if it's empty and we have pricing data
  // Always recompute band defaults from pricing rows so stored keys are never stale
  useEffect(() => {
    const vp = pricingRows.map(r => r.price).filter(p => p&&p>0)
    if (vp.length >= 2) calcBandDefaults()
  }, [pricingRows.map(r => r.price).join(','), proposal.id])

  // ── Investor returns ────────────────────────────────────────────────────────
  const exitYear    = nv(ir.exit_year, 5)
  const goingOutCap = nv(ir.going_out_cap)/100
  const saleExpPct  = nv(ir.sale_expense, 5)/100
  const salePrice   = goingOutCap>0 ? srcNOI/goingOutCap : 0
  const remBal      = loanBalance(annRate, amortYrs, loanAmt, exitYear)
  const netProceeds = salePrice>0 ? salePrice*(1-saleExpPct)-remBal : 0
  const annCF       = srcNOI-annualDS
  const coc         = totalAcq>0 ? annCF/totalAcq : null

  const levIRR = (() => {
    if (!totalAcq||exitYear<1||!salePrice) return null
    const cfs = [-totalAcq]
    for (let yr=1; yr<=exitYear; yr++) cfs.push(annCF+(yr===exitYear?netProceeds:0))
    return irrCalc(cfs)
  })()
  const unlevIRR = (() => {
    if (!selPrice||exitYear<1||!salePrice) return null
    const cfs = [-selPrice]
    for (let yr=1; yr<=exitYear; yr++) cfs.push(srcNOI+(yr===exitYear?salePrice*(1-saleExpPct):0))
    return irrCalc(cfs)
  })()
  const levEM = totalAcq>0&&exitYear>0 ? (annCF*(exitYear-1)+annCF+netProceeds)/totalAcq : null

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

  // ── Refi ───────────────────────────────────────────────────────────────────
  const refiEnabled = refi.enabled===true
  const refiLoan    = selPrice*(nv(refi.loan_pct,75)/100)
  const refiMoAmort = pmtCalc(nv(refi.interest_rate), nv(refi.amortization,30), refiLoan)
  const refiMoIO    = refiLoan>0&&refi.interest_rate>0 ? refiLoan*(nv(refi.interest_rate)/100/12) : 0

  if (loading) return <div style={{ padding:'3rem', textAlign:'center', color:'#888', fontSize:13 }}>Loading dashboard...</div>

  const TH = (a='right') => ({ padding:'6px 8px', color:'#888', fontWeight:500, fontSize:11, textAlign:a, whiteSpace:'nowrap', borderBottom:'0.5px solid rgba(0,0,0,0.12)' })

  // Benchmark geo row helper
  function BenchCell({ stats, fmt }) {
    if (!stats || fmt(stats) === '—') return <td style={{ padding:'6px 10px', textAlign:'right', color:'#ccc', fontSize:12 }}>—</td>
    return <td style={{ padding:'6px 10px', textAlign:'right', fontSize:12 }}>{fmt(stats)}</td>
  }

  return (
    <div>
      {msg && <div style={{ padding:'6px 12px', background:'#EAF3DE', color:'#27500A', borderRadius:8, fontSize:12, marginBottom:12 }}>{msg}</div>}

      {/* ═══ MARKET BENCHMARKS ════════════════════════════════════════════ */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', ...sHdr }}>
          <span>Market Benchmarks {pr.year_built_era ? `— ${pr.year_built_era}` : ''}</span>
          <div style={{ fontSize:11, color:'#888', fontWeight:400, textTransform:'none', letterSpacing:0 }}>
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
          ? <div style={{ fontSize:12, color:'#bbb' }}>No sold comp data available — check Comp Analysis tab filters.</div>
          : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={TH('left')}>Metric</th>
                  {benchData.cols.map(col => (
                    <th key={col.label} style={TH()}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Sold count */}
                <tr style={{ borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding:'6px 8px', color:'#888', fontSize:12 }}>Sold count</td>
                  {benchData.cols.map(col => (
                    <td key={col.label} style={{ padding:'6px 10px', textAlign:'right', fontSize:12, color: col.stats ? '#111' : '#ccc' }}>
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
                  <tr key={label} style={{ borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding:'6px 8px', color:'#555' }}>{label}</td>
                    {benchData.cols.map(col => (
                      <td key={col.label} style={{ padding:'6px 10px', textAlign:'right', fontSize:12, color:col.stats?'#111':'#ccc' }}>
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
      <div style={card}>
        <div style={{ ...sHdr, marginBottom:12 }}>Valuation Scenarios</div>

        {/* Income source inline row */}
        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:12, alignItems:'center', padding:'12px 14px', background:'#F8F8F8', borderRadius:8, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:10, color:'#999', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>Income Source</div>
            <select value={incSrc} onChange={e=>handleIncomeSourceChange(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, fontWeight:500 }}>
              {INCOME_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {[{ label:'Gross Income',val:srcGross },{ label:'Op Ex',val:srcExp },{ label:'NOI',val:srcNOI,bold:true,color:srcNOI>0?'#27500A':'#791F1F' }].map(({ label,val,bold,color }) => (
            <div key={label}>
              <div style={{ fontSize:10, color:'#999', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:16, fontWeight:bold?600:500, color:color||'#111' }}>{fmtC(val)}</div>
            </div>
          ))}
        </div>

        {/* Pricing targets */}
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>{['Scenario','Target','Price','$/Unit','$/SF','Cap Rate','GRM','DSCR'].map((h,i) => <th key={h} style={TH(i===0?'left':'right')}>{h}</th>)}</tr></thead>
            <tbody>
              {pricingRows.map(row => {
                const c = pricingCalc(row.price)
                const isSelected = priceSourceKey === row.key
                return (
                  <tr key={row.key} style={{ borderBottom:'0.5px solid rgba(0,0,0,0.06)', background:isSelected?'#EAF3DE':row.isFixed?'#F8F7FF':'transparent' }}>
                    <td style={{ padding:'7px 8px', fontWeight:row.isFixed?600:400, color:'#111', whiteSpace:'nowrap' }}>{row.label}</td>
                    <td style={{ padding:'4px 8px', textAlign:'right' }}>
                      {row.isFixed
                        ? <span style={{ color:'#555' }}>{fmtC(askPrice)}</span>
                        : <input type="number" value={row.val||''} onChange={e=>setPT(row.key,e.target.value)}
                            placeholder={row.pct?'0.00':row.dol?'0':'0.00'}
                            style={{ width:100, padding:'4px 6px', border:'0.5px solid #ddd', borderRadius:6, fontSize:12, textAlign:'right', background:'#FAFAFA' }}/>
                      }
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:500 }}>{fmtC(c.price)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#555' }}>{fmtC(c.perUnit)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#555' }}>{c.perSF?'$'+Math.round(c.perSF).toLocaleString():'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#555' }}>{fmtP(c.cap)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#555' }}>{fmtN(c.grm)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:500, color:dc(c.dscr) }}>{fmtN(c.dscr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:10, color:'#bbb', marginTop:6 }}>* Target: Return % = cash-on-cash back-calculation. Full IRR available after operating model is built.</div>
      </div>

      {/* ═══ ACQUISITION DETAILS ════════════════════════════════════════ */}
      <div style={card}>
        <div style={sHdr}>Acquisition Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 1fr', gap:'0 16px', fontSize:12, alignItems:'center' }}>
          {/* headers */}
          {['','Input / Selection','Computed'].map((h,i) => (
            <div key={i} style={{ fontSize:11, color:'#aaa', padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.1)', textAlign:i>0?'right':'left' }}>{h}</div>
          ))}

          {/* Close Date */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Anticipated close date</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}><input type="date" value={acq.close_date||''} onChange={e=>setAcq('close_date',e.target.value)} style={{ ...inp, textAlign:'right' }}/></div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}></div>

          {/* Purchase Price — dropdown */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Purchase price</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
            <select value={priceSourceKey} onChange={e=>setAcq('price_source',e.target.value)}
              style={{ ...inp, textAlign:'right', cursor:'pointer' }}>
              {pricingRows.map(row => (
                <option key={row.key} value={row.key} disabled={!row.price}>{row.label}</option>
              ))}
            </select>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', fontWeight:600, fontSize:13 }}>{fmtC(selPrice||null)}</div>

          {/* Down Payment */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Down payment</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.down_pmt_pct||''} onChange={e=>setAcq('down_pmt_pct',e.target.value)} placeholder="25" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>%</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', fontWeight:500 }}>{fmtC(downAmt||null)}</div>

          {/* Loan Amount */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Loan amount</div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', color:'#888' }}>{ltv?(ltv*100).toFixed(0)+'% LTV':''}</div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', fontWeight:500 }}>{fmtC(loanAmt||null)}</div>

          {/* Loan Fees */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Loan fees</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.loan_fees_pct||''} onChange={e=>setAcq('loan_fees_pct',e.target.value)} placeholder="1" step="0.25" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>%</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right' }}>{fmtC(loanFeesAmt||null)}</div>

          {/* Closing Costs */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Closing costs</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.closing_costs_pct||''} onChange={e=>setAcq('closing_costs_pct',e.target.value)} placeholder="2" step="0.25" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>%</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right' }}>{fmtC(closeCostAmt||null)}</div>

          {/* Total Acq Costs */}
          <div style={{ padding:'7px 0', borderBottom:'0.5px solid rgba(0,0,0,0.12)', fontWeight:600, color:'#111' }}>Total acquisition costs</div>
          <div style={{ padding:'7px 0', borderBottom:'0.5px solid rgba(0,0,0,0.12)', textAlign:'right', color:'#888', fontSize:11 }}>
            {acqCostPct ? (acqCostPct*100).toFixed(2)+'%' : ''}
          </div>
          <div style={{ padding:'7px 0', borderBottom:'0.5px solid rgba(0,0,0,0.12)', textAlign:'right', fontWeight:600, color:'#111' }}>{fmtC(totalAcq||null)}</div>
          <div style={{ gridColumn:'1/-1', height:8 }}></div>

          {/* Interest Rate */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Fixed interest rate</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.interest_rate||''} onChange={e=>setAcq('interest_rate',e.target.value)} placeholder="6.5" step="0.125" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888', whiteSpace:'nowrap' }}>% / yr</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', color:'#888', fontSize:11 }}>Annually</div>

          {/* Amortization */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Amortization</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.amortization||''} onChange={e=>setAcq('amortization',e.target.value)} placeholder="25" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>Years</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', color:'#888', fontSize:11 }}>{amortYrs?amortYrs*12+' Months':''}</div>

          {/* Loan Term */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Loan term</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.loan_term||''} onChange={e=>setAcq('loan_term',e.target.value)} placeholder="10" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>Years</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', color:'#888', fontSize:11 }}>{loanTermYrs?loanTermYrs*12+' Months':''}</div>

          {/* I/O Period */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Interest-only period</div>
          <div style={{ padding:'4px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={acq.io_period||''} onChange={e=>setAcq('io_period',e.target.value)} placeholder="0" style={{ ...inp, textAlign:'right' }}/><span style={{ color:'#888' }}>Months</span>
          </div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', color:'#888', fontSize:11 }}>{ioPeriod?ioPeriod+' Months':'0 Months'}</div>
          <div style={{ gridColumn:'1/-1', height:4 }}></div>

          {/* Amortizing Payment */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Amortizing payment</div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right' }}>{fmtC(moAmort||null)} <span style={{ color:'#aaa', fontSize:11 }}>/mo</span></div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', fontWeight:600 }}>{fmtC(moAmort?moAmort*12:null)} <span style={{ color:'#aaa', fontSize:11 }}>/yr</span></div>

          {/* I/O Payment */}
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', color:'#555' }}>Interest-only payment</div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right' }}>{fmtC(moIO||null)} <span style={{ color:'#aaa', fontSize:11 }}>/mo</span></div>
          <div style={{ padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)', textAlign:'right', fontWeight:600 }}>{fmtC(moIO?moIO*12:null)} <span style={{ color:'#aaa', fontSize:11 }}>/yr</span></div>

          {/* DSCR */}
          {srcNOI>0&&annualDS>0&&<>
            <div style={{ padding:'7px 0', fontWeight:600, color:'#111' }}>DSCR ({incSrc})</div>
            <div></div>
            <div style={{ padding:'7px 0', textAlign:'right', fontWeight:600, color:dc(srcNOI/annualDS) }}>{fmtN(srcNOI/annualDS)}</div>
          </>}
        </div>
      </div>

      {/* ═══ CAPEX ══════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {[
          { title:'Value-Add CapEx Assumptions', key:'value_add_capex', rows:vaCapex, total:vaTotal },
          { title:'Reserve / Replacement CapEx',  key:'reserve_capex',   rows:resCapex, total:resTotal },
        ].map(({ title, key, rows:capexRows, total }) => (
          <div key={key} style={{ ...card, marginBottom:0 }}>
            <div style={sHdr}>{title}</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:8 }}>
              <thead><tr style={{ borderBottom:'0.5px solid rgba(0,0,0,0.1)' }}>
                <th style={{ textAlign:'left', padding:'4px', color:'#888', fontWeight:500, fontSize:11 }}>Description</th>
                <th style={{ textAlign:'right', padding:'4px', color:'#888', fontWeight:500, fontSize:11, width:80 }}>Cost Est.</th>
                <th style={{ textAlign:'center', padding:'4px', color:'#888', fontWeight:500, fontSize:11, width:68 }}>Start Mo.</th>
                <th style={{ textAlign:'center', padding:'4px', color:'#888', fontWeight:500, fontSize:11, width:68 }}>End Mo.</th>
                <th style={{ width:22 }}></th>
              </tr></thead>
              <tbody>
                {capexRows.map((row,idx) => (
                  <tr key={row.id||idx} style={{ borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                    {[['label','text','left'],['cost','number','right'],['month_start','number','center'],['month_end','number','center']].map(([field,type,align]) => (
                      <td key={field} style={{ padding:'3px 2px' }}>
                        <input type={type} value={row[field]||''} placeholder={field==='label'?'Description':field==='cost'?'0':'1'}
                          onChange={e=>updCapex(key,idx,field,e.target.value)}
                          style={{ width:'100%', border:'none', borderBottom:'0.5px solid #eee', fontSize:12, padding:'3px 4px', background:'transparent', outline:'none', textAlign:align }}/>
                      </td>
                    ))}
                    <td style={{ padding:'3px 2px', textAlign:'center' }}>
                      {capexRows.length>1&&<button onClick={()=>removeRow(key,idx)} style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', fontSize:16, lineHeight:1, padding:0 }}>×</button>}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop:'0.5px solid rgba(0,0,0,0.1)', background:'#F9F9F9' }}>
                  <td style={{ padding:'6px 8px', fontWeight:500 }}>Total</td>
                  <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:600 }}>{fmtC(total)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
            <button onClick={()=>addRow(key)} style={{ fontSize:11, color:'#888', background:'none', border:'0.5px dashed #ccc', borderRadius:6, padding:'4px 12px', cursor:'pointer' }}>+ Add row</button>
          </div>
        ))}
      </div>

      {/* ═══ MARKET PRICING BAND ════════════════════════════════════════ */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', ...sHdr }}>
          <span>Market Pricing Band</span>
          <button onClick={calcBandDefaults} style={{ fontSize:11, color:'#3C3489', background:'#F8F7FF', border:'0.5px solid #AFA9EC', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:500, textTransform:'none', letterSpacing:0 }}>
            ↻ Reset to defaults
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:12 }}>
          {[
            { label:'Investor floor price',  key:'investor_floor'   },
            { label:'Market band — low',     key:'band_low'         },
            { label:'Market band — high',    key:'band_high'        },
            { label:'Aggressive list price', key:'aggressive_price' },
            { label:'Suggested list price',  key:'suggested_price'  },
                    ].map(({ label, key }) => (
            <div key={key}>
              <div style={{ fontSize:11, color:'#666', marginBottom:2 }}>{label}</div>
              <input type="number" value={mp[key]||''} onChange={e=>setMP(key,e.target.value)} style={inp}/>
              {mp[key] && <div style={{ fontSize:11, color:'#111', fontWeight:500, marginTop:2 }}>{fmtC(mp[key])}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ INVESTOR RETURNS ═══════════════════════════════════════════ */}
      <div style={card}>
        <div style={sHdr}>Investor Returns</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:500, color:'#555', marginBottom:8 }}>Purchase Summary</div>
            <KV label="Purchase price"          value={fmtC(selPrice||null)} />
            <KV label="Loan amount"             value={fmtC(loanAmt||null)} />
            <KV label="Total acquisition costs" value={fmtC(totalAcq||null)} bold />
            <div style={{ height:12 }}/>
            <div style={{ fontSize:11, fontWeight:500, color:'#555', marginBottom:8 }}>Year 01 — {incSrc} (approx)</div>
            <KV label="NOI"                  value={fmtC(srcNOI||null)} />
            <KV label="Annual debt service"  value={fmtC(annualDS||null)} />
            <KV label="Cash flow"            value={fmtC(annCF||null)} />
            <KV label="Cash-on-Cash return"  value={coc!=null?fmtP(coc):'—'} bold
              color={coc!=null?(coc>=0.08?'#27500A':coc>=0.04?'#633806':'#791F1F'):'#ccc'} />
            <KV label="Going-in cap rate"    value={selPrice?fmtP(srcNOI/selPrice):'—'} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:500, color:'#555', marginBottom:8 }}>Exit Assumptions</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Anticipated exit year</div>
                <input type="number" value={ir.exit_year||''} onChange={e=>setIR('exit_year',e.target.value)} placeholder="5" style={inp}/></div>
              <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Going-out cap rate %</div>
                <input type="number" value={ir.going_out_cap||''} onChange={e=>setIR('going_out_cap',e.target.value)} placeholder="8.0" step="0.25" style={inp}/></div>
            </div>
            <div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Sale expense %</div>
              <input type="number" value={ir.sale_expense||''} onChange={e=>setIR('sale_expense',e.target.value)} placeholder="5" step="0.5" style={inp}/></div>
            <KV label="Exit year NOI (est.)" value={fmtC(srcNOI||null)} />
            <KV label="Sale price"           value={fmtC(salePrice||null)} />
            <KV label="Sale proceeds (net)"  value={fmtC(netProceeds||null)} bold />
          </div>
        </div>
        {(levIRR!=null||unlevIRR!=null)&&(
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, padding:'12px 14px', background:'#F8F8F8', borderRadius:8 }}>
            {[
              { label:'Unlevered IRR',   val:unlevIRR!=null?fmtP(unlevIRR):'—', col:unlevIRR!=null&&unlevIRR>=0.08?'#27500A':unlevIRR>=0.05?'#633806':'#791F1F' },
              { label:'Levered IRR',     val:levIRR!=null?fmtP(levIRR):'—',     col:levIRR!=null&&levIRR>=0.15?'#27500A':levIRR>=0.08?'#633806':'#791F1F' },
              { label:'Equity multiple', val:levEM!=null?fmtX(levEM):'—',     col:levEM!=null&&levEM>=2?'#27500A':levEM>=1.5?'#633806':'#791F1F' },
              { label:'Cash-on-Cash',    val:coc!=null?fmtP(coc):'—',           col:coc!=null&&coc>=0.08?'#27500A':coc>=0.04?'#633806':'#791F1F' },
            ].map(({ label,val,col }) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#999', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:600, color:col }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:10, color:'#bbb', marginTop:8 }}>* Returns use constant NOI. Full IRR with projected growth available in Phase B.</div>
      </div>

      {/* ═══ REFINANCE ══════════════════════════════════════════════════ */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', ...sHdr }}>
          <span>Refinance Details</span>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:400, textTransform:'none', letterSpacing:0, color:'#555', fontSize:12 }}>
            <span>Include refinance</span>
            <input type="checkbox" checked={refiEnabled} onChange={e=>setRefi('enabled',e.target.checked)} style={{ width:15, height:15, cursor:'pointer' }}/>
          </label>
        </div>
        {!refiEnabled
          ? <div style={{ fontSize:12, color:'#bbb' }}>Refinance not included in this analysis.</div>
          : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Refi month</div>
                    <input type="number" value={refi.refi_month||''} onChange={e=>setRefi('refi_month',e.target.value)} placeholder="60" style={inp}/></div>
                  <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Target DSCR</div>
                    <input type="number" value={refi.target_dscr||''} onChange={e=>setRefi('target_dscr',e.target.value)} placeholder="1.25" step="0.05" style={inp}/></div>
                </div>
                <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Loan LTV %</div>
                  <input type="number" value={refi.loan_pct||''} onChange={e=>setRefi('loan_pct',e.target.value)} placeholder="75" style={inp}/></div>
                <KV label="Refi loan amount" value={fmtC(refiLoan||null)} bold/>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Fixed interest rate %</div>
                  <input type="number" value={refi.interest_rate||''} onChange={e=>setRefi('interest_rate',e.target.value)} placeholder="7.0" step="0.125" style={inp}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Amortization (years)</div>
                    <input type="number" value={refi.amortization||''} onChange={e=>setRefi('amortization',e.target.value)} placeholder="30" style={inp}/></div>
                  <div><div style={{ fontSize:11, color:'#666', marginBottom:3 }}>Loan term (years)</div>
                    <input type="number" value={refi.loan_term||''} onChange={e=>setRefi('loan_term',e.target.value)} placeholder="10" style={inp}/></div>
                </div>
                <KV label="Amortizing payment / month" value={fmtC(refiMoAmort||null)} />
                <KV label="Amortizing payment / year"  value={fmtC(refiMoAmort?refiMoAmort*12:null)} bold/>
                <KV label="I/O payment / month"        value={fmtC(refiMoIO||null)}/>
              </div>
            </div>
        }
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', paddingBottom:32 }}>
        <button onClick={save} disabled={saving}
          style={{ padding:'8px 22px', background:'#111', color:'#fff', border:'none', borderRadius:8, fontWeight:500, fontSize:13, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>
          {saving?'Saving...':'Save dashboard'}
        </button>
      </div>
    </div>
  )
}