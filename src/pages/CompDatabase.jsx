import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import Papa from 'papaparse'

const fC = v => v != null && v !== '' ? '$' + Math.round(v).toLocaleString() : '—'
const fP = v => v != null ? (v * 100).toFixed(1) + '%' : '—'
const fX = v => v != null ? v.toFixed(2) + 'x' : '—'
const fD = v => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'
const fDom = v => v != null ? v + 'd' : '—'

function parseDate(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d }
function daysBetween(a, b) { const da = parseDate(a), db = parseDate(b); if (!da || !db) return null; return Math.round(Math.abs((db - da) / 86400000)) }
function median(arr) { const c = arr.filter(v => v != null && isFinite(v)); if (!c.length) return null; const s = [...c].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

function calcFields(row) {
  const n = k => { const v = parseFloat(row[k]); return isNaN(v) ? null : v }
  const units = n('# of Units'), sf = n('Building Size (SF)')
  const listP = n('Listing Price'), saleP = n('Sale Price'), origP = n('Original Listing Price')
  const loan = n('Loan Amount'), agi = n('Adv - AGI'), noi = n('Adv - NOI')
  const xNoi = row['X - NOI'] === '1' || row['X - NOI'] === 1
  const xAgi = row['X - AGI'] === '1' || row['X - AGI'] === 1
  return {
    sale_id: row['Sale ID'], sf_property_id: row['Property ID'], mls_id: row['MLS ID'],
    status: row['Status'], sale_name: row['Sale Name'], property_name: row['Property Name'],
    building_sf: sf, year_built: n('Year Built'), year_built_era: row['Year Built Era'],
    listing_date: row['Listing Date'] || null, pending_date: row['Pending Date'] || null,
    sale_date: row['Sale Date'] || null,
    market: row['Market'], property_county: row['Property County'], sub_market: row['Sub-Market'],
    zip_code: row['Zip/Postal Code'], property_sub_type: row['Property Sub Type'],
    original_listing_price: origP, listing_price: listP, sale_price: saleP,
    num_units: units, sales_terms: row['Sales Terms'], loan_amount: loan,
    owner_occ_purchase: row['Owner Occ Purchase'] === '1',
    x_noi: xNoi, x_agi: xAgi, adv_agi: agi, adv_noi: noi,
  }
}

const compBadgeClass = s => s === 'Sold' ? 'active' : (s === 'Pending' || s === 'Under Contract') ? 'uc' : s === 'Active' ? 'prospect' : 'neutral'

const STATUS_OPTIONS = ['Active', 'Pending', 'Under Contract', 'Sold', 'CAN/EXP/WTH']

function addCalcFields(c) {
  const xAgi = c.x_agi, xNoi = c.x_noi
  const saleP = c.sale_price, listP = c.listing_price, origP = c.original_listing_price
  const units = c.num_units, sf = c.building_sf
  const agi = c.adv_agi, noi = c.adv_noi
  const domTotal = daysBetween(c.listing_date, c.sale_date)
  const domPending = daysBetween(c.listing_date, c.pending_date)
  const domToday = c.listing_date ? daysBetween(c.listing_date, new Date().toISOString()) : null
  return {
    ...c,
    _activeDom: c.listing_date ? (c.pending_date ? domPending : domToday) : null,
    _totalDom: domTotal,
    _escrow: daysBetween(c.pending_date, c.sale_date),
    _soldPPU: (saleP && units) ? saleP / units : null,
    _soldPSF: (saleP && sf) ? saleP / sf : null,
    _soldGRM: (!xAgi && agi && saleP) ? saleP / agi : null,
    _soldCap: (!xNoi && noi && saleP) ? noi / saleP : null,
    _delivered: (saleP && origP) ? saleP / origP : null,
    _aPPU: (listP && units) ? listP / units : null,
    _aGRM: (!xAgi && agi && listP) ? listP / agi : null,
    _aCap: (!xNoi && noi && listP) ? noi / listP : null,
  }
}

/* Click-to-edit field — hover grey, focus amber. Writes to the shared comps table. */
function EditableField({ value, type = 'text', options, fmt, onSave }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    const done = (v, commit) => { if (commit) onSave(v); setEditing(false) }
    if (type === 'select') {
      return (
        <select className="cdb-input" autoFocus defaultValue={value ?? ''}
          onChange={e => done(e.target.value, true)} onBlur={() => setEditing(false)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input className="cdb-input" autoFocus
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        defaultValue={type === 'date' && value ? String(value).slice(0, 10) : (value ?? '')}
        onBlur={e => done(e.target.value, true)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') done(null, false) }} />
    )
  }
  const disp = fmt ? fmt(value) : (value == null || value === '' ? '—' : value)
  return <span className="cdb-edit" tabIndex={0} role="button" onClick={() => setEditing(true)} onFocus={() => setEditing(true)}>{disp}</span>
}

export default function CompDatabase() {
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [subFilter, setSubFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [sortCol, setSortCol] = useState('sale_date')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => { loadComps() }, [])

  async function loadComps() {
    setLoading(true)
    let all = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data, error } = await supabase.from('comps').select('*')
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) { console.error(error); setMsg('Error loading comps'); break }
      all = all.concat(data || [])
      if (!data || data.length < pageSize) done = true
      else from += pageSize
    }
    setComps(all.map(addCalcFields))
    setLoading(false)
  }

  async function importComps(text) {
    setImporting(true)
    // CSV resilience: strip UTF-8 BOM + trim headers (Salesforce export quirks).
    const clean = text.replace(/^﻿/, '')
    const { data: rows } = Papa.parse(clean, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
    const records = rows.map(calcFields).filter(r => r.sale_id)
    // NOTE (deferred · remodel §5): re-import upserts by sale_id and will overwrite any
    // manual inline edits. The CSV-vs-manual merge/conflict rule is intentionally deferred
    // until the move off Salesforce — revisit then.
    const chunkSize = 50
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize)
      const { error } = await supabase.from('comps').upsert(chunk, { onConflict: 'sale_id' })
      if (error) { console.error(error); setMsg('Import error — check console'); setImporting(false); return }
    }
    const matched = await autoMatchCompsToProperties(records)
    setMsg(`${records.length} comps imported` + (matched ? ` · ${matched} linked to properties` : ''))
    setTimeout(() => setMsg(''), 5000)
    setShowPaste(false)
    setPasteText('')
    setImporting(false)
    loadComps()
  }

  async function autoMatchCompsToProperties(comps) {
    const sfIds = [...new Set(comps.map(c => c.sf_property_id).filter(Boolean))]
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

  // Inline edit → write to the SHARED comps table (affects every proposal's comp pool).
  async function updateCompField(id, field, value, type) {
    let v = value
    if (type === 'number') v = (value === '' || value == null) ? null : Number(value)
    else if (type === 'date') v = value || null
    else if (type === 'bool') v = !!value
    else v = value === '' ? null : value
    setComps(prev => prev.map(c => c.id === id ? addCalcFields({ ...c, [field]: v }) : c))
    const { error } = await supabase.from('comps').update({ [field]: v }).eq('id', id)
    if (error) { console.error(error); setMsg('Save failed: ' + error.message); setTimeout(() => setMsg(''), 4000); loadComps(); return }
    setMsg('Saved · applies to all proposals')
    setTimeout(() => setMsg(''), 2500)
  }

  const filtered = comps.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false
    if (subFilter !== 'All' && c.sub_market !== subFilter) return false
    if (typeFilter !== 'All' && c.property_sub_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (![c.property_name, c.sale_name, c.sub_market, c.zip_code].some(v => (v || '').toLowerCase().includes(q))) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number') return bv - av
    return String(bv).localeCompare(String(av))
  })

  const sold = filtered.filter(c => c.status === 'Sold')
  const stats = {
    medPPU: median(sold.map(c => c._soldPPU)),
    medGRM: median(sold.map(c => c._soldGRM)),
    medCap: median(sold.map(c => c._soldCap)),
    medActiveDom: median(sold.map(c => c._activeDom)),
    medTotalDom: median(sold.map(c => c._totalDom)),
    medEscrow: median(sold.map(c => c._escrow)),
  }

  const submarkets = ['All', ...new Set(comps.map(c => c.sub_market).filter(Boolean))].sort()
  const subtypes = ['All', ...new Set(comps.map(c => c.property_sub_type).filter(Boolean))].sort()

  const selected = (selectedId && comps.find(c => c.id === selectedId)) || sorted[0] || null

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading comps…</div>

  return (
    <>
      <div className="ap-head">
        <div>
          <p className="ap-head-eyebrow">Comparable sales</p>
          <h1 className="ap-head-title">Comp Database</h1>
          <p className="ap-head-meta"><b>{comps.length.toLocaleString()}</b> comps · feeds every proposal{msg && <span style={{ color: 'var(--pos)', marginLeft: 10 }}>{msg}</span>}</p>
        </div>
        <div className="ap-head-actions">
          <button className="btn btn-primary" onClick={() => setShowPaste(p => !p)}>{comps.length ? '+ Update comps' : 'Import comps'}</button>
        </div>
      </div>

      {showPaste && (
        <div className="ap-import">
          <div className="ap-import-box">
            <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Open your Salesforce CSV in TextEdit → Cmd+A → Cmd+C → paste below:</p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste CSV content here…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => importComps(pasteText)} disabled={importing || !pasteText.trim()}>
                {importing ? 'Importing…' : 'Import'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowPaste(false); setPasteText('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {comps.length === 0 ? (
        <div className="ap-tablewrap">
          <div className="ap-table-empty" style={{ paddingTop: '4rem' }}>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>No comps yet</p>
            <p style={{ fontSize: 13, marginBottom: '1.25rem' }}>Import your Salesforce CSV to get started.</p>
            <button className="btn btn-primary" onClick={() => setShowPaste(true)}>Import comps</button>
          </div>
        </div>
      ) : (
        <>
          <div className="cdb-kpis">
            {[
              { l: 'Total comps', v: comps.length.toLocaleString() },
              { l: 'Sold comps', v: sold.length.toLocaleString() },
              { l: 'Median $/unit', v: stats.medPPU ? fC(stats.medPPU) : '—' },
              { l: 'Median GRM', v: stats.medGRM ? fX(stats.medGRM) : '—' },
              { l: 'Median cap', v: stats.medCap ? fP(stats.medCap) : '—' },
              { l: 'Med Active DOM', v: stats.medActiveDom != null ? Math.round(stats.medActiveDom) + 'd' : '—' },
              { l: 'Med Total DOM', v: stats.medTotalDom != null ? Math.round(stats.medTotalDom) + 'd' : '—' },
              { l: 'Med Escrow', v: stats.medEscrow != null ? Math.round(stats.medEscrow) + 'd' : '—' },
            ].map(s => (
              <div className="cdb-kpi" key={s.l}>
                <p className="cdb-kpi-l">{s.l}</p>
                <p className="cdb-kpi-v">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <span className="ap-search-icon">⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, sub-market, zip…" />
            </div>
            <div className="cdb-selects">
              <select className="cdb-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {['All', 'Sold', 'Active', 'Pending'].map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
              </select>
              <select className="cdb-select" value={subFilter} onChange={e => setSubFilter(e.target.value)}>
                {submarkets.map(s => <option key={s} value={s}>{s === 'All' ? 'All sub-markets' : s}</option>)}
              </select>
              <select className="cdb-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                {subtypes.map(s => <option key={s} value={s}>{s === 'All' ? 'All types' : s}</option>)}
              </select>
              <select className="cdb-select" value={sortCol} onChange={e => setSortCol(e.target.value)}>
                <option value="sale_date">Sort: Sale date</option>
                <option value="sale_price">Sort: Sale price</option>
                <option value="_soldPPU">Sort: $/unit</option>
                <option value="num_units">Sort: Units</option>
              </select>
            </div>
            <span className="ap-toolbar-meta">Showing {sorted.length.toLocaleString()} of {comps.length.toLocaleString()}</span>
          </div>

          <div className="pl-split">
            <div className="pl-split-list">
              <div className="pl-rows">
                {sorted.map(c => (
                  <div key={c.id} className={`pl-row ${selected && c.id === selected.id ? 'is-sel' : ''}`} onClick={() => setSelectedId(c.id)}>
                    <div>
                      <div className="pl-row-addr">{c.property_name || c.sale_name || '—'}</div>
                      <div className="pl-row-sub">{[c.sub_market, c.num_units ? `${c.num_units} units` : null, c.year_built_era].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div>
                      <div className="pl-row-fig">{fC(c.sale_price || c.listing_price)}</div>
                      <div className="pl-row-figsub">{c._soldPPU ? `${fC(c._soldPPU)}/unit · ` : ''}{c.status || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {selected && <CompPreview c={selected} onEdit={updateCompField} />}
          </div>
        </>
      )}
    </>
  )
}

function CompPreview({ c, onEdit }) {
  // editable field → writes raw column to shared comps table
  const ef = (field, type, fmt, options) => (
    <EditableField value={c[field]} type={type} fmt={fmt} options={options} onSave={v => onEdit(c.id, field, v, type)} />
  )
  const fact = (label, node) => (
    <div className="pr-fact"><span className="pr-fact-l">{label}</span><span className="pr-fact-v">{node}</span></div>
  )
  const computed = (label, value) => (
    <div className="pr-fact"><span className="pr-fact-l">{label}</span><span className={`pr-fact-v ${value === '—' ? 'dash' : ''}`}>{value}</span></div>
  )

  return (
    <aside className="pl-preview">
      <div className="pl-preview-bar">
        <span className="pl-preview-crumb">Comp preview · click a value to edit</span>
        <span className={`ap-badge ${compBadgeClass(c.status)}`}>{c.status || '—'}</span>
      </div>

      <CompPhoto comp={c} onSave={onEdit} />

      <div className="pl-preview-body">
        <h2 className="pl-preview-title">{ef('property_name', 'text')}</h2>
        <p className="pl-preview-meta">{[c.sale_name, c.sub_market].filter(Boolean).join(' · ') || '—'}</p>
        <p className="cdb-cue" style={{ marginBottom: 4 }}>Edits write to the shared comp database — they apply to every proposal.</p>

        <p className="pr-card-h" style={{ marginTop: 12 }}>Sale</p>
        <div className="pr-facts solo">
          {fact('Status', ef('status', 'select', null, STATUS_OPTIONS))}
          {fact('Listing date', ef('listing_date', 'date', fD))}
          {fact('Pending date', ef('pending_date', 'date', fD))}
          {fact('Sale date', ef('sale_date', 'date', fD))}
          {fact('Original list', ef('original_listing_price', 'number', fC))}
          {fact('Listing price', ef('listing_price', 'number', fC))}
          {fact('Sale price', ef('sale_price', 'number', fC))}
          {computed('Sold $/unit', fC(c._soldPPU))}
          {computed('$ / SF', fC(c._soldPSF))}
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Returns &amp; velocity</p>
        <div className="pr-facts">
          {computed('Cap rate', c.x_noi ? 'Excl.' : fP(c._soldCap))}
          {computed('GRM', c.x_agi ? 'Excl.' : fX(c._soldGRM))}
          {fact('NOI (adv)', ef('adv_noi', 'number', fC))}
          {fact('AGI (adv)', ef('adv_agi', 'number', fC))}
          {fact('Units', ef('num_units', 'number'))}
          {fact('Building SF', ef('building_sf', 'number', v => v != null ? Number(v).toLocaleString() : '—'))}
          {fact('Era', ef('year_built_era', 'text'))}
          {fact('Year built', ef('year_built', 'number'))}
          {computed('Active DOM', fDom(c._activeDom))}
          {computed('Total DOM', fDom(c._totalDom))}
          {computed('Escrow', fDom(c._escrow))}
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Location</p>
        <div className="pr-facts">
          {fact('Market', ef('market', 'text'))}
          {fact('County', ef('property_county', 'text'))}
          {fact('Sub-market', ef('sub_market', 'text'))}
          {fact('Zip', ef('zip_code', 'text'))}
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Terms &amp; data flags</p>
        <div className="pr-facts solo">
          {fact('Loan amount', ef('loan_amount', 'number', fC))}
          {fact('Sales terms', ef('sales_terms', 'text'))}
        </div>
        <label className="cdb-flag"><input type="checkbox" checked={!!c.x_noi} onChange={e => onEdit(c.id, 'x_noi', e.target.checked, 'bool')} /> Exclude NOI from cap-rate stats</label>
        <label className="cdb-flag"><input type="checkbox" checked={!!c.x_agi} onChange={e => onEdit(c.id, 'x_agi', e.target.checked, 'bool')} /> Exclude AGI from GRM stats</label>
        <label className="cdb-flag" style={{ borderBottom: 'none' }}><input type="checkbox" checked={!!c.owner_occ_purchase} onChange={e => onEdit(c.id, 'owner_occ_purchase', e.target.checked, 'bool')} /> Owner-occupied purchase</label>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Notes</p>
        <textarea key={c.id} className="cdb-notes" defaultValue={c.notes || ''} placeholder="Add a note…"
          onBlur={e => { if ((e.target.value || '') !== (c.notes || '')) onEdit(c.id, 'notes', e.target.value, 'text') }} />
      </div>
    </aside>
  )
}

/* Comp photo — single image stored in the comp-photos bucket; URL saved to comps.photo. */
function CompPhoto({ comp, onSave }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = `${comp.id}/${fileName}`
    const { error } = await supabase.storage.from('comp-photos').upload(filePath, file)
    if (error) { console.error(error) }
    else {
      const { data: { publicUrl } } = supabase.storage.from('comp-photos').getPublicUrl(filePath)
      await onSave(comp.id, 'photo', publicUrl, 'text')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function remove() {
    if (comp.photo) {
      const parts = comp.photo.split('/comp-photos/')
      if (parts.length === 2) await supabase.storage.from('comp-photos').remove([decodeURIComponent(parts[1])])
    }
    await onSave(comp.id, 'photo', null, 'text')
  }

  return (
    <div className="cdb-photo" style={comp.photo ? { backgroundImage: `url(${comp.photo})` } : undefined}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} />
      {!comp.photo && <span className="cdb-photo-label">No photo</span>}
      <div className="cdb-photo-actions">
        <button className="cdb-photo-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : comp.photo ? 'Replace' : '+ Add photo'}
        </button>
        {comp.photo && <button className="cdb-photo-btn" onClick={remove}>Remove</button>}
      </div>
    </div>
  )
}
