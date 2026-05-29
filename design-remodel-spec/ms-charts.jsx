/* ============================================================
   MARKET SNAPSHOT — chart components (data-driven)
   MSLine: time-series with optional comparison line + window
   shade. MSSpark: tile sparkline. MSCmpBars: comparison bars.
   Charts measure their container so text never distorts.
   ============================================================ */

function useMSSize() {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState({ w: 600, h: 240 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = r.width || el.clientWidth || 600;
      const h = r.height || el.clientHeight || 240;
      setSize((prev) => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    };
    measure();                              // synchronous, before paint
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const t = setTimeout(measure, 80);      // catch late font/layout settle
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);
  return [ref, size];
}

/* Time-series line chart.
   props: primary [n], comp [n]|null, primaryLabel, compLabel, fmt,
   windowQs (trailing quarters to shade), accent bool */
function MSLine({ primary, comp, primaryLabel, compLabel, fmt, windowQs = 1, yTicks = 4 }) {
  const [ref, { w, h }] = useMSSize();
  const padL = 46, padR = 14, padT = 14, padB = 24;
  const all = primary.concat(comp || []);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  const n = primary.length;
  const x = (i) => padL + (i / (n - 1)) * (w - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const mk = (d) => d.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const line = mk(primary);
  const area = `${line} L${x(n - 1).toFixed(1)},${(h - padB).toFixed(1)} L${x(0).toFixed(1)},${(h - padB).toFixed(1)} Z`;

  const ticks = [];
  for (let i = 0; i <= yTicks; i++) ticks.push(lo + ((hi - lo) * i) / yTicks);
  const winX = x(Math.max(0, n - windowQs) - 0.5 < 0 ? 0 : n - windowQs - 0.5);

  return (
    <div ref={ref} className="ms-linechart">
      <svg width={w} height={h} style={{ display: "block" }}>
        {/* selected window shade */}
        <rect x={Math.max(padL, winX)} y={padT} width={Math.max(0, w - padR - Math.max(padL, winX))}
          height={h - padT - padB} fill="rgba(165,17,35,0.05)" />
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--mute)"
              fontFamily="var(--mono)" style={{ fontVariantNumeric: "tabular-nums" }}>{msFmt(t, fmt)}</text>
          </g>
        ))}
        {comp && <path d={mk(comp)} fill="none" stroke="var(--mute-2)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={area} fill="rgba(165,17,35,0.07)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(primary[n - 1])} r="3.5" fill="var(--accent)" />
        {MS_QUARTERS.map((q, i) => (i % 4 === 0 || i === n - 1) && (
          <text key={q} x={x(i)} y={h - 7} textAnchor={i === n - 1 ? "end" : "middle"} fontSize="9.5"
            fill="var(--mute)" fontFamily="var(--mono)">{q}</text>
        ))}
      </svg>
    </div>
  );
}

function MSSpark({ data, dir }) {
  const min = Math.min(...data), max = Math.max(...data);
  const W = 200, H = 28, pad = 3, span = (max - min) || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - pad - ((v - min) / span) * (H - pad * 2),
  ]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const stroke = dir === "pos" ? "var(--pos)" : dir === "neg" ? "var(--neg)" : "var(--mute)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="bb-tile-spark">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={stroke} />
    </svg>
  );
}

function MSCmpBars({ rows }) {
  return (
    <div className="bb-cmp-split">
      {rows.map((r, i) => (
        <div key={i} className={`bb-cmp-row ${r.accent ? "is-accent" : ""}`}>
          <p className="bb-cmp-label">{r.label}</p>
          <div className="bb-cmp-bar"><div className="bb-cmp-fill" style={{ width: `${r.pct}%` }}></div></div>
          <p className="bb-cmp-val">{r.val}</p>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { MSLine, MSSpark, MSCmpBars, useMSSize });
