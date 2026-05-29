/* ============================================================
   PROPOSAL · FINANCIALS  (faithful to live app)
   Four sub-tabs: Income Statement (Full/Summary) · T-12 Monthly
   Detail · Growth Assumptions · Operating Model. The full
   operating spreadsheet — every line item & scenario column.
   Year columns are manually entered or PDF-extracted; the T-12 /
   Scheduled / Stabilized / Market columns compute in the live
   app. Styling only — values illustrative, math lives in the app.
   ============================================================ */

/* income-statement scenario columns */
const IS_COLS = [
  { l: "2023" }, { l: "2024" }, { l: "2025" },
  { l: "T-12", sub: "Apr 25 – Mar 26", t12: true },
  { l: "Scheduled", proj: true }, { l: "Stabilized", proj: true }, { l: "Market", proj: true },
];
const isColCls = (i) => (i === 3 ? "c-t12" : i >= 4 ? "c-proj" : "");

/* k: grp | line | sub | total | noi  ·  s: appears in Summary view
   v: [2023, 2024, 2025, T-12, Scheduled, Stabilized, Market] */
const FIN_IS = [
  { k: "grp", l: "Rental revenue" },
  { k: "line", l: "Market Rent", v: ["", "", "", "—", "$73,620", "$95,086", "$76,013"] },
  { k: "line", l: "Loss-to-Lease", v: ["", "", "", "—", "-$13,080", "—", "—"] },
  { k: "line", l: "Actual Vacancy & Credit Loss", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Concessions", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Collected Rent", v: ["65600", "70869", "69290", "$69,993", "$60,540", "", "$76,013"] },
  { k: "sub", l: "Total Rental Revenue", s: 1, v: ["$65,600", "$70,869", "$69,290", "$69,993", "$60,540", "—", "$76,013"] },

  { k: "grp", l: "Other income" },
  { k: "line", l: "Electricity Reimb", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Water/Sewer Reimbursement", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Gas Reimbursement", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Trash Reimbursement", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Utility Recovery (RUBS) - Combined", v: ["75", "106", "578", "$600", "—", "—", "—"] },
  { k: "sub", l: "RUBS", s: 1, v: ["$75", "$106", "$578", "$600", "—", "$6,194", "$2,880"] },
  { k: "line", l: "Parking/Garage", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Parking Income", s: 1, v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Storage Income", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Storage Income", s: 1, v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Tenant Chargeback", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Application Fees", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Insurance Services", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Deposit Forfeit", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Interest Income", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Late Charges", v: ["", "", "", "$300", "—", "—", "—"] },
  { k: "line", l: "NSF Fees", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Laundry", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Other Income (Pet Rent)", v: ["787", "706", "1178", "$1,290", "—", "—", "—"] },
  { k: "line", l: "Misc Income", v: ["45", "393", "90", "$90", "—", "—", "—"] },
  { k: "sub", l: "Other Income", s: 1, v: ["$832", "$1,099", "$1,268", "$1,680", "$1,730", "$1,730", "$1,730"] },
  { k: "total", l: "Total Other Income", s: 1, v: ["$907", "$1,205", "$1,846", "$2,280", "$1,730", "$7,925", "$4,610"] },

  { k: "grp", l: "Effective gross revenue" },
  { k: "sub", l: "Gross Revenue", s: 1, v: ["$66,507", "$72,074", "$71,136", "$72,273", "$62,270", "$7,925", "$80,623"] },
  { k: "line", l: "General Vacancy & Credit Loss", s: 1, v: ["", "", "", "—", "-$3,027", "", "-$3,801"] },
  { k: "total", l: "Total Effective Gross Revenue", s: 1, v: ["$66,507", "$72,074", "$71,136", "$72,273", "$59,243", "$7,925", "$76,822"] },

  { k: "grp", l: "Operating expenses" },
  { k: "line", l: "Licenses/Permits/Fees", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Collection Expense", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Dues & Subscriptions", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Postage", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Bank Charges", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Onboarding", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Office Supplies", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Administrative", s: 1, v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Property Tax", v: ["7249.21", "7539", "7820.05", "—", "—", "—", "—"] },
  { k: "sub", l: "Property Taxes", s: 1, v: ["$7,249", "$7,539", "$7,820", "$7,820", "$8,055", "$10,203", "$8,545"] },
  { k: "line", l: "State/Local Taxes", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Taxes Other", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Other Taxes / Fees", s: 1, v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Property Insurance", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Property Insurance", s: 1, v: ["—", "—", "—", "$2,745", "$3,000", "$4,432", "$3,308"] },
  { k: "line", l: "Electric", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Electric-Vacant", v: ["50.95", "53.7", "67.95", "—", "—", "—", "—"] },
  { k: "line", l: "Water/Sewage", v: ["3013.79", "3580.64", "3335.42", "$3,522", "—", "—", "—"] },
  { k: "line", l: "Gas", v: ["", "", "", "-$33", "—", "—", "—"] },
  { k: "line", l: "Trash/Recycling", v: ["884.7", "982.55", "1031.7", "$1,038", "—", "—", "—"] },
  { k: "line", l: "Utilities (Combined)", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Utilities", s: 1, v: ["$3,949", "$4,617", "$4,435", "$4,526", "$500", "$739", "$551"] },
  { k: "line", l: "Management Fees", v: ["3936", "4487.78", "4850.31", "$4,899", "—", "—", "—"] },
  { k: "line", l: "Management Lease Up", v: ["700", "900", "900", "$400", "—", "—", "—"] },
  { k: "line", l: "Misc Fees / Software", v: ["228", "228", "228", "$228", "—", "—", "—"] },
  { k: "sub", l: "Property Management", s: 1, v: ["$4,864", "$5,616", "$5,978", "$5,527", "$4,601", "-$496", "$5,777"] },
  { k: "line", l: "General Maintenance", v: ["379.51", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "General Repair", v: ["", "", "", "$2,491", "—", "—", "—"] },
  { k: "line", l: "Cleaning", v: ["350", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Supplies", v: ["22.29", "249.91", "159.45", "$138", "—", "—", "—"] },
  { k: "line", l: "Painting", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "HVAC", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Plumbing Repair", v: ["625", "", "", "$825", "—", "—", "—"] },
  { k: "line", l: "Appliance Repair", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Labor Expense", v: ["5640", "6096.5", "7117.79", "$277", "—", "—", "—"] },
  { k: "line", l: "Pest Control", v: ["250", "600", "472.5", "—", "—", "—", "—"] },
  { k: "line", l: "Misc", v: ["148", "71", "53", "—", "—", "—", "—"] },
  { k: "sub", l: "Repairs & Maintenance", s: 1, v: ["$7,415", "$7,017", "$7,803", "$3,730", "$3,954", "$6,302", "$4,443"] },
  { k: "line", l: "Landscaping", v: ["158", "", "", "$68", "—", "—", "—"] },
  { k: "sub", l: "Landscaping", s: 1, v: ["$158", "—", "—", "$68", "$69", "$84", "$73"] },
  { k: "line", l: "Misc Turnover", v: ["950", "3425.83", "919.47", "$367", "—", "—", "—"] },
  { k: "sub", l: "Turnover", s: 1, v: ["$950", "$3,426", "$919", "$367", "$1,000", "$1,267", "$1,061"] },
  { k: "line", l: "Capital Reserves", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Capital Reserves", s: 1, v: ["—", "—", "—", "$1", "$1,000", "$1,172", "$1,040"] },
  { k: "line", l: "Security", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Security", s: 1, v: ["—", "—", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Contract Services", v: ["", "", "", "$581", "—", "—", "—"] },
  { k: "sub", l: "Contract Services", s: 1, v: ["—", "—", "—", "$581", "$595", "$725", "$625"] },
  { k: "line", l: "Leasing Commissions", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "line", l: "Advertising", v: ["356.95", "108.45", "", "—", "—", "—", "—"] },
  { k: "line", l: "Internet Advertising", v: ["", "", "", "—", "—", "—", "—"] },
  { k: "sub", l: "Advertising & Marketing", s: 1, v: ["$357", "$108", "—", "—", "—", "—", "—"] },
  { k: "line", l: "Payroll", v: ["", "", "", "$1,422", "—", "—", "—"] },
  { k: "sub", l: "Payroll", s: 1, v: ["—", "—", "—", "$1,422", "$1,458", "$1,776", "$1,531"] },
  { k: "line", l: "Misc Expenses", v: ["0", "0", "0", "—", "—", "—", "—"] },
  { k: "sub", l: "Misc", s: 1, v: ["—", "$1", "$1", "—", "—", "—", "—"] },
  { k: "total", l: "Total Operating Expenses", s: 1, v: ["$24,942", "$28,324", "$26,957", "$26,787", "$24,231", "$26,205", "$26,954"] },

  { k: "ratio", l: "Expense Ratio (Scheduled): 40.9%" },
  { k: "noi", l: "Net Operating Income", s: 1, v: ["$41,565", "$43,750", "$44,179", "$45,486", "$35,012", "-$18,280", "$49,868"] },
  { k: "line", l: "Capital Improvements", s: 1, v: ["4526", "770", "", "—", "", "", ""] },
  { k: "total", l: "Cash Flow from Operations", s: 1, v: ["$37,039", "$42,980", "$44,179", "$45,486", "$35,012", "-$18,280", "$49,868"] },
];

/* shared cell renderers --------------------------------------------------- */
function FinValCell({ val, cls }) {
  const empty = !val || val === "—";
  const neg = typeof val === "string" && val.trim().startsWith("-");
  return <td className={`${cls} ${empty ? "dash" : ""} ${neg ? "neg" : ""}`}>{empty ? "—" : val}</td>;
}
function FinInputCell({ val, cls }) {
  return <td className={cls}><input className="fin-incell" defaultValue={val} /></td>;
}

function IncomeStatement() {
  const [view, setView] = React.useState("summary");
  const rows = view === "full" ? FIN_IS : FIN_IS.filter((r) => r.k === "grp" || r.k === "ratio" || r.s);
  return (
    <div className="fin-view">
      <div className="fin-toolbar">
        <div className="fin-toggle">
          <button className={view === "full" ? "is-on" : ""} onClick={() => setView("full")}>Full</button>
          <button className={view === "summary" ? "is-on" : ""} onClick={() => setView("summary")}>Summary</button>
        </div>
        <button className="btn-pdf">⇪ Import from PDF</button>
        <div className="spacer"></div>
        <span className="fin-toolbar-note">T-12 period <b>Apr 25 – Mar 26</b></span>
      </div>
      <div className="fin-legend">
        <span><i className="in"></i> Entered / imported</span>
        <span><i className="t12"></i> T-12 actual</span>
        <span><i className="proj"></i> Computed projection</span>
      </div>
      <div className="fin-sheetwrap">
        <table className="fin-sheet">
          <thead>
            <tr>
              <th className="lbl">{view === "full" ? "Full income statement" : "Summary income statement"}</th>
              {IS_COLS.map((c, i) => (
                <th key={i} className={isColCls(i)}>{c.l}{c.sub && <span className="fin-th-sub">{c.sub}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              if (r.k === "grp") return <tr className="grp" key={ri}><th className="row">{r.l}</th>{IS_COLS.map((c, i) => <td key={i} className={isColCls(i)}></td>)}</tr>;
              if (r.k === "ratio") return <tr key={ri}><th className="row"></th><td colSpan={7} className="fin-expense-ratio">{r.l}</td></tr>;
              const rowCls = r.k === "sub" ? "sub" : r.k === "total" ? "total" : r.k === "noi" ? "noi" : "";
              const computed = r.k !== "line";
              return (
                <tr className={rowCls} key={ri}>
                  <th className="row">{r.l}</th>
                  {r.v.map((val, i) => {
                    const cls = isColCls(i);
                    if (!computed && i < 3) return <FinInputCell key={i} val={val} cls={cls} />;
                    return <FinValCell key={i} val={val} cls={cls} />;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Financials() {
  const [sub, setSub] = React.useState("is");
  const tabs = [["is", "Income Statement"], ["t12", "T-12 Monthly Detail"], ["ga", "Growth Assumptions"], ["om", "Operating Model"]];
  return (
    <div className="fin-root">
      <div className="fin-subnav">
        {tabs.map(([k, l]) => <button key={k} className={k === sub ? "is-on" : ""} onClick={() => setSub(k)}>{l}</button>)}
        <div className="spacer" style={{ flex: 1 }}></div>
        <button className="btn btn-primary" style={{ margin: "4px 0" }}>Save financials</button>
      </div>
      {sub === "is" && <IncomeStatement />}
      {sub === "t12" && <window.T12Detail />}
      {sub === "ga" && <window.GrowthAssumptions />}
      {sub === "om" && <window.OperatingModel />}
    </div>
  );
}

Object.assign(window, { Financials, IncomeStatement, FinValCell, FinInputCell, IS_COLS, isColCls, FIN_IS });
