# Handoff: Method Multifamily — CRE App "Remodel"

## Overview
This package is the **design reference** for restyling/restructuring Method Multifamily's
multifamily-CRE brokerage web app. It is a brokerage deal platform: a system of record for
**Properties**, an underwriting/pricing/acquisition workspace for **Proposals**, a **Comp
Database**, and a **Market Snapshot** analytics surface. The proposal workspace also generates
the data for an **Offering Memorandum** (OM).

> **READ THIS FIRST — scope.** This is a **visual / layout remodel of an app that already
> exists and works.** All calculations, live recompute, business logic, and data connections
> (RMLS, Salesforce) **already exist in the production codebase.** The job is to **port the new
> layout, components, and design tokens onto the existing logic** — *not* to reimplement
> formulas, recompute, rent-roll math, the operating model, or data wiring. Do not reinvent the
> wheel. In particular the **Due Diligence**, **Rent Roll**, **Financials**, and **Acquisition
> Model** screens are **styling-only**: the live app already holds the complete, correct
> field/row/column structure — keep every field, row, and column; apply the new look.

## About the design files
The files in this bundle are **design references created in HTML** (React rendered in-browser
via Babel — there is **no build step**, this is a prototype). They show the intended look and
interaction, they are **not** production code to copy directly. Recreate these designs in the
target codebase's existing environment (its framework, component library, design-system
primitives, state, and data layer). If no front-end environment exists yet, pick the most
appropriate stack for the project and implement there. Treat the HTML/CSS as the **visual +
interaction spec**; treat the existing production app as the source of truth for **logic, math,
and data**.

To preview the prototype: open `CRE App.html` in a browser (it loads React + Babel from a CDN,
so it needs internet). `Market Snapshot.html` is the same Market Snapshot surface as a
standalone page.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate the UI
pixel-faithfully using the target codebase's libraries and patterns, matched to the tokens and
conventions below. Sample figures shown in the screens (e.g. "1842–1848 SE Ankeny St", cap rate
5.62%) are **illustrative placeholders** — the real values come from the live app's data/calcs.

---

## Architecture & Information Architecture

**One app, one shell.** A persistent dark **left sidebar** (`ApShell`) routes between four pages.
Each page does its own internal drill-in (list ↔ record/workspace) — there is no full-page
navigation between them; it's a single-page app with client state.

**Sidebar (`ApShell`)** — dark charcoal rail, fixed left.
- Brand: a burgundy "building-block" square mark + **"Method Multifamily"** / sub-label
  **"Brokerage"**. (This is a generic wordmark — do **not** use any proprietary third-party
  logo. Use the brand system from the production codebase.)
- Nav items (each = icon + label): **Properties · Proposals · Comp Database · Market Snapshot**.
  Active item: lighter background + a 3px burgundy accent bar on its left edge.
- Footer: user chip — avatar initials **"BF"** (burgundy circle) + **"Benjamin Ficker"** /
  "Principal Broker".
- **Collapse toggle** (discreet « button above the user chip): collapses the rail to a 66px
  **icon-only** strip (labels, brand text, user text hidden; icons + avatar remain; toggle shows
  »). Expanded width is 224px. The state **persists** (localStorage key `ap-collapsed`, "1"/"0")
  and is shared across pages. The main content area must **reflow** to fill the freed space when
  collapsed and fit when expanded (no horizontal overflow in either state).

**Pages & drill-ins:**
1. **Properties** — list (dense table) → click a row → single-page property **record**.
2. **Proposals** — list (pipeline) → click a row → underwriting **workspace** with 6 tabs.
3. **Comp Database** — list + side preview, click-to-edit fields, attachable photo.
4. **Market Snapshot** — analytics surface with three states: Board → Focus → Present.

---

## Screens / Views

### 1. Properties — List
- Header: eyebrow "System of record", serif H1 **"Properties"**, meta "{n} properties · Portland metro", a `btn-secondary` "Import properties" top-right.
- Toolbar: a search input ("Search by address, name, or owner…") + filter chips (Type / Units / Sub-market / Era) + right-aligned result count.
- Table columns: **Address** (address + city/zip sub-line) · **Units** · **Type** (Duplex/Triplex, Fourplex, 9–20 Units, 21–50 Units…) · **Yr built** · **Last sale** (price + date) · **Proposal** (— or a stage link). Dense rows, hairline separators, hover highlight, whole row clickable.

### 2. Properties — Record
- Hero: back link "← Properties", serif title (address), meta line "{city} · {n} units · {type}", actions "Edit" + "+ New proposal".
- Tabs: **Overview · Market metrics · Sale history · Photos · Proposals**.
  - **Overview**: two-column. Left = PROPERTY INFO card (Address, City/State, Sub-market, Market, Type, Total units, Building SF, Year built, Era, # buildings, Property class, Tax ID) + OWNERSHIP card (Owner LLC, Contact, Last sale date/price, Last $/unit, Last cap rate). Right rail = SALE HISTORY + PROPOSALS mini-lists / empty states.
  - **Market metrics**: scope toggle (Market / County / Sub-Market / Zip) + Era filter; four metric cards ($/Unit, Cap Rate, GRM, Volume). Mirrors the Market Snapshot logic.
  - Sale history / Photos / Proposals: list or empty states; Photos has an upload affordance.
- Properties is the **system of record for property facts** (building, geo, ownership), NOT the financial model.

### 3. Proposals — List (pipeline)
- Header: eyebrow "Underwriting pipeline", serif H1 "Proposals", meta "{n} deals in the model", "+ New proposal" primary button.
- Toolbar: search + **stage segmented tabs**. The product uses **light stages: All / New / Working / Archived** (these replace the old heavy CRM stages). The active segment is a dark pill; each shows a count.
- Table: **Property** (address + "submarket · units · type" sub-line) · **Asking price** (serif figure + date) · **Stage** badge. Stage badge colors: New = blue/info, Working = amber/warn, Archived = neutral grey. Row click opens the workspace.

### 4. Proposals — Workspace (the core)
Top bar: back "‹ Pipeline", serif title (address) + meta ("submarket · n units · type · era"), a **stage `<select>`**, and a primary **"Open OM →"** button (entry point to OM generation — see OM subsystem). Sub-nav tabs (burgundy underline on active):

**Tabs: Pricing · Acquisition Model · Comp analysis · Rent roll · Due diligence · Financials**

These two tabs are **two distinct functions of the deal model** and were deliberately split:

- **Pricing** *(the pricing engine — "what do we list/price this at")*:
  - Top: an **Income** card (Gross scheduled income, Operating expenses → **NOI**, with an income-source selector) beside a **"Deal vs comps" scorecard** — a vertical list of metrics (Cap rate, GRM, $/Unit, $/SF, DSCR) each with a value, a bar with the deal marker vs. the comp benchmark, and a +/- tag (green good / burgundy bad). A "Read" insight paragraph follows.
  - **Market benchmarks — Pre-1940** table: rows {Sold count, $/Unit, $/SF, Cap Rate, GRM} × columns {Market/MSA, County, Sub-Market, Zip}.
  - **Valuation scenarios** back-solve table: an "Asking price" row (highlighted) plus target rows (Return %, $/unit, $/SF, Cap rate, GRM, DSCR) — each lets you enter a target and shows the back-solved Price, $/Unit, $/SF, Cap, GRM, DSCR. DSCR cells color by coverage (≥ target green, below burgundy).
  - **Market pricing band**: five inputs (Investor floor / Market band low / Market band high / Aggressive list / Suggested list) above a horizontal band visualization with Floor / Suggested (emphasized burgundy) / Aggressive markers and a shaded market-band region.

- **Acquisition Model** *(buyer-side deal analysis — "what does this look like as a buyer")*:
  - **Acquisition details**: a label / **Input-or-Selection** / **Computed** three-column layout (Anticipated close date, Purchase price [selection], Down payment %, Loan amount [75% LTV], Loan fees %, Closing costs %, **Total acquisition costs**, Fixed interest rate, Amortization, Loan term, Interest-only period, Amortizing payment, Interest-only payment, **DSCR**).
  - **Value-add capex** + **Reserve / replacement capex**: two tables (Description / Cost est. / Start mo. / End mo. + Total + "+ Add row").
  - **Investor returns**: a 4-stat strip (Cash invested, Year-1 cash flow, Cash-on-cash, Going-in cap) + Purchase summary + Exit assumptions (editable) + a "Projected NOI by year" table (Year / EGR / Expenses / NOI, exit year highlighted).
  - **Refinance**: "Include refinance" checkbox + summary.

- **Comp analysis** (signature screen): a filter row (Market, County, Sub-Market, Zip, Era, Date range, Unit range) + a **MARKET STATS matrix** — rows grouped by {Property count(Active/UC/Sold), $/Unit, $/SF, Cap Rate, GRM, Active DOM, Total DOM, Escrow} × columns {Market, Market+Era, County, County+Era, Sub-Mkt, Sub-Mkt+Era, Zip, Zip+Era}; the "+Era" columns get a faint tint. Then a **COMPS** table (Stats/Mktg checkboxes, Status, Property, Sub-Mkt, Units, Era, Listing/Pending/Sale dates, $/Unit, $/SF, Cap, GRM, Active DOM, Total DOM, Escrow).

- **Rent roll** *(styling-only)*: a KPI strip (Total Units, Occupied, Vacant, Occupancy, Avg Rent, Total Rent, Total RUBS, Total Market, Total UW Rent) + Add unit / Save / **Import from PDF** + an editable unit table. Columns: #, Unit #, Unit type, SF, Tenant, Status, Rent, RUBS, Recurring, Eff. date, Move-in, Lease end, Lease type, Deposit, Pre-paid. Editable cells are inputs/selects.

- **Due diligence** *(styling-only)*: captured on the seller discovery call; **merges into the OM**. A two-column grid of **component cards, each with its own discrete fields** (these are individual data fields that wire into documents — not one free-text box): **Roof** (Type / Year installed / Notes) · **Heat source** (Type / Install-age / Notes) · **Windows** (Type-style / Install-age / Notes) · **Sewer line** (Type / Install-age / Notes) · **Exterior/siding** · **Electrical panel** (Type-brand / …) · **Plumbing** · **Water heaters** (Count-type / …) · **Foundation** (Type / Notes) · **Parking** (Surface type / Count / Ratio) · **RUBS** (Type / Notes) · **Sprinkler** (Type-notes) · **Oil tanks** (Present [select] / Decommissioned [select] / Notes) + a **Due diligence notes** textarea + **Import inspection PDF** + Save. Fields are blank by default (filled live on the call).

- **Financials** *(styling-only — the full operating model)*: four sub-tabs.
  - **Income Statement** — a **Full / Summary** toggle + **Import from PDF**. A wide spreadsheet with a **sticky first column** and seven scenario columns: **2023 · 2024 · 2025 · T-12 (period label) · Scheduled · Stabilized · Market**. Sections (Rental revenue, Other income, Effective gross revenue, Operating expenses) with every line item (Market Rent, Loss-to-Lease, Collected Rent, RUBS, Parking, Storage, Property Taxes, Insurance, Utilities, Property Management, R&M, Landscaping, Turnover, Capital Reserves, Security, Contract Services, Advertising, Payroll, Misc, …), subtotals, **Net Operating Income**, Capital Improvements, Cash Flow. Year columns are **manual-entry / PDF-extracted inputs**; T-12 = blue tint; Scheduled/Stabilized/Market = purple tint (computed projections). Summary view collapses to subtotal rows.
  - **T-12 Monthly Detail** — same row structure × 12 month columns; "+ Add custom row" per section; Back/Advance-a-month controls; Import from PDF.
  - **Growth Assumptions** — Assumption / **Default** / **This proposal** (editable) / **Effective** rows, grouped Revenue / Operating expenses.
  - **Operating Model** — a per-unit rent schedule (Unit / Current / Market / % Mkt / Stab month / Yr1–Yr5) + an annual pro forma (Line item × T-12 / Year 1–5 / Year 6 sale-basis), with a "Recompute" action and a stabilization note.

### 5. Comp Database
- Header "Comp database", count, "+ Update comps". A KPI strip (Total comps, Showing, Sold comps, Median $/unit, Median GRM, Median cap, Med Active DOM, Med Total DOM, Med Escrow). Search + status/sub-market/type selects. A wide table (Property, Status, Sub-market, Units, Era, Listing/Pending/Sale dates, Sale price, Sold $/unit, GRM, Cap). Redesigned as **list + side preview**: clicking a comp opens a preview with **click-to-edit fields** and an attachable **photo** (drag-drop `image-slot.js`).

### 6. Market Snapshot (folded into the shell)
Renders **inside** the sidebar shell (no separate top-bar). Shared state (metric, timeframe, split-by) persists across three states:
- **Filter strip** (two rows): Row 1 = scope chips (County, Sub-Market, Zip, Units, Era) + a **Window** timeframe segmented control (30/90/180/365); Row 2 = "Refine" (Terms, Buyer) on the left and **Saved views / + Compare / Present** buttons flush right.
- **"Right now" strip** — a dark collapsible bar: Active listings, Under contract, Months of supply, each with sub-metrics; a "Show deal stats" expand toggle; a matched-count meta on the right.
- **Board**: left = a 3-column grid of metric tiles ($/Unit, $/SF, Cap Rate, GRM, Ask→Sold, Active DOM, Total DOM, Escrow, No. Sold, No. Listed, Sale Volume, Cash Share) each with value, Δ vs prior + YoY, and a sparkline; right = a detail panel for the selected metric (big figure, deltas, quarterly trend line chart with optional comparison series, a split-by pill row + comparison bars, and a "Read" insight). "⤢ Open full focus" → Focus.
- **Focus**: a left metric rail (grouped Pricing / Velocity / Volume) + a large focus pane (big figure, split-by pills, full trend chart with legend, and a footer of summary cells).
- **Present**: an editorial/export layout (dateline "Method Multifamily · Market Intelligence", metric pills, a hero figure + insight + chart card, supporting metric cells, and a branded footer). Has an export bar (Copy image / PNG / PDF / Add to report) and a "Back to board" link. (In the shell the standalone top-bar is suppressed.)

---

## Interactions & Behavior
- **Routing/state**: sidebar nav sets the active page; clicking a list row sets a drill-in id (record/workspace); back links clear it. Workspace/snapshot tabs are local state. No URL routing in the prototype — the production app can use its own router.
- **Sidebar collapse**: toggling animates width 224px ⇄ 66px (transition ~0.18s); persisted in localStorage; content reflows (no overflow either way).
- **Editable affordance**: any user-entered value is tinted **amber** (fill `#FBF6E9`, border `#E8DCBE`); computed values are plain. Click-to-edit fields (Comp DB) hover grey / focus amber. Inputs/selects in tables use the same amber.
- **Responsive within the shell**: flexible grid columns must use `min-width: 0` so they shrink to the available width rather than overflowing (this was the key fix to make the Snapshot and workspace fit beside the sidebar).
- **Selected/active states**: active nav item (burgundy left bar), active metric tile (burgundy border + soft shadow), selected scenario row (soft green), positive deltas green, negative deltas burgundy/red.
- **Import from PDF**: appears on Rent roll, Due diligence, and Financials — in production this triggers the existing PDF-extract pipeline that populates the fields.

## State Management (prototype) — map onto the production app's real state
- `page` (Properties | Proposals | Comp Database | Market Snapshot), `propId`, `dealId` (drill-in).
- Workspace `tab`; Financials sub-tab + Income Statement Full/Summary view.
- Market Snapshot `view` (board|focus|present), `metricKey`, `tf`, `split`.
- `ap-collapsed` (localStorage). All sample data is illustrative; in production these screens read/write the existing models.

## Design Tokens
Defined in `cre-snapshot-base.css` `:root`. **Type:** Montserrat (UI; Gotham substitute) + DM Serif Display (figures/titles, the serif numerals). No monospace.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#A51123` | burgundy — primary accent, used **sparingly** |
| `--accent-2` | `#C3243A` | burgundy hover/secondary |
| `--red` | `#E20A24` | bright red (rare) |
| `--ink` | `#15161A` | primary text / dark sidebar bg / primary buttons |
| `--ink-2` | `#2A2C33` | secondary text |
| `--slate` | `#5A5E68` | muted text/labels |
| `--mute` | `#9CA0AB` | tertiary/muted |
| `--mute-2` | `#BFC2CA` | faint |
| `--paper` | `#FAFAF5` | warm page background |
| `--surface` | `#FFFFFF` | cards/surfaces |
| `--hairline` | `#E8E6DF` | hairline borders/separators |
| `--hairline-2` | `#D8D6CC` | stronger hairline |
| `--tint` | `#F4E6E8` | burgundy tint fills |
| `--pos` | `#1F7A3F` | positive / good (green) |
| `--warn` | `#B8841F` | amber/warning (editable accent) |
| `--neg` | `#9F2A1C` | negative / bad |
| `--info` | `#2A5DB0` | informational (blue) |
| editable fill | `#FBF6E9` | amber input background |
| editable border | `#E8DCBE` | amber input border |
| `--r-sm / --r / --r-md / --r-lg` | 4 / 6 / 8 / 12 px | border radii |

Conventions: important/computed figures in DM Serif Display; labels in Montserrat **uppercase, tracked** (letter-spacing ~0.1–0.16em); tabular-nums for all figures; hairline row separators; sticky headers on wide tables.

## Assets
- **Fonts**: Montserrat + DM Serif Display (Google Fonts in the prototype; use the codebase's font pipeline in production).
- **Logo**: a CSS-drawn burgundy "building-block" square mark — a placeholder wordmark, **not** a real logo. Use the production brand system.
- **`image-slot.js`**: a drag-and-drop photo placeholder web component (used in Comp Database). Replace with the codebase's upload component.
- **Icons**: simple inline SVG paths (sidebar nav). No icon library dependency.
- No raster images are required by the core app.

## Related subsystem — Offering Memorandum (OM)
The OM is **generated**, not authored in the app: the Proposal app **emits JSON**, which is
pasted into a **templated HTML** file to render the OM asset (the "Open OM →" button is the
entry point). The OM is **not** a sidebar route. The templated renderer + sample OM live in the
main project (`Offering Memorandum (Templated).html`, `om-data.js`, `om-render.jsx`,
`om-templates.jsx`, and the `OM Templated Handoff/` folder) — pull those in if the remodel needs
to touch OM generation.

## Files in this bundle
**Entry points**
- `CRE App.html` — the working clickable app (open this). `Market Snapshot.html` — standalone Snapshot.

**Styles**
- `cre-snapshot-base.css` — design tokens (`:root`) + shared chrome (top bar, buttons, filter chips).
- `cre-snapshot.css` — Market Snapshot view styles (board / focus / present / now-strip).
- `cre2.css` — app shell (`.ap-*`, sidebar + collapse), Properties list/record (`.pl-` / `.pr-`).
- `cre2-proposals.css` — proposal workspace (`.uw-`), comp matrix (`.cm-`), comp DB (`.cdb-`), rent roll (`.rr-`), due diligence (`.dd-`), financials spreadsheet (`.fin-`), acquisition model (`.acq-`).

**Components (React via Babel)**
- `cre2-shared.jsx` — `ApShell` (sidebar + collapse + `ApNavContext`) + sample property data.
- `cre2-properties.jsx` — `PropertiesList`, `PropertyRecord`.
- `cre2-proposals.jsx` — `ProposalsList`, `ProposalWorkspace` (tab host; Pricing tab content = income+scorecard+benchmarks+scenarios+pricing band).
- `cre2-acqmodel.jsx` — `AcquisitionModel`, `MarketBenchmarks`, `PricingBand`.
- `cre2-comps.jsx` — `CompMatrix` (comp-analysis tab).
- `cre2-proptabs.jsx` — `RentRoll`.
- `cre2-duediligence.jsx` — `DueDiligence`.
- `cre2-financials.jsx` — `Financials` shell + `IncomeStatement`.
- `cre2-fin-tabs.jsx` — `T12Detail`, `GrowthAssumptions`, `OperatingModel`.
- `cre2-compdb.jsx` — `CompDatabase`.
- `cre2-snapshot.jsx` — `MarketSnapshotPage` (folds the Snapshot into `ApShell`).
- `ms-data.jsx` / `ms-charts.jsx` / `ms-views.jsx` — Snapshot data, charts (line/spark/bars), views.
- `cre2-clickable.jsx` — orchestrator (page + drill-in state, wires callbacks, renders into `#app`).
- `image-slot.js` — drag-drop photo web component.

**Companion docs**
- `HANDOFF.md` — running status + structure + file map (project history).
- `app-spec.md` — original screen/field inventory captured from the existing app's screenshots (content/data/workflow source of truth).

## Suggested implementation order
1. Tokens + `ApShell` (sidebar, collapse, routing) — the foundation every screen sits in.
2. List + preview/record pattern (Properties, Comp Database).
3. Proposal workspace shell + tabs; port **Pricing** and **Acquisition Model** onto the existing deal math.
4. Re-skin the styling-only screens (Rent roll, Due diligence, Financials) onto the existing models — preserve every field/row/column.
5. Fold in Market Snapshot.
Throughout: wire to the existing logic/data; do not rebuild calculations or connections.
