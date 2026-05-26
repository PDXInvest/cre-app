import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const STAGE_STYLE = {
  'Prospect':      { bg: '#F1EFE8', color: '#5F5E5A' },
  'Proposal':      { bg: '#E6F1FB', color: '#0C447C' },
  'Exclusive Rep': { bg: '#EEEDFE', color: '#3C3489' },
  'Active':        { bg: '#E1F5EE', color: '#085041' },
  'Under Contract':{ bg: '#FAEEDA', color: '#633806' },
  'Sold':          { bg: '#EAF3DE', color: '#27500A' },
  'Lost':          { bg: '#FCEBEB', color: '#791F1F' },
}
const ACTIVE_STAGES = ['Prospect', 'Proposal', 'Exclusive Rep', 'Active', 'Under Contract']

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

export default function Properties() {
  const [view, setView] = useState('list')
  const [properties, setProperties] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

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

  const filtered = properties.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (p.street || '').toLowerCase().includes(q) ||
           (p.property_name || '').toLowerCase().includes(q) ||
           (p.owner_llc || '').toLowerCase().includes(q) ||
           (p.owner_contact || '').toLowerCase().includes(q)
  })

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading...</div>

  if (view === 'detail') return (
    <PropertyDetail propertyId={selectedId} onBack={() => { setView('list'); loadProperties() }} />
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Properties</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{properties.length} properties</div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by address, name, or owner..."
          style={{ width: '100%', maxWidth: 400, padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13 }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', background: '#f5f5f5' }}>
          <div style={{ flex: 2, fontSize: 11, fontWeight: 500, color: '#888' }}>ADDRESS</div>
          <div style={{ width: 70, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>UNITS</div>
          <div style={{ width: 100, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>TYPE</div>
          <div style={{ width: 80, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>YR BUILT</div>
          <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>LAST SALE</div>
          <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>PROPOSAL</div>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
            {properties.length === 0 ? 'No properties yet.' : 'No properties match your search.'}
          </div>
        )}
        {filtered.map(p => {
          const activeProposal = (p.proposals || []).find(pr => ACTIVE_STAGES.includes(pr.stage))
          const stSt = activeProposal ? STAGE_STYLE[activeProposal.stage] : null
          return (
            <div key={p.id} onClick={() => { setSelectedId(p.id); setView('detail') }}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer', background: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.street || p.property_name || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{[p.city, p.state, p.zip].filter(Boolean).join(', ')}</div>
              </div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 13 }}>{p.total_units || '—'}</div>
              <div style={{ width: 100, textAlign: 'right', fontSize: 12, color: '#666' }}>{p.property_sub_type || '—'}</div>
              <div style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{p.year_built || '—'}</div>
              <div style={{ width: 120, textAlign: 'right' }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{fC(p.last_sale_amount)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{p.last_sale_date || ''}</div>
              </div>
              <div style={{ width: 120, textAlign: 'right' }}>
                {activeProposal ? (
                  <span style={{ background: stSt.bg, color: stSt.color, padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{activeProposal.stage}</span>
                ) : (
                  <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
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
  const [property, setProperty] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)

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

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading...</div>
  if (!property) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Not found</div>

  const pr = property
  const kv = (l, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
      <span style={{ color: '#888' }}>{l}</span>
      <span style={{ fontWeight: v ? 500 : 400, color: v ? '#111' : '#bbb' }}>{v || '—'}</span>
    </div>
  )
  const sectionHdr = label => (
    <div style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', paddingBottom: 6, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>{label}</div>
  )
  const card = { background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }

  return (
    <div>
      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditing(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '85vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Edit Property</h3>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            {EDIT_SECTIONS.map(section => (
              <div key={section.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{section.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${section.cols}, 1fr)`, gap: 8 }}>
                  {section.fields.map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>{f.label}</label>
                      <input type={f.type === 'number' ? 'number' : 'text'} value={editFields[f.key] ?? ''} onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ padding: '8px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 12px', fontSize: 12, color: '#666', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 8 }}>← Properties</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{pr.street || pr.property_name || 'Untitled'}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {[pr.city, pr.state, pr.zip].filter(Boolean).join(', ')}
            {pr.total_units ? ` · ${pr.total_units} units` : ''}
            {pr.property_sub_type ? ` · ${pr.property_sub_type}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openEdit} style={{ padding: '8px 14px', background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Edit</button>
        </div>
      </div>

      {msg && <div style={{ padding: '8px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 8, fontSize: 12, marginBottom: '1rem' }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '0.5px solid rgba(0,0,0,0.1)', paddingBottom: 0 }}>
        {['overview', 'market metrics', 'sale history', 'photos', 'proposals'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 500, border: 'none', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111' : '#888', cursor: 'pointer', borderBottom: tab === t ? '2px solid #111' : 'none' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              {sectionHdr('Property info')}
              {kv('Address', pr.street)}
              {kv('City / State', [pr.city, pr.state, pr.zip].filter(Boolean).join(', '))}
              {kv('Sub-market', pr.sub_market)}
              {kv('Market', pr.market)}
              {kv('Type', pr.property_sub_type)}
              {kv('Total units', pr.total_units)}
              {kv('Building SF', pr.building_sf ? pr.building_sf.toLocaleString() + ' SF' : null)}
              {kv('Year built', pr.year_built)}
              {kv('Era', pr.year_built_era)}
              {kv('# of buildings', pr.num_buildings)}
              {kv('Property class', pr.property_class)}
              {kv('Tax ID', pr.tax_id)}
            </div>
            <div style={card}>
              {sectionHdr('Ownership')}
              {kv('Owner LLC', pr.owner_llc)}
              {kv('Contact', pr.owner_contact)}
              {kv('Last sale date', pr.last_sale_date)}
              {kv('Last sale price', pr.last_sale_amount ? '$' + Math.round(pr.last_sale_amount).toLocaleString() : null)}
              {kv('Last $/unit', pr.last_sale_price_per_unit ? '$' + Math.round(pr.last_sale_price_per_unit).toLocaleString() : null)}
              {kv('Last cap rate', pr.last_cap_rate ? pr.last_cap_rate + '%' : null)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              {sectionHdr('Sale history')}
              {comps.length === 0 ? (
                <div style={{ fontSize: 12, color: '#888' }}>No comp records matched via Salesforce ID.</div>
              ) : (
                comps.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{c.sale_name || c.property_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {c.status || '—'}
                        {c.sale_date ? ` · ${fmtDate(c.sale_date)}` : c.listing_date ? ` · Listed ${fmtDate(c.listing_date)}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{fC(c.sale_price || c.listing_price)}</div>
                      {c.num_units && (c.sale_price || c.listing_price) ? (
                        <div style={{ fontSize: 11, color: '#888' }}>{fC((c.sale_price || c.listing_price) / c.num_units)}/unit</div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {comps.length > 5 && (
                <button onClick={() => setTab('sale history')} style={{ marginTop: 8, fontSize: 12, color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  View all {comps.length} records →
                </button>
              )}
            </div>

            <div style={card}>
              {sectionHdr('Proposals')}
              {proposals.length === 0 ? (
                <div style={{ fontSize: 12, color: '#888' }}>No proposals for this property.</div>
              ) : (
                proposals.map(p => {
                  const st = STAGE_STYLE[p.stage] || { bg: '#eee', color: '#555' }
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <div>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{p.stage}</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.date_created || ''}</span>
                      </div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{fC(p.asking_price)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Market Metrics */}
      {tab === 'market metrics' && (
        <MarketMetrics property={property} allComps={allComps} />
      )}

      {/* Sale History */}
      {tab === 'sale history' && (
        <SaleHistory comps={comps} property={property} />
      )}

      {/* Photos */}
      {tab === 'photos' && (
        <Photos property={property} onUpdated={loadAll} />
      )}

      {/* Proposals */}
      {tab === 'proposals' && (
        <div>
          <div style={card}>
            {sectionHdr(`Proposals (${proposals.length})`)}
            {proposals.length === 0 ? (
              <div style={{ fontSize: 12, color: '#888', padding: '1rem 0' }}>No proposals for this property yet.</div>
            ) : (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#888' }}>STAGE</div>
                  <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>ASKING PRICE</div>
                  <div style={{ width: 120, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#888' }}>DATE</div>
                  <div style={{ flex: 2, fontSize: 11, fontWeight: 500, color: '#888', paddingLeft: 12 }}>NOTES</div>
                </div>
                {proposals.map(p => {
                  const st = STAGE_STYLE[p.stage] || { bg: '#eee', color: '#555' }
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{p.stage}</span>
                      </div>
                      <div style={{ width: 120, textAlign: 'right', fontWeight: 500 }}>{fC(p.asking_price)}</div>
                      <div style={{ width: 120, textAlign: 'right', fontSize: 12, color: '#888' }}>{p.date_created || ''}</div>
                      <div style={{ flex: 2, fontSize: 12, color: '#666', paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MarketMetrics({ property, allComps }) {
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

  function metricCard(label, currentVal, priorVal, fmt) {
    const delta = (currentVal != null && priorVal != null && priorVal !== 0)
      ? ((currentVal - priorVal) / Math.abs(priorVal)) * 100
      : null
    const deltaColor = delta != null ? (delta >= 0 ? '#085041' : '#791F1F') : '#888'
    const deltaArrow = delta != null ? (delta >= 0 ? '↑' : '↓') : ''
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }}>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#111', marginBottom: 4 }}>{currentVal != null ? fmt(currentVal) : 'No data'}</div>
        <div style={{ fontSize: 12 }}>
          {delta != null ? (
            <span style={{ color: deltaColor, fontWeight: 500 }}>{deltaArrow} {Math.abs(delta).toFixed(1)}% vs prior 6mo</span>
          ) : (
            <span style={{ color: '#bbb' }}>No prior data</span>
          )}
        </div>
      </div>
    )
  }

  const curPPU = median(currentComps.map(c => c.sale_price && c.num_units ? c.sale_price / c.num_units : null))
  const priorPPU = median(priorComps.map(c => c.sale_price && c.num_units ? c.sale_price / c.num_units : null))
  const curCap = median(currentComps.map(c => !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null))
  const priorCap = median(priorComps.map(c => !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null))
  const curGRM = median(currentComps.map(c => !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null))
  const priorGRM = median(priorComps.map(c => !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null))

  const curVolume = currentComps.filter(c => c.sale_price).reduce((s, c) => s + c.sale_price, 0)
  const priorVolume = priorComps.filter(c => c.sale_price).reduce((s, c) => s + c.sale_price, 0)

  const card = { background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.25rem' }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Scope</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'market', label: 'Market' },
                { key: 'county', label: 'County' },
                { key: 'sub_market', label: 'Sub-Market' },
                { key: 'zip', label: 'Zip' },
              ].map(s => (
                <button key={s.key} onClick={() => setScope(s.key)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: scope === s.key ? '0.5px solid #185FA5' : '0.5px solid #ddd', background: scope === s.key ? '#E6F1FB' : '#fff', color: scope === s.key ? '#0C447C' : '#666', cursor: 'pointer' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Era filter</div>
            <button onClick={() => setUseEra(!useEra)}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: useEra ? '0.5px solid #185FA5' : '0.5px solid #ddd', background: useEra ? '#E6F1FB' : '#fff', color: useEra ? '#0C447C' : '#666', cursor: 'pointer' }}>
              {useEra ? pr.year_built_era || 'Era' : 'All eras'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
            {scopeName}: <strong style={{ color: '#111' }}>{scopeLabel || '—'}</strong>
            {' · '}{currentComps.length} comps (6mo) · {priorComps.length} comps (prior 6mo)
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {metricCard('$/Unit', curPPU, priorPPU, v => '$' + Math.round(v).toLocaleString())}
        {metricCard('Cap Rate', curCap, priorCap, v => (v * 100).toFixed(2) + '%')}
        {metricCard('GRM', curGRM, priorGRM, v => v.toFixed(2) + 'x')}
        {metricCard('Volume', curVolume || null, priorVolume || null, v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v).toLocaleString()))}
      </div>
    </div>
  )
}

function SaleHistory({ comps, property }) {
  const borderC = '0.5px solid rgba(0,0,0,0.1)'
  const cellPad = '6px 8px'
  const card = { background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }

  if (comps.length === 0) {
    return (
      <div style={card}>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          {property.sf_property_id ? 'No comp records matched via Salesforce ID.' : 'This property has no Salesforce ID — comps cannot be matched.'}
        </div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ padding: '10px 14px', borderBottom: borderC, background: '#f5f5f5', fontSize: 12, fontWeight: 500, color: '#666' }}>
        SALE HISTORY ({comps.length})
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f9f9f9' }}>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888' }}>Sale / Property</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#888' }}>Status</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>Units</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>Listing Date</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>Sale Date</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>Sale Price</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>$/Unit</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>Cap</th>
            <th style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500, fontSize: 11, color: '#888' }}>GRM</th>
          </tr>
        </thead>
        <tbody>
          {comps.map(c => {
            const ppu = c.sale_price && c.num_units ? c.sale_price / c.num_units : null
            const cap = !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null
            const grm = !c.x_agi && c.adv_agi > 0 && c.sale_price ? c.sale_price / c.adv_agi : null
            const stStyle = c.status === 'Sold' ? { bg: '#E1F5EE', color: '#085041' } : c.status === 'Active' ? { bg: '#E6F1FB', color: '#0C447C' } : { bg: '#FAEEDA', color: '#633806' }
            return (
              <tr key={c.id}>
                <td style={{ padding: cellPad, borderBottom: borderC }}>
                  <div style={{ fontWeight: 500 }}>{c.sale_name || c.property_name || '—'}</div>
                </td>
                <td style={{ padding: cellPad, borderBottom: borderC }}>
                  <span style={{ background: stStyle.bg, color: stStyle.color, padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{c.status || '—'}</span>
                </td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{c.num_units || '—'}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtDate(c.listing_date)}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{fmtDate(c.sale_date)}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', fontWeight: 500 }}>{fC(c.sale_price)}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{ppu ? fC(ppu) : '—'}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{cap != null ? (cap * 100).toFixed(2) + '%' : '—'}</td>
                <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right' }}>{grm != null ? grm.toFixed(2) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Photos({ property, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef()
  const photos = property.photos || []

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    const newUrls = []
    for (const file of files) {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const filePath = `${property.id}/${fileName}`
      const { error } = await supabase.storage.from('property-photos').upload(filePath, file)
      if (error) { console.error(error); setMsg(`Upload error: ${error.message}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
      newUrls.push(publicUrl)
    }
    if (newUrls.length) {
      const updated = [...photos, ...newUrls]
      await supabase.from('properties').update({ photos: updated }).eq('id', property.id)
      setMsg(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded`)
      setTimeout(() => setMsg(''), 3000)
      onUpdated()
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deletePhoto(url) {
    const parts = url.split('/property-photos/')
    if (parts.length < 2) return
    const path = decodeURIComponent(parts[1])
    await supabase.storage.from('property-photos').remove([path])
    const updated = photos.filter(p => p !== url)
    await supabase.from('properties').update({ photos: updated }).eq('id', property.id)
    onUpdated()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUpload} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, opacity: uploading ? 0.6 : 1, cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : '+ Upload photos'}
        </button>
        {msg && <span style={{ fontSize: 12, color: '#27500A' }}>{msg}</span>}
      </div>

      {photos.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '3rem', textAlign: 'center', color: '#888' }}>
          No photos yet. Click "Upload photos" to add images.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {photos.map((url, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)', background: '#f5f5f5', aspectRatio: '4/3' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button onClick={() => deletePhoto(url)}
                style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
