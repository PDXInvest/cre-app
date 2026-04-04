import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Papa from 'papaparse'

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
    const [{ data: props }, { data: props2 }] = await Promise.all([
      supabase.from('proposals').select('*, properties(*)').order('created_at', { ascending: false }),
      supabase.from('properties').select('*').order('property_name'),
    ])
    setProposals(props || [])
    setProperties(props2 || [])
    setLoading(false)
  }

  async function importProperties(text) {
  setImporting(true)
  const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true })
  
  // Deduplicate by Property ID — keep last occurrence
  const seen = new Map()
  rows.filter(r => r['Property ID']).forEach(r => seen.set(r['Property ID'], r))
  const unique = Array.from(seen.values())

  const records = unique.map(r => ({
    sf_property_id: r['Property ID'],
    property_name: r['Property Name'],
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
    owner_contact: r['Owner/Landlord Contact: Full Name'],
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

  const { error } = await supabase.from('properties').upsert(records, { onConflict: 'sf_property_id' })
  if (error) { console.error(error); setMsg('Import error'); setImporting(false); return }
  setMsg(`${records.length} properties imported`)
  setTimeout(() => setMsg(''), 4000)
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
      properties={properties}
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
            {proposals.length} total · {properties.length} properties
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

function NewProposal({ properties, onBack, onCreated }) {
  const [srch, setSrch] = useState('')
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [asking, setAsking] = useState('')
  const [stage, setStage] = useState('Prospect')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualFields, setManualFields] = useState({})

  const results = srch.length >= 2 ? properties.filter(p =>
    (p.street || '').toLowerCase().includes(srch.toLowerCase()) ||
    (p.property_name || '').toLowerCase().includes(srch.toLowerCase()) ||
    (p.zip || '').includes(srch)
  ).slice(0, 6) : []

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
              {results.map(p => (
                <div key={p.id} onClick={() => setSelected(p)} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px solid #eee', marginBottom: 6, cursor: 'pointer', background: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#E6F1FB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontWeight: 500 }}>{p.street || p.property_name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{[p.city, p.state, p.zip].filter(Boolean).join(', ')} · {p.total_units || '?'} units · {p.property_sub_type || ''}</div>
                </div>
              ))}
              <div onClick={() => setManual(true)} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px dashed #ccc', cursor: 'pointer', textAlign: 'center', color: '#888', fontSize: 13 }}>
                {results.length ? '+ Create new property' : 'No match — create new property'}
              </div>
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
        {['overview', 'due diligence', 'comp analysis'].map(t => (
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
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: '#333' }}>Comp analysis coming soon</p>
          <p style={{ fontSize: 13 }}>This will pull from your comp database and auto-populate filters from this property record.</p>
        </div>
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