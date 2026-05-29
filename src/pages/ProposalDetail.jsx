import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { runOperatingModel, buildGA, buildT12Expenses } from '../utils/operatingModel'
import { supabase } from '../supabase'
import { generateOmDocument } from '../utils/omSerialize'
import RentRoll from './RentRoll'
import Financials from './Financials'
import PropertyDashboard from './PropertyDashboard'

/* §4a stage simplification 8→3 — display/filter mapping (non-destructive).
   Per Ben's decision: keep stored values, write the new 3-stage value when edited. */
const NEW_STAGES = ['New', 'Working', 'Archived']
const STAGE_MAP = {
  'Prospect': 'New',
  'Proposal': 'Working', 'Exclusive Rep': 'Working', 'Active': 'Working', 'Under Contract': 'Working',
  'Sold': 'Archived', 'Lost': 'Archived',
}
const toNewStage = s => STAGE_MAP[s] || (NEW_STAGES.includes(s) ? s : 'New')

const WORKSPACE_TABS = [
  { key: 'pricing',     label: 'Pricing' },
  { key: 'acquisition', label: 'Acquisition Model' },
  { key: 'comp',        label: 'Comp analysis' },
  { key: 'rent',        label: 'Rent roll' },
  { key: 'dd',          label: 'Due diligence' },
  { key: 'fin',         label: 'Financials' },
]

const fC = v => v ? '$' + Math.round(parseFloat(v)).toLocaleString() : '—'

export default function ProposalDetail() {
  const { id: proposalId } = useParams()
  const navigate = useNavigate()
  const [proposal, setProposal] = useState(null)
  const [tab, setTab] = useState('pricing')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editStage, setEditStage] = useState('')
  const [editAsking, setEditAsking] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [genningOm, setGenningOm] = useState(false)
  const [siIncome,   setSiIncome]   = useState('')
  const [siExpenses, setSiExpenses] = useState('')
  const siDashRef = { current: {} }
  const [benchDateRange, setBenchDateRange] = useState(180)
  const [benchStats,     setBenchStats]     = useState(null)
  const [benchComps,     setBenchComps]     = useState([])
  const [opModel,        setOpModel]        = useState(null)
  const [opModelError,   setOpModelError]   = useState(null)

  useEffect(() => { loadProposal() }, [proposalId])

  async function loadProposal() {
    setLoading(true)
    const { data } = await supabase.from('proposals').select('*, properties(*)').eq('id', proposalId).single()
    setProposal(data)
    setEditStage(data?.stage || 'Prospect')
    setEditAsking(data?.asking_price || '')
    setEditNotes(data?.notes || '')
    const { data: dashRow } = await supabase.from('proposal_dashboard').select('data').eq('proposal_id', proposalId).maybeSingle()
    if (dashRow?.data) {
      siDashRef.current = dashRow.data
      setSiIncome(dashRow.data.stated_income || '')
      setSiExpenses(dashRow.data.stated_expenses || '')
    }
    setLoading(false)
  }

  useEffect(() => { loadBenchComps() }, [proposalId])

  async function loadBenchComps() {
    let all = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data } = await supabase.from('comps').select('*')
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      all = all.concat(data || [])
      if (!data || data.length < pageSize) done = true
      else from += pageSize
    }
    setBenchComps(all)
  }

  useEffect(() => {
    if (!benchComps.length || !proposal) return
    const pr = proposal.properties || {}
    const era = pr.year_built_era
    const [minU, maxU] = unitRangeFromSubType(pr.property_sub_type, pr.total_units)
    function med(arr) {
      const a = arr.filter(v => v != null && isFinite(v)).sort((a, b) => a - b)
      if (!a.length) return null
      const m = Math.floor(a.length / 2)
      return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
    }
    function colStats(comps) {
      if (!comps.length) return null
      return {
        count: comps.length,
        ppu: med(comps.map(c => c.sale_price && c.num_units ? c.sale_price / c.num_units : null)),
        psf: med(comps.map(c => c.sale_price && c.building_sf ? c.sale_price / c.building_sf : null)),
        cap: med(comps.map(c => !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null)),
        grm: med(comps.map(c => !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null)),
      }
    }
    const cutoff = benchDateRange >= 99999 ? null : (() => {
      const d = new Date(); d.setDate(d.getDate() - benchDateRange); return d
    })()
    const base = benchComps.filter(c => {
      if (c.status !== 'Sold') return false
      if (cutoff) {
        const sd = c.sale_date ? new Date(c.sale_date) : null
        if (sd && sd < cutoff) return false
      }
      const u = c.num_units
      if (u != null && (u < minU || u > maxU)) return false
      return true
    })
    const eraFn = c => !era || !c.year_built_era || c.year_built_era === era
    const stats = [
      { label: 'Market / MSA', comps: base.filter(c => pr.market     && c.market          === pr.market     && eraFn(c)) },
      { label: 'County',       comps: base.filter(c => pr.county     && c.property_county === pr.county     && eraFn(c)) },
      { label: 'Sub-Market',   comps: base.filter(c => pr.sub_market && c.sub_market      === pr.sub_market && eraFn(c)) },
      { label: 'Zip',          comps: base.filter(c => pr.zip        && String(c.zip_code) === String(pr.zip) && eraFn(c)) },
    ].map(col => ({ label: col.label, ...(colStats(col.comps) || { count: 0 }) }))
    setBenchStats(stats)
  }, [benchComps.length, benchDateRange, proposal?.id])

  async function computeOpModel() {
    if (!proposal) return
    const pr = proposal.properties || {}
    try {
      const [rrRes, finRes, settRes, dashRes] = await Promise.all([
        supabase.from('rent_roll_units').select('*').eq('proposal_id', proposal.id).order('sort_order', { ascending: true }),
        supabase.from('proposal_financials').select('*').eq('proposal_id', proposal.id).maybeSingle(),
        supabase.from('app_settings').select('*').eq('key', 'growth_assumptions').maybeSingle(),
        supabase.from('proposal_dashboard').select('data').eq('proposal_id', proposal.id).maybeSingle(),
      ])
      const units       = rrRes.data || []
      const finRow      = finRes.data
      const gaDefaults  = settRes.data?.value || {}
      const dash        = dashRes.data?.data || {}
      const acq         = dash.acquisition || {}
      const exitYear    = Number(dash.inv_returns?.exit_year) || 5
      const ga          = buildGA(finRow, gaDefaults)
      const t12Exp      = buildT12Expenses(finRow)
      const totalUnits  = units.length || Number(pr.total_units) || 1
      const result = runOperatingModel({
        units,
        ga,
        t12Expenses:    t12Exp,
        totalUnits,
        closeDate:      acq.close_date || new Date().toISOString().slice(0, 10),
        valueAddCapex:  dash.value_add_capex || [],
        exitYear,
      })
      setOpModel(result)
      setOpModelError(null)
      await Promise.all(
        units.map((u, i) => {
          const key = u.sort_order != null ? u.sort_order : i
          const newStab = result.unitStabMap?.[key]
          if (newStab == null || newStab === u.stabilized_month) return Promise.resolve()
          return supabase.from('rent_roll_units').update({ stabilized_month: newStab }).eq('id', u.id)
        })
      )
    } catch (e) {
      console.error('computeOpModel failed:', e)
      setOpModelError(e?.message || String(e))
    }
  }

  useEffect(() => { if (proposal?.id) computeOpModel() }, [proposal])

  async function saveSIField(field, value) {
    siDashRef.current = { ...siDashRef.current, [field]: parseFloat(value) || null }
    const { data: ex } = await supabase.from('proposal_dashboard').select('id').eq('proposal_id', proposalId).maybeSingle()
    if (ex) await supabase.from('proposal_dashboard').update({ data: siDashRef.current }).eq('proposal_id', proposalId)
    else    await supabase.from('proposal_dashboard').insert({ proposal_id: proposalId, data: siDashRef.current })
  }

  async function saveProposal() {
    setSaving(true)
    await supabase.from('proposals').update({ stage: editStage, asking_price: parseFloat(editAsking) || null, notes: editNotes }).eq('id', proposalId)
    setSaving(false)
    setMsg('Saved')
    setTimeout(() => setMsg(''), 2000)
    loadProposal()
  }

  // Stage selector writes the new 3-stage value directly (per Ben's map-only/write-new choice).
  async function changeStage(ns) {
    setEditStage(ns)
    setProposal(p => p ? { ...p, stage: ns } : p)
    await supabase.from('proposals').update({ stage: ns }).eq('id', proposalId)
    setMsg('Stage updated')
    setTimeout(() => setMsg(''), 2000)
  }

  async function generateOm() {
    // Open the tab synchronously inside the click gesture, THEN serialize/save and
    // point it at the OM. window.open() after an await is treated as non-user-initiated
    // and gets popup-blocked — which is why the button appeared to do nothing.
    const omWindow = window.open('about:blank', '_blank')
    setGenningOm(true)
    try {
      await generateOmDocument(proposalId)               // serialize proposal → save to proposals.om_json
      const url = `/om?proposal=${proposalId}&view=client`
      if (omWindow) { omWindow.opener = null; omWindow.location.href = url }
      else window.open(url, '_blank', 'noopener')         // fallback if the sync open was blocked
    } catch (e) {
      console.error('Generate OM failed:', e)
      if (omWindow) omWindow.close()
      setMsg('OM generation failed: ' + (e.message || e))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setGenningOm(false)
    }
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading…</div>
  if (!proposal) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Not found</div>

  const pr = proposal.properties || {}
  const metaParts = [pr.sub_market, pr.total_units ? `${pr.total_units} units` : null, pr.property_sub_type, pr.year_built_era].filter(Boolean)

  return (
    <div className="uw">
      <div className="uw-top">
        <button className="uw-back" onClick={() => navigate('/proposals')}>‹ Pipeline</button>
        <div className="uw-top-id">
          <h1 className="uw-top-title">{pr.street || 'Untitled'}</h1>
          <p className="uw-top-meta">{metaParts.join(' · ')}</p>
        </div>
        <div className="uw-top-spacer" />
        {msg && <span className="uw-top-msg">{msg}</span>}
        <select className="uw-stage-select" value={toNewStage(proposal.stage)} onChange={e => changeStage(e.target.value)}>
          {NEW_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" onClick={generateOm} disabled={genningOm}>{genningOm ? 'Generating…' : 'Open OM →'}</button>
      </div>

      <div className="uw-nav">
        {WORKSPACE_TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="uw-tabbody">
        {(tab === 'pricing' || tab === 'acquisition') && (
          <>
            {tab === 'pricing' && (
              <div className="pr-card" style={{ marginBottom: 16 }}>
                <p className="pr-card-h">Deal inputs</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="ap-field-label">Asking price</label>
                    <input className="ap-input" type="number" value={editAsking} onChange={e => setEditAsking(e.target.value)} onBlur={saveProposal} placeholder="e.g. 925000" />
                  </div>
                  <div>
                    <label className="ap-field-label">Stated gross income</label>
                    <input className="ap-input" type="number" value={siIncome} onChange={e => setSiIncome(e.target.value)} onBlur={e => saveSIField('stated_income', e.target.value)} placeholder="e.g. 530000" />
                  </div>
                  <div>
                    <label className="ap-field-label">Stated operating expenses</label>
                    <input className="ap-input" type="number" value={siExpenses} onChange={e => setSiExpenses(e.target.value)} onBlur={e => saveSIField('stated_expenses', e.target.value)} placeholder="e.g. 210000" />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="ap-field-label">Notes</label>
                  <textarea className="ap-input" value={editNotes} onChange={e => setEditNotes(e.target.value)} onBlur={saveProposal} placeholder="Discovery call notes…" style={{ minHeight: 60, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--slate)' }}>Stated NOI: <b style={{ color: 'var(--ink)' }}>{(parseFloat(siIncome) || 0) - (parseFloat(siExpenses) || 0) ? '$' + Math.round((parseFloat(siIncome) || 0) - (parseFloat(siExpenses) || 0)).toLocaleString() : '—'}</b></span>
                  <button className="btn btn-secondary" onClick={saveProposal} disabled={saving}>{saving ? 'Saving…' : 'Save deal'}</button>
                </div>
              </div>
            )}
            <PropertyDashboard
              proposal={proposal} benchStats={benchStats} benchDateRange={benchDateRange}
              onBenchDateRangeChange={setBenchDateRange} opModel={opModel}
              onOpModelRefresh={computeOpModel} onDashSaved={computeOpModel}
              view={tab === 'pricing' ? 'pricing' : 'acquisition'}
            />
          </>
        )}

        {tab === 'comp' && (
          <CompAnalysis proposal={proposal} benchDateRange={benchDateRange} onBenchDateRangeChange={setBenchDateRange} />
        )}

        {tab === 'rent' && (
          <RentRoll proposal={proposal} opModel={opModel} onSaved={computeOpModel} />
        )}

        {tab === 'dd' && (
          <DueDiligence proposal={proposal} onSaved={() => { setMsg('Due diligence saved'); setTimeout(() => setMsg(''), 2000) }} />
        )}

        {tab === 'fin' && (
          <Financials proposal={proposal} opModel={opModel} opModelError={opModelError} onRecomputeOpModel={computeOpModel} />
        )}
      </div>
    </div>
  )
}

const DD_FIELDS = [
  { l: 'Roof', c: 3, f: [{ k: 'roof_type', l: 'Type' }, { k: 'year_roof_installed', l: 'Year installed' }, { k: 'roof_notes', l: 'Notes' }] },
  { l: 'Heat source', c: 3, f: [{ k: 'heat_source', l: 'Type' }, { k: 'heat_source_install', l: 'Install / age' }, { k: 'heat_source_notes', l: 'Notes' }] },
  { l: 'Windows', c: 3, f: [{ k: 'window_type', l: 'Type / style' }, { k: 'window_install', l: 'Install / age' }, { k: 'window_notes', l: 'Notes' }] },
  { l: 'Sewer line', c: 3, f: [{ k: 'sewer_type', l: 'Type' }, { k: 'sewer_install', l: 'Install / age' }, { k: 'sewer_notes', l: 'Notes' }] },
  { l: 'Exterior / siding', c: 3, f: [{ k: 'exterior_type', l: 'Type' }, { k: 'siding_install', l: 'Install / age' }, { k: 'siding_notes', l: 'Notes' }] },
  { l: 'Electrical panel', c: 3, f: [{ k: 'electrical_panel_type', l: 'Type / brand' }, { k: 'panel_install', l: 'Install / age' }, { k: 'electrical_notes', l: 'Notes' }] },
  { l: 'Plumbing', c: 3, f: [{ k: 'plumbing_type', l: 'Type' }, { k: 'plumbing_install', l: 'Install / age' }, { k: 'plumbing_notes', l: 'Notes' }] },
  { l: 'Water heaters', c: 3, f: [{ k: 'water_heater_type', l: 'Count / type' }, { k: 'water_heater_install', l: 'Install / age' }, { k: 'water_heater_notes', l: 'Notes' }] },
  { l: 'Foundation', c: 2, f: [{ k: 'foundation_type', l: 'Type' }, { k: 'foundation_notes', l: 'Notes' }] },
  { l: 'Parking', c: 3, f: [{ k: 'parking_surface', l: 'Surface type' }, { k: 'parking_standard', l: 'Count' }, { k: 'parking_ratio', l: 'Ratio' }] },
  { l: 'RUBS', c: 2, f: [{ k: 'rubs_type', l: 'Type' }, { k: 'rubs_notes', l: 'Notes' }] },
  { l: 'Sprinkler', c: 1, f: [{ k: 'sprinkler_system', l: 'Type / notes' }] },
  { l: 'Oil tanks', c: 3, f: [{ k: 'oil_tanks', l: 'Present', t: 'yn' }, { k: 'oil_tank_decommissioned', l: 'Decommissioned', t: 'yn' }, { k: 'oil_tank_notes', l: 'Notes' }] },
]

function DueDiligence({ proposal, onSaved }) {
  const pr = proposal.properties || {}
  const [fields, setFields] = useState({})
  const [ddNotes, setDdNotes] = useState(pr.dd_notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = {}
    DD_FIELDS.forEach(sec => sec.f.forEach(f => { init[f.k] = pr[f.k] || '' }))
    setFields(init)
    setDdNotes(pr.dd_notes || '')
  }, [proposal])

  async function save() {
    setSaving(true)
    await supabase.from('properties').update({ ...fields, dd_notes: ddNotes }).eq('id', pr.id)
    setSaving(false)
    onSaved()
  }

  const ddCls = c => c === 2 ? 'dd-fields c2' : c === 1 ? 'dd-fields c1' : 'dd-fields'

  return (
    <div className="uw-pane">
      <div className="uw-pane-head">
        <div>
          <h2>Due diligence</h2>
          <p>Captured on the seller discovery call · merges into the offering memo</p>
        </div>
        <div className="uw-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save due diligence'}</button>
        </div>
      </div>

      {pr.owner_contact && (
        <div className="dd-callbar">
          <span className="dd-callbar-l">Discovery call</span>
          <span className="dd-callbar-v">Seller contact <b>{pr.owner_contact}</b>{pr.owner_llc ? <> · <b>{pr.owner_llc}</b></> : ''}</span>
        </div>
      )}

      <div className="dd-grid2">
        {DD_FIELDS.map(sec => (
          <div className="dd-card" key={sec.l}>
            <p className="dd-card-h">{sec.l}</p>
            <div className={ddCls(sec.c)}>
              {sec.f.map(f => (
                <div className="dd-f" key={f.k}>
                  <label>{f.l}</label>
                  {f.t === 'yn' ? (
                    <select value={fields[f.k] || ''} onChange={e => setFields(v => ({ ...v, [f.k]: e.target.value }))}>
                      <option value="">—</option>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  ) : (
                    <input value={fields[f.k] || ''} onChange={e => setFields(v => ({ ...v, [f.k]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="dd-card wide">
          <p className="dd-card-h">Due diligence notes</p>
          <textarea className="dd-area" value={ddNotes} onChange={e => setDdNotes(e.target.value)} />
        </div>
      </div>
    </div>
  )
}

/* ── helpers shared with CompAnalysis ── */
function parseDate(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d }
function daysBetween(a, b) { const da = parseDate(a), db = parseDate(b); if (!da || !db) return null; return Math.round(Math.abs((db - da) / 86400000)) }
function median(arr) { const c = arr.filter(v => v != null && isFinite(v)); if (!c.length) return null; const s = [...c].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
function mean(arr) { const c = arr.filter(v => v != null && isFinite(v)); if (!c.length) return null; return c.reduce((a, b) => a + b, 0) / c.length }

const DATE_RANGES = [
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '18 months', days: 548 },
  { label: '2 years', days: 730 },
]
const STAT_STATUSES = ['Active', 'Under Contract', 'Sold']
const ERA_OPTIONS = ['Pre-1940', '1940-1970', '1970-1990', '1990-2010', '2010-Present']

function unitRangeFromSubType(subType, totalUnits) {
  const ranges = { 'Duplex/Triplex': [2,3], 'Fourplex': [4,4], '5-8 Units': [5,8], '9-20 Units': [9,20], '21-50 Units': [21,50], '51-100 Units': [51,100], '100+ Units': [101,999] }
  if (subType && ranges[subType]) return ranges[subType]
  const u = parseInt(totalUnits)
  if (u >= 101) return [101, 999]
  if (u >= 51) return [51, 100]
  if (u >= 21) return [21, 50]
  if (u >= 9) return [9, 20]
  if (u >= 5) return [5, 8]
  if (u === 4) return [4, 4]
  if (u >= 2) return [2, 3]
  return [0, 999]
}

function CompAnalysis({ proposal, benchDateRange, onBenchDateRangeChange }) {
  const pr = proposal.properties || {}
  const [allComps, setAllComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [localDateRange, setLocalDateRange] = useState(benchDateRange ?? 730)
  const dateRange = benchDateRange ?? localDateRange
  function setDateRange(v) { setLocalDateRange(v); if (onBenchDateRangeChange) onBenchDateRangeChange(v) }
  const [excluded, setExcluded] = useState(new Set())
  const [excludedMktg, setExcludedMktg] = useState(new Set())
  const [mktgSavedIds, setMktgSavedIds] = useState(null)

  const defaultRange = unitRangeFromSubType(pr.property_sub_type, pr.total_units)
  const [minUnits, setMinUnits] = useState(defaultRange[0])
  const [maxUnits, setMaxUnits] = useState(defaultRange[1])

  const [market, setMarket] = useState(pr.market || '')
  const [county, setCounty] = useState(pr.county || '')
  const [subMarket, setSubMarket] = useState(pr.sub_market || '')
  const [zip, setZip] = useState(pr.zip ? String(pr.zip) : '')
  const [era, setEra] = useState(pr.year_built_era || '')

  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [editComp, setEditComp] = useState(null)

  useEffect(() => { fetchComps(); loadMktgSelections() }, [])

  async function loadMktgSelections() {
    const { data } = await supabase.from('comp_selections')
      .select('comp_id').eq('proposal_id', proposal.id).eq('is_marketing', true)
    if (data) setMktgSavedIds(new Set(data.map(r => r.comp_id)))
  }

  async function fetchComps() {
    setLoading(true)
    let all = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data } = await supabase.from('comps').select('*')
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      all = all.concat(data || [])
      if (!data || data.length < pageSize) done = true
      else from += pageSize
    }
    const enriched = all.map(c => {
      const xNoi = c.x_noi, xAgi = c.x_agi
      const saleP = c.sale_price, listP = c.listing_price
      const units = c.num_units, sf = c.building_sf
      const noi = c.adv_noi, agi = c.adv_agi
      const domToSale = daysBetween(c.listing_date, c.sale_date)
      const domPending = daysBetween(c.listing_date, c.pending_date)
      const domToToday = c.listing_date ? daysBetween(c.listing_date, new Date().toISOString()) : null
      return {
        ...c,
        _activeDom: c.listing_date ? (c.pending_date ? domPending : domToToday) : null,
        _totalDom: domToSale || domToToday,
        _escrow: daysBetween(c.pending_date, c.sale_date),
        _soldPPU: (saleP && units) ? saleP / units : null,
        _soldPSF: (saleP && sf) ? saleP / sf : null,
        _soldCap: (!xNoi && noi && saleP) ? noi / saleP : null,
        _soldGRM: (!xAgi && agi && saleP) ? saleP / agi : null,
        _askPPU: (listP && units) ? listP / units : null,
        _askPSF: (listP && sf) ? listP / sf : null,
        _askCap: (!xNoi && noi && listP) ? noi / listP : null,
        _askGRM: (!xAgi && agi && listP) ? listP / agi : null,
      }
    })
    setAllComps(enriched)
    setLoading(false)
  }

  const normStatus = s => {
    if (!s) return s
    const low = s.toLowerCase()
    if (low === 'pending' || low === 'under contract') return 'Under Contract'
    return s
  }

  const counties = [...new Set(allComps.map(c => c.property_county).filter(Boolean))].sort()
  const subMarkets = [...new Set(allComps.map(c => c.sub_market).filter(Boolean))].sort()
  const zips = [...new Set(allComps.map(c => String(c.zip_code)).filter(v => v && v !== 'null'))].sort()
  const eras = [...new Set(allComps.map(c => c.year_built_era).filter(Boolean))].sort()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - dateRange)

  const baseFiltered = allComps.filter(c => {
    const st = normStatus(c.status)
    if (!['Active', 'Under Contract', 'Sold'].includes(st)) return false
    const refDate = st === 'Sold' ? parseDate(c.sale_date) : parseDate(c.listing_date)
    if (refDate && refDate < cutoff) return false
    const u = c.num_units
    if (u != null && (u < minUnits || u > maxUnits)) return false
    return true
  })

  // Apply saved marketing selections once comps and selections are both loaded
  useEffect(() => {
    if (mktgSavedIds && allComps.length > 0 && mktgSavedIds.size > 0) {
      setExcludedMktg(new Set(baseFiltered.filter(c => !mktgSavedIds.has(c.id)).map(c => c.id)))
    }
  }, [mktgSavedIds, allComps.length])

  const activeComps = baseFiltered.filter(c => !excluded.has(c.id))
  const marketingComps = baseFiltered.filter(c => !excludedMktg.has(c.id))

  function toggleExclude(id) {
    setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleExcludeMktg(id) {
    const wasExcluded = excludedMktg.has(id)
    setExcludedMktg(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    if (wasExcluded) {
      supabase.from('comp_selections').delete().eq('proposal_id', proposal.id).eq('comp_id', id)
        .then(() => supabase.from('comp_selections').insert({ proposal_id: proposal.id, comp_id: id, is_marketing: true }))
    } else {
      supabase.from('comp_selections').delete().eq('proposal_id', proposal.id).eq('comp_id', id)
    }
  }
  function toggleAll() {
    if (excluded.size === 0) setExcluded(new Set(baseFiltered.map(c => c.id)))
    else setExcluded(new Set())
  }
  function toggleAllMktg() {
    const allExcluded = excludedMktg.size === 0
    if (allExcluded) {
      setExcludedMktg(new Set(baseFiltered.map(c => c.id)))
      supabase.from('comp_selections').delete().eq('proposal_id', proposal.id)
    } else {
      setExcludedMktg(new Set())
      supabase.from('comp_selections').delete().eq('proposal_id', proposal.id)
        .then(() => {
          const rows = baseFiltered.map(c => ({ proposal_id: proposal.id, comp_id: c.id, is_marketing: true }))
          if (rows.length) supabase.from('comp_selections').insert(rows)
        })
    }
  }

  const EDIT_FIELDS = [
    { section: 'Property', fields: [
      { key: 'property_name', label: 'Property Name', type: 'text' },
      { key: 'sale_name', label: 'Sale Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Under Contract', 'Sold', 'CAN/EXP/WTH'] },
      { key: 'property_sub_type', label: 'Property Type', type: 'text' },
      { key: 'year_built', label: 'Year Built', type: 'number' },
      { key: 'year_built_era', label: 'Year Built Era', type: 'text' },
    ]},
    { section: 'Location', fields: [
      { key: 'market', label: 'Market', type: 'text' },
      { key: 'sub_market', label: 'Sub-Market', type: 'text' },
      { key: 'property_county', label: 'County', type: 'text' },
      { key: 'zip_code', label: 'Zip Code', type: 'text' },
    ]},
    { section: 'Size', fields: [
      { key: 'num_units', label: '# of Units', type: 'number' },
      { key: 'building_sf', label: 'Building SF', type: 'number' },
    ]},
    { section: 'Dates', fields: [
      { key: 'listing_date', label: 'Listing Date', type: 'date' },
      { key: 'pending_date', label: 'Pending Date', type: 'date' },
      { key: 'sale_date', label: 'Sale Date', type: 'date' },
      { key: 'can_exp_wth_date', label: 'CAN/EXP/WTH Date', type: 'date' },
    ]},
    { section: 'Financial', fields: [
      { key: 'original_listing_price', label: 'Original Listing Price', type: 'number' },
      { key: 'listing_price', label: 'Listing Price', type: 'number' },
      { key: 'sale_price', label: 'Sale Price', type: 'number' },
      { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
      { key: 'sales_terms', label: 'Sales Terms', type: 'text' },
    ]},
    { section: 'Analysis', fields: [
      { key: 'adv_agi', label: 'AGI', type: 'number' },
      { key: 'adv_noi', label: 'NOI', type: 'number' },
      { key: 'x_agi', label: 'Exclude AGI', type: 'checkbox' },
      { key: 'x_noi', label: 'Exclude NOI', type: 'checkbox' },
      { key: 'owner_occ_purchase', label: 'Owner Occupied', type: 'checkbox' },
    ]},
  ]
  const editInputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }
  function openEdit(comp) {
    const form = {}
    EDIT_FIELDS.forEach(s => s.fields.forEach(f => {
      const v = comp[f.key]
      if (f.type === 'date' && v) { try { form[f.key] = new Date(v).toISOString().split('T')[0] } catch { form[f.key] = v || '' } }
      else if (f.type === 'checkbox') { form[f.key] = !!v }
      else { form[f.key] = v ?? '' }
    }))
    form._id = comp.id; form._sale_id = comp.sale_id
    setEditComp(form)
  }
  function updateEditField(key, value) { setEditComp(prev => ({ ...prev, [key]: value })) }
  async function saveEdit() {
    if (!editComp) return
    const updates = {}
    EDIT_FIELDS.forEach(s => s.fields.forEach(f => {
      let v = editComp[f.key]
      if (f.type === 'number') v = v === '' ? null : Number(v)
      else if (f.type === 'date') v = v || null
      else if (f.type === 'checkbox') v = !!v
      updates[f.key] = v
    }))
    const { error } = await supabase.from('comps').update(updates).eq('id', editComp._id)
    if (error) { console.error(error); return }
    setEditComp(null)
    fetchComps()
  }

  const colFilters = [
    { label: 'Market', era: false, fn: c => c.market === market },
    { label: 'Market', era: true, fn: c => c.market === market && c.year_built_era === era },
    { label: 'County', era: false, fn: c => c.property_county === county },
    { label: 'County', era: true, fn: c => c.property_county === county && c.year_built_era === era },
    { label: 'Sub-Mkt', era: false, fn: c => c.sub_market === subMarket },
    { label: 'Sub-Mkt', era: true, fn: c => c.sub_market === subMarket && c.year_built_era === era },
    { label: 'Zip', era: false, fn: c => String(c.zip_code) === zip },
    { label: 'Zip', era: true, fn: c => String(c.zip_code) === zip && c.year_built_era === era },
  ]

  function getColData(colFn, status) {
    const set = activeComps.filter(c => normStatus(c.status) === status && colFn(c))
    const isAsk = status !== 'Sold'
    return {
      count: set.length,
      ppu: median(set.map(c => isAsk ? c._askPPU : c._soldPPU)),
      psf: median(set.map(c => isAsk ? c._askPSF : c._soldPSF)),
      cap: median(set.map(c => isAsk ? c._askCap : c._soldCap)),
      grm: median(set.map(c => isAsk ? c._askGRM : c._soldGRM)),
      activeDom: set.length ? Math.round(mean(set.map(c => c._activeDom))) : null,
      totalDom: set.length ? Math.round(mean(set.map(c => c._totalDom))) : null,
      escrow: set.length ? Math.round(mean(set.map(c => c._escrow))) : null,
    }
  }

  const fmtC = v => v != null ? '$' + Math.round(v).toLocaleString() : 'No Data'
  const fmtP = v => v != null ? (v * 100).toFixed(2) + '%' : 'No Data'
  const fmtX = v => v != null ? v.toFixed(2) : 'No Data'
  const fmtD = v => v != null ? Math.round(v) : 'No Data'

  const fmtDate = v => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d)) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return `${mm}/${dd}/${yy}`
  }

  const ROW_GROUPS = [
    { label: 'Property Count', key: 'count', fmt: v => v != null ? v : 0 },
    { label: '$/Unit', key: 'ppu', fmt: fmtC },
    { label: '$/SF', key: 'psf', fmt: fmtC },
    { label: 'Cap Rate', key: 'cap', fmt: fmtP },
    { label: 'GRM', key: 'grm', fmt: fmtX },
    { label: 'Active DOM', key: 'activeDom', fmt: fmtD },
    { label: 'Total DOM', key: 'totalDom', fmt: fmtD },
    { label: 'Escrow Length', key: 'escrow', fmt: fmtD },
  ]

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const compTableData = [...baseFiltered].map(c => {
    const st = normStatus(c.status)
    const isSold = st === 'Sold'
    return { ...c, _st: st, _isSold: isSold, _dispPPU: isSold ? c._soldPPU : c._askPPU, _dispPSF: isSold ? c._soldPSF : c._askPSF, _dispCap: isSold ? c._soldCap : c._askCap, _dispGRM: isSold ? c._soldGRM : c._askGRM }
  })

  if (sortCol) {
    compTableData.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  const hdrBg = 'var(--paper)'
  const eraBg = 'rgba(42,93,176,0.035)'   // faint blue tint for +Era columns
  const cellPad = '8px 10px'
  const borderC = '1px solid var(--hairline)'
  const cellStyle = (isEra) => ({ padding: cellPad, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: isEra ? eraBg : 'var(--surface)', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' })
  const labelCell = { padding: cellPad, fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', background: 'var(--surface)', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }
  const groupCell = { padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink)', background: 'var(--paper)', borderBottom: borderC, borderRight: borderC }
  const sel = { padding: '7px 9px', border: '1px solid var(--hairline-2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--surface)' }

  const compTh = (label, col) => (
    <th onClick={() => toggleSort(col)} style={{ padding: cellPad, borderBottom: borderC, textAlign: col === 'property_name' || col === 'sub_market' || col === '_st' || col === 'year_built_era' ? 'left' : 'right', fontWeight: 700, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: sortCol === col ? 'var(--accent)' : 'var(--mute)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', resize: 'horizontal', minWidth: 50 }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading comps…</div>

  return (
    <div className="uw-pane">
      <div className="uw-pane-head">
        <div>
          <h2>Comp analysis</h2>
          <p>Market stats matrix + comparable sales · {baseFiltered.length} comps matched</p>
        </div>
      </div>
      {editComp && (
        <div className="ap-modal-overlay" onClick={() => setEditComp(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-modal-head">
              <h3 className="ap-modal-title">Edit comp — {editComp.property_name || editComp._sale_id}</h3>
              <button className="ap-modal-close" onClick={() => setEditComp(null)}>×</button>
            </div>
            {EDIT_FIELDS.map(section => (
              <div key={section.section} style={{ marginBottom: 16 }}>
                <div className="ap-field-section">{section.section}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {section.fields.map(f => (
                    <div key={f.key} style={f.type === 'checkbox' ? { display: 'flex', alignItems: 'center', gap: 6 } : {}}>
                      {f.type === 'checkbox' ? (
                        <><input type="checkbox" checked={!!editComp[f.key]} onChange={e => updateEditField(f.key, e.target.checked)} /><label style={{ fontSize: 12, color: 'var(--slate)' }}>{f.label}</label></>
                      ) : (
                        <><label className="ap-field-label">{f.label}</label>
                        {f.type === 'select' ? (
                          <select className="ap-input" value={editComp[f.key] || ''} onChange={e => updateEditField(f.key, e.target.value)}><option value="">—</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                        ) : (
                          <input className="ap-input" type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={editComp[f.key] ?? ''} onChange={e => updateEditField(f.key, e.target.value)} />
                        )}</>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="ap-modal-foot">
              <button className="btn btn-secondary" onClick={() => setEditComp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: borderC, padding: '1rem', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Market</div>
            <input value={market} onChange={e => setMarket(e.target.value)} style={{ width: 150, ...sel }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>County</div>
            <select value={county} onChange={e => setCounty(e.target.value)} style={sel}>
              <option value="">All</option>
              {counties.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Sub-Market</div>
            <select value={subMarket} onChange={e => setSubMarket(e.target.value)} style={sel}>
              <option value="">All</option>
              {subMarkets.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Zip</div>
            <select value={zip} onChange={e => setZip(e.target.value)} style={sel}>
              <option value="">All</option>
              {zips.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Era</div>
            <select value={era} onChange={e => setEra(e.target.value)} style={sel}>
              <option value="">All</option>
              {eras.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Date Range</div>
            <select value={dateRange} onChange={e => setDateRange(Number(e.target.value))} style={sel}>
              {DATE_RANGES.map(d => <option key={d.days} value={d.days}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Unit Range</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={minUnits} onChange={e => setMinUnits(Number(e.target.value) || 0)} style={{ width: 50, ...sel }} />
              <span style={{ fontSize: 11, color: '#888' }}>–</span>
              <input type="number" value={maxUnits} onChange={e => setMaxUnits(Number(e.target.value) || 999)} style={{ width: 50, ...sel }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
          {baseFiltered.length} comps matched · {activeComps.length} in stats · {marketingComps.length} in marketing
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...groupCell, width: 130, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, background: hdrBg }}>Market Stats</th>
              {colFilters.map((col, i) => (
                <th key={i} style={{ padding: cellPad, fontSize: 11, fontWeight: 600, textAlign: 'center', background: col.era ? eraBg : hdrBg, borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }}>
                  {col.era ? col.label + '+Era' : col.label}
                </th>
              ))}
            </tr>
            <tr>
              <td style={{ padding: '3px 8px', fontSize: 10, color: '#888', background: '#fff', borderBottom: borderC, borderRight: borderC, position: 'sticky', left: 0, zIndex: 2 }}></td>
              {colFilters.map((col, i) => {
                const geoVal = col.label === 'Market' ? market : col.label === 'County' ? county : col.label === 'Sub-Mkt' ? subMarket : zip
                return (
                  <td key={i} style={{ padding: '3px 8px', fontSize: 10, color: '#888', textAlign: 'center', background: col.era ? eraBg : '#fff', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }}>
                    {col.era ? (era || 'All Eras') : (geoVal || '—')}
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROW_GROUPS.map(group => (
              [
                <tr key={group.label + '-hdr'}>
                  <td colSpan={colFilters.length + 1} style={groupCell}>{group.label}</td>
                </tr>,
                ...STAT_STATUSES.map(status => {
                  if (group.key === 'escrow' && status !== 'Sold') return null
                  return (
                    <tr key={group.label + '-' + status}>
                      <td style={{ ...labelCell, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{status}</td>
                      {colFilters.map((col, ci) => {
                        const d = getColData(col.fn, status)
                        const v = d[group.key]
                        const display = group.key === 'count' ? (v || 0) : group.fmt(v)
                        return <td key={ci} style={cellStyle(col.era)}>{display}</td>
                      })}
                    </tr>
                  )
                }).filter(Boolean)
              ]
            )).flat()}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
        <div style={{ padding: '10px 14px', borderBottom: borderC, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>COMPS ({baseFiltered.length})</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggleAll} style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '0.5px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>
              {excluded.size === 0 ? 'Deselect all stats' : 'Select all stats'}
            </button>
            <button onClick={toggleAllMktg} style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '0.5px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>
              {excludedMktg.size === 0 ? 'Deselect all mktg' : 'Select all mktg'}
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ padding: cellPad, borderBottom: borderC, width: 40, fontSize: 9, textAlign: 'center', color: '#888' }}>Stats</th>
              <th style={{ padding: cellPad, borderBottom: borderC, width: 40, fontSize: 9, textAlign: 'center', color: '#888' }}>Mktg</th>
              {compTh('Status', '_st')}
              {compTh('Property', 'property_name')}
              {compTh('Sub-Market', 'sub_market')}
              {compTh('Units', 'num_units')}
              {compTh('Era', 'year_built_era')}
              {compTh('Listing Date', 'listing_date')}
              {compTh('Pending Date', 'pending_date')}
              {compTh('Sale Date', 'sale_date')}
              {compTh('$/Unit', '_dispPPU')}
              {compTh('$/SF', '_dispPSF')}
              {compTh('Cap', '_dispCap')}
              {compTh('GRM', '_dispGRM')}
              {compTh('Active DOM', '_activeDom')}
              {compTh('Total DOM', '_totalDom')}
              {compTh('Escrow', '_escrow')}
              <th style={{ padding: cellPad, borderBottom: borderC, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {compTableData.length === 0 && (
              <tr><td colSpan={18} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No comps match the current filters.</td></tr>
            )}
            {compTableData.map(c => {
              const isExcl = excluded.has(c.id)
              const isExclM = excludedMktg.has(c.id)
              const dimmed = isExcl && isExclM
              const stStyle = c._st === 'Sold' ? { bg: '#E1F5EE', color: '#085041' } : c._st === 'Active' ? { bg: '#E6F1FB', color: '#0C447C' } : { bg: '#FAEEDA', color: '#633806' }
              return (
                <tr key={c.id} style={{ opacity: dimmed ? 0.4 : 1, background: dimmed ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                    <input type="checkbox" checked={!isExcl} onChange={() => toggleExclude(c.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                    <input type="checkbox" checked={!isExclM} onChange={() => toggleExcludeMktg(c.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>
                    <span style={{ background: stStyle.bg, color: stStyle.color, padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{c._st}</span>
                  </td>
                  <td style={{ padding: cellPad, borderBottom: borderC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.property_name || c.sale_name || '—'}
                  </td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{c.sub_market || '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c.num_units || '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, fontSize: 11 }}>{c.year_built_era || '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtDate(c.listing_date)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtDate(c.pending_date)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtDate(c.sale_date)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fC(c._dispPPU)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fC(c._dispPSF)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtP(c._dispCap)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtX(c._dispGRM)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._activeDom != null ? c._activeDom : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._totalDom != null ? c._totalDom : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._escrow != null ? c._escrow : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                    <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#185FA5', padding: '1px 3px' }} title="Edit comp">✎</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}