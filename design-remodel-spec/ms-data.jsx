/* ============================================================
   MARKET SNAPSHOT — data model + helpers
   12 metrics, each with 20 quarters of history (Q1·21 – Q4·25),
   timeframe-derived headline + deltas, comparison split factors,
   and an editorial insight line. Numbers are illustrative
   (SE Portland 2–4 unit, pre-1940) — wire to RMLS later.
   ============================================================ */

const MS_QUARTERS = [
  "Q1·21","Q2·21","Q3·21","Q4·21","Q1·22","Q2·22","Q3·22","Q4·22",
  "Q1·23","Q2·23","Q3·23","Q4·23","Q1·24","Q2·24","Q3·24","Q4·24",
  "Q1·25","Q2·25","Q3·25","Q4·25",
];

/* timeframe → how many trailing quarters define the "current window" */
const MS_TF_WIN = { "30d": 1, "90d": 1, "180d": 2, "365d": 4 };
const MS_TF_LABEL = { "30d": "30 days", "90d": "90 days", "180d": "180 days", "365d": "12 months" };
const MS_TF_PRIOR = { "30d": "prior 30d", "90d": "prior 90d", "180d": "prior 180d", "365d": "prior year" };
const MS_TF_N = { "30d": 3, "90d": 8, "180d": 15, "365d": 31 };

/* Comparison dimensions — "split by". A two-way split shows the metric's
   primary series (accent) against a derived comparison series (muted). */
const MS_SPLITS = [
  { key: "asksold",   label: "Asking vs Sold",        primary: "Sold",        comp: "Asking",        factor: 1.03 },
  { key: "cash",      label: "Cash vs Financed",      primary: "Financed",    comp: "All cash",      factor: 0.965 },
  { key: "buyer",     label: "Owner-occ vs Investor", primary: "Investor",    comp: "Owner-occ",     factor: 1.02 },
  { key: "county",    label: "vs County",             primary: "This filter", comp: "County avg",    factor: 0.945 },
  { key: "submarket", label: "vs Sub-market",         primary: "This filter", comp: "Sub-market",    factor: 0.985 },
  { key: "era",       label: "vs Era",                primary: "Pre-1940",    comp: "All eras",      factor: 1.045 },
];

const MS_METRICS = [
  {
    key: "ppu", group: "Pricing", name: "$ / Unit", focusName: "Sold Price per Unit",
    eyebrow: "Pricing · Median", fmt: "k$", dFmt: "pct", downIsGood: false,
    series: [298,305,312,322,331,348,358,366,362,355,349,346,352,358,355,349,344,340,339,337],
    ask:    [305,311,319,330,340,357,368,378,377,372,365,360,364,369,366,361,357,354,353,355],
    insight: "Per-unit pricing has cooled __dPrior__ off its 2022 peak as financed buyers reprice debt — but stock here still clears above the metro.",
  },
  {
    key: "psf", group: "Pricing", name: "$ / SF", focusName: "Sold Price per SF",
    eyebrow: "Pricing · Median", fmt: "$", dFmt: "pct", downIsGood: false,
    series: [300,305,310,316,322,330,336,340,338,335,331,329,332,335,333,330,328,326,325,324],
    ask:    [308,313,318,324,330,338,344,348,347,344,340,338,340,343,341,338,336,334,333,332],
    insight: "Price per square foot has held remarkably flat — buyers are underwriting on income, not size, in this vintage pool.",
  },
  {
    key: "cap", group: "Pricing", name: "Cap Rate", focusName: "Median Cap Rate",
    eyebrow: "Pricing · Median", fmt: "%", dFmt: "bps", downIsGood: false,
    series: [4.70,4.78,4.85,4.92,5.00,5.05,5.12,5.18,5.22,5.28,5.33,5.40,5.44,5.48,5.52,5.56,5.58,5.60,5.61,5.62],
    insight: "Cap rates have widened __dYoY__ over the year as buyers demand more yield — Southeast pre-war stock now prices ahead of the broader pool.",
  },
  {
    key: "grm", group: "Pricing", name: "GRM", focusName: "Gross Rent Multiplier",
    eyebrow: "Pricing · Median", fmt: "x", dFmt: "x", downIsGood: true,
    series: [14.0,13.9,13.8,13.8,13.7,13.6,13.6,13.5,13.4,13.4,13.3,13.2,13.2,13.1,13.1,13.0,13.0,12.9,12.9,12.8],
    insight: "Gross rent multiples have compressed to 12.8× — the cheapest entry on income in three years as rents catch up to price.",
  },
  {
    key: "asksold", group: "Pricing", name: "Ask→Sold", focusName: "Asking → Sold Spread",
    eyebrow: "Pricing · Negotiation", fmt: "dpct", dFmt: "pts", downIsGood: false,
    series: [-0.8,-1.0,-1.1,-1.2,-1.4,-1.6,-1.8,-1.9,-2.0,-2.2,-2.4,-2.6,-2.7,-2.9,-3.0,-3.1,-3.2,-3.3,-3.3,-3.4],
    insight: "Sellers are conceding more at the table — the gap between ask and sold has widened to −3.4%, the most buyer-friendly in the cycle.",
  },
  {
    key: "activedom", group: "Velocity", name: "Active DOM", focusName: "Active Days on Market",
    eyebrow: "Velocity · Median", fmt: "d", dFmt: "d", downIsGood: true,
    series: [92,90,89,88,86,84,82,79,76,74,72,70,68,66,65,64,63,62,62,61],
    insight: "Listings are moving faster — active days on market are down to 61, the tightest in two years.",
  },
  {
    key: "dom", group: "Velocity", name: "Total DOM", focusName: "Total Days on Market",
    eyebrow: "Velocity · Median", fmt: "d", dFmt: "d", downIsGood: true,
    series: [128,126,124,122,120,118,116,112,108,106,104,102,98,96,94,93,91,90,89,87],
    insight: "From list to close, deals are running __dYoY__ faster year-over-year — a sign demand is absorbing quality stock quickly.",
  },
  {
    key: "escrow", group: "Velocity", name: "Escrow", focusName: "Escrow Length",
    eyebrow: "Velocity · Average", fmt: "d", dFmt: "d", downIsGood: true,
    series: [58,57,56,55,54,53,52,50,49,48,47,46,45,45,44,44,43,43,43,43],
    insight: "Escrows are closing in 43 days on average — clean, well-underwritten deals with fewer financing hiccups.",
  },
  {
    key: "nsold", group: "Volume", name: "No. Sold", focusName: "Closed Sales",
    eyebrow: "Volume · Count", fmt: "int", dFmt: "int", downIsGood: false,
    series: [5,6,5,7,6,7,8,7,6,7,8,7,9,8,7,8,7,8,7,8],
    insight: "Transaction count is holding steady — liquidity in this niche has not dried up despite higher rates.",
  },
  {
    key: "nlisted", group: "Volume", name: "No. Listed", focusName: "New Listings",
    eyebrow: "Volume · Count", fmt: "int", dFmt: "int", downIsGood: true,
    series: [16,15,15,14,15,14,13,13,12,12,11,12,11,10,10,11,10,10,9,9],
    insight: "New supply keeps thinning — fewer owners are listing, tightening the pool of quality pre-war fourplexes.",
  },
  {
    key: "volume", group: "Volume", name: "Sale Volume", focusName: "Sale Volume",
    eyebrow: "Volume · Dollars", fmt: "$M", dFmt: "pct", downIsGood: false,
    series: [9.2,10.1,9.8,11.0,10.6,11.4,12.0,11.6,11.2,12.1,12.7,12.0,13.4,12.9,12.4,13.1,12.7,13.6,13.1,14.2],
    insight: "Dollar volume is back near cycle highs — bigger, cleaner assets are trading even as unit pricing softens.",
  },
  {
    key: "cashshare", group: "Volume", name: "Cash Share", focusName: "Cash Buyer Share",
    eyebrow: "Volume · Mix", fmt: "pct", dFmt: "pts", downIsGood: false,
    series: [24,25,26,27,28,29,30,31,32,33,34,35,35,36,36,37,37,38,38,38],
    insight: "Cash now makes up 38% of closings — buyers are sidestepping debt costs entirely to win in a thin market.",
  },
];

/* ---- formatting ---- */
function msFmt(v, t) {
  switch (t) {
    case "k$":   return "$" + Math.round(v) + "k";
    case "$":    return "$" + Math.round(v);
    case "%":    return v.toFixed(2) + "%";
    case "x":    return v.toFixed(1) + "×";
    case "d":    return Math.round(v) + "d";
    case "int":  return "" + Math.round(v);
    case "$M":   return "$" + v.toFixed(1) + "M";
    case "pct":  return Math.round(v) + "%";
    case "dpct": return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
    default:     return "" + v;
  }
}

const msMean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

/* current / prior / yoy window means for a timeframe */
function msStats(m, tf) {
  const s = m.series, n = s.length, w = MS_TF_WIN[tf] || 1;
  const cur   = msMean(s.slice(n - w));
  const prior = msMean(s.slice(Math.max(0, n - 2 * w), n - w));
  const yoyW  = s.slice(Math.max(0, n - w - 4), n - 4);
  const yoy   = yoyW.length ? msMean(yoyW) : prior;
  return { cur, prior, yoy };
}

/* format a delta between two values per the metric's delta style */
function msDelta(m, a, b) {
  const d = a - b;
  let txt, dir;
  switch (m.dFmt) {
    case "pct": { const p = b ? (d / Math.abs(b)) * 100 : 0; txt = (p >= 0 ? "+" : "") + p.toFixed(1) + "%"; break; }
    case "bps": txt = (d >= 0 ? "+" : "") + Math.round(d * 100) + " bps"; break;
    case "x":   txt = (d >= 0 ? "+" : "") + d.toFixed(1) + "×"; break;
    case "d":   txt = (d >= 0 ? "+" : "") + Math.round(d) + "d"; break;
    case "int": txt = (d >= 0 ? "+" : "") + Math.round(d); break;
    case "pts": txt = (d >= 0 ? "+" : "") + d.toFixed(1) + " pts"; break;
    default:    txt = (d >= 0 ? "+" : "") + d.toFixed(1);
  }
  const up = d > 0.0001, down = d < -0.0001;
  if (!up && !down) dir = "flat";
  else dir = ((up && !m.downIsGood) || (down && m.downIsGood)) ? "pos" : "neg";
  const arrow = up ? "▲" : down ? "▼" : "■";
  return { txt, dir, arrow };
}

/* derived comparison series for a split dimension */
function msCompSeries(m, splitKey) {
  const sp = MS_SPLITS.find((s) => s.key === splitKey);
  if (!sp) return null;
  if (splitKey === "asksold" && m.ask) return { label: sp.comp, primaryLabel: sp.primary, data: m.ask };
  return { label: sp.comp, primaryLabel: sp.primary, data: m.series.map((v) => v * sp.factor) };
}

/* comparison bars (Subject vs other geographies/cohorts) for the active split */
function msCompBars(m, tf, splitKey) {
  const { cur } = msStats(m, tf);
  const sp = MS_SPLITS.find((s) => s.key === splitKey) || MS_SPLITS[3];
  const rows = [
    { label: sp.primary === "This filter" ? "This filter set" : sp.primary, mult: 1.0, accent: true },
    { label: sp.comp, mult: sp.factor },
  ];
  if (["county", "submarket", "era"].includes(splitKey)) {
    rows.push({ label: "Metro · all 2–4u", mult: 0.92 });
    rows.push({ label: "Inner east · pre-40", mult: 1.03 });
  }
  const max = Math.max(...rows.map((r) => Math.abs(cur * r.mult)));
  return rows.map((r) => {
    const val = cur * r.mult;
    return { label: r.label, val: msFmt(val, m.fmt), pct: Math.round((Math.abs(val) / max) * 100), accent: !!r.accent };
  });
}

Object.assign(window, {
  MS_QUARTERS, MS_TF_WIN, MS_TF_LABEL, MS_TF_PRIOR, MS_TF_N, MS_SPLITS, MS_METRICS,
  msFmt, msStats, msDelta, msCompSeries, msCompBars,
});
