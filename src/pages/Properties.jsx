import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Papa from 'papaparse'

const ACTIVE_STAGES = ['Prospect', 'Proposal', 'Exclusive Rep', 'Active', 'Under Contract']

/* Visual stage→badge mapping. Forward-compatible with the §4a 3-stage model
   (New=blue / Working=amber / Archived=grey); real labels still shown.
   The actual 8→3 data migration happens in the Proposals phase. */
function stageBadgeClass(stage) {
  if (stage === 'Prospect') return 'prospect'
  if (stage === 'Sold' || stage === 'Lost') return 'neutral'
  return 'working'
}

const fC = v => v ? '$' + Math.round(parseFloat(v)).toLocaleString() : '—'

function median(arr) {
  const c = arr.filter(v => v != null && isFinite(v))
  if (!c.length) return null
  const s = [...c].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

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

function parseDate(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d }

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d)) return '—'
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

const UNIT_RANGES = [
  { key: 'any',   label: 'Any',    test: () => true },
  { key: '2-4',   label: '2–4',    test: u => u >= 2 && u <= 4 },
  { key: '5-20',  label: '5–20',   test: u => u >= 5 && u <= 20 },
  { key: '21-50', label: '21–50',  test: u => u >= 21 && u <= 50 },
  { key: '51+',   label: '51+',    test: u => u >= 51 },
]

function FilterChip({ label, value, options, onChange }) {
  const muted = value === options[0].value
  return (
    <label className={`fchip ${muted ? 'is-muted' : ''}`}>
      <span className="fchip-label">{label}</span>
      <select className="fchip-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export default function Properties() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const [view, setView] = useState(routeId ? 'detail' : 'list')
  const [properties, setProperties] = useState([])
  const [selectedId, setSelectedId] = useState(routeId || null)
  const [previewId, setPreviewId] = useState(null)
  const [search, setSearch] = useState('')
  const [fType, setFType] = useState('all')
  const [fSubmkt, setFSubmkt] = useState('all')
  const [fEra, setFEra] = useState('all')
  const [fUnits, setFUnits] = useState('any')
  const [loading, setLoading] = useState(true)
  const [showPropImport, setShowPropImport] = useState(false)
  const [propPasteText, setPropPasteText] = useState('')
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef()
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (routeId) { setSelectedId(routeId); setView('detail') }
    else { setView('list') }
  }, [routeId])

  useEffect(() => { loadProperties() }, [])

  async function loadProperties() {
    setLoading(true)
    let all = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data } = await supabase.from('properties')
        .select('*, proposals(id, stage)')
        .order('street', { ascending: true })
        .range(from, from + pageSize - 1)
      all = all.concat(data || [])
      if (!data || data.length < pageSize) done = true
      else from += pageSize
    }
    setProperties(all)
    setLoading(false)
  }

  // Read a chosen .csv file and run it through the same importer (avoids paste/clipboard
  // truncation of large exports — the cause of silently-dropped rows).
  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { importProperties(String(ev.target.result || '')); if (importFileRef.current) importFileRef.current.value = '' }
    reader.onerror = () => { setMsg('Could not read file'); setTimeout(() => setMsg(''), 4000); if (importFileRef.current) importFileRef.current.value = '' }
    reader.readAsText(file)
  }

  async function importProperties(text) {
    setImporting(true)
    const clean = (text || '').replace(/^﻿/, '')
    const { data: rows } = Papa.parse(clean, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
    const parsed = rows || []
    if (!parsed.length) { setMsg('No rows found — check the file/paste'); setTimeout(() => setMsg(''), 4000); setImporting(false); return }
    const withId = parsed.filter(r => r['Property: ID'] || r['Property ID'])
    const skipped = parsed.length - withId.length
    const seen = new Map()
    withId.forEach(r => seen.set(r['Property: ID'] || r['Property ID'], r))
    const unique = Array.from(seen.values())
    const dupes = withId.length - unique.length
    const g = (r, ...keys) => { for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k] } return null }
    const records = unique.map(r => ({
      sf_property_id: g(r, 'Property: ID', 'Property ID'),
      property_name: g(r, 'Property: Property Name', 'Property Name'),
      street: r['Street'],
      city: r['City'],
      state: r['State/Province'],
      zip: r['Zip/Postal Code'],
      county: r['Property County'],
      market: r['Market'],
      sub_market: r['Sub-Market'],
      neighborhood: r['Neighborhood'],
      property_status: r['Property Status'],
      property_sub_type: r['Property Sub Type'],
      property_class: r['Property Class'],
      owner_llc: r['Owner LLC'],
      owner_contact: g(r, 'Owner/Landlord Contact', 'Owner/Landlord Contact: Full Name'),
      last_sale_date: r['Last Sale Date'] || null,
      last_sale_amount: parseFloat(r['Last Sale Amount']) || null,
      last_sale_price_per_unit: parseFloat(r['Last Sale Price (per Unit)']) || null,
      last_cap_rate: parseFloat(r['Last Cap Rate (%)']) || null,
      total_units: parseInt(r['Total Units']) || null,
      num_buildings: parseInt(r['# of Buildings']) || null,
      num_floors: parseInt(r['# of Floors']) || null,
      building_sf: parseFloat(r['Total Building Area (SF)']) || null,
      land_area_acres: parseFloat(r['Land Area (Acre)']) || null,
      tax_id: r['Tax ID'],
      year_built: parseInt(r['Year Built']) || null,
      year_built_era: r['Year Built Era'],
    }))
    const chunkSize = 500
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize)
      setMsg(`Importing properties... ${Math.min(i + chunkSize, records.length).toLocaleString()} / ${records.length.toLocaleString()}`)
      const { error } = await supabase.from('properties').upsert(chunk, { onConflict: 'sf_property_id' })
      if (error) { console.error(error); setMsg(`Import error at row ${i}`); setImporting(false); return }
    }
    const matched = await autoMatchCompsToProperties(records)
    setMsg(`${records.length.toLocaleString()} properties imported` + (dupes ? ` · ${dupes.toLocaleString()} duplicates skipped` : '') + (skipped ? ` · ${skipped.toLocaleString()} row${skipped > 1 ? 's' : ''} skipped (missing Property ID)` : '') + (matched ? ` · ${matched} comps linked` : ''))
    setTimeout(() => setMsg(''), 6000)
    setShowPropImport(false)
    setPropPasteText('')
    setImporting(false)
    loadProperties()
  }

  async function autoMatchCompsToProperties(importedRecords) {
    const sfIds = [...new Set(importedRecords.map(r => r.sf_property_id).filter(Boolean))]
    if (!sfIds.length) return 0
    let allProps = []
    const chunkSize = 200
    for (let i = 0; i < sfIds.length; i += chunkSize) {
      const batch = sfIds.slice(i, i + chunkSize)
      const { data } = await supabase.from('properties').select('id, sf_property_id').in('sf_property_id', batch)
      if (data) allProps = allProps.concat(data)
    }
    if (!allProps.length) return 0
    const propMap = {}
    allProps.forEach(p => { propMap[p.sf_property_id] = p.id })
    let matched = 0
    for (const [sfId, propId] of Object.entries(propMap)) {
      const { data } = await supabase.from('comps').update({ property_id: propId }).eq('sf_property_id', sfId).is('property_id', null).select('id')
      if (data?.length) matched += data.length
    }
    return matched
  }

  const typeOpts = [{ value: 'all', label: 'All' }, ...[...new Set(properties.map(p => p.property_sub_type).filter(Boolean))].sort().map(v => ({ value: v, label: v }))]
  const submktOpts = [{ value: 'all', label: 'All' }, ...[...new Set(properties.map(p => p.sub_market).filter(Boolean))].sort().map(v => ({ value: v, label: v }))]
  const eraOpts = [{ value: 'all', label: 'Any' }, ...[...new Set(properties.map(p => p.year_built_era).filter(Boolean))].sort().map(v => ({ value: v, label: v }))]
  const unitOpts = UNIT_RANGES.map(r => ({ value: r.key, label: r.label }))

  const filtered = properties.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const hit = (p.street || '').toLowerCase().includes(q) ||
        (p.property_name || '').toLowerCase().includes(q) ||
        (p.owner_llc || '').toLowerCase().includes(q) ||
        (p.owner_contact || '').toLowerCase().includes(q)
      if (!hit) return false
    }
    if (fType !== 'all' && p.property_sub_type !== fType) return false
    if (fSubmkt !== 'all' && p.sub_market !== fSubmkt) return false
    if (fEra !== 'all' && p.year_built_era !== fEra) return false
    if (fUnits !== 'any') {
      const r = UNIT_RANGES.find(x => x.key === fUnits)
      const u = parseInt(p.total_units)
      if (!u || !r.test(u)) return false
    }
    return true
  })

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading…</div>

  if (view === 'detail') return (
    <PropertyDetail propertyId={selectedId} onBack={() => { navigate('/properties'); loadProperties() }} />
  )

  return (
    <>
      <div className="ap-head">
        <div>
          <p className="ap-head-eyebrow">System of record</p>
          <h1 className="ap-head-title">Properties</h1>
          <p className="ap-head-meta">
            <b>{properties.length.toLocaleString()}</b> properties
            {msg && <span style={{ color: 'var(--pos)', marginLeft: 10 }}>{msg}</span>}
          </p>
        </div>
        <div className="ap-head-actions">
          <button className="btn btn-secondary" onClick={() => setShowPropImport(p => !p)}>Import properties</button>
        </div>
      </div>

      <div className="ap-toolbar">
        <div className="ap-search">
          <span className="ap-search-icon">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by address, name, or owner…" />
        </div>
        <div className="ap-filters">
          <FilterChip label="Type" value={fType} options={typeOpts} onChange={setFType} />
          <FilterChip label="Units" value={fUnits} options={unitOpts} onChange={setFUnits} />
          <FilterChip label="Sub-market" value={fSubmkt} options={submktOpts} onChange={setFSubmkt} />
          <FilterChip label="Era" value={fEra} options={eraOpts} onChange={setFEra} />
        </div>
        <span className="ap-toolbar-meta">Showing {filtered.length.toLocaleString()} of {properties.length.toLocaleString()}</span>
      </div>

      {showPropImport && (
        <div className="ap-import">
          <div className="ap-import-box">
            <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}><b>Upload your property CSV file</b> — recommended (handles the full export; avoids paste truncation).</p>
            <input ref={importFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImportFile} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => importFileRef.current?.click()} disabled={importing}>
                {importing ? 'Importing…' : 'Choose CSV file…'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>Or paste CSV text (TextEdit → Cmd+A → Cmd+C) — fine for small batches:</p>
            <textarea value={propPasteText} onChange={e => setPropPasteText(e.target.value)} placeholder="Paste property CSV here…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => importProperties(propPasteText)} disabled={importing || !propPasteText.trim()}>
                {importing ? 'Importing…' : 'Import pasted text'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowPropImport(false); setPropPasteText('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {previewId ? (
        <div className="pl-split">
          <div className="pl-split-list">
            <div className="pl-rows">
              {filtered.map(p => {
                const activeProposal = (p.proposals || []).find(pr => ACTIVE_STAGES.includes(pr.stage))
                return (
                  <div key={p.id} className={`pl-row ${p.id === previewId ? 'is-sel' : ''}`} onClick={() => setPreviewId(p.id)}>
                    <div>
                      <div className="pl-row-addr">{p.street || p.property_name || 'Untitled'}</div>
                      <div className="pl-row-sub">{[p.sub_market, p.total_units ? `${p.total_units} units` : null, p.property_sub_type].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div>
                      <div className="pl-row-fig">{fC(p.last_sale_amount)}</div>
                      <div className="pl-row-figsub">
                        {activeProposal ? `${activeProposal.stage} proposal` : p.last_sale_date ? `last sale ${p.last_sale_date}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <PropPreview
            p={properties.find(x => x.id === previewId)}
            onClose={() => setPreviewId(null)}
            onOpen={() => navigate(`/properties/${previewId}`)}
            onNewProposal={() => navigate(`/proposals?new&property=${previewId}`)}
          />
        </div>
      ) : (
        <div className="ap-tablewrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Sub-market</th>
                <th className="num">Units</th>
                <th>Type</th>
                <th className="num">Yr Built</th>
                <th className="num">Last Sale</th>
                <th>Proposal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="ap-table-empty">{properties.length === 0 ? 'No properties yet.' : 'No properties match your filters.'}</td></tr>
              ) : filtered.map(p => {
                const activeProposal = (p.proposals || []).find(pr => ACTIVE_STAGES.includes(pr.stage))
                return (
                  <tr key={p.id} onClick={() => setPreviewId(p.id)}>
                    <td>
                      <div className="ap-cell-primary">{p.street || p.property_name || 'Untitled'}</div>
                      <div className="ap-cell-sub">{[p.city, p.state, p.zip].filter(Boolean).join(', ')}</div>
                    </td>
                    <td><span className="ap-type">{p.sub_market || '—'}</span></td>
                    <td className="num">{p.total_units || '—'}</td>
                    <td><span className="ap-type">{p.property_sub_type || '—'}</span></td>
                    <td className="num">{p.year_built || '—'}</td>
                    <td className="num">
                      {p.last_sale_amount
                        ? <><span className="ap-cell-figure">{fC(p.last_sale_amount)}</span><div className="ap-cell-date">{p.last_sale_date || ''}</div></>
                        : <span className="ap-dash">—</span>}
                    </td>
                    <td>
                      {activeProposal
                        ? <span className={`ap-badge ${stageBadgeClass(activeProposal.stage)}`}>{activeProposal.stage}</span>
                        : <span className="ap-dash">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PropPreview({ p, onClose, onOpen, onNewProposal }) {
  if (!p) return (
    <aside className="pl-preview">
      <div className="pl-preview-bar">
        <span className="pl-preview-crumb">Preview</span>
        <button className="pl-preview-close" onClick={onClose}>✕ Back to table</button>
      </div>
      <div className="pl-preview-body"><div className="pr-empty">Select a property to preview.</div></div>
    </aside>
  )
  const photos = p.photos || []
  const activeProposal = (p.proposals || []).find(pr => ACTIVE_STAGES.includes(pr.stage))
  const fact = (l, v) => {
    const empty = v == null || v === ''
    return (
      <div className="pr-fact">
        <span className="pr-fact-l">{l}</span>
        <span className={`pr-fact-v ${empty ? 'dash' : ''}`}>{empty ? '—' : v}</span>
      </div>
    )
  }
  return (
    <aside className="pl-preview">
      <div className="pl-preview-bar">
        <span className="pl-preview-crumb">Preview</span>
        <button className="pl-preview-close" onClick={onClose}>✕ Back to table</button>
      </div>
      <div className="pr-photo" style={{ height: 124, borderRadius: 0, ...(photos[0] ? { backgroundImage: `url(${photos[0]})` } : {}) }}>
        {!photos[0] && <span className="pr-photo-label">Property photo</span>}
      </div>
      <div className="pl-preview-body">
        <h2 className="pl-preview-title">{p.street || p.property_name || 'Untitled'}</h2>
        <p className="pl-preview-meta">
          {[p.city, p.state, p.zip].filter(Boolean).join(', ')}
          {p.total_units ? ` · ${p.total_units} units` : ''}
          {p.property_sub_type ? ` · ${p.property_sub_type}` : ''}
        </p>

        <p className="pr-card-h" style={{ marginTop: 6 }}>Property</p>
        <div className="pr-facts solo">
          {fact('Year built', [p.year_built, p.year_built_era].filter(Boolean).join(' · ') || null)}
          {fact('Building SF', p.building_sf ? p.building_sf.toLocaleString() : null)}
          {fact('Sub-market', p.sub_market)}
          {fact('Type', p.property_sub_type)}
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Ownership & sale</p>
        <div className="pr-facts solo">
          {fact('Owner LLC', p.owner_llc)}
          {fact('Contact', p.owner_contact)}
          {fact('Last sale', p.last_sale_date)}
          {fact('Last price', p.last_sale_amount ? '$' + Math.round(p.last_sale_amount).toLocaleString() : null)}
          {fact('Last $/unit', p.last_sale_price_per_unit ? '$' + Math.round(p.last_sale_price_per_unit).toLocaleString() : null)}
          <div className="pr-fact">
            <span className="pr-fact-l">Active proposal</span>
            <span className="pr-fact-v">
              {activeProposal
                ? <span className={`ap-badge ${stageBadgeClass(activeProposal.stage)}`}>{activeProposal.stage}</span>
                : <span className="dash">—</span>}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onNewProposal}>+ New proposal</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onOpen}>Open full record →</button>
        </div>
      </div>
    </aside>
  )
}

const EDIT_SECTIONS = [
  { label: 'Address', cols: 2, fields: [
    { key: 'street', label: 'Street' }, { key: 'property_name', label: 'Property name' },
    { key: 'city', label: 'City' }, { key: 'state', label: 'State' },
    { key: 'zip', label: 'Zip' }, { key: 'county', label: 'County' },
  ]},
  { label: 'Location', cols: 3, fields: [
    { key: 'market', label: 'Market' }, { key: 'sub_market', label: 'Sub-Market' }, { key: 'neighborhood', label: 'Neighborhood' },
  ]},
  { label: 'Building', cols: 3, fields: [
    { key: 'total_units', label: 'Total units', type: 'number' },
    { key: 'num_buildings', label: '# of buildings', type: 'number' },
    { key: 'building_sf', label: 'Building SF', type: 'number' },
    { key: 'year_built', label: 'Year built', type: 'number' },
    { key: 'year_built_era', label: 'Year built era' },
    { key: 'property_sub_type', label: 'Property type' },
    { key: 'property_class', label: 'Property class' },
    { key: 'land_area_acres', label: 'Land area (acres)', type: 'number' },
    { key: 'num_floors', label: '# of floors', type: 'number' },
  ]},
  { label: 'Ownership', cols: 2, fields: [
    { key: 'owner_llc', label: 'Owner LLC' }, { key: 'owner_contact', label: 'Owner contact' },
    { key: 'tax_id', label: 'Tax ID' },
  ]},
]

function PropertyDetail({ propertyId, onBack }) {
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)

  const [photoModal, setPhotoModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const fileRef = useRef()

  const [comps, setComps] = useState([])
  const [proposals, setProposals] = useState([])
  const [allComps, setAllComps] = useState([])

  useEffect(() => { loadAll() }, [propertyId])

  async function loadAll() {
    setLoading(true)
    const [{ data: prop }, { data: props }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', propertyId).single(),
      supabase.from('proposals').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }),
    ])
    setProperty(prop)
    setProposals(props || [])

    if (prop?.sf_property_id) {
      const { data: matchedComps } = await supabase.from('comps')
        .select('*')
        .eq('sf_property_id', prop.sf_property_id)
        .order('sale_date', { ascending: false, nullsFirst: false })
      setComps(matchedComps || [])
    } else {
      setComps([])
    }

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
    setAllComps(all)
    setLoading(false)
  }

  function openEdit() {
    const f = {}
    EDIT_SECTIONS.forEach(s => s.fields.forEach(field => { f[field.key] = property[field.key] ?? '' }))
    setEditFields(f)
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    const updates = {}
    EDIT_SECTIONS.forEach(s => s.fields.forEach(field => {
      let v = editFields[field.key]
      if (field.type === 'number') v = v === '' ? null : Number(v)
      else v = v || null
      updates[field.key] = v
    }))
    const { error } = await supabase.from('properties').update(updates).eq('id', propertyId)
    if (error) { console.error(error); setSaving(false); return }
    setSaving(false)
    setEditing(false)
    setMsg('Property saved')
    setTimeout(() => setMsg(''), 2000)
    loadAll()
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    const photos = property.photos || []
    const newUrls = []
    for (const file of files) {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const filePath = `${property.id}/${fileName}`
      const { error } = await supabase.storage.from('property-photos').upload(filePath, file)
      if (error) { console.error(error); setPhotoMsg(`Upload error: ${error.message}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
      newUrls.push(publicUrl)
    }
    if (newUrls.length) {
      const updated = [...photos, ...newUrls]
      await supabase.from('properties').update({ photos: updated }).eq('id', property.id)
      setPhotoMsg(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded`)
      setTimeout(() => setPhotoMsg(''), 3000)
      loadAll()
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deletePhoto(url) {
    const photos = property.photos || []
    const parts = url.split('/property-photos/')
    if (parts.length < 2) return
    const path = decodeURIComponent(parts[1])
    await supabase.storage.from('property-photos').remove([path])
    const updated = photos.filter(p => p !== url)
    await supabase.from('properties').update({ photos: updated }).eq('id', property.id)
    loadAll()
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading…</div>
  if (!property) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Not found</div>

  const pr = property
  const photos = pr.photos || []
  const fact = (l, v) => {
    const empty = v == null || v === ''
    return (
      <div className="pr-fact">
        <span className="pr-fact-l">{l}</span>
        <span className={`pr-fact-v ${empty ? 'dash' : ''}`}>{empty ? '—' : v}</span>
      </div>
    )
  }

  return (
    <div className="pr">
      {/* Edit modal */}
      {editing && (
        <div className="ap-modal-overlay" onClick={() => setEditing(false)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-modal-head">
              <h3 className="ap-modal-title">Edit property</h3>
              <button className="ap-modal-close" onClick={() => setEditing(false)}>×</button>
            </div>
            {EDIT_SECTIONS.map(section => (
              <div key={section.label} style={{ marginBottom: 16 }}>
                <div className="ap-field-section">{section.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${section.cols}, 1fr)`, gap: 8 }}>
                  {section.fields.map(f => (
                    <div key={f.key}>
                      <label className="ap-field-label">{f.label}</label>
                      <input className="ap-input" type={f.type === 'number' ? 'number' : 'text'} value={editFields[f.key] ?? ''}
                        onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="ap-modal-foot">
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo modal */}
      {photoModal && (
        <div className="ap-modal-overlay" onClick={() => setPhotoModal(false)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-modal-head">
              <h3 className="ap-modal-title">Photos</h3>
              <button className="ap-modal-close" onClick={() => setPhotoModal(false)}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUpload} style={{ display: 'none' }} />
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : '+ Upload photos'}</button>
              {photoMsg && <span style={{ fontSize: 12, color: 'var(--pos)' }}>{photoMsg}</span>}
            </div>
            {photos.length === 0 ? (
              <div className="pr-empty">No photos yet. Click "Upload photos" to add images.</div>
            ) : (
              <div className="ap-photo-grid">
                {photos.map((url, i) => (
                  <div key={i} className="ap-photo-cell">
                    <img src={url} alt="" />
                    <button className="ap-photo-del" onClick={() => deletePhoto(url)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="pr-hero">
        <div className="pr-photo" style={photos[0] ? { backgroundImage: `url(${photos[0]})` } : undefined}>
          {!photos[0] && <span className="pr-photo-label">Property photo</span>}
          <button className="pr-photo-manage" onClick={() => setPhotoModal(true)}>
            {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : '+ Add photo'}
          </button>
        </div>
        <div className="pr-hero-r">
          <button className="pr-back" onClick={onBack}>‹ Properties</button>
          <h1 className="pr-title">{pr.street || pr.property_name || 'Untitled'}</h1>
          <p className="pr-meta">
            {[pr.city, pr.state, pr.zip].filter(Boolean).join(', ')}
            {pr.total_units ? <> · <b>{pr.total_units} units</b></> : ''}
            {pr.property_sub_type ? ` · ${pr.property_sub_type}` : ''}
            {pr.year_built ? ` · Built ${pr.year_built}` : ''}
          </p>
          <div className="pr-hero-actions">
            <button className="btn btn-secondary" onClick={openEdit}>Edit</button>
            <button className="btn btn-primary" onClick={() => navigate(`/proposals?new&property=${propertyId}`)}>+ New proposal</button>
          </div>
          {msg && <p style={{ fontSize: 12, color: 'var(--pos)', marginTop: 8 }}>{msg}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="pr-body">
        {/* LEFT — facts */}
        <div className="pr-col">
          <div className="pr-card">
            <p className="pr-card-h">Property</p>
            <div className="pr-facts">
              {fact('Sub-market', pr.sub_market)}
              {fact('Market', pr.market)}
              {fact('Type', pr.property_sub_type)}
              {fact('Total units', pr.total_units)}
              {fact('Building SF', pr.building_sf ? pr.building_sf.toLocaleString() : null)}
              {fact('Year built', pr.year_built)}
              {fact('Era', pr.year_built_era)}
              {fact('# buildings', pr.num_buildings)}
              {fact('Class', pr.property_class)}
              {fact('Tax ID', pr.tax_id)}
            </div>
          </div>
          <div className="pr-card">
            <p className="pr-card-h">Ownership</p>
            <div className="pr-facts">
              {fact('Owner LLC', pr.owner_llc)}
              {fact('Contact', pr.owner_contact)}
              {fact('Last sale', pr.last_sale_date)}
              {fact('Last price', pr.last_sale_amount ? '$' + Math.round(pr.last_sale_amount).toLocaleString() : null)}
              {fact('Last $/unit', pr.last_sale_price_per_unit ? '$' + Math.round(pr.last_sale_price_per_unit).toLocaleString() : null)}
              {fact('Last cap', pr.last_cap_rate ? pr.last_cap_rate + '%' : null)}
            </div>
          </div>
        </div>

        {/* RIGHT — market context + activity */}
        <div className="pr-col">
          <MarketContext property={property} allComps={allComps} />

          <div className="pr-card">
            <p className="pr-card-h">Proposals</p>
            {proposals.length === 0 ? (
              <div className="pr-empty">No proposals for this property.</div>
            ) : (
              <div className="pr-mini">
                {proposals.map(p => (
                  <div key={p.id} className="pr-mini-row clickable" onClick={() => navigate(`/proposals/${p.id}`)}>
                    <div>
                      <div className="pr-mini-l">{fC(p.asking_price)}</div>
                      <div className="pr-mini-sub">{p.stage}{p.date_created ? ` · ${p.date_created}` : ''}</div>
                    </div>
                    <span className={`ap-badge ${stageBadgeClass(p.stage)}`}>{p.stage}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pr-card">
            <p className="pr-card-h">Sale history</p>
            {comps.length === 0 ? (
              <div className="pr-empty">
                {pr.sf_property_id ? 'No comp records matched via Salesforce ID.' : 'No Salesforce ID — comps cannot be matched.'}
              </div>
            ) : (
              <div className="pr-mini">
                {comps.slice(0, 6).map(c => {
                  const price = c.sale_price || c.listing_price
                  const ppu = price && c.num_units ? price / c.num_units : null
                  return (
                    <div key={c.id} className="pr-mini-row">
                      <div>
                        <div className="pr-mini-l">
                          {c.status || '—'}
                          {c.sale_date ? ` · ${fmtDate(c.sale_date)}` : c.listing_date ? ` · Listed ${fmtDate(c.listing_date)}` : ''}
                        </div>
                        <div className="pr-mini-sub">
                          {c.sale_name || c.property_name || ''}{ppu ? ` · ${fC(ppu)}/unit` : ''}
                        </div>
                      </div>
                      <span className="pr-mini-r">{fC(price)}</span>
                    </div>
                  )
                })}
                {comps.length > 6 && <div className="pr-note">Showing 6 of {comps.length} matched sales</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MarketContext({ property, allComps }) {
  const [scope, setScope] = useState('sub_market')
  const [useEra, setUseEra] = useState(false)

  const pr = property
  const [minU, maxU] = unitRangeFromSubType(pr.property_sub_type, pr.total_units)

  const now = new Date()
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  function matchesScope(c) {
    if (scope === 'market') return pr.market && c.market === pr.market
    if (scope === 'county') return pr.county && c.property_county === pr.county
    if (scope === 'sub_market') return pr.sub_market && c.sub_market === pr.sub_market
    if (scope === 'zip') return pr.zip && String(c.zip_code) === String(pr.zip)
    return false
  }

  const scopeLabel = scope === 'market' ? pr.market : scope === 'county' ? pr.county : scope === 'sub_market' ? pr.sub_market : pr.zip
  const scopeName = scope === 'market' ? 'Market' : scope === 'county' ? 'County' : scope === 'sub_market' ? 'Sub-Market' : 'Zip'

  const baseComps = allComps.filter(c => {
    if (c.status !== 'Sold') return false
    if (!matchesScope(c)) return false
    const u = c.num_units
    if (u != null && (u < minU || u > maxU)) return false
    if (useEra && pr.year_built_era && c.year_built_era !== pr.year_built_era) return false
    return true
  })

  const currentComps = baseComps.filter(c => {
    const sd = parseDate(c.sale_date)
    return sd && sd >= sixMonthsAgo
  })
  const priorComps = baseComps.filter(c => {
    const sd = parseDate(c.sale_date)
    return sd && sd >= twelveMonthsAgo && sd < sixMonthsAgo
  })

  const curPPU = median(currentComps.map(c => c.sale_price && c.num_units ? c.sale_price / c.num_units : null))
  const priorPPU = median(priorComps.map(c => c.sale_price && c.num_units ? c.sale_price / c.num_units : null))
  const curCap = median(currentComps.map(c => !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null))
  const priorCap = median(priorComps.map(c => !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null))
  const curGRM = median(currentComps.map(c => !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null))
  const priorGRM = median(priorComps.map(c => !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null))
  const curVolume = currentComps.filter(c => c.sale_price).reduce((s, c) => s + c.sale_price, 0)
  const priorVolume = priorComps.filter(c => c.sale_price).reduce((s, c) => s + c.sale_price, 0)

  const metric = (label, cur, prior, fmt) => {
    const delta = (cur != null && prior != null && prior !== 0) ? ((cur - prior) / Math.abs(prior)) * 100 : null
    const cls = delta == null ? '' : delta >= 0 ? 'pos' : 'neg'
    const arrow = delta == null ? '' : delta >= 0 ? '▲' : '▼'
    return (
      <div className="pr-metric">
        <p className="pr-metric-l">{label}</p>
        <p className="pr-metric-v">{cur != null ? fmt(cur) : 'No data'}</p>
        <p className={`pr-metric-d ${cls}`}>{delta != null ? `${arrow} ${Math.abs(delta).toFixed(1)}% vs prior 6mo` : 'No prior data'}</p>
      </div>
    )
  }

  const scopes = [
    { key: 'market', label: 'Market' },
    { key: 'county', label: 'County' },
    { key: 'sub_market', label: 'Sub-Market' },
    { key: 'zip', label: 'Zip' },
  ]

  return (
    <div className="pr-card">
      <p className="pr-card-h">
        Market context
        <span className="pr-scope">
          {scopes.map(s => (
            <button key={s.key} className={scope === s.key ? 'is-on' : ''} onClick={() => setScope(s.key)}>{s.label}</button>
          ))}
        </span>
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="pr-scope">
          <button className={useEra ? 'is-on' : ''} onClick={() => setUseEra(v => !v)}>{useEra ? (pr.year_built_era || 'Era') : 'All eras'}</button>
        </span>
        <span style={{ fontSize: 11, color: 'var(--mute)' }}>
          {scopeName}: <b style={{ color: 'var(--ink)' }}>{scopeLabel || '—'}</b> · {currentComps.length} sold 6mo · {priorComps.length} prior
        </span>
      </div>
      <div className="pr-metrics">
        {metric('$ / Unit · sold', curPPU, priorPPU, v => '$' + Math.round(v).toLocaleString())}
        {metric('Cap rate · sold', curCap, priorCap, v => (v * 100).toFixed(2) + '%')}
        {metric('GRM · sold', curGRM, priorGRM, v => v.toFixed(2) + '×')}
        {metric('Volume · 6mo', curVolume || null, priorVolume || null, v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v).toLocaleString()))}
      </div>
    </div>
  )
}
