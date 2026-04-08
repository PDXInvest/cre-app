import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/* ═══════════════════════════════════════════════════
   LINE ITEM DEFINITIONS — Full & Summary
   ═══════════════════════════════════════════════════ */

const REVENUE_ITEMS = [
  { code: 'market_rent', label: 'Market Rent' },
  { code: 'loss_to_lease', label: 'Loss-to-Lease' },
  { code: 'vacancy_credit_loss', label: 'Actual Vacancy & Credit Loss' },
  { code: 'concessions', label: 'Concessions' },
  { code: 'collected_rent', label: 'Collected Rent' },
]

const OTHER_INCOME_GROUPS = [
  {
    code: 'rubs', label: 'RUBS', tag: 'RUBS',
    items: [
      { code: 'rubs_electric', label: 'Electricity Reimb' },
      { code: 'rubs_water_sewer', label: 'Water/Sewer Reimbursement' },
      { code: 'rubs_gas', label: 'Gas Reimbursement' },
      { code: 'rubs_trash', label: 'Trash Reimbursement' },
      { code: 'rubs_combined', label: 'Utility Recovery (RUBS) - Combined' },
    ]
  },
  {
    code: 'parking', label: 'Parking Income', tag: 'PARK',
    items: [{ code: 'park_parking', label: 'Parking/Garage' }]
  },
  {
    code: 'storage', label: 'Storage Income', tag: 'STORAGE',
    items: [{ code: 'storage_income', label: 'Storage Income' }]
  },
  {
    code: 'other_income', label: 'Other Income', tag: 'OI',
    items: [
      { code: 'oi_tenant_chargeback', label: 'Tenant Chargeback' },
      { code: 'oi_application_fees', label: 'Application Fees' },
      { code: 'oi_insurance_services', label: 'Insurance Services' },
      { code: 'oi_deposit_forfeit', label: 'Deposit Forfeit' },
      { code: 'oi_interest', label: 'Interest Income' },
      { code: 'oi_late_charges', label: 'Late Charges' },
      { code: 'oi_nsf_fees', label: 'NSF Fees' },
      { code: 'oi_laundry', label: 'Laundry' },
      { code: 'oi_pet_rent', label: 'Other Income (Pet Rent)' },
      { code: 'oi_misc', label: 'Misc Income' },
    ]
  },
]

const EXPENSE_GROUPS = [
  {
    code: 'administrative', label: 'Administrative', tag: 'ADMIN',
    items: [
      { code: 'admin_licenses', label: 'Licenses/Permits/Fees' },
      { code: 'admin_collection', label: 'Collection Expense' },
      { code: 'admin_dues', label: 'Dues & Subscriptions' },
      { code: 'admin_postage', label: 'Postage' },
      { code: 'admin_bank', label: 'Bank Charges' },
      { code: 'admin_onboarding', label: 'Onboarding' },
      { code: 'admin_supplies', label: 'Office Supplies' },
    ]
  },
  {
    code: 'property_taxes', label: 'Property Taxes', tag: 'PTAX',
    items: [{ code: 'ptax_property', label: 'Property Tax' }]
  },
  {
    code: 'other_taxes', label: 'Other Taxes / Fees', tag: 'OTAX',
    items: [
      { code: 'otax_state_local', label: 'State/Local Taxes' },
      { code: 'otax_other', label: 'Taxes Other' },
    ]
  },
  {
    code: 'insurance', label: 'Property Insurance', tag: 'INS',
    items: [{ code: 'ins_property', label: 'Property Insurance' }]
  },
  {
    code: 'utilities', label: 'Utilities', tag: 'UTI',
    items: [
      { code: 'uti_electric', label: 'Electric' },
      { code: 'uti_electric_vacant', label: 'Electric-Vacant' },
      { code: 'uti_water_sewer', label: 'Water/Sewage' },
      { code: 'uti_gas', label: 'Gas' },
      { code: 'uti_trash', label: 'Trash/Recycling' },
      { code: 'uti_combined', label: 'Utilities (Combined)' },
    ]
  },
  {
    code: 'property_mgmt', label: 'Property Management', tag: 'PM',
    items: [
      { code: 'pm_mgmt_fees', label: 'Management Fees' },
      { code: 'pm_lease_up', label: 'Management Lease Up' },
      { code: 'pm_misc_fees', label: 'Misc Fees / Software' },
    ]
  },
  {
    code: 'repairs_maintenance', label: 'Repairs & Maintenance', tag: 'RM',
    items: [
      { code: 'rm_general_maint', label: 'General Maintenance' },
      { code: 'rm_general_repair', label: 'General Repair' },
      { code: 'rm_cleaning', label: 'Cleaning' },
      { code: 'rm_supplies', label: 'Supplies' },
      { code: 'rm_painting', label: 'Painting' },
      { code: 'rm_hvac', label: 'HVAC' },
      { code: 'rm_plumbing', label: 'Plumbing Repair' },
      { code: 'rm_appliance', label: 'Appliance Repair' },
      { code: 'rm_labor', label: 'Labor Expense' },
      { code: 'rm_pest', label: 'Pest Control' },
      { code: 'rm_misc', label: 'Misc' },
    ]
  },
  {
    code: 'landscaping', label: 'Landscaping', tag: 'LAND',
    items: [{ code: 'land_landscaping', label: 'Landscaping' }]
  },
  {
    code: 'turnover', label: 'Turnover', tag: 'TURN',
    items: [{ code: 'turn_misc', label: 'Misc Turnover' }]
  },
  {
    code: 'capital_reserves', label: 'Capital Reserves', tag: 'CAPRES',
    items: [{ code: 'capres_reserves', label: 'Capital Reserves' }]
  },
  {
    code: 'security', label: 'Security', tag: 'SEC',
    items: [{ code: 'sec_security', label: 'Security' }]
  },
  {
    code: 'contract_services', label: 'Contract Services', tag: 'CONSERV',
    items: [{ code: 'conserv_services', label: 'Contract Services' }]
  },
  {
    code: 'advertising', label: 'Advertising & Marketing', tag: 'MARK',
    items: [
      { code: 'mark_leasing', label: 'Leasing Commissions' },
      { code: 'mark_advertising', label: 'Advertising' },
      { code: 'mark_internet', label: 'Internet Advertising' },
    ]
  },
  {
    code: 'payroll', label: 'Payroll', tag: 'PAY',
    items: [{ code: 'pay_payroll', label: 'Payroll' }]
  },
  {
    code: 'misc', label: 'Misc', tag: 'MISC',
    items: [{ code: 'misc_expenses', label: 'Misc Expenses' }]
  },
]

const CAPEX_ITEMS = [{ code: 'capital_improvements', label: 'Capital Improvements' }]

const GROWTH_ASSUMPTIONS = [
  { section: 'Revenue', items: [
    { code: 'rent_bump_cap', label: 'Annual Rent Cap', fmt: 'pct' },
    { code: 'market_rent_growth', label: 'Market Rent Growth', fmt: 'pct' },
    { code: 'loss_to_lease_pct', label: 'Loss-to-Lease', fmt: 'pct' },
    { code: 'concessions_pct', label: 'Concessions', fmt: 'pct' },
    { code: 'vacancy_rate', label: 'General Vacancy & Credit Loss', fmt: 'pct' },
    { code: 'rubs_growth', label: 'RUBS Growth', fmt: 'pct' },
    { code: 'other_income_growth', label: 'Other Income Growth', fmt: 'pct' },
    { code: 'parking_growth', label: 'Parking Income Growth', fmt: 'pct' },
    { code: 'storage_growth', label: 'Storage Income Growth', fmt: 'pct' },
  ]},
  { section: 'Operating Expenses', items: [
    { code: 'controllable_growth', label: 'Controllable Expense Growth', fmt: 'pct' },
    { code: 'rm_growth', label: 'Repairs & Maintenance Growth', fmt: 'pct' },
    { code: 'property_tax_growth', label: 'Property Tax Growth', fmt: 'pct' },
    { code: 'insurance_per_unit', label: 'Insurance ($/unit)', fmt: 'dollar' },
    { code: 'insurance_growth', label: 'Insurance Growth', fmt: 'pct' },
    { code: 'property_mgmt_pct', label: 'Property Management (% of EGR)', fmt: 'pct' },
    { code: 'utilities_per_unit', label: 'Utilities ($/unit)', fmt: 'dollar' },
    { code: 'utilities_growth', label: 'Utilities Growth', fmt: 'pct' },
    { code: 'turnover_per_unit', label: 'Turnover ($/unit)', fmt: 'dollar' },
    { code: 'turnover_growth', label: 'Turnover Growth', fmt: 'pct' },
    { code: 'cap_reserves_per_unit', label: 'Capital Reserves ($/unit)', fmt: 'dollar' },
    { code: 'cap_reserves_growth', label: 'Capital Reserves Growth', fmt: 'pct' },
  ]},
]

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */
function currentYears() { const y = new Date().getFullYear(); return [y - 3, y - 2, y - 1] }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const borderC = '0.5px solid rgba(0,0,0,0.1)'
const cellPad = '5px 8px'
const fmt$ = v => { const n = Number(v); return isNaN(n) || n === 0 ? '—' : (n < 0 ? '-$' + Math.abs(Math.round(n)).toLocaleString() : '$' + Math.round(n).toLocaleString()) }

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */
export default function Financials({ proposal, opModel }) {
  const [data, setData] = useState(null)
  const [rentRollUnits, setRentRollUnits] = useState([])
  const [defaults, setDefaults] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [section, setSection] = useState('annual')
  const [viewMode, setViewMode] = useState('full')

  const years = currentYears()
  const periods = [...years.map(String), 't12', 'scheduled', 'stabilized', 'market']
  const periodLabels = [...years.map(String), 'T-12', 'Scheduled', 'Stabilized', 'Market']

  useEffect(() => { loadData() }, [proposal.id])

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
    try {
      const { data: settingsRow } = await supabase.from('app_settings').select('*').eq('key', 'growth_assumptions').maybeSingle()
      if (settingsRow?.value) setDefaults(settingsRow.value)
    } catch (e) { console.warn('app_settings not available:', e) }
    if (row) { setData(row) } else {
      const empty = { proposal_id: proposal.id, income_statement: {}, t12_monthly: {}, growth_assumptions: { t12_end_month: defaultEndMonth() } }
      const { data: created } = await supabase.from('proposal_financials').insert(empty).select().single()
      setData(created)
    }
    setRentRollUnits(rrUnits || [])
    setLoading(false)
  }

  /* ── T-12 Period ── */
  const t12EndMonth = data?.growth_assumptions?.t12_end_month || defaultEndMonth()
  function advanceT12() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const next = new Date(y, m, 1)
    setData(prev => ({ ...prev, growth_assumptions: { ...(prev.growth_assumptions || {}), t12_end_month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}` } }))
  }
  function rewindT12() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    setData(p => ({ ...p, growth_assumptions: { ...(p.growth_assumptions || {}), t12_end_month: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}` } }))
  }
  function getT12MonthKeys() {
    const [y, m] = t12EndMonth.split('-').map(Number)
    const end = new Date(y, m - 1, 1), keys = []
    for (let i = 11; i >= 0; i--) { const d = new Date(end.getFullYear(), end.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
    return keys
  }
  const t12Months = getT12MonthKeys()
  function monthLabel(key) { const [y, m] = key.split('-'); return `${MONTHS[parseInt(m) - 1]} ${y.slice(-2)}` }

  /* ── T-12 Monthly data ── */
  function getMonthVal(mk, code) { return data?.t12_monthly?.[mk]?.[code] ?? '' }
  function setMonthVal(mk, code, value) {
    setData(prev => {
      const tm = { ...(prev.t12_monthly || {}) }
      tm[mk] = { ...(tm[mk] || {}), [code]: value === '' ? null : Number(value) }
      return { ...prev, t12_monthly: tm }
    })
  }
  function t12Total(code) { return t12Months.reduce((s, mk) => s + (Number(getMonthVal(mk, code)) || 0), 0) }

  // T-12 group sum from detail items
  function t12GroupSum(group) {
    const detailSum = group.items.reduce((s, item) => s + t12Total(item.code), 0)
      + getCustomItems(group.code).reduce((s, ci) => s + t12Total(ci.code), 0)
    if (detailSum !== 0) return detailSum
    return t12Total(group.code) // legacy fallback
  }
  // T-12 monthly group sum for one month
  function monthGroupSum(mk, group) {
    return group.items.reduce((s, item) => s + (Number(getMonthVal(mk, item.code)) || 0), 0)
      + getCustomItems(group.code).reduce((s, ci) => s + (Number(getMonthVal(mk, ci.code)) || 0), 0)
  }

  /* ── Projection engine ── */
  const totalUnits = rentRollUnits.length || (proposal.properties?.total_units ?? 0)
  const rrTotalActual = rentRollUnits.reduce((s, u) => s + (Number(u.actual_rent) || 0), 0)
  const rrTotalMarket = rentRollUnits.reduce((s, u) => s + (Number(u.market_rent) || 0), 0)
  const rrTotalRubs = rentRollUnits.reduce((s, u) => s + (Number(u.current_rubs) || 0), 0)
  const rrTotalMarketRubs = rentRollUnits.reduce((s, u) => s + (Number(u.market_rubs) || 0), 0)

  function ga(code) {
    const ov = data?.growth_assumptions?.[code]
    if (ov != null && ov !== '') return Number(ov) || 0
    return Number(defaults[code]) || 0
  }

  // T-12 value for projection engine — now from detail sums
  function getT12ValForGroup(groupCode) {
    const group = [...OTHER_INCOME_GROUPS, ...EXPENSE_GROUPS].find(g => g.code === groupCode)
    if (group) return t12GroupSum(group)
    return t12Total(groupCode)
  }

  function getAutoCalcValue(period, code) {
    if (!['scheduled', 'stabilized', 'market'].includes(period)) return null
    if (!totalUnits) return null
    try {
      // Stabilized column: use operating model stabilizedYear when available
      if (period === 'stabilized' && opModel?.stabilizedYear) {
        const sy = opModel.stabilizedYear
        if (code === 'collected_rent')  return sy.grossRent || null
        if (code === 'rubs')            return sy.nonRent   || null   // approx — rubs included in nonRent
        if (code === '_gen_vacancy')    return sy.vacancy   ? -sy.vacancy   : null
        if (code === 'concessions')     return sy.concessions ? -sy.concessions : null
        if (code === 'property_mgmt')   return sy.expenses  ? -(sy.egr * ga('property_mgmt_pct')) : null
        // For individual expense line items in stabilized, fall through to standard logic below
        // but use stabYearIdx for growth compounding
        const stabYearIdx = Math.floor((opModel.propertyStabilizedMonth || 12) / 12)
        const expYears = stabYearIdx
        const annualActual = rrTotalActual * 12, annualMarket = rrTotalMarket * 12
        const baseCollected = sy.egr
        if (code === 'insurance')       return ga('insurance_per_unit') * totalUnits * Math.pow(1 + ga('insurance_growth'), expYears)
        if (code === 'utilities')       return ga('utilities_per_unit') * totalUnits * Math.pow(1 + ga('utilities_growth'), expYears)
        if (code === 'turnover')        return ga('turnover_per_unit')  * totalUnits * Math.pow(1 + ga('turnover_growth'),  expYears)
        if (code === 'capital_reserves')return ga('cap_reserves_per_unit') * totalUnits * Math.pow(1 + ga('cap_reserves_growth'), expYears)
        const controllable = ['administrative','repairs_maintenance','landscaping','security','contract_services','advertising','payroll','misc']
        if (controllable.includes(code)) {
          const rate = code === 'repairs_maintenance' ? ga('rm_growth') : ga('controllable_growth')
          return getT12ValForGroup(code) * Math.pow(1 + rate, expYears + 1)
        }
        if (code === 'property_taxes') return getT12ValForGroup('property_taxes') * Math.pow(1 + ga('property_tax_growth'), expYears + 1)
        if (code === 'other_taxes')    return getT12ValForGroup('other_taxes') * Math.pow(1 + ga('controllable_growth'), expYears + 1)
        if (code === 'market_rent')    return annualMarket * Math.pow(1 + ga('market_rent_growth'), stabYearIdx)
        if (code === 'loss_to_lease')  return 0
        if (code === 'parking')        return getT12ValForGroup('parking') * (1 + ga('parking_growth'))
        if (code === 'storage')        return getT12ValForGroup('storage') * (1 + ga('storage_growth'))
        if (code === 'other_income')   return getT12ValForGroup('other_income') * (1 + ga('other_income_growth'))
        return null
      }
      const annualActual = rrTotalActual * 12, annualMarket = rrTotalMarket * 12
      const mktGrowth = 1 + ga('market_rent_growth')
      const baseCollected = period === 'scheduled' ? annualActual : period === 'stabilized' ? annualMarket : annualMarket * mktGrowth
      const baseMarketRent = period === 'market' ? annualMarket * mktGrowth : annualMarket
      if (code === 'market_rent') return baseMarketRent || null
      if (code === 'loss_to_lease') return period === 'scheduled' ? (annualActual - annualMarket) : 0
      if (code === 'collected_rent') return baseCollected || null
      if (code === 'concessions') return baseCollected ? -(baseCollected * ga('concessions_pct')) : null
      if (code === '_gen_vacancy') return baseCollected ? -(baseCollected * ga('vacancy_rate')) : null
      if (code === 'rubs') return period === 'scheduled' ? rrTotalRubs * 12 : rrTotalMarketRubs * 12
      if (code === 'parking') return getT12ValForGroup('parking') * (1 + ga('parking_growth'))
      if (code === 'storage') return getT12ValForGroup('storage') * (1 + ga('storage_growth'))
      if (code === 'other_income') return getT12ValForGroup('other_income') * (1 + ga('other_income_growth'))
      const expYears = period === 'market' ? 2 : period === 'stabilized' ? 1 : 0
      if (code === 'insurance') return ga('insurance_per_unit') * totalUnits * Math.pow(1 + ga('insurance_growth'), expYears)
      if (code === 'utilities') return ga('utilities_per_unit') * totalUnits * Math.pow(1 + ga('utilities_growth'), expYears)
      if (code === 'turnover') return ga('turnover_per_unit') * totalUnits * Math.pow(1 + ga('turnover_growth'), expYears)
      if (code === 'capital_reserves') return ga('cap_reserves_per_unit') * totalUnits * Math.pow(1 + ga('cap_reserves_growth'), expYears)
      const controllable = ['administrative', 'repairs_maintenance', 'landscaping', 'security', 'contract_services', 'advertising', 'payroll', 'misc']
      if (controllable.includes(code)) {
        const rate = code === 'repairs_maintenance' ? ga('rm_growth') : ga('controllable_growth')
        return getT12ValForGroup(code) * Math.pow(1 + rate, expYears + 1)
      }
      if (code === 'property_taxes') return getT12ValForGroup('property_taxes') * Math.pow(1 + ga('property_tax_growth'), expYears + 1)
      if (code === 'other_taxes') return getT12ValForGroup('other_taxes') * Math.pow(1 + ga('controllable_growth'), expYears + 1)
      if (code === 'property_mgmt') {
        const vacancy = baseCollected * ga('vacancy_rate'), conc = baseCollected * ga('concessions_pct')
        return (baseCollected - vacancy - conc) * ga('property_mgmt_pct')
      }
    } catch (e) { console.warn('Projection calc error:', code, e); return null }
    return null
  }
  const isAutoCalc = (p, code) => getAutoCalcValue(p, code) != null

  /* ── Growth Assumption helpers ── */
  function getDefault(code) { return defaults[code] ?? '' }
  function getOverride(code) { return data?.growth_assumptions?.[code] ?? '' }
  function getEffective(code) { const ov = data?.growth_assumptions?.[code]; return ov != null && ov !== '' ? ov : (defaults[code] ?? '') }
  function setDefault(code, value) { setDefaults(prev => ({ ...prev, [code]: value === '' ? null : Number(value) })) }
  function setOverride(code, value) { setData(prev => ({ ...prev, growth_assumptions: { ...(prev.growth_assumptions || {}), [code]: value === '' ? null : Number(value) } })) }
  function clearOverride(code) { setData(prev => { const g = { ...(prev.growth_assumptions || {}) }; delete g[code]; return { ...prev, growth_assumptions: g } }) }

  /* ── Annual data accessors ── */
  function getDetailVal(period, code) {
    if (period === 't12') return t12Total(code)
    const auto = getAutoCalcValue(period, code)
    if (auto != null) return auto
    return data?.income_statement?.[period]?.[code] ?? ''
  }
  function setDetailVal(period, code, value) {
    if (period === 't12') return
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      is[period] = { ...(is[period] || {}), [code]: value === '' ? null : Number(value) }
      return { ...prev, income_statement: is }
    })
  }
  function getVal(period, code) {
    if (period === 't12') return t12Total(code) || ''
    const auto = getAutoCalcValue(period, code)
    if (auto != null) return auto
    return data?.income_statement?.[period]?.[code] ?? ''
  }
  function setVal(period, code, value) {
    if (period === 't12') return
    if (isAutoCalc(period, code)) return
    setData(prev => {
      const is = { ...(prev.income_statement || {}) }
      is[period] = { ...(is[period] || {}), [code]: value === '' ? null : Number(value) }
      return { ...prev, income_statement: is }
    })
  }
  const isT12 = p => p === 't12'
  const isProj = p => ['scheduled', 'stabilized', 'market'].includes(p)
  const isReadOnly = (p, code) => isT12(p) || isAutoCalc(p, code)

  /* ── Group sum for annual ── */
  function sumGroup(period, group) {
    const auto = getAutoCalcValue(period, group.code)
    if (auto != null) return auto
    if (period === 't12') return t12GroupSum(group)
    const detailSum = group.items.reduce((s, item) => s + (Number(data?.income_statement?.[period]?.[item.code]) || 0), 0)
      + sumCustom(period, group.code)
    if (detailSum !== 0) return detailSum
    return Number(data?.income_statement?.[period]?.[group.code]) || 0
  }

  /* ── Custom items (defined in T-12 monthly, flow to annual) ── */
  function getCustomItems(sectionKey) { return data?.income_statement?._custom_items?.[sectionKey] || [] }
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
      Object.keys(is).forEach(k => { if (k !== '_custom_items' && is[k]?.[code] != null) { is[k] = { ...is[k] }; delete is[k][code] } })
      // Also clean monthly data
      const tm = { ...(prev.t12_monthly || {}) }
      Object.keys(tm).forEach(mk => { if (tm[mk]?.[code] != null) { tm[mk] = { ...tm[mk] }; delete tm[mk][code] } })
      return { ...prev, income_statement: is, t12_monthly: tm }
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
  function sumCustom(period, sectionKey) {
    return getCustomItems(sectionKey).reduce((s, item) => {
      if (period === 't12') return s + t12Total(item.code)
      return s + (Number(data?.income_statement?.[period]?.[item.code]) || 0)
    }, 0)
  }

  /* ── Computed totals (annual) ── */
  function totalRentalRevenue(p) { return (Number(getVal(p, 'collected_rent')) || 0) + sumCustom(p, 'revenue') }
  function totalOtherIncome(p) { return OTHER_INCOME_GROUPS.reduce((s, g) => s + sumGroup(p, g), 0) }
  function grossRevenue(p) { return totalRentalRevenue(p) + totalOtherIncome(p) }
  function genVacancy(p) { return Number(getVal(p, '_gen_vacancy')) || 0 }
  function effectiveGrossRevenue(p) { return grossRevenue(p) + genVacancy(p) }
  function totalExpenses(p) { return EXPENSE_GROUPS.reduce((s, g) => s + sumGroup(p, g), 0) }
  function noi(p) { return effectiveGrossRevenue(p) - totalExpenses(p) }
  function totalCapex(p) { return CAPEX_ITEMS.reduce((s, item) => s + (Number(getVal(p, item.code)) || 0), 0) }
  function cashFlow(p) { return noi(p) - totalCapex(p) }

  /* ── T-12 monthly totals for section headers ── */
  function monthlyTotalRentalRevenue(mk) {
    return (Number(getMonthVal(mk, 'collected_rent')) || 0)
      + getCustomItems('revenue').reduce((s, ci) => s + (Number(getMonthVal(mk, ci.code)) || 0), 0)
  }
  function monthlyTotalOtherIncome(mk) { return OTHER_INCOME_GROUPS.reduce((s, g) => s + monthGroupSum(mk, g), 0) }
  function monthlyTotalExpenses(mk) { return EXPENSE_GROUPS.reduce((s, g) => s + monthGroupSum(mk, g), 0) }


  /* ── Save ── */
  async function save() {
    setSaving(true)
    const { error } = await supabase.from('proposal_financials').update({
      income_statement: data.income_statement,
      t12_monthly: data.t12_monthly,
      growth_assumptions: data.growth_assumptions,
      updated_at: new Date().toISOString(),
    }).eq('id', data.id)
    if (error) { console.error(error); setMsg('Save error'); setSaving(false); return }
    try { await supabase.from('app_settings').update({ value: defaults, updated_at: new Date().toISOString() }).eq('key', 'growth_assumptions') } catch (e) { console.warn('Could not save defaults:', e) }
    setMsg('Saved'); setTimeout(() => setMsg(''), 3000); setSaving(false)
  }

  /* ── Styles ── */
  const projBg = '#EEEDFE', t12Bg = '#E6F1FB'
  const hdrStyle = { padding: cellPad, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', background: '#f9f9f9', borderBottom: borderC, borderRight: borderC }
  const labelStyle = { padding: cellPad, fontSize: 12, fontWeight: 500, background: '#fff', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' }
  const totalLabelStyle = { ...labelStyle, fontWeight: 600, background: '#f5f5f5' }
  const totalCellStyle = (p) => ({ padding: cellPad, fontSize: 12, fontWeight: 600, textAlign: 'right', background: isT12(p) ? t12Bg : isProj(p) ? projBg : '#f5f5f5', borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap' })
  const numInput = { width: '100%', padding: '4px 6px', border: '0.5px solid #e0e0e0', borderRadius: 4, fontSize: 12, textAlign: 'right', background: 'transparent' }
  const tabBtn = (active) => ({ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? '#111' : '#888', borderBottom: active ? '2px solid #111' : 'none' })
  const inputCell = (p) => ({ padding: '2px 4px', borderBottom: borderC, borderRight: borderC, background: isProj(p) ? '#F8F7FF' : 'transparent', minWidth: 100 })
  const mInputCell = { padding: '2px 3px', borderBottom: borderC, borderRight: borderC, minWidth: 72 }
  const mNumInput = { ...numInput, fontSize: 11, padding: '3px 4px' }
  const selectOnFocus = e => e.target.select()

  /* ── Annual cell renderers ── */
  const valCell = (p, code) => {
    if (isReadOnly(p, code)) {
      const bg = isT12(p) ? t12Bg : isAutoCalc(p, code) ? projBg : '#f5f5f5'
      return <td key={p} style={{ padding: cellPad, textAlign: 'right', fontSize: 12, background: bg, borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap', color: '#333', minWidth: 100 }}>{fmt$(getVal(p, code))}</td>
    }
    return <td key={p} style={inputCell(p)}><input type="number" value={getVal(p, code)} onChange={e => setVal(p, code, e.target.value)} onFocus={selectOnFocus} style={numInput} placeholder="" /></td>
  }

  // Annual detail cell: T-12 shows monthly total (read-only), projections show "—", historical is editable
  const detailCell = (p, code) => {
    if (isT12(p)) {
      const v = t12Total(code)
      return <td key={p} style={{ padding: cellPad, textAlign: 'right', fontSize: 12, background: t12Bg, borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap', color: '#333', minWidth: 100 }}>{fmt$(v)}</td>
    }
    if (isProj(p)) return <td key={p} style={{ padding: cellPad, textAlign: 'right', fontSize: 12, background: projBg, borderBottom: borderC, borderRight: borderC, color: '#bbb', minWidth: 100 }}>—</td>
    return <td key={p} style={inputCell(p)}><input type="number" value={getDetailVal(p, code)} onChange={e => setDetailVal(p, code, e.target.value)} onFocus={selectOnFocus} style={numInput} placeholder="" /></td>
  }

  const groupSumCell = (p, group) => {
    const v = sumGroup(p, group)
    const bg = isT12(p) ? t12Bg : isProj(p) ? projBg : '#f5f5f5'
    return <td key={p} style={{ padding: cellPad, textAlign: 'right', fontSize: 12, fontWeight: 600, background: bg, borderBottom: borderC, borderRight: borderC, whiteSpace: 'nowrap', minWidth: 100 }}>{fmt$(v)}</td>
  }

  /* ── Annual group renderers ── */
  function renderGroup(group) {
    return [
      ...group.items.map(item => (
        <tr key={item.code}>
          <td style={{ ...labelStyle, paddingLeft: 24, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11, fontWeight: 400, color: '#555' }}>{item.label}</td>
          {periods.map(p => detailCell(p, item.code))}
        </tr>
      )),
      ...getCustomItems(group.code).map(item => (
        <tr key={item.code} style={{ background: '#FFF9F0' }}>
          <td style={{ ...labelStyle, paddingLeft: 24, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0', fontSize: 11, fontWeight: 400, color: '#555', fontStyle: item.label ? 'normal' : 'italic' }}>{item.label || 'Custom'}</td>
          {periods.map(p => detailCell(p, item.code))}
        </tr>
      )),
      <tr key={group.code + '-total'}>
        <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>{group.label}</td>
        {periods.map(p => groupSumCell(p, group))}
      </tr>,
    ]
  }

  function renderGroupSummary(group) {
    return (
      <tr key={group.code}>
        <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{group.label}</td>
        {periods.map(p => groupSumCell(p, group))}
      </tr>
    )
  }

  /* ═══ T-12 MONTHLY group renderer ═══ */
  function renderMonthlyGroup(group) {
    const colCount = t12Months.length + 2
    return [
      ...group.items.map(item => (
        <tr key={item.code}>
          <td style={{ ...labelStyle, paddingLeft: 20, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 10, fontWeight: 400, color: '#555' }}>{item.label}</td>
          {t12Months.map(mk => (
            <td key={mk} style={mInputCell}>
              <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} onFocus={selectOnFocus} style={mNumInput} placeholder="" />
            </td>
          ))}
          <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12Total(item.code))}</td>
        </tr>
      )),
      // Custom rows in this group
      ...getCustomItems(group.code).map(item => (
        <tr key={item.code} style={{ background: '#FFF9F0' }}>
          <td style={{ ...labelStyle, paddingLeft: 20, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0', fontSize: 10, fontWeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input value={item.label} onChange={e => renameCustomItem(group.code, item.code, e.target.value)} placeholder="Custom item..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 10, fontStyle: item.label ? 'normal' : 'italic', color: item.label ? '#555' : '#aaa', outline: 'none', padding: 0 }} />
              <button onClick={() => removeCustomItem(group.code, item.code)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }} title="Remove">×</button>
            </div>
          </td>
          {t12Months.map(mk => (
            <td key={mk} style={mInputCell}>
              <input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} onFocus={selectOnFocus} style={mNumInput} placeholder="" />
            </td>
          ))}
          <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12Total(item.code))}</td>
        </tr>
      )),
      // Add custom row button
      <tr key={group.code + '-m-add'}>
        <td colSpan={colCount} style={{ padding: '2px 20px', borderBottom: borderC }}>
          <button onClick={() => addCustomItem(group.code)} style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontSize: 10, padding: '2px 0' }}>+ Add custom row</button>
        </td>
      </tr>,
      // Group total row
      <tr key={group.code + '-m-total'}>
        <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>{group.label}</td>
        {t12Months.map(mk => <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(monthGroupSum(mk, group))}</td>)}
        <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12GroupSum(group))}</td>
      </tr>,
    ]
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading financials...</div>

  return (
    <div>
      {msg && <div style={{ padding: '6px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 2, borderBottom: borderC }}>
          <button onClick={() => setSection('annual')} style={tabBtn(section === 'annual')}>Income Statement</button>
          <button onClick={() => setSection('monthly')} style={tabBtn(section === 'monthly')}>T-12 Monthly Detail</button>
          <button onClick={() => setSection('assumptions')} style={tabBtn(section === 'assumptions')}>Growth Assumptions</button>
        </div>
        <button onClick={save} disabled={saving} style={{ padding: '6px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 12, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Financials'}
        </button>
      </div>

      {/* ═══ ANNUAL INCOME STATEMENT ═══ */}
      {section === 'annual' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 6, padding: 2 }}>
              {['full', 'summary'].map(v => (
                <button key={v} onClick={() => setViewMode(v)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, border: 'none', borderRadius: 4, cursor: 'pointer', background: viewMode === v ? '#fff' : 'transparent', color: viewMode === v ? '#111' : '#888', boxShadow: viewMode === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' }}>{v}</button>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
              <thead><tr>
                <th style={{ ...hdrStyle, width: 300, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 }}>{viewMode === 'full' ? 'Full Income Statement' : 'Summary Income Statement'}</th>
                {periods.map((p, i) => (
                  <th key={i} style={{ ...hdrStyle, textAlign: 'center', minWidth: 100, background: isT12(p) ? t12Bg : isProj(p) ? projBg : '#f9f9f9' }}>
                    {periodLabels[i]}
                    {isT12(p) && <div style={{ fontSize: 9, fontWeight: 400, color: '#888', marginTop: 1 }}>{monthLabel(t12Months[0])}–{monthLabel(t12Months[11])}</div>}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {/* RENTAL REVENUE */}
                <tr><td colSpan={periods.length + 1} style={hdrStyle}>Rental Revenue</td></tr>
                {REVENUE_ITEMS.map(item => (
                  <tr key={item.code}>
                    <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                    {periods.map(p => valCell(p, item.code))}
                  </tr>
                ))}
                {getCustomItems('revenue').map(item => (
                  <tr key={item.code} style={{ background: '#FFF9F0' }}>
                    <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0', fontStyle: item.label ? 'normal' : 'italic' }}>{item.label || 'Custom'}</td>
                    {periods.map(p => valCell(p, item.code))}
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Rental Revenue</td>
                  {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(totalRentalRevenue(p))}</td>)}
                </tr>

                {/* OTHER INCOME */}
                <tr><td colSpan={periods.length + 1} style={hdrStyle}>Other Income</td></tr>
                {viewMode === 'full' ? OTHER_INCOME_GROUPS.flatMap(g => renderGroup(g)) : OTHER_INCOME_GROUPS.map(g => renderGroupSummary(g))}
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
                {viewMode === 'full' ? EXPENSE_GROUPS.flatMap(g => renderGroup(g)) : EXPENSE_GROUPS.map(g => renderGroupSummary(g))}
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1 }}>Total Operating Expenses</td>
                  {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(totalExpenses(p))}</td>)}
                </tr>
                <tr><td colSpan={periods.length + 1} style={{ padding: cellPad, textAlign: 'right', fontSize: 11, color: '#888', borderBottom: borderC }}>
                  {(() => { const e = effectiveGrossRevenue('scheduled'), x = totalExpenses('scheduled'); return `Expense Ratio (Scheduled): ${e ? ((x / e) * 100).toFixed(1) : '—'}%` })()}
                </td></tr>

                {/* NOI */}
                <tr><td colSpan={periods.length + 1} style={{ ...hdrStyle, height: 6 }}></td></tr>
                <tr>
                  <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1, fontSize: 13 }}>NET OPERATING INCOME</td>
                  {periods.map(p => <td key={p} style={{ ...totalCellStyle(p), fontSize: 13, color: noi(p) >= 0 ? '#085041' : '#791F1F' }}>{fmt$(noi(p))}</td>)}
                </tr>

                {/* CAPEX + CASHFLOW */}
                <tr><td colSpan={periods.length + 1} style={{ ...hdrStyle, height: 6 }}></td></tr>
                {CAPEX_ITEMS.map(item => (
                  <tr key={item.code}>
                    <td style={{ ...labelStyle, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{item.label}</td>
                    {periods.map(p => valCell(p, item.code))}
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1 }}>Cash Flow from Operations</td>
                  {periods.map(p => <td key={p} style={totalCellStyle(p)}>{fmt$(cashFlow(p))}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ T-12 MONTHLY DETAIL (FULL) ═══ */}
      {section === 'monthly' && (
        <div>
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
              <thead><tr>
                <th style={{ ...hdrStyle, width: 220, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, fontSize: 10 }}>T-12 Monthly Detail</th>
                {t12Months.map(mk => <th key={mk} style={{ ...hdrStyle, textAlign: 'center', minWidth: 72, fontSize: 10 }}>{monthLabel(mk)}</th>)}
                <th style={{ ...hdrStyle, textAlign: 'center', minWidth: 90, fontSize: 10, background: t12Bg }}>T-12 Total</th>
              </tr></thead>
              <tbody>
                {/* RENTAL REVENUE */}
                <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Rental Revenue</td></tr>
                {REVENUE_ITEMS.map(item => (
                  <tr key={item.code}>
                    <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11 }}>{item.label}</td>
                    {t12Months.map(mk => <td key={mk} style={mInputCell}><input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} onFocus={selectOnFocus} style={mNumInput} placeholder="" /></td>)}
                    <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12Total(item.code))}</td>
                  </tr>
                ))}
                {/* Revenue custom rows */}
                {getCustomItems('revenue').map(item => (
                  <tr key={item.code} style={{ background: '#FFF9F0' }}>
                    <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#FFF9F0', fontSize: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input value={item.label} onChange={e => renameCustomItem('revenue', item.code, e.target.value)} placeholder="Custom item..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 10, fontStyle: item.label ? 'normal' : 'italic', color: item.label ? '#555' : '#aaa', outline: 'none', padding: 0 }} />
                        <button onClick={() => removeCustomItem('revenue', item.code)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>
                      </div>
                    </td>
                    {t12Months.map(mk => <td key={mk} style={mInputCell}><input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} onFocus={selectOnFocus} style={mNumInput} placeholder="" /></td>)}
                    <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12Total(item.code))}</td>
                  </tr>
                ))}
                <tr><td colSpan={t12Months.length + 2} style={{ padding: '2px 12px', borderBottom: borderC }}>
                  <button onClick={() => addCustomItem('revenue')} style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontSize: 10, padding: '2px 0' }}>+ Add custom row</button>
                </td></tr>
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Rental Revenue</td>
                  {t12Months.map(mk => <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(monthlyTotalRentalRevenue(mk))}</td>)}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg }}>{fmt$(t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk), 0))}</td>
                </tr>

                {/* OTHER INCOME */}
                <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Other Income</td></tr>
                {OTHER_INCOME_GROUPS.flatMap(g => renderMonthlyGroup(g))}
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Other Income</td>
                  {t12Months.map(mk => <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(monthlyTotalOtherIncome(mk))}</td>)}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg }}>{fmt$(OTHER_INCOME_GROUPS.reduce((s, g) => s + t12GroupSum(g), 0))}</td>
                </tr>

                {/* TOTAL OPERATING INCOME */}
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Operating Income</td>
                  {t12Months.map(mk => <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk))}</td>)}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg }}>{fmt$(t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk), 0))}</td>
                </tr>

                {/* OPERATING EXPENSES */}
                <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, fontSize: 10 }}>Operating Expenses</td></tr>
                {EXPENSE_GROUPS.flatMap(g => renderMonthlyGroup(g))}
                <tr>
                  <td style={{ ...totalLabelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Total Operating Expenses</td>
                  {t12Months.map(mk => <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(monthlyTotalExpenses(mk))}</td>)}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg }}>{fmt$(EXPENSE_GROUPS.reduce((s, g) => s + t12GroupSum(g), 0))}</td>
                </tr>

                {/* NOI */}
                <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, height: 4 }}></td></tr>
                <tr>
                  <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1, fontSize: 12 }}>NET OPERATING INCOME</td>
                  {t12Months.map(mk => {
                    const n = (monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk)) - monthlyTotalExpenses(mk)
                    return <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11, color: n >= 0 ? '#085041' : '#791F1F' }}>{fmt$(n)}</td>
                  })}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 12 }}>{fmt$(
                    t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk), 0) -
                    EXPENSE_GROUPS.reduce((s, g) => s + t12GroupSum(g), 0)
                  )}</td>
                </tr>

                {/* CAPEX */}
                <tr><td colSpan={t12Months.length + 2} style={{ ...hdrStyle, height: 4 }}></td></tr>
                {CAPEX_ITEMS.map(item => (
                  <tr key={item.code}>
                    <td style={{ ...labelStyle, paddingLeft: 12, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontSize: 11 }}>{item.label}</td>
                    {t12Months.map(mk => <td key={mk} style={mInputCell}><input type="number" value={getMonthVal(mk, item.code)} onChange={e => setMonthVal(mk, item.code, e.target.value)} onFocus={selectOnFocus} style={mNumInput} placeholder="" /></td>)}
                    <td style={{ ...totalCellStyle('t12'), background: t12Bg, fontSize: 11 }}>{fmt$(t12Total(item.code))}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...totalLabelStyle, position: 'sticky', left: 0, zIndex: 1, fontSize: 11 }}>Cash Flow from Operations</td>
                  {t12Months.map(mk => {
                    const n = (monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk)) - monthlyTotalExpenses(mk) - CAPEX_ITEMS.reduce((s, i) => s + (Number(getMonthVal(mk, i.code)) || 0), 0)
                    return <td key={mk} style={{ ...totalCellStyle(mk), fontSize: 11 }}>{fmt$(n)}</td>
                  })}
                  <td style={{ ...totalCellStyle('t12'), background: t12Bg }}>{fmt$(
                    t12Months.reduce((s, mk) => s + monthlyTotalRentalRevenue(mk) + monthlyTotalOtherIncome(mk), 0) -
                    EXPENSE_GROUPS.reduce((s, g) => s + t12GroupSum(g), 0) -
                    t12Total('capital_improvements')
                  )}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ GROWTH ASSUMPTIONS ═══ */}
      {section === 'assumptions' && (
        <div style={{ background: '#fff', borderRadius: 12, border: borderC, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
            <thead><tr>
              <th style={{ ...hdrStyle, width: 250, textAlign: 'left' }}>Assumption</th>
              <th style={{ ...hdrStyle, textAlign: 'center', minWidth: 120 }}>Default</th>
              <th style={{ ...hdrStyle, textAlign: 'center', minWidth: 140, background: projBg }}>This Proposal</th>
              <th style={{ ...hdrStyle, textAlign: 'center', minWidth: 100 }}>Effective</th>
              <th style={{ ...hdrStyle, width: 40 }}></th>
            </tr></thead>
            <tbody>
              {GROWTH_ASSUMPTIONS.map(group => [
                <tr key={group.section + '-hdr'}><td colSpan={5} style={hdrStyle}>{group.section}</td></tr>,
                ...group.items.map(item => {
                  const isPct = item.fmt === 'pct'
                  const hasOv = data?.growth_assumptions?.[item.code] != null && data?.growth_assumptions?.[item.code] !== ''
                  const rawDefault = defaults[item.code]
                  const rawOverride = data?.growth_assumptions?.[item.code]
                  const rawEff = hasOv ? rawOverride : rawDefault

                  // Display helpers: decimals → human-readable
                  const fmtDisplay = v => (v === '' || v == null) ? '—' : isPct ? (Number(v) * 100).toFixed(2) + '%' : '$' + Math.round(Number(v)).toLocaleString()

                  // Override input: show as % or $, blank = use default
                  const overrideDisplay = () => {
                    if (rawOverride == null || rawOverride === '') return ''
                    return isPct ? (Number(rawOverride) * 100).toFixed(2) : String(rawOverride)
                  }

                  const handleOverrideChange = (e) => {
                    const v = e.target.value.replace(/[%$,\s]/g, '')
                    if (v === '') { setOverride(item.code, '') }
                    else {
                      const num = parseFloat(v)
                      if (!isNaN(num)) setOverride(item.code, isPct ? String(num / 100) : String(num))
                    }
                  }

                  return (
                    <tr key={item.code} style={{ background: hasOv ? '#F8F7FF' : '#fff' }}>
                      <td style={{ ...labelStyle, paddingLeft: 16 }}>{item.label}</td>
                      <td style={{ padding: cellPad, textAlign: 'right', borderBottom: borderC, borderRight: borderC, color: '#666', fontSize: 12 }}>
                        {fmtDisplay(rawDefault)}
                      </td>
                      <td style={{ padding: '2px 4px', borderBottom: borderC, borderRight: borderC, background: '#F8F7FF' }}>
                        <input
                          type="text"
                          value={overrideDisplay()}
                          onChange={handleOverrideChange}
                          onFocus={selectOnFocus}
                          style={{ ...numInput, fontSize: 12 }}
                          placeholder=""
                        />
                      </td>
                      <td style={{ padding: cellPad, textAlign: 'right', borderBottom: borderC, borderRight: borderC, fontWeight: 500, color: hasOv ? '#3C3489' : '#333' }}>{fmtDisplay(rawEff)}</td>
                      <td style={{ padding: cellPad, borderBottom: borderC, textAlign: 'center' }}>
                        {hasOv && <button onClick={() => clearOverride(item.code)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11 }} title="Reset to default">↩</button>}
                      </td>
                    </tr>
                  )
                })
              ]).flat()}
            </tbody>
          </table>
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#888', borderTop: borderC }}>
            Enter percentages as whole numbers (e.g., 3.50 = 3.50%). Dollar amounts are annual per-unit. Leave blank to use the default. Purple highlights indicate proposal-level overrides.
          </div>
        </div>
      )}
    </div>
  )
}