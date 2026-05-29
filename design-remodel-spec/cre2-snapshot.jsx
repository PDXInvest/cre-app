/* ============================================================
   MARKET SNAPSHOT — folded into the CRE App sidebar shell.
   Renders the Snapshot's Board → Focus → Present views inside
   ApShell (shared dark sidebar) instead of its own top-bar.
   View/metric/timeframe/split state lives here so navigating
   between Board/Focus/Present never loses context. The standalone
   Market Snapshot.html still exists for presenting on its own.
   ============================================================ */

function MarketSnapshotPage() {
  const [view, setView] = React.useState("board");      // board | focus | present
  const [metricKey, setMetricKey] = React.useState("cap");
  const [tf, setTf] = React.useState("90d");
  const [split, setSplit] = React.useState("asksold");
  const openFocus = (k) => { if (k) setMetricKey(k); setView("focus"); };

  return (
    <window.ApShell active="Market Snapshot">
      <div className="app-frame" style={{ height: "100%" }}>
        {view === "present" ? (
          <window.MSPresent chrome={false} metricKey={metricKey} setMetricKey={setMetricKey} tf={tf} onBack={() => setView("board")} />
        ) : (
          <React.Fragment>
            <window.MSFilterStrip tf={tf} setTf={setTf} onPresent={() => setView("present")} />
            <window.MSNowStrip />
            {view === "board" && (
              <window.MSBoard metricKey={metricKey} setMetricKey={setMetricKey} tf={tf}
                split={split} setSplit={setSplit} onOpenFocus={() => openFocus()} />
            )}
            {view === "focus" && (
              <window.MSFocus metricKey={metricKey} setMetricKey={setMetricKey} tf={tf}
                split={split} setSplit={setSplit} onBack={() => setView("board")} />
            )}
          </React.Fragment>
        )}
      </div>
    </window.ApShell>
  );
}

Object.assign(window, { MarketSnapshotPage });
