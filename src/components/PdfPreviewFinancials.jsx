import { useState } from 'react'
import { REVENUE_ITEMS, OTHER_INCOME_GROUPS, EXPENSE_GROUPS, ALL_INCOME_ITEMS, ALL_EXPENSE_ITEMS } from '../utils/pdfExtract'

const fC = v => v != null ? '$' + Math.round(Number(v)).toLocaleString() : '—'

const CategoryDropdown = ({ value, onChange, style }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={style}>
    <option value="">— Skip —</option>
    <optgroup label="Rental Revenue">
      {REVENUE_ITEMS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
    </optgroup>
    {OTHER_INCOME_GROUPS.map(g => (
      <optgroup key={g.group} label={g.group}>
        {g.items.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
      </optgroup>
    ))}
    {EXPENSE_GROUPS.map(g => (
      <optgroup key={g.group} label={g.group}>
        {g.items.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
      </optgroup>
    ))}
  </select>
)

export default function PdfPreviewFinancials({ type, data, onConfirm, onCancel }) {
  const isT12 = type === 't12_monthly'
  const rawPeriods = isT12 ? data.months || {} : data.years || {}
  const periodKeys = Object.keys(rawPeriods).sort()
  const mappedList = data.mapped || []

  const allCodes = new Set()
  periodKeys.forEach(pk => {
    Object.keys(rawPeriods[pk] || {}).forEach(code => allCodes.add(code))
  })

  const incomeCodeSet = new Set(ALL_INCOME_ITEMS.map(c => c.code))
  const expenseCodeSet = new Set(ALL_EXPENSE_ITEMS.map(c => c.code))

  const initialRows = []
  allCodes.forEach(code => {
    const isIncome = incomeCodeSet.has(code)
    const isExpense = expenseCodeSet.has(code)
    const mappedEntry = mappedList.find(m => m.code === code)
    const pdfLabel = mappedEntry?.pdf_label || code
    const isLow = mappedEntry?.confidence === 'low'
    const values = {}
    periodKeys.forEach(pk => { values[pk] = rawPeriods[pk]?.[code] || 0 })
    const total = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0)
    if (total === 0) return
    const section = isIncome ? 'income' : isExpense ? 'expense' : 'income'
    initialRows.push({ _key: code, pdfLabel, assignedCode: code, values, total, isLow, section })
  })

  const initialUnmapped = (data.unmapped || []).map((item, i) => {
    const total = Object.values(item.values || {}).reduce((s, v) => s + (Number(v) || 0), 0)
    return { _key: `unmapped_${i}`, pdfLabel: item.pdf_label, assignedCode: '', values: item.values || {}, total, isLow: false, section: 'unmapped' }
  })

  const [rows, setRows] = useState([...initialRows, ...initialUnmapped])

  const detectedYear = !isT12 && periodKeys.length > 0 ? periodKeys[periodKeys.length - 1] : null
  const currentYear = new Date().getFullYear()
  const yearOptions = []
  for (let y = currentYear - 5; y <= currentYear + 1; y++) yearOptions.push(String(y))
  if (detectedYear && !yearOptions.includes(detectedYear)) yearOptions.push(detectedYear)
  yearOptions.sort()
  const [targetYear, setTargetYear] = useState(detectedYear || String(currentYear))

  function updateRow(key, code) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, assignedCode: code } : r))
  }

  function buildMergedData() {
    const result = {}
    for (const row of rows) {
      if (!row.assignedCode) continue
      if (isT12) {
        periodKeys.forEach(pk => {
          const val = row.values[pk]
          if (val != null && val !== 0) {
            if (!result[pk]) result[pk] = {}
            result[pk][row.assignedCode] = (result[pk][row.assignedCode] || 0) + Number(val)
          }
        })
      } else {
        for (const [pk, val] of Object.entries(row.values)) {
          if (val == null || val === 0) continue
          if (!result[targetYear]) result[targetYear] = {}
          result[targetYear][row.assignedCode] = (result[targetYear][row.assignedCode] || 0) + Number(val)
        }
      }
    }
    return result
  }

  const dateRange = isT12
    ? `${data.start_month || periodKeys[0] || '?'} — ${data.end_month || periodKeys[periodKeys.length - 1] || '?'}`
    : periodKeys.join(', ')

  const incomeRows = rows.filter(r => {
    if (!r.assignedCode) return r.section === 'income' || r.section === 'unmapped'
    return incomeCodeSet.has(r.assignedCode)
  })
  const expenseRows = rows.filter(r => {
    if (!r.assignedCode) return r.section === 'expense'
    return expenseCodeSet.has(r.assignedCode)
  })
  const unmappedRows = rows.filter(r => !r.assignedCode && r.section === 'unmapped')
  const mappedCount = rows.filter(r => r.assignedCode).length
  const unmappedCount = rows.filter(r => !r.assignedCode).length
  const lowCount = rows.filter(r => r.isLow).length

  const cellPad = '5px 8px'
  const borderC = '0.5px solid rgba(0,0,0,0.1)'
  const numCell = { padding: cellPad, textAlign: 'right', fontSize: 11, borderBottom: borderC, whiteSpace: 'nowrap' }
  const dropdownStyle = (isLow, hasCode) => ({
    width: '100%', padding: '4px 6px', border: isLow ? '0.5px solid #F59E0B' : '0.5px solid #ddd',
    borderRadius: 4, fontSize: 11, background: !hasCode ? '#FFFBEB' : isLow ? '#FFFBEB' : '#fff',
  })

  function RowGroup({ title, groupRows }) {
    if (!groupRows.length) return null
    return (
      <>
        <tr><td colSpan={periodKeys.length + 3} style={{ padding: '8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', background: '#f9f9f9', borderBottom: borderC }}>{title}</td></tr>
        {groupRows.map(row => (
          <tr key={row._key} style={{ background: row.isLow ? '#FFFBEB' : !row.assignedCode ? '#FFFBEB' : '#fff', borderBottom: borderC }}>
            <td style={{ padding: cellPad, fontSize: 11, borderBottom: borderC, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.pdfLabel}>
              {row.pdfLabel}
            </td>
            <td style={{ padding: '3px 4px', borderBottom: borderC, width: 180 }}>
              <CategoryDropdown value={row.assignedCode} onChange={code => updateRow(row._key, code)} style={dropdownStyle(row.isLow, !!row.assignedCode)} />
            </td>
            {periodKeys.map(pk => (
              <td key={pk} style={numCell}>{fC(row.values[pk])}</td>
            ))}
            <td style={{ ...numCell, fontWeight: 600 }}>{fC(row.total)}</td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 12, width: '95vw', maxWidth: 1400, maxHeight: '90vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              PDF Import Preview — {isT12 ? 'T-12 Monthly' : 'Income Statement'}
            </h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {dateRange} · {mappedCount} mapped{unmappedCount > 0 && ` · ${unmappedCount} unassigned`}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {lowCount > 0 && (
          <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '0.5px solid #F59E0B', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 12 }}>
            {lowCount} item{lowCount > 1 ? 's have' : ' has'} low-confidence matches (highlighted) — review before confirming.
          </div>
        )}

        <div style={{ overflow: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: borderC }}>
                <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 500, color: '#888', width: 160, borderBottom: borderC }}>PDF Line Item</th>
                <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 500, color: '#888', width: 180, borderBottom: borderC }}>Mapped To</th>
                {periodKeys.map(pk => (
                  <th key={pk} style={{ padding: cellPad, textAlign: 'right', fontWeight: 500, color: '#888', borderBottom: borderC, whiteSpace: 'nowrap' }}>
                    {isT12 ? pk.replace(/^\d{4}-/, '').replace(/^0/, '') + '/' + pk.slice(2, 4) : pk}
                  </th>
                ))}
                <th style={{ padding: cellPad, textAlign: 'right', fontWeight: 600, color: '#888', borderBottom: borderC }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <RowGroup title="Income" groupRows={incomeRows} />
              <RowGroup title="Expenses" groupRows={expenseRows} />
              {unmappedRows.length > 0 && <RowGroup title="Unassigned" groupRows={unmappedRows} />}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {!isT12 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
              <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Write data to:</span>
              <select value={targetYear} onChange={e => setTargetYear(e.target.value)}
                style={{ padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          <button onClick={onCancel} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onConfirm(buildMergedData(), isT12 ? (data.end_month || periodKeys[periodKeys.length - 1]) : null)}
            style={{ padding: '8px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  )
}
