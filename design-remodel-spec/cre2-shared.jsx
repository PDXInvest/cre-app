/* ============================================================
   EQUITY PACIFIC CRE APP — shared shell + sample data
   ============================================================ */

const AP_ICONS = {
  properties: "M3 9.5 L8 5.5 L13 9.5 M4.2 8.6 V13 H11.8 V8.6",
  proposals:  "M4 2.5 H10 L12.5 5 V13.5 H4 Z M9.5 2.5 V5.5 H12.5 M5.8 8 H10.2 M5.8 10.4 H10.2",
  comps:      "M2.5 13 V3 M6.2 13 V6 M9.8 13 V8 M13.5 13 V4 M2 13 H14",
  snapshot:   "M2.5 11 L6 7 L8.5 9 L13.5 3.5 M13.5 3.5 H10.5 M13.5 3.5 V6.5",
  om:         "M4 2.5 H12 V13.5 H4 Z M6 6 H10 M6 8.4 H10 M6 10.8 H8.5",
};

function ApNavIcon({ d }) {
  return (
    <span className="ap-navicon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

const ApNavContext = React.createContext(null);

function ApShell({ active, onNav, children }) {
  const ctx = React.useContext(ApNavContext);
  const handleNav = onNav || (ctx && ctx.onNav) || (() => {});
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem("ap-collapsed") === "1"; } catch (e) { return false; }
  });
  const toggle = () => setCollapsed((v) => {
    const nv = !v;
    try { localStorage.setItem("ap-collapsed", nv ? "1" : "0"); } catch (e) {}
    return nv;
  });
  const items = [
    ["Properties", "properties"],
    ["Proposals", "proposals"],
    ["Comp Database", "comps"],
    ["Market Snapshot", "snapshot"],
  ];
  return (
    <div className="ap">
      <aside className={`ap-side ${collapsed ? "is-collapsed" : ""}`}>
        <div className="ap-brand">
          <span className="ap-brand-mark"></span>
          <span className="ap-brand-txt">
            <span className="ap-brand-name">Method Multifamily</span>
            <span className="ap-brand-sub">Brokerage</span>
          </span>
        </div>
        <p className="ap-navlabel">Workspace</p>
        <nav className="ap-nav">
          {items.map(([label, key]) => (
            <button key={key} title={label} className={`ap-navitem ${label === active ? "is-on" : ""}`}
              onClick={() => handleNav(label)}>
              <ApNavIcon d={AP_ICONS[key]} /><span className="ap-navtext">{label}</span>
            </button>
          ))}
        </nav>
        <div className="ap-nav-spacer"></div>
        <button className="ap-collapse" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <span className="ap-collapse-ic">{collapsed ? "»" : "«"}</span>
          <span className="ap-navtext">Collapse</span>
        </button>
        <div className="ap-user">
          <span className="avatar">BF</span>
          <span className="ap-user-txt">
            <span className="ap-user-name" style={{ display: "block" }}>Benjamin Ficker</span>
            <span className="ap-user-role">Principal Broker</span>
          </span>
        </div>
      </aside>
      <div className="ap-main">{children}</div>
    </div>
  );
}

/* ---- sample properties (facts only — the system of record) ---- */
const AP_PROPS = [
  { id: "porter",   addr: "010 SW Porter St",        city: "Portland, OR 97201", submkt: "Southwest Portland", units: 28, type: "21–50 Units",  yr: 1976, era: "1970–1990", sf: 24800, sale: "$1,221,500", saleDate: "Sep 2003", ppu: "$43,625", owner: "Porter Holdings LLC", contact: "David Morgenstein", cls: "C", tax: "R128813", prop: null },
  { id: "meade",    addr: "0103 SW Meade St",        city: "Portland, OR 97201", submkt: "Southwest Portland", units: 30, type: "21–50 Units",  yr: 2012, era: "2010+",     sf: 27600, sale: "$370,000",   saleDate: "May 2012", ppu: "$12,333", owner: "Meade St Partners", contact: "—", cls: "B", tax: "R142200", prop: null },
  { id: "grover",   addr: "018 SW Grover St",        city: "Portland, OR 97239", submkt: "Southwest Portland", units: 4,  type: "Fourplex",     yr: 1888, era: "Pre-1940",  sf: 3960,  sale: "—",          saleDate: "Dec 2008", ppu: "—",      owner: "—", contact: "Helen Vasquez", cls: "C", tax: "R118440", prop: null },
  { id: "ankeny",   addr: "1842–1848 SE Ankeny St",  city: "Portland, OR 97214", submkt: "Southeast Portland", units: 4,  type: "Fourplex",     yr: 1884, era: "Pre-1940",  sf: 4063,  sale: "$715,000",   saleDate: "May 2015", ppu: "$178,750", owner: "Ankeny LLC", contact: "Lynn Green", cls: "C", tax: "R123158", prop: "Working" },
  { id: "belmont",  addr: "5802–5824 SE Belmont St", city: "Portland, OR 97215", submkt: "Southeast Portland", units: 12, type: "9–20 Units",   yr: 1925, era: "Pre-1940",  sf: 11200, sale: "$1,350,000", saleDate: "Feb 2019", ppu: "$112,500", owner: "Belmont Court LLC", contact: "R. Okafor", cls: "C", tax: "R155021", prop: "New" },
  { id: "edison",   addr: "8220–8236 N Edison St",   city: "Portland, OR 97203", submkt: "North Portland",     units: 9,  type: "9–20 Units",   yr: 1962, era: "1940–1970", sf: 8400,  sale: "$980,000",   saleDate: "Aug 2017", ppu: "$108,889", owner: "Edison Group", contact: "—", cls: "C", tax: "R160988", prop: "Working" },
  { id: "alberta",  addr: "1716 N Alberta St",       city: "Portland, OR 97217", submkt: "North Portland",     units: 2,  type: "Duplex/Triplex", yr: 1909, era: "Pre-1940", sf: 1850,  sale: "$540,000",   saleDate: "Jun 2021", ppu: "$270,000", owner: "—", contact: "Tom Reilly", cls: "C", tax: "R129955", prop: "New" },
  { id: "lane",     addr: "0208 SW Lane St",         city: "Portland, OR 97239", submkt: "Southwest Portland", units: 2,  type: "Duplex/Triplex", yr: 1948, era: "1940–1970", sf: 1720,  sale: "—",         saleDate: "Jan 2005", ppu: "—",      owner: "—", contact: "—", cls: "C", tax: "R117002", prop: null },
  { id: "hamilton", addr: "0219–0221 SW Hamilton St", city: "Portland, OR 97239", submkt: "Southwest Portland", units: 4, type: "Fourplex",     yr: 1890, era: "Pre-1940",  sf: 3640,  sale: "$360,000",   saleDate: "Oct 2004", ppu: "$90,000", owner: "Hamilton Ave Trust", contact: "—", cls: "C", tax: "R118821", prop: null },
];

Object.assign(window, { ApShell, ApNavIcon, AP_ICONS, AP_PROPS, ApNavContext });
