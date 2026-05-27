export const INCOME_CATEGORIES = [
  { code: 'collected_rent', label: 'Collected Rent' },
  { code: 'loss_to_lease', label: 'Loss to Lease' },
  { code: 'vacancy_credit_loss', label: 'Vacancy & Credit Loss' },
  { code: 'concessions', label: 'Concessions' },
  { code: 'rubs_electric', label: 'Electricity Reimb' },
  { code: 'rubs_water_sewer', label: 'Water/Sewer Reimb' },
  { code: 'rubs_gas', label: 'Gas Reimb' },
  { code: 'rubs_trash', label: 'Trash Reimb' },
  { code: 'rubs_combined', label: 'Combined RUBS' },
  { code: 'park_parking', label: 'Parking Income' },
  { code: 'storage_income', label: 'Storage Income' },
  { code: 'oi_application_fees', label: 'Application Fees' },
  { code: 'oi_insurance_services', label: 'Insurance Services' },
  { code: 'oi_late_charges', label: 'Late Charges' },
  { code: 'oi_laundry', label: 'Laundry' },
  { code: 'oi_misc', label: 'Misc Income' },
]

export const EXPENSE_CATEGORIES = [
  { code: 'admin_licenses', label: 'Admin / Licenses / Fees' },
  { code: 'ptax_property', label: 'Property Tax' },
  { code: 'ins_property', label: 'Property Insurance' },
  { code: 'uti_electric', label: 'Electric' },
  { code: 'uti_water_sewer', label: 'Water/Sewage' },
  { code: 'uti_gas', label: 'Gas' },
  { code: 'uti_trash', label: 'Trash/Recycling' },
  { code: 'uti_combined', label: 'Combined Utilities' },
  { code: 'pm_mgmt_fees', label: 'Management Fees' },
  { code: 'pm_lease_up', label: 'Lease-Up Fees' },
  { code: 'rm_general_maint', label: 'General Maintenance' },
  { code: 'rm_general_repair', label: 'General Repair' },
  { code: 'rm_cleaning', label: 'Cleaning' },
  { code: 'rm_supplies', label: 'Supplies' },
  { code: 'rm_plumbing', label: 'Plumbing Repair' },
  { code: 'rm_appliance', label: 'Appliance Repair' },
  { code: 'rm_labor', label: 'Labor Expense' },
  { code: 'land_landscaping', label: 'Landscaping' },
  { code: 'turn_misc', label: 'Turnover / Make-Ready' },
  { code: 'capres_reserves', label: 'Capital Reserves' },
  { code: 'mark_advertising', label: 'Advertising' },
  { code: 'pay_payroll', label: 'Payroll' },
  { code: 'sec_security', label: 'Security' },
]

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

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
