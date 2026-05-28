/**
 * Serializes proposal data into the templated OM document shape
 * ({ property, pages: [...] }) consumed by /om's renderer.
 */
import { supabase } from '../supabase'

const fC = v => v ? '$' + Math.round(Number(v)).toLocaleString() : '—'
const fP = v => v ? (v * 100).toFixed(2) + '%' : '—'
const fN = v => v ? Number(v).toFixed(2) : '—'
const fK = v => v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : fC(v)
const fM = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : fC(v)

const INCOME_CODES = ['collected_rent', 'rubs_electric', 'rubs_water_sewer', 'rubs_gas', 'rubs_trash', 'rubs_combined', 'park_parking', 'storage_income', 'oi_tenant_chargeback', 'oi_application_fees', 'oi_insurance_services', 'oi_deposit_forfeit', 'oi_interest', 'oi_late_charges', 'oi_nsf_fees', 'oi_laundry', 'oi_pet_rent', 'oi_misc']
const EXP_GROUPS = {
  taxes: ['ptax_property'],
  insurance: ['ins_property'],
  utilities: ['uti_electric', 'uti_electric_vacant', 'uti_water_sewer', 'uti_gas', 'uti_trash', 'uti_combined'],
  mgmt: ['pm_mgmt_fees', 'pm_lease_up', 'pm_misc_fees'],
  repairs: ['rm_general_maint', 'rm_general_repair', 'rm_cleaning', 'rm_supplies', 'rm_painting', 'rm_hvac', 'rm_plumbing', 'rm_appliance', 'rm_labor', 'rm_pest', 'rm_misc'],
  other: ['admin_licenses', 'admin_collection', 'admin_dues', 'admin_postage', 'admin_bank', 'admin_onboarding', 'admin_supplies', 'otax_state_local', 'otax_other', 'land_landscaping', 'turn_misc', 'capres_reserves', 'sec_security', 'conserv_services', 'mark_leasing', 'mark_advertising', 'mark_internet', 'pay_payroll', 'misc_expenses'],
}

/**
 * Fetch all proposal data and build the OM document, then save to
 * proposals.om_json. Returns the document.
 */
export async function generateOmDocument(proposalId) {
  const [propRes, unitsRes, finRes, dashRes, selRes] = await Promise.all([
    supabase.from('proposals').select('*, properties(*)').eq('id', proposalId).single(),
    supabase.from('rent_roll_units').select('*').eq('proposal_id', proposalId).order('sort_order', { ascending: true }),
    supabase.from('proposal_financials').select('*').eq('proposal_id', proposalId).maybeSingle(),
    supabase.from('proposal_dashboard').select('data').eq('proposal_id', proposalId).maybeSingle(),
    supabase.from('comp_selections').select('comp_id').eq('proposal_id', proposalId).eq('is_marketing', true),
  ])

  const proposal = propRes.data
  if (!proposal) throw new Error('Proposal not found')
  const pr = proposal.properties || {}
  const units = unitsRes.data || []
  const fin = finRes.data || {}
  const dash = dashRes.data?.data || {}
  const discovery = proposal.discovery_notes || {}

  // Marketing comps
  const mktgIds = (selRes.data || []).map(r => r.comp_id)
  let comps = []
  if (mktgIds.length) {
    const { data } = await supabase.from('comps').select('*').in('id', mktgIds)
      .order('sale_date', { ascending: false, nullsFirst: false })
    comps = (data || []).slice(0, 9)
  }
  // Sub-market comps for market stats
  let smComps = []
  if (pr.sub_market) {
    const { data } = await supabase.from('comps').select('*')
      .eq('status', 'Sold').eq('sub_market', pr.sub_market)
      .order('sale_date', { ascending: false, nullsFirst: false }).limit(1000)
    smComps = data || []
  }

  // ── Core metrics ──
  const askPrice = Number(proposal.asking_price) || 0
  const totalUnits = units.length || Number(pr.total_units) || 1
  const buildingSF = Number(pr.building_sf) || 0
  const pricePerUnit = askPrice && totalUnits ? Math.round(askPrice / totalUnits) : 0
  const pricePerSF = askPrice && buildingSF ? Math.round(askPrice / buildingSF) : 0

  const t12 = fin.t12_monthly || {}
  const months = Object.values(t12)
  const t12Sum = codes => months.reduce((s, m) => s + codes.reduce((cs, c) => cs + (Number(m?.[c]) || 0), 0), 0)
  const t12GOI = t12Sum(INCOME_CODES)
  const exp = {
    taxes: t12Sum(EXP_GROUPS.taxes), insurance: t12Sum(EXP_GROUPS.insurance),
    utilities: t12Sum(EXP_GROUPS.utilities), mgmt: t12Sum(EXP_GROUPS.mgmt),
    repairs: t12Sum(EXP_GROUPS.repairs), other: t12Sum(EXP_GROUPS.other),
  }
  const t12Exp = Object.values(exp).reduce((a, b) => a + b, 0)
  const t12NOI = t12GOI - t12Exp

  const statedGross = Number(dash.stated_income) || 0
  const statedExp = Number(dash.stated_expenses) || 0
  const statedNOI = statedGross - statedExp
  const pfRent = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0) * 12
  const pfNOI = pfRent > 0 ? pfRent - t12Exp : 0

  const srcs = {
    'Stated': { goi: statedGross, exp: statedExp, noi: statedNOI },
    'T-12': { goi: t12GOI, exp: t12Exp, noi: t12NOI },
    'Stabilized': { goi: pfRent, exp: t12Exp, noi: pfNOI },
    'Market': { goi: pfRent, exp: t12Exp, noi: pfNOI },
  }
  const autoSrc = ['Stated', 'T-12', 'Stabilized', 'Market'].find(s => (srcs[s]?.noi || 0) > 0) || 'Stated'
  const incSrc = dash.income_source && srcs[dash.income_source] ? dash.income_source : autoSrc
  const src = srcs[incSrc]
  const currentCap = askPrice && src.noi ? src.noi / askPrice : 0
  const pfCap = askPrice && pfNOI ? pfNOI / askPrice : 0
  const grm = askPrice && src.goi ? askPrice / src.goi : 0

  // ── Market stats ──
  const now = new Date()
  const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 12)
  const six = new Date(now); six.setMonth(six.getMonth() - 6)
  const recent = smComps.filter(c => { const d = c.sale_date ? new Date(c.sale_date) : null; return d && d >= cutoff })
  const last6 = recent.filter(c => new Date(c.sale_date) >= six)
  const median = arr => { const a = arr.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }
  const medCap = median(recent.filter(c => !c.x_noi && c.adv_noi > 0 && c.sale_price).map(c => c.adv_noi / c.sale_price))
  const medPPU = median(recent.filter(c => c.sale_price && c.num_units).map(c => c.sale_price / c.num_units))
  const medDOM = median(recent.map(c => c.listing_date && c.sale_date ? Math.round((new Date(c.sale_date) - new Date(c.listing_date)) / 86400000) : null))
  const vol6 = last6.reduce((s, c) => s + (Number(c.sale_price) || 0), 0)

  const mp = dash.market_pricing || {}
  const fullAddr = [pr.street, pr.city, pr.state, pr.zip].filter(Boolean).join(', ')
  const shortAddr = pr.street || ''
  const propName = pr.property_name || pr.street || 'Property'

  // ── Comp helpers ──
  const compMetrics = c => ({
    ppu: c.sale_price && c.num_units ? Math.round(c.sale_price / c.num_units) : null,
    psf: c.sale_price && c.building_sf ? Math.round(c.sale_price / c.building_sf) : null,
    avgSF: c.building_sf && c.num_units ? Math.round(c.building_sf / c.num_units) : null,
    cap: !c.x_noi && c.adv_noi > 0 && c.sale_price ? c.adv_noi / c.sale_price : null,
    dt: c.sale_date ? new Date(c.sale_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
  })

  // ── Build document ──
  const property = {
    name: propName,
    address: fullAddr,
    askingPrice: fC(askPrice),
    agent: { company: 'Method Multifamily', division: 'Investment Sales' },
  }

  const pages = []

  // Cover
  pages.push({ id: 'cover', template: 'cover', data: {
    badge: 'Offering Memorandum',
    kicker: `${totalUnits}-Unit Multifamily`,
    lede: `${propName} — a ${totalUnits}-unit investment opportunity in ${pr.sub_market || pr.neighborhood || pr.city || 'Portland'}.`,
    heroSlotId: 'cover-hero',
  }})

  // Client Concerns (Q&A)
  const concerns = []
  if (discovery.concern_1_title) concerns.push({ question: discovery.concern_1_title, answer: discovery.concern_1_answer || '' })
  if (discovery.concern_2_title) concerns.push({ question: discovery.concern_2_title, answer: discovery.concern_2_answer || '' })
  if (discovery.concern_3_title) concerns.push({ question: discovery.concern_3_title, answer: discovery.concern_3_answer || '' })
  if (concerns.length) {
    pages.push({ id: 'concerns', template: 'qa', data: {
      section: 'Proposal', pageNumber: 'P·01', eyebrow: 'Your Priorities',
      title: 'Your concerns, answered.', items: concerns,
    }})
  }

  // Market Stats
  pages.push({ id: 'market-stats', template: 'stat-tiles', data: {
    section: 'Proposal', pageNumber: 'P·02', eyebrow: 'By the Numbers',
    title: `${pr.sub_market || 'Portland'} multifamily, today.`,
    lede: `Live market data from comparable sales in ${pr.sub_market || 'the submarket'} over the trailing 12 months.`,
    columns: 4,
    tiles: [
      { value: medCap != null ? fP(medCap) : '—', label: 'Median Cap Rate', source: 'Live comps · 12mo' },
      { value: medPPU != null ? fK(medPPU) : '—', label: 'Median Price / Unit', source: 'Live comps · 12mo' },
      { value: recent.length ? String(recent.length) : '—', label: 'Sales · trailing 12mo', source: 'Live comps' },
      { value: medDOM != null ? String(Math.round(medDOM)) : '—', label: 'Median Days on Market', source: 'Live comps' },
      { value: vol6 > 0 ? fM(vol6) : '—', label: 'Sales Volume · 6mo', source: 'Live comps' },
      { value: fP(currentCap), label: 'Subject Cap Rate', source: incSrc },
      { value: fC(pricePerUnit), label: 'Subject $ / Unit', source: 'Asking' },
      { value: fN(grm), label: 'Subject GRM', source: incSrc },
    ],
  }})

  // Comps Summary (table)
  if (comps.length) {
    const sumRows = [{
      kind: 'subject',
      cells: ['★', `${propName} <span class="sub">(Subject)</span>`, pr.city || '—', String(pr.year_built || '—'), String(totalUnits), '—', fC(askPrice), fC(pricePerUnit), fC(pricePerSF), buildingSF && totalUnits ? String(Math.round(buildingSF / totalUnits)) : '—', fP(currentCap)],
    }]
    let sP = 0, sU = 0, sF = 0, sC = 0, cN = 0
    comps.forEach((c, i) => {
      const m = compMetrics(c)
      sumRows.push({ cells: [String(i + 1).padStart(2, '0'), c.property_name || c.sale_name || '—', c.property_county || '—', String(c.year_built || '—'), String(c.num_units || '—'), m.dt, fC(c.sale_price), fC(m.ppu), fC(m.psf), m.avgSF != null ? String(m.avgSF) : '—', m.cap ? fP(m.cap) : '—'] })
      if (c.sale_price) sP += c.sale_price
      if (m.ppu) sU += m.ppu
      if (m.psf) sF += m.psf
      if (m.cap) { sC += m.cap; cN++ }
    })
    const n = comps.length
    sumRows.push({ kind: 'avg', cells: ['', 'Averages', '—', '—', '—', '—', fC(sP / n), fC(sU / n), fC(sF / n), '—', cN ? fP(sC / cN) : '—'] })
    pages.push({ id: 'comps-summary', template: 'table', data: {
      section: 'Proposal', pageNumber: 'P·03', eyebrow: 'Sales Comparables',
      title: `${comps.length} comparable sales.`,
      lede: 'Recent multifamily sales selected as the most relevant comparables for this property.',
      columns: ['#', 'Property', 'County', 'Year', '# Units', 'Sale Date', 'Sale Price', '$ / Unit', '$ / SF', 'Avg Unit SF', 'Cap Rate'],
      rows: sumRows,
    }})

    // Comps Detail (card-grid)
    const cards = [{
      kind: 'subject', label: '★ Subject Property', title: propName, address: fullAddr, slotId: 'comp-subject-photo',
      fields: [['Units', String(totalUnits)], ['Year', String(pr.year_built || '—')], ['Avg SF', buildingSF && totalUnits ? String(Math.round(buildingSF / totalUnits)) : '—'], ['Sale Date', '—'], ['Price', fC(askPrice)], ['$ / Unit', fC(pricePerUnit)], ['$ / SF', fC(pricePerSF)], ['Cap', fP(currentCap)]],
    }]
    comps.forEach((c, i) => {
      const m = compMetrics(c)
      cards.push({ label: `Comp · ${String(i + 1).padStart(2, '0')}`, title: c.property_name || c.sale_name || '—', address: [c.sub_market, c.property_county].filter(Boolean).join(', '), slotId: `comp-${i + 1}-photo`,
        fields: [['Units', String(c.num_units || '—')], ['Year', String(c.year_built || '—')], ['Avg SF', m.avgSF != null ? String(m.avgSF) : '—'], ['Sale Date', m.dt], ['Price', fC(c.sale_price)], ['$ / Unit', fC(m.ppu)], ['$ / SF', fC(m.psf)], ['Cap', m.cap ? fP(m.cap) : '—']] })
    })
    pages.push({ id: 'comps-detail', template: 'card-grid', data: {
      section: 'Proposal', pageNumber: 'P·04', eyebrow: 'Sales Comparables · Detail',
      title: 'A closer look at the comps.', columns: 4, cards,
    }})
  }

  // Pricing Strategy
  if (mp.investor_floor || mp.band_low || mp.suggested_price || mp.aggressive_price) {
    const capFor = price => price && src.noi ? fP(src.noi / price) : '—'
    pages.push({ id: 'pricing-strategy', template: 'pricing-strategy', data: {
      section: 'Proposal', pageNumber: 'P·05', eyebrow: 'Pricing Strategy',
      title: 'Where to price, and why.',
      tiers: [
        { name: 'Conservative', price: fC(mp.investor_floor), cap: capFor(mp.investor_floor) },
        { name: 'Market', price: fC(mp.band_low), cap: capFor(mp.band_low) },
        { name: 'Optimistic', price: fC(mp.suggested_price), cap: capFor(mp.suggested_price), kind: 'recommended' },
        { name: 'Home Run', price: fC(mp.aggressive_price), cap: capFor(mp.aggressive_price) },
      ],
      recommendation: mp.suggested_price ? `List at ${fC(mp.suggested_price)} to drive competitive tension while staying grounded in the comps.` : '',
    }})
  }

  // Property Snapshot (photo-detail)
  pages.push({ id: 'snapshot', template: 'photo-detail', data: {
    section: 'Offering Memorandum', pageNumber: '01', eyebrow: pr.sub_market || pr.neighborhood || '',
    title: propName, photoSlotId: 'snapshot-photo',
    specs: [
      ['Address', shortAddr], ['Units', String(totalUnits)],
      ['Building SF', buildingSF ? buildingSF.toLocaleString() : '—'],
      ['Year Built', String(pr.year_built || '—')],
      ['Lot Size', pr.land_area_acres ? pr.land_area_acres + ' AC' : '—'],
      ['Parcel', pr.tax_id || '—'],
      ['GRM', fN(grm)], ['Cap Rate', fP(currentCap)],
    ],
  }})

  // Unit pages (photo-detail) — up to 6
  units.slice(0, 6).forEach((u, i) => {
    pages.push({ id: `unit-${i + 1}`, template: 'photo-detail', data: {
      section: 'Offering Memorandum', pageNumber: `0${i + 2}`,
      eyebrow: 'Unit Detail', title: `Unit ${u.unit_number || i + 1} · ${u.unit_type || ''}`,
      photoSlotId: `unit-${i + 1}-photo`,
      specs: [
        ['Type', u.unit_type || '—'],
        ['SF', u.unit_sf ? Number(u.unit_sf).toLocaleString() : '—'],
        ['Current Rent', fC(u.actual_rent)],
        ['Market Rent', fC(u.market_rent)],
        ['Status', u.status || '—'],
        ['Tenant', u.tenant_name || '—'],
      ],
    }})
  })

  // Financial Summary
  const typeGroups = {}
  units.forEach(u => {
    const t = u.unit_type || 'Unit'
    if (!typeGroups[t]) typeGroups[t] = { count: 0, sf: 0, rent: 0, pf: 0 }
    typeGroups[t].count++; typeGroups[t].sf += Number(u.unit_sf) || 0
    typeGroups[t].rent += Number(u.actual_rent) || 0; typeGroups[t].pf += Number(u.market_rent) || 0
  })
  const mixRows = Object.entries(typeGroups).map(([type, g]) => {
    const avgSF = g.count ? Math.round(g.sf / g.count) : 0
    const avgRent = g.count ? Math.round(g.rent / g.count) : 0
    const avgPF = g.count ? Math.round(g.pf / g.count) : 0
    return { cells: [type, String(g.count), avgSF.toLocaleString(), fC(avgRent), avgSF ? '$' + (avgRent / avgSF).toFixed(2) : '—', fC(avgPF), avgSF ? '$' + (avgPF / avgSF).toFixed(2) : '—'] }
  })
  const totSF = units.reduce((s, u) => s + (Number(u.unit_sf) || 0), 0)
  const totRent = units.reduce((s, u) => s + (Number(u.actual_rent) || 0), 0)
  const totPF = units.reduce((s, u) => s + (Number(u.market_rent) || 0), 0)
  mixRows.push({ kind: 'total', cells: ['Total / Avg', String(totalUnits), totSF.toLocaleString(), fC(totRent), totSF ? '$' + (totRent / totSF).toFixed(2) : '—', fC(totPF), totSF ? '$' + (totPF / totSF).toFixed(2) : '—'] })

  pages.push({ id: 'financials', template: 'financial-summary', data: {
    section: 'Offering Memorandum', pageNumber: '16', eyebrow: 'Pricing & Pro Forma',
    title: 'Financial summary.',
    headerStats: [
      { label: 'Sale Price', value: fC(askPrice) },
      { label: 'Units', value: String(totalUnits) },
      { label: 'Gross SF', value: buildingSF ? buildingSF.toLocaleString() : '—' },
      { label: 'Current Cap', value: fP(currentCap) },
      { label: 'Pro Forma Cap', value: fP(pfCap) },
    ],
    unitMix: { columns: ['Type', '# Units', 'Avg SF', 'Current Rent', 'PSF', 'Pro Forma Rent', 'PSF'], rows: mixRows },
    incomeExpense: { columns: ['', 'Current', 'Per Unit', 'Pro Forma', 'PU'], rows: [
      { cells: ['Gross Operating Income', fC(src.goi), fC(src.goi / totalUnits), fC(pfRent || src.goi), fC((pfRent || src.goi) / totalUnits)] },
      { cells: ['Real Estate Taxes', fC(exp.taxes), fC(exp.taxes / totalUnits), fC(exp.taxes), fC(exp.taxes / totalUnits)] },
      { cells: ['Insurance', fC(exp.insurance), fC(exp.insurance / totalUnits), fC(exp.insurance), fC(exp.insurance / totalUnits)] },
      { cells: ['Utilities', fC(exp.utilities), fC(exp.utilities / totalUnits), fC(exp.utilities), fC(exp.utilities / totalUnits)] },
      { cells: ['Management', fC(exp.mgmt), fC(exp.mgmt / totalUnits), fC(exp.mgmt), fC(exp.mgmt / totalUnits)] },
      { cells: ['Repairs / Turnover', fC(exp.repairs), fC(exp.repairs / totalUnits), fC(exp.repairs), fC(exp.repairs / totalUnits)] },
      { cells: ['Other', fC(exp.other), fC(exp.other / totalUnits), fC(exp.other), fC(exp.other / totalUnits)] },
      { kind: 'total', cells: ['Net Operating Income', fC(src.noi), fC(src.noi / totalUnits), fC(pfNOI), fC(pfNOI / totalUnits)] },
    ] },
  }})

  // Marketing Plan & Timeline
  pages.push({ id: 'timeline', template: 'timeline', data: {
    section: 'Proposal', pageNumber: 'P·06', eyebrow: 'Go-To-Market',
    title: 'Marketing plan & timeline.',
    lede: 'A disciplined 8-week process from launch to close.',
    weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    phases: [
      { name: 'Prep & Materials', start: 1, end: 2 },
      { name: 'Active Marketing', start: 2, end: 5 },
      { name: 'Offers & Bid Deadline', start: 5, end: 6 },
      { name: 'Escrow & Close', start: 6, end: 8 },
    ],
  }})

  // Disclaimer
  pages.push({ id: 'disclaimer', template: 'body-copy', data: {
    section: 'Offering Memorandum', pageNumber: '—', eyebrow: 'Confidential',
    title: 'Disclaimer.',
    paragraphs: [
      'This Offering Memorandum is confidential and furnished solely for the purpose of a review by prospective purchasers of the subject property. It is not to be used for any other purpose or made available to any other person without the express written consent of the broker.',
      'The information contained herein has been obtained from sources believed to be reliable; however, the broker has not verified, and will not verify, any of the information contained herein, nor has the broker conducted any investigation regarding these matters and makes no warranty or representation whatsoever regarding the accuracy or completeness of the information provided.',
      'All prospective purchasers should conduct their own independent investigation and rely solely on such investigation in making any purchase decision.',
    ],
  }})

  const doc = { property, pages }

  // Save to Supabase
  const { error } = await supabase.from('proposals').update({ om_json: doc }).eq('id', proposalId)
  if (error) throw error
  return doc
}
