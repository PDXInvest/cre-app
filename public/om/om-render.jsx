/* ============================================================
   OM RENDERER — page-render loop + JSON paste pane
   ------------------------------------------------------------
   The whole UI is: a stack of pages rendered from window.OM_DOC,
   plus a small floating "Data" pane (editor view only) where you
   can paste a JSON document from the CRE Web App and see it
   render live.
   ============================================================ */

const { useState, useEffect: useEff, useMemo, useCallback } = React;

const VIEW = new URLSearchParams(location.search).get("view");
const IS_CLIENT = VIEW === "client";

document.body.setAttribute("data-view", IS_CLIENT ? "client" : "editor");

/* ============================================================
   INTERPOLATION — resolve {{property.name}} style placeholders
   anywhere in the page data. Templates don't need to know about
   this; it's run once on each page's data before render.
   ============================================================ */
function resolvePath(obj, path) {
  return path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
}
function interpolate(value, ctx) {
  if (typeof value === "string") {
    if (value.indexOf("{{") === -1) return value;
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const resolved = resolvePath(ctx, key.trim());
      return resolved == null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map(v => interpolate(v, ctx));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = interpolate(value[k], ctx);
    return out;
  }
  return value;
}

/* ============================================================
   PAGE — looks up the template and renders. If the template
   name is unknown, render a clear placeholder so missing
   templates don't blow up the whole document.
   ============================================================ */
function Page({ pageDef, property }) {
  const Tpl = window.TEMPLATE_REGISTRY[pageDef.template];
  if (!Tpl) {
    return (
      <section
        className="om-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "repeating-linear-gradient(135deg, #f5f3ee, #f5f3ee 12px, #efece5 12px, #efece5 24px)",
          color: "var(--charcoal-3)"
        }}
        data-template="__unknown"
      >
        <p style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600 }}>
          Unknown template
        </p>
        <p style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 12 }}>
          "{pageDef.template}"
        </p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Add this template to <code>om-templates.jsx</code>.
        </p>
      </section>
    );
  }
  return <Tpl data={interpolate(pageDef.data || {}, { property })} property={property} />;
}

/* ============================================================
   DATA PANE — pastable JSON editor.
   ------------------------------------------------------------
   Editor view only (?view=client hides it entirely). Floating
   bottom-right drawer; collapsible. Live re-renders on Apply.
   Shows the parse error inline if the JSON is broken.
   ============================================================ */
function DataPane({ doc, setDoc }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(doc, null, 2));
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null); // "saved" | null

  // When doc changes externally (e.g. on first load), sync the text.
  useEff(() => {
    setText(JSON.stringify(doc, null, 2));
  }, [doc]);

  const apply = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Document must be a JSON object");
      }
      if (!Array.isArray(parsed.pages)) {
        throw new Error("Document must have a `pages` array");
      }
      setError(null);
      setDoc(parsed);
      try { localStorage.setItem("om-doc", text); } catch (e) {}
      setFlash("saved");
      setTimeout(() => setFlash(null), 1400);
    } catch (e) {
      setError(e.message);
    }
  }, [text, setDoc]);

  const reset = useCallback(() => {
    try { localStorage.removeItem("om-doc"); } catch (e) {}
    setDoc(window.OM_DEFAULT_DOC);
    setFlash("reset");
    setTimeout(() => setFlash(null), 1400);
  }, [setDoc]);

  return (
    <div className={`data-pane${open ? " is-open" : ""}`}>
      <button className="dp-toggle" onClick={() => setOpen(o => !o)}>
        <span className="dp-toggle-dot"></span>
        <span>Data</span>
        <span className="dp-toggle-meta">{doc.pages.length} pages</span>
      </button>
      {open && (
        <div className="dp-body">
          <div className="dp-head">
            <div>
              <p className="dp-title">Document JSON</p>
              <p className="dp-sub">Paste output from the CRE Web App. Click Apply to render.</p>
            </div>
            <button className="dp-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <textarea
            className="dp-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck={false}
          />
          {error && <p className="dp-error">{error}</p>}
          <div className="dp-actions">
            <button className="dp-btn dp-btn-secondary" onClick={reset}>Reset to default</button>
            <div style={{ flex: 1 }}></div>
            {flash && (
              <span className="dp-flash">
                <span className="dp-flash-dot"></span>
                {flash === "saved" ? "Applied · saved" : "Reset to default"}
              </span>
            )}
            <button className="dp-btn dp-btn-secondary" onClick={() => setText(JSON.stringify(doc, null, 2))}>Discard edits</button>
            <button className="dp-btn dp-btn-primary" onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
function App() {
  // Load saved doc from localStorage on first mount, otherwise
  // fall back to the bundled default.
  const [doc, setDoc] = useState(() => {
    try {
      const saved = localStorage.getItem("om-doc");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return window.OM_DEFAULT_DOC;
  });

  const property = doc.property || {};

  return (
    <>
      <main className="om-stage">
        {doc.pages.map((p, i) => (
          <Page key={p.id || i} pageDef={p} property={property} />
        ))}
      </main>
      {!IS_CLIENT && <DataPane doc={doc} setDoc={setDoc} />}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
