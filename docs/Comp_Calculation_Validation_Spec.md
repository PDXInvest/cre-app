# Sales Comp Calculation — Validation Spec

**Purpose:** the source-of-truth definition for every metric in the comps app, plus golden test cases pulled from the real dataset so the calculations can be verified automatically instead of by eyeballing the app against Excel.

**How to use this with Claude Code:**
1. Have Claude Code implement/confirm each metric per the **Definition** and **Guard rules** below.
2. Have it write unit tests asserting the app reproduces every value in the **Golden test cases** tables (input → expected). These are Excel's own computed outputs — true ground truth.
3. Run the **Aggregate scenarios** (Section 7) to validate the median/count layer, which is what your manual filter-testing checks.
4. Keep your final filter-level spot-check in the app — but per-row math will already be locked.

**Conventions used throughout:**
- A metric returns **null/blank (not 0)** whenever a required input is missing. Aggregations must *exclude* nulls, never treat them as 0.
- Cap rates, GRM, and ratios are **decimals** (0.0574 = 5.74%; 0.94 = 94%). Apply ×100 only for display.
- Day counts are **integer differences between dates**.
- Two boolean exclusion flags suppress income metrics: `X-NOI` (TRUE → no cap rate), `X-AGI` (TRUE → no GRM).

Column letters refer to the **Web App Comps Export** sheet. Source mapping: NOI = col AB, AGI = col Z, X-NOI = col AC, X-AGI = col AA, Listing Price = T, Original Listing Price = S, Sale Price = U, Units = V, Building SF = G, Listing Date = J, Pending Date = K, Sale Date = L.

---

## 1. Price per Unit

| | Asking | Sold |
|---|--------|------|
| **Definition** | Listing Price ÷ Units | Sale Price ÷ Units |
| **Formula** | `T / V` | `U / V` |
| **Null rule** | null if Listing Price or Units missing | null if Sale Price or Units missing |
| **Output** | dollars per unit | dollars per unit |

**Golden test cases**

| Metric | Listing/Sale Price | Units | Expected |
|--------|-------------------:|------:|---------:|
| AskPriceUnit | 199,900 | 2 | 99,950 |
| AskPriceUnit | 200,000 | 2 | 100,000 |
| AskPriceUnit | _(blank)_ | 6 | **null** |
| SoldPriceUnit | 198,400 | 2 | 99,200 |
| SoldPriceUnit | 200,000 | 2 | 100,000 |

---

## 2. Price per SF

| | Asking | Sold |
|---|--------|------|
| **Definition** | Listing Price ÷ Building SF | Sale Price ÷ Building SF |
| **Formula** | `T / G` | `U / G` |
| **Null rule** | null if price or SF missing | null if price or SF missing |
| **Output** | dollars per SF | dollars per SF |

**Golden test cases**

| Metric | Price | Building SF | Expected |
|--------|------:|------------:|---------:|
| AskPriceSF | 199,900 | 1,736 | 115.1497695852… |
| AskPriceSF | 200,000 | 2,624 | 76.2195121951… |
| SoldPriceSF | 198,400 | 1,736 | 114.2857142857… |
| SoldPriceSF | 200,000 | 2,624 | 76.2195121951… |

> Assert with tolerance (e.g. `abs(actual-expected) < 1e-6`); do not round-trip through formatted strings.

---

## 3. Cap Rate

| | Asking | Sold |
|---|--------|------|
| **Definition** | NOI ÷ Listing Price | NOI ÷ Sale Price |
| **Formula** | `AB / T` | `AB / U` |
| **Guard** | null if `X-NOI = TRUE` **or** price missing | null if `X-NOI = TRUE` **or** price missing |
| **Output** | decimal (0.0616 = 6.16%) | decimal |

**Golden test cases**

| Metric | NOI | Price | X-NOI | Expected |
|--------|----:|------:|:-----:|---------:|
| AskCap | 15,390 | 250,000 | FALSE | 0.06156 |
| AskCap | 24,280 | 239,500 | FALSE | 0.1013778706… |
| AskCap | 18,216 | 635,000 | **TRUE** | **null** |
| SoldCap | 15,390 | 225,000 | FALSE | 0.0684 |
| SoldCap | 24,280 | 232,000 | FALSE | 0.1046551724… |

---

## 4. GRM (Gross Rent Multiplier)

| | Asking | Sold |
|---|--------|------|
| **Definition** | Listing Price ÷ AGI | Sale Price ÷ AGI |
| **Formula** | `T / Z` | `U / Z` |
| **Guard** | null if `X-AGI = TRUE` **or** price missing | null if `X-AGI = TRUE` **or** price missing |
| **Output** | multiple (e.g. 7.94) | multiple |

> AGI = Adjusted/Annual Gross Income (col Z). GRM divides price by income — note this is the **inverse** orientation of cap rate (price/income vs income/price).

**Golden test cases**

| Metric | Price | AGI | X-AGI | Expected |
|--------|------:|----:|:-----:|---------:|
| AskGRM | 200,000 | 25,200 | FALSE | 7.9365079365… |
| AskGRM | 250,000 | 18,780 | FALSE | 13.3120340788… |
| AskGRM | 339,900 | 10,236 | **TRUE** | **null** |
| SoldGRM | 200,000 | 25,200 | FALSE | 7.9365079365… |
| SoldGRM | 225,000 | 18,780 | FALSE | 11.9808306709… |

---

## 5. Days-on-Market / Timing

All return **integer day counts**. Null if any required date is missing.

| Metric | Definition | Formula | Notes |
|--------|------------|---------|-------|
| **ActDOM** | Today − Listing Date | `TODAY() − J` | ⚠️ depends on current date — pass an explicit **as-of date** in code for reproducible tests. Computed for every listing; the dashboard restricts to Active status. |
| **PENDaysToUC** | Pending − Listing | `K − J` | Days from list to under-contract. |
| **SoldDaysToUC** | Pending − Listing | `K − J` | ⚠️ **identical formula to PENDaysToUC** — does *not* use Sale Date. Only the downstream status filter differs. Verified equal on all 6,362 populated rows. |
| **SoldEscrowLength** | Sale − Pending | `L − K` | Time in escrow. |
| **SoldTotalDOM** | Sale − Listing | `L − J` | Full list-to-close. |

**Identity (use as a unit test):** when J, K, L all present,
`SoldTotalDOM = SoldDaysToUC + SoldEscrowLength`. Verified on all 6,261 rows where all three dates exist.

**Golden test cases**

| Metric | Listing (J) | Pending (K) | Sale (L) | Expected |
|--------|-------------|-------------|----------|---------:|
| PENDaysToUC | 2017-02-15 | 2017-03-13 | — | 26 |
| PENDaysToUC | 2018-07-02 | 2018-07-12 | — | 10 |
| SoldEscrowLength | — | 2017-03-13 | 2017-04-04 | 22 |
| SoldEscrowLength | — | 2018-07-12 | 2018-07-23 | 11 |
| SoldTotalDOM | 2017-02-15 | — | 2017-04-04 | 48 |
| SoldTotalDOM | 2018-07-02 | — | 2018-07-23 | 21 |

(Row 1 check: 26 + 22 = 48 ✓.  Row 2 check: 10 + 11 = 21 ✓.)

---

## 6. Ask-to-Sold Ratio

| | |
|---|---|
| **Definition** | Sale Price ÷ **Original** Listing Price |
| **Formula** | `U / S` |
| **Null rule** | null if Sale Price or Original Listing Price missing |
| **Output** | decimal (0.94 = sold at 94% of original ask) |

> ⚠️ Uses **Original Listing Price (col S)**, not the current Listing Price (col T) used by every Ask-side metric. Confirm the app uses the original.

**Golden test cases**

| Sale Price (U) | Original List (S) | Expected |
|---------------:|------------------:|---------:|
| 198,400 | 199,900 | 0.9924962481… |
| 200,000 | 200,000 | 1.0 |

---

## 7. Aggregate (dashboard) scenarios

The dashboard tiles are **`MEDIAN`** (or `SUM` for Sale Volume) of a per-row metric over a filtered set. To validate the aggregation layer, reproduce these. Each scenario filters **Sold** records by County / Sub-Market / Zip / Unit range / Year-Built-Era and a **Sale Date window** anchored to an as-of date.

These values were computed by applying the documented formulas to the dataset **as of 2026-06-10**. To reproduce in Excel: set the filters, and temporarily anchor the window to the same as-of date (the live sheet uses `TODAY()`). To reproduce in code: pass `as_of = 2026-06-10` and `window_start = as_of − window_days`.

Filters common to all three: Sub-Market = All, Zip = all, Units 2–1000, YBE = All. Aggregation = median except Sale Volume = sum; nulls excluded.

| Metric | A: Multnomah, 365d | B: Multnomah, 730d | C: Washington, 730d |
|--------|-------------------:|-------------------:|--------------------:|
| Window start | 2025-06-10 | 2024-06-10 | 2024-06-10 |
| **Sold Count** | 311 | 641 | 162 |
| Median $/Unit | 235,000 | 237,500 | 257,500 |
| Median $/SF | 236.02 | 239.05 | 251.09 |
| Median Cap | 0.05739 | 0.05725 | 0.05623 |
| Median GRM | 12.049 | 12.678 | 13.728 |
| Median SoldDaysToUC | 57 | 54 | 31.5 |
| Median Escrow | 39 | 37 | 40 |
| Median Total DOM | 106 | 101 | 82.5 |
| Sale Volume (sum) | 706,783,666 | 1,496,713,421 | 909,458,249 |
| Median Ask-to-Sold | 0.9402 | 0.9511 | 0.9642 |

> Median of an even-count set = average of the two middle values (hence the .5 day counts). Make sure the app's median matches Excel's `MEDIAN` (not a "lower median").

**Window semantics for prior-period / YOY tiles** (if the app reproduces them):
- Current window: `Sale_Date >= as_of − W`
- Prior window: `as_of − 2W <= Sale_Date < as_of − W`  (half-open)
- YOY window: `as_of − 365 − W <= Sale_Date < as_of − 365`  (half-open)

Match the half-open boundaries exactly to avoid double-counting edge dates.

---

## 8. Known issues to confirm (not necessarily bugs)

1. **SoldDaysToUC = PENDaysToUC** — same formula (list→pending), no Sale Date involved. If the app's "Sold Days to UC" is meant to measure something different, it diverges from Excel.
2. **Ask-to-Sold uses Original list price (S), not current (T).**
3. **ActDOM uses today's date** — non-deterministic; pin an as-of date in tests.
4. Dashboard tile labeled **"Active DOM"** is actually sourced from **SoldDaysToUC**, not active DOM — likely a label error.
5. **Total Count** on the dashboard hard-codes the range to row 7942; counts beyond that row are dropped as data grows.
6. **"Cash Share"** dashboard tile has no underlying formula yet.
7. **"Terms" filter** is collected but unused by any metric.

---

*Companion files: `Comp_Calculations_Reference.md` (per-column formula detail) and `Dashboard_Calculations_Reference.md` (full dashboard formula detail).*
