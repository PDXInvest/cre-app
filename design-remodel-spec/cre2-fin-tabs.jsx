/* ============================================================
   PROPOSAL · FINANCIALS sub-tabs
   T-12 Monthly Detail · Growth Assumptions · Operating Model.
   Styling only — full row/column structure mirrors the live app;
   values illustrative. Monthly + projection columns compute in
   the live app; entry cells are manual / PDF-extracted.
   ============================================================ */

/* =================== T-12 MONTHLY DETAIL =================== */
const T12_MONTHS = ["Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26"];
const T12_MO_PREFILL = {
  "Collected Rent": "5895",
  "Utility Recovery (RUBS) - Combined": "50",
  "Other Income (Pet Rent)": "100",
};
const T12_MO = {
  "Total Rental Revenue": ["$5,895", "$5,895", "$5,895", "$5,895", "$5,895", "$5,895", "$5,148", "$5,895", "$5,895", "$5,895", "$5,895", "$5,895"],
  "RUBS": ["$50", "$50", "$50", "$50", "$50", "$50", "$50", "$50", "$50", "$50", "$50", "$50"],
  "Total Other Income": ["$250", "$150", "$150", "$150", "$150", "$150", "$195", "$250", "$195", "$250", "$150", "$250"],
  "Total Operating Expenses": ["$2,778", "$820", "$701", "$1,447", "$1,717", "$1,452", "$2,386", "$516", "$1,409", "$1,644", "$1,100", "$1,300"],
  "Net Operating Income": ["$3,367", "$5,225", "$5,344", "$4,598", "$4,328", "$4,593", "$2,957", "$5,629", "$4,681", "$4,501", "$4,945", "$4,845"],
};

function T12Detail() {
  return (
    <div className="fin-view">
      <div className="fin-toolbar">
        <span className="fin-toolbar-note">T-12 period <b>Apr 25 — Mar 26</b></span>
        <button className="btn-pdf">⇪ Import from PDF</button>
        <div className="spacer" style={{ flex: 1 }}></div>
        <button className="btn btn-secondary">‹ Back 1 month</button>
        <button className="btn btn-secondary">Advance 1 month ›</button>
      </div>
      <div className="fin-sheetwrap">
        <table className="fin-sheet">
          <thead>
            <tr>
              <th className="lbl">T-12 monthly detail</th>
              {T12_MONTHS.map((m) => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {window.FIN_IS.filter((r) => r.k !== "ratio").map((r, ri) => {
              if (r.k === "grp") return <tr className="grp" key={ri}><th className="row">{r.l}</th>{T12_MONTHS.map((m) => <td key={m}></td>)}</tr>;
              const isSub = r.k === "sub" || r.k === "total" || r.k === "noi";
              const addRow = isSub ? <tr key={"add" + ri}><th className="row"><button className="fin-addrow">+ Add custom row</button></th>{T12_MONTHS.map((m) => <td key={m}></td>)}</tr> : null;
              if (isSub) {
                const mo = T12_MO[r.l];
                const rowCls = r.k === "noi" ? "noi" : r.k === "total" ? "total" : "sub";
                return (
                  <React.Fragment key={ri}>
                    {addRow}
                    <tr className={rowCls}>
                      <th className="row">{r.l}</th>
                      {T12_MONTHS.map((m, i) => mo ? <td key={m}>{mo[i]}</td> : <td key={m} className="dash">—</td>)}
                    </tr>
                  </React.Fragment>
                );
              }
              const pf = T12_MO_PREFILL[r.l] || "";
              return (
                <tr key={ri}>
                  <th className="row">{r.l}</th>
                  {T12_MONTHS.map((m) => <td key={m}><input className="fin-incell mo" defaultValue={pf} /></td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== GROWTH ASSUMPTIONS =================== */
const GA_ROWS = [
  { grp: "Revenue" },
  { l: "Annual Rent Cap", d: "7.00%" },
  { l: "Market Rent Growth", d: "3.25%" },
  { l: "Loss-to-Lease", d: "0.00%" },
  { l: "Concessions", d: "0.00%" },
  { l: "General Vacancy & Credit Loss", d: "5.00%" },
  { l: "RUBS Growth", d: "2.50%" },
  { l: "Other Income Growth", d: "3.00%" },
  { l: "Parking Income Growth", d: "3.00%" },
  { l: "Storage Income Growth", d: "3.00%" },
  { grp: "Operating expenses" },
  { l: "Controllable Expense Growth", d: "2.50%" },
  { l: "Repairs & Maintenance Growth", d: "6.00%" },
  { l: "Property Tax Growth", d: "3.00%" },
  { l: "Insurance ($/unit)", d: "$750" },
  { l: "Insurance Growth", d: "5.00%" },
  { l: "Property Management (% of EGR)", d: "8.00%" },
  { l: "Utilities ($/unit)", d: "$125" },
  { l: "Utilities Growth", d: "5.00%" },
  { l: "Turnover ($/unit)", d: "$250" },
  { l: "Turnover Growth", d: "3.00%" },
  { l: "Capital Reserves ($/unit)", d: "$250" },
];

function GrowthAssumptions() {
  return (
    <div className="fin-view">
      <div className="fin-toolbar">
        <span className="fin-toolbar-note">Defaults vs. this proposal · <b>This proposal</b> overrides flow into the model</span>
        <div className="spacer" style={{ flex: 1 }}></div>
      </div>
      <div className="fin-sheetwrap">
        <table className="fin-sheet fin-ga">
          <thead>
            <tr>
              <th className="lbl">Assumption</th>
              <th>Default</th>
              <th className="in-col">This proposal</th>
              <th>Effective</th>
            </tr>
          </thead>
          <tbody>
            {GA_ROWS.map((r, ri) => r.grp ? (
              <tr className="grp" key={ri}><th className="row">{r.grp}</th><td></td><td className="in-col"></td><td></td></tr>
            ) : (
              <tr key={ri}>
                <th className="row">{r.l}</th>
                <td>{r.d}</td>
                <td className="in-col"><input className="fin-incell" defaultValue={r.d} /></td>
                <td>{r.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== OPERATING MODEL =================== */
const OM_UNITS = [
  { u: "Unit 1", cur: "$900", mkt: "$1,750", pct: "51%", pctNeg: true, stab: "Mo 192 (Yr 16.0)", yrs: ["$963", "$1,030", "$1,103", "$1,180", "$1,262"] },
  { u: "Unit 2", cur: "$1,350", mkt: "$1,495", pct: "90%", stab: "Close", yrs: ["$1,445", "$1,546", "$1,628", "$1,681", "$1,736"] },
  { u: "Unit 3", cur: "$1,495", mkt: "$1,495", pct: "100%", stab: "Close", yrs: ["$1,507", "$1,556", "$1,607", "$1,659", "$1,713"] },
  { u: "Unit 4", cur: "$1,300", mkt: "$1,395", pct: "93%", stab: "Close", yrs: ["$1,391", "$1,448", "$1,495", "$1,544", "$1,594"] },
];

/* annual pro forma · cols: T-12, Yr1..Yr5, Yr6 (sale basis) */
const OM_PRO = [
  { k: "grp", l: "Operating income" },
  { k: "line", l: "Unit Rental Income", v: ["$86,975", "$62,197", "$65,356", "$68,468", "$71,386", "$74,205", "$77,150"] },
  { k: "line", l: "RUBS", v: ["$728", "$2,880", "$2,952", "$3,026", "$3,101", "$3,179", "$3,258"] },
  { k: "line", l: "Parking / Storage Income", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Other Income", v: ["$2,058", "$2,120", "$2,183", "$2,249", "$2,316", "$2,386", "$2,457"] },
  { k: "sub", l: "Gross Revenue", v: ["$89,761", "$67,196", "$70,492", "$73,743", "$76,804", "$79,770", "$82,866"] },
  { k: "line", l: "General Vacancy & Credit Loss", v: ["-$4,349", "-$3,110", "-$3,268", "-$3,423", "-$3,569", "-$3,710", "-$3,858"] },
  { k: "line", l: "Concessions", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "total", l: "Total Effective Gross Revenue", v: ["$85,412", "$64,086", "$67,224", "$70,320", "$73,234", "$76,059", "$79,009"] },
  { k: "grp", l: "Expenses" },
  { k: "line", l: "Administrative", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Property Taxes", v: ["$7,820", "$8,055", "$8,296", "$8,545", "$8,802", "$9,066", "$9,338"] },
  { k: "line", l: "Other Taxes / Fees", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Property Insurance", v: ["$3,000", "$3,000", "$3,150", "$3,308", "$3,473", "$3,647", "$3,829"] },
  { k: "line", l: "Utilities", v: ["$500", "$500", "$525", "$551", "$579", "$608", "$638"] },
  { k: "line", l: "Property Management", v: ["$6,833", "$5,127", "$5,378", "$5,626", "$5,859", "$6,085", "$6,321"] },
  { k: "line", l: "Repairs & Maintenance", v: ["$5,500", "$5,830", "$6,180", "$6,551", "$6,944", "$7,361", "$7,802"] },
  { k: "line", l: "Landscaping", v: ["$158", "$161", "$165", "$170", "$174", "$178", "$183"] },
  { k: "line", l: "Turnover", v: ["$1,000", "$1,000", "$1,030", "$1,061", "$1,093", "$1,126", "$1,159"] },
  { k: "line", l: "Capital Reserves", v: ["$1,000", "$1,000", "$1,020", "$1,040", "$1,061", "$1,082", "$1,104"] },
  { k: "line", l: "Security", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Contract Services", v: ["$738", "$756", "$775", "$795", "$815", "$835", "$856"] },
  { k: "line", l: "Advertising & Marketing", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Payroll", v: ["$1,896", "$1,943", "$1,992", "$2,042", "$2,093", "$2,145", "$2,199"] },
  { k: "line", l: "Misc", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "total", l: "Total OpEx", v: ["$28,445", "$27,373", "$28,512", "$29,688", "$30,891", "$32,131", "$33,428"] },
  { k: "noi", l: "Net Operating Income", v: ["$56,967", "$36,713", "$38,712", "$40,632", "$42,343", "$43,928", "$45,581"] },
  { k: "line", l: "Capital Expenditures", v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "total", l: "Cash Flow from Operations", v: ["$56,967", "$36,713", "$38,712", "$40,632", "$42,343", "$43,928", "$45,581"] },
];
const OM_COLS = ["T-12", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6 †"];
const omColCls = (i) => (i === 0 ? "c-t12" : i === 6 ? "c-proj" : "");

function OperatingModel() {
  return (
    <div className="fin-view">
      <div className="fin-toolbar">
        <span className="fin-toolbar-note">Property stabilizes: <b>Month 100</b></span>
        <div className="spacer" style={{ flex: 1 }}></div>
        <button className="btn btn-secondary">↻ Recompute</button>
      </div>
      <div className="fin-sheetwrap">
        <p className="dd-card-h" style={{ border: "none", margin: "4px 0 8px", padding: 0 }}>Per-unit rent schedule</p>
        <table className="fin-sheet" style={{ marginBottom: 22 }}>
          <thead>
            <tr>
              <th className="lbl" style={{ minWidth: 90 }}>Unit</th>
              <th>Current</th><th>Market</th><th>% Mkt</th><th>Stab month</th>
              <th>Yr 1</th><th>Yr 2</th><th>Yr 3</th><th>Yr 4</th><th>Yr 5</th>
            </tr>
          </thead>
          <tbody>
            {OM_UNITS.map((u) => (
              <tr key={u.u}>
                <th className="row" style={{ minWidth: 90 }}>{u.u}</th>
                <td>{u.cur}</td>
                <td className="dash" style={{ color: "var(--slate)" }}>{u.mkt}</td>
                <td className={u.pctNeg ? "fin-pct-neg" : "fin-pct-ok"}>{u.pct}</td>
                <td className={u.stab === "Close" ? "fin-close" : "neg"} style={{ textAlign: "right" }}>{u.stab}</td>
                {u.yrs.map((y, i) => <td key={i}>{y}</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="dd-card-h" style={{ border: "none", margin: "4px 0 8px", padding: 0 }}>Annual pro forma</p>
        <table className="fin-sheet">
          <thead>
            <tr>
              <th className="lbl">Line item</th>
              {OM_COLS.map((c, i) => <th key={i} className={omColCls(i)}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {OM_PRO.map((r, ri) => {
              if (r.k === "grp") return <tr className="grp" key={ri}><th className="row">{r.l}</th>{OM_COLS.map((c, i) => <td key={i} className={omColCls(i)}></td>)}</tr>;
              const rowCls = r.k === "sub" ? "sub" : r.k === "total" ? "total" : r.k === "noi" ? "noi" : "";
              return (
                <tr className={rowCls} key={ri}>
                  <th className="row">{r.l}</th>
                  {r.v.map((val, i) => <window.FinValCell key={i} val={val} cls={omColCls(i)} />)}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="fin-sheet-foot">† Year 6 is the sale-basis NOI (going-out cap rate ÷ this value = projected sale price). Change the exit year in the dashboard, save, then Recompute.</p>
      </div>
    </div>
  );
}

Object.assign(window, { T12Detail, GrowthAssumptions, OperatingModel });
