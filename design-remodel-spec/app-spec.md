# Method Multifamily CRE App — screen inventory & restyle spec

Source: user's ~30 screenshots of the existing app (dark left sidebar, light content,
plain system font). Goal: restyle into the **Method Multifamily** language already used in
`Market Snapshot.html` — Montserrat + DM Serif Display numerals, warm paper (#FAFAF5),
burgundy (#A51123) used sparingly, refined hairline cards, serif KPI figures.

## Navigation (their real IA — left sidebar)
`CRE App` wordmark + nav: **Proposals · Properties · Comp Database · Offering Memo**.
(Market Snapshot is a new addition; keep it in the family.)

## PROPERTIES
- **List**: title "Properties", count, "Import properties". Search by address/name/owner.
  Table cols: ADDRESS (addr + city/zip) · UNITS · TYPE (Duplex/Triplex, Fourplex, 9–20,
  21–50…) · YR BUILT · LAST SALE (price + date) · PROPOSAL (— or link).
- **Record** (← Properties · {addr} · "{city} · {n} units · {type}" · Edit · +New proposal).
  Tabs: **Overview · Market metrics · Sale history · Photos · Proposals**.
  - Overview: PROPERTY INFO card (Address, City/State, Sub-market, Market, Type, Total
    units, Building SF, Year built, Era, # buildings, Property class, Tax ID) +
    OWNERSHIP card (Owner LLC, Contact, Last sale date, Last sale price, Last $/unit,
    Last cap rate). Right rail: SALE HISTORY, PROPOSALS.
  - Market metrics: scope toggle (Market/County/Sub-Market/Zip) + Era filter; 4 metric
    cards ($/Unit, Cap Rate, GRM, Volume) — THIS mirrors the Snapshot work.
  - Sale history / Photos / Proposals: list/empty states.
- Properties = source of record for property facts (building, geo, ownership). NOT the
  financial model.

## PROPOSALS  (the underwriting workspace)
- **List**: "Proposals", "N total · M properties", "+ New proposal". Search + stage tabs
  (All / Prospect / Proposal / Exclusive Rep / Active / Under Contract / Sold / Lost —
  but user only wants light stages: New / Working / Archived). Table: PROPERTY (addr +
  submarket·units·type) · ASKING PRICE (+ date) · STAGE badge.
- **Record** (← Pipeline · {addr} · "{submkt} · {n} units" · Open OM · Stage badge).
  Tabs: **Overview · Due diligence · Comp analysis · Rent roll · Financials**.
  - Overview: PROPERTY INFO + OWNERSHIP (left) · PROPOSAL card (Stage, Asking price,
    Notes, Save) + STATED INCOME (Gross income, Op ex, Stated NOI) (right).
  - Due diligence: form cards — Roof, Heat source, Windows, Sewer line, Exterior/siding,
    Electrical panel, Plumbing, Water heaters, Foundation, Parking, RUBS, Sprinkler,
    Oil tanks, + notes.
  - **Comp analysis** (signature screen): filter row (Market, County, Sub-Market, Zip,
    Era, Date range, Unit range). MARKET STATS matrix — rows {Property count(Active/UC/
    Sold), $/Unit, $/SF, Cap Rate, GRM, Active DOM, Total DOM, Escrow} × cols {Market,
    Market+Era, County, County+Era, Sub-Mkt, Sub-Mkt+Era, Zip, Zip+Era}. Then COMPS
    table (Stats/Mktg checkboxes, Status, Property, Sub-Mkt, Units, Era, Listing/Pending/
    Sale dates, $/Unit, $/SF, Cap, GRM, Active DOM, Total DOM, Escrow).
  - Rent roll: KPI cards (Total Units, Occupied, Vacant, Occupancy, Avg Rent, Total Rent,
    Total RUBS, Total Market, Total UW Rent) + editable unit table (#, Unit#, Type, SF,
    Tenant, Status, Rent, RUBS, Recurring, Eff date, Move-in, Lease end, Lease type,
    Deposit, Pre-paid).
  - Financials: full operating-model spreadsheet (income line items → Other Income →
    EGR → vacancy → Total EGR → Operating Expenses…) across year columns (T12 / in-place
    / underwriting). The "excel model."
  - Financials also contains: ACQUISITION DETAILS (purchase price, down payment, loan
    amount/LTV, loan fees, closing costs, interest, amortization, term, IO, payment,
    DSCR); VALUE-ADD CAPEX + RESERVE CAPEX tables; MARKET PRICING BAND (floor / band low/
    high / aggressive / suggested list); INVESTOR RETURNS (purchase summary, Yr1 operating
    model, cash-on-cash, projected NOI by year, exit assumptions, refinance); VALUATION
    SCENARIOS (back-solve targets: Return %, $/unit, $/SF, cap, GRM, DSCR → Price).

## Restyle notes
- **The user dislikes the old design — redesign/restructure freely. The screenshots are
  the source of truth for CONTENT, DATA and WORKFLOW only, not for layout.** Collapse the
  empty thin-tab experiences into richer, scannable pages. Improve IA where it helps.
- Inputs that are user-entered show a soft amber/yellow fill in the source app
  ("Input / Selection" vs "Computed" columns). Keep that affordance (editable = tinted)
  but in EP tones.
- Computed/important figures in DM Serif; labels in Montserrat uppercase tracked.
- Positive=green (#1F7A3F), negative=burgundy/red. Selected scenario row = soft green.
- Keep dense data legible: tabular-nums, hairline row separators, sticky headers.

## First sketch scope (this pass), 2 variations on the list pages
1. Properties list — v1 dense table, v2 table + right detail preview
2. Property record · Overview (elevated)
3. Proposals list — v1, v2
4. Proposal · Comp analysis (elevated signature screen)
Then iterate deeper (Financials model, Rent roll, Returns) once direction is confirmed.
