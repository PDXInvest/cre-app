import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const INCOME_CODES = `Valid income codes (use these exact strings as JSON keys):
- collected_rent: Gross rent, rental income, scheduled rent, gross potential rent
- rubs_electric: Electricity reimbursement / RUBS electric
- rubs_water_sewer: Water/sewer reimbursement
- rubs_gas: Gas reimbursement
- rubs_trash: Trash reimbursement
- rubs_combined: Combined utility recovery / RUBS (use when utilities not broken out)
- park_parking: Parking income
- storage_income: Storage income
- oi_application_fees: Application fees
- oi_insurance_services: Insurance services / renter's insurance income
- oi_late_charges: Late fees / late charges
- oi_laundry: Laundry income
- oi_misc: Miscellaneous income, pet rent, NSF fees, or any other small income items`

const EXPENSE_CODES = `Valid expense codes (use these exact strings as JSON keys):
- admin_licenses: Licenses, permits, fees, administrative costs, office supplies, bank charges, postage
- ptax_property: Property taxes / real estate taxes
- ins_property: Property insurance / hazard insurance / liability insurance
- uti_electric: Electric expense (landlord-paid)
- uti_water_sewer: Water/sewer expense (landlord-paid)
- uti_gas: Gas expense (landlord-paid)
- uti_trash: Trash/recycling expense (landlord-paid)
- uti_combined: Combined utilities (use when not broken out by type)
- pm_mgmt_fees: Property management fees
- pm_lease_up: Lease-up fees / management lease-up costs
- rm_general_maint: General maintenance
- rm_general_repair: General repairs
- rm_cleaning: Cleaning / janitorial
- rm_supplies: Maintenance supplies
- rm_plumbing: Plumbing repairs
- rm_appliance: Appliance repair/replacement
- rm_labor: Maintenance labor / maintenance payroll
- land_landscaping: Landscaping / grounds maintenance
- turn_misc: Turnover costs / make-ready / unit turns
- capres_reserves: Capital reserves / replacement reserves
- mark_advertising: Advertising / marketing / leasing costs
- pay_payroll: Payroll / on-site staff wages (non-maintenance)
- sec_security: Security`

const PROMPTS = {
  rent_roll: `Extract the rent roll data from this PDF document. Return ONLY a JSON object with this exact structure, no other text:

{
  "units": [
    {
      "unit_number": "string - the unit number/identifier",
      "unit_type": "string - must be one of: Studio / 1 Bath, 1 Bed / 1 Bath, 2 Bed / 1 Bath, 2 Bed / 1.5 Bath, 2 Bed / 2 Bath, 3 Bed / 1 Bath, 3 Bed / 1.5 Bath, 3 Bed / 2 Bath, 4 Bed / 1 Bath, 4 Bed / 2 Bath. Infer from bed/bath columns.",
      "unit_sf": null,
      "tenant_name": null,
      "status": "Current or Vacant or Notice",
      "actual_rent": 0,
      "security_deposit": null,
      "effective_rent_date": null,
      "lease_end_date": null,
      "move_in_date": null
    }
  ],
  "unmapped_columns": []
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For dates, convert any format to YYYY-MM-DD
- If a unit has no tenant and $0 rent, status is "Vacant"
- If a unit has a tenant and rent > 0, status is "Current"
- Map bed/bath descriptions ("1BR/1BA", "1x1", "1 Bedroom") to the standardized format above
- Numeric values as plain numbers, no $ signs or commas
- Use null for missing/unknown fields, not empty strings
- Sort units by unit_number naturally`,

  t12_monthly: `Extract the trailing 12-month (T-12) financial data from this PDF. This is a monthly income and expense statement for a multifamily apartment property.

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

Rules:
- Return ONLY valid JSON, no markdown fences
- All dollar amounts as positive numbers (expenses stored as positive)
- Month keys must be YYYY-MM format (e.g., "2024-01")
- Identify the 12-month range from the PDF column headers
- For each PDF line item, find the best matching code from the lists above
- If a line item clearly maps, put the values in "months" and record the mapping in "mapped"
- If confidence is low (uncertain match), still map it but mark confidence as "low"
- If a line item does not match any code, put it in "unmapped"
- Subtotals and totals should NOT be extracted as line items
- Loss to lease, vacancy/credit loss, and concessions are typically negative income adjustments — extract them as positive numbers under codes: loss_to_lease, vacancy_credit_loss, concessions`,

  income_statement: `Extract the annual income statement data from this PDF. This is an annual financial summary for a multifamily apartment property, potentially with multiple years of data.

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

Rules:
- Return ONLY valid JSON, no markdown fences
- All dollar amounts as positive numbers
- Year keys as 4-digit strings (e.g., "2024")
- Extract all years present in the PDF
- For each PDF line item, find the best matching code
- If confidence is low, still map but mark as "low"
- Unmapped items go in the unmapped array
- Do NOT extract subtotals or grand totals as line items`,
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
