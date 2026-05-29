/* ============================================================
   MARKET SNAPSHOT — chrome + views
   MSTopBar · MSFilterStrip · MSNowStrip (collapsible)
   MSBoard · MSFocus · MSPresent
   All state lives in the App (ms-app.jsx) and arrives as props.
   ============================================================ */

/* ---------- chrome ---------- */
function MSTopBar({ onNav }) {
  const items = ["Properties", "Proposals", "Comps", "Snapshot", "Pipeline"];
  return (
    <div className="topbar">
      <div className="topbar-l">
        <span className="brand">
          <span className="brand-mark"></span>
          <span className="brand-name">Method Multifamily</span>
        </span>
        <nav className="topnav">
          {items.map((it) => (
            <button key={it} className={`topnav-item ${it === "Snapshot" ? "topnav-active" : ""}`}
              onClick={() => it === "Snapshot" && onNav && onNav()}>{it}</button>
          ))}
        </nav>
      </div>
      <div className="topbar-c">
        <div className="search">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search properties, addresses, sellers…" />
          <span className="search-kbd">⌘ K</span>
        </div>
      </div>
      <div className="topbar-r">
        <span className="topbar-action">⌕</span>
        <span className="topbar-action">⌨</span>
        <span className="avatar">BF</span>
      </div>
    </div>
  );
}

function MSTimeframe({ tf, setTf }) {
  const opts = [["30d", "30"], ["90d", "90"], ["180d", "180"], ["365d", "365"]];
  return (
    <div className="tf-seg" title="Timeframe">
      {opts.map(([k, n]) => (
        <button key={k} className={k === tf ? "is-on" : ""} onClick={() => setTf(k)}>{n}</button>
      ))}
    </div>
  );
}

function MSChip({ label, value, muted }) {
  return (
    <button className={`fchip ${muted ? "is-muted" : ""}`}>
      <span className="fchip-label">{label}</span>
      <span className="fchip-value">{value}</span>
      <span className="fchip-caret">⌄</span>
    </button>
  );
}

function MSFilterStrip({ tf, setTf, onPresent }) {
  return (
    <div className="ms-filters is-stacked">
      <div className="ms-filter-row">
        <MSChip label="County" value="Multnomah" />
        <MSChip label="Sub-Market" value="SE Portland" />
        <MSChip label="Zip" value="All" muted />
        <MSChip label="Units" value="2–4" />
        <MSChip label="Era" value="Pre-1940" />
        <span className="ms-filter-div"></span>
        <span className="ms-filter-rowlabel">Window</span>
        <MSTimeframe tf={tf} setTf={setTf} />
      </div>
      <div className="ms-filter-row ms-filter-row-2">
        <span className="ms-filter-rowlabel">Refine</span>
        <MSChip label="Terms" value="All" muted />
        <MSChip label="Buyer" value="All" muted />
        <span className="ms-filter-spacer"></span>
        <button className="ms-saved"><span className="ms-saved-icon">★</span>Saved views</button>
        <button className="ms-compare">+ Compare</button>
        <button className="btn btn-primary" onClick={onPresent}>Present →</button>
      </div>
    </div>
  );
}

function MSSNCell({ l, v }) {
  return <div className="sn-cell"><span className="sn-l">{l}</span><span className="sn-v">{v}</span></div>;
}

function MSNowStrip() {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className={`snap-now ${expanded ? "is-expanded" : ""}`} onClick={() => setExpanded((e) => !e)}>
      <p className="snap-now-label">Right now</p>
      <div className="snap-now-group">
        <div className="snap-now-head">
          <span className="snap-now-n">12</span>
          <span className="snap-now-status">Active listings <em className="neg">−6 vs 90d</em></span>
        </div>
        <div className="snap-now-metrics">
          <MSSNCell l="Ask $/Unit" v="$355k" /><MSSNCell l="Ask Cap" v="5.10%" />
          <MSSNCell l="Ask GRM" v="13.5×" /><MSSNCell l="Med DOM" v="61d" />
        </div>
      </div>
      <div className="snap-now-group">
        <div className="snap-now-head">
          <span className="snap-now-n">4</span>
          <span className="snap-now-status">Under contract <em className="pos">+1</em></span>
        </div>
        <div className="snap-now-metrics">
          <MSSNCell l="$/Unit" v="$341k" /><MSSNCell l="Cap" v="5.50%" />
          <MSSNCell l="GRM" v="13.0×" /><MSSNCell l="Days→UC" v="29d" />
        </div>
      </div>
      <div className="snap-now-group snap-now-supply">
        <div className="snap-now-head">
          <span className="snap-now-n">2.1<span>mo</span></span>
          <span className="snap-now-status">Months of supply <em className="pos">tightening</em></span>
        </div>
      </div>
      <div className="snap-now-spacer"></div>
      <button className="snap-now-toggle" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
        <span className="snap-now-toggle-chev">⌄</span>{expanded ? "Hide deal stats" : "Show deal stats"}
      </button>
      <div className="snap-now-spacer"></div>
      <span className="snap-now-meta">Matched 48 properties · refreshed 2m ago</span>
    </div>
  );
}

/* ---------- helpers ---------- */
function msFillInsight(m, tf) {
  const { cur, prior, yoy } = msStats(m, tf);
  const dP = msDelta(m, cur, prior).txt.replace(/^\+/, "");
  const dY = msDelta(m, cur, yoy).txt.replace(/^\+/, "");
  return m.insight.replace("__dPrior__", dP).replace("__dYoY__", dY);
}

/* ---------- BOARD ---------- */
function MSBoard({ metricKey, setMetricKey, tf, split, setSplit, onOpenFocus }) {
  const m = MS_METRICS.find((x) => x.key === metricKey);
  const st = msStats(m, tf);
  const dP = msDelta(m, st.cur, st.prior);
  const dY = msDelta(m, st.cur, st.yoy);
  const comp = msCompSeries(m, split);
  return (
    <div className="bb-body">
      <div className="bb-left">
        <div className="bb-left-head">
          <h3 className="bb-left-title">Last {MS_TF_LABEL[tf]} · {MS_TF_N[tf]} sales matched</h3>
          <span className="bb-left-meta">Δ vs {MS_TF_PRIOR[tf]} · YoY · click a tile to drill in →</span>
        </div>
        <div className="bb-grid">
          {MS_METRICS.map((mm) => {
            const s = msStats(mm, tf);
            const p = msDelta(mm, s.cur, s.prior);
            const yy = msDelta(mm, s.cur, s.yoy);
            return (
              <div key={mm.key} className={`bb-tile ${mm.key === metricKey ? "is-active" : ""}`}
                onClick={() => setMetricKey(mm.key)}>
                <p className="bb-tile-l">{mm.name}</p>
                <p className="bb-tile-v">{msFmt(s.cur, mm.fmt)}</p>
                <div className="bb-tile-deltas">
                  <span className={`bb-tile-d ${p.dir}`}><i>{tf}</i>{p.txt}</span>
                  <span className={`bb-tile-d ${yy.dir}`}><i>YoY</i>{yy.txt}</span>
                </div>
                <MSSpark data={mm.series.slice(-10)} dir={p.dir} />
              </div>
            );
          })}
        </div>
      </div>

      <aside className="bb-detail">
        <div className="bb-detail-head">
          <p className="bb-detail-eyebrow">
            {m.eyebrow}
            <span className="bb-detail-pin" onClick={onOpenFocus} style={{ cursor: "pointer" }}>⤢ Open full focus</span>
          </p>
          <h2 className="bb-detail-name">{m.focusName}</h2>
          <div className="bb-detail-big">
            <p className="bb-detail-num">{msFmt(st.cur, m.fmt)}</p>
            <div className="bb-detail-num-d">
              <span className={`dlt ${dP.dir}`}>{dP.arrow} {dP.txt} vs {MS_TF_PRIOR[tf]}</span>
              <span className={`dlt ${dY.dir}`}>{dY.arrow} {dY.txt} YoY</span>
            </div>
          </div>
        </div>

        <div className="bb-detail-section">
          <p className="bb-detail-sl">Trend · quarterly history</p>
          <div style={{ height: 132 }}>
            <MSLine primary={m.series} comp={split === "asksold" && comp ? comp.data : null}
              fmt={m.fmt} windowQs={MS_TF_WIN[tf]} yTicks={3} />
          </div>
        </div>

        <div className="bb-detail-section">
          <p className="bb-detail-sl">Split — comparison</p>
          <div className="bb-split-pill-row">
            {MS_SPLITS.slice(0, 4).map((sp) => (
              <button key={sp.key} className={`bb-split-pill ${sp.key === split ? "is-on" : ""}`}
                onClick={() => setSplit(sp.key)}>{sp.label}</button>
            ))}
          </div>
          <MSCmpBars rows={msCompBars(m, tf, split)} />
        </div>

        <p className="bb-detail-foot"><strong>Read</strong> {msFillInsight(m, tf)}</p>
      </aside>
    </div>
  );
}

/* ---------- FOCUS ---------- */
function MSFocus({ metricKey, setMetricKey, tf, split, setSplit, onBack }) {
  const m = MS_METRICS.find((x) => x.key === metricKey);
  const st = msStats(m, tf);
  const dP = msDelta(m, st.cur, st.prior);
  const dY = msDelta(m, st.cur, st.yoy);
  const comp = msCompSeries(m, split);
  const groups = ["Pricing", "Velocity", "Volume"];
  return (
    <div className="fm-body">
      <aside className="fm-rail">
        <div className="fm-rail-head">
          <button className="fm-rail-back" onClick={onBack}>‹ Board</button>
          <p className="fm-rail-sub">Last {MS_TF_LABEL[tf]} · vs {MS_TF_PRIOR[tf]}</p>
        </div>
        {groups.map((g) => (
          <React.Fragment key={g}>
            <p className="fm-rail-group">{g}</p>
            {MS_METRICS.filter((x) => x.group === g).map((mm) => {
              const s = msStats(mm, tf);
              const p = msDelta(mm, s.cur, s.prior);
              return (
                <div key={mm.key} className={`fm-metric ${mm.key === metricKey ? "is-on" : ""}`}
                  onClick={() => setMetricKey(mm.key)}>
                  <span className="fm-metric-name">{mm.name}</span>
                  <span className="fm-metric-val">{msFmt(s.cur, mm.fmt)}</span>
                  <span className={`fm-metric-d ${p.dir}`}>{p.txt}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </aside>

      <section className="fm-focus">
        <div className="fm-focus-head">
          <div>
            <p className="fm-focus-eyebrow">{m.eyebrow}</p>
            <h2 className="fm-focus-name">{m.focusName}</h2>
          </div>
          <div className="fm-focus-big">
            <p className="fm-focus-num">{msFmt(st.cur, m.fmt)}</p>
            <div className="fm-focus-deltas">
              <div className="fm-dcol">
                <span className="fm-dcol-l">vs {MS_TF_PRIOR[tf]}</span>
                <span className={`fm-dcol-v ${dP.dir}`}>{dP.txt}</span>
              </div>
              <div className="fm-dcol">
                <span className="fm-dcol-l">YoY</span>
                <span className={`fm-dcol-v ${dY.dir}`}>{dY.txt}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="fm-split">
          <span className="fm-split-label">Split by</span>
          {MS_SPLITS.map((sp) => (
            <button key={sp.key} className={`fm-split-pill ${sp.key === split ? "is-on" : ""}`}
              onClick={() => setSplit(sp.key)}>{sp.label}</button>
          ))}
        </div>

        <div className="fm-chart-wrap">
          <div className="fm-chart-legend">
            <span className="fm-leg"><span className="fm-leg-key a"></span>{comp ? comp.primaryLabel : "This filter"}</span>
            {comp && <span className="fm-leg"><span className="fm-leg-key b"></span>{comp.label}</span>}
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--mute)" }}>
              Quarterly · 2021 – 2025 · shaded = current window
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 240 }}>
            <MSLine primary={m.series} comp={comp ? comp.data : null} fmt={m.fmt} windowQs={MS_TF_WIN[tf]} />
          </div>
        </div>

        <div className="fm-foot">
          <FMFootCell l={`Median (${MS_TF_LABEL[tf]})`} v={msFmt(st.cur, m.fmt)} s={`${MS_TF_N[tf]} sales this window`} />
          <FMFootCell l={`vs ${MS_TF_PRIOR[tf]}`} v={dP.txt} s="period over period" />
          <FMFootCell l="Year over year" v={dY.txt} s="same window, −1yr" />
          <FMFootCell l={comp ? comp.label : "Comparison"} v={comp ? msFmt(comp.data[comp.data.length - 1], m.fmt) : "—"} s="latest comparison" />
        </div>
      </section>
    </div>
  );
}

function FMFootCell({ l, v, s }) {
  return <div className="fm-foot-cell"><p className="fm-foot-l">{l}</p><p className="fm-foot-v">{v}</p><p className="fm-foot-s">{s}</p></div>;
}

/* ---------- PRESENT / EDITORIAL ---------- */
function MSPresent({ metricKey, setMetricKey, tf, onBack, chrome = true }) {
  const m = MS_METRICS.find((x) => x.key === metricKey);
  const st = msStats(m, tf);
  const dP = msDelta(m, st.cur, st.prior);
  const dY = msDelta(m, st.cur, st.yoy);
  const comp = msCompSeries(m, "submarket");
  const heroPills = ["cap", "ppu", "grm", "dom", "volume"];
  const suppKeys = ["ppu", "cap", "grm", "dom", "volume"].filter((k) => k !== metricKey).slice(0, 4);
  return (
    <React.Fragment>
      {chrome && <MSTopBar onNav={onBack} />}
      <div className="ed-exportbar">
        <span className="ed-exportbar-back" onClick={onBack}>← Back to board</span>
        <span className="ed-exportbar-title">Present / Export · <b>{m.focusName}</b></span>
        <div className="ed-exportbar-actions">
          <button>Copy image</button><button>PNG</button><button>PDF</button>
          <button className="is-primary">Add to report</button>
        </div>
      </div>

      <div className="ed-stage">
        <div className="ed-dateline">
          <p className="ed-dateline-eyebrow">Method Multifamily · Market Intelligence</p>
          <span className="ed-dateline-rule"></span>
          <span className="ed-dateline-meta">SE Portland · 2–4 unit · pre-1940 · last {MS_TF_LABEL[tf]}</span>
        </div>
        <div className="ed-pills">
          {heroPills.map((k) => {
            const mm = MS_METRICS.find((x) => x.key === k);
            return <button key={k} className={`ed-pill ${k === metricKey ? "is-on" : ""}`}
              onClick={() => setMetricKey(k)}>{mm.name}</button>;
          })}
        </div>

        <div className="ed-hero">
          <div className="ed-hero-l">
            <p className="ed-hero-eyebrow">{m.eyebrow} · last {MS_TF_LABEL[tf]}</p>
            <p className="ed-hero-num">{msFmt(st.cur, m.fmt)}</p>
            <p className="ed-hero-name">{m.focusName}</p>
            <div className="ed-hero-deltas">
              <span className={`ed-hero-chip ${dP.dir}`}>{dP.arrow} {dP.txt} <span className="sub">vs {MS_TF_PRIOR[tf]}</span></span>
              <span className={`ed-hero-chip ${dY.dir}`}>{dY.arrow} {dY.txt} <span className="sub">YoY</span></span>
            </div>
            <p className="ed-insight">{msFillInsight(m, tf)}</p>
          </div>
          <div className="ed-hero-r">
            <div className="ed-chart-card">
              <div className="ed-chart-head">
                <h3 className="ed-chart-title">{m.focusName} · quarterly</h3>
                <div className="ed-chart-legend">
                  <span className="fm-leg"><span className="fm-leg-key a"></span>This filter</span>
                  <span className="fm-leg"><span className="fm-leg-key b"></span>Sub-market</span>
                </div>
              </div>
              <div style={{ height: 220 }}>
                <MSLine primary={m.series} comp={comp ? comp.data : null} fmt={m.fmt} windowQs={MS_TF_WIN[tf]} yTicks={5} />
              </div>
            </div>
          </div>
        </div>

        <div className="ed-supp">
          {suppKeys.map((k) => {
            const mm = MS_METRICS.find((x) => x.key === k);
            const s = msStats(mm, tf);
            const p = msDelta(mm, s.cur, s.prior);
            return (
              <div key={k} className="ed-supp-cell">
                <p className="ed-supp-l">{mm.name}</p>
                <p className="ed-supp-v">{msFmt(s.cur, mm.fmt)}</p>
                <p className={`ed-supp-d ${p.dir}`}>{p.txt} · {tf}</p>
              </div>
            );
          })}
        </div>

        <div className="ed-foot">
          <span className="brand-name">Method Multifamily</span>
          <span>Market Snapshot</span>
          <span className="ed-foot-spacer"></span>
          <span>Source: RMLS + Method Multifamily underwriting · n = {MS_TF_N[tf]} sales · Nov 2025</span>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { MSTopBar, MSFilterStrip, MSNowStrip, MSBoard, MSFocus, MSPresent });
