/* ============================================================
   PROPOSAL · ACQUISITION MODEL  (faithful to live app)
   The buyer-side deal analysis lifted out of the old Overview
   into its own tab: market benchmarks, acquisition details,
   value-add / reserve capex, market pricing band, investor
   returns & refinance. Sits below the deal-vs-comps scorecard +
   valuation scenarios. Styling only — math lives in the app.
   ============================================================ */

/* ---- market benchmarks (Pre-1940) ---- */
const ACQ_BENCH = [
  { l: "Sold count", v: ["4", "3", "1", "1"] },
  { l: "$ / Unit", v: ["$231,250", "$237,500", "$216,750", "$216,750"] },
  { l: "$ / SF", v: ["$209", "$231", "$231", "$231"] },
  { l: "Cap Rate", v: ["3.76%", "3.76%", "3.46%", "3.46%"] },
  { l: "GRM", v: ["12.75", "12.35", "12.75", "12.75"] },
];

/* ---- acquisition detail rows: [label, mid-kind, midVal, unit, computed, computedKind] ---- */
function AcqInput({ val, unit }) {
  return <div className="uw-input"><input defaultValue={val} />{unit && <span className="uw-unit">{unit}</span>}</div>;
}
function AcqRow({ label, mid, computed, compCls = "", strong, total }) {
  return (
    <div className={`acq-2 ${total ? "total" : ""}`}>
      <span className={`l ${strong ? "strong" : ""}`}>{label}</span>
      {mid || <span></span>}
      <span className={`comp ${compCls}`}>{computed}</span>
    </div>
  );
}

const ACQ_NOI_PROJ = [
  { y: "Yr 1", egr: "$64,086", exp: "$27,373", noi: "$36,713" },
  { y: "Yr 2", egr: "$67,224", exp: "$28,512", noi: "$38,712" },
  { y: "Yr 3", egr: "$70,320", exp: "$29,688", noi: "$40,632" },
  { y: "Yr 4", egr: "$73,234", exp: "$30,891", noi: "$42,343" },
  { y: "Yr 5", egr: "$76,059", exp: "$32,131", noi: "$43,928" },
  { y: "Yr 6 (exit)", egr: "$79,009", exp: "$33,428", noi: "$45,581", exit: true },
];

const ACQ_BAND = { min: 500, max: 1000 };
const acqPct = (v) => ((v - ACQ_BAND.min) / (ACQ_BAND.max - ACQ_BAND.min)) * 100;
const ACQ_BAND_FIELDS = [
  { l: "Investor floor", v: "535000", d: "$535,000" },
  { l: "Market band — low", v: "670000", d: "$670,000" },
  { l: "Market band — high", v: "885000", d: "$885,000" },
  { l: "Aggressive list", v: "985000", d: "$985,000" },
  { l: "Suggested list", v: "625000", d: "$625,000" },
];

function CapexCard({ title }) {
  return (
    <div className="uw-card">
      <p className="acq-card-h">{title}</p>
      <table className="acq-tbl">
        <thead>
          <tr><th>Description</th><th>Cost est.</th><th>Start mo.</th><th>End mo.</th></tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((i) => (
            <tr key={i}>
              <td><input className="acq-incell l" placeholder="Description" /></td>
              <td><input className="acq-incell" defaultValue="0" /></td>
              <td><input className="acq-incell" defaultValue="1" /></td>
              <td><input className="acq-incell" defaultValue="1" /></td>
            </tr>
          ))}
          <tr className="total"><td>Total</td><td>—</td><td></td><td></td></tr>
        </tbody>
      </table>
      <button className="fin-addrow" style={{ paddingLeft: 0 }}>+ Add row</button>
    </div>
  );
}

function AcquisitionModel() {
  return (
    <div className="acq-sections">
      {/* ACQUISITION DETAILS */}
      <div className="uw-card">
        <p className="acq-card-h">Acquisition details</p>
        <div className="acq-2"><span></span><span className="colhead">Input / selection</span><span className="colhead">Computed</span></div>
        <AcqRow label="Anticipated close date" mid={<div className="uw-input"><input type="date" style={{ textAlign: "left" }} /></div>} computed="" />
        <AcqRow label="Purchase price" mid={<div className="uw-input sel"><select defaultValue="Asking price"><option>Asking price</option><option>Custom</option></select><span style={{ color: "var(--mute)", fontSize: 11 }}>⌄</span></div>} computed="$925,000" />
        <AcqRow label="Down payment" mid={<AcqInput val="25" unit="%" />} computed="$231,250" />
        <AcqRow label="Loan amount" mid={<span className="note">75% LTV</span>} computed="$693,750" />
        <AcqRow label="Loan fees" mid={<AcqInput val="1" unit="%" />} computed="$6,938" />
        <AcqRow label="Closing costs" mid={<AcqInput val="2" unit="%" />} computed="$18,500" />
        <AcqRow label="Total acquisition costs" total mid={<span className="note">27.75%</span>} computed="$256,688" />
        <AcqRow label="Fixed interest rate" mid={<AcqInput val="6.5" unit="% / yr" />} computed="Annually" compCls="sub" />
        <AcqRow label="Amortization" mid={<AcqInput val="25" unit="yr" />} computed="300 Months" compCls="sub" />
        <AcqRow label="Loan term" mid={<AcqInput val="10" unit="yr" />} computed="120 Months" compCls="sub" />
        <AcqRow label="Interest-only period" mid={<AcqInput val="0" unit="mo" />} computed="0 Months" compCls="sub" />
        <AcqRow label="Amortizing payment" mid={<span className="note">$4,684 / mo</span>} computed="$56,211 / yr" />
        <AcqRow label="Interest-only payment" mid={<span className="note">$3,758 / mo</span>} computed="$45,094 / yr" />
        <AcqRow label="DSCR (Market)" strong total computed="0.85" compCls="neg" />
      </div>

      {/* CAPEX */}
      <div className="fin-cols">
        <CapexCard title="Value-add capex assumptions" />
        <CapexCard title="Reserve / replacement capex" />
      </div>

      {/* INVESTOR RETURNS */}
      <div className="uw-card">
        <p className="acq-card-h">Investor returns <span className="meta">Stabilized · Month 100</span></p>
        <div className="fin-stats">
          <div className="fin-stat"><p className="fin-stat-l">Cash invested</p><p className="fin-stat-v">$256,688</p><p className="fin-stat-sub">Down + fees + closing</p></div>
          <div className="fin-stat"><p className="fin-stat-l">Year-1 cash flow</p><p className="fin-stat-v neg">-$19,498</p><p className="fin-stat-sub">NOI $36,713 − debt $56,211</p></div>
          <div className="fin-stat"><p className="fin-stat-l">Cash-on-cash</p><p className="fin-stat-v neg">-7.60%</p><p className="fin-stat-sub">Year 1, at asking</p></div>
          <div className="fin-stat"><p className="fin-stat-l">Going-in cap</p><p className="fin-stat-v">3.97%</p><p className="fin-stat-sub">Yr-1 NOI / price</p></div>
        </div>

        <div className="fin-cols" style={{ marginTop: 16, marginBottom: 16 }}>
          <div>
            <p className="acq-card-h" style={{ border: "none", paddingBottom: 0, marginBottom: 8 }}>Purchase summary</p>
            <div className="fin-facts" style={{ gridTemplateColumns: "1fr" }}>
              <div className="fin-fact"><span className="fin-fact-l">Purchase price</span><span className="fin-fact-v">$925,000</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Loan amount</span><span className="fin-fact-v">$693,750</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Total acquisition costs</span><span className="fin-fact-v">$256,688</span></div>
            </div>
          </div>
          <div>
            <p className="acq-card-h" style={{ border: "none", paddingBottom: 0, marginBottom: 8 }}>Exit assumptions</p>
            <div className="fin-facts" style={{ gridTemplateColumns: "1fr" }}>
              <div className="fin-fact"><span className="fin-fact-l">Anticipated exit year</span><span className="fin-fact-v edit">5</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Going-out cap rate</span><span className="fin-fact-v edit">8.0%</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Sale expense</span><span className="fin-fact-v edit">5%</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Year 6 NOI (sale basis)</span><span className="fin-fact-v">$45,581</span></div>
              <div className="fin-fact"><span className="fin-fact-l">Remaining loan balance</span><span className="fin-fact-v">$628,275</span></div>
            </div>
          </div>
        </div>

        <p className="acq-card-h" style={{ border: "none", paddingBottom: 0, marginBottom: 8 }}>Projected NOI by year</p>
        <table className="acq-tbl">
          <thead><tr><th>Year</th><th>EGR</th><th>Expenses</th><th>NOI</th></tr></thead>
          <tbody>
            {ACQ_NOI_PROJ.map((r) => (
              <tr key={r.y} style={r.exit ? { background: "rgba(31,122,63,0.06)" } : null}>
                <td style={{ fontWeight: r.exit ? 700 : 600 }}>{r.y}</td>
                <td>{r.egr}</td>
                <td style={{ color: "var(--slate)" }}>{r.exp}</td>
                <td style={{ color: "var(--pos)", fontWeight: 700 }}>{r.noi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REFINANCE */}
      <div className="uw-card">
        <p className="acq-card-h" style={{ marginBottom: 12 }}>Refinance details
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 7 }}>
            Include refinance <input type="checkbox" />
          </label>
        </p>
        <p className="acq-refi"><span className="lab">Refinance not included in this analysis.</span></p>
      </div>
    </div>
  );
}

Object.assign(window, { AcquisitionModel, MarketBenchmarks, PricingBand });

/* ---- Pricing-engine cards (split out of the deal model) ---- */
function MarketBenchmarks() {
  return (
    <div className="acq-sections" style={{ paddingBottom: 0 }}>
      <div className="uw-card">
        <p className="acq-card-h">Market benchmarks — Pre-1940 <span className="meta">Last 6 months · reflects Comp Analysis filters</span></p>
        <table className="acq-tbl">
          <thead>
            <tr><th>Metric</th><th>Market / MSA</th><th>County</th><th>Sub-Market</th><th>Zip</th></tr>
          </thead>
          <tbody>
            {ACQ_BENCH.map((r) => (
              <tr key={r.l}><td>{r.l}</td>{r.v.map((x, i) => <td key={i}>{x}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingBand() {
  return (
    <div className="acq-sections" style={{ paddingTop: 8 }}>
      <div className="uw-card">
        <p className="acq-card-h">Market pricing band <button className="uw-src">↻ Reset to defaults</button></p>
        <div className="acq-band-inputs">
          {ACQ_BAND_FIELDS.map((f) => (
            <div className="acq-band-f" key={f.l}>
              <label>{f.l}</label>
              <input defaultValue={f.v} />
              <span className="sub">{f.d}</span>
            </div>
          ))}
        </div>
        <div className="fin-band">
          <div className="fin-band-track">
            <div className="fin-band-fill" style={{ left: acqPct(670) + "%", right: (100 - acqPct(885)) + "%" }}></div>
            <div className="fin-band-mark" style={{ left: acqPct(535) + "%" }}></div>
            <div className="fin-band-lbl" style={{ left: acqPct(535) + "%" }}><span className="cap">Floor</span><span className="val">$535k</span></div>
            <div className="fin-band-mark sug" style={{ left: acqPct(625) + "%" }}></div>
            <div className="fin-band-lbl sug" style={{ left: acqPct(625) + "%" }}><span className="cap">Suggested</span><span className="val">$625k</span></div>
            <div className="fin-band-mark" style={{ left: acqPct(985) + "%" }}></div>
            <div className="fin-band-lbl" style={{ left: acqPct(985) + "%" }}><span className="cap">Aggressive</span><span className="val">$985k</span></div>
          </div>
          <div className="fin-band-foot"><span>$500k</span><span>Market band $670k – $885k</span><span>$1.0M</span></div>
        </div>
      </div>
    </div>
  );
}
