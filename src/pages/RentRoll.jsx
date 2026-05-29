import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import PdfImportButton from '../components/PdfImportButton'
import PdfPreviewRentRoll from '../components/PdfPreviewRentRoll'
import { mergeRentRollUnits } from '../utils/pdfExtract'

const UNIT_TYPES = [
  'Studio / 1 Bath', '1 Bed / 1 Bath', '2 Bed / 1 Bath', '2 Bed / 1.5 Bath', '2 Bed / 2 Bath',
  '2 Bed / 2.5 Bath', '3 Bed / 1 Bath', '3 Bed / 1.5 Bath', '3 Bed / 2 Bath', '3 Bed / 2.5 Bath',
  '4 Bed / 1 Bath', '4 Bed / 2 Bath',
]
const LEASE_TYPES = ['Fixed Term', 'M to M']
const UNIT_STATUSES = ['Current', 'Vacant', 'Notice', 'Down']

// Explicit column widths (px) sized to each field's data density; null = flex (Notes).
// table-layout:fixed honors these and the table min-width forces x-scroll.
const RR_COL_W = [
  32,   // #
  60,   // Unit #
  110,  // Type (dropdown)
  70,   // SF
  140,  // Tenant
  90,   // Status (dropdown)
  80,   // Rent
  70,   // RUBS
  70,   // Recurring
  95,   // Eff date
  95,   // Move-in
  95,   // Lease end
  100,  // Lease type (dropdown)
  80,   // Deposit
  70,   // Pre-paid
  85,   // Market rent
  75,   // Mkt RUBS
  80,   // UW rent (computed)
  75,   // UW RUBS (computed)
  70,   // Stab mo (computed)
  null, // Notes (flex)
  34,   // remove
]
const RR_MIN_W = RR_COL_W.reduce((s, w) => s + (w || 160), 0) // Notes floor 160

function fmt$(v) { return v ? '$' + Math.round(Number(v)).toLocaleString() : '—' }

export default function RentRoll({ proposal, opModel, onSaved }) {
  const pr = proposal.properties || {}
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [pdfData, setPdfData] = useState(null)

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

  const inp = (idx, field, type = 'text', left = false) => (
    <input
      type={type}
      className={`rr-in ${left ? 'l' : ''}`}
      value={units[idx][field] ?? ''}
      onChange={e => updateUnit(idx, field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
    />
  )

  const sel = (idx, field, options) => (
    <select className="rr-sel" value={units[idx][field] || ''} onChange={e => updateUnit(idx, field, e.target.value)}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const dateInp = (idx, field) => (
    <input
      type="date"
      className="rr-in l"
      value={units[idx][field] ? units[idx][field].slice(0, 10) : ''}
      onChange={e => updateUnit(idx, field, e.target.value || null)}
    />
  )

  const th = (label, col) => (
    <th onClick={() => toggleSort(col)} className={sortCol === col ? 'is-sort' : ''}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}>Loading rent roll…</div>

  return (
    <div className="uw-pane">
      <div className="uw-pane-head">
        <div>
          <h2>Rent roll</h2>
          <p>{totalUnits} units · {occupancy}% occupied · in-place rent vs. underwritten market</p>
        </div>
        <div className="uw-actions">
          <button className="btn btn-primary" onClick={addUnit}>+ Add unit</button>
          <button className="btn btn-secondary" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : 'Save rent roll'}</button>
          <PdfImportButton type="rent_roll" onExtracted={setPdfData} onError={e => { setMsg(e); setTimeout(() => setMsg(''), 5000) }} />
        </div>
      </div>

      <div className="rr-kpis">
        {[
          { l: 'Total units', v: totalUnits },
          { l: 'Occupied', v: occupied },
          { l: 'Vacant', v: vacant },
          { l: 'Occupancy', v: occupancy + '%' },
          { l: 'Avg rent', v: fmt$(avgRent) },
          { l: 'Total rent', v: fmt$(totalActualRent) },
          { l: 'Total RUBS', v: fmt$(totalRubs) },
          { l: 'Total market', v: fmt$(totalMarketRent) },
          { l: 'Total UW rent', v: fmt$(totalUwRent), pos: true },
        ].map(s => (
          <div className="rr-kpi" key={s.l}>
            <p className="rr-kpi-l">{s.l}</p>
            <p className={`rr-kpi-v ${s.pos ? 'pos' : ''}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {msg && <div style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--pos)', borderRadius: 'var(--r)', fontSize: 12, marginBottom: 12 }}>{msg}</div>}

      {pdfData && (
        <PdfPreviewRentRoll data={pdfData} onCancel={() => setPdfData(null)} onConfirm={imported => {
          const { units: merged, matchedCount, appendedCount } = mergeRentRollUnits(units, imported, proposal.id)
          setUnits(merged)
          setPdfData(null)
          const parts = []
          if (matchedCount) parts.push(`${matchedCount} units updated`)
          if (appendedCount) parts.push(`${appendedCount} new units added`)
          setMsg(`${parts.join(', ')} — click "Save rent roll" to persist`)
          setTimeout(() => setMsg(''), 8000)
        }} />
      )}

      <div className="rr-tablewrap">
        <table className="rr-table" style={{ minWidth: RR_MIN_W }}>
          <colgroup>
            {RR_COL_W.map((w, ci) => <col key={ci} style={w ? { width: w } : undefined} />)}
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              {th('Unit #', 'unit_number')}
              {th('Unit type', 'unit_type')}
              {th('SF', 'unit_sf')}
              {th('Tenant', 'tenant_name')}
              {th('Status', 'status')}
              {th('Rent', 'actual_rent')}
              {th('RUBS', 'current_rubs')}
              {th('Recurring', 'recurring_charges')}
              {th('Eff. date', 'effective_rent_date')}
              {th('Move-in', 'move_in_date')}
              {th('Lease end', 'lease_end_date')}
              {th('Lease type', 'lease_type')}
              {th('Deposit', 'security_deposit')}
              {th('Pre-paid', 'pre_paid_rent')}
              {th('Market rent', 'market_rent')}
              {th('Mkt RUBS', 'market_rubs')}
              {th('UW rent', '_uwRent')}
              {th('UW RUBS', '_uwRubs')}
              {th('Stab mo', 'stabilized_month')}
              {th('Notes', 'notes')}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayUnits.length === 0 && (
              <tr><td colSpan={22} style={{ padding: '2rem', textAlign: 'center', color: 'var(--mute)' }}>No units yet. Click "+ Add unit" to start building the rent roll.</td></tr>
            )}
            {displayUnits.map((u, di) => {
              const i = u._idx // original index for editing
              return (
                <tr key={di} className={u.status === 'Vacant' ? 'is-vacant' : ''}>
                  <td className="idx">{di + 1}</td>
                  <td>{inp(i, 'unit_number', 'text', true)}</td>
                  <td>{sel(i, 'unit_type', UNIT_TYPES)}</td>
                  <td>{inp(i, 'unit_sf', 'number')}</td>
                  <td>{inp(i, 'tenant_name', 'text', true)}</td>
                  <td>{sel(i, 'status', UNIT_STATUSES)}</td>
                  <td>{inp(i, 'actual_rent', 'number')}</td>
                  <td>{inp(i, 'current_rubs', 'number')}</td>
                  <td>{inp(i, 'recurring_charges', 'number')}</td>
                  <td>{dateInp(i, 'effective_rent_date')}</td>
                  <td>{dateInp(i, 'move_in_date')}</td>
                  <td>{dateInp(i, 'lease_end_date')}</td>
                  <td>{sel(i, 'lease_type', LEASE_TYPES)}</td>
                  <td>{inp(i, 'security_deposit', 'number')}</td>
                  <td>{inp(i, 'pre_paid_rent', 'number')}</td>
                  <td>{inp(i, 'market_rent', 'number')}</td>
                  <td>{inp(i, 'market_rubs', 'number')}</td>
                  <td className="rr-uw">{fmt$(uwRent(units[i]))}</td>
                  <td className="rr-uw">{fmt$(uwRubs(units[i]))}</td>
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      // Look up by _idx which equals sort_order — stable even after save reinserts
                      const computed = opModel?.unitStabMap?.[u._idx]
                      if (computed !== null && computed !== undefined) {
                        const label = computed === 0 ? 'At close' : `Mo ${computed}`
                        return <span style={{ color: 'var(--pos)', fontWeight: 600 }}>{label}<span style={{ color: 'var(--mute)', fontSize: 10, marginLeft: 3 }}>auto</span></span>
                      }
                      return inp(i, 'stabilized_month', 'number')
                    })()}
                  </td>
                  <td>{inp(i, 'notes', 'text', true)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="rr-rm" onClick={() => removeUnit(i)} title="Remove unit">×</button>
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
