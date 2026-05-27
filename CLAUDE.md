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

### Completed (Phases A + B + R + C + PDF + OM)
- Full React + Vite + Supabase + Vercel stack live
- `operatingModel.js` financial engine
- Oregon rent cap logic, stabilization engine, Investor Returns
- Comp Analysis tab with 8-column stats table
- Rent Roll tab with per-unit editing
- Financials tab: Income Statement, T-12 Monthly, Growth Assumptions, Operating Model sub-tab
- Investor Returns wired to projected NOI
- Property-first CRM model with full restructuring complete (Phase R1–R4)
- Properties page: list view, property records with Overview/Market Metrics/Sale History/Photos/Proposals tabs
- ProposalDetail extracted as standalone routed page
- URL-based routing: `/properties/:id`, `/proposals/:id`
- CSV import moved to Properties page
- Auto-match comps to properties on import via `sf_property_id`
- Auto-filter comp analysis when launching proposal from property
- Phase C: Refi cash flows wired into IRR — appraised value basis (NOI / refi cap rate), DSCR-constrained loan sizing, variable debt service in levered IRR and equity multiple, cash-out proceeds at refi year
- PDF extraction: "Import from PDF" on Rent Roll, T-12 Monthly, and Income Statement tabs — uploads PDF → Claude API extracts structured data → preview/mapping screen → user confirms → writes to Supabase
- Offering Memorandum builder: standalone HTML page at `/om` with 36-page template, sidebar TOC, image slots, tweaks panel

### Not Yet Started
- OM wired to Supabase (currently uses localStorage, not database)
- Salesforce direct API sync (currently CSV import)

---

## Restructuring (Phase R) — Completed

Property-first CRM model restructuring, completed in four phases:

- **R1**: Supabase schema — `property_id` FK on comps, `property-photos` storage bucket, `photos` array on properties
- **R2**: Properties page — list view with search, property records with 5 tabs (Overview, Market Metrics, Sale History, Photos, Proposals), edit modal, photo upload
- **R3**: File extraction — ProposalDetail.jsx extracted from Proposals.jsx, CSV import moved to Properties, URL-based routing (`/properties/:id`, `/proposals/:id`), "New proposal" button on property records with pre-population
- **R4**: Intelligence layer — auto-match comps to properties on import via `sf_property_id`, comp analysis auto-filters from property attributes

### Routes
```
/                 → redirects to /proposals
/proposals        → Proposals pipeline
/proposals/:id    → Proposal detail
/properties       → Properties list
/properties/:id   → Property record
/comps            → Comp database
/om               → Offering Memorandum builder (standalone HTML, not React)
/om?view=client   → Client view (read-only, no editor chrome)
```

---

## Key Files
- `src/App.jsx` — routing and nav (all routes defined here)
- `src/pages/Properties.jsx` — property CRM list + full record (5 tabs) + CSV import
- `src/pages/Proposals.jsx` — proposal pipeline list + new proposal flow
- `src/pages/ProposalDetail.jsx` — proposal detail (overview, due diligence, comp analysis, rent roll, financials tabs)
- `src/pages/PropertyDashboard.jsx` — deal assumptions + investor returns
- `src/pages/Financials.jsx` — financials tab (income statement, T-12, growth assumptions, operating model)
- `src/pages/RentRoll.jsx` — rent roll tab with per-unit editing
- `src/pages/CompDatabase.jsx` — comp database with CSV import + auto-match to properties
- `src/utils/operatingModel.js` — financial engine
- `src/utils/pdfExtract.js` — PDF extraction client helpers + category code constants
- `src/components/PdfImportButton.jsx` — shared "Import from PDF" upload button
- `src/components/PdfPreviewRentRoll.jsx` — rent roll PDF preview/edit modal
- `src/components/PdfPreviewFinancials.jsx` — T-12 / Income Statement PDF mapping modal
- `api/extract-pdf.js` — Vercel Serverless Function (Claude API proxy for PDF extraction)
- `src/supabase.js` — Supabase client
- `public/om/index.html` — Offering Memorandum builder (standalone HTML/CSS/JS, 36 pages)
- `public/om/image-slot.js` — drag-and-drop image slot web component
- `public/om/tweaks-app.jsx` — OM tweaks panel (accent color, font, orientation)
- `public/om/tweaks-panel.jsx` — tweaks panel UI shell

## Supabase Tables
- `properties` — property records (imported via Salesforce CSV), includes `photos` text array
- `proposals` — one per deal, child of property via `property_id`
- `comps` — shared market comp database, linked to properties via `property_id` FK (auto-matched on import)
- `comp_selections` — per-proposal comp checkbox state
- `monthly_financials` — T-12 monthly income/expense data
- `units` — rent roll units (deleted and reinserted on every save)
- `app_settings` — app-level Growth Assumptions defaults (21 fields)
- `proposal_dashboard` — per-proposal dashboard data (stated income, acquisition, investor returns)

### Supabase Storage
- `property-photos` — public bucket for property photos

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

### Refinance (PropertyDashboard.jsx)
- Appraised value = projected NOI at refi month ÷ refi cap rate
- Refi loan = min(LTV × appraised value, DSCR-constrained max loan)
- Cash-out proceeds = new loan − old balance − refi fees
- Levered IRR uses variable DS: acquisition DS pre-refi, refi DS post-refi
- Refi year cash flow includes cash-out proceeds
- Exit remaining balance uses whichever loan is active at exit year

### PDF Extraction
- Architecture: browser → Vercel Serverless Function (`api/extract-pdf.js`) → Claude API (`claude-sonnet-4-20250514`) → structured JSON
- API key: `ANTHROPIC_API_KEY` set in Vercel env vars (not VITE_ prefix — server-side only)
- Three extraction types: `rent_roll`, `t12_monthly`, `income_statement`
- Prompts use semantic field matching — identifies fields by meaning, not exact label (handles any management company format)
- Prompts include CRITICAL instruction: every PDF line item must appear mapped or unmapped, never silently dropped
- Rent Roll merge behavior: matches imported units to existing by unit number; only fills in blank fields (never overwrites existing data); appends new unit numbers. Uses `mergeRentRollUnits()` in `pdfExtract.js`.
- T-12 Monthly: supports partial-year imports and multi-statement stitching (e.g., Jan-Dec 2025 + Jan-Mar 2026 YTD)
  - Deep merge at code level within each month — codes not in import are preserved
  - Only months with at least one non-zero value are imported (empty months excluded)
  - `t12_end_month` set to last month with actual data, not PDF's declared period end
  - Conflict detection: warns when importing months that already have data, with "Skip existing months" toggle
  - Multiple sequential uploads merge correctly (React `setData(prev => ...)` ensures no state race)
- Income Statement: year selector lets user redirect data to a different year before confirming
- All rows have editable category dropdowns (not just flagged ones) — grouped by section matching Financials.jsx order
- Duplicate category detection: when multiple PDF items map to the same code, amounts are summed and a blue info banner appears
- Unmapped items highlighted yellow; user assigns via dropdown or skips
- Nothing writes to database until user clicks "Confirm Import"
- Max PDF size: 10MB client-side check; Vercel function timeout: 60s (Pro plan)

### Offering Memorandum Builder (`/om`)
- Standalone HTML page served from `public/om/`, not a React component
- Script paths must be absolute (`/om/image-slot.js`) — relative paths get caught by the SPA rewrite and serve React's index.html instead
- 36 pages across 4 groups: Offering Memorandum (18), Proposal (7), Marketing Collateral (9), Outreach (2)
- Sidebar TOC: collapsible sections, page checkboxes (include/exclude from print), drag-and-drop reorder, inline rename
- Image slots: `<image-slot>` custom web component with shadow DOM, drag-and-drop upload, reframe (pan/zoom), replace/remove controls on hover
- Tweaks panel: accent color, heading font, landscape/portrait toggle, postcard size — uses React + Babel Standalone (in-browser transpilation)
- Client view: `?view=client` strips editor chrome, hides internal pages, disables image editing
- Text editing: all headings/paragraphs have `contenteditable` in editor mode
- State persistence: localStorage (page order, disabled pages, titles, image data, sidebar collapse)
- Not yet wired to Supabase — data lives in localStorage only

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