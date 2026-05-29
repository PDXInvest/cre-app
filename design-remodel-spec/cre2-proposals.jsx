/* ============================================================
   PROPOSALS — list + underwriting workspace + comp analysis
   The workspace is the redesign: inputs on the left, a live
   "deal vs comps" scorecard on the right, and the valuation
   back-solve scenarios across the bottom — all on one screen.
   Data: 1842–1848 SE Ankeny St (4 units, asking $925k).
   ============================================================ */

const PP_LIST = [
  { id: "ankeny",   addr: "1842–1848 SE Ankeny St",  sub: "Southeast Portland · 4 units · Fourplex", ask: "$925,000",   date: "2d ago",  stage: "Working" },
  { id: "edison",   addr: "8220–8236 N Edison St",   sub: "North Portland · 9 units · 9–20 Units",   ask: "$1,725,000", date: "4d ago",  stage: "Working" },
  { id: "alberta",  addr: "1716 N Alberta St",       sub: "North Portland · 2 units · Duplex",       ask: "$750,000",   date: "1d ago",  stage: "New" },
  { id: "belmont",  addr: "5802–5824 SE Belmont St", sub: "Southeast Portland · 12 units · 9–20",    ask: "$1,675,000", date: "5d ago",  stage: "New" },
  { id: "grover",   addr: "018 SW Grover St",        sub: "Southwest Portland · 4 units · Fourplex", ask: "$640,000",   date: "3w ago",  stage: "Archived" },
  { id: "hamilton", addr: "0219 SW Hamilton St",     sub: "Southwest Portland · 4 units · Fourplex", ask: "$560,000",   date: "1mo ago", stage: "Archived" },
];

function PPStageBadge({ stage }) {
  const cls = stage === "New" ? "prospect" : stage === "Working" ? "working" : "neutral";
  return <span className={`ap-badge ${cls}`}>{stage}</span>;
}

function ProposalsList({ onOpen = () => {} }) {
  const [stage, setStage] = React.useState("All");
  const counts = { All: PP_LIST.length, New: 2, Working: 2, Archived: 2 };
  const rows = stage === "All" ? PP_LIST : PP_LIST.filter((p) => p.stage === stage);
  return (
    <ApShell active="Proposals">
      <div className="ap-head">
        <div>
          <p className="ap-head-eyebrow">Underwriting pipeline</p>
          <h1 className="ap-head-title">Proposals</h1>
          <p className="ap-head-meta"><b>{PP_LIST.length}</b> deals in the model</p>
        </div>
        <div className="ap-head-actions"><button className="btn btn-primary" onClick={() => onOpen("ankeny")}>+ New proposal</button></div>
      </div>
      <div className="ap-toolbar">
        <div className="ap-search"><span className="ap-search-icon">⌕</span><input placeholder="Search proposals…" /></div>
        <div className="pp-stages ap-segs">
          {["All", "New", "Working", "Archived"].map((s) => (
            <button key={s} className={`ap-seg ${s === stage ? "is-on" : ""}`} onClick={() => setStage(s)}>
              {s}<span className="ap-seg-count">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ap-tablewrap">
        <table className="ap-table">
          <thead>
            <tr><th>Property</th><th className="num">Asking price</th><th className="num">Updated</th><th>Stage</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p.id)}>
                <td><div className="ap-cell-primary">{p.addr}</div><div className="ap-cell-sub">{p.sub}</div></td>
                <td className="num"><span className="ap-cell-figure">{p.ask}</span></td>
                <td className="num"><span style={{ fontWeight: 500, color: "var(--mute)", fontSize: 12 }}>{p.date}</span></td>
                <td><PPStageBadge stage={p.stage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ApShell>
  );
}

/* ---------- UNDERWRITING WORKSPACE ---------- */
function UWRow({ label, strong, inputVal, unit, select, selectVal, computed, computedCls, computedSub }) {
  return (
    <div className={`uw-row ${strong ? "" : ""}`}>
      <span className={`uw-row-l ${strong ? "strong" : ""}`}>{label}</span>
      {select ? (
        <div className="uw-input sel"><select defaultValue={selectVal}><option>{selectVal}</option></select><span style={{ color: "var(--mute)", fontSize: 11 }}>⌄</span></div>
      ) : inputVal !== undefined ? (
        <div className="uw-input"><input defaultValue={inputVal} />{unit && <span className="uw-unit">{unit}</span>}</div>
      ) : <span></span>}
      <span className={`uw-computed ${computedCls || ""}`}>{computed}{computedSub && <span className="uw-computed sub" style={{ display: "block" }}>{computedSub}</span>}</span>
    </div>
  );
}

function UWScore({ label, val, fill, mark, dir, cmp, tag, tagDir }) {
  return (
    <div className={`uw-score ${dir}`}>
      <span className="uw-score-l">{label}</span>
      <span className="uw-score-v">{val}</span>
      <div className="uw-score-bar">
        <div className="uw-score-fill" style={{ width: fill + "%" }}></div>
        <div className="uw-score-mark" style={{ left: mark + "%" }}></div>
      </div>
      <div className="uw-score-cmp">
        <span className="vs">{cmp}</span>
        <span className={`tag ${tagDir}`}>{tag}</span>
      </div>
    </div>
  );
}

function ProposalWorkspace({ onBack = () => {} }) {
  const tabs = ["Pricing", "Acquisition Model", "Comp analysis", "Rent roll", "Due diligence", "Financials"];
  const [tab, setTab] = React.useState("Pricing");
  return (
    <ApShell active="Proposals">
      <div className="uw-top">
        <button className="uw-back" onClick={onBack}>‹ Pipeline</button>
        <div className="uw-top-id">
          <h1 className="uw-top-title">1842–1848 SE Ankeny St</h1>
          <p className="uw-top-meta">Southeast Portland · 4 units · Fourplex · Pre-1940</p>
        </div>
        <div className="uw-top-spacer"></div>
        <select className="uw-stage-select" defaultValue="Working"><option>Working</option><option>New</option><option>Archived</option></select>
        <button className="btn btn-primary">Open OM →</button>
      </div>

      <div className="uw-nav">
        {tabs.map((t) => <button key={t} className={t === tab ? "is-on" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === "Pricing" && <div className="acq-scroll">
      <div className="uw-body">
        {/* INPUTS */}
        <div className="uw-inputs">
          <div className="uw-card">
            <p className="uw-card-h">Income <button className="uw-src">Source: Market ⌄</button></p>
            <div className="uw-row"><span className="uw-row-l"></span><span className="uw-colhead sel">Input</span><span className="uw-colhead">Annual</span></div>
            <UWRow label="Gross scheduled income" inputVal="77,341" computed="$77,341" />
            <UWRow label="Operating expenses" inputVal="29,839" computed="$29,839" />
            <div className="uw-row total"><span className="uw-row-l">Net operating income</span><span></span><span className="uw-computed pos">$47,502</span></div>
          </div>
        </div>

        {/* SCORECARD — deal vs comps, always in view */}
        <aside className="uw-aside">
          <div className="uw-card">
            <p className="uw-card-h">Deal vs comps <span style={{ fontSize: 10, fontWeight: 600, color: "var(--mute)" }}>at asking</span></p>
            <div className="uw-scorecard">
              <UWScore label="Cap rate" val="5.14%" fill={73} mark={49} dir="good" cmp="Sub-mkt sold 3.46%" tag="+168 bps yield" tagDir="pos" />
              <UWScore label="GRM" val="11.96×" fill={75} mark={80} dir="good" cmp="Sub-mkt sold 12.75×" tag="cheaper on income" tagDir="pos" />
              <UWScore label="$ / Unit" val="$231k" fill={77} mark={72} dir="bad" cmp="Sub-mkt sold $217k" tag="+6.7% vs sold" tagDir="neg" />
              <UWScore label="$ / SF" val="$228" fill={76} mark={77} dir="good" cmp="Sub-mkt sold $231" tag="in line" tagDir="pos" />
              <UWScore label="DSCR" val="0.85×" fill={57} mark={83} dir="bad" cmp="Lender target 1.25×" tag="below coverage" tagDir="neg" />
            </div>
          </div>
          <p className="uw-aside-note">
            <strong>Read</strong> At asking the deal yields ~168 bps over sub-market sold cap and is cheaper on GRM — but DSCR is 0.85, well under a 1.25 lender target. Back-solve a price below to clear coverage and return.
          </p>
        </aside>
      </div>

      <window.MarketBenchmarks />

      {/* VALUATION SCENARIOS */}
      <div className="uw-scen">
        <div className="uw-scen-card">
          <table className="uw-scen-table">
            <thead>
              <tr><th>Scenario</th><th>Target</th><th>Price</th><th>$ / Unit</th><th>$ / SF</th><th>Cap</th><th>GRM</th><th>DSCR</th></tr>
            </thead>
            <tbody>
              <tr className="is-asking"><th>Asking price</th><td></td><td><span className="uw-scen-price">$925,000</span></td><td>$231,250</td><td>$228</td><td>5.14%</td><td>11.96</td><td><span className="uw-dscr low">0.85</span></td></tr>
              <tr className="is-target"><th>Target · Return %</th><td><span className="uw-scen-target">10 %</span></td><td><span className="uw-scen-price">$536,629</span></td><td>$134,157</td><td>$132</td><td>8.85%</td><td>6.94</td><td><span className="uw-dscr ok">1.46</span></td></tr>
              <tr className="is-target"><th>Target · $ / unit</th><td><span className="uw-scen-target">237,500</span></td><td><span className="uw-scen-price">$950,000</span></td><td>$237,500</td><td>$234</td><td>5.00%</td><td>12.28</td><td><span className="uw-dscr low">0.82</span></td></tr>
              <tr className="is-target"><th>Target · $ / SF</th><td><span className="uw-scen-target">270</span></td><td><span className="uw-scen-price">$1,097,010</span></td><td>$274,253</td><td>$270</td><td>4.33%</td><td>14.18</td><td><span className="uw-dscr low">0.71</span></td></tr>
              <tr className="is-target"><th>Target · Cap rate</th><td><span className="uw-scen-target">4.94 %</span></td><td><span className="uw-scen-price">$961,572</span></td><td>$240,393</td><td>$237</td><td>4.94%</td><td>12.43</td><td><span className="uw-dscr low">0.81</span></td></tr>
              <tr className="is-target"><th>Target · GRM</th><td><span className="uw-scen-target">12.93</span></td><td><span className="uw-scen-price">$1,000,017</span></td><td>$250,004</td><td>$246</td><td>4.75%</td><td>12.93</td><td><span className="uw-dscr low">0.78</span></td></tr>
              <tr className="is-target"><th>Target · DSCR</th><td><span className="uw-scen-target">1.25</span></td><td><span className="uw-scen-price">$625,344</span></td><td>$156,336</td><td>$154</td><td>7.60%</td><td>8.09</td><td><span className="uw-dscr ok">1.25</span></td></tr>
            </tbody>
          </table>
          <p className="uw-scen-note">Enter any target and the model back-solves the price that hits it. Income source: Market · NOI $47,502. * Return % = cash-on-cash back-calculation.</p>
        </div>
      </div>
      <window.PricingBand />
      </div>}

      {tab === "Acquisition Model" && <div className="acq-scroll"><window.AcquisitionModel /></div>}

      {tab === "Comp analysis" && <window.CompMatrix />}
      {tab === "Rent roll" && <window.RentRoll />}
      {tab === "Due diligence" && <window.DueDiligence />}
      {tab === "Financials" && <window.Financials />}
    </ApShell>
  );
}

Object.assign(window, { ProposalsList, ProposalWorkspace });
