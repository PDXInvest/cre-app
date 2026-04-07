import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Papa from 'papaparse'
import RentRoll from './RentRoll'
import Financials from './Financials'

const STAGES = ['Prospect', 'Proposal', 'Exclusive Rep', 'Active', 'Under Contract', 'Sold', 'Lost']
const STAGE_STYLE = {
  'Prospect':      { bg: '#F1EFE8', color: '#5F5E5A' },
  'Proposal':      { bg: '#E6F1FB', color: '#0C447C' },
  'Exclusive Rep': { bg: '#EEEDFE', color: '#3C3489' },
  'Active':        { bg: '#E1F5EE', color: '#085041' },
  'Under Contract':{ bg: '#FAEEDA', color: '#633806' },
  'Sold':          { bg: '#EAF3DE', color: '#27500A' },
  'Lost':          { bg: '#FCEBEB', color: '#791F1F' },
}

const fC = v => v ? '$' + Math.round(parseFloat(v)).toLocaleString() : '—'

export default function Proposals() {
  const [view, setView] = useState('pipeline') // pipeline | new | detail
  const [proposals, setProposals] = useState([])
  const [properties, setProperties] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [stageFilter, setStageFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [showPropImport, setShowPropImport] = useState(false)
  const [propPasteText, setPropPasteText] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: props }, { count }] = await Promise.all([
      supabase.from('proposals').select('*, properties(*)').order('created_at', { ascending: false }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
    ])
    setProposals(props || [])
    setProperties(count || 0)
    setLoading(false)
  }

  async function importProperties(text) {
  setImporting(true)
  // Strip BOM and normalize
  const clean = text.replace(/^\uFEFF/, '')
  const { data: rows } = Papa.parse(clean, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
  
  // Deduplicate by Property ID — handle both old and new column names
  const seen = new Map()
  rows.filter(r => r['Property: ID'] || r['Property ID']).forEach(r => seen.set(r['Property: ID'] || r['Property ID'], r))
  const unique = Array.from(seen.values())
  const dupes = rows.length - unique.length

  // Helper: try new column name first, fall back to old
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

  // Chunk in batches of 500
  const chunkSize = 500
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)
    setMsg(`Importing properties... ${Math.min(i + chunkSize, records.length).toLocaleString()} / ${records.length.toLocaleString()}`)
    const { error } = await supabase.from('properties').upsert(chunk, { onConflict: 'sf_property_id' })
    if (error) { console.error(error); setMsg(`Import error at row ${i}`); setImporting(false); return }
  }
  setMsg(`${records.length.toLocaleString()} properties imported` + (dupes ? ` (${dupes.toLocaleString()} duplicates skipped)` : ''))
  setTimeout(() => setMsg(''), 6000)
  setShowPropImport(false)
  setPropPasteText('')
  setImporting(false)
  loadAll()
}

  const filtered = proposals.filter(p => {
    if (stageFilter !== 'All' && p.stage !== stageFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const addr = (p.properties?.street || '').toLowerCase()
      const name = (p.properties?.property_name || '').toLowerCase()
      if (!addr.includes(q) && !name.includes(q)) return false
    }
    return true
  })

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading...</div>

  if (view === 'new') return (
    <NewProposal
      onBack={() => setView('pipeline')}
      onCreated={(id) => { loadAll(); setSelectedId(id); setView('detail') }}
      onImportProperties={() => setShowPropImport(true)}
    />
  )

  if (view === 'detail') return (
    <ProposalDetail
      proposalId={selectedId}
      onBack={() => setView('pipeline')}
      onUpdated={loadAll}
    />
  )

  const sc = {}
  STAGES.forEach(s => sc[s] = proposals.filter(p => p.stage === s).length)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Proposals</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {proposals.length} total · {properties} properties
            {msg && <span style={{ color: '#27500A', marginLeft: 8 }}>{msg}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPropImport(p => !p)} style={{ padding: '8px 14px', background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            Import properties
          </button>
          <button onClick={() => setView('new')} style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>
            + New proposal
          </button>
        </div>
      </div>

      {showPropImport && (
        <div style={{ background: '#fff', border: '0.5px solid #378ADD', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Open your property CSV in TextEdit → Cmd+A → Cmd+C → paste below:</p>
          <textarea value={propPasteText} onChange={e => setPropPasteText(e.target.value)} placeholder="Paste property CSV here..." style={{ width: '100%', minHeight: 80, border: '0.5px solid #ddd', borderRadius: 8, padding: 10, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => importProperties(propPasteText)} disabled={importing || !propPasteText.trim()} style={{ padding: '7px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: importing ? 0.6 : 1 }}>
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button onClick={() => { setShowPropImport(false); setPropPasteText('') }} style={{ padding: '7px 14px', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search proposals..." style={{ flex: '1 1 200px', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...STAGES].map(s => {
            const st = STAGE_STYLE[s] || {}
            const on = stageFilter === s
            const count = s === 'All' ? proposals.length : (sc[s] || 0)
            return (
              <button key={s} onClick={() => setStageFilter(s)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: on && s !== 'All' ? `0.5px solid ${st.color}` : '0.5px solid transparent', background: on && s !== 'All' ? st.bg : 'transparent', color: on && s !== 'All' ? st.color : '#888', cursor: 'pointer' }}>
                {s} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', background: '#f5f5f5' }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#888' }}>PROPERTY</div>
          <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>ASKING PRICE</div>
          <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>STAGE</div>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
            {proposals.length === 0 ? 'No proposals yet. Click "+ New proposal" to get started.' : 'No proposals match the current filter.'}
          </div>
        )}
        {filtered.map(p => {
          const st = STAGE_STYLE[p.stage] || { bg: '#eee', color: '#555' }
          const addr = p.properties?.street || 'Untitled'
          const sub = [p.properties?.sub_market, p.properties?.total_units ? p.properties.total_units + ' units' : '', p.properties?.property_sub_type].filter(Boolean).join(' · ')
          return (
            <div key={p.id} onClick={() => { setSelectedId(p.id); setView('detail') }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer', background: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addr}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{sub}</div>
              </div>
              <div style={{ width: 120, textAlign: 'right' }}>
                <div style={{ fontWeight: 500 }}>{fC(p.asking_price)}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.date_created}</div>
              </div>
              <div style={{ width: 120, textAlign: 'right' }}>
                <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{p.stage}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NewProposal({ onBack, onCreated }) {
  const [srch, setSrch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [asking, setAsking] = useState('')
  const [stage, setStage] = useState('Prospect')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualFields, setManualFields] = useState({})

  useEffect(() => {
    if (srch.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const q = `%${srch}%`
      const { data } = await supabase.from('properties')
        .select('*')
        .or(`street.ilike.${q},property_name.ilike.${q},zip.ilike.${q}`)
        .limit(8)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [srch])

  async function create() {
    setSaving(true)
    let propId = selected?.id
    if (manual) {
      const { data, error } = await supabase.from('properties').insert({
        street: manualFields.street, city: manualFields.city,
        state: manualFields.state, zip: manualFields.zip,
        county: manualFields.county, sub_market: manualFields.sub_market,
        total_units: parseInt(manualFields.total_units) || null,
        property_sub_type: manualFields.property_sub_type,
        year_built: parseInt(manualFields.year_built) || null,
        building_sf: parseFloat(manualFields.building_sf) || null,
      }).select().single()
      if (error) { console.error(error); setSaving(false); return }
      propId = data.id
    }
    const { data, error } = await supabase.from('proposals').insert({
      property_id: propId, stage, asking_price: parseFloat(asking) || null, notes,
    }).select().single()
    if (error) { console.error(error); setSaving(false); return }
    setSaving(false)
    onCreated(data.id)
  }

  const mf = (k, v) => setManualFields(f => ({ ...f, [k]: v }))
  const inp = (label, key, type = 'text') => (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{label}</div>
      <input type={type} value={manualFields[key] || ''} onChange={e => mf(key, e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
        <button onClick={onBack} style={{ padding: '6px 12px', fontSize: 12, color: '#666', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>New proposal</h1>
      </div>

      {!selected && !manual && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Search for a property</div>
          <input value={srch} onChange={e => setSrch(e.target.value)} placeholder="Start typing an address..." autoFocus style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }} />
          {srch.length >= 2 && (
            <div style={{ marginTop: 8 }}>
              {searching && <div style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>Searching...</div>}
              {!searching && results.map(p => (
                <div key={p.id} onClick={() => setSelected(p)} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px solid #eee', marginBottom: 6, cursor: 'pointer', background: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#E6F1FB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontWeight: 500 }}>{p.street || p.property_name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{[p.city, p.state, p.zip].filter(Boolean).join(', ')} · {p.total_units || '?'} units · {p.property_sub_type || ''}</div>
                </div>
              ))}
              {!searching && <div onClick={() => setManual(true)} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px dashed #ccc', cursor: 'pointer', textAlign: 'center', color: '#888', fontSize: 13 }}>
                {results.length ? '+ Create new property' : 'No match — create new property'}
              </div>}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div style={{ background: '#E6F1FB', border: '0.5px solid #378ADD', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 500, color: '#0C447C' }}>{selected.street || selected.property_name}</div>
          <div style={{ fontSize: 12, color: '#185FA5', marginTop: 2 }}>{[selected.city, selected.state, selected.zip].filter(Boolean).join(', ')} · {selected.total_units || '?'} units</div>
          <button onClick={() => setSelected(null)} style={{ marginTop: 8, fontSize: 11, padding: '3px 8px', color: '#185FA5', background: 'transparent', border: '0.5px solid #185FA5', borderRadius: 6, cursor: 'pointer' }}>Change</button>
        </div>
      )}

      {manual && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: '1rem' }}>New property details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {inp('Street address *', 'street')}
            {inp('City', 'city')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {inp('State', 'state')}
            {inp('Zip', 'zip')}
            {inp('County', 'county')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {inp('Total units *', 'total_units', 'number')}
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Property type</div>
              <select value={manualFields.property_sub_type || ''} onChange={e => mf('property_sub_type', e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }}>
                <option value="">Select...</option>
                {['2-4 Units', '5-8 Units', '9-20 Units', '21-50 Units', '51+ Units'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {inp('Year built', 'year_built', 'number')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Sub-market', 'sub_market')}
            {inp('Building SF', 'building_sf', 'number')}
          </div>
        </div>
      )}

      {(selected || manual) && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: '1rem' }}>Proposal details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Asking price</div>
              <input type="number" value={asking} onChange={e => setAsking(e.target.value)} placeholder="e.g. 2500000" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Stage</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Discovery call notes..." style={{ width: '100%', minHeight: 70, padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, resize: 'vertical', fontSize: 13 }} />
          </div>
        </div>
      )}

      {(selected || manual) && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={create} disabled={saving} style={{ padding: '9px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Creating...' : 'Create proposal'}
          </button>
          <button onClick={onBack} style={{ padding: '9px 14px', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function ProposalDetail({ proposalId, onBack, onUpdated }) {
  const [proposal, setProposal] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editStage, setEditStage] = useState('')
  const [editAsking, setEditAsking] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => { loadProposal() }, [proposalId])

  async function loadProposal() {
    setLoading(true)
    const { data } = await supabase.from('proposals').select('*, properties(*)').eq('id', proposalId).single()
    setProposal(data)
    setEditStage(data?.stage || 'Prospect')
    setEditAsking(data?.asking_price || '')
    setEditNotes(data?.notes || '')
    setLoading(false)
  }

  async function saveProposal() {
    setSaving(true)
    await supabase.from('proposals').update({ stage: editStage, asking_price: parseFloat(editAsking) || null, notes: editNotes }).eq('id', proposalId)
    setSaving(false)
    setMsg('Saved')
    setTimeout(() => setMsg(''), 2000)
    onUpdated()
    loadProposal()
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading...</div>
  if (!proposal) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Not found</div>

  const pr = proposal.properties || {}
  const st = STAGE_STYLE[proposal.stage] || { bg: '#eee', color: '#555' }
  const kv = (l, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
      <span style={{ color: '#888' }}>{l}</span>
      <span style={{ fontWeight: v ? 500 : 400, color: v ? '#111' : '#bbb' }}>{v || '—'}</span>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 12px', fontSize: 12, color: '#666', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>← Pipeline</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{pr.street || 'Untitled'}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{[pr.sub_market, pr.total_units ? pr.total_units + ' units' : ''].filter(Boolean).join(' · ')}</div>
        </div>
        <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>{proposal.stage}</span>
      </div>

      {msg && <div style={{ padding: '8px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 8, fontSize: 12, marginBottom: '1rem' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '0.5px solid rgba(0,0,0,0.1)', paddingBottom: 0 }}>
        {['overview', 'due diligence', 'comp analysis', 'rent roll', 'financials'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 500, border: 'none', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111' : '#888', cursor: 'pointer', borderBottom: tab === t ? '2px solid #111' : 'none' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>Property info</div>
            {kv('Address', pr.street)}
            {kv('Sub-market', pr.sub_market)}
            {kv('Type', pr.property_sub_type)}
            {kv('Total units', pr.total_units)}
            {kv('Building SF', pr.building_sf ? pr.building_sf.toLocaleString() + ' SF' : null)}
            {kv('Year built', pr.year_built)}
            {kv('Year built era', pr.year_built_era)}
            {kv('# of buildings', pr.num_buildings)}
            {kv('Property class', pr.property_class)}
            {kv('Tax ID', pr.tax_id)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>Proposal</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Stage</div>
                <select value={editStage} onChange={e => setEditStage(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Asking price</div>
                <input type="number" value={editAsking} onChange={e => setEditAsking(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Notes</div>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} style={{ width: '100%', minHeight: 70, padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, resize: 'vertical', fontSize: 13 }} />
              </div>
              <button onClick={saveProposal} disabled={saving} style={{ padding: '7px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>Ownership</div>
              {kv('Owner LLC', pr.owner_llc)}
              {kv('Contact', pr.owner_contact)}
              {kv('Last sale date', pr.last_sale_date)}
              {kv('Last sale price', pr.last_sale_amount ? '$' + Math.round(pr.last_sale_amount).toLocaleString() : null)}
              {kv('Last $/unit', pr.last_sale_price_per_unit ? '$' + Math.round(pr.last_sale_price_per_unit).toLocaleString() : null)}
              {kv('Last cap rate', pr.last_cap_rate ? pr.last_cap_rate + '%' : null)}
            </div>
          </div>
        </div>
      )}

      {tab === 'due diligence' && (
        <DueDiligence proposal={proposal} onSaved={() => { setMsg('Due diligence saved'); setTimeout(() => setMsg(''), 2000) }} />
      )}

      {tab === 'comp analysis' && (
        <CompAnalysis proposal={proposal} />
      )}

      {tab === 'rent roll' && (
        <RentRoll proposal={proposal} />
      )}

      {tab === 'financials' && (
        <Financials proposal={proposal} />
      )}
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

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DD_FIELDS.map(sec => (
          <div key={sec.l} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>{sec.l}</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sec.c}, 1fr)`, gap: 10 }}>
              {sec.f.map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{f.l}</div>
                  {f.t === 'yn' ? (
                    <select value={fields[f.k] || ''} onChange={e => setFields(v => ({ ...v, [f.k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }}>
                      <option value="">—</option>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  ) : (
                    <input value={fields[f.k] || ''} onChange={e => setFields(v => ({ ...v, [f.k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem', marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>Due diligence notes</div>
        <textarea value={ddNotes} onChange={e => setDdNotes(e.target.value)} style={{ width: '100%', minHeight: 80, padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, resize: 'vertical', fontSize: 13 }} />
      </div>
      <button onClick={save} disabled={saving} style={{ marginTop: 12, padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save due diligence'}
      </button>
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

function CompAnalysis({ proposal }) {
  const pr = proposal.properties || {}
  const [allComps, setAllComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(730)
  const [excluded, setExcluded] = useState(new Set())
  const [excludedMktg, setExcludedMktg] = useState(new Set())

  const defaultRange = unitRangeFromSubType(pr.property_sub_type, pr.total_units)
  const [minUnits, setMinUnits] = useState(defaultRange[0])
  const [maxUnits, setMaxUnits] = useState(defaultRange[1])

  const [market, setMarket] = useState(pr.market || '')
  const [county, setCounty] = useState(pr.county || '')
  const [subMarket, setSubMarket] = useState(pr.sub_market || '')
  const [zip, setZip] = useState(pr.zip ? String(pr.zip) : '')
  const [era, setEra] = useState(pr.year_built_era || '')

  // comp table sorting
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [editComp, setEditComp] = useState(null)

  useEffect(() => { fetchComps() }, [])

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
        // Total DOM: listing → sale if sold, listing → today if still active/UC (cumulative)
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

  // dropdown options from comps data
  const counties = [...new Set(allComps.map(c => c.property_county).filter(Boolean))].sort()
  const subMarkets = [...new Set(allComps.map(c => c.sub_market).filter(Boolean))].sort()
  const zips = [...new Set(allComps.map(c => String(c.zip_code)).filter(v => v && v !== 'null'))].sort()
  const eras = [...new Set(allComps.map(c => c.year_built_era).filter(Boolean))].sort()

  // base-filtered comps (date + unit range)
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

  const activeComps = baseFiltered.filter(c => !excluded.has(c.id))
  const marketingComps = baseFiltered.filter(c => !excludedMktg.has(c.id))

  function toggleExclude(id) {
    setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleExcludeMktg(id) {
    setExcludedMktg(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    if (excluded.size === 0) setExcluded(new Set(baseFiltered.map(c => c.id)))
    else setExcluded(new Set())
  }
  function toggleAllMktg() {
    if (excludedMktg.size === 0) setExcludedMktg(new Set(baseFiltered.map(c => c.id)))
    else setExcludedMktg(new Set())
  }

  // ── Comp edit ──
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

  // comp table sort
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

  const hdrBg = '#f5f5f5'
  const eraBg = '#E6F1FB'
  const cellPad = '6px 8px'
  const borderC = '0.5px solid rgba(0,0,0,0.1)'
  const cellStyle = (isEra) => ({ padding: cellPad, textAlign: 'right', fontSize: 12, background: isEra ? eraBg : '#fff', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' })
  const labelCell = { padding: cellPad, fontSize: 12, fontWeight: 500, background: '#fff', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }
  const groupCell = { padding: '8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', background: '#f9f9f9', borderBottom: borderC, borderRight: borderC }
  const sel = { padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12 }

  const compTh = (label, col) => (
    <th onClick={() => toggleSort(col)} style={{ padding: cellPad, borderBottom: borderC, textAlign: col === 'property_name' || col === 'sub_market' || col === '_st' || col === 'year_built_era' ? 'left' : 'right', fontWeight: 500, fontSize: 11, color: sortCol === col ? '#185FA5' : '#888', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', resize: 'horizontal', minWidth: 50 }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

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
                        <><input type="checkbox" checked={!!editComp[f.key]} onChange={e => updateEditField(f.key, e.target.checked)} /><label style={{ fontSize: 12, color: '#555' }}>{f.label}</label></>
                      ) : (
                        <><label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>{f.label}</label>
                        {f.type === 'select' ? (
                          <select value={editComp[f.key] || ''} onChange={e => updateEditField(f.key, e.target.value)} style={editInputStyle}><option value="">—</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                        ) : (
                          <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={editComp[f.key] ?? ''} onChange={e => updateEditField(f.key, e.target.value)} style={editInputStyle} />
                        )}</>
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

      {/* ── FILTER BAR ── */}
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

      {/* ── STATS TABLE ── */}
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
                  // Escrow not applicable for Active / Under Contract — skip the row entirely
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

      {/* ── COMP TABLE ── */}
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
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtC(c._dispPPU)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtC(c._dispPSF)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtP(c._dispCap)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtX(c._dispGRM)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._activeDom != null ? c._activeDom : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._totalDom != null ? c._totalDom : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c._escrow != null ? c._escrow : '—'}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                    <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#185FA5', padding: '1px 3px' }} title="Edit comp">✎</button>
                  </td>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}