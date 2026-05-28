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
   REGISTRY — the renderer looks templates up here by name.
   Adding a new template means adding it to this map.
   ============================================================ */
const TEMPLATE_REGISTRY = {
  "cover": CoverTemplate,
  "narrative": NarrativeTemplate,
  "table": TableTemplate,
  "card-grid": CardGridTemplate
};

Object.assign(window, { TEMPLATE_REGISTRY, CoverTemplate, NarrativeTemplate, TableTemplate, CardGridTemplate });
