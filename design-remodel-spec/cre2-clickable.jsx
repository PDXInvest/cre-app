/* ============================================================
   EQUITY PACIFIC CRE APP — clickable orchestrator
   One app, sidebar-routed. Properties / Proposals / Comp Database
   route internally with drill-in (list ↔ record/workspace).
   Market Snapshot & Offering Memos link to their own files.
   ============================================================ */

function CRE2ClickableApp() {
  const [page, setPage] = React.useState("Properties");
  const [propId, setPropId] = React.useState(null);   // null → list, else record
  const [dealId, setDealId] = React.useState(null);   // null → list, else workspace

  const nav = (label) => {
    setPropId(null);
    setDealId(null);
    setPage(label);
  };

  const openDeal = (id) => { setDealId(id); setPage("Proposals"); };

  let content = null;
  if (page === "Properties") {
    content = propId
      ? <window.PropertyRecord propId={propId} onBack={() => setPropId(null)} onNewProposal={() => openDeal("ankeny")} />
      : <window.PropertiesList onOpen={(id) => setPropId(id)} />;
  } else if (page === "Proposals") {
    content = dealId
      ? <window.ProposalWorkspace onBack={() => setDealId(null)} />
      : <window.ProposalsList onOpen={(id) => setDealId(id)} />;
  } else if (page === "Comp Database") {
    content = <window.CompDatabase />;
  } else if (page === "Market Snapshot") {
    content = <window.MarketSnapshotPage />;
  }

  return (
    <window.ApNavContext.Provider value={{ onNav: nav, active: page }}>
      {content}
    </window.ApNavContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<CRE2ClickableApp />);
