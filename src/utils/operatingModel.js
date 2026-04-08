/**
 * Operating Model Engine
 *
 * Pure function — no Supabase, no React. Takes all inputs, returns annual
 * projections + per-unit stabilized months. Called from ProposalDetail so
 * results can be passed to PropertyDashboard (Investor Returns) and RentRoll
 * (stabilized_month write-back).
 *
 * Rent growth logic per unit, each anniversary of effective_rent_date:
 *   new_rent = min(current_rent × (1 + rent_bump_cap), projected_market_rent_year_N)
 *   Once at/above market, grows at market_rent_growth only.
 *
 * Vacant units: start at uw_rent (= market_rent for vacant), effective date = close date.
 *
 * Unit stabilized_month: first month rent ≥ 90% of projected market rent for that month.
 *
 * Property stabilized_month:
 *   max(last CapEx month_end, month where total_rent ≥ 90% total_projected_market) + 1
 *
 * Annual projections: Year 1 through exitYear + 1 (need exitYear+1 NOI for sale price).
 */

const nv = (v, fb = 0) => { const x = Number(v); return isNaN(x) ? fb : x }

/**
 * @param {Object} params
 * @param {Array}  params.units           - rent roll units from Supabase
 * @param {Object} params.ga              - growth assumptions (effective values, already numbers)
 * @param {Object} params.t12Expenses     - { groupCode: annualTotal } from T-12 computation
 * @param {number} params.totalUnits      - property total units
 * @param {string} params.closeDate       - ISO date string 'YYYY-MM-DD'
 * @param {Array}  params.valueAddCapex   - [{ month_end }] from dashboard
 * @param {number} params.exitYear        - integer (e.g. 10)
 * @returns {Object} { annualProjections, unitStabilizedMonths, propertyStabilizedMonth }
 */
export function runOperatingModel({ units, ga, t12Expenses, totalUnits, closeDate, valueAddCapex, exitYear }) {
  // ── Defaults ──────────────────────────────────────────────────────────────
  const rentBumpCap      = nv(ga.rent_bump_cap,       0.07)   // e.g. 0.07 = 7%
  const mktRentGrowth    = nv(ga.market_rent_growth,  0.0325)
  const vacancyRate      = nv(ga.vacancy_rate,        0.05)
  const concessionsPct   = nv(ga.concessions_pct,     0.01)

  const numProjectionYears = nv(exitYear, 5) + 1  // through exitYear + 1

  // ── Close date ────────────────────────────────────────────────────────────
  // Month 0 = close month; Month 1 = first full month after close
  const close = closeDate ? new Date(closeDate) : new Date()
  const closeYear  = close.getFullYear()
  const closeMonth = close.getMonth() // 0-11

  // Convert a month-offset (1-based from close) to a calendar date
  function monthToDate(offset) {
    const d = new Date(closeYear, closeMonth + offset, 1)
    return d
  }

  // How many months from close until the next anniversary of effectiveDate?
  // Returns the month offset (1-based) of the first rent increase.
  function monthsToFirstAnniversary(effectiveDateStr) {
    if (!effectiveDateStr) return 12
    const eff = new Date(effectiveDateStr)
    // Anniversary = same month/day one year after effective date
    const firstAnniversary = new Date(eff.getFullYear() + 1, eff.getMonth(), 1)
    const closeFirst = new Date(closeYear, closeMonth, 1)
    const diffMonths = (firstAnniversary.getFullYear() - closeFirst.getFullYear()) * 12
      + (firstAnniversary.getMonth() - closeFirst.getMonth())
    // If anniversary already passed relative to close, next one is 12 months later
    if (diffMonths <= 0) return diffMonths + 12
    return diffMonths
  }

  // ── Build per-unit rent schedule (month 0 = close month) ─────────────────
  const MONTHS_TO_MODEL = numProjectionYears * 12 + 12  // a bit extra

  // unit rent schedule: rentByUnit[unitIdx][month] = rent for that month
  const rentByUnit   = []
  const mktByUnit    = []  // projected market rent per unit per month
  const unitStabMonths = []

  units.forEach((unit, idx) => {
    const isVacant     = unit.status === 'Vacant'
    const startRent    = isVacant
      ? nv(unit.market_rent)   // vacant → UW rent = market rent at close
      : nv(unit.actual_rent)
    const baseMarket   = nv(unit.market_rent)
    const effDateStr   = isVacant ? closeDate : (unit.effective_rent_date || null)

    const rents = []
    const mkts  = []

    let currentRent = startRent
    let monthsToNextBump = monthsToFirstAnniversary(effDateStr)

    for (let m = 0; m < MONTHS_TO_MODEL; m++) {
      // Projected market rent for this month (grows monthly at market_rent_growth/12)
      const projMarket = baseMarket * Math.pow(1 + mktRentGrowth, m / 12)
      mkts[m] = projMarket

      // Apply rent bump if it's an anniversary month
      if (m > 0 && m === monthsToNextBump) {
        const cappedRent  = currentRent * (1 + rentBumpCap)
        const marketFloor = projMarket  // can't exceed market
        currentRent = Math.min(cappedRent, marketFloor)
        monthsToNextBump += 12  // next anniversary
      }

      rents[m] = currentRent
    }

    // Per-unit stabilized month: first month where rent ≥ 90% of projected market
    let unitStab = null
    for (let m = 0; m < MONTHS_TO_MODEL; m++) {
      if (rents[m] >= mkts[m] * 0.9) { unitStab = m; break }
    }
    unitStabMonths.push(unitStab)
    rentByUnit.push(rents)
    mktByUnit.push(mkts)
  })

  // ── Property stabilized month ─────────────────────────────────────────────
  // Last CapEx end month
  const lastCapexMonth = (valueAddCapex || [])
    .map(r => nv(r.month_end, 0))
    .reduce((max, v) => Math.max(max, v), 0)

  // Month where aggregate rent ≥ 90% aggregate projected market
  let rentStabMonth = 0
  for (let m = 0; m < MONTHS_TO_MODEL; m++) {
    const totalRent   = rentByUnit.reduce((s, r) => s + (r[m] || 0), 0)
    const totalMarket = mktByUnit.reduce((s,  r) => s + (r[m] || 0), 0)
    if (totalMarket > 0 && totalRent >= totalMarket * 0.9) {
      rentStabMonth = m
      break
    }
  }

  const propertyStabilizedMonth = Math.max(lastCapexMonth, rentStabMonth) + 1

  // ── Annual projections ────────────────────────────────────────────────────
  // For each year Y (1-based), sum rent for months [(Y-1)*12 .. Y*12-1] relative to close
  // Year 1 = months 1-12, Year 2 = months 13-24, etc. (month 0 = close month, partial)

  // Non-rent income from T-12 with growth
  function nonRentIncome(yearIdx) {
    // yearIdx is 0-based (0 = Year 1)
    const y = yearIdx
    const rubsBase  = units.reduce((s, u) => s + nv(u.market_rubs), 0) * 12
    const parking   = nv(t12Expenses._parking,      0) * Math.pow(1 + nv(ga.parking_growth,     0.02), y + 1)
    const storage   = nv(t12Expenses._storage,      0) * Math.pow(1 + nv(ga.storage_growth,     0.02), y + 1)
    const otherInc  = nv(t12Expenses._other_income, 0) * Math.pow(1 + nv(ga.other_income_growth, 0.02), y + 1)
    const rubs      = rubsBase * Math.pow(1 + nv(ga.rubs_growth, 0.02), y)
    return parking + storage + otherInc + rubs
  }

  function expensesForYear(yearIdx, egr) {
    const y = yearIdx
    let exp = 0

    // Property taxes
    exp += nv(t12Expenses.property_taxes, 0)  * Math.pow(1 + nv(ga.property_tax_growth, 0.03), y + 1)
    // Other taxes
    exp += nv(t12Expenses.other_taxes,    0)  * Math.pow(1 + nv(ga.controllable_growth,  0.03), y + 1)
    // Insurance (per unit)
    exp += nv(ga.insurance_per_unit, 0) * totalUnits * Math.pow(1 + nv(ga.insurance_growth, 0.03), y)
    // Utilities (per unit)
    exp += nv(ga.utilities_per_unit, 0) * totalUnits * Math.pow(1 + nv(ga.utilities_growth, 0.03), y)
    // Repairs & Maintenance
    exp += nv(t12Expenses.repairs_maintenance, 0) * Math.pow(1 + nv(ga.rm_growth, 0.03), y + 1)
    // Property management (% of EGR)
    exp += egr > 0 ? egr * nv(ga.property_mgmt_pct, 0.08) : 0
    // Turnover (per unit)
    exp += nv(ga.turnover_per_unit, 0) * totalUnits * Math.pow(1 + nv(ga.turnover_growth, 0.03), y)
    // Capital reserves (per unit)
    exp += nv(ga.cap_reserves_per_unit, 0) * totalUnits * Math.pow(1 + nv(ga.cap_reserves_growth, 0.02), y)
    // Controllable: admin, landscaping, security, contract services, advertising, payroll, misc
    const controllableCodes = ['administrative','landscaping','security','contract_services','advertising','payroll','misc']
    controllableCodes.forEach(code => {
      exp += nv(t12Expenses[code], 0) * Math.pow(1 + nv(ga.controllable_growth, 0.03), y + 1)
    })

    return exp
  }

  const annualProjections = []

  for (let y = 0; y < numProjectionYears; y++) {
    const startMonth = y * 12 + 1   // months are 1-based offsets from close
    const endMonth   = startMonth + 11

    // Gross collected rent for this year
    let grossRent = 0
    for (let m = startMonth; m <= endMonth; m++) {
      if (m < MONTHS_TO_MODEL) {
        grossRent += rentByUnit.reduce((s, r) => s + (r[m] || 0), 0)
      }
    }

    const nonRent      = nonRentIncome(y)
    const grossIncome  = grossRent + nonRent
    const vacancy      = grossRent * vacancyRate
    const concessions  = grossRent * concessionsPct
    const egr          = grossIncome - vacancy - concessions
    const expenses     = expensesForYear(y, egr)
    const noi          = egr - expenses

    annualProjections.push({
      year:        y + 1,
      grossRent,
      nonRent,
      grossIncome,
      vacancy,
      concessions,
      egr,
      expenses,
      noi,
    })
  }

  // ── Stabilized year NOI (12 months starting at propertyStabilizedMonth) ───
  const stabStartMonth = propertyStabilizedMonth
  let stabGrossRent = 0
  for (let m = stabStartMonth; m < stabStartMonth + 12; m++) {
    if (m < MONTHS_TO_MODEL) {
      stabGrossRent += rentByUnit.reduce((s, r) => s + (r[m] || 0), 0)
    }
  }
  // Stabilized year index (0-based) for expense calculation
  const stabYearIdx    = Math.floor(stabStartMonth / 12)
  const stabNonRent    = nonRentIncome(stabYearIdx)
  const stabGross      = stabGrossRent + stabNonRent
  const stabVacancy    = stabGrossRent * vacancyRate
  const stabConc       = stabGrossRent * concessionsPct
  const stabEGR        = stabGross - stabVacancy - stabConc
  const stabExpenses   = expensesForYear(stabYearIdx, stabEGR)
  const stabNOI        = stabEGR - stabExpenses

  const stabilizedYear = {
    grossRent:   stabGrossRent,
    nonRent:     stabNonRent,
    grossIncome: stabGross,
    vacancy:     stabVacancy,
    concessions: stabConc,
    egr:         stabEGR,
    expenses:    stabExpenses,
    noi:         stabNOI,
  }

  return {
    annualProjections,       // array of { year, grossRent, nonRent, grossIncome, vacancy, concessions, egr, expenses, noi }
    unitStabilizedMonths,    // array parallel to units[] — month offset from close
    propertyStabilizedMonth, // single integer
    stabilizedYear,          // 12-month NOI snapshot for Income Statement Stabilized column
  }
}

/**
 * Build the ga (growth assumptions) object from proposal_financials + app_settings defaults.
 * Returns an object with numeric values ready to pass to runOperatingModel.
 */
export function buildGA(proposalFinancials, appSettingsDefaults) {
  const overrides = proposalFinancials?.growth_assumptions || {}
  const defaults  = appSettingsDefaults || {}
  const get = code => {
    const ov = overrides[code]
    if (ov != null && ov !== '') return Number(ov)
    const df = defaults[code]
    if (df != null && df !== '') return Number(df)
    return 0
  }
  // Return all codes used by the engine
  return {
    rent_bump_cap:        get('rent_bump_cap'),
    market_rent_growth:   get('market_rent_growth'),
    vacancy_rate:         get('vacancy_rate'),
    concessions_pct:      get('concessions_pct'),
    rubs_growth:          get('rubs_growth'),
    other_income_growth:  get('other_income_growth'),
    parking_growth:       get('parking_growth'),
    storage_growth:       get('storage_growth'),
    controllable_growth:  get('controllable_growth'),
    rm_growth:            get('rm_growth'),
    property_tax_growth:  get('property_tax_growth'),
    insurance_per_unit:   get('insurance_per_unit'),
    insurance_growth:     get('insurance_growth'),
    property_mgmt_pct:    get('property_mgmt_pct'),
    utilities_per_unit:   get('utilities_per_unit'),
    utilities_growth:     get('utilities_growth'),
    turnover_per_unit:    get('turnover_per_unit'),
    turnover_growth:      get('turnover_growth'),
    cap_reserves_per_unit:get('cap_reserves_per_unit'),
    cap_reserves_growth:  get('cap_reserves_growth'),
  }
}

/**
 * Extract T-12 expense group totals from proposal_financials.t12_monthly.
 * Returns { property_taxes, other_taxes, repairs_maintenance, administrative,
 *           landscaping, security, contract_services, advertising, payroll, misc,
 *           _parking, _storage, _other_income }
 */
export function buildT12Expenses(proposalFinancials) {
  const t12 = proposalFinancials?.t12_monthly || {}
  const months = Object.values(t12)

  const INCOME_GROUPS = {
    _parking:      ['park_parking'],
    _storage:      ['storage_income'],
    _other_income: ['oi_tenant_chargeback','oi_application_fees','oi_insurance_services',
                    'oi_deposit_forfeit','oi_interest','oi_late_charges','oi_nsf_fees',
                    'oi_laundry','oi_pet_rent','oi_misc'],
  }
  const EXPENSE_GROUPS = {
    administrative:      ['admin_licenses','admin_collection','admin_dues','admin_postage',
                          'admin_bank','admin_onboarding','admin_supplies'],
    property_taxes:      ['ptax_property'],
    other_taxes:         ['otax_state_local','otax_other'],
    repairs_maintenance: ['rm_general_maint','rm_general_repair','rm_cleaning','rm_supplies',
                          'rm_painting','rm_hvac','rm_plumbing','rm_appliance','rm_labor','rm_pest','rm_misc'],
    landscaping:         ['land_landscaping'],
    security:            ['sec_security'],
    contract_services:   ['conserv_services'],
    advertising:         ['mark_leasing','mark_advertising','mark_internet'],
    payroll:             ['pay_payroll'],
    misc:                ['misc_expenses'],
  }

  function sumGroup(grpCode, detailCodes) {
    const ds = detailCodes.reduce((s, c) => s + months.reduce((ms, m) => ms + (Number(m?.[c]) || 0), 0), 0)
    if (ds !== 0) return ds
    // group-level fallback
    return months.reduce((s, m) => s + (Number(m?.[grpCode]) || 0), 0)
  }

  const result = {}
  for (const [key, codes] of Object.entries(INCOME_GROUPS))  result[key] = sumGroup(key.replace(/^_/,''), codes)
  for (const [key, codes] of Object.entries(EXPENSE_GROUPS)) result[key] = sumGroup(key, codes)
  return result
}