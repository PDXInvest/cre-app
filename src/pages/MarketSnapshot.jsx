import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import '../snapshot.css'
import {
  MS_QUARTERS, MS_TF_WIN, MS_TF_LABEL, MS_TF_PRIOR, MS_TF_N, MS_SPLITS, MS_METRICS,
  msFmt, msStats, msDelta, msCompSeries, msCompBars, fetchSnapshotData,
} from '../utils/snapshotData'

/* ============================================================
   CHARTS — measure container so text never distorts
   ============================================================ */
function useMSSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 240 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = r.width || el.clientWidth || 600
      const h = r.height || el.clientHeight || 240
      setSize(prev => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const t = setTimeout(measure, 80)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])
  return [ref, size]
}

function MSLine({ primary, comp, fmt, windowQs = 1, yTicks = 4 }) {
  const [ref, { w, h }] = useMSSize()
  const padL = 46, padR = 14, padT = 14, padB = 24
  // null quarters (<3 comps) are skipped for scaling and break the line into gaps
  const finite = primary.concat(comp || []).filter(v => v != null && isFinite(v))
  let lo = finite.length ? Math.min(...finite) : 0
  let hi = finite.length ? Math.max(...finite) : 1
  const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1
  lo -= pad; hi += pad
  const n = primary.length
  const x = i => padL + (i / (n - 1)) * (w - padL - padR)
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB)
  // gapped path: start a new sub-path (M) after any null
  const mk = d => {
    let out = '', pen = false
    d.forEach((v, i) => {
      if (v == null || !isFinite(v)) { pen = false; return }
      out += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1) + ' '
      pen = true
    })
    return out.trim()
  }
  const line = mk(primary)
  const hasGaps = primary.some(v => v == null || !isFinite(v))
  const area = (!hasGaps && finite.length) ? `${line} L${x(n - 1).toFixed(1)},${(h - padB).toFixed(1)} L${x(0).toFixed(1)},${(h - padB).toFixed(1)} Z` : null
  let lastFin = -1
  for (let i = n - 1; i >= 0; i--) { if (primary[i] != null && isFinite(primary[i])) { lastFin = i; break } }
  const ticks = []
  for (let i = 0; i <= yTicks; i++) ticks.push(lo + ((hi - lo) * i) / yTicks)
  const winX = x(Math.max(0, n - windowQs) - 0.5 < 0 ? 0 : n - windowQs - 0.5)
  return (
    <div ref={ref} className="ms-linechart">
      <svg width={w} height={h} style={{ display: 'block' }}>
        <rect x={Math.max(padL, winX)} y={padT} width={Math.max(0, w - padR - Math.max(padL, winX))}
          height={h - padT - padB} fill="rgba(165,17,35,0.05)" />
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--mute)"
              fontFamily="var(--mono)" style={{ fontVariantNumeric: 'tabular-nums' }}>{msFmt(t, fmt)}</text>
          </g>
        ))}
        {comp && <path d={mk(comp)} fill="none" stroke="var(--mute-2)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />}
        {area && <path d={area} fill="rgba(165,17,35,0.07)" />}
        {line && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {lastFin >= 0 && <circle cx={x(lastFin)} cy={y(primary[lastFin])} r="3.5" fill="var(--accent)" />}
        {MS_QUARTERS.map((q, i) => (i % 4 === 0 || i === n - 1) && (
          <text key={q} x={x(i)} y={h - 7} textAnchor={i === n - 1 ? 'end' : 'middle'} fontSize="9.5"
            fill="var(--mute)" fontFamily="var(--mono)">{q}</text>
        ))}
      </svg>
    </div>
  )
}

function MSSpark({ data, dir }) {
  const W = 200, H = 28, pad = 3
  const fin = data.filter(v => v != null && isFinite(v))
  const min = fin.length ? Math.min(...fin) : 0
  const max = fin.length ? Math.max(...fin) : 1
  const span = (max - min) || 1
  const stroke = dir === 'pos' ? 'var(--pos)' : dir === 'neg' ? 'var(--neg)' : 'var(--mute)'
  let path = '', pen = false, lastPt = null
  data.forEach((v, i) => {
    if (v == null || !isFinite(v)) { pen = false; return }
    const px = (i / (data.length - 1)) * W
    const py = H - pad - ((v - min) / span) * (H - pad * 2)
    path += (pen ? 'L' : 'M') + px.toFixed(1) + ',' + py.toFixed(1) + ' '
    pen = true; lastPt = [px, py]
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="bb-tile-spark">
      {path && <path d={path.trim()} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
      {lastPt && <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={stroke} />}
    </svg>
  )
}

function MSCmpBars({ rows }) {
  return (
    <div className="bb-cmp-split">
      {rows.map((r, i) => (
        <div key={i} className={`bb-cmp-row ${r.accent ? 'is-accent' : ''}`}>
          <p className="bb-cmp-label">{r.label}</p>
          <div className="bb-cmp-bar"><div className="bb-cmp-fill" style={{ width: `${r.pct}%` }}></div></div>
          <p className="bb-cmp-val">{r.val}</p>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   CHROME — filter strip + "right now" strip
   ============================================================ */
/* Placeholder filter option sets. When real comp-derived data is wired into
   snapshotData.js, derive these from the comp pool instead. */
const MS_FILTER_OPTS = {
  county:    ['All', 'Multnomah', 'Washington', 'Clackamas', 'Clark'],
  subMarket: ['All', 'SE Portland', 'NE Portland', 'N Portland', 'NW Portland', 'SW Portland', 'Downtown Portland'],
  zip:       ['All', '97214', '97215', '97206', '97211', '97217'],
  era:       ['All', 'Pre-1940', '1940–1970', '1970–1990', '1990–2010', '2010–Present'],
  terms:     ['All', 'Cash', 'Financed'],
  buyer:     ['All', 'Owner-occ', 'Investor'],
}

function MSTimeframe({ tf, setTf }) {
  const opts = [['30d', '30'], ['90d', '90'], ['180d', '180'], ['365d', '365']]
  return (
    <div className="tf-seg" title="Timeframe">
      {opts.map(([k, n]) => (
        <button key={k} className={k === tf ? 'is-on' : ''}
          onClick={() => setTf(k)}>{n}</button>
      ))}
    </div>
  )
}

/* scope chip = labelled native select wired to shared filter state */
function MSChip({ label, value, options, onChange, muted }) {
  return (
    <label className={`fchip ${muted ? 'is-muted' : ''}`}>
      <span className="fchip-label">{label}</span>
      <select className="fchip-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

/* unit-count range — two numeric inputs [min] — [max], same pattern as the Comp Analysis tab */
function MSUnitRange({ min, max, onMin, onMax }) {
  return (
    <span className="ms-unitrange">
      <span className="fchip-label">Units</span>
      <input type="number" className="ms-unit-input" value={min}
        onChange={e => onMin(e.target.value === '' ? '' : Number(e.target.value))} />
      <span className="ms-unit-dash">—</span>
      <input type="number" className="ms-unit-input" value={max}
        onChange={e => onMax(e.target.value === '' ? '' : Number(e.target.value))} />
    </span>
  )
}

function MSFilterStrip({ tf, setTf, filters, setFilter, onPresent, loading }) {
  return (
    <div className="ms-filters is-stacked">
      <div className="ms-filter-row">
        <MSChip label="County" value={filters.county} options={MS_FILTER_OPTS.county} onChange={v => setFilter('county', v)} muted={filters.county === 'All'} />
        <MSChip label="Sub-Market" value={filters.subMarket} options={MS_FILTER_OPTS.subMarket} onChange={v => setFilter('subMarket', v)} muted={filters.subMarket === 'All'} />
        <MSChip label="Zip" value={filters.zip} options={MS_FILTER_OPTS.zip} onChange={v => setFilter('zip', v)} muted={filters.zip === 'All'} />
        <MSUnitRange min={filters.unitMin} max={filters.unitMax} onMin={v => setFilter('unitMin', v)} onMax={v => setFilter('unitMax', v)} />
        <MSChip label="Era" value={filters.era} options={MS_FILTER_OPTS.era} onChange={v => setFilter('era', v)} muted={filters.era === 'All'} />
        <span className="ms-filter-div"></span>
        <span className="ms-filter-rowlabel">Window</span>
        <MSTimeframe tf={tf} setTf={setTf} />
      </div>
      <div className="ms-filter-row ms-filter-row-2">
        <span className="ms-filter-rowlabel">Refine</span>
        <MSChip label="Terms" value={filters.terms} options={MS_FILTER_OPTS.terms} onChange={v => setFilter('terms', v)} muted={filters.terms === 'All'} />
        <MSChip label="Buyer" value={filters.buyer} options={MS_FILTER_OPTS.buyer} onChange={v => setFilter('buyer', v)} muted={filters.buyer === 'All'} />
        {loading && <span className="ms-loading">⟳ Loading market data…</span>}
        <span className="ms-filter-spacer"></span>
        <button className="ms-saved"><span className="ms-saved-icon">★</span>Saved views</button>
        <button className="ms-compare">+ Compare</button>
        <button className="btn btn-primary" onClick={onPresent}>Present →</button>
      </div>
    </div>
  )
}

function MSSNCell({ l, v }) {
  return <div className="sn-cell"><span className="sn-l">{l}</span><span className="sn-v">{v}</span></div>
}

function MSNowStrip() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`snap-now ${expanded ? 'is-expanded' : ''}`} onClick={() => setExpanded(e => !e)}>
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
      <button className="snap-now-toggle" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
        <span className="snap-now-toggle-chev">⌄</span>{expanded ? 'Hide deal stats' : 'Show deal stats'}
      </button>
      <div className="snap-now-spacer"></div>
      <span className="snap-now-meta">Matched 48 properties · refreshed 2m ago</span>
    </div>
  )
}

function msFillInsight(m, tf) {
  const { cur, prior, yoy } = msStats(m, tf)
  const dP = msDelta(m, cur, prior).txt.replace(/^\+/, '')
  const dY = msDelta(m, cur, yoy).txt.replace(/^\+/, '')
  return m.insight.replace('__dPrior__', dP).replace('__dYoY__', dY)
}

/* ============================================================
   BOARD
   ============================================================ */
function MSBoard({ metrics, metricKey, setMetricKey, tf, split, setSplit, onOpenFocus }) {
  const m = metrics.find(x => x.key === metricKey)
  const st = msStats(m, tf)
  const dP = msDelta(m, st.cur, st.prior)
  const dY = msDelta(m, st.cur, st.yoy)
  const comp = msCompSeries(m, split)
  return (
    <div className="bb-body">
      <div className="bb-left">
        <div className="bb-left-head">
          <h3 className="bb-left-title">Last {MS_TF_LABEL[tf]} · {MS_TF_N[tf]} sales matched</h3>
          <span className="bb-left-meta">Δ vs {MS_TF_PRIOR[tf]} · YoY · click a tile to drill in →</span>
        </div>
        <div className="bb-grid">
          {metrics.map(mm => {
            const s = msStats(mm, tf)
            const p = msDelta(mm, s.cur, s.prior)
            const yy = msDelta(mm, s.cur, s.yoy)
            return (
              <div key={mm.key} className={`bb-tile ${mm.key === metricKey ? 'is-active' : ''}`} onClick={() => setMetricKey(mm.key)}>
                <p className="bb-tile-l">{mm.name}</p>
                <p className="bb-tile-v">{msFmt(s.cur, mm.fmt)}</p>
                <div className="bb-tile-deltas">
                  <span className={`bb-tile-d ${p.dir}`}><i>{tf}</i>{p.txt}</span>
                  <span className={`bb-tile-d ${yy.dir}`}><i>YoY</i>{yy.txt}</span>
                </div>
                <MSSpark data={mm.series.slice(-10)} dir={p.dir} />
              </div>
            )
          })}
        </div>
      </div>

      <aside className="bb-detail">
        <div className="bb-detail-head">
          <p className="bb-detail-eyebrow">
            {m.eyebrow}
            <span className="bb-detail-pin" onClick={onOpenFocus} style={{ cursor: 'pointer' }}>⤢ Open full focus</span>
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
            <MSLine primary={m.series} comp={split === 'asksold' && comp ? comp.data : null} fmt={m.fmt} windowQs={MS_TF_WIN[tf]} yTicks={3} />
          </div>
        </div>

        <div className="bb-detail-section">
          <p className="bb-detail-sl">Split — comparison</p>
          <div className="bb-split-pill-row">
            {MS_SPLITS.slice(0, 4).map(sp => (
              <button key={sp.key} className={`bb-split-pill ${sp.key === split ? 'is-on' : ''}`} onClick={() => setSplit(sp.key)}>{sp.label}</button>
            ))}
          </div>
          <MSCmpBars rows={msCompBars(m, tf, split)} />
        </div>

        <p className="bb-detail-foot"><strong>Read</strong> {msFillInsight(m, tf)}</p>
      </aside>
    </div>
  )
}

/* ============================================================
   FOCUS
   ============================================================ */
function FMFootCell({ l, v, s }) {
  return <div className="fm-foot-cell"><p className="fm-foot-l">{l}</p><p className="fm-foot-v">{v}</p><p className="fm-foot-s">{s}</p></div>
}

function MSFocus({ metrics, metricKey, setMetricKey, tf, split, setSplit, onBack }) {
  const m = metrics.find(x => x.key === metricKey)
  const st = msStats(m, tf)
  const dP = msDelta(m, st.cur, st.prior)
  const dY = msDelta(m, st.cur, st.yoy)
  const comp = msCompSeries(m, split)
  const groups = ['Pricing', 'Velocity', 'Volume']
  return (
    <div className="fm-body">
      <aside className="fm-rail">
        <div className="fm-rail-head">
          <button className="fm-rail-back" onClick={onBack}>‹ Board</button>
          <p className="fm-rail-sub">Last {MS_TF_LABEL[tf]} · vs {MS_TF_PRIOR[tf]}</p>
        </div>
        {groups.map(g => (
          <div key={g}>
            <p className="fm-rail-group">{g}</p>
            {metrics.filter(x => x.group === g).map(mm => {
              const s = msStats(mm, tf)
              const p = msDelta(mm, s.cur, s.prior)
              return (
                <div key={mm.key} className={`fm-metric ${mm.key === metricKey ? 'is-on' : ''}`} onClick={() => setMetricKey(mm.key)}>
                  <span className="fm-metric-name">{mm.name}</span>
                  <span className="fm-metric-val">{msFmt(s.cur, mm.fmt)}</span>
                  <span className={`fm-metric-d ${p.dir}`}>{p.txt}</span>
                </div>
              )
            })}
          </div>
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
          {MS_SPLITS.map(sp => (
            <button key={sp.key} className={`fm-split-pill ${sp.key === split ? 'is-on' : ''}`} onClick={() => setSplit(sp.key)}>{sp.label}</button>
          ))}
        </div>

        <div className="fm-chart-wrap">
          <div className="fm-chart-legend">
            <span className="fm-leg"><span className="fm-leg-key a"></span>{comp ? comp.primaryLabel : 'This filter'}</span>
            {comp && <span className="fm-leg"><span className="fm-leg-key b"></span>{comp.label}</span>}
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--mute)' }}>
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
          <FMFootCell l={comp ? comp.label : 'Comparison'} v={comp ? msFmt(comp.data[comp.data.length - 1], m.fmt) : '—'} s="latest comparison" />
        </div>
      </section>
    </div>
  )
}

/* ============================================================
   PRESENT / EDITORIAL
   ============================================================ */
function MSPresent({ metrics, metricKey, setMetricKey, tf, onBack }) {
  const m = metrics.find(x => x.key === metricKey)
  const st = msStats(m, tf)
  const dP = msDelta(m, st.cur, st.prior)
  const dY = msDelta(m, st.cur, st.yoy)
  const comp = msCompSeries(m, 'submarket')
  const heroPills = ['cap', 'ppu', 'grm', 'dom', 'volume']
  const suppKeys = ['ppu', 'cap', 'grm', 'dom', 'volume'].filter(k => k !== metricKey).slice(0, 4)
  return (
    <>
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
          {heroPills.map(k => {
            const mm = metrics.find(x => x.key === k)
            return <button key={k} className={`ed-pill ${k === metricKey ? 'is-on' : ''}`} onClick={() => setMetricKey(k)}>{mm.name}</button>
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
          {suppKeys.map(k => {
            const mm = metrics.find(x => x.key === k)
            const s = msStats(mm, tf)
            const p = msDelta(mm, s.cur, s.prior)
            return (
              <div key={k} className="ed-supp-cell">
                <p className="ed-supp-l">{mm.name}</p>
                <p className="ed-supp-v">{msFmt(s.cur, mm.fmt)}</p>
                <p className={`ed-supp-d ${p.dir}`}>{p.txt} · {tf}</p>
              </div>
            )
          })}
        </div>

        <div className="ed-foot">
          <span className="brand-name">Method Multifamily</span>
          <span>Market Snapshot</span>
          <span className="ed-foot-spacer"></span>
          <span>Source: RMLS + Method Multifamily underwriting · n = {MS_TF_N[tf]} sales · placeholder data</span>
        </div>
      </div>
    </>
  )
}

/* ============================================================
   PAGE — holds view/metric/timeframe/split so navigating
   Board → Focus → Present never loses context (§7).
   ============================================================ */
export default function MarketSnapshot() {
  const [view, setView] = useState('board')      // board | focus | present
  const [metricKey, setMetricKey] = useState('cap')
  const [tf, setTf] = useState('90d')
  const [split, setSplit] = useState('asksold')
  const [filters, setFilters] = useState({
    county: 'All', subMarket: 'All', zip: 'All',
    era: 'All', terms: 'All', buyer: 'All', unitMin: 2, unitMax: 4,
  })
  // MS_METRICS = synchronous placeholder so the UI renders instantly; real
  // comp-derived data from fetchSnapshotData replaces it once it resolves.
  const [metrics, setMetrics] = useState(MS_METRICS)
  const [loading, setLoading] = useState(true)

  // Fetch real comp data on mount and whenever filters change (debounced so
  // typing in the unit-range inputs doesn't hammer Supabase).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      fetchSnapshotData(filters)
        .then(data => { if (!cancelled) setMetrics(data) })
        .catch(err => { if (!cancelled) console.error('Snapshot data load failed:', err) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [filters])

  const setFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
  }
  const openFocus = k => { if (k) setMetricKey(k); setView('focus') }

  return (
    <div className="ms-page">
      {view === 'present' ? (
        <MSPresent metrics={metrics} metricKey={metricKey} setMetricKey={setMetricKey} tf={tf} onBack={() => setView('board')} />
      ) : (
        <>
          <MSFilterStrip tf={tf} setTf={setTf} filters={filters} setFilter={setFilter} onPresent={() => setView('present')} loading={loading} />
          <MSNowStrip />
          {view === 'board' && (
            <MSBoard metrics={metrics} metricKey={metricKey} setMetricKey={setMetricKey} tf={tf} split={split} setSplit={setSplit} onOpenFocus={() => openFocus()} />
          )}
          {view === 'focus' && (
            <MSFocus metrics={metrics} metricKey={metricKey} setMetricKey={setMetricKey} tf={tf} split={split} setSplit={setSplit} onBack={() => setView('board')} />
          )}
        </>
      )}
    </div>
  )
}
