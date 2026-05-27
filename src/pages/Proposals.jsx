import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [view, setView] = useState(searchParams.get('new') !== null ? 'new' : 'pipeline')
  const [proposals, setProposals] = useState([])
  const [propertyCount, setPropertyCount] = useState(0)
  const [stageFilter, setStageFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: props }, { count }] = await Promise.all([
      supabase.from('proposals').select('*, properties(*)').order('created_at', { ascending: false }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
    ])
    setProposals(props || [])
    setPropertyCount(count || 0)
    setLoading(false)
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
      preSelectedPropertyId={searchParams.get('property')}
      onBack={() => { setView('pipeline'); navigate('/proposals', { replace: true }) }}
      onCreated={(id) => { navigate(`/proposals/${id}`) }}
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
            {proposals.length} total · {propertyCount} properties
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('new')} style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>
            + New proposal
          </button>
        </div>
      </div>

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
            <div key={p.id} onClick={() => navigate(`/proposals/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer', background: '#fff' }}
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

function NewProposal({ preSelectedPropertyId, onBack, onCreated }) {
  const [srch, setSrch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [asking, setAsking] = useState('')
  const [stage, setStage] = useState('Prospect')
  const [notes, setNotes] = useState('')
  const [statedIncome, setStatedIncome] = useState('')
  const [statedExpenses, setStatedExpenses] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualFields, setManualFields] = useState({})

  useEffect(() => {
    if (preSelectedPropertyId) {
      supabase.from('properties').select('*').eq('id', preSelectedPropertyId).single()
        .then(({ data }) => { if (data) setSelected(data) })
    }
  }, [preSelectedPropertyId])

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
    if (statedIncome || statedExpenses) {
      await supabase.from('proposal_dashboard').insert({
        proposal_id: data.id,
        data: { stated_income: parseFloat(statedIncome) || null, stated_expenses: parseFloat(statedExpenses) || null },
      }).catch(() => {})
    }
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Stated gross income</div>
              <input type="number" value={statedIncome} onChange={e => setStatedIncome(e.target.value)} placeholder="e.g. 530000" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Stated expenses</div>
              <input type="number" value={statedExpenses} onChange={e => setStatedExpenses(e.target.value)} placeholder="e.g. 210000" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Stated NOI (auto)</div>
              <div style={{ padding: '7px 10px', border: '0.5px solid #eee', borderRadius: 8, fontSize: 13, background: '#f9f9f9', color: '#333' }}>
                {statedIncome || statedExpenses ? '$' + Math.round((parseFloat(statedIncome)||0) - (parseFloat(statedExpenses)||0)).toLocaleString() : '—'}
              </div>
            </div>
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