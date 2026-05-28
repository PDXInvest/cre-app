/* ============================================================
   OM TEMPLATES — React components for each page layout
   ------------------------------------------------------------
   Each template is a pure function of its `data` prop + the
   global `property` prop. No state, no side effects. Adding a
   new template = adding a new component here + registering it
   in TEMPLATE_REGISTRY at the bottom.
   ============================================================ */

const { useEffect, useRef } = React;

/* Tiny helper: when a template wants to render HTML from the
   data (e.g. <strong> inside paragraphs), use this. Otherwise
   prefer plain text. */
function HTML({ as = "p", html, className, style }) {
  return React.createElement(as, {
    className,
    style,
    dangerouslySetInnerHTML: { __html: html }
  });
}

/* Shared running header + footer. Hidden on screen, restored
   in print mode (same as the original file). */
function PageChrome({ section, pageNumber, agent }) {
  return (
    <>
      <header className="page-header">
        <span>{section}</span><span>{pageNumber}</span>
      </header>
      <footer className="page-footer">
        <span>{agent?.company} · {agent?.division}</span>
        <span>{section}<span className="pn"> · {pageNumber}</span></span>
      </footer>
    </>
  );
}

/* ============================================================
   COVER TEMPLATE
   ------------------------------------------------------------
   Full-bleed hero image + title overlay + dark footer strip
   with address + price. Used for: title pages, section dividers,
   contact (with a variant flag later).
   ============================================================ */
function CoverTemplate({ data, property }) {
  /* Default the title from property.name so changing the property
     name on the JSON pane propagates to the cover. The split lets
     "Glisan 4-Plex" render as two lines with the type-suffix on
     line 2. The author can override by setting data.title to an
     explicit string or array. */
  const titleSource = (data.title != null)
    ? data.title
    : (() => {
        const name = property.name || "";
        const parts = name.split(" ");
        if (parts.length < 2) return [name];
        return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
      })();
  const titleLines = Array.isArray(titleSource) ? titleSource : [titleSource];
  return (
    <section
      className="om-page cover is-dark"
      data-screen-label={`Cover · ${property.name}`}
      data-template="cover"
    >
      <div className="cover-image">
        <image-slot id={data.heroSlotId || "cover-hero"} placeholder="Drop the hero / cover photo"></image-slot>
      </div>
      <div className="cover-mast">
        <span className="badge">{data.badge}</span>
        <div className="stamp">
          {property.agent?.company?.split(" ").slice(0, -1).join(" ") || "Your"}{" "}
          <span className="accent">{property.agent?.company?.split(" ").slice(-1)[0] || "Company"}</span>
          <span className="sub">{property.agent?.division}</span>
        </div>
      </div>
      <div className="cover-title">
        {data.kicker && <span className="kicker">{data.kicker}</span>}
        <h1>
          {titleLines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < titleLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </h1>
        {data.lede && <p className="lede">{data.lede}</p>}
      </div>
      <div className="cover-foot">
        <div className="left">
          <p className="label">{data.addressLabel || "Property Address"}</p>
          <p className="addr">{property.address}</p>
        </div>
        <div className="right">
          <p className="label">{data.priceLabel || "Sale Price"}</p>
          <p className="price">{property.askingPrice}</p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   NARRATIVE TEMPLATE
   ------------------------------------------------------------
   Long-form copy + optional pull quote + optional stat strip,
   paired with a tall photo on the right. Used for: market
   narrative, neighborhood writeups, city overview, etc.
   ============================================================ */
function NarrativeTemplate({ data, property }) {
  return (
    <section
      className="om-page narrative"
      data-screen-label={`Narrative · ${data.title}`}
      data-template="narrative"
    >
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      <div>
        {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
        <h2 className="h-title">{data.title}</h2>
        <hr className="block-rule" style={{ marginTop: 18 }} />

        {data.paragraphs?.map((p, i) => (
          <HTML
            key={i}
            html={p}
            className="p-body"
            style={{ marginTop: i === 0 ? 14 : 10 }}
          />
        ))}

        {data.pullQuote && (
          <blockquote>{data.pullQuote}</blockquote>
        )}

        {data.stats?.length > 0 && (
          <div className="stats">
            {data.stats.map((s, i) => (
              <div className="stat" key={i}>
                <p className="n">{s.value}</p>
                <p className="l">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="photo">
        <image-slot id={data.photoSlotId || `narrative-${data.section}-photo`} placeholder="Photo for this page"></image-slot>
      </div>
    </section>
  );
}

/* ============================================================
   TABLE TEMPLATE
   ------------------------------------------------------------
   Eyebrow + title + optional lede + data table. Rows can be
   marked as `kind: "subject"` (highlighted) or `kind: "avg"`
   (bold averages row at bottom). Used for: sales comps summary,
   financial summary, rent roll.
   ============================================================ */
function TableTemplate({ data, property }) {
  return (
    <section
      className="om-page comps-summary"
      data-screen-label={`Table · ${data.title}`}
      data-template="table"
    >
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      {data.lede && (
        <p className="p-lead" style={{ maxWidth: 640, marginTop: 8 }}>{data.lede}</p>
      )}

      <table>
        <thead>
          <tr>
            {data.columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={i}
              className={
                row.kind === "subject" ? "is-subject" :
                row.kind === "avg" ? "is-avg" : ""
              }
            >
              {row.cells.map((cell, j) => (
                <td key={j} dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ============================================================
   CARD GRID TEMPLATE
   ------------------------------------------------------------
   Eyebrow + title + grid of photo cards. Each card has a photo
   slot, label, title, address, and a key/value field list.
   Cards marked `kind: "subject"` get the accent border. Used
   for: sales comps detail, neighborhood parks (variant), unit
   detail pages (future).
   ============================================================ */
function CardGridTemplate({ data, property }) {
  const cols = data.columns || 4;
  // The original splits cards into rows of 4. We preserve that
  // by chunking the cards array; CSS handles the row spacing.
  const rows = [];
  for (let i = 0; i < data.cards.length; i += cols) {
    rows.push(data.cards.slice(i, i + cols));
  }

  return (
    <section
      className="om-page comps-detail"
      data-screen-label={`Card Grid · ${data.title}`}
      data-template="card-grid"
    >
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />

      {rows.map((rowCards, ri) => (
        <div
          className="cards"
          key={ri}
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            marginTop: ri === 0 ? 22 : 18
          }}
        >
          {rowCards.map((card, ci) => (
            <div
              key={ci}
              className={`comp-card${card.kind === "subject" ? " is-subject" : ""}`}
            >
              <div className="photo">
                <image-slot
                  id={card.slotId || `card-${data.section}-${ri}-${ci}`}
                  placeholder={`${card.title} photo`}
                ></image-slot>
              </div>
              <div className="body">
                <p className="label">{card.label}</p>
                <h3>{card.title}</h3>
                {card.address && <p className="addr">{card.address}</p>}
                {card.fields && (
                  <dl>
                    {card.fields.map(([k, v], fi) => (
                      <div key={fi}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/* ============================================================
   BULLETS + PHOTO TEMPLATE
   ------------------------------------------------------------
   Left: eyebrow + title + bullet list (each bullet = bold
   headline + description line). Right: photo. Used for
   Investment Highlights and Location Highlights.
   data: { section, pageNumber, eyebrow, title, bullets:
           [{headline, description}], photoSlotId }
   ============================================================ */
function BulletsPhotoTemplate({ data, property }) {
  return (
    <section className="om-page bullets-photo" data-screen-label={`Highlights · ${data.title}`} data-template="bullets-photo">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      <div className="bp-copy">
        {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
        <h2 className="h-title">{data.title}</h2>
        <hr className="block-rule" style={{ marginTop: 18 }} />
        <ul className="bp-list">
          {(data.bullets || []).map((b, i) => (
            <li key={i}>
              <p className="bp-headline">{b.headline}</p>
              {b.description && <p className="bp-desc">{b.description}</p>}
            </li>
          ))}
        </ul>
      </div>
      <div className="photo">
        <image-slot id={data.photoSlotId || `bullets-${data.section}-photo`} placeholder="Photo for this page"></image-slot>
      </div>
    </section>
  );
}

/* ============================================================
   PHOTO DETAIL TEMPLATE
   ------------------------------------------------------------
   Full-bleed photo (top), stats/details (bottom). Used for
   Property Snapshot and Unit pages.
   data: { section, pageNumber, eyebrow, title, photoSlotId,
           specs: [[label, value], ...] }
   ============================================================ */
function PhotoDetailTemplate({ data, property }) {
  return (
    <section className="om-page photo-detail" data-screen-label={`Detail · ${data.title}`} data-template="photo-detail">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      <div className="pd-photo">
        <image-slot id={data.photoSlotId || `detail-${data.section}-photo`} placeholder="Photo for this page"></image-slot>
      </div>
      <div className="pd-body">
        <div className="pd-head">
          {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
          <h2 className="h-title">{data.title}</h2>
        </div>
        <dl className="pd-specs">
          {(data.specs || []).map(([k, v], i) => (
            <div key={i}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ============================================================
   STAT TILES TEMPLATE
   ------------------------------------------------------------
   Grid of stat tiles (value + label + source). Optional charts
   placeholder. Used for Portland Rankings and Market Stats.
   data: { section, pageNumber, eyebrow, title, lede,
           tiles: [{value, label, source}], columns }
   ============================================================ */
function StatTilesTemplate({ data, property }) {
  const cols = data.columns || 4;
  return (
    <section className="om-page stat-tiles" data-screen-label={`Stats · ${data.title}`} data-template="stat-tiles">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      {data.lede && <p className="p-lead" style={{ maxWidth: 640, marginTop: 8 }}>{data.lede}</p>}
      <div className="st-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {(data.tiles || []).map((t, i) => (
          <div className="st-tile" key={i}>
            <p className="st-value">{t.value}</p>
            <p className="st-label">{t.label}</p>
            {t.source && <p className="st-source">{t.source}</p>}
          </div>
        ))}
      </div>
      {data.chartsNote && <p className="st-charts-note">{data.chartsNote}</p>}
    </section>
  );
}

/* ============================================================
   FINANCIAL SUMMARY TEMPLATE
   ------------------------------------------------------------
   Sale-price header stats + unit-mix table + income/expense
   table. Used for Financial Summary.
   data: { section, pageNumber, eyebrow, title,
           headerStats: [{value, label}],
           unitMix: { columns, rows: [{cells, kind}] },
           incomeExpense: { columns, rows: [{cells, kind}] } }
   ============================================================ */
function FinancialSummaryTemplate({ data, property }) {
  function renderTable(tbl, caption) {
    if (!tbl) return null;
    return (
      <table className="fs-table">
        {caption && <caption>{caption}</caption>}
        <thead><tr>{tbl.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {tbl.rows.map((r, i) => (
            <tr key={i} className={r.kind === "total" ? "is-total" : ""}>
              {r.cells.map((cell, j) => <td key={j} dangerouslySetInnerHTML={{ __html: cell }} />)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <section className="om-page financial-summary" data-screen-label={`Financials · ${data.title}`} data-template="financial-summary">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      {data.headerStats?.length > 0 && (
        <div className="fs-totals">
          {data.headerStats.map((s, i) => (
            <div className="fs-total" key={i}>
              <p className="l">{s.label}</p>
              <p className="n">{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="fs-tables">
        {renderTable(data.unitMix, "Unit Mix")}
        {renderTable(data.incomeExpense, "Income & Expenses")}
      </div>
    </section>
  );
}

/* ============================================================
   PRICING STRATEGY TEMPLATE
   ------------------------------------------------------------
   Bell-curve diagram area + pricing-tier table + recommendation
   bar. Used for Pricing Strategy.
   data: { section, pageNumber, eyebrow, title,
           tiers: [{name, price, cap, kind}], recommendation }
   ============================================================ */
function PricingStrategyTemplate({ data, property }) {
  return (
    <section className="om-page pricing-strategy" data-screen-label={`Pricing · ${data.title}`} data-template="pricing-strategy">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      <div className="ps-curve">
        <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="ps-curve-svg">
          <path d="M0,138 C120,138 180,20 300,20 C420,20 480,138 600,138" fill="rgba(165,17,35,0.08)" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        <div className="ps-curve-labels">
          {(data.tiers || []).map((t, i) => (
            <span key={i} className={t.kind === "recommended" ? "is-rec" : ""}>{t.name}</span>
          ))}
        </div>
      </div>
      <table className="ps-table">
        <thead><tr><th>Strategy</th><th>List Price</th><th>Implied Cap</th></tr></thead>
        <tbody>
          {(data.tiers || []).map((t, i) => (
            <tr key={i} className={t.kind === "recommended" ? "is-rec" : ""}>
              <td>{t.name}</td><td>{t.price}</td><td>{t.cap || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.recommendation && (
        <div className="ps-rec-bar">
          <span className="ps-rec-label">Recommendation</span>
          <span className="ps-rec-text">{data.recommendation}</span>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   Q&A TEMPLATE
   ------------------------------------------------------------
   Numbered question + answer blocks. Used for Client Concerns.
   data: { section, pageNumber, eyebrow, title,
           items: [{question, answer}] }
   ============================================================ */
function QATemplate({ data, property }) {
  return (
    <section className="om-page qa" data-screen-label={`Q&A · ${data.title}`} data-template="qa">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      <div className="qa-list">
        {(data.items || []).map((item, i) => (
          <div className="qa-item" key={i}>
            <span className="qa-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="qa-content">
              <p className="qa-q">{item.question}</p>
              <HTML html={item.answer} className="qa-a" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   TIMELINE TEMPLATE
   ------------------------------------------------------------
   Gantt-style table: phases as rows, weeks as columns. Each
   phase has a start/end week (1-based). Used for Marketing Plan.
   data: { section, pageNumber, eyebrow, title, lede,
           weeks: ["W1",...], phases: [{name, start, end}] }
   ============================================================ */
function TimelineTemplate({ data, property }) {
  const weeks = data.weeks || [];
  return (
    <section className="om-page timeline" data-screen-label={`Timeline · ${data.title}`} data-template="timeline">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      {data.lede && <p className="p-lead" style={{ maxWidth: 640, marginTop: 8 }}>{data.lede}</p>}
      <table className="tl-table">
        <thead>
          <tr>
            <th className="tl-phase-h">Phase</th>
            {weeks.map((w, i) => <th key={i}>{w}</th>)}
          </tr>
        </thead>
        <tbody>
          {(data.phases || []).map((p, i) => (
            <tr key={i}>
              <td className="tl-phase">{p.name}</td>
              {weeks.map((_, wi) => {
                const w = wi + 1;
                const active = w >= p.start && w <= p.end;
                const isStart = w === p.start;
                const isEnd = w === p.end;
                return (
                  <td key={wi} className="tl-cell">
                    {active && (
                      <span
                        className="tl-bar"
                        style={{
                          borderTopLeftRadius: isStart ? 3 : 0,
                          borderBottomLeftRadius: isStart ? 3 : 0,
                          borderTopRightRadius: isEnd ? 3 : 0,
                          borderBottomRightRadius: isEnd ? 3 : 0,
                        }}
                      ></span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ============================================================
   BODY COPY TEMPLATE
   ------------------------------------------------------------
   Eyebrow + title + multiple paragraphs (no photo). Used for
   Disclaimer and City of Portland narrative.
   data: { section, pageNumber, eyebrow, title, paragraphs: [...] }
   ============================================================ */
function BodyCopyTemplate({ data, property }) {
  return (
    <section className="om-page body-copy" data-screen-label={`Copy · ${data.title}`} data-template="body-copy">
      <PageChrome section={data.section} pageNumber={data.pageNumber} agent={property.agent} />
      {data.eyebrow && <p className="h-eyebrow">{data.eyebrow}</p>}
      <h2 className="h-title">{data.title}</h2>
      <hr className="block-rule" style={{ marginTop: 18 }} />
      <div className="bc-copy">
        {(data.paragraphs || []).map((p, i) => (
          <HTML key={i} html={p} className="p-body" style={{ marginTop: i === 0 ? 16 : 10 }} />
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   REGISTRY — the renderer looks templates up here by name.
   Adding a new template means adding it to this map.
   ============================================================ */
const TEMPLATE_REGISTRY = {
  "cover": CoverTemplate,
  "narrative": NarrativeTemplate,
  "table": TableTemplate,
  "card-grid": CardGridTemplate,
  "bullets-photo": BulletsPhotoTemplate,
  "photo-detail": PhotoDetailTemplate,
  "stat-tiles": StatTilesTemplate,
  "financial-summary": FinancialSummaryTemplate,
  "pricing-strategy": PricingStrategyTemplate,
  "qa": QATemplate,
  "timeline": TimelineTemplate,
  "body-copy": BodyCopyTemplate
};

Object.assign(window, {
  TEMPLATE_REGISTRY,
  CoverTemplate, NarrativeTemplate, TableTemplate, CardGridTemplate,
  BulletsPhotoTemplate, PhotoDetailTemplate, StatTilesTemplate,
  FinancialSummaryTemplate, PricingStrategyTemplate, QATemplate,
  TimelineTemplate, BodyCopyTemplate
});
