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

  // Wait for Supabase SDK to load
  if (typeof supabase === 'undefined') {
    console.warn('OM: Supabase SDK not loaded')
    return
  }
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

  // ── Fetch comps (filtered by sub_market + era, last 12 months, sold) ──
  let comps = []
  if (pr.sub_market) {
    let all = [], from = 0, pageSize = 1000, done = false
    while (!done) {
      const { data } = await sb.from('comps').select('*')
        .eq('status', 'Sold')
        .eq('sub_market', pr.sub_market)
        .order('sale_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      all = all.concat(data || [])
      if (!data || data.length < pageSize) done = true
      else from += pageSize
    }
    comps = all
  }

  // ── Compute derived metrics ───────────────────────────────────────────
  const askPrice = Number(proposal.asking_price) || 0
  const totalUnits = units.length || Number(pr.total_units) || 1
  const buildingSF = Number(pr.building_sf) || 1
  const pricePerUnit = askPrice ? Math.round(askPrice / totalUnits) : 0
  const pricePerSF = askPrice ? Math.round(askPrice / buildingSF) : 0

  // T-12 financials
  const t12 = fin.t12_monthly || {}
  const t12Months = Object.values(t12)
  function t12Sum(codes) {
    return t12Months.reduce((s, m) => {
      return s + codes.reduce((cs, c) => cs + (Number(m?.[c]) || 0), 0)
    }, 0)
  }
  const t12Rent = t12Sum(['collected_rent'])
  const t12RUBS = t12Sum(['rubs_electric', 'rubs_water_sewer', 'rubs_gas', 'rubs_trash', 'rubs_combined'])
  const t12Parking = t12Sum(['park_parking'])
  const t12Storage = t12Sum(['storage_income'])
  const t12OtherInc = t12Sum(['oi_tenant_chargeback', 'oi_application_fees', 'oi_insurance_services', 'oi_deposit_forfeit', 'oi_interest', 'oi_late_charges', 'oi_nsf_fees', 'oi_laundry', 'oi_pet_rent', 'oi_misc'])
  const t12GOI = t12Rent + t12RUBS + t12Parking + t12Storage + t12OtherInc
  const t12Taxes = t12Sum(['ptax_property'])
  const t12Insurance = t12Sum(['ins_property'])
  const t12Utilities = t12Sum(['uti_electric', 'uti_electric_vacant', 'uti_water_sewer', 'uti_gas', 'uti_trash', 'uti_combined'])
  const t12Mgmt = t12Sum(['pm_mgmt_fees', 'pm_lease_up', 'pm_misc_fees'])
  const t12Repairs = t12Sum(['rm_general_maint', 'rm_general_repair', 'rm_cleaning', 'rm_supplies', 'rm_painting', 'rm_hvac', 'rm_plumbing', 'rm_appliance', 'rm_labor', 'rm_pest', 'rm_misc'])
  const t12Other = t12Sum(['admin_licenses', 'admin_collection', 'admin_dues', 'admin_postage', 'admin_bank', 'admin_onboarding', 'admin_supplies', 'otax_state_local', 'otax_other', 'land_landscaping', 'turn_misc', 'capres_reserves', 'sec_security', 'conserv_services', 'mark_leasing', 'mark_advertising', 'mark_internet', 'pay_payroll', 'misc_expenses'])
  const t12TotalExp = t12Taxes + t12Insurance + t12Utilities + t12Mgmt + t12Repairs + t12Other
  const t12NOI = t12GOI - t12TotalExp

  // Pro forma from rent roll
  const pfRent = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0) * 12
  const pfNOI = pfRent - t12TotalExp

  const currentCap = askPrice && t12NOI ? t12NOI / askPrice : 0
  const pfCap = askPrice && pfNOI ? pfNOI / askPrice : 0
  const grm = askPrice && t12GOI ? askPrice / t12GOI : 0

  // ── Market stats from comps ───────────────────────────────────────────
  const now = new Date()
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const eighteenMonthsAgo = new Date(now); eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18)

  function parseDate(s) { return s ? new Date(s) : null }
  function median(arr) {
    const c = arr.filter(v => v != null && isFinite(v)).sort((a, b) => a - b)
    if (!c.length) return null
    const m = Math.floor(c.length / 2)
    return c.length % 2 ? c[m] : (c[m - 1] + c[m]) / 2
  }

  const recentComps = comps.filter(c => {
    const d = parseDate(c.sale_date)
    return d && d >= twelveMonthsAgo
  })
  const last6 = recentComps.filter(c => parseDate(c.sale_date) >= sixMonthsAgo)
  const prior6 = recentComps.filter(c => { const d = parseDate(c.sale_date); return d >= twelveMonthsAgo && d < sixMonthsAgo })

  const medianCap = median(recentComps.filter(c => !c.x_noi && c.adv_noi > 0 && c.sale_price).map(c => c.adv_noi / c.sale_price))
  const medianPPU = median(recentComps.filter(c => c.sale_price && c.num_units).map(c => c.sale_price / c.num_units))
  const medianDOM = median(recentComps.map(c => {
    if (!c.listing_date || !c.sale_date) return null
    return Math.round((new Date(c.sale_date) - new Date(c.listing_date)) / 86400000)
  }))
  const salesVolume6 = last6.reduce((s, c) => s + (Number(c.sale_price) || 0), 0)
  const salesVolumePrior6 = prior6.reduce((s, c) => s + (Number(c.sale_price) || 0), 0)

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
    building_sf: buildingSF ? '±' + buildingSF.toLocaleString() + ' SF' : '—',
    building_sf_num: buildingSF ? buildingSF.toLocaleString() : '—',
    year_built: pr.year_built || '—',
    lot_size: pr.land_area_acres ? pr.land_area_acres + ' AC' : '—',
    tax_id: pr.tax_id || '—',
    walk_score: pr.walk_score || '—',
    bike_score: pr.bike_score || '—',
    price_per_unit: fC(pricePerUnit),
    price_per_sf: fC(pricePerSF),
    grm: fN(grm),
    current_cap: fP(currentCap),
    pro_forma_cap: fP(pfCap),
    cap_display: fP(currentCap) + ' / ' + fP(pfCap) + ' PF',
    t12_goi: fC(t12GOI),
    t12_noi: fC(t12NOI),
    t12_taxes: fC(t12Taxes),
    t12_insurance: fC(t12Insurance),
    t12_utilities: fC(t12Utilities),
    t12_mgmt: fC(t12Mgmt),
    t12_repairs: fC(t12Repairs),
    t12_other_exp: fC(t12Other),
    t12_total_exp: fC(t12TotalExp),
    pf_goi: fC(pfRent),
    pf_noi: fC(pfNOI),
    goi_per_unit: fC(t12GOI / totalUnits),
    noi_per_unit: fC(t12NOI / totalUnits),
    pf_goi_per_unit: fC(pfRent / totalUnits),
    pf_noi_per_unit: fC(pfNOI / totalUnits),
    // Market stats
    median_cap: medianCap ? fP(medianCap) : '—',
    median_ppu: medianPPU ? fK(medianPPU) : '—',
    sales_count: String(recentComps.length),
    median_dom: medianDOM != null ? String(Math.round(medianDOM)) : '—',
    sales_volume_6mo: fM(salesVolume6),
    // Pricing strategy
    conservative_price: fC(proposal.conservative_price),
    market_price_val: fC(proposal.market_price),
    optimistic_price: fC(proposal.optimistic_price),
    home_run_price: fC(proposal.home_run_price),
    conservative_cap_val: fP(proposal.conservative_cap),
    market_cap_val: fP(proposal.market_cap),
    optimistic_cap_val: fP(proposal.optimistic_cap),
    recommended_price: fC(proposal.recommended_price),
    target_close: proposal.target_close || '—',
    strategy: proposal.strategy || '',
    // Discovery
    concern_1_title: discovery.concern_1_title || 'How do we get the most exposure?',
    concern_1_answer: discovery.concern_1_answer || '',
    concern_2_title: discovery.concern_2_title || 'How can I get top dollar?',
    concern_2_answer: discovery.concern_2_answer || '',
    concern_3_title: discovery.concern_3_title || 'I need someone who understands the market',
    concern_3_answer: discovery.concern_3_answer || '',
  }

  // ── Populate data-field elements ──────────────────────────────────────
  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field
    if (data[key] != null && data[key] !== '—' && data[key] !== '') {
      el.textContent = data[key]
    }
  })

  // ── Populate unit pages ───────────────────────────────────────────────
  const unitPages = document.querySelectorAll('.om-page.unit')
  units.forEach((unit, i) => {
    if (i >= unitPages.length) return
    const page = unitPages[i]
    const title = page.querySelector('.h-title, h2')
    if (title) title.textContent = `Unit ${unit.unit_number || i + 1} · ${unit.unit_type || ''}`
    page.setAttribute('data-toc', `Unit ${unit.unit_number || i + 1} · ${unit.unit_type || ''}`)
    const specs = page.querySelectorAll('.specs dd, .spec-val')
    const specData = [
      unit.unit_type || '—',
      unit.unit_sf ? unit.unit_sf + ' SF' : '—',
      fC(unit.actual_rent) + '/mo',
      fC(unit.market_rent) + '/mo',
      unit.status || '—',
      unit.tenant_name || '—',
    ]
    specs.forEach((dd, j) => { if (specData[j]) dd.textContent = specData[j] })
  })
  // Hide extra unit pages
  for (let i = units.length; i < unitPages.length; i++) {
    unitPages[i].classList.add('is-disabled')
  }

  // ── Populate unit mix table on Financial Summary ──────────────────────
  const finTable = document.querySelector('.financials tbody')
  if (finTable) {
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
    const existingRows = finTable.querySelectorAll('tr')
    rows.forEach((r, i) => {
      if (i >= existingRows.length) return
      const cells = existingRows[i].querySelectorAll('td')
      const vals = [r.type, r.count, r.avgSF.toLocaleString(), fC(r.avgRent), '$' + r.rentPSF, fC(r.avgPF), '$' + r.pfPSF]
      cells.forEach((td, j) => { if (vals[j] != null) td.textContent = vals[j] })
    })
  }

  // ── Populate comp tables ──────────────────────────────────────────────
  const compSummaryRows = document.querySelectorAll('.comps-summary tbody tr')
  const compDetailCards = document.querySelectorAll('.comps-detail .comp-card')
  const selectedComps = recentComps.slice(0, 7)

  // Subject row (first row in summary)
  if (compSummaryRows.length > 0) {
    const subCells = compSummaryRows[0].querySelectorAll('td')
    const subVals = ['★', shortAddr, pr.city || '', pr.year_built || '', totalUnits, '—', fC(askPrice), fC(pricePerUnit), fC(pricePerSF), buildingSF ? Math.round(buildingSF / totalUnits) : '—', fP(currentCap)]
    subCells.forEach((td, j) => { if (subVals[j] != null) td.textContent = subVals[j] })
  }

  // Subject card (first card in detail)
  if (compDetailCards.length > 0) {
    const card = compDetailCards[0]
    const h3 = card.querySelector('h3')
    if (h3) h3.textContent = pr.property_name || shortAddr
    const addr = card.querySelector('.addr')
    if (addr) addr.textContent = fullAddr
    const dds = card.querySelectorAll('dd')
    const ddVals = [totalUnits, pr.year_built || '—', buildingSF ? Math.round(buildingSF / totalUnits) : '—', '—', fC(askPrice), fC(pricePerUnit), fC(pricePerSF), fP(currentCap)]
    dds.forEach((dd, j) => { if (ddVals[j] != null) dd.textContent = ddVals[j] })
  }

  // Comp rows and cards
  selectedComps.forEach((comp, i) => {
    const rowIdx = i + 1
    const ppu = comp.sale_price && comp.num_units ? Math.round(comp.sale_price / comp.num_units) : null
    const psf = comp.sale_price && comp.building_sf ? Math.round(comp.sale_price / comp.building_sf) : null
    const avgUnitSF = comp.building_sf && comp.num_units ? Math.round(comp.building_sf / comp.num_units) : null
    const cap = !comp.x_noi && comp.adv_noi > 0 && comp.sale_price ? comp.adv_noi / comp.sale_price : null
    const saleDate = comp.sale_date ? new Date(comp.sale_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'

    // Summary table row
    if (compSummaryRows[rowIdx]) {
      const cells = compSummaryRows[rowIdx].querySelectorAll('td')
      const vals = [String(i + 1), comp.property_name || comp.sale_name || '—', comp.property_county || '—', comp.year_built || '—', comp.num_units || '—', saleDate, fC(comp.sale_price), fC(ppu), fC(psf), avgUnitSF || '—', cap ? fP(cap) : '—']
      cells.forEach((td, j) => { if (vals[j] != null) td.textContent = vals[j] })
    }

    // Detail card
    const cardIdx = i + 1
    if (compDetailCards[cardIdx]) {
      const card = compDetailCards[cardIdx]
      const label = card.querySelector('.comp-label')
      if (label) label.textContent = `Comparable ${i + 1}`
      const h3 = card.querySelector('h3')
      if (h3) h3.textContent = comp.property_name || comp.sale_name || '—'
      const addr = card.querySelector('.addr')
      if (addr) addr.textContent = [comp.sub_market, comp.property_county].filter(Boolean).join(', ')
      const dds = card.querySelectorAll('dd')
      const ddVals = [comp.num_units || '—', comp.year_built || '—', avgUnitSF || '—', saleDate, fC(comp.sale_price), fC(ppu), fC(psf), cap ? fP(cap) : '—']
      dds.forEach((dd, j) => { if (ddVals[j] != null) dd.textContent = ddVals[j] })
    }
  })

  // ── Expose data for AI generate and persistence ───────────────────────
  window.__omData = { proposal, pr, units, fin, dash, comps: selectedComps, metrics: data, sb, proposalId }
  window.__omDataReady = true
  document.dispatchEvent(new Event('om-data-ready'))

  console.log('OM: data loaded for proposal', proposalId, '—', units.length, 'units,', selectedComps.length, 'comps')
})()
