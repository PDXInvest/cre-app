import { useState } from 'react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, ALL_CATEGORIES } from '../utils/pdfExtract'

const fC = v => v != null ? '$' + Math.round(Number(v)).toLocaleString() : '—'

export default function PdfPreviewFinancials({ type, data, onConfirm, onCancel }) {
  const isT12 = type === 't12_monthly'
  const rawPeriods = isT12 ? data.months || {} : data.years || {}
  const periodKeys = Object.keys(rawPeriods).sort()
  const mapped = data.mapped || []
  const initialUnmapped = (data.unmapped || []).map((item, i) => ({ ...item, _key: i, assignedCode: '' }))
  const [unmapped, setUnmapped] = useState(initialUnmapped)

  const lowConfidence = new Set(mapped.filter(m => m.confidence === 'low').map(m => m.code))

  const allCodes = new Set()
  periodKeys.forEach(pk => {
    Object.keys(rawPeriods[pk] || {}).forEach(code => allCodes.add(code))
  })

  const incomeRows = []
  const expenseRows = []
  allCodes.forEach(code => {
    const incCat = INCOME_CATEGORIES.find(c => c.code === code)
    const expCat = EXPENSE_CATEGORIES.find(c => c.code === code)
    const pdfLabel = mapped.find(m => m.code === code)?.pdf_label || code
    const values = {}
    periodKeys.forEach(pk => { values[pk] = rawPeriods[pk]?.[code] || 0 })
    const total = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0)
    if (total === 0) return
    const row = { code, label: incCat?.label || expCat?.label || pdfLabel, pdfLabel, values, total, isLow: lowConfidence.has(code) }
    if (incCat) incomeRows.push(row)
    else if (expCat) expenseRows.push(row)
    else incomeRows.push(row)
  })

  function assignUnmapped(idx, code) {
    setUnmapped(prev => prev.map((item, i) => i === idx ? { ...item, assignedCode: code } : item))
  }

  function buildMergedData() {
    const result = {}
    periodKeys.forEach(pk => { result[pk] = { ...(rawPeriods[pk] || {}) } })
    unmapped.forEach(item => {
      if (!item.assignedCode) return
      periodKeys.forEach(pk => {
        const val = item.values?.[pk]
        if (val != null && val !== 0) {
          result[pk][item.assignedCode] = (result[pk][item.assignedCode] || 0) + Number(val)
        }
      })
    })
    return result
  }

  const dateRange = isT12
    ? `${data.start_month || periodKeys[0] || '?'} — ${data.end_month || periodKeys[periodKeys.length - 1] || '?'}`
    : periodKeys.join(', ')

  const cellPad = '5px 8px'
  const borderC = '0.5px solid rgba(0,0,0,0.1)'
  const numCell = { padding: cellPad, textAlign: 'right', fontSize: 11, borderBottom: borderC, whiteSpace: 'nowrap' }

  function Section({ title, rows }) {
    if (!rows.length) return null
    return (
      <>
        <tr><td colSpan={periodKeys.length + 3} style={{ padding: '8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', background: '#f9f9f9', borderBottom: borderC }}>{title}</td></tr>
        {rows.map(row => (
          <tr key={row.code} style={{ background: row.isLow ? '#FFFBEB' : '#fff', borderBottom: borderC }}>
            <td style={{ padding: cellPad, fontSize: 11, borderBottom: borderC, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.pdfLabel}>
              {row.pdfLabel}
            </td>
            <td style={{ padding: cellPad, fontSize: 11, borderBottom: borderC, color: row.isLow ? '#92400E' : '#185FA5', fontWeight: 500 }}>
              {row.label}{row.isLow && ' *'}
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

  const hasUnmapped = unmapped.length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 12, width: '95vw', maxWidth: 1400, maxHeight: '90vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              PDF Import Preview — {isT12 ? 'T-12 Monthly' : 'Income Statement'}
            </h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {dateRange} · {incomeRows.length + expenseRows.length} line items matched
              {hasUnmapped && ` · ${unmapped.length} need mapping`}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {lowConfidence.size > 0 && (
          <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '0.5px solid #F59E0B', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 12 }}>
            Items marked with * have low-confidence matches — review before confirming.
          </div>
        )}

        <div style={{ overflow: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: borderC }}>
                <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 500, color: '#888', width: 160, borderBottom: borderC }}>PDF Line Item</th>
                <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 500, color: '#888', width: 140, borderBottom: borderC }}>Mapped To</th>
                {periodKeys.map(pk => (
                  <th key={pk} style={{ padding: cellPad, textAlign: 'right', fontWeight: 500, color: '#888', borderBottom: borderC, whiteSpace: 'nowrap' }}>
                    {isT12 ? pk.replace(/^\d{4}-/, '').replace(/^0/, '') + '/' + pk.slice(2, 4) : pk}
                  </th>
                ))}
                <th style={{ padding: cellPad, textAlign: 'right', fontWeight: 600, color: '#888', borderBottom: borderC }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <Section title="Income" rows={incomeRows} />
              <Section title="Expenses" rows={expenseRows} />
            </tbody>
          </table>
        </div>

        {hasUnmapped && (
          <div style={{ background: '#FFFBEB', border: '0.5px solid #F59E0B', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 10 }}>Unmapped Items — assign or skip</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: '#888' }}>PDF Line Item</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 500, color: '#888' }}>Total</th>
                  <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: '#888', width: 220 }}>Assign To</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map((item, i) => {
                  const total = Object.values(item.values || {}).reduce((s, v) => s + (Number(v) || 0), 0)
                  return (
                    <tr key={item._key} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{item.pdf_label}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fC(total)}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <select
                          value={item.assignedCode}
                          onChange={e => assignUnmapped(i, e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12, background: item.assignedCode ? '#fff' : '#FFFBEB' }}
                        >
                          <option value="">— Skip —</option>
                          <optgroup label="Income">
                            {INCOME_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                          </optgroup>
                          <optgroup label="Expenses">
                            {EXPENSE_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
