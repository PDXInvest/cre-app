export const REVENUE_ITEMS = [
  { code: 'market_rent', label: 'Market Rent' },
  { code: 'loss_to_lease', label: 'Loss-to-Lease' },
  { code: 'vacancy_credit_loss', label: 'Actual Vacancy & Credit Loss' },
  { code: 'concessions', label: 'Concessions' },
  { code: 'collected_rent', label: 'Collected Rent' },
]

export const OTHER_INCOME_GROUPS = [
  { group: 'RUBS', items: [
    { code: 'rubs_electric', label: 'Electricity Reimb' },
    { code: 'rubs_water_sewer', label: 'Water/Sewer Reimbursement' },
    { code: 'rubs_gas', label: 'Gas Reimbursement' },
    { code: 'rubs_trash', label: 'Trash Reimbursement' },
    { code: 'rubs_combined', label: 'Utility Recovery (RUBS) - Combined' },
  ]},
  { group: 'Parking', items: [
    { code: 'park_parking', label: 'Parking/Garage' },
  ]},
  { group: 'Storage', items: [
    { code: 'storage_income', label: 'Storage Income' },
  ]},
  { group: 'Other Income', items: [
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
  ]},
]

export const EXPENSE_GROUPS = [
  { group: 'Administrative', items: [
    { code: 'admin_licenses', label: 'Licenses/Permits/Fees' },
    { code: 'admin_collection', label: 'Collection Expense' },
    { code: 'admin_dues', label: 'Dues & Subscriptions' },
    { code: 'admin_postage', label: 'Postage' },
    { code: 'admin_bank', label: 'Bank Charges' },
    { code: 'admin_onboarding', label: 'Onboarding' },
    { code: 'admin_supplies', label: 'Office Supplies' },
  ]},
  { group: 'Property Taxes', items: [
    { code: 'ptax_property', label: 'Property Tax' },
  ]},
  { group: 'Other Taxes / Fees', items: [
    { code: 'otax_state_local', label: 'State/Local Taxes' },
    { code: 'otax_other', label: 'Taxes Other' },
  ]},
  { group: 'Property Insurance', items: [
    { code: 'ins_property', label: 'Property Insurance' },
  ]},
  { group: 'Utilities', items: [
    { code: 'uti_electric', label: 'Electric' },
    { code: 'uti_electric_vacant', label: 'Electric-Vacant' },
    { code: 'uti_water_sewer', label: 'Water/Sewage' },
    { code: 'uti_gas', label: 'Gas' },
    { code: 'uti_trash', label: 'Trash/Recycling' },
    { code: 'uti_combined', label: 'Utilities (Combined)' },
  ]},
  { group: 'Property Management', items: [
    { code: 'pm_mgmt_fees', label: 'Management Fees' },
    { code: 'pm_lease_up', label: 'Management Lease Up' },
    { code: 'pm_misc_fees', label: 'Misc Fees / Software' },
  ]},
  { group: 'Repairs & Maintenance', items: [
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
  ]},
  { group: 'Landscaping', items: [
    { code: 'land_landscaping', label: 'Landscaping' },
  ]},
  { group: 'Turnover', items: [
    { code: 'turn_misc', label: 'Misc Turnover' },
  ]},
  { group: 'Capital Reserves', items: [
    { code: 'capres_reserves', label: 'Capital Reserves' },
  ]},
  { group: 'Security', items: [
    { code: 'sec_security', label: 'Security' },
  ]},
  { group: 'Contract Services', items: [
    { code: 'conserv_services', label: 'Contract Services' },
  ]},
  { group: 'Advertising & Marketing', items: [
    { code: 'mark_leasing', label: 'Leasing Commissions' },
    { code: 'mark_advertising', label: 'Advertising' },
    { code: 'mark_internet', label: 'Internet Advertising' },
  ]},
  { group: 'Payroll', items: [
    { code: 'pay_payroll', label: 'Payroll' },
  ]},
  { group: 'Misc', items: [
    { code: 'misc_expenses', label: 'Misc Expenses' },
  ]},
]

export const ALL_INCOME_ITEMS = [
  ...REVENUE_ITEMS,
  ...OTHER_INCOME_GROUPS.flatMap(g => g.items),
]

export const ALL_EXPENSE_ITEMS = EXPENSE_GROUPS.flatMap(g => g.items)

export const ALL_CATEGORIES = [...ALL_INCOME_ITEMS, ...ALL_EXPENSE_ITEMS]

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function extractPdf(file, type) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('PDF is too large (max 10 MB). Try a smaller file.')
  }
  const pdfBase64 = await fileToBase64(file)
  const res = await fetch('/api/extract-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, pdfBase64 }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Extraction failed (${res.status})`)
  }
  const { success, data, error } = await res.json()
  if (!success) throw new Error(error || 'Extraction failed')
  return data
}

const UNIT_TYPES = [
  'Studio / 1 Bath', '1 Bed / 1 Bath',
  '2 Bed / 1 Bath', '2 Bed / 1.5 Bath', '2 Bed / 2 Bath', '2 Bed / 2.5 Bath',
  '3 Bed / 1 Bath', '3 Bed / 1.5 Bath', '3 Bed / 2 Bath', '3 Bed / 2.5 Bath',
  '4 Bed / 1 Bath', '4 Bed / 2 Bath',
]

export function normalizeRentRollUnit(u, proposalId, sortOrder) {
  return {
    proposal_id: proposalId,
    unit_number: u.unit_number || '',
    unit_type: UNIT_TYPES.includes(u.unit_type) ? u.unit_type : '2 Bed / 1 Bath',
    unit_sf: u.unit_sf || null,
    tenant_name: u.tenant_name || '',
    status: ['Current', 'Vacant', 'Notice', 'Down'].includes(u.status) ? u.status : 'Vacant',
    actual_rent: Number(u.actual_rent) || 0,
    current_rubs: 0,
    recurring_charges: 0,
    effective_rent_date: u.effective_rent_date || null,
    move_in_date: u.move_in_date || null,
    lease_end_date: u.lease_end_date || null,
    lease_type: 'Fixed Term',
    security_deposit: u.security_deposit || 0,
    pre_paid_rent: 0,
    market_rent: Number(u.market_rent || u.actual_rent) || 0,
    market_rubs: 0,
    underwritten_rent: 0,
    underwritten_rubs: 0,
    stabilized_month: 36,
    notes: '',
    sort_order: sortOrder,
  }
}

const MERGE_FIELDS = [
  'unit_type', 'unit_sf', 'tenant_name', 'status', 'actual_rent', 'market_rent',
  'security_deposit', 'effective_rent_date', 'move_in_date', 'lease_end_date',
]

function isBlank(v) {
  return v === null || v === undefined || v === '' || v === 0
}

export function mergeRentRollUnits(existingUnits, importedUnits, proposalId) {
  const existingByNum = new Map()
  existingUnits.forEach(u => {
    if (u.unit_number) existingByNum.set(String(u.unit_number), u)
  })

  const merged = existingUnits.map(u => ({ ...u }))
  const matched = new Set()

  for (const imp of importedUnits) {
    const key = String(imp.unit_number || '')
    const existing = key ? existingByNum.get(key) : null
    if (existing) {
      matched.add(key)
      const idx = merged.findIndex(u => String(u.unit_number) === key)
      if (idx === -1) continue
      for (const field of MERGE_FIELDS) {
        if (isBlank(merged[idx][field]) && !isBlank(imp[field])) {
          merged[idx][field] = imp[field]
        }
      }
    } else {
      merged.push(normalizeRentRollUnit(imp, proposalId, merged.length))
    }
  }

  merged.forEach((u, i) => { u.sort_order = i })
  return { units: merged, matchedCount: matched.size, appendedCount: importedUnits.length - matched.size }
}
