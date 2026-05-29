/* ============================================================
   COMP DATABASE — list + side preview (no more wide table)
   Same pattern as Properties: pick a comp → preview loads on the
   right with an attachable photo and click-to-edit fields.
   ============================================================ */

const CDB_KPIS = [
  ["Total comps", "7,716"], ["Sold comps", "6,376"], ["Median $/unit", "$217,042"],
  ["Median GRM", "14.11×"], ["Median cap", "5.2%"], ["Med Active DOM", "30d"],
  ["Med Total DOM", "85d"], ["Med Escrow", "43d"],
];

const CDB_ROWS = [
  { id: "paramount", name: "Paramount Apartments", addr: "208 SW Stark St", sub: "Downtown Portland", st: "Sold", units: 66, era: "Pre-1940", date: "Sep 2025", price: "$11,000,000", ppu: "$166,667", psf: "$188", grm: "—", cap: "—", adom: "44d", tdom: "120d", escrow: "38d", notes: "Trophy downtown asset, partial historic credits in play." },
  { id: "eighth", name: "1540–1542 8th St", addr: "1540 8th St", sub: "Damascus", st: "Sold", units: 2, era: "1970–1990", date: "Sep 2024", price: "$690,000", ppu: "$345,000", psf: "$248", grm: "—", cap: "2.1%", adom: "12d", tdom: "33d", escrow: "21d", notes: "Owner-occupant buyer; thin cap, premium for condition." },
  { id: "sundial", name: "Sundial · 7875 SW Vlahos", addr: "7875 SW Vlahos Dr", sub: "Wilsonville", st: "Sold", units: 120, era: "1990–2010", date: "Sep 2024", price: "$25,787,500", ppu: "$214,896", psf: "$231", grm: "—", cap: "—", adom: "—", tdom: "—", escrow: "60d", notes: "Institutional sale, portfolio buyer." },
  { id: "escher", name: "The Escher · 1906 NW 25th", addr: "1906 NW 25th Ave", sub: "Northwest Portland", st: "Sold", units: 8, era: "Pre-1940", date: "Sep 2021", price: "$1,950,000", ppu: "$243,750", psf: "$262", grm: "14.07", cap: "4.8%", adom: "21d", tdom: "96d", escrow: "45d", notes: "Renovated; strong rents post-reno." },
  { id: "fairfield", name: "190 E Fairfield St", addr: "190 E Fairfield St", sub: "Gladstone", st: "Sold", units: 2, era: "1990–2010", date: "Sep 2021", price: "$580,000", ppu: "$290,000", psf: "$254", grm: "—", cap: "—", adom: "9d", tdom: "30d", escrow: "30d", notes: "" },
  { id: "appleknoll", name: "Apple Knoll Apartments", addr: "5400 NE 102nd Ave", sub: "Vancouver", st: "Sold", units: 23, era: "1970–1990", date: "Sep 2020", price: "$2,950,000", ppu: "$128,261", psf: "$143", grm: "—", cap: "—", adom: "—", tdom: "—", escrow: "42d", notes: "" },
  { id: "ankeny", name: "1842–1848 SE Ankeny St", addr: "1842 SE Ankeny St", sub: "Southeast Portland", st: "Active", units: 4, era: "Pre-1940", date: "listed Aug 2025", price: "$925,000", ppu: "$231,250", psf: "$228", grm: "11.96", cap: "5.14%", adom: "61d", tdom: "61d", escrow: "—", notes: "Our active listing — benchmark subject." },
  { id: "belmont", name: "5802–5824 SE Belmont St", addr: "5802 SE Belmont St", sub: "Southeast Portland", st: "Pending", units: 12, era: "Pre-1940", date: "pending Oct 2025", price: "$1,675,000", ppu: "$139,583", psf: "$176", grm: "12.40", cap: "5.50%", adom: "33d", tdom: "33d", escrow: "in escrow", notes: "" },
  { id: "kerns", name: "The Kerns · 2705 NE Couch", addr: "2705 NE Couch St", sub: "Northeast Portland", st: "Sold", units: 4, era: "1940–1970", date: "Mar 2024", price: "$1,100,000", ppu: "$275,000", psf: "$268", grm: "13.10", cap: "5.26%", adom: "36d", tdom: "78d", escrow: "42d", notes: "" },
  { id: "foster", name: "6073 SE Foster Rd", addr: "6073 SE Foster Rd", sub: "Beaverton", st: "Sold", units: 4, era: "1940–1970", date: "Mar 2024", price: "$855,000", ppu: "$213,750", psf: "$179", grm: "13.27", cap: "6.07%", adom: "7d", tdom: "33d", escrow: "26d", notes: "" },
];

function CdbStatus({ st }) {
  const cls = st === "Sold" ? "active" : st === "Pending" ? "uc" : "prospect";
  return <span className={`ap-badge ${cls}`}>{st}</span>;
}

function CdbEdit({ value, tag = "span", className = "" }) {
  const T = tag;
  return (
    <T className={`cdb-edit ${className}`} contentEditable suppressContentEditableWarning
      onKeyDown={(e) => { if (e.key === "Enter" && tag !== "div") { e.preventDefault(); e.currentTarget.blur(); } }}>
      {value}
    </T>
  );
}

function CdbFact({ label, value }) {
  return (
    <div className="pr-fact">
      <span className="pr-fact-l">{label}</span>
      <span className="pr-fact-v"><CdbEdit value={value} /></span>
    </div>
  );
}

function CompPreview({ c }) {
  return (
    <aside className="pl-preview">
      <div className="pl-preview-bar">
        <span className="pl-preview-crumb">Comp preview · click any value to edit</span>
        <CdbStatus st={c.st} />
      </div>
      <image-slot key={"slot-" + c.id} id={"comp-" + c.id} shape="rect"
        placeholder="Drop a photo of this comp"
        style={{ display: "block", width: "100%", height: "168px" }}></image-slot>
      <div className="pl-preview-body">
        <h2 className="pl-preview-title"><CdbEdit value={c.name} /></h2>
        <p className="pl-preview-meta"><CdbEdit value={c.addr} /> · {c.sub}</p>

        <p className="pr-card-h" style={{ marginTop: 6 }}>Sale</p>
        <div className="pr-facts solo" style={{ gridTemplateColumns: "1fr" }}>
          <CdbFact label="Status" value={c.st} />
          <CdbFact label="Sale date" value={c.date} />
          <CdbFact label="Sale price" value={c.price} />
          <CdbFact label="Sold $/unit" value={c.ppu} />
          <CdbFact label="$ / SF" value={c.psf} />
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Returns & velocity</p>
        <div className="pr-facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <CdbFact label="Cap rate" value={c.cap} />
          <CdbFact label="GRM" value={c.grm} />
          <CdbFact label="Units" value={String(c.units)} />
          <CdbFact label="Era" value={c.era} />
          <CdbFact label="Active DOM" value={c.adom} />
          <CdbFact label="Total DOM" value={c.tdom} />
          <CdbFact label="Escrow" value={c.escrow} />
          <CdbFact label="Sub-market" value={c.sub} />
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Notes</p>
        <div className="cdb-note-box"><CdbEdit tag="div" value={c.notes || "Add a note…"} /></div>
      </div>
    </aside>
  );
}

function CompDatabase() {
  const [sel, setSel] = React.useState(CDB_ROWS[0].id);
  const c = CDB_ROWS.find((x) => x.id === sel) || CDB_ROWS[0];
  return (
    <ApShell active="Comp Database">
      <div className="ap-head">
        <div>
          <p className="ap-head-eyebrow">Comparable sales</p>
          <h1 className="ap-head-title">Comp Database</h1>
          <p className="ap-head-meta"><b>7,716</b> comps · Portland metro · feeds every proposal</p>
        </div>
        <div className="ap-head-actions"><button className="btn btn-primary">+ Update comps</button></div>
      </div>

      <div className="cdb-kpis">
        {CDB_KPIS.map(([l, v]) => (
          <div key={l} className="cdb-kpi"><p className="cdb-kpi-l">{l}</p><p className="cdb-kpi-v">{v}</p></div>
        ))}
      </div>

      <div className="ap-toolbar">
        <div className="ap-search"><span className="ap-search-icon">⌕</span><input placeholder="Search name, sub-market, zip…" /></div>
        <div className="cdb-selects">
          <button className="cdb-select">All statuses ⌄</button>
          <button className="cdb-select">All sub-markets ⌄</button>
          <button className="cdb-select">All types ⌄</button>
        </div>
      </div>

      <div className="pl-split">
        <div className="pl-split-list">
          <div className="pl-rows">
            {CDB_ROWS.map((x) => (
              <div key={x.id} className={`pl-row ${x.id === sel ? "is-sel" : ""}`} onClick={() => setSel(x.id)}>
                <div>
                  <div className="pl-row-addr">{x.name}</div>
                  <div className="pl-row-sub">{x.sub} · {x.units} units · {x.era}</div>
                </div>
                <div>
                  <div className="pl-row-fig">{x.price}</div>
                  <div className="pl-row-figsub">{x.ppu}/unit · {x.st}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <CompPreview c={c} />
      </div>
    </ApShell>
  );
}

window.CompDatabase = CompDatabase;
