import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Papa from 'papaparse'

const fC = v => v != null ? '$' + Math.round(v).toLocaleString() : '—'
const fP = v => v != null ? (v * 100).toFixed(1) + '%' : '—'
const fX = v => v != null ? v.toFixed(2) + 'x' : '—'
const fD = v => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'

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

const STATUS_STYLE = {
  'Sold': { bg: '#E1F5EE', color: '#085041' },
  'Active': { bg: '#E6F1FB', color: '#0C447C' },
  'Pending': { bg: '#FAEEDA', color: '#633806' },
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
  const [sortDir, setSortDir] = useState('desc')
  const [editComp, setEditComp] = useState(null) // comp being edited

  useEffect(() => { loadComps() }, [])

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
    // Active DOM: listing → today, capped at pending date if exists
    _activeDom: c.listing_date ? (c.pending_date ? domPending : domToday) : null,
    // Total DOM: listing → sale
    _totalDom: domTotal,
    // Escrow Length: pending → sale
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
    const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true })
    const records = rows.map(calcFields).filter(r => r.sale_id)
    let added = 0, updated = 0
    const chunkSize = 50
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize)
      const { error } = await supabase.from('comps').upsert(chunk, { onConflict: 'sale_id' })
      if (error) { console.error(error); setMsg('Import error — check console'); setImporting(false); return }
      chunk.forEach(() => { added++ })
    }
    setMsg(`${records.length} comps imported successfully`)
    setTimeout(() => setMsg(''), 5000)
    setShowPaste(false)
    setPasteText('')
    setImporting(false)
    loadComps()
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
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
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

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const th = (label, col) => (
    <th onClick={() => toggleSort(col)} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', color: sortCol === col ? '#185FA5' : '#666', textAlign: 'left', userSelect: 'none' }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  // ── Edit modal helpers ──
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

  function openEdit(comp) {
    const form = {}
    EDIT_FIELDS.forEach(s => s.fields.forEach(f => {
      const v = comp[f.key]
      if (f.type === 'date' && v) {
        try { form[f.key] = new Date(v).toISOString().split('T')[0] } catch { form[f.key] = v || '' }
      } else if (f.type === 'checkbox') {
        form[f.key] = !!v
      } else {
        form[f.key] = v ?? ''
      }
    }))
    form._id = comp.id
    form._sale_id = comp.sale_id
    setEditComp(form)
  }

  function updateEditField(key, value) {
    setEditComp(prev => ({ ...prev, [key]: value }))
  }

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
    if (error) { console.error(error); setMsg('Save error'); return }
    setMsg('Comp updated')
    setTimeout(() => setMsg(''), 3000)
    setEditComp(null)
    loadComps()
  }

  const editInputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading comps...</div>

  return (
    <div>
      {/* ── EDIT MODAL ── */}
      {editComp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditComp(null)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '85vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Edit Comp — {editComp.property_name || editComp._sale_id}</h3>
              <button onClick={() => setEditComp(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            {EDIT_FIELDS.map(section => (
              <div key={section.section} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{section.section}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {section.fields.map(f => (
                    <div key={f.key} style={f.type === 'checkbox' ? { display: 'flex', alignItems: 'center', gap: 6 } : {}}>
                      {f.type === 'checkbox' ? (
                        <>
                          <input type="checkbox" checked={!!editComp[f.key]} onChange={e => updateEditField(f.key, e.target.checked)} />
                          <label style={{ fontSize: 12, color: '#555' }}>{f.label}</label>
                        </>
                      ) : (
                        <>
                          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>{f.label}</label>
                          {f.type === 'select' ? (
                            <select value={editComp[f.key] || ''} onChange={e => updateEditField(f.key, e.target.value)} style={editInputStyle}>
                              <option value="">—</option>
                              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={editComp[f.key] ?? ''} onChange={e => updateEditField(f.key, e.target.value)} style={editInputStyle} />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <button onClick={() => setEditComp(null)} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEdit} style={{ padding: '8px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Comp database</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{comps.length} comps · {msg && <span style={{ color: '#27500A' }}>{msg}</span>}</div>
        </div>
        <button onClick={() => setShowPaste(p => !p)} style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>
          {comps.length ? '+ Update comps' : 'Import comps'}
        </button>
      </div>

      {showPaste && (
        <div style={{ background: '#fff', border: '0.5px solid #378ADD', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Open your Salesforce CSV in TextEdit → Cmd+A → Cmd+C → paste below:</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste CSV content here..." style={{ width: '100%', minHeight: 100, border: '0.5px solid #ddd', borderRadius: 8, padding: 10, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => importComps(pasteText)} disabled={importing || !pasteText.trim()} style={{ padding: '7px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: importing ? 0.6 : 1 }}>
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button onClick={() => { setShowPaste(false); setPasteText('') }} style={{ padding: '7px 14px', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {comps.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: '1rem' }}>
            {[
              { l: 'Total comps', v: comps.length },
              { l: 'Showing', v: filtered.length },
              { l: 'Sold comps', v: sold.length },
              { l: 'Median $/unit', v: stats.medPPU ? fC(stats.medPPU) : '—' },
              { l: 'Median GRM', v: stats.medGRM ? fX(stats.medGRM) : '—' },
              { l: 'Median cap', v: stats.medCap ? fP(stats.medCap) : '—' },
              { l: 'Med Active DOM', v: stats.medActiveDom != null ? Math.round(stats.medActiveDom) + 'd' : '—' },
              { l: 'Med Total DOM', v: stats.medTotalDom != null ? Math.round(stats.medTotalDom) + 'd' : '—' },
              { l: 'Med Escrow', v: stats.medEscrow != null ? Math.round(stats.medEscrow) + 'd' : '—' },
            ].map(s => (
              <div key={s.l} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, sub-market, zip..." style={{ flex: '1 1 200px', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }}>
              {['All', 'Sold', 'Active', 'Pending'].map(s => <option key={s}>{s === 'All' ? 'All statuses' : s}</option>)}
            </select>
            <select value={subFilter} onChange={e => setSubFilter(e.target.value)} style={{ padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13, maxWidth: 160 }}>
              {submarkets.map(s => <option key={s} value={s}>{s === 'All' ? 'All sub-markets' : s}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }}>
              {subtypes.map(s => <option key={s} value={s}>{s === 'All' ? 'All types' : s}</option>)}
            </select>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1400 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
                  {th('Property', 'property_name')}
                  {th('Status', 'status')}
                  {th('Sub-market', 'sub_market')}
                  {th('Units', 'num_units')}
                  {th('Era', 'year_built_era')}
                  {th('Listing Date', 'listing_date')}
                  {th('Pending Date', 'pending_date')}
                  {th('Sale Date', 'sale_date')}
                  {th('Sale price', 'sale_price')}
                  {th('Sold $/unit', '_soldPPU')}
                  {th('GRM', '_soldGRM')}
                  {th('Cap', '_soldCap')}
                  {th('Active DOM', '_activeDom')}
                  {th('Total DOM', '_totalDom')}
                  {th('Escrow', '_escrow')}
                  {th('Terms', 'sales_terms')}
                  <th style={{ padding: '8px 10px', width: 40 }}></th>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={17} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No comps match filters</td></tr>
                )}
                {sorted.map((c, i) => {
                  const st = STATUS_STYLE[c.status] || { bg: '#f5f5f5', color: '#555' }
                  return (
                    <tr key={c.id} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.property_name || c.sale_name || '—'}</td>
                      <td style={{ padding: '8px 10px' }}><span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{c.status || '—'}</span></td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{c.sub_market || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.num_units || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{c.year_built_era || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{fD(c.listing_date)}</td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{fD(c.pending_date)}</td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{fD(c.sale_date)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.sale_price ? fC(c.sale_price) : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c._soldPPU ? fC(c._soldPPU) : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.x_agi ? <span style={{ color: '#999', fontSize: 11 }}>N/A</span> : (c._soldGRM ? fX(c._soldGRM) : '—')}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.x_noi ? <span style={{ color: '#999', fontSize: 11 }}>N/A</span> : (c._soldCap ? fP(c._soldCap) : '—')}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c._activeDom != null ? c._activeDom + 'd' : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c._totalDom != null ? c._totalDom + 'd' : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c._escrow != null ? c._escrow + 'd' : '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#555' }}>{c.sales_terms || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#185FA5', padding: '2px 4px' }} title="Edit comp">✎</button>
                      </td>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{sorted.length} of {comps.length} comps · click headers to sort · N/A = flagged financials</p>
        </>
      )}

      {comps.length === 0 && !showPaste && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: '#333' }}>No comps yet</p>
          <p style={{ fontSize: 13, marginBottom: '1.5rem' }}>Import your Salesforce CSV to get started</p>
          <button onClick={() => setShowPaste(true)} style={{ padding: '8px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>Import comps</button>
        </div>
      )}
    </div>
  )
}