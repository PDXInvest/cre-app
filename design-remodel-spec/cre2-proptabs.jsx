/* ============================================================
   PROPOSAL · RENT ROLL  (faithful to live app)
   KPI strip + editable unit table. Columns and KPIs mirror the
   live app; values illustrative for 1842–1848 SE Ankeny St.
   Editable cells render as inputs/selects (manual entry or
   PDF import). Styling only — the live app holds the real data.
   ============================================================ */

const RR_KPIS = [
  { l: "Total units", v: "4" },
  { l: "Occupied", v: "4" },
  { l: "Vacant", v: "0" },
  { l: "Occupancy", v: "100.0%" },
  { l: "Avg rent", v: "$1,261" },
  { l: "Total rent", v: "$5,045" },
  { l: "Total RUBS", v: "—" },
  { l: "Total market", v: "$6,135" },
  { l: "Total UW rent", v: "$5,045", pos: true },
];

const RR_UNITS = [
  { unit: "1", type: "1 Bed / 1 Ba", sf: "1,100", tenant: "Kristiana Siegel", rent: "900",  rubs: "0", rec: "0", eff: "06/01/2025", movein: "05/10/2023", leaseEnd: "05/31/2026", lease: "Fixed Term", dep: "1,750", prepaid: "0" },
  { unit: "2", type: "Studio / 1 Ba", sf: "950",  tenant: "Haley Douglas",   rent: "1,350", rubs: "0", rec: "0", eff: "02/01/2025", movein: "01/15/2025", leaseEnd: "01/31/2026", lease: "Month-to-month", dep: "2,025", prepaid: "0" },
  { unit: "3", type: "Studio / 1 Ba", sf: "963",  tenant: "Brianna Wallen",  rent: "1,495", rubs: "0", rec: "0", eff: "09/01/2025", movein: "08/18/2023", leaseEnd: "08/31/2026", lease: "Fixed Term", dep: "1,495", prepaid: "0" },
  { unit: "4", type: "1 Bed / 1 Ba", sf: "1,050", tenant: "Caitlin Baird",   rent: "1,300", rubs: "0", rec: "0", eff: "08/01/2025", movein: "05/21/2021", leaseEnd: "07/31/2026", lease: "Fixed Term", dep: "1,195", prepaid: "0" },
];

const RR_TYPES = ["Studio / 1 Ba", "1 Bed / 1 Ba", "2 Bed / 1 Ba", "2 Bed / 2 Ba", "3 Bed / 2 Ba"];
const RR_LEASE = ["Fixed Term", "Month-to-month", "Vacant"];

function RRNum({ v, wide }) {
  return <input className="rr-in" defaultValue={v} style={wide ? { minWidth: 64 } : { minWidth: 52 }} />;
}

function RentRoll() {
  return (
    <div className="uw-pane">
      <div className="uw-pane-head">
        <div>
          <h2>Rent roll</h2>
          <p>4 units · 100% occupied · in-place rent vs. underwritten market</p>
        </div>
      </div>

      <div className="rr-kpis">
        {RR_KPIS.map((k) => (
          <div className="rr-kpi" key={k.l}>
            <p className="rr-kpi-l">{k.l}</p>
            <p className={`rr-kpi-v ${k.pos ? "pos" : ""}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="uw-actions" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary">+ Add unit</button>
        <button className="btn btn-secondary">Save rent roll</button>
        <button className="btn-pdf">⇪ Import from PDF</button>
      </div>

      <div className="rr-tablewrap">
        <table className="rr-table">
          <thead>
            <tr>
              <th>#</th><th>Unit #</th><th>Unit type</th><th>SF</th><th>Tenant</th><th>Status</th>
              <th>Rent</th><th>RUBS</th><th>Recurring</th><th>Eff. date</th><th>Move-in</th>
              <th>Lease end</th><th>Lease type</th><th>Deposit</th><th>Pre-paid</th>
            </tr>
          </thead>
          <tbody>
            {RR_UNITS.map((u, i) => (
              <tr key={u.unit}>
                <td className="idx">{i + 1}</td>
                <td className="editcell"><input className="rr-in l" defaultValue={u.unit} style={{ minWidth: 44 }} /></td>
                <td className="editcell"><select className="rr-sel" defaultValue={u.type} style={{ minWidth: 108 }}>{RR_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
                <td className="editcell"><RRNum v={u.sf} /></td>
                <td className="editcell"><input className="rr-in l" defaultValue={u.tenant} style={{ minWidth: 128 }} /></td>
                <td className="editcell"><select className="rr-sel" defaultValue="Current" style={{ minWidth: 88 }}><option>Current</option><option>Notice</option><option>Vacant</option></select></td>
                <td className="editcell"><RRNum v={u.rent} /></td>
                <td className="editcell"><RRNum v={u.rubs} /></td>
                <td className="editcell"><RRNum v={u.rec} /></td>
                <td className="editcell"><input className="rr-in l" defaultValue={u.eff} style={{ minWidth: 94 }} /></td>
                <td className="editcell"><input className="rr-in l" defaultValue={u.movein} style={{ minWidth: 94 }} /></td>
                <td className="editcell"><input className="rr-in l" defaultValue={u.leaseEnd} style={{ minWidth: 94 }} /></td>
                <td className="editcell"><select className="rr-sel" defaultValue={u.lease} style={{ minWidth: 132 }}>{RR_LEASE.map((t) => <option key={t}>{t}</option>)}</select></td>
                <td className="editcell"><RRNum v={u.dep} wide /></td>
                <td className="editcell"><RRNum v={u.prepaid} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="l" colSpan={6}>Totals · 4 units</td>
              <td>$5,045</td><td>—</td><td>—</td>
              <td className="l" colSpan={6}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { RentRoll });
