# CRE App — Layout Remodel: Claude Code Handoff

**Project:** Method Multifamily CRE App
**Repo:** github.com/PDXInvest/cre-app
**Stack:** React + Vite + Supabase + Vercel
**This document supersedes the prototype's README/HANDOFF where they conflict with the decisions below.**

---

## Files in this handoff package

This document is the lead. Everything else is the **visual + interaction spec** — reference for building, not code to copy. Suggested: drop the whole bundle into a temporary `/design-remodel-spec/` folder in the repo, with this doc as the entry point; delete the folder once the remodel lands.

**Lead**
- `CRE_App_Remodel_Handoff.md` — this document. Decisions, scope boundaries, build order. Read first.

**Styles (the source of the look — port into the app's styling system)**
- `cre-snapshot-base.css` — design tokens (`:root`) + shared chrome. **Most important.**
- `cre2.css` — app shell (`.ap-`), Properties list/record (`.pl-` / `.pr-`).
- `cre2-proposals.css` — workspace (`.uw-`), comp matrix (`.cm-`), comp DB (`.cdb-`), rent roll (`.rr-`), due diligence (`.dd-`), financials (`.fin-`), acquisition model (`.acq-`).
- `cre-snapshot.css` — Market Snapshot view styles.

**Components (layout/structure reference only — rebuild in real Vite components, do NOT copy)**
- `cre2-shared.jsx` — `ApShell` (sidebar/collapse) + sample data.
- `cre2-properties.jsx` — `PropertiesList`, `PropertyRecord`.
- `cre2-proposals.jsx` — `ProposalsList`, `ProposalWorkspace` (tab host + Pricing tab).
- `cre2-acqmodel.jsx` — `AcquisitionModel`, `MarketBenchmarks`, `PricingBand`.
- `cre2-comps.jsx` — `CompMatrix` (comp-analysis tab).
- `cre2-proptabs.jsx` — `RentRoll`.
- `cre2-duediligence.jsx` — `DueDiligence`.
- `cre2-financials.jsx` — `Financials` shell + `IncomeStatement`.
- `cre2-fin-tabs.jsx` — `T12Detail`, `GrowthAssumptions`, `OperatingModel`.
- `cre2-compdb.jsx` — `CompDatabase` (the editable-record remodel — see §5).
- `cre2-snapshot.jsx` — `MarketSnapshotPage` (folds Snapshot into shell).
- `ms-charts.jsx` / `ms-views.jsx` — Snapshot charts + views.
- `ms-data.jsx` — **interim data contract for Snapshot (see §7). Shape is spec; numbers are throwaway.**

**Treat specially**
- `image-slot.js` — drag-drop photo web component. **Reference only — replace with the codebase's existing upload component.** Do not ship the web component into the React/Vite app.
- `CRE App.html` / `Market Snapshot.html` — prototype entry points (script wiring + CDN React). Not load-bearing for the build; included as context / to preview the prototype.

**Background docs (fuller field/workflow inventory — secondary to this doc)**
- `README.md` — most complete screen-by-screen description.
- `app-spec.md` — original field/workflow inventory from the app's screenshots.
- `HANDOFF.md` — prototype project history + file map.

**NOT included (intentionally) — these are test/running data, not remodel spec:**
- `Web_App_Test_Property_Record_Data.csv`, `Web_App_Test_Data.csv`, `Financial_Analysis_Example.xlsx`, and the `OM*.pdf` sample memoranda. Layout work does not need them.

---

## 0. Read this first — what this job is and is not

This is a **visual + structural layout remodel of an app that already exists and works.** All calculations, the operating-model engine, IRR/equity-multiple math, the PDF-extraction pipeline, the OM generation pipeline, and all data wiring **already exist in the production codebase and are correct.** Your job is to port the new **layout, components, and design tokens** onto the existing logic.

**Do NOT:**
- Reimplement any formula, recompute logic, rent-roll math, the operating model, or IRR/returns math.
- Rebuild the OM generation pipeline (see §6 — it is out of scope and already built).
- Bake in any of the prototype's hardcoded sample numbers (cap rates, NOI projections, the entire Market Snapshot dataset). Every value comes from existing state/calcs/data.
- Copy the prototype's React-via-Babel code directly. It is a **visual spec**, not production code. Recreate it in the real Vite/Supabase stack with the existing component patterns, state, and data layer.

**The prototype files are the source of truth for:** look, layout, component structure, interaction model, design tokens.
**The existing production app is the source of truth for:** logic, math, data, fields.

A note on the prototype's CSS comments: several headers say "EQUITY PACIFIC." That is a stale prototype label. The brand is **Method Multifamily** everywhere.

---

## 1. Design tokens & brand

Port the token set from `cre-snapshot-base.css` `:root` into the app's styling system (CSS variables / design-system primitives — match the existing approach in the repo).

- **Type:** Montserrat (UI) + DM Serif Display (figures/titles). No monospace.
- **Accent:** burgundy `#A51123`, used sparingly. Hover `#C3243A`.
- **Neutrals:** ink `#15161A`, ink-2 `#2A2C33`, slate `#5A5E68`, mute `#9CA0AB`, mute-2 `#BFC2CA`.
- **Surfaces:** paper `#FAFAF5`, surface `#FFFFFF`, hairline `#E8E6DF`, hairline-2 `#D8D6CC`, tint `#F4E6E8`.
- **Semantic:** pos green `#1F7A3F`, neg `#9F2A1C`, warn/amber `#B8841F`, info blue `#2A5DB0`.
- **Editable affordance:** amber fill `#FBF6E9`, amber border `#E8DCBE`. **Any user-entered value is tinted amber; computed values are plain.** This is a load-bearing convention across the whole app.
- Radii: 4 / 6 / 8 / 12 px.
- Conventions: computed/important figures in DM Serif; labels Montserrat uppercase, tracked (~0.1–0.16em); tabular-nums on all figures; hairline separators; sticky headers on wide tables.

Brand mark is a CSS-drawn burgundy square placeholder — keep using a generic mark, not a proprietary logo.

---

## 2. App shell (`ApShell`) — the foundation

A persistent dark charcoal left sidebar; single-page app with client state (use the app's existing router/state — no full-page nav between sections).

- Brand block: burgundy square + "Method Multifamily" / sub-label "Brokerage".
- Nav items (icon + label): **Properties · Proposals · Comp Database · Market Snapshot.** Active item: lighter bg + 3px burgundy left-edge bar.
- Footer user chip: "BF" avatar (burgundy) + "Benjamin Ficker" / "Principal Broker".
- **Collapse toggle:** collapses rail 224px ⇄ 66px icon-only. State persists (localStorage `ap-collapsed`, "1"/"0") and is shared across pages. Main content must reflow with no horizontal overflow in either state.
- **Critical layout fix to carry over:** flexible grid columns use `min-width: 0` so they shrink to available width rather than overflow. This is what makes the workspace and Snapshot fit beside the sidebar.

Build order recommendation: tokens + shell first, then list/record patterns, then the proposal workspace, then re-skin the styling-only screens, then fold in Snapshot.

---

## 3. Properties (mostly styling)

- **List:** dense table — Address (+ city/zip sub-line) · Units · Type · Yr built · Last sale (price + date) · Proposal (— or stage link). Search + filter chips (Type/Units/Sub-market/Era) + result count. Whole row clickable → record. Keep existing filter logic; port the look.
- **Record:** single-page restructure. Hero (back link, serif address title, meta, Edit + New proposal). Two-column body: left = Property facts card + Ownership card; right = Market context (scope toggle Market/County/Sub-Market/Zip + 4 metric cards) + Proposals mini-list + Sale history mini-list. Properties remains the **system of record for property facts**, not the financial model. Market-context metrics come from existing market logic.

---

## 4. Proposals

### 4a. List (pipeline)
Header + "+ New proposal". Search + **stage segmented tabs**. Table: Property (+ submarket·units·type sub-line) · Asking price (serif + date) · Stage badge.

**STRUCTURAL — Stage simplification (8 → 3).** The product moves to three light stages: **New / Working / Archived.** Migrate existing data with this mapping:

| Old stage | New stage |
|---|---|
| Prospect | New |
| Proposal | Working |
| Exclusive Rep | Working |
| Active | Working |
| Under Contract | Working |
| Sold | Archived |
| Lost | Archived |

Badge colors: New = info/blue, Working = warn/amber, Archived = neutral grey.

> **Open consideration (not a blocker):** folding both Sold and Lost into Archived loses the won/lost distinction. If pipeline reporting needs it, add a separate `outcome` field (won/lost/shelved) alongside the 3-stage `status`. Confirm with Ben before migrating; otherwise proceed with the table above.

### 4b. Workspace — tabs
Top bar: back "‹ Pipeline", serif address title + meta, stage `<select>`, primary **"Open OM →"** button (entry point only — see §6). Sub-nav tabs with burgundy underline on active:

**Pricing · Acquisition Model · Comp analysis · Rent roll · Due diligence · Financials**

**STRUCTURAL — the deal model splits into two sibling tabs.** Today these live together; they are deliberately separated:

- **Pricing** (list/price engine): Income card (Gross scheduled income, Operating expenses → NOI, income-source selector) + "Deal vs comps" scorecard (Cap rate, GRM, $/Unit, $/SF, DSCR — each a value + bar with deal marker vs comp benchmark + good/bad tag) + "Read" insight + Market benchmarks table (Sold count/$ per Unit/$ per SF/Cap/GRM × Market/County/Sub-Market/Zip) + Valuation scenarios back-solve table (Asking row highlighted; target rows Return %/$ per unit/$ per SF/Cap/GRM/DSCR; DSCR cells color by coverage) + Market pricing band (5 inputs + band viz with Floor/Suggested/Aggressive markers).
- **Acquisition Model** (buyer-side): Acquisition details (label / Input-or-Selection / Computed three-column layout) + Value-add capex + Reserve capex tables + Investor returns (4-stat strip + Purchase summary + Exit assumptions + Projected NOI by year) + Refinance (Include-refinance checkbox + summary).

Both tabs read from the **same existing deal calc objects** — this is a presentation reorganization, not new math. Confirm the existing model state can feed two tabs cleanly; share state at the workspace level so switching tabs never recomputes or loses input.

### 4c. Styling-only tabs — preserve every field/row/column
These re-skin onto existing models. Keep all fields/rows/columns; apply tokens; keep the amber editable affordance and the Import-from-PDF buttons (they trigger the existing extraction pipeline).

- **Comp analysis:** filter row + MARKET STATS matrix (Property count/$ per Unit/$ per SF/Cap/GRM/Active DOM/Total DOM/Escrow × Market/Market+Era/County/County+Era/Sub-Mkt/Sub-Mkt+Era/Zip/Zip+Era; +Era columns faintly tinted) + COMPS table (Stats/Mktg checkboxes, full column set).
- **Rent roll:** KPI strip + Add unit / Save / Import from PDF + editable unit table (full column set: #, Unit #, Type, SF, Tenant, Status, Rent, RUBS, Recurring, Eff date, Move-in, Lease end, Lease type, Deposit, Pre-paid).
- **Due diligence:** two-column grid of component cards, each with its **own discrete fields** (Roof, Heat source, Windows, Sewer line, Exterior/siding, Electrical panel, Plumbing, Water heaters, Foundation, Parking, RUBS, Sprinkler, Oil tanks) + notes textarea + Import inspection PDF + Save. These fields feed downstream documents/OM — they are individual data fields, not one free-text box.
- **Financials:** four sub-tabs. Income Statement (Full/Summary toggle, Import from PDF, sticky first column, 7 scenario columns: 2023/2024/2025/T-12/Scheduled/Stabilized/Market; year cols = manual/PDF inputs; T-12 = blue tint; projections = purple tint). T-12 Monthly Detail (12 month cols + Add custom row + Back/Advance month). Growth Assumptions (Default/This proposal/Effective). Operating Model (per-unit rent schedule + annual pro forma + Recompute + stabilization note). All math lives in the existing engine.

---

## 5. Comp Database — STRUCTURAL (table → editable record)

This is the most significant change after the stage split. **The comp stops being a row in a spreadsheet and becomes an editable record, structurally parallel to a Property.**

- **Layout:** list + side preview (same `pl-split` primitive as Properties). Left = lightweight scannable list (name, sub-market · units · era, price, $/unit · status). Click → preview/record panel on the right.
- **Record panel:** sections — Sale (status, date, price, sold $/unit, $/SF), Returns & velocity (cap, GRM, units, era, Active/Total DOM, escrow, sub-market), Notes. Plus an attachable **photo** (drag-drop; replace the prototype's `image-slot.js` web component with the codebase's existing upload component).
- **Inline click-to-edit:** each field is click-to-edit (hover grey / focus amber). Edits write to the **shared `comps` table** (affects all proposals' comp pool — this is the intentional shared-asset design). Consider a subtle "edits apply everywhere" cue.
- **KPI strip + filters:** reskin the existing computed aggregates (Total comps, Showing/filtered count, Sold comps, Median $/unit, Median GRM, Median cap, Med Active/Total DOM, Med Escrow). Keep existing filter/search logic; port the look.

### Build the comp as a FULL record, not a thin view of the CSV
Long-game: this app eventually **becomes the standalone comp database** once Ben moves off Salesforce. So build the comp record to hold the **complete field set** even if CSV import only populates some of it today. Do not make the record a thin projection of whatever columns the current Salesforce export happens to include.

### Data feed & write paths (current reality)
- Comps are fed by **CSV import** today (eventually a direct Salesforce connection — not now).
- Use the established CSV resilience pattern: UTF-8 BOM strip (`text.replace(/^\uFEFF/, '')`), header trim, and the `g(row, newName, oldName)` fallback for column names that drift between Salesforce exports.
- **Inline editing is capability-in-waiting, not a daily workflow.** Ben does little-to-no manual editing right now; the editable-record model is forward-looking infrastructure for the eventual move off Salesforce.

### CSV-merge conflict behavior — DEFERRED (documented TBD)
Two write paths (bulk CSV import + manual inline edit) can in principle conflict (re-import overwriting a hand-edit). **This is deliberately deferred** — it only becomes a live concern when Ben starts relying on manual edits, which coincides with the eventual transition off Salesforce. Do **not** build merge/conflict logic now. For the remodel: inline edits write to the shared `comps` table; CSV import behaves as it does today. Leave a clear marker in the import pipeline noting the merge rule is a future decision tied to the Salesforce-exit transition.

---

## 6. Offering Memorandum — OUT OF SCOPE (already built)

Do **not** rebuild or modify OM generation. The templated OM pipeline already exists (built recently): the proposal serializes to JSON (`omSerialize.js`), saves to Supabase (`proposals.om_json`), and a separate templated renderer at `/om` displays/exports it. The OM is **not** a sidebar route.

For this remodel, the only OM-related work is **styling the "Open OM →" button** on the proposal workspace as the entry point, exactly as the prototype shows. Everything behind that button is existing, working, and off-limits.

---

## 7. Market Snapshot — STRUCTURAL (net-new UI, data deferred)

Build the full Snapshot UI now; **wire to real data later.**

- Renders **inside** the shell as the 4th route (no separate top-bar). Shared state (metric, timeframe, split-by, view) persists across the three states.
- **Three states:** Board (metric-tile grid + detail panel with trend chart + split bars + insight) → Focus (metric rail + large focus pane) → Present (editorial/export layout). Filter strip (scope chips + Window timeframe control) + collapsible "Right now" strip.
- Charts: line / sparkline / comparison bars (the `ms-charts` components — measure their container so text never distorts).

### Why the data is deferred (do not wire now)
Snapshot's metrics ($/unit, cap, GRM, DOM, volume) are **comp-derived aggregates.** The comp module's fields are still in motion (stabilizing on the CSV-import shape now; shifting again at the eventual Salesforce cutover). Wiring Snapshot now would bind analytics to a moving target and force a rebuild. Sequence: finish the comp module → stabilize comp fields → then wire Snapshot.

### Build against a documented data-binding seam
The prototype's entire Snapshot dataset (`ms-data.jsx` — 12 metrics, 20 quarters, split factors) is **fabricated placeholder data.** Build the UI against a clearly-defined placeholder data shape, isolated behind a single **data-binding layer** so the eventual real wiring (and later Salesforce field shifts) touches one well-marked seam, not the whole UI. Treat the shape of `ms-data.jsx` as the **interim data contract**:

- Each metric: `{ key, group (Pricing|Velocity|Volume), name, fmt, downIsGood, series[20 quarters], (optional ask[] comparison) }`.
- Derived helpers (timeframe window means, deltas, comparison series/bars) consume that shape.
- When real comp-derived data is wired, it must either produce this shape or the binding layer reshapes to it.

Do not scatter the placeholder numbers through components — keep them in the one data module so they're trivially swappable.

---

## 8. Decisions locked in this session (summary)

1. **Stages:** migrate 8 → 3 per the mapping table in §4a. (Optional `outcome` field flagged for Ben to confirm.)
2. **Deal model:** split into Pricing + Acquisition Model tabs, both reading existing calc objects.
3. **OM:** out of scope; keep existing templated pipeline; style the "Open OM →" entry button only.
4. **Comp Database:** restyle into editable list+record; full field set; CSV-fed; edits → shared `comps` table; inline editing is capability-in-waiting.
5. **CSV-merge logic:** deferred to the eventual move-off-Salesforce; do not build now.
6. **Market Snapshot:** build full Board→Focus→Present UI now; defer data wiring (comp-derived) behind a documented binding seam.

## 9. Open items to confirm before/while building
- Won/lost distinction: add an `outcome` field, or accept Sold+Lost → Archived as-is?
- Confirm the existing deal-model state can cleanly feed the two split tabs without recompute on tab switch.
- Identify the existing upload component to replace the prototype's `image-slot.js`.
