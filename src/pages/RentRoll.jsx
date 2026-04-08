import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const UNIT_TYPES = [
  'Studio / 1 Bath', '1 Bed / 1 Bath', '2 Bed / 1 Bath', '2 Bed / 1.5 Bath', '2 Bed / 2 Bath',
  '2 Bed / 2.5 Bath', '3 Bed / 1 Bath', '3 Bed / 1.5 Bath', '3 Bed / 2 Bath', '3 Bed / 2.5 Bath',
  '4 Bed / 1 Bath', '4 Bed / 2 Bath',
]
const LEASE_TYPES = ['Fixed Term', 'M to M']
const UNIT_STATUSES = ['Current', 'Vacant', 'Notice', 'Down']

const borderC = '0.5px solid rgba(0,0,0,0.1)'
const cellPad = '4px 6px'

function fmt$(v) { return v ? '$' + Math.round(Number(v)).toLocaleString() : '—' }

export default function RentRoll({ proposal, opModel, onSaved }) {
  const pr = proposal.properties || {}
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { loadUnits() }, [proposal.id])

  async function loadUnits() {
    setLoading(true)
    const { data } = await supabase
      .from('rent_roll_units')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('sort_order', { ascending: true })
    setUnits(data || [])
    setLoading(false)
  }

  function updateUnit(idx, field, value) {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u))
  }

  function addUnit() {
    setUnits(prev => [...prev, {
      _isNew: true,
      proposal_id: proposal.id,
      sort_order: prev.length,
      unit_number: '',
      unit_type: '2 Bed / 1 Bath',
      unit_sf: null,
      tenant_name: '',
      status: 'Vacant',
      actual_rent: 0,
      current_rubs: 0,
      recurring_charges: 0,
      effective_rent_date: null,
      move_in_date: null,
      lease_end_date: null,
      lease_type: 'Fixed Term',
      security_deposit: 0,
      pre_paid_rent: 0,
      notes: '',
      market_rent: 0,
      market_rubs: 0,
      underwritten_rent: 0,
      underwritten_rubs: 0,
      stabilized_month: 36,
    }])
  }

  function removeUnit(idx) {
    if (!confirm('Remove this unit from the rent roll? This cannot be undone.')) return
    setUnits(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    setSaving(true)
    // Delete all existing units for this proposal, then insert fresh
    await supabase.from('rent_roll_units').delete().eq('proposal_id', proposal.id)
    if (units.length > 0) {
      const records = units.map((u, i) => {
        const { id, _isNew, created_at, updated_at, ...rest } = u
        return { ...rest, proposal_id: proposal.id, sort_order: i, underwritten_rent: uwRent(u), underwritten_rubs: uwRubs(u) }
      })
      const { error } = await supabase.from('rent_roll_units').insert(records)
      if (error) { console.error(error); setMsg('Save error'); setSaving(false); return }
    }
    setMsg('Rent roll saved')
    setTimeout(() => setMsg(''), 3000)
    setSaving(false)
    loadUnits()
    if (onSaved) onSaved()   // trigger operating model recomputation
  }

  // Summary stats
  const totalUnits = units.length
  const occupied = units.filter(u => u.status === 'Current').length
  const vacant = units.filter(u => u.status === 'Vacant').length
  // UW Rent/RUBS auto-calculated: current rent if occupied, market rent if vacant
  const uwRent = u => u.status === 'Vacant' ? (Number(u.market_rent) || 0) : (Number(u.actual_rent) || 0)
  const uwRubs = u => u.status === 'Vacant' ? (Number(u.market_rubs) || 0) : (Number(u.current_rubs) || 0)

  const totalActualRent = units.reduce((s, u) => s + (Number(u.actual_rent) || 0), 0)
  const totalMarketRent = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0)
  const totalRubs = units.reduce((s, u) => s + (Number(u.current_rubs) || 0), 0)
  const totalUwRent = units.reduce((s, u) => s + uwRent(u), 0)
  const totalUwRubs = units.reduce((s, u) => s + uwRubs(u), 0)
  const avgRent = totalUnits ? totalActualRent / totalUnits : 0
  const occupancy = totalUnits ? (occupied / totalUnits * 100).toFixed(1) : 0

  // Sorting
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const displayUnits = sortCol
    ? [...units].map((u, i) => ({ ...u, _idx: i, _uwRent: uwRent(u), _uwRubs: uwRubs(u) })).sort((a, b) => {
        let av = a[sortCol], bv = b[sortCol]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' || !isNaN(Number(av))) return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    : units.map((u, i) => ({ ...u, _idx: i }))

  const inp = (idx, field, type = 'text', style = {}) => (
    <input
      type={type}
      value={units[idx][field] ?? ''}
      onChange={e => updateUnit(idx, field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      style={{ width: '100%', padding: '3px 5px', border: '0.5px solid #e0e0e0', borderRadius: 4, fontSize: 11, background: 'transparent', ...style }}
    />
  )

  const sel = (idx, field, options) => (
    <select
      value={units[idx][field] || ''}
      onChange={e => updateUnit(idx, field, e.target.value)}
      style={{ width: '100%', padding: '3px 4px', border: '0.5px solid #e0e0e0', borderRadius: 4, fontSize: 11, background: 'transparent' }}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const dateInp = (idx, field) => (
    <input
      type="date"
      value={units[idx][field] ? units[idx][field].slice(0, 10) : ''}
      onChange={e => updateUnit(idx, field, e.target.value || null)}
      style={{ width: '100%', padding: '3px 4px', border: '0.5px solid #e0e0e0', borderRadius: 4, fontSize: 10, background: 'transparent' }}
    />
  )

  const th = (label, col, w) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ padding: cellPad, borderBottom: borderC, fontSize: 10, fontWeight: 600, color: sortCol === col ? '#185FA5' : '#888', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: w || 60 }}
    >
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading rent roll...</div>

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          { l: 'Total Units', v: totalUnits },
          { l: 'Occupied', v: occupied },
          { l: 'Vacant', v: vacant },
          { l: 'Occupancy', v: occupancy + '%' },
          { l: 'Avg Rent', v: fmt$(avgRent) },
          { l: 'Total Rent', v: fmt$(totalActualRent) },
          { l: 'Total RUBS', v: fmt$(totalRubs) },
          { l: 'Total Market', v: fmt$(totalMarketRent) },
          { l: 'Total UW Rent', v: fmt$(totalUwRent) },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: borderC }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ padding: '6px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{msg}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={addUnit} style={{ padding: '6px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 12 }}>+ Add Unit</button>
        <button onClick={saveAll} disabled={saving} style={{ padding: '6px 14px', background: '#fff', border: borderC, borderRadius: 8, fontWeight: 500, fontSize: 12, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Rent Roll'}
        </button>
      </div>

      {/* Rent roll table */}
      <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1600 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: cellPad, borderBottom: borderC, width: 30, fontSize: 10, color: '#888' }}>#</th>
              {th('Unit #', 'unit_number', 70)}
              {th('Unit Type', 'unit_type', 100)}
              {th('SF', 'unit_sf', 50)}
              {th('Tenant', 'tenant_name', 100)}
              {th('Status', 'status', 70)}
              {th('Rent', 'actual_rent', 65)}
              {th('RUBS', 'current_rubs', 55)}
              {th('Recurring', 'recurring_charges', 60)}
              {th('Eff. Date', 'effective_rent_date', 95)}
              {th('Move In', 'move_in_date', 95)}
              {th('Lease End', 'lease_end_date', 95)}
              {th('Lease Type', 'lease_type', 80)}
              {th('Deposit', 'security_deposit', 60)}
              {th('Pre-Paid', 'pre_paid_rent', 55)}
              {th('Market Rent', 'market_rent', 70)}
              {th('Mkt RUBS', 'market_rubs', 55)}
              {th('UW Rent', '_uwRent', 65)}
              {th('UW RUBS', '_uwRubs', 55)}
              {th('Stab Mo', 'stabilized_month', 50)}
              {th('Notes', 'notes', 80)}
              <th style={{ padding: cellPad, borderBottom: borderC, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayUnits.length === 0 && (
              <tr><td colSpan={22} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No units yet. Click "+ Add Unit" to start building the rent roll.</td></tr>
            )}
            {displayUnits.map((u, di) => {
              const i = u._idx // original index for editing
              const rowBg = u.status === 'Vacant' ? '#FFF8F0' : di % 2 === 0 ? '#fff' : '#fafafa'
              return (
                <tr key={di} style={{ background: rowBg }}>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center', fontSize: 10, color: '#aaa' }}>{di + 1}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'unit_number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{sel(i, 'unit_type', UNIT_TYPES)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'unit_sf', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'tenant_name')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{sel(i, 'status', UNIT_STATUSES)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'actual_rent', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'current_rubs', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'recurring_charges', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{dateInp(i, 'effective_rent_date')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{dateInp(i, 'move_in_date')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{dateInp(i, 'lease_end_date')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{sel(i, 'lease_type', LEASE_TYPES)}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'security_deposit', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'pre_paid_rent', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'market_rent', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'market_rubs', 'number')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', background: '#E1F5EE', fontSize: 11 }}>{fmt$(uwRent(units[i]))}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'right', background: '#E1F5EE', fontSize: 11 }}>{fmt$(uwRubs(units[i]))}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>
                    {(() => {
                      // Look up by _idx which equals sort_order — stable even after save reinserts
                      const computed = opModel?.unitStabMap?.[u._idx]
                      if (computed !== null && computed !== undefined) {
                        const label = computed === 0 ? 'At close' : `Mo ${computed}`
                        return (
                          <div style={{ textAlign: 'right', fontSize: 11 }}>
                            <span style={{ fontWeight: 600, color: '#27500A' }}>{label}</span>
                            <span style={{ color: '#aaa', fontSize: 10, marginLeft: 2 }}>auto</span>
                          </div>
                        )
                      }
                      return inp(i, 'stabilized_month', 'number')
                    })()}
                  </td>
                  <td style={{ padding: cellPad, borderBottom: borderC }}>{inp(i, 'notes')}</td>
                  <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                    <button onClick={() => removeUnit(i)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 14, padding: 0 }} title="Remove unit">×</button>
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