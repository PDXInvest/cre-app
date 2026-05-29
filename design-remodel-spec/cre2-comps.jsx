/* ============================================================
   PROPOSALS — Comp analysis matrix
   The market-stats grid: every metric across Market / County /
   Sub-Market / Zip, each with an +Era cut. This is the "how it
   stacks against what's available and what's sold" surface.
   ============================================================ */

const CM_COLS = [
  { label: "Market", sub: "Portland", era: false },
  { label: "Market +Era", sub: "Pre-1940", era: true },
  { label: "County", sub: "Multnomah", era: false },
  { label: "County +Era", sub: "Pre-1940", era: true },
  { label: "Sub-Mkt", sub: "SE Portland", era: false },
  { label: "Sub-Mkt +Era", sub: "Pre-1940", era: true },
  { label: "Zip", sub: "97214", era: false },
  { label: "Zip +Era", sub: "Pre-1940", era: true },
];

const CM_GROUPS = [
  { name: "Property count", rows: [
    { l: "Active", v: [23, 8, 18, 7, 10, 5, 4, 3] },
    { l: "Under contract", v: [3, 2, 2, 2, 2, 2, 1, 1] },
    { l: "Sold", v: [22, 4, 14, 3, 3, 1, 2, 1] },
  ] },
  { name: "$ / Unit", rows: [
    { l: "Active", v: ["$224,975", "$218,625", "$224,250", "$224,750", "$215,625", "$212,500", "$199,363", "$173,750"] },
    { l: "Under contract", v: ["$210,000", "$210,625", "$210,625", "$210,625", "$210,625", "$210,625", "$210,000", "$210,000"] },
    { l: "Sold", v: ["$216,500", "$231,250", "$221,153", "$237,500", "$216,750", "$216,750", "$264,625", "$216,750"] },
  ] },
  { name: "Cap rate", rows: [
    { l: "Active", v: ["5.00%", "4.88%", "4.96%", "4.88%", "4.88%", "4.88%", "5.47%", "5.01%"] },
    { l: "Under contract", v: ["6.28%", "5.98%", "5.98%", "5.98%", "5.98%", "5.98%", "6.28%", "6.28%"] },
    { l: "Sold", v: ["5.84%", "3.76%", "5.37%", "3.76%", "3.46%", "3.46%", "3.46%", "3.46%"] },
  ] },
  { name: "GRM", rows: [
    { l: "Active", v: ["12.86", "13.25", "12.85", "13.25", "12.53", "12.53", "11.86", "11.97"] },
    { l: "Under contract", v: ["10.61", "10.48", "10.48", "10.48", "10.48", "10.48", "10.20", "10.20"] },
    { l: "Sold", v: ["12.08", "12.75", "11.78", "12.35", "13.39", "12.75", "12.75", "12.75"] },
  ] },
  { name: "Total DOM", rows: [
    { l: "Active", v: [87, 89, 83, 93, 84, 101, 108, 122] },
    { l: "Under contract", v: [103, 110, 110, 110, 110, 110, 115, 115] },
    { l: "Sold", v: [226, 140, 238, 144, 132, 35, 56, 35] },
  ] },
];

function CMChip({ label, value }) {
  return <button className="fchip"><span className="fchip-label">{label}</span><span className="fchip-value">{value}</span><span className="fchip-caret">⌄</span></button>;
}

function CompMatrix() {
  return (
    <React.Fragment>
      <div className="cm-filters">
        <CMChip label="Market" value="Portland" /><CMChip label="County" value="Multnomah" />
        <CMChip label="Sub-Market" value="SE Portland" /><CMChip label="Zip" value="97214" />
        <CMChip label="Era" value="Pre-1940" /><CMChip label="Date range" value="6 months" />
        <CMChip label="Units" value="4 – 4" />
      </div>
      <p className="cm-meta">48 comps matched · 48 in stats · 11 in marketing set</p>

      <div className="cm-wrap">
        <table className="cm-matrix">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Market stat</th>
              {CM_COLS.map((c, i) => (
                <th key={i} className={c.era ? "cm-era" : ""}>{c.label}<span className="cm-sub">{c.sub}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CM_GROUPS.map((g) => (
              <React.Fragment key={g.name}>
                <tr className="cm-group"><th colSpan={9}>{g.name}</th></tr>
                {g.rows.map((r) => (
                  <tr key={r.l}>
                    <th><span className="cm-row-sub">{r.l}</span></th>
                    {r.v.map((val, i) => (
                      <td key={i} className={`val ${CM_COLS[i].era ? "cm-era" : ""}`}>{val}</td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </React.Fragment>
  );
}

function ProposalComps() {
  const tabs = ["Pricing", "Acquisition Model", "Comp analysis", "Rent roll", "Due diligence", "Financials"];
  return (
    <ApShell active="Proposals">
      <div className="uw-top">
        <button className="uw-back">‹ Pipeline</button>
        <div className="uw-top-id">
          <h1 className="uw-top-title">1842–1848 SE Ankeny St</h1>
          <p className="uw-top-meta">Southeast Portland · 4 units · Fourplex · Pre-1940</p>
        </div>
        <div className="uw-top-spacer"></div>
        <select className="uw-stage-select" defaultValue="Working"><option>Working</option></select>
        <button className="btn btn-primary">Open OM →</button>
      </div>
      <div className="uw-nav">
        {tabs.map((t) => <button key={t} className={t === "Comp analysis" ? "is-on" : ""}>{t}</button>)}
      </div>

      <CompMatrix />
    </ApShell>
  );
}

Object.assign(window, { ProposalComps, CompMatrix });
