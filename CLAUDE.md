# CRE App — Claude Code Project Brief

## Project Overview
Commercial real estate deal analysis web app for MethodMultifamily (Ben Ficker, Portland OR).
Covers the full acquisition workflow: property CRM → comp analysis → financial modeling → marketing materials.

**Live app:** https://cre-app-lac.vercel.app
**GitHub:** https://github.com/PDXInvest/cre-app
**Supabase:** https://azqoiryelockjtmdvozk.supabase.co

## Stack
- React + Vite (frontend)
- Supabase (database + auth + storage)
- Vercel (hosting)
- No TypeScript — plain JS/JSX

## Session Protocol
- Always `git pull` before making any changes
- Always commit and sync via VS Code Source Control at session end
- Run `npx vite build` to surface syntax/compilation errors when something seems broken

---

## Architecture — Property-First CRM Model

Properties are the top-level record. Everything else hangs off them.

```
Properties  (parent — permanent, synced from Salesforce CSV)
    └── Proposals  (child — one property can have many over time)
            └── Comp Selections  (which comps apply to this deal)
            └── Units / Rent Roll
            └── Monthly Financials
    └── Sale History  (comps where address matches this property — auto-queried, not stored separately)

Comps  (independent market database — shared across all proposals, linkable to properties via property_id)
```

---

## Current Build Status

### Completed (Phases A + B)
- Full React + Vite + Supabase + Vercel stack live
- `operatingModel.js` financial engine
- Oregon rent cap logic, stabilization engine, Investor Returns
- Comp Analysis tab with 8-column stats table
- Rent Roll tab with per-unit editing
- Financials tab: Income Statement, T-12 Monthly, Growth Assumptions, Operating Model sub-tab
- Investor Returns wired to projected NOI

### In Progress — Restructuring (Phase R)
Restructuring from proposal-first to property-first. See full spec below.

### Not Yet Started
- Phase C: Refi cash flows wired into IRR
- Draft OM: AI-powered PDF rent roll extraction
- Salesforce direct API sync (currently CSV import)

---

## Restructuring Spec (Phase R) — Build This Next

### What's changing
- Properties become first-class page with full CRM-style record
- Proposals become child records hanging off properties
- New navigation: Properties / Proposals / Comp Database

### Phase R1 — Supabase changes (do first, no code)
1. Add `property_id` nullable foreign key to `comps` table
2. Enable Supabase Storage, create `property-photos` bucket
3. Add `photos` text array column to `properties` table

### Phase R2 — New Properties page
**New file:** `src/pages/Properties.jsx`

List view (`/properties`):
- Searchable by address, owner name, owner LLC
- Columns: address, units, type, year built, last sale, active proposal stage
- "Import properties" CSV button (moved from Proposals.jsx)
- "+ New property" button for manual entry
- Click a row → full-page property record

Property record (`/properties/:id`):
- Breadcrumb: Properties / [address]
- Header: address, subtitle line, Edit button, New proposal button
- Five tabs: Overview, Market metrics, Sale history, Photos, Proposals

**Overview tab:**
- Property info card: type, units, year built, building SF, class, zoning, land area, tax ID
- Ownership card: owner LLC, contact name
- Sale history card: auto-queried from comps table where address matches. Badge: "auto-matched from comps"
- Recent proposals card: last 2-3 proposals with stage pill, clickable

**Market metrics tab:**
- Scope toggle pills: Market / County / Sub-market / Zip code (default: Sub-market)
- Era toggle checkbox: "Same era only" (default: checked)
- Comp count line: "Based on N sold comps · last 6 mo vs prior 6 mo"
- Thin-data warning if fewer than 5 comps at selected scope
- Four metric cards: Price per unit, Cap rate, GRM, Sales volume
- Each card: 6-month median value + YOY delta with directional arrow (green up, red down)
- YOY = last 6 months vs same 6-month window one year prior
- All calculated live from comps table

**Sale history tab:**
- Full table of all comp records matching this property address
- Columns: date, sale price, $/unit, $/SF, cap rate, GRM

**Photos tab:**
- Grid of uploaded photos
- Upload → Supabase Storage → save URL to properties.photos array

**Proposals tab:**
- All proposals for this property, columns: name, created date, asking price, stage
- Click → opens proposal detail

### Phase R3 — Refactor existing files

`Proposals.jsx` — remove:
- Property CSV import UI (moves to Properties.jsx)
- ProposalDetail component (extract to ProposalDetail.jsx)

`Proposals.jsx` — keep:
- Pipeline list view
- New proposal creation flow (update: pre-populate property when launched from property record)

New file: `src/pages/ProposalDetail.jsx`
- Pure extraction from current Proposals.jsx — no logic changes

`App.jsx` — updated routes:
```
/properties       → Properties list
/properties/:id   → Property record
/proposals        → Proposals pipeline
/proposals/:id    → Proposal detail
/comps            → Comp database
```

### Phase R4 — Intelligence layer (do last)
- Auto-match comps to properties on import: when comp address matches a properties record, write property_id FK
- Auto-filter comps when launching proposal from property: pre-set sub-market, era, unit range

---

## Key Files
- `src/pages/Properties.jsx` — NEW: property CRM list + full record
- `src/pages/Proposals.jsx` — pipeline list + new proposal flow (being refactored)
- `src/pages/ProposalDetail.jsx` — NEW: extracted from Proposals.jsx
- `src/pages/PropertyDashboard.jsx` — deal assumptions + investor returns (unchanged)
- `src/pages/Financials.jsx` — financials tab (unchanged)
- `src/pages/RentRoll.jsx` — rent roll tab (unchanged)
- `src/pages/CompDatabase.jsx` — comp database (unchanged)
- `src/utils/operatingModel.js` — financial engine (unchanged)
- `src/supabase.js` — Supabase client
- `src/App.jsx` — routing and nav

## Supabase Tables
- `properties` — property records (imported via Salesforce CSV)
- `proposals` — one per deal, child of property
- `comps` — shared market comp database (add property_id FK)
- `comp_selections` — per-proposal comp checkbox state
- `monthly_financials` — T-12 monthly income/expense data
- `units` — rent roll units (deleted and reinserted on every save)
- `app_settings` — app-level Growth Assumptions defaults (21 fields)

---

## Core Business Logic

### Market Metrics Calculation
- Scope options: market, property_county, sub_market, zip (fields on comps table)
- Era filter: year_built_era field, same era as subject property, toggleable
- Window: last 6 months vs same 6-month window one year prior (YOY)
- Thin data: fewer than 5 comps → show warning
- Metrics: median $/unit, median cap rate, median GRM, count of sales
- Same median logic already used in CompAnalysis tab

### Oregon Rent Cap
- Applied on each unit's lease anniversary month
- Key field: `rent_bump_cap` (NOT `annual_rent_cap`) in growth assumptions
- Vacant units start at market rent using the close date

### Stabilization Engine (operatingModel.js)
- Searches up to 40-year ceiling (prevents false Month 0 results)
- Property stabilizes when BOTH: all units ≥90% market rent AND all CapEx end months passed
- `unitStabMap` keyed by `sort_order` (NOT Supabase row ID)

### Operating Model
- `computeOpModel` runs on mount AND after RentRoll saves AND after Dashboard saves
- Layout: T-12 + Year 1 through sale-basis year

### Investor Returns
- Uses year-by-year projected NOI (not constant)
- Sale price = Year(exitYear+1) NOI ÷ going-out cap rate

### Growth Assumptions
- App-level defaults in `app_settings` table
- Per-proposal overrides on proposal record, displayed in purple
- Percentages as whole numbers (3.50 = 3.50%), stored as decimals

---

## Critical Bug Patterns

### `nv()` null handling
`Number(null) === 0` — not NaN. Must explicitly check null/undefined/empty string first.
```js
const nv = v => (v === null || v === undefined || v === '') ? null : Number(v)
```

### Supabase Pagination
Default 1,000-row limit. Always paginate with stable sort: `sale_date DESC nulls last, id ASC`

### `unitStabMap` Keying
Always key by `sort_order`, never by Supabase row `id`.

### Const Hoisting
`t12Months` is a `const` — define before any code that references it.

### CompAnalysis Tab Dependency
Bench stats must be computed in `ProposalDetail` on mount, not sourced from the tab component.

### `geoStats` Exclusion Flags
Treat as booleans, not numeric values.

### Date Parsing
Stored dates in `M/D/YYYY` format — use `parseSaleDate` helper for ISO comparisons.

### Era Filter Scope
Apply era filter per column, not to the base comp pool.

### Comp Edits Are Global
Editing a comp updates the shared `comps` table — affects all proposals.

### CSV Import
- Salesforce exports include UTF-8 BOM: `text.replace(/^\uFEFF/, '')`
- Column names change between versions — use fallback helper `g(row, newName, oldName)`

---

## Comp Analysis Scope
Active, Under Contract, and Sold statuses only. CAN/EXP/Withdrawn reserved for future market reports.