import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const INCOME_CODES = `Valid income codes — use these exact strings as JSON keys. Match PDF line items by semantic meaning, not exact label. Common label variations are listed after each code:

- collected_rent: Gross rent, rental income, scheduled rent, gross potential rent, GPR, rent revenue, apartment rent, unit rent, base rent, contract rent
- loss_to_lease: Loss to lease, gain/loss to lease, lease trade-out, rent concessions from market
- vacancy_credit_loss: Vacancy loss, vacancy & credit loss, credit loss, bad debt, vacancy, economic vacancy, physical vacancy
- concessions: Concessions, rent concessions, move-in specials, lease concessions, promotional concessions
- rubs_electric: Electricity reimbursement, RUBS electric, electric recovery, electric billback, tenant electric
- rubs_water_sewer: Water/sewer reimbursement, RUBS water, water recovery, water billback, tenant water, W/S reimb
- rubs_gas: Gas reimbursement, RUBS gas, gas recovery, gas billback, tenant gas
- rubs_trash: Trash reimbursement, RUBS trash, trash recovery, trash billback, tenant trash
- rubs_combined: Combined utility recovery, RUBS, utility reimbursement, utility recovery, utility billback, utility income, tenant utilities, utility charges (use when utility reimbursements are not broken out by type)
- park_parking: Parking income, parking revenue, parking rent, garage income, carport income, covered parking
- storage_income: Storage income, storage revenue, storage rent, locker income
- oi_application_fees: Application fees, app fees, screening fees, credit check fees
- oi_insurance_services: Insurance services, renter's insurance income, tenant insurance, liability insurance revenue
- oi_late_charges: Late fees, late charges, late rent fees, delinquency fees
- oi_laundry: Laundry income, laundry revenue, washer/dryer income, coin laundry, vending/laundry
- oi_misc: Miscellaneous income, other income, pet rent, pet fees, NSF fees, returned check fees, early termination fees, month-to-month premiums, cable/internet revenue, amenity fees, cleaning fees, key/lock fees, damage charges, any other small income items not fitting above categories`

const EXPENSE_CODES = `Valid expense codes — use these exact strings as JSON keys. Match PDF line items by semantic meaning, not exact label. Use context to disambiguate — e.g., "Insurance" under expenses is property insurance (ins_property), not tenant insurance income.

- admin_licenses: Administrative costs, licenses, permits, fees, office supplies, bank charges, postage, printing, copying, dues, subscriptions, professional fees, legal, accounting, collection costs, bad debt write-off, admin, G&A, general & administrative, office expense
- ptax_property: Property taxes, real estate taxes, RE taxes, ad valorem taxes, tax assessment, property tax
- ins_property: Property insurance, hazard insurance, liability insurance, casualty insurance, fire insurance, building insurance, umbrella insurance, insurance expense, general insurance (when under expenses)
- uti_electric: Electric expense, electricity, power, electric utility (landlord-paid portion)
- uti_water_sewer: Water/sewer expense, water, sewer, W/S, water & sewer (landlord-paid portion)
- uti_gas: Gas expense, natural gas, gas utility (landlord-paid portion)
- uti_trash: Trash expense, trash/recycling, refuse, waste removal, garbage, sanitation (landlord-paid portion)
- uti_combined: Combined utilities, total utilities, utility expense (use when utilities are not broken out by type — electric, gas, water, trash combined into one line)
- pm_mgmt_fees: Management fees, property management, PM fee, mgmt fee, management fee, manager fees, management company fee, off-site management
- pm_lease_up: Lease-up fees, leasing commissions, lease-up costs, leasing fees, lease renewal fee, renewal fees, lease renewal
- pm_misc_fees: Software fees, tech fees, Appfolio, property management software, per-unit fees, technology fee, management software, PM software, Buildium, Yardi, RentManager
- rm_general_maint: General maintenance, maintenance, building maintenance, property maintenance, routine maintenance, preventive maintenance, maintenance - other, misc maintenance
- rm_general_repair: General repairs, repairs, repairs & maintenance, R&M, repairs - other, building repairs, misc repairs, contract repairs
- rm_cleaning: Cleaning, janitorial, housekeeping, common area cleaning, unit cleaning
- rm_supplies: Maintenance supplies, supplies, building supplies, operating supplies, tools
- rm_plumbing: Plumbing repairs, plumbing, plumbing maintenance
- rm_appliance: Appliance repair, appliance replacement, appliances, equipment repair
- rm_labor: Maintenance labor, maintenance payroll, maintenance salary, maintenance staff, maintenance wages, on-site maintenance personnel
- land_landscaping: Landscaping, grounds maintenance, lawn care, grounds, snow removal, exterior maintenance, grounds keeping
- turn_misc: Turnover costs, make-ready, unit turns, apartment turnover, refurbishment, unit prep, turn costs, carpet/flooring (when related to unit turns)
- capres_reserves: Capital reserves, replacement reserves, reserve for replacement, capital expenditure reserves, CapEx reserves, reserves
- mark_advertising: Advertising, marketing, leasing costs, internet listing, promotional, signage, marketing & advertising, online advertising, ILS fees
- pay_payroll: Payroll, on-site staff wages, salary, employee benefits, workers comp, on-site personnel, office staff, manager salary (non-maintenance staff)
- conserv_services: Contract services, professional services, outside services, vendor services, service contracts, fire alarm, fire extinguisher, fire safety, elevator service, elevator maintenance, HVAC contract, pest control contract, monitoring services
- mark_leasing: Leasing commissions, leasing fees, broker fees, referral fees
- mark_internet: Internet advertising, ILS, online listings, internet listing services, website
- sec_security: Security, security services, patrol, alarm, camera, access control, gate, security system
- misc_expenses: Miscellaneous expenses, misc expense, other expenses, sundry, other operating expenses, contingency, unclassified expenses`

const PROMPTS = {
  rent_roll: `Extract the rent roll data from this PDF document. Use semantic understanding to identify fields — column labels vary widely across management companies, brokers, and accounting software. Prioritize meaning over exact label matching.

Return ONLY a JSON object with this exact structure, no other text:

{
  "units": [
    {
      "unit_number": "string",
      "unit_type": "string - one of: Studio / 1 Bath, 1 Bed / 1 Bath, 2 Bed / 1 Bath, 2 Bed / 1.5 Bath, 2 Bed / 2 Bath, 2 Bed / 2.5 Bath, 3 Bed / 1 Bath, 3 Bed / 1.5 Bath, 3 Bed / 2 Bath, 3 Bed / 2.5 Bath, 4 Bed / 1 Bath, 4 Bed / 2 Bath",
      "unit_sf": null,
      "tenant_name": null,
      "status": "Current or Vacant or Notice",
      "actual_rent": 0,
      "market_rent": null,
      "security_deposit": null,
      "effective_rent_date": null,
      "lease_end_date": null,
      "move_in_date": null
    }
  ],
  "unmapped_columns": []
}

Field identification guide — use context and judgment to identify these fields regardless of how they are labeled:
- unit_number: "Unit", "Unit #", "Unit No", "Apt", "Apt #", "Space", a street address used as unit ID, or any column that uniquely identifies each dwelling
- unit_type: "BD/BA", "Bed/Bath", "Type", "Unit Type", "Beds/Baths", "Floorplan", "Plan", or separate "Beds"/"Baths" columns. Map any format (1BR/1BA, 1x1, 1 Bedroom 1 Bathroom, A1, B2, etc.) to the standardized format above. If a floorplan code like "A1" is used, infer bed/bath from context or unit size if possible.
- unit_sf: "SqFt", "SF", "Sq Ft", "Square Feet", "Size", "Area", or any column with values typically 300-2000
- tenant_name: "Tenant", "Resident", "Occupant", "Name", "Lessee", or any column containing person names
- status: "Status", "Occ", "Occupancy", "Lease Status". Infer from context — if a row has a tenant name and rent, it's "Current"; if marked vacant/available/empty, it's "Vacant"; if marked notice/NTV/moving, it's "Notice"
- actual_rent: "Rent", "Actual Rent", "Current Rent", "Contract Rent", "Lease Rent", "Monthly Rent", "Charge", or any prominent dollar column in a lease context. This is what the tenant currently pays.
- market_rent: "Market Rent", "Market", "Market Rate", "Scheduled Rent", "Asking Rent", "Pro Forma Rent", or a second rent column that represents what the unit could rent for
- security_deposit: "Deposit", "Security Deposit", "Sec Dep", "Security", or any deposit-related dollar column
- effective_rent_date: "Lease Start", "Lease From", "Start Date", "Commencement", "From", "Lease Begin", "Effective Date", or the earlier of two date columns in a lease context
- lease_end_date: "Lease End", "Lease To", "End Date", "Expiration", "Expires", "To", "Lease Expiry", or the later of two date columns in a lease context
- move_in_date: "Move-in", "Move In", "Moved In", "Occupancy Date", "Move-In Date", "Original Move In", or a date column distinct from lease dates that represents when the tenant first moved in

Semantic reasoning rules:
- If a column contains date values in a lease context but has an ambiguous label, infer whether it's lease start, lease end, or move-in based on the date patterns (move-in dates are often older; lease end dates are in the future)
- If you see two date columns and one has dates before the other, the earlier one is likely lease start and the later one is lease end
- If a number looks like monthly rent (typically $500-$5000) in a rent roll context, treat it as rent even if the column header is unclear
- If separate "Beds" and "Baths" columns exist, combine them into the standardized unit_type format
- If the PDF uses a property address as the unit identifier (common for small properties), use it as unit_number

Additional rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For dates, convert any format (MM/DD/YYYY, M/D/YY, Jan 1 2024, 2024-01-01, etc.) to YYYY-MM-DD
- Numeric values as plain numbers, no $ signs or commas
- Use null for missing/unknown fields, not empty strings
- Sort units by unit_number naturally
- List any PDF columns you could not map in unmapped_columns`,

  t12_monthly: `Extract the trailing 12-month (T-12) financial data from this PDF. This is a monthly income and expense statement for a multifamily apartment property. Use semantic understanding to match line items — labels vary widely across management companies and accounting software. Prioritize meaning over exact label matching.

Return ONLY a JSON object with this exact structure, no other text:

{
  "start_month": "YYYY-MM",
  "end_month": "YYYY-MM",
  "months": {
    "YYYY-MM": {
      "code": dollar_amount
    }
  },
  "mapped": [
    { "pdf_label": "original line item name", "code": "matched_code", "confidence": "high or low" }
  ],
  "unmapped": [
    { "pdf_label": "original line item name", "values": { "YYYY-MM": dollar_amount } }
  ]
}

${INCOME_CODES}

${EXPENSE_CODES}

Semantic matching rules:
- Use the context of where a line item appears (under "Income" vs "Expenses" section headers) to disambiguate — e.g., "Insurance" under income is oi_insurance_services, under expenses is ins_property
- If a line item combines multiple concepts (e.g., "Repairs & Maintenance"), map to the most specific code (rm_general_repair) or split if sub-items are visible
- If a utility line item exists but doesn't specify type, use uti_combined; if utility reimbursement doesn't specify type, use rubs_combined
- "Management" or "Management Fee" under expenses is pm_mgmt_fees, not administrative
- Items like "Contract Services", "Professional Services", or "Other Services" that don't fit a specific category → admin_licenses
- "Capital Improvements", "CapEx", or "Capital Expenditures" (one-time) are different from "Capital Reserves" (recurring budgeted) — only map recurring reserves to capres_reserves; put one-time capital items in unmapped
- Month column headers may appear as "Jan", "January", "1/24", "Jan-24", "01/2024", etc. — normalize all to YYYY-MM format
- All dollar amounts as positive numbers (expenses stored as positive)
- Subtotals, totals, and calculated rows (NOI, EGR, Net Income, etc.) should NOT be extracted as line items
- Loss to lease, vacancy/credit loss, and concessions are typically shown as negative or parenthesized — extract them as positive numbers
- If confidence is low (uncertain match), still map it but mark confidence as "low"
- If a line item truly does not match any code, put it in "unmapped"
- CRITICAL: Every line item with dollar values in the PDF must appear either in "months" (mapped) or "unmapped". Never silently drop a line item. If you are unsure how to classify something, put it in "unmapped" rather than omitting it.
- Return ONLY valid JSON, no markdown fences`,

  income_statement: `Extract the annual income statement data from this PDF. This is an annual financial summary for a multifamily apartment property, potentially with multiple years of data. Use semantic understanding to match line items — labels vary widely across management companies and accounting software. Prioritize meaning over exact label matching.

Return ONLY a JSON object with this exact structure, no other text:

{
  "years": {
    "YYYY": {
      "code": annual_dollar_amount
    }
  },
  "mapped": [
    { "pdf_label": "original line item name", "code": "matched_code", "confidence": "high or low" }
  ],
  "unmapped": [
    { "pdf_label": "original line item name", "values": { "YYYY": dollar_amount } }
  ]
}

${INCOME_CODES}

${EXPENSE_CODES}

Semantic matching rules:
- Use the context of where a line item appears (under "Income" vs "Expenses" section headers) to disambiguate
- If a line item combines multiple concepts, map to the most specific code or split if sub-items are visible
- If a utility line item doesn't specify type, use uti_combined; if utility reimbursement doesn't specify type, use rubs_combined
- "Management" or "Management Fee" under expenses is pm_mgmt_fees
- Items like "Contract Services" or "Professional Services" that don't fit a specific category → admin_licenses
- Only map recurring reserves to capres_reserves; put one-time capital items in unmapped
- Year columns may appear as "2024", "FY 2024", "YTD 2024", "Actual 2024", etc. — normalize to 4-digit year strings
- All dollar amounts as positive numbers (expenses stored as positive)
- Subtotals, totals, and calculated rows (NOI, EGR, Net Income, etc.) should NOT be extracted
- Loss to lease, vacancy/credit loss, and concessions — extract as positive numbers
- If confidence is low, still map but mark as "low"
- If a line item truly does not match any code, put it in "unmapped"
- CRITICAL: Every line item with dollar values in the PDF must appear either in "years" (mapped) or "unmapped". Never silently drop a line item. If unsure, put it in "unmapped".
- Return ONLY valid JSON, no markdown fences`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { type, pdfBase64 } = req.body

  if (!type || !PROMPTS[type]) {
    return res.status(400).json({ success: false, error: 'Invalid extraction type' })
  }
  if (!pdfBase64) {
    return res.status(400).json({ success: false, error: 'No PDF data provided' })
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: PROMPTS[type] },
        ],
      }],
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(422).json({ success: false, error: 'Could not parse structured data from PDF' })
    }
    const data = JSON.parse(jsonMatch[0])
    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('PDF extraction error:', err)
    return res.status(500).json({ success: false, error: err.message || 'Extraction failed' })
  }
}
