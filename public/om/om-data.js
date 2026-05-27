/**
 * OM Data Layer — fetches proposal data from Supabase and populates the OM page.
 * Loaded by /om/index.html when ?proposal=<id> is present.
 */
(async function () {
  const SUPABASE_URL = 'https://azqoiryelockjtmdvozk.supabase.co'
  const SUPABASE_KEY = 'sb_publishable_HqGEKnApICX4YpNXcNmQuQ_G7--sP1y'

  const params = new URLSearchParams(location.search)
  const proposalId = params.get('proposal')
  if (!proposalId) return

  if (typeof supabase === 'undefined') { console.warn('OM: Supabase SDK not loaded'); return }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── Fetch all data in parallel ────────────────────────────────────────
  const [propRes, unitsRes, finRes, dashRes] = await Promise.all([
    sb.from('proposals').select('*, properties(*)').eq('id', proposalId).single(),
    sb.from('rent_roll_units').select('*').eq('proposal_id', proposalId).order('sort_order', { ascending: true }),
    sb.from('proposal_financials').select('*').eq('proposal_id', proposalId).maybeSingle(),
    sb.from('proposal_dashboard').select('data').eq('proposal_id', proposalId).maybeSingle(),
  ])

  const proposal = propRes.data
  if (!proposal) { console.warn('OM: proposal not found'); return }
  const pr = proposal.properties || {}
  const units = unitsRes.data || []
  const fin = finRes.data || {}
  const dash = dashRes.data?.data || {}
  const discovery = proposal.discovery_notes || {}

  // ── Fetch comps (sub_market, sold, last 12 months) ────────────────────
  let allComps = []
  if (pr.sub_market) {
    let buf = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data } = await sb.from('comps').select('*')
        .eq('status', 'Sold').eq('sub_market', pr.sub_market)
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      buf = buf.concat(data || [])
      if (!data || data.length < pageSize) done = true; else from += pageSize
    }
    allComps = buf
  }

  // ── Core values ───────────────────────────────────────────────────────
  const askPrice = Number(proposal.asking_price) || 0
  const totalUnits = units.length || Number(pr.total_units) || 1
  const buildingSF = Number(pr.building_sf) || 1
  const pricePerUnit = askPrice ? Math.round(askPrice / totalUnits) : 0
  const pricePerSF = askPrice ? Math.round(askPrice / buildingSF) : 0

  // ── Valuation Scenario — use the income source selected in the dashboard ──
  // This mirrors PropertyDashboard.jsx logic exactly.
  const INCOME_GROUPS = {
    collected_rent: ['collected_rent'],
    rubs: ['rubs_electric', 'rubs_water_sewer', 'rubs_gas', 'rubs_trash', 'rubs_combined'],
    parking: ['park_parking'],
    storage: ['storage_income'],
    other_income: ['oi_tenant_chargeback', 'oi_application_fees', 'oi_insurance_services', 'oi_deposit_forfeit', 'oi_interest', 'oi_late_charges', 'oi_nsf_fees', 'oi_laundry', 'oi_pet_rent', 'oi_misc'],
  }
  const EXPENSE_GROUPS = {
    administrative: ['admin_licenses', 'admin_collection', 'admin_dues', 'admin_postage', 'admin_bank', 'admin_onboarding', 'admin_supplies'],
    property_taxes: ['ptax_property'],
    other_taxes: ['otax_state_local', 'otax_other'],
    insurance: ['ins_property'],
    utilities: ['uti_electric', 'uti_electric_vacant', 'uti_water_sewer', 'uti_gas', 'uti_trash', 'uti_combined'],
    property_mgmt: ['pm_mgmt_fees', 'pm_lease_up', 'pm_misc_fees'],
    repairs_maintenance: ['rm_general_maint', 'rm_general_repair', 'rm_cleaning', 'rm_supplies', 'rm_painting', 'rm_hvac', 'rm_plumbing', 'rm_appliance', 'rm_labor', 'rm_pest', 'rm_misc'],
    landscaping: ['land_landscaping'],
    turnover: ['turn_misc'],
    capital_reserves: ['capres_reserves'],
    security: ['sec_security'],
    contract_services: ['conserv_services'],
    advertising: ['mark_leasing', 'mark_advertising', 'mark_internet'],
    payroll: ['pay_payroll'],
    misc: ['misc_expenses'],
  }

  const t12 = fin.t12_monthly || {}
  const t12Months = Object.values(t12)
  function t12Sum(codes) {
    return t12Months.reduce((s, m) => s + codes.reduce((cs, c) => cs + (Number(m?.[c]) || 0), 0), 0)
  }
  const t12Rent = t12Sum(INCOME_GROUPS.collected_rent)
  const t12GOI = Object.values(INCOME_GROUPS).reduce((s, codes) => s + t12Sum(codes), 0)
  const t12Taxes = t12Sum(EXPENSE_GROUPS.property_taxes)
  const t12Insurance = t12Sum(EXPENSE_GROUPS.insurance)
  const t12Utilities = t12Sum(EXPENSE_GROUPS.utilities)
  const t12Mgmt = t12Sum(EXPENSE_GROUPS.property_mgmt)
  const t12Repairs = t12Sum(EXPENSE_GROUPS.repairs_maintenance)
  const t12OtherExp = t12Sum(EXPENSE_GROUPS.administrative) + t12Sum(EXPENSE_GROUPS.other_taxes) + t12Sum(EXPENSE_GROUPS.landscaping) + t12Sum(EXPENSE_GROUPS.turnover) + t12Sum(EXPENSE_GROUPS.capital_reserves) + t12Sum(EXPENSE_GROUPS.security) + t12Sum(EXPENSE_GROUPS.contract_services) + t12Sum(EXPENSE_GROUPS.advertising) + t12Sum(EXPENSE_GROUPS.payroll) + t12Sum(EXPENSE_GROUPS.misc)
  const t12TotalExp = t12Taxes + t12Insurance + t12Utilities + t12Mgmt + t12Repairs + t12OtherExp
  const t12NOI = t12GOI - t12TotalExp

  // Stated income from dashboard
  const statedGross = Number(dash.stated_income) || 0
  const statedExp = Number(dash.stated_expenses) || 0
  const statedNOI = statedGross - statedExp

  // Pro forma from rent roll
  const pfRent = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0) * 12
  const pfNOI = pfRent > 0 ? pfRent - t12TotalExp : 0

  // Pick income source matching dashboard selection
  const incSrc = dash.income_source || (statedNOI > 0 ? 'Stated' : t12NOI > 0 ? 'T-12' : 'Stated')
  const srcMap = {
    'Stated': { goi: statedGross, exp: statedExp, noi: statedNOI },
    'T-12': { goi: t12GOI, exp: t12TotalExp, noi: t12NOI },
    'Scheduled': { goi: t12GOI, exp: t12TotalExp, noi: t12NOI },
    'Stabilized': { goi: pfRent, exp: t12TotalExp, noi: pfNOI },
    'Market': { goi: pfRent, exp: t12TotalExp, noi: pfNOI },
  }
  const src = srcMap[incSrc] || srcMap['Stated']
  const srcNOI = src.noi, srcGOI = src.goi, srcExp = src.exp

  const currentCap = askPrice && srcNOI ? srcNOI / askPrice : 0
  const pfCap = askPrice && pfNOI ? pfNOI / askPrice : 0
  const grm = askPrice && srcGOI ? askPrice / srcGOI : 0

  // ── Market stats from comps ───────────────────────────────────────────
  const now = new Date()
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  function parseDate(s) { return s ? new Date(s) : null }
  function median(arr) {
    const c = arr.filter(v => v != null && isFinite(v)).sort((a, b) => a - b)
    if (!c.length) return null
    const m = Math.floor(c.length / 2)
    return c.length % 2 ? c[m] : (c[m - 1] + c[m]) / 2
  }

  const recentComps = allComps.filter(c => { const d = parseDate(c.sale_date); return d && d >= twelveMonthsAgo })
  const last6 = recentComps.filter(c => parseDate(c.sale_date) >= sixMonthsAgo)
  const prior6 = recentComps.filter(c => { const d = parseDate(c.sale_date); return d >= twelveMonthsAgo && d < sixMonthsAgo })

  const medianCap = median(recentComps.filter(c => !c.x_noi && c.adv_noi > 0 && c.sale_price).map(c => c.adv_noi / c.sale_price))
  const medianPPU = median(recentComps.filter(c => c.sale_price && c.num_units).map(c => c.sale_price / c.num_units))
  const medianDOM = median(recentComps.map(c => { if (!c.listing_date || !c.sale_date) return null; return Math.round((new Date(c.sale_date) - new Date(c.listing_date)) / 86400000) }))
  const salesVolume6 = last6.reduce((s, c) => s + (Number(c.sale_price) || 0), 0)
  const salesCount = recentComps.length

  // ── Pricing band from dashboard (market_pricing) ──────────────────────
  const mp = dash.market_pricing || {}

  // ── Format helpers ────────────────────────────────────────────────────
  const fC = v => v ? '$' + Math.round(v).toLocaleString() : '—'
  const fP = v => v ? (v * 100).toFixed(2) + '%' : '—'
  const fN = v => v ? v.toFixed(2) : '—'
  const fK = v => v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : fC(v)
  const fM = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : fC(v)

  const fullAddr = [pr.street, pr.city, pr.state, pr.zip].filter(Boolean).join(', ')
  const shortAddr = pr.street || ''
  const cityState = [pr.city, pr.state, pr.zip].filter(Boolean).join(', ')

  // ── Build flat data map ───────────────────────────────────────────────
  const data = {
    property_name: pr.property_name || pr.street || 'Property',
    address: shortAddr,
    full_address: fullAddr,
    city_state: cityState,
    neighborhood: pr.neighborhood || pr.sub_market || '',
    sub_market: pr.sub_market || '',
    asking_price: fC(askPrice),
    total_units: String(totalUnits),
    building_sf: buildingSF > 1 ? '±' + buildingSF.toLocaleString() + ' SF' : '—',
    building_sf_num: buildingSF > 1 ? buildingSF.toLocaleString() : '—',
    year_built: pr.year_built ? String(pr.year_built) : '—',
    lot_size: pr.land_area_acres ? pr.land_area_acres + ' AC' : '—',
    tax_id: pr.tax_id || '—',
    // Fix #3: show '—' when walk/bike scores are null, not hardcoded placeholders
    walk_score: pr.walk_score != null ? String(pr.walk_score) : '—',
    bike_score: pr.bike_score != null ? String(pr.bike_score) : '—',
    price_per_unit: fC(pricePerUnit),
    price_per_sf: fC(pricePerSF),
    grm: fN(grm),
    // Fix #2: cap rates from valuation scenario (selected income source)
    current_cap: fP(currentCap),
    pro_forma_cap: fP(pfCap),
    cap_display: fP(currentCap) + ' / ' + fP(pfCap) + ' PF',
    // Fix #6: financials from selected income source
    t12_goi: fC(srcGOI),
    t12_noi: fC(srcNOI),
    t12_taxes: fC(t12Taxes),
    t12_insurance: fC(t12Insurance),
    t12_utilities: fC(t12Utilities),
    t12_mgmt: fC(t12Mgmt),
    t12_repairs: fC(t12Repairs),
    t12_other_exp: fC(t12OtherExp),
    t12_total_exp: fC(t12TotalExp),
    pf_goi: fC(pfRent),
    pf_noi: fC(pfNOI),
    goi_per_unit: fC(srcGOI / totalUnits),
    noi_per_unit: fC(srcNOI / totalUnits),
    pf_goi_per_unit: fC(pfRent / totalUnits),
    pf_noi_per_unit: fC(pfNOI / totalUnits),
    // Fix #7: market stats from live comps, '—' when no data
    median_cap: medianCap != null ? fP(medianCap) : '—',
    median_ppu: medianPPU != null ? fK(medianPPU) : '—',
    sales_count: salesCount > 0 ? String(salesCount) : '—',
    median_dom: medianDOM != null ? String(Math.round(medianDOM)) : '—',
    sales_volume_6mo: salesVolume6 > 0 ? fM(salesVolume6) : '—',
    // Fix #9: pricing from dashboard market_pricing, not proposal columns
    conservative_price: fC(mp.investor_floor),
    market_price_val: fC(mp.band_low),
    optimistic_price: fC(mp.suggested_price),
    home_run_price: fC(mp.aggressive_price),
    conservative_cap_val: mp.investor_floor && srcNOI ? fP(srcNOI / mp.investor_floor) : '—',
    market_cap_val: mp.band_low && srcNOI ? fP(srcNOI / mp.band_low) : '—',
    optimistic_cap_val: mp.suggested_price && srcNOI ? fP(srcNOI / mp.suggested_price) : '—',
    recommended_price: fC(mp.suggested_price),
    target_close: proposal.target_close || '—',
    strategy: proposal.strategy || '',
    // Discovery
    concern_1_title: discovery.concern_1_title || '',
    concern_1_answer: discovery.concern_1_answer || '',
    concern_2_title: discovery.concern_2_title || '',
    concern_2_answer: discovery.concern_2_answer || '',
    concern_3_title: discovery.concern_3_title || '',
    concern_3_answer: discovery.concern_3_answer || '',
  }

  // ── Populate data-field elements ──────────────────────────────────────
  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field
    const val = data[key]
    if (val != null && val !== '') el.textContent = val
  })

  // ── Fix #4 & #5: Populate unit pages from rent roll ──────────────────
  const unitPages = document.querySelectorAll('.om-page.unit')
  units.forEach((unit, i) => {
    if (i >= unitPages.length) return
    const page = unitPages[i]
    const unitLabel = `Unit ${unit.unit_number || i + 1} · ${unit.unit_type || ''}`
    page.setAttribute('data-toc', unitLabel)

    // Populate ALL text in the page consistently from the same unit record
    const allText = page.querySelectorAll('h2, .h-title, .h-section')
    allText.forEach(el => { el.textContent = unitLabel })

    // Populate specs — find all dt/dd pairs
    const specRows = page.querySelectorAll('.specs .row, .specs tr, dl .row')
    const specMap = {
      'Type': unit.unit_type || '—',
      'Unit Type': unit.unit_type || '—',
      'SF': unit.unit_sf ? unit.unit_sf.toLocaleString() + ' SF' : '—',
      'Square Feet': unit.unit_sf ? unit.unit_sf.toLocaleString() + ' SF' : '—',
      'Current Rent': fC(unit.actual_rent) + '/mo',
      'Rent': fC(unit.actual_rent) + '/mo',
      'Market Rent': fC(unit.market_rent) + '/mo',
      'Pro Forma': fC(unit.market_rent) + '/mo',
      'Status': unit.status || '—',
      'Tenant': unit.tenant_name || '—',
      'Lease End': unit.lease_end_date || '—',
      'Deposit': fC(unit.security_deposit),
    }
    specRows.forEach(row => {
      const dt = row.querySelector('dt')
      const dd = row.querySelector('dd')
      if (dt && dd) {
        const key = dt.textContent.trim()
        if (specMap[key] != null) dd.textContent = specMap[key]
      }
    })

    // Also update any loose stat values in the page
    const statVals = page.querySelectorAll('.stat-val, .n')
    const statData = [unit.unit_sf ? unit.unit_sf + ' SF' : '', fC(unit.actual_rent), fC(unit.market_rent)]
    statVals.forEach((el, j) => { if (statData[j]) el.textContent = statData[j] })
  })
  for (let i = units.length; i < unitPages.length; i++) {
    unitPages[i].classList.add('is-disabled')
  }

  // ── Fix #5: Unit mix table — only real unit types ─────────────────────
  const finPages = document.querySelectorAll('.om-page.financials')
  finPages.forEach(finPage => {
    const tables = finPage.querySelectorAll('table')
    const unitMixTable = tables[0]
    const incExpTable = tables[1]

    // Unit mix
    if (unitMixTable) {
      const tbody = unitMixTable.querySelector('tbody')
      if (tbody) {
        const typeGroups = {}
        units.forEach(u => {
          const t = u.unit_type || 'Unknown'
          if (!typeGroups[t]) typeGroups[t] = { count: 0, totalSF: 0, totalRent: 0, totalPF: 0 }
          typeGroups[t].count++
          typeGroups[t].totalSF += Number(u.unit_sf) || 0
          typeGroups[t].totalRent += Number(u.actual_rent) || 0
          typeGroups[t].totalPF += Number(u.market_rent) || 0
        })
        const rows = Object.entries(typeGroups).map(([type, g]) => {
          const avgSF = g.count ? Math.round(g.totalSF / g.count) : 0
          const avgRent = g.count ? Math.round(g.totalRent / g.count) : 0
          const avgPF = g.count ? Math.round(g.totalPF / g.count) : 0
          return { type, count: g.count, avgSF, avgRent, rentPSF: avgSF ? (avgRent / avgSF).toFixed(2) : '—', avgPF, pfPSF: avgSF ? (avgPF / avgSF).toFixed(2) : '—' }
        })
        const totSF = units.reduce((s, u) => s + (Number(u.unit_sf) || 0), 0)
        const totRent = units.reduce((s, u) => s + (Number(u.actual_rent) || 0), 0)
        const totPF = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0)

        tbody.innerHTML = ''
        rows.forEach(r => {
          const tr = document.createElement('tr')
          tr.innerHTML = `<td>${r.type}</td><td>${r.count}</td><td>${r.avgSF.toLocaleString()}</td><td>${fC(r.avgRent)}</td><td>$${r.rentPSF}</td><td>${fC(r.avgPF)}</td><td>$${r.pfPSF}</td>`
          tbody.appendChild(tr)
        })
        const totalRow = document.createElement('tr')
        totalRow.className = 'is-total'
        totalRow.innerHTML = `<td>Total / Average</td><td>${totalUnits}</td><td>${totSF.toLocaleString()}</td><td>${fC(totRent)}</td><td>$${totSF ? (totRent / totSF).toFixed(2) : '—'}</td><td>${fC(totPF)}</td><td>$${totSF ? (totPF / totSF).toFixed(2) : '—'}</td>`
        tbody.appendChild(totalRow)
      }
    }

    // Fix #6: Income & expenses table from selected income source
    if (incExpTable) {
      const tbody = incExpTable.querySelector('tbody')
      if (tbody) {
        tbody.innerHTML = ''
        const expRows = [
          ['Gross Operating Income', srcGOI, srcGOI / totalUnits, pfRent || srcGOI, (pfRent || srcGOI) / totalUnits],
          ['Real Estate Taxes', t12Taxes, t12Taxes / totalUnits, t12Taxes, t12Taxes / totalUnits],
          ['Property Insurance', t12Insurance, t12Insurance / totalUnits, t12Insurance, t12Insurance / totalUnits],
          ['Utilities', t12Utilities, t12Utilities / totalUnits, t12Utilities, t12Utilities / totalUnits],
          ['Management', t12Mgmt, t12Mgmt / totalUnits, t12Mgmt, t12Mgmt / totalUnits],
          ['Maintenance / Turnover', t12Repairs, t12Repairs / totalUnits, t12Repairs, t12Repairs / totalUnits],
          ['Other', t12OtherExp, t12OtherExp / totalUnits, t12OtherExp, t12OtherExp / totalUnits],
          ['Total Operating Expenses', srcExp || t12TotalExp, (srcExp || t12TotalExp) / totalUnits, t12TotalExp, t12TotalExp / totalUnits],
        ]
        expRows.forEach(([label, curr, currPU, pf, pfPU], idx) => {
          const tr = document.createElement('tr')
          if (idx === expRows.length - 1) tr.className = 'is-total'
          tr.innerHTML = `<td>${label}</td><td>${fC(curr)}</td><td>${fC(currPU)}</td><td>${fC(pf)}</td><td>${fC(pfPU)}</td>`
          tbody.appendChild(tr)
        })
        const noiRow = document.createElement('tr')
        noiRow.className = 'is-total'
        noiRow.innerHTML = `<td>Net Operating Income</td><td>${fC(srcNOI)}</td><td>${fC(srcNOI / totalUnits)}</td><td>${fC(pfNOI)}</td><td>${fC(pfNOI / totalUnits)}</td>`
        tbody.appendChild(noiRow)
      }
    }
  })

  // ── Fix #8: Comps from sub-market (best available — selections not persisted) ──
  const selectedComps = recentComps.slice(0, 7)
  const compSummaryRows = document.querySelectorAll('.comps-summary tbody tr')
  const compDetailCards = document.querySelectorAll('.comps-detail .comp-card')

  if (compSummaryRows.length > 0) {
    const subCells = compSummaryRows[0].querySelectorAll('td')
    const subVals = ['★', shortAddr, pr.city || '', pr.year_built || '', totalUnits, '—', fC(askPrice), fC(pricePerUnit), fC(pricePerSF), buildingSF > 1 ? Math.round(buildingSF / totalUnits) : '—', fP(currentCap)]
    subCells.forEach((td, j) => { if (subVals[j] != null) td.textContent = subVals[j] })
  }
  if (compDetailCards.length > 0) {
    const card = compDetailCards[0]
    const h3 = card.querySelector('h3'); if (h3) h3.textContent = data.property_name
    const addr = card.querySelector('.addr'); if (addr) addr.textContent = fullAddr
    const dds = card.querySelectorAll('dd')
    const ddVals = [totalUnits, pr.year_built || '—', buildingSF > 1 ? Math.round(buildingSF / totalUnits) : '—', '—', fC(askPrice), fC(pricePerUnit), fC(pricePerSF), fP(currentCap)]
    dds.forEach((dd, j) => { if (ddVals[j] != null) dd.textContent = ddVals[j] })
  }
  selectedComps.forEach((comp, i) => {
    const ppu = comp.sale_price && comp.num_units ? Math.round(comp.sale_price / comp.num_units) : null
    const psf = comp.sale_price && comp.building_sf ? Math.round(comp.sale_price / comp.building_sf) : null
    const avgUnitSF = comp.building_sf && comp.num_units ? Math.round(comp.building_sf / comp.num_units) : null
    const cap = !comp.x_noi && comp.adv_noi > 0 && comp.sale_price ? comp.adv_noi / comp.sale_price : null
    const saleDate = comp.sale_date ? new Date(comp.sale_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'
    if (compSummaryRows[i + 1]) {
      const cells = compSummaryRows[i + 1].querySelectorAll('td')
      const vals = [String(i + 1), comp.property_name || comp.sale_name || '—', comp.property_county || '—', comp.year_built || '—', comp.num_units || '—', saleDate, fC(comp.sale_price), fC(ppu), fC(psf), avgUnitSF || '—', cap ? fP(cap) : '—']
      cells.forEach((td, j) => { if (vals[j] != null) td.textContent = vals[j] })
    }
    if (compDetailCards[i + 1]) {
      const card = compDetailCards[i + 1]
      const label = card.querySelector('.comp-label'); if (label) label.textContent = `Comparable ${i + 1}`
      const h3 = card.querySelector('h3'); if (h3) h3.textContent = comp.property_name || comp.sale_name || '—'
      const addr = card.querySelector('.addr'); if (addr) addr.textContent = [comp.sub_market, comp.property_county].filter(Boolean).join(', ')
      const dds = card.querySelectorAll('dd')
      const ddVals = [comp.num_units || '—', comp.year_built || '—', avgUnitSF || '—', saleDate, fC(comp.sale_price), fC(ppu), fC(psf), cap ? fP(cap) : '—']
      dds.forEach((dd, j) => { if (ddVals[j] != null) dd.textContent = ddVals[j] })
    }
  })

  // ── Fix #10: Populate marketing materials ─────────────────────────────
  // Flyers, postcards, social posts, sales letter all share these fields
  const mktgFields = {
    '.collateral-page .title, .collateral-page h1': data.property_name,
    '.collateral-page .addr, .collateral-page .address': fullAddr,
    '.collateral-page .price': fC(askPrice),
    '.collateral-page .lede': `${totalUnits}-unit multifamily · ${pr.neighborhood || pr.sub_market || ''} · ${pr.year_built || ''}`,
    '.postcard-page .title, .postcard-page h2': data.property_name,
    '.postcard-page .addr': shortAddr,
    '.postcard-page .price': fC(askPrice),
    '.social-suite .property-name': data.property_name,
  }
  Object.entries(mktgFields).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach(el => { if (value) el.textContent = value })
  })

  // Flyer specs tables
  document.querySelectorAll('.collateral-page .specs dd, .collateral-page .spec-val').forEach((dd, i) => {
    const vals = [totalUnits + ' Units', pr.year_built || '—', buildingSF > 1 ? buildingSF.toLocaleString() + ' SF' : '—', data.lot_size, data.walk_score, data.bike_score]
    if (vals[i] != null) dd.textContent = vals[i]
  })
  // Flyer financial rows
  document.querySelectorAll('.collateral-page .fin-row .v, .collateral-page .fin-val').forEach((el, i) => {
    const vals = [fC(askPrice), fC(pricePerUnit), fC(pricePerSF), fC(srcGOI), fC(srcNOI), data.cap_display]
    if (vals[i] != null) el.textContent = vals[i]
  })

  // ── Expose data ───────────────────────────────────────────────────────
  const unitNotes = units.map(u => u.notes).filter(Boolean).join('; ')
  const unitMix = units.map(u => `${u.unit_type || '?'} ${u.unit_sf || '?'}SF $${u.actual_rent || 0}/mo`).join(', ')
  const aiContext = { ...data, unit_notes: unitNotes, unit_mix: unitMix }

  window.__omData = { proposal, pr, units, fin, dash, comps: selectedComps, metrics: data, sb, proposalId, aiContext }
  window.__omDataReady = true

  // ── AI Generate buttons ───────────────────────────────────────────────
  const isClientView = new URLSearchParams(location.search).get('view') === 'client'
  if (!isClientView) {
    const generatePages = [
      { selector: '.om-page.summary', page: 'investment_summary', apply: (res, el) => {
        const h = el.querySelector('.h-title, h2'); if (h && res.headline) h.textContent = res.headline
        const p = el.querySelector('.lede, .p-body'); if (p && res.lede) p.textContent = res.lede
      }},
      { selector: '.om-page.highlights:not(.is-paper)', page: 'investment_highlights', apply: (res, el) => {
        if (!res.highlights) return
        const cards = el.querySelectorAll('.card, .highlight-card')
        res.highlights.forEach((h, i) => { if (!cards[i]) return; const t = cards[i].querySelector('h3'); if (t) t.textContent = h.title; const p = cards[i].querySelector('p:not(h3)'); if (p) p.textContent = h.description })
      }},
      { selector: '.om-page.highlights.is-paper', page: 'location_highlights', apply: (res, el) => {
        if (!res.highlights) return
        const cards = el.querySelectorAll('.card, .highlight-card')
        res.highlights.forEach((h, i) => { if (!cards[i]) return; const t = cards[i].querySelector('h3'); if (t) t.textContent = h.title; const p = cards[i].querySelector('p:not(h3)'); if (p) p.textContent = h.description })
      }},
      { selector: '.om-page.narrative[data-group="Proposal"]', page: 'market_narrative', apply: (res, el) => {
        const h = el.querySelector('.h-title, h2'); if (h && res.headline) h.textContent = res.headline
        const body = el.querySelector('.narrative-body, .p-body'); if (body && res.narrative) body.innerHTML = res.narrative.split('\n\n').map(p => '<p>' + p + '</p>').join('')
      }},
      { selector: '.om-page.letter-page', page: 'sales_letter', apply: (res, el) => {
        const sal = el.querySelector('.salutation'); if (sal && res.salutation) sal.textContent = res.salutation
        const body = el.querySelector('.letter-body, .body'); if (body && res.body) body.innerHTML = res.body.split('\n\n').map(p => '<p>' + p + '</p>').join('')
        const close = el.querySelector('.closing'); if (close && res.closing) close.textContent = res.closing
      }},
    ]
    const btnStyle = 'position:absolute;top:12px;right:12px;z-index:5;padding:5px 12px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:6px;font:11px/1 system-ui;cursor:pointer;backdrop-filter:blur(4px);'
    generatePages.forEach(({ selector, page, apply }) => {
      const el = document.querySelector(selector)
      if (!el) return
      const btn = document.createElement('button')
      btn.className = 'om-generate-btn'
      btn.style.cssText = btnStyle
      btn.textContent = 'Generate'
      btn.onclick = async () => {
        btn.textContent = 'Generating...'; btn.disabled = true
        try {
          const res = await fetch('/api/generate-om-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page, context: aiContext }) })
          if (!res.ok) throw new Error('Generation failed')
          apply(await res.json(), el)
          btn.textContent = 'Generated'; setTimeout(() => { btn.textContent = 'Generate'; btn.disabled = false }, 2000)
        } catch (err) { console.error('AI generate error:', err); btn.textContent = 'Error'; setTimeout(() => { btn.textContent = 'Generate'; btn.disabled = false }, 2000) }
      }
      el.style.position = 'relative'; el.appendChild(btn)
    })
  }

  // ── Per-proposal persistence ──────────────────────────────────────────
  let saveTimer = null
  const omState = proposal.om_state || {}
  if (omState.text_overrides) {
    Object.entries(omState.text_overrides).forEach(([sel, text]) => { const el = document.querySelector(sel); if (el) el.textContent = text })
  }
  if (omState.disabled_pages) { try { localStorage.setItem('om-pages-disabled', JSON.stringify(omState.disabled_pages)) } catch {} }
  if (omState.page_order) { try { localStorage.setItem('om-page-order', JSON.stringify(omState.page_order)) } catch {} }
  if (omState.page_titles) { try { localStorage.setItem('om-page-titles', JSON.stringify(omState.page_titles)) } catch {} }

  function saveState() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const state = {
        disabled_pages: (() => { try { return JSON.parse(localStorage.getItem('om-pages-disabled') || '[]') } catch { return [] } })(),
        page_order: (() => { try { return JSON.parse(localStorage.getItem('om-page-order') || '[]') } catch { return [] } })(),
        page_titles: (() => { try { return JSON.parse(localStorage.getItem('om-page-titles') || '{}') } catch { return {} } })(),
      }
      const { error } = await sb.from('proposals').update({ om_state: state }).eq('id', proposalId)
      if (!error) { const ind = document.getElementById('om-save-indicator'); if (ind) { ind.style.opacity = '1'; setTimeout(() => { ind.style.opacity = '0' }, 2000) } }
    }, 2000)
  }
  window.addEventListener('storage', saveState)
  const origSetItem = localStorage.setItem.bind(localStorage)
  localStorage.setItem = function (key, value) { origSetItem(key, value); if (key.startsWith('om-')) saveState() }

  document.dispatchEvent(new Event('om-data-ready'))
  console.log('OM: data loaded for proposal', proposalId, '—', units.length, 'units,', selectedComps.length, 'comps,', 'income source:', incSrc)
})()
