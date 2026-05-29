/* ============================================================
   PROPOSAL · DUE DILIGENCE  (faithful to live app)
   Component cards, each with its own discrete fields. These are
   captured on the seller discovery call and merge into the OM /
   downstream documents. Styling only — field set mirrors the
   live app exactly (Roof, Heat source, Windows, Sewer line,
   Exterior/siding, Electrical panel, Plumbing, Water heaters,
   Foundation, Parking, RUBS, Sprinkler, Oil tanks + notes).
   ============================================================ */

const DD_CARDS = [
  { h: "Roof",             fields: [{ l: "Type" }, { l: "Year installed" }, { l: "Notes" }] },
  { h: "Heat source",      fields: [{ l: "Type" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Windows",          fields: [{ l: "Type / style" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Sewer line",       fields: [{ l: "Type" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Exterior / siding", fields: [{ l: "Type" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Electrical panel", fields: [{ l: "Type / brand" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Plumbing",         fields: [{ l: "Type" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Water heaters",    fields: [{ l: "Count / type" }, { l: "Install / age" }, { l: "Notes" }] },
  { h: "Foundation", cols: 2, fields: [{ l: "Type" }, { l: "Notes" }] },
  { h: "Parking",          fields: [{ l: "Surface type" }, { l: "Count" }, { l: "Ratio" }] },
  { h: "RUBS", cols: 2,    fields: [{ l: "Type" }, { l: "Notes" }] },
  { h: "Sprinkler", cols: 1, fields: [{ l: "Type / notes" }] },
  { h: "Oil tanks",        fields: [
    { l: "Present", sel: ["—", "Yes", "No"] },
    { l: "Decommissioned", sel: ["—", "Yes", "No", "N/A"] },
    { l: "Notes" },
  ] },
];

function DDField({ f }) {
  return (
    <div className="dd-f">
      <label>{f.l}</label>
      {f.sel
        ? <select defaultValue={f.sel[0]}>{f.sel.map((o) => <option key={o}>{o}</option>)}</select>
        : <input type="text" />}
    </div>
  );
}

function DueDiligence() {
  return (
    <div className="uw-pane">
      <div className="uw-pane-head">
        <div>
          <h2>Due diligence</h2>
          <p>Captured on the seller discovery call · merges into the offering memo</p>
        </div>
        <div className="uw-actions">
          <button className="btn-pdf">⇪ Import inspection PDF</button>
          <button className="btn btn-primary">Save due diligence</button>
        </div>
      </div>

      <div className="dd-callbar">
        <span className="dd-callbar-l">Discovery call</span>
        <span className="dd-callbar-v">Seller contact <b>Lynn Green</b> · Last updated <b>2 days ago</b></span>
      </div>

      <div className="dd-grid2">
        {DD_CARDS.map((c) => (
          <div className="dd-card" key={c.h}>
            <p className="dd-card-h">{c.h}</p>
            <div className={`dd-fields ${c.cols === 2 ? "c2" : c.cols === 1 ? "c1" : ""}`}>
              {c.fields.map((f) => <DDField key={f.l} f={f} />)}
            </div>
          </div>
        ))}
        <div className="dd-card wide">
          <p className="dd-card-h">Due diligence notes</p>
          <textarea className="dd-area" rows={4}></textarea>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DueDiligence });
