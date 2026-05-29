# Method Multifamily CRE App — Handoff

_Last updated: end of this session. Read `app-spec.md` alongside this for the full screen/field inventory._

## What this project is
Redesigning a multifamily CRE brokerage web app into the **Method Multifamily** brand language.
Original app was reviewed from ~30 user screenshots (now captured in `app-spec.md`). The user
**did not like the old design** — we are restructuring, not reskinning. Screenshots are the
source of truth for **content/data/workflow only**, never layout.

## Design system (Method Multifamily)
- Type: **Montserrat** (Gotham substitute) for UI; **DM Serif Display** for figures/titles. No monospace.
- Color: burgundy `#A51123` + red `#E20A24` used **sparingly** as accents on charcoal/warm-grey
  monochrome. Warm paper `#FAFAF5`, surface white, hairline `#E8E6DF`. Pos green `#1F7A3F`, neg `#9F2A1C`.
- Tokens live in `cre-snapshot-base.css` (`:root`). Wordmark = burgundy "building block" square +
  "Method Multifamily" (NOT their proprietary logo — user said don't use it).
- Conventions: editable fields tinted amber (`#FBF6E9`), computed values plain; figures in serif,
  labels in tracked uppercase caps.

## Deliverables (HTML files)
1. **`CRE App.html`** — THE working clickable app. Left sidebar routes Properties / Proposals /
   Comp Database internally; Market Snapshot & Offering Memos link out. Orchestrator = `cre2-clickable.jsx`.
2. **`Market Snapshot.html`** — standalone analytics prototype (Board → Focus → Present), fully
   interactive (metric switch, timeframe, split-by comparisons). Files: `ms-*.jsx`, `cre-snapshot*.css`.
3. **`CRE App — Redesign.html`** — design-canvas of the static sketches (reference only; heavy to load).

## File map (all React-via-Babel, loaded by `<script type="text/babel">`)
- `cre-snapshot-base.css` — tokens + app chrome (topbar, sidebar buttons, btns, filter chips).
- `cre2.css` — app shell (.ap-), property list/record (.pl- / .pr-).
- `cre2-proposals.css` — underwriting workspace (.uw-), comp matrix (.cm-), comp db (.cdb-).
- `cre2-shared.jsx` — `ApShell` (sidebar + `ApNavContext` for routing), `AP_PROPS` sample data.
- `cre2-properties.jsx` — `PropertiesList` (dense table → click row → list+preview), `PropertyRecord`.
- `cre2-proposals.jsx` — `ProposalsList` (New/Working/Archived), `ProposalWorkspace` (Model tab:
  income+financing inputs, live "deal vs comps" scorecard, valuation back-solve scenarios).
- `cre2-comps.jsx` — `CompMatrix` (market-stats grid) + `ProposalComps` wrapper.
- `cre2-compdb.jsx` — `CompDatabase` (list + side preview, `<image-slot>` photo, click-to-edit fields).
- `cre2-clickable.jsx` — orchestrator: page + drill-in state, wires callbacks.
- `image-slot.js` — drag/drop photo web component (used by Comp Database).
- Market Snapshot: `ms-data.jsx` (12 metrics, 20q history, timeframe stats, splits), `ms-charts.jsx`
  (MSLine/MSSpark/MSCmpBars), `ms-views.jsx` (Board/Focus/Present + chrome), `ms-app.jsx`.
- `cre2-proptabs.jsx` — `RentRoll` (KPI strip + editable unit table: #, Unit#, Type, SF, Tenant,
  Status, Rent, RUBS, Recurring, Eff/Move-in/Lease-end dates, Lease type, Deposit, Pre-paid; Add unit /
  Save / Import-from-PDF).
- `cre2-duediligence.jsx` — `DueDiligence`: 2-col grid of component cards, each with its own discrete
  fields (Roof, Heat source, Windows, Sewer line, Exterior/siding, Electrical panel, Plumbing, Water
  heaters, Foundation, Parking, RUBS, Sprinkler, Oil tanks) + notes + Import inspection PDF.
- `cre2-financials.jsx` — `Financials` shell (4 sub-tabs) + `IncomeStatement` (Full/Summary toggle,
  Import-from-PDF, all line items × 7 scenario columns 2023/2024/2025/T-12/Scheduled/Stabilized/Market).
- `cre2-fin-tabs.jsx` — `T12Detail` (12 month columns + Add-custom-row), `GrowthAssumptions`
  (Default/This-proposal/Effective), `OperatingModel` (per-unit rent schedule + annual pro forma Yr1–Yr6).

## DONE
- Brand realign to Method Multifamily across everything.
- Market Snapshot: 3 focusing models explored → settled on hybrid (Board→Focus→Present), built clickable.
- Properties: list (dense → click-row preview w/ market context) + restructured single-page record.
- Proposals: list + underwriting workspace (inputs + scorecard + valuation scenarios) + comp-analysis matrix.
- Comp Database: reconfigured from table → list + side preview, attachable photo, click-to-edit fields.
- Unified clickable app with sidebar routing + drill-in; verified end-to-end.
- **Remaining Proposal tabs built (restyle only — full field/row/column inventory preserved from the
  live app, matched against the user's screenshots):** Rent roll, Due diligence (component cards w/ their
  own fields), Financials (Income Statement Full+Summary, T-12 Monthly Detail, Growth Assumptions,
  Operating Model). Editable cells use the EP amber affordance; PDF-import affordances included.

## LEFT TO DO (next sessions)

> **READ FIRST — this is a visual / layout restructuring spec.** All calculations, live recompute,
> business logic, and data connections (RMLS / Salesforce) **already exist and work in the live app.**
> Port the **layout, components, and design tokens** onto the existing logic. **Do not** reimplement
> formulas, recompute, or data wiring — don't reinvent the wheel.

1. ~~Fold Market Snapshot into the sidebar shell~~ **DONE** — Market Snapshot now renders inside `ApShell`
   as the 4th routed page (`cre2-snapshot.jsx` → `MarketSnapshotPage`, reusing the `ms-*` view components
   with their standalone top-bar suppressed). Board → Focus → Present all live in the shared sidebar.
   The standalone `Market Snapshot.html` still exists for presenting on its own.
2. **Make search & filters actually filter** the lists (Properties, Proposals, Comp Database). Optional
   polish for the prototype — the live app already filters.
3. ~~Build remaining Proposal tabs~~ **DONE** — Rent roll, Due diligence, Financials all built. **These
   two are STYLING ONLY:** the live app already holds the complete, correct field/row/column structure.
   The prototype mirrors that structure (verified against the screenshots); Claude Code should **apply
   the new EP styling to the existing screens — keep every field, row, and column; do not remove, rename,
   summarize, or re-order.** Note the data is **manually entered OR populated via PDF upload + extraction**
   (keep the Import-from-PDF affordance + amber editable cells); Due-diligence fields are discrete and
   feed downstream documents / the OM.
4. ~~Wire recompute in the Model~~ **Not needed** — the underwriting math already works in the live app.
   Prototype shows representative figures only.
5. **Offering Memos — decided:** the Proposal app **generates JSON**, which is pasted into the templated
   HTML file (`Offering Memorandum (Templated).html` / `OM Templated Handoff/`) to render the OM asset.
   It is **not** a sidebar route. "Open OM" on a proposal is the entry point to that generate flow.
6. ~~Connect to real data~~ **Out of scope here** — RMLS / Salesforce wiring lives in the live app's backend.

## Bringing to Claude Code
Plan is to export this and have Claude Code update the real codebase against it. When ready, invoke the
**"Handoff to Claude Code"** skill — it packages a developer handoff. Key things Claude Code should know:
- These are static design prototypes (React via in-browser Babel, no build step). Treat them as the
  **visual + interaction spec**, not production code — port the layouts/components/tokens into the real stack.
- **Due diligence & Financials are styling-only.** The live app's field/row/column inventory is the source
  of truth and is already correct — apply the new look, preserve the data model. Inputs are manual entry
  or PDF-extracted; keep that.
- The design system tokens and component patterns (ApShell sidebar, list+preview, the underwriting
  scorecard, click-to-edit, image-slot) are the reusable pieces.
- `app-spec.md` = content/field inventory; this file = status + structure.
