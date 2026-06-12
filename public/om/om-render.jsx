/* ============================================================
   OM RENDERER — page-render loop + JSON paste pane
   ------------------------------------------------------------
   The whole UI is: a stack of pages rendered from window.OM_DOC,
   plus a small floating "Data" pane (editor view only) where you
   can paste a JSON document from the CRE Web App and see it
   render live.
   ============================================================ */

const { useState, useEffect: useEff, useMemo, useCallback } = React;

const PARAMS = new URLSearchParams(location.search);
const VIEW = PARAMS.get("view");
const IS_CLIENT = VIEW === "client";
const PROPOSAL_ID = PARAMS.get("proposal");

const SUPABASE_URL = "https://azqoiryelockjtmdvozk.supabase.co";
const SUPABASE_KEY = "sb_publishable_HqGEKnApICX4YpNXcNmQuQ_G7--sP1y";

document.body.setAttribute("data-view", IS_CLIENT ? "client" : "editor");

/* Fetch the proposal's om_json document from Supabase. Goes through the
   get_om_json() SECURITY DEFINER function — the proposals table itself is
   not readable with the anon key; this RPC is the only anonymous surface.
   Returns null on any failure so the renderer falls back to the default doc. */
async function fetchProposalDoc(proposalId) {
  try {
    if (typeof supabase === "undefined") return null;
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: doc, error } = await sb.rpc("get_om_json", { p_proposal_id: proposalId });
    if (error) return null;
    if (doc && Array.isArray(doc.pages) && doc.pages.length) return doc;
    return null;
  } catch (e) {
    console.warn("OM: failed to fetch proposal doc", e);
    return null;
  }
}

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
  // When a proposal id is present, the document comes from Supabase
  // (proposals.om_json). Otherwise load from localStorage or the
  // bundled default.
  const [doc, setDoc] = useState(() => {
    if (PROPOSAL_ID) return null; // loading state until Supabase resolves
    try {
      const saved = localStorage.getItem("om-doc");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return window.OM_DEFAULT_DOC;
  });

  useEff(() => {
    if (!PROPOSAL_ID) return;
    let cancelled = false;
    fetchProposalDoc(PROPOSAL_ID).then(fetched => {
      if (cancelled) return;
      setDoc(fetched || window.OM_DEFAULT_DOC);
    });
    return () => { cancelled = true; };
  }, []);

  if (!doc) {
    return (
      <main className="om-stage">
        <div style={{ padding: "120px 0", color: "var(--charcoal-3)", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Loading proposal…
        </div>
      </main>
    );
  }

  const property = doc.property || {};

  return (
    <>
      <main className="om-stage">
        {doc.pages.map((p, i) => (
          <Page key={p.id || i} pageDef={p} property={property} />
        ))}
      </main>
      {!IS_CLIENT && PROPOSAL_ID && <ExportButton />}
      {!IS_CLIENT && <DataPane doc={doc} setDoc={setDoc} />}
    </>
  );
}

/* ============================================================
   EXPORT BUTTON — server-side PDF via /api/export-om-pdf.
   Editor view only, requires a proposal id.
   ============================================================ */
function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Export PDF");
  const run = useCallback(async () => {
    setBusy(true); setLabel("Generating…");
    try {
      const r = await fetch("/api/export-om-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: PROPOSAL_ID, orientation: "landscape" }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || ("Export failed (" + r.status + ")"));
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "OM-" + PROPOSAL_ID + ".pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setLabel("Downloaded ✓");
      setTimeout(() => { setLabel("Export PDF"); setBusy(false); }, 2000);
    } catch (e) {
      console.error("PDF export error:", e);
      setLabel("Error — retry");
      setTimeout(() => { setLabel("Export PDF"); setBusy(false); }, 3000);
    }
  }, []);
  return (
    <button className="export-pdf-btn" onClick={run} disabled={busy}>
      {label}
    </button>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
