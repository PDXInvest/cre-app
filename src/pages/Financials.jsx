import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/* ── Line item definitions ── */
const REVENUE_ITEMS = [
  { code: 'market_rent', label: 'Market Rent' },
  { code: 'loss_to_lease', label: 'Loss-to-Lease' },
  { code: 'vacancy_credit_loss', label: 'Actual Vacancy & Credit Loss' },
  { code: 'concessions', label: 'Concessions' },
  { code: 'collected_rent', label: 'Collected Rent' },
]
const OTHER_INCOME_ITEMS = [
  { code: 'rubs', label: 'RUBS' },
  { code: 'parking', label: 'Parking Income' },
  { code: 'storage', label: 'Storage / Garage Income' },
  { code: 'other_income', label: 'Other Income' },
]
const EXPENSE_ITEMS = [
  { code: 'administrative', label: 'Administrative' },
  { code: 'property_taxes', label: 'Property Taxes' },
  { code: 'other_taxes', label: 'Other Taxes / Fees' },
  { code: 'insurance', label: 'Property Insurance' },
  { code: 'utilities', label: 'Utilities' },
  { code: 'property_mgmt', label: 'Property Management' },
  { code: 'repairs_maintenance', label: 'Repairs & Maintenance' },
  { code: 'landscaping', label: 'Landscaping' },
  { code: 'turnover', label: 'Turnover' },
  { code: 'capital_reserves', label: 'Capital Reserves' },
  { code: 'security', label: 'Security' },
  { code: 'contract_services', label: 'Contract Services' },
  { code: 'advertising', label: 'Advertising & Marketing' },
  { code: 'payroll', label: 'Payroll' },
  { code: 'misc', label: 'Misc' },
]
const CAPEX_ITEMS = [
  { code: 'capital_improvements', label: 'Capital Improvements' },
]

const ALL_LINE_ITEMS = [...REVENUE_ITEMS, ...OTHER_INCOME_ITEMS, ...EXPENSE_ITEMS, ...CAPEX_ITEMS]

function currentYears() {
  const y = new Date().getFullYear()
  return [y - 3, y - 2, y - 1]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const borderC = '0.5px solid rgba(0,0,0,0.1)'
const cellPad = '5px 8px'
const fmt$ = v => { const n = Number(v); return isNaN(n) || n === 0 ? '—' : (n < 0 ? '-$' + Math.abs(Math.round(n)).toLocaleString() : '$' + Math.round(n).toLocaleString()) }

export default function Financials({ proposal }) {
  const [data, setData] = useState(null)
  const [rentRollUnits, setRentRollUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [section, setSection] = useState('annual') // annual | monthly

  const years = currentYears()
  const periods = [...years.map(String), 't12', 'scheduled', 'stabilized', 'market']
  const periodLabels = [...years.map(String), 'T-12', 'Scheduled', 'Stabilized', 'Market']

  useEffect(() => { loadData() }, [proposal.id])

  // Default T-12 end month = last completed month
  function defaultEndMonth() {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  async function loadData() {
    setLoading(true)
    const [{ data: row }, { data: rrUnits }] = await Promise.all([
      supabase.from('proposal_financials').select('*').eq('proposal_id', proposal.id).maybeSingle(),
      supabase.from('rent_roll_units').select('*').eq('proposal_id', proposal.id),
    ])
    if (row) {
      setData(row)
    } else {
      const empty = { proposal_id: proposal.id, income_statement: {}, t12_monthly: {}, growth_assumptions: { t12_end_month: defaultEndMonth() } }
      const { data: created } = await supabase.from('proposal_financials').insert(empty).select().single()
      setData(created)
    }
    setRentRollUnits(rrUnits || [])
    setLoading(false)
  }

  // T-12 end month — stored in growth_assumptions, user controls when it advances
  const t12EndMonth = data?.growth_assumptions?.t12_end_month || defaultEndMonth()

  function advanceT12() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const next = new Date(y, m, 1) // m is already 1-indexed, so this gives next month
    const newEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setData(prev => ({
      ...prev,
      growth_assumptions: { ...(prev.growth_assumptions || {}), t12_end_month: newEnd }
    }))
  }

  function rewindT12() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const newEnd = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    setData(p => ({
      ...p,
      growth_assumptions: { ...(p.growth_assumptions || {}), t12_end_month: newEnd }
    }))
  }

  // ── Rent Roll → Scheduled column link ──
  const rrTotalActual = rentRollUnits.reduce((s, u) => s + (Number(u.actual_rent) || 0), 0)
  const rrTotalMarket = rentRollUnits.reduce((s, u) => s + (Number(u.market_rent) || 0), 0)
  const rrTotalRubs = rentRollUnits.reduce((s, u) => s + (Number(u.current_rubs) || 0), 0)
  const rrAnnual = {
    collected_rent: rrTotalActual * 12,
    market_rent: rrTotalMarket * 12,
    loss_to_lease: (rrTotalActual - rrTotalMarket) * 12,
    rubs: rrTotalRubs * 12,
  }
  const isRentRollLinked = (period, code) => period === 'scheduled' && rrAnnual[code] != null && rentRollUnits.length > 0

  // ── Annual income statement helpers ──
  function getVal(period, code) {
    if (period === 't12') return t12MonthlyTotal(code) || ''
    if (isRentRollLinked(period, code)) return rrAnnual[code] || ''
    return data?.income_statement?.[period]?.[code] ?? ''
  }
  function setVal(period, code, value) {
    if (period === 't12') return
    if (isRentRollLinked(period, code)) return
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      is[period] = { ...(is[period] || {}), [code]: value === '' ? null : Number(value) }
      return { ...prev, income_statement: is }
    })
  }
  const isT12 = p => p === 't12'
  const isReadOnly = (p, code) => isT12(p) || isRentRollLinked(p, code)

  // ── Custom line items per section ──
  function getCustomItems(sectionKey) {
    return data?.income_statement?._custom_items?.[sectionKey] || []
  }
  function addCustomItem(sectionKey) {
    const id = `custom_${sectionKey}_${Date.now()}`
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      const ci = { ...(is._custom_items || {}) }
      ci[sectionKey] = [...(ci[sectionKey] || []), { code: id, label: '' }]
      is._custom_items = ci
      return { ...prev, income_statement: is }
    })
  }
  function removeCustomItem(sectionKey, code) {
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      const ci = { ...(is._custom_items || {}) }
      ci[sectionKey] = (ci[sectionKey] || []).filter(i => i.code !== code)
      is._custom_items = ci
      // Also clean up values from all periods
      Object.keys(is).forEach(k => { if (k !== '_custom_items' && is[k]?.[code] != null) { is[k] = { ...is[k] }; delete is[k][code] } })
      return { ...prev, income_statement: is }
    })
  }
  function renameCustomItem(sectionKey, code, newLabel) {
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      const ci = { ...(is._custom_items || {}) }
      ci[sectionKey] = (ci[sectionKey] || []).map(i => i.code === code ? { ...i, label: newLabel } : i)
      is._custom_items = ci
      return { ...prev, income_statement: is }
    })
  }

  // ── Monthly T-12 helpers ──
  function getMonthVal(monthKey, code) {
    return data?.t12_monthly?.[monthKey]?.[code] ?? ''
  }
  function setMonthVal(monthKey, code, value) {
    setData(prev => {
      const tm = { ...(prev.t12_monthly || {}) }
      tm[monthKey] = { ...(tm[monthKey] || {}), [code]: value === '' ? null : Number(value) }
      return { ...prev, t12_monthly: tm }
    })
  }

  // ── Computed totals for annual ──
  function sumItems(period, items) {
    return items.reduce((s, item) => s + (Number(getVal(period, item.code)) || 0), 0)
  }
  function sumCustom(period, sectionKey) {
    return getCustomItems(sectionKey).reduce((s, item) => s + (Number(getVal(period, item.code)) || 0), 0)
  }
  // Total Rental Revenue = Collected Rent only (Market Rent, L2L, Vacancy, Concessions are informational)
  function totalRentalRevenue(p) { return (Number(getVal(p, 'collected_rent')) || 0) + sumCustom(p, 'revenue') }
  function totalOtherIncome(p) { return sumItems(p, OTHER_INCOME_ITEMS) + sumCustom(p, 'other_income') }
  function grossRevenue(p) { return totalRentalRevenue(p) + totalOtherIncome(p) }
  function genVacancy(p) { return Number(getVal(p, '_gen_vacancy')) || 0 }
  function effectiveGrossRevenue(p) { return grossRevenue(p) + genVacancy(p) }
  function totalExpenses(p) { return sumItems(p, EXPENSE_ITEMS) + sumCustom(p, 'expense') }
  function noi(p) { return effectiveGrossRevenue(p) - totalExpenses(p) }
  function totalCapex(p) { return sumItems(p, CAPEX_ITEMS) }
  function cashFlow(p) { return noi(p) - totalCapex(p) }

  // ── Monthly computed totals ──
  function sumMonthItems(monthKey, items) {
    return items.reduce((s, item) => s + (Number(getMonthVal(monthKey, item.code)) || 0), 0)
  }
  function sumMonthCustom(monthKey, sectionKey) {
    return getCustomItems(sectionKey).reduce((s, item) => s + (Number(getMonthVal(monthKey, item.code)) || 0), 0)
  }
  // Monthly Total Rental Revenue = collected_rent only
  function monthlyTotalRentalRevenue(mk) { return (Number(getMonthVal(mk, 'collected_rent')) || 0) + sumMonthCustom(mk, 'revenue') }

  // ── Get T-12 month keys based on stored end month ──
  function getT12MonthKeys() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const endDate = new Date(y, m - 1, 1) // month is 0-indexed in Date
    const keys = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return keys
  }
  const t12Months = getT12MonthKeys()

  function monthLabel(key) {
    const [y, m] = key.split('-')
    return `${MONTHS[parseInt(m) - 1]} ${y.slice(-2)}`
  }

  // T-12 annual total from monthly
  function t12MonthlyTotal(code) {
    return t12Months.reduce((s, mk) => s + (Number(getMonthVal(mk, code)) || 0), 0)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('proposal_financials')
      .update({
        income_statement: data.income_statement,
        t12_monthly: data.t12_monthly,
        growth_assumptions: data.growth_assumptions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
    if (error) { console.error(error); setMsg('Save error'); setSaving(false); return }
    setMsg('Financials saved')
    setTimeout(() => setMsg(''), 3000)
    setSaving(false)
  }

  // ── Styles ──
  const projBg = '#EEEDFE' // light purple for projection columns
  const isProj = p => ['scheduled', 'stabilized', 'market'].includes(p)
  const hdrStyle = { padding: cellPad, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', background: '#f9f9f9', borderBottom: borderC, borderRight: borderC }
  const labelStyle = { padding: cellPad, fontSize: 12, fontWeight: 500, background: '#fff', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }
  const totalLabelStyle = { ...labelStyle, fontWeight: 600, background: '#f5f5f5' }
  const totalCellStyle = (p) => ({ padding: cellPad, fontSize: 12, fontWeight: 600, textAlign: 'right', background: isT12(p) ? t12Bg : isProj(p) ? projBg : '#f5f5f5', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' })
  const inputCell = (p) => ({ padding: '2px 4px', borderBottom: borderC, borderRight: borderC, background: isProj(p) ? '#F8F7FF' : 'transparent' })
  const numInput = { width: '100%', padding: '4px 6px', border: '0.5px solid #e0e0e0', borderRadius: 4, fontSize: 12, textAlign: 'right', background: 'transparent' }
  const t12Bg = '#E6F1FB' // blue tint for T-12 column (matches monthly total)
  const tabBtn = (active) => ({ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? '#111' : '#888', borderBottom: active ? '2px solid #111' : 'none' })

  // Cell renderer: read-only computed value for T-12, editable input for other periods
  // Cell renderer: read-only for T-12 and rent-roll-linked, editable for others
  const rrBg = '#E1F5EE'
  const cellBg = p => isT12(p) ? t12Bg : isProj(p) ? '#F8F7FF' : 'transparent'
  const valCell = (p, code) => {
    if (isReadOnly(p, code)) {
      const bg = isT12(p) ? t12Bg : isRentRollLinked(p, code) ? rrBg : '#f5f5f5'
      return <td key={p} style={{ padding: cellPad, textAlign: 'right', fontSize: 12, background: bg, borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap', color: '#333' }} title={isRentRollLinked(p, code) ? 'From rent roll (annualized)' : undefined}>{fmt$(getVal(p, code))}</td>
    }
    return <td key={p} style={inputCell(p)}><input type="number" value={getVal(p, code)} onChange={e => setVal(p, code, e.target.value)} style={numInput} placeholder="0" /></td>
  }

  // Custom row rendering for annual view
  const customRowsAnnual = (sectionKey) => (
    <>
      {getCustomItems(sectionKey).map(item => (
        <tr key={item.code}>
          <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input value={item.label} onChange={e => renameCustomItem(sectionKey, item.code, e.target.value)} placeholder="Custom line item..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, fontStyle: item.label ? 'normal' : 'italic', color: item.label ? '#333' : '#aaa', outline: 'none', padding: 0 }} />
              <button onClick={() => removeCustomItem(sectionKey, item.code)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }} title="Remove">×</button>
            </div>
          </td>
          {periods.map(p => valCell(p, item.code))}
        </tr>
      ))}
      <tr>
        <td colSpan={periods.length + 1} style={{ padding: '2px 16px', borderBottom: borderC }}>
          <button onClick={() => addCustomItem(sectionKey)} style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontSize: 11, padding: '2px 0' }}>+ Add custom row</button>
        </td>
      </tr>
    </>
  )

  // Custom row rendering for monthly view
  const customRowsMonthly = (sectionKey) => (
    <>
      {getCustomItems(sectionKey).map(item => (
        <tr key={item.code}>
          <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0', fontSize: 11 }}>
            <span style={{ fontStyle: item.label ? 'normal' : 'italic', color: item.label ? '#333' : '#aaa' }}>{item.label || 'Custom'}</span>
          </td>
          {t12Months.map(mk => (
            <td key={mk} style={inputCell(mk)}>
              <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} style={{ ...numInput, fontSize: 11, padding: '3px 4px' }} placeholder="0" />
            </td>
          ))}
          <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB', fontSize: 11 }}>{fmt$(t12MonthlyTotal(item.code))}</td>
        </tr>
      ))}
    </>
  )

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading financials...</div>

  return (
    <div>
      {msg && <div style={{ padding: '6px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 2, borderBottom: borderC }}>
          <button onClick={() => setSection('annual')} style={tabBtn(section === 'annual')}>Summary Income Statement</button>
          <button onClick={() => setSection('monthly')} style={tabBtn(section === 'monthly')}>T-12 Monthly Detail</button>
        </div>
        <button onClick={save} disabled={saving} style={{ padding: '6px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 12, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Financials'}
        </button>
      </div>

      {/* ── ANNUAL INCOME STATEMENT ── */}
      {section === 'annual' && (
        <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ ...hdrStyle, width: 220, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 }}>Summary Income Statement</th>
                {periods.map((p, i) => (
                  <th key={i} style={{ ...hdrStyle, textAlign: 'center', minWidth: 100, background: isT12(p) ? t12Bg : isProj(p) ? projBg : '#f9f9f9' }}>
                    {periodLabels[i]}
                    {isT12(p) && t12Months.length > 0 && <div style={{ fontSize: 9, fontWeight: 400, color: '#888', marginTop: 1 }}>{monthLabel(t12Months[0])}–{monthLabel(t12Months[11])}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* RENTAL REVENUE */}
              <tr><td colSpan={periods.length + 1} style={hdrStyle}>Rental Revenue</td></tr>
              {REVENUE_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                  {periods.map(p => valCell(p, item.code))}
                </tr>
              ))}
              {customRowsAnnual('revenue')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Rental Revenue</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(totalRentalRevenue(p))}</td>)}
              </tr>

              {/* OTHER INCOME */}
              <tr><td colSpan={periods.length + 1} style={hdrStyle}>Other Income</td></tr>
              {OTHER_INCOME_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                  {periods.map(p => valCell(p, item.code))}
                </tr>
              ))}
              {customRowsAnnual('other_income')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Other Income</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(totalOtherIncome(p))}</td>)}
              </tr>

              {/* EFFECTIVE GROSS REVENUE */}
              <tr><td colSpan={periods.length + 1} style={hdrStyle}>Effective Gross Revenue</td></tr>
              <tr>
                <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>Gross Revenue</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(grossRevenue(p))}</td>)}
              </tr>
              <tr>
                <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>General Vacancy & Credit Loss</td>
                {periods.map(p => valCell(p, '_gen_vacancy'))}
              </tr>
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Effective Gross Revenue</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(effectiveGrossRevenue(p))}</td>)}
              </tr>

              {/* OPERATING EXPENSES */}
              <tr><td colSpan={periods.length + 1} style={hdrStyle}>Operating Expenses</td></tr>
              {EXPENSE_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                  {periods.map(p => valCell(p, item.code))}
                </tr>
              ))}
              {customRowsAnnual('expense')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Operating Expenses</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(totalExpenses(p))}</td>)}
              </tr>

              {/* NOI */}
              <tr><td colSpan={periods.length + 1} style={{ ...hdrStyle, height: 6 }}></td></tr>
              <tr>
                <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1, fontSize: 13 }}>NET OPERATING INCOME</td>
                {periods.map(p => <td key={p} style={{ ...totalCellStyle(p), fontSize: 13, color: noi(p) >= 0 ? '#085041' : '#791F1F' }}>{fmt$(noi(p))}</td>)}
              </tr>

              {/* CAPITAL IMPROVEMENTS */}
              <tr><td colSpan={periods.length + 1} style={{ ...hdrStyle, height: 6 }}></td></tr>
              {CAPEX_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                  {periods.map(p => valCell(p, item.code))}
                </tr>
              ))}

              {/* CASH FLOW */}
              <tr>
                <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1 }}>Cash Flow from Operations</td>
                {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(cashFlow(p))}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── T-12 MONTHLY DETAIL ── */}
      {section === 'monthly' && (
        <div>
          {/* T-12 Period Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 14px', background: '#fff', borderRadius: 10, border: borderC }}>
            <span style={{ fontSize: 12, color: '#666' }}>T-12 Period:</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{monthLabel(t12Months[0])} — {monthLabel(t12Months[11])}</span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button onClick={rewindT12} style={{ padding: '4px 10px', fontSize: 11, background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>← Back 1 month</button>
              <button onClick={advanceT12} style={{ padding: '4px 10px', fontSize: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Advance 1 month →</button>
            </div>
          </div>
        <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1400 }}>
            <thead>
              <tr>
                <th style={{ ...hdrStyle, width: 200, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, fontSize: 10 }}>T-12 Monthly Detail</th>
                {t12Months.map(mk => (
                  <th key={mk} style={{ ...hdrStyle, textAlign: 'center', minWidth: 80, fontSize: 10 }}>{monthLabel(mk)}</th>
                ))}
                <th style={{ ...hdrStyle, textAlign: 'center', minWidth: 90, fontSize: 10, background: '#E6F1FB' }}>T-12 Total</th>
              </tr>
            </thead>
            <tbody>
              {/* RENTAL REVENUE */}
              <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Rental Revenue</td></tr>
              {REVENUE_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11 }}>{item.label}</td>
                  {t12Months.map(mk => (
                    <td key={mk} style={inputCell(mk)}>
                      <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} style={{ ...numInput, fontSize: 11, padding: '3px 4px' }} placeholder="0" />
                    </td>
                  ))}
                  <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB', fontSize: 11 }}>{fmt$(t12MonthlyTotal(item.code))}</td>
                </tr>
              ))}
              {customRowsMonthly('revenue')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Rental Revenue</td>
                {t12Months.map(mk => <td key={mk} style={totalCellStyle(mk)}>{fmt$(monthlyTotalRentalRevenue(mk))}</td>)}
                <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB' }}>{fmt$(t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk), 0))}</td>
              </tr>

              {/* OTHER INCOME */}
              <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Other Income</td></tr>
              {OTHER_INCOME_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11 }}>{item.label}</td>
                  {t12Months.map(mk => (
                    <td key={mk} style={inputCell(mk)}>
                      <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} style={{ ...numInput, fontSize: 11, padding: '3px 4px' }} placeholder="0" />
                    </td>
                  ))}
                  <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB', fontSize: 11 }}>{fmt$(t12MonthlyTotal(item.code))}</td>
                </tr>
              ))}
              {customRowsMonthly('other_income')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Other Income</td>
                {t12Months.map(mk => <td key={mk} style={totalCellStyle(mk)}>{fmt$(sumMonthItems(mk, OTHER_INCOME_ITEMS) + sumMonthCustom(mk, 'other_income'))}</td>)}
                <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB' }}>{fmt$([...OTHER_INCOME_ITEMS, ...getCustomItems('other_income')].reduce((s, i) => s + t12MonthlyTotal(i.code), 0))}</td>
              </tr>

              {/* OPERATING EXPENSES */}
              <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Operating Expenses</td></tr>
              {EXPENSE_ITEMS.map(item => (
                <tr key={item.code}>
                  <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11 }}>{item.label}</td>
                  {t12Months.map(mk => (
                    <td key={mk} style={inputCell(mk)}>
                      <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} style={{ ...numInput, fontSize: 11, padding: '3px 4px' }} placeholder="0" />
                    </td>
                  ))}
                  <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB', fontSize: 11 }}>{fmt$(t12MonthlyTotal(item.code))}</td>
                </tr>
              ))}
              {customRowsMonthly('expense')}
              <tr>
                <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Operating Expenses</td>
                {t12Months.map(mk => <td key={mk} style={totalCellStyle(mk)}>{fmt$(sumMonthItems(mk, EXPENSE_ITEMS) + sumMonthCustom(mk, 'expense'))}</td>)}
                <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB' }}>{fmt$([...EXPENSE_ITEMS, ...getCustomItems('expense')].reduce((s, i) => s + t12MonthlyTotal(i.code), 0))}</td>
              </tr>

              {/* NOI */}
              <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, height: 4 }}></td></tr>
              <tr>
                <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1, fontSize: 12 }}>NET OPERATING INCOME</td>
                {t12Months.map(mk => {
                  const rev = monthlyTotalRentalRevenue(mk) + sumMonthItems(mk, OTHER_INCOME_ITEMS) + sumMonthCustom(mk, 'other_income')
                  const exp = sumMonthItems(mk, EXPENSE_ITEMS) + sumMonthCustom(mk, 'expense')
                  const n = rev - exp
                  return <td key={mk} style={{ ...totalCellStyle, fontSize: 11, color: n >= 0 ? '#085041' : '#791F1F' }}>{fmt$(n)}</td>
                })}
                <td style={{ ...totalCellStyle('t12'), background: '#E6F1FB', fontSize: 12 }}>{fmt$(
                  t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk), 0) +
                  [...OTHER_INCOME_ITEMS, ...getCustomItems('other_income')].reduce((s, i) => s + t12MonthlyTotal(i.code), 0) -
                  [...EXPENSE_ITEMS, ...getCustomItems('expense')].reduce((s, i) => s + t12MonthlyTotal(i.code), 0)
                )}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}