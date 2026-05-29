/* ============================================================
   PROPERTIES — list (2 variations) + restructured record
   Properties = the system of record for property facts. The old
   app buried these in 5 thin, mostly-empty tabs; here the record
   is one rich, scannable page.
   ============================================================ */

function PropBadge({ stage }) {
  if (!stage) return <span className="ap-dash">—</span>;
  const cls = stage === "New" ? "prospect" : "working";
  return <span className={`ap-badge ${cls}`}>{stage}</span>;
}

function PropFilters() {
  return (
    <div className="ap-filters">
      <button className="fchip"><span className="fchip-label">Type</span><span className="fchip-value">All</span><span className="fchip-caret">⌄</span></button>
      <button className="fchip"><span className="fchip-label">Units</span><span className="fchip-value">Any</span><span className="fchip-caret">⌄</span></button>
      <button className="fchip"><span className="fchip-label">Sub-market</span><span className="fchip-value">All</span><span className="fchip-caret">⌄</span></button>
      <button className="fchip is-muted"><span className="fchip-label">Era</span><span className="fchip-value">Any</span><span className="fchip-caret">⌄</span></button>
    </div>
  );
}

/* ---------- PROPERTIES LIST — dense table; click a row → list + preview ---------- */
function PropertiesList({ onOpen = () => {} }) {
  const [sel, setSel] = React.useState(null);
  const p = sel ? AP_PROPS.find((x) => x.id === sel) : null;
  return (
    <ApShell active="Properties">
      <div className="ap-head">
        <div>
          <p className="ap-head-eyebrow">System of record</p>
          <h1 className="ap-head-title">Properties</h1>
          <p className="ap-head-meta"><b>20,847</b> properties · Portland metro</p>
        </div>
        <div className="ap-head-actions">
          <button className="btn btn-secondary">Import properties</button>
        </div>
      </div>
      <div className="ap-toolbar">
        <div className="ap-search"><span className="ap-search-icon">⌕</span><input placeholder="Search by address, name, or owner…" /></div>
        <PropFilters />
        <span className="ap-toolbar-meta">{sel ? "Click a row to preview" : "Showing 9 of 20,847"}</span>
      </div>

      {!sel ? (
        <div className="ap-tablewrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Address</th><th>Sub-market</th><th className="num">Units</th>
                <th>Type</th><th className="num">Yr Built</th><th className="num">Last Sale</th><th>Proposal</th>
              </tr>
            </thead>
            <tbody>
              {AP_PROPS.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)}>
                  <td><div className="ap-cell-primary">{x.addr}</div><div className="ap-cell-sub">{x.city}</div></td>
                  <td><span className="ap-type">{x.submkt}</span></td>
                  <td className="num">{x.units}</td>
                  <td><span className="ap-type">{x.type}</span></td>
                  <td className="num">{x.yr}</td>
                  <td className="num">
                    {x.sale === "—" ? <span className="ap-dash">—</span> : <><span className="ap-cell-figure">{x.sale}</span><div className="ap-cell-date">{x.saleDate}</div></>}
                  </td>
                  <td><PropBadge stage={x.prop} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pl-split">
          <div className="pl-split-list">
            <div className="pl-rows">
              {AP_PROPS.map((x) => (
                <div key={x.id} className={`pl-row ${x.id === sel ? "is-sel" : ""}`} onClick={() => setSel(x.id)}>
                  <div>
                    <div className="pl-row-addr">{x.addr}</div>
                    <div className="pl-row-sub">{x.submkt} · {x.units} units · {x.type}</div>
                  </div>
                  <div>
                    {x.sale === "—" ? <div className="pl-row-fig ap-dash">—</div> : <div className="pl-row-fig">{x.sale}</div>}
                    <div className="pl-row-figsub">{x.prop ? x.prop + " proposal" : "last sale " + x.saleDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <PropPreview p={p} onClose={() => setSel(null)} onOpen={onOpen} />
        </div>
      )}
    </ApShell>
  );
}

function PropPreview({ p, onClose, onOpen = () => {} }) {
  return (
    <aside className="pl-preview">
      <div className="pl-preview-bar">
        <span className="pl-preview-crumb">Preview</span>
        <button className="pl-preview-close" onClick={onClose}>✕ Back to table</button>
      </div>
      <div className="pr-photo" style={{ height: 124, borderRadius: 0 }}><span className="pr-photo-label">Property photo</span></div>
      <div className="pl-preview-body">
        <h2 className="pl-preview-title">{p.addr}</h2>
        <p className="pl-preview-meta">{p.city} · {p.units} units · {p.type}</p>

        <p className="pr-card-h" style={{ marginTop: 6 }}>Property</p>
        <div className="pr-facts solo" style={{ gridTemplateColumns: "1fr" }}>
          <div className="pr-fact"><span className="pr-fact-l">Year built</span><span className="pr-fact-v">{p.yr} · {p.era}</span></div>
          <div className="pr-fact"><span className="pr-fact-l">Building SF</span><span className="pr-fact-v">{p.sf.toLocaleString()}</span></div>
          <div className="pr-fact"><span className="pr-fact-l">Owner</span><span className="pr-fact-v">{p.owner || "—"}</span></div>
          <div className="pr-fact"><span className="pr-fact-l">Contact</span><span className="pr-fact-v">{p.contact}</span></div>
          <div className="pr-fact"><span className="pr-fact-l">Last sale</span><span className="pr-fact-v">{p.sale} · {p.saleDate}</span></div>
          <div className="pr-fact"><span className="pr-fact-l">Last $/unit</span><span className="pr-fact-v">{p.ppu}</span></div>
        </div>

        <p className="pr-card-h" style={{ marginTop: 16 }}>Market context · {p.submkt}</p>
        <div className="pr-metrics">
          <div className="pr-metric"><p className="pr-metric-l">$ / Unit · sold</p><p className="pr-metric-v">$216k</p><p className="pr-metric-d neg">▼ subject below</p></div>
          <div className="pr-metric"><p className="pr-metric-l">Cap rate</p><p className="pr-metric-v">5.62%</p><p className="pr-metric-d pos">▲ +18 bps</p></div>
          <div className="pr-metric"><p className="pr-metric-l">GRM</p><p className="pr-metric-v">12.8×</p><p className="pr-metric-d pos">▼ cheaper</p></div>
          <div className="pr-metric"><p className="pr-metric-l">90d volume</p><p className="pr-metric-v">$14.2M</p><p className="pr-metric-d pos">▲ +8.4%</p></div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onOpen(p.id)}>Open record</button>
          <button className="btn btn-primary" style={{ flex: 1 }}>+ New proposal</button>
        </div>
      </div>
    </aside>
  );
}

/* ---------- RESTRUCTURED RECORD ---------- */
function PropertyRecord({ propId = "ankeny", onBack = () => {}, onNewProposal = () => {} }) {
  const p = AP_PROPS.find((x) => x.id === propId) || AP_PROPS[0];
  const [scope, setScope] = React.useState("Sub-Market");
  return (
    <ApShell active="Properties">
      <div className="pr">
        <div className="pr-hero">
          <div className="pr-photo"><span className="pr-photo-label">Property photo</span></div>
          <div className="pr-hero-r">
            <button className="pr-back" onClick={onBack}>‹ Properties</button>
            <h1 className="pr-title">{p.addr}</h1>
            <p className="pr-meta">{p.city} · <b>{p.units} units</b> · {p.type} · Built {p.yr}</p>
            <div className="pr-hero-actions">
              <button className="btn btn-secondary">Edit</button>
              <button className="btn btn-primary" onClick={onNewProposal}>+ New proposal</button>
            </div>
          </div>
        </div>

        <div className="pr-body">
          {/* LEFT — facts */}
          <div className="pr-col">
            <div className="pr-card">
              <p className="pr-card-h">Property</p>
              <div className="pr-facts">
                <div className="pr-fact"><span className="pr-fact-l">Sub-market</span><span className="pr-fact-v">{p.submkt}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Market</span><span className="pr-fact-v">Portland · OR-WA</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Type</span><span className="pr-fact-v">{p.type}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Total units</span><span className="pr-fact-v">{p.units}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Building SF</span><span className="pr-fact-v">{p.sf.toLocaleString()}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Year built</span><span className="pr-fact-v">{p.yr}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Era</span><span className="pr-fact-v">{p.era}</span></div>
                <div className="pr-fact"><span className="pr-fact-l"># buildings</span><span className="pr-fact-v dash">—</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Class</span><span className="pr-fact-v">{p.cls}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Tax ID</span><span className="pr-fact-v">{p.tax}</span></div>
              </div>
            </div>
            <div className="pr-card">
              <p className="pr-card-h">Ownership</p>
              <div className="pr-facts">
                <div className="pr-fact"><span className="pr-fact-l">Owner LLC</span><span className="pr-fact-v">{p.owner || "—"}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Contact</span><span className="pr-fact-v">{p.contact}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Last sale</span><span className="pr-fact-v">{p.saleDate}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Last price</span><span className="pr-fact-v">{p.sale}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Last $/unit</span><span className="pr-fact-v">{p.ppu}</span></div>
                <div className="pr-fact"><span className="pr-fact-l">Last cap</span><span className="pr-fact-v dash">—</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT — market context + activity */}
          <div className="pr-col">
            <div className="pr-card">
              <p className="pr-card-h">
                Market context
                <span className="pr-scope">
                  {["Market", "County", "Sub-Market", "Zip"].map((s) => (
                    <button key={s} className={s === scope ? "is-on" : ""} onClick={() => setScope(s)}>{s}</button>
                  ))}
                </span>
              </p>
              <div className="pr-metrics">
                <div className="pr-metric"><p className="pr-metric-l">$ / Unit · sold</p><p className="pr-metric-v">$216k</p><p className="pr-metric-d neg">▼ subject below mkt</p></div>
                <div className="pr-metric"><p className="pr-metric-l">Cap rate · sold</p><p className="pr-metric-v">5.62%</p><p className="pr-metric-d pos">▲ +18 bps QoQ</p></div>
                <div className="pr-metric"><p className="pr-metric-l">GRM · sold</p><p className="pr-metric-v">12.8×</p><p className="pr-metric-d pos">▼ cheaper on income</p></div>
                <div className="pr-metric"><p className="pr-metric-l">90d volume</p><p className="pr-metric-v">$14.2M</p><p className="pr-metric-d pos">▲ +8.4%</p></div>
              </div>
            </div>
            <div className="pr-card">
              <p className="pr-card-h">Proposals</p>
              <div className="pr-mini">
                <div className="pr-mini-row">
                  <div><div className="pr-mini-l">Ankeny St · underwriting</div><div className="pr-mini-sub">Working · updated 2d ago</div></div>
                  <span className="ap-badge working">Working</span>
                </div>
              </div>
            </div>
            <div className="pr-card">
              <p className="pr-card-h">Sale history</p>
              <div className="pr-mini">
                <div className="pr-mini-row"><div><div className="pr-mini-l">Sold · {p.saleDate}</div><div className="pr-mini-sub">{p.ppu}/unit</div></div><span className="pr-mini-r">{p.sale}</span></div>
                <div className="pr-mini-row"><div><div className="pr-mini-l">Sold · Mar 1998</div><div className="pr-mini-sub">$71,250/unit</div></div><span className="pr-mini-r">$285,000</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ApShell>
  );
}

Object.assign(window, { PropertiesList, PropPreview, PropertyRecord });
