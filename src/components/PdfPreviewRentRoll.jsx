import { useState } from 'react'

const UNIT_TYPES = [
  'Studio / 1 Bath', '1 Bed / 1 Bath',
  '2 Bed / 1 Bath', '2 Bed / 1.5 Bath', '2 Bed / 2 Bath', '2 Bed / 2.5 Bath',
  '3 Bed / 1 Bath', '3 Bed / 1.5 Bath', '3 Bed / 2 Bath', '3 Bed / 2.5 Bath',
  '4 Bed / 1 Bath', '4 Bed / 2 Bath',
]
const STATUSES = ['Current', 'Vacant', 'Notice', 'Down']

export default function PdfPreviewRentRoll({ data, onConfirm, onCancel }) {
  const [units, setUnits] = useState(() =>
    (data.units || []).map((u, i) => ({
      ...u,
      _key: i,
      unit_type: UNIT_TYPES.includes(u.unit_type) ? u.unit_type : '2 Bed / 1 Bath',
      status: STATUSES.includes(u.status) ? u.status : 'Vacant',
      actual_rent: Number(u.actual_rent) || 0,
      unit_sf: u.unit_sf || '',
      security_deposit: u.security_deposit || '',
      tenant_name: u.tenant_name || '',
      effective_rent_date: u.effective_rent_date || '',
      lease_end_date: u.lease_end_date || '',
      move_in_date: u.move_in_date || '',
    }))
  )

  function update(idx, field, value) {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u))
  }
  function removeUnit(idx) {
    setUnits(prev => prev.filter((_, i) => i !== idx))
  }

  const unmapped = data.unmapped_columns || []
  const cellPad = '4px 6px'
  const borderC = '0.5px solid rgba(0,0,0,0.1)'
  const inp = { width: '100%', padding: '4px 6px', border: '0.5px solid #ddd', borderRadius: 4, fontSize: 11, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 12, width: '95vw', maxWidth: 1200, maxHeight: '90vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>PDF Import Preview — Rent Roll</h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{units.length} units extracted</div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {unmapped.length > 0 && (
          <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '0.5px solid #F59E0B', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 12 }}>
            PDF columns not mapped: {unmapped.join(', ')}
          </div>
        )}

        <div style={{ overflow: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: borderC }}>
                {['Unit #', 'Type', 'SF', 'Tenant', 'Status', 'Rent', 'Deposit', 'Lease Start', 'Lease End', 'Move-In', ''].map(h => (
                  <th key={h} style={{ padding: cellPad, fontWeight: 500, color: '#888', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: borderC }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr key={u._key} style={{ borderBottom: borderC }}>
                  <td style={{ padding: cellPad, width: 60 }}>
                    <input value={u.unit_number || ''} onChange={e => update(i, 'unit_number', e.target.value)} style={{ ...inp, width: 50 }} />
                  </td>
                  <td style={{ padding: cellPad, width: 140 }}>
                    <select value={u.unit_type} onChange={e => update(i, 'unit_type', e.target.value)} style={{ ...inp, width: 130 }}>
                      {UNIT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: cellPad, width: 60 }}>
                    <input type="number" value={u.unit_sf} onChange={e => update(i, 'unit_sf', e.target.value)} style={{ ...inp, width: 55, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input value={u.tenant_name} onChange={e => update(i, 'tenant_name', e.target.value)} style={inp} />
                  </td>
                  <td style={{ padding: cellPad, width: 85 }}>
                    <select value={u.status} onChange={e => update(i, 'status', e.target.value)} style={{ ...inp, width: 80 }}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: cellPad, width: 80 }}>
                    <input type="number" value={u.actual_rent} onChange={e => update(i, 'actual_rent', e.target.value)} style={{ ...inp, width: 75, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: cellPad, width: 80 }}>
                    <input type="number" value={u.security_deposit} onChange={e => update(i, 'security_deposit', e.target.value)} style={{ ...inp, width: 75, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: cellPad, width: 110 }}>
                    <input type="date" value={u.effective_rent_date} onChange={e => update(i, 'effective_rent_date', e.target.value)} style={{ ...inp, width: 105 }} />
                  </td>
                  <td style={{ padding: cellPad, width: 110 }}>
                    <input type="date" value={u.lease_end_date} onChange={e => update(i, 'lease_end_date', e.target.value)} style={{ ...inp, width: 105 }} />
                  </td>
                  <td style={{ padding: cellPad, width: 110 }}>
                    <input type="date" value={u.move_in_date} onChange={e => update(i, 'move_in_date', e.target.value)} style={{ ...inp, width: 105 }} />
                  </td>
                  <td style={{ padding: cellPad, width: 30, textAlign: 'center' }}>
                    <button onClick={() => removeUnit(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(units)} disabled={units.length === 0} style={{ padding: '8px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Confirm Import ({units.length} units)
          </button>
        </div>
      </div>
    </div>
  )
}
