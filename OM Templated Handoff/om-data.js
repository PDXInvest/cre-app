/* ============================================================
   DEFAULT DOCUMENT — Glisan 4-Plex
   ------------------------------------------------------------
   This is what the CRE Web App would produce. Each `page` has:
     - template: one of {cover, narrative, table, card-grid}
     - data:     the slots that template renders
   The `property` block at the top is global — templates can pull
   common fields (address, agent contact) without repeating them
   in every page's data.
   ============================================================ */

window.OM_DEFAULT_DOC = {
  property: {
    name: "Glisan 4-Plex",
    address: "2422 NE Glisan St · Portland, OR 97232",
    askingPrice: "$1,395,000",
    agent: { company: "Your Company", division: "Real Estate LLC" }
  },

  pages: [
    /* ---------------- COVER ---------------- */
    {
      id: "cover",
      template: "cover",
      data: {
        badge: "Offering Memorandum",
        kicker: "Fully Renovated & Leased",
        /* `title` is optional — if omitted, the cover template derives it
           from `property.name` (split on the last word). Set it explicitly
           when you want a different break or artistic flourish, e.g.
           ["Glisan", "4-Plex."] for the period after Plex. */
        lede: "A turnkey, top-to-bottom renovated vintage 4-plex in the heart of Portland's Kerns neighborhood — the #1 ranked coolest neighborhood in America.",
        addressLabel: "Property Address",
        priceLabel: "Sale Price",
        heroSlotId: "cover-hero"
      }
    },

    /* ---------------- MARKET NARRATIVE ---------------- */
    {
      id: "market-narrative",
      template: "narrative",
      data: {
        section: "Proposal",
        pageNumber: "P·02",
        eyebrow: "Portland Multifamily · 2026",
        title: "A market turning a corner.",
        paragraphs: [
          "After two years of cooling transaction velocity, Portland's small-balance multifamily market is showing measurable signs of recovery — cap rates have stabilized in the 5.25–5.75% range for class B / C vintage assets, and average days-on-market has dropped 18% year-over-year.",
          "Demand from <strong>private 1031 buyers, family offices, and out-of-state investors</strong> seeking yield in a stabilized rate environment has returned to inner east-side assets in particular. Renovated, turnkey product like the subject continues to command a premium of 8–12% over un-renovated comparables.",
          "Looking forward, supply remains constrained — only 1,200 small multifamily units (5–50) are in the active development pipeline in inner Portland through 2027, well below historical absorption."
        ],
        pullQuote: "Inner east-side fourplexes priced under $1.5M remain the most tightly-held asset class in the metro. Sellers in this window will see disciplined, qualified buyer demand.",
        stats: [
          { value: "−18%", label: "YoY change in average days-on-market" },
          { value: "+4.2%", label: "Rent growth, inner east-side, trailing 12mo" }
        ],
        photoSlotId: "market-narrative-photo"
      }
    },

    /* ---------------- SALES COMPS SUMMARY (TABLE) ---------------- */
    {
      id: "comps-summary",
      template: "table",
      data: {
        section: "Proposal",
        pageNumber: "P·04",
        eyebrow: "Sales Comparables",
        title: "Seven trailing comps in the corridor.",
        lede: "Renovated and unrenovated vintage multifamily, 4–12 units, sold within ~3 miles of the subject over the trailing 24 months.",
        columns: ["#", "Property", "City", "Year Built", "# Units", "Sale Date", "Sale Price", "$ / Unit", "$ / SF", "Avg Unit SF", "Cap Rate"],
        rows: [
          { kind: "subject", cells: ["★", "{{property.name}} <span class=\"sub\">(Subject)</span>", "Portland", "1913", "4", "—", "{{property.askingPrice}}", "$348,750", "$340", "1,025", "5.51%"] },
          { cells: ["01", "Laurelhurst 4-Plex",     "Portland", "1922", "4", "Oct-25", "$1,420,000", "$355,000", "$334", "1,062", "5.42%"] },
          { cells: ["02", "NE 28th Avenue Quad",    "Portland", "1916", "4", "Aug-25", "$1,275,000", "$318,750", "$315", "1,010", "5.85%"] },
          { cells: ["03", "Sullivan's Gulch Quad",  "Portland", "1920", "4", "Jun-25", "$1,510,000", "$377,500", "$362", "1,042", "5.10%"] },
          { cells: ["04", "Belmont 5-Plex",         "Portland", "1908", "5", "Apr-25", "$1,640,000", "$328,000", "$308", "1,065", "5.95%"] },
          { cells: ["05", "Buckman 4-Plex",         "Portland", "1915", "4", "Feb-25", "$1,330,000", "$332,500", "$325", "1,022", "5.62%"] },
          { cells: ["06", "Hawthorne Triplex",      "Portland", "1919", "3", "Nov-24", "$1,050,000", "$350,000", "$331", "1,058", "5.55%"] },
          { cells: ["07", "Irvington 6-Plex",       "Portland", "1924", "6", "Sep-24", "$1,895,000", "$315,833", "$298", "1,060", "5.78%"] },
          { kind: "avg", cells: ["", "Averages", "—", "1918", "—", "—", "$1,445,714", "$339,655", "$324", "1,046", "5.61%"] }
        ]
      }
    },

    /* ---------------- SALES COMPS DETAIL (CARD GRID) ---------------- */
    {
      id: "comps-detail",
      template: "card-grid",
      data: {
        section: "Proposal",
        pageNumber: "P·05",
        eyebrow: "Sales Comparables · Detail",
        title: "A closer look at the comps.",
        columns: 4,
        cards: [
          { kind: "subject", label: "★ Subject Property", title: "{{property.name}}", address: "{{property.address}}", slotId: "comp-subject-photo",
            fields: [["Units","4"],["Year","1913"],["Avg SF","1,025"],["Sale Date","—"],["Price","$1.395M"],["$ / Unit","$348,750"],["$ / SF","$340"],["Cap","5.51%"]] },
          { label: "Comp · 01", title: "Laurelhurst 4-Plex", address: "29XX NE Couch St · Portland", slotId: "comp-1-photo",
            fields: [["Units","4"],["Year","1922"],["Avg SF","1,062"],["Sale Date","Oct-25"],["Price","$1.42M"],["$ / Unit","$355,000"],["$ / SF","$334"],["Cap","5.42%"]] },
          { label: "Comp · 02", title: "NE 28th Avenue Quad", address: "12XX NE 28th Ave · Portland", slotId: "comp-2-photo",
            fields: [["Units","4"],["Year","1916"],["Avg SF","1,010"],["Sale Date","Aug-25"],["Price","$1.275M"],["$ / Unit","$318,750"],["$ / SF","$315"],["Cap","5.85%"]] },
          { label: "Comp · 03", title: "Sullivan's Gulch Quad", address: "19XX NE Holladay St · Portland", slotId: "comp-3-photo",
            fields: [["Units","4"],["Year","1920"],["Avg SF","1,042"],["Sale Date","Jun-25"],["Price","$1.51M"],["$ / Unit","$377,500"],["$ / SF","$362"],["Cap","5.10%"]] },
          { label: "Comp · 04", title: "Belmont 5-Plex", address: "34XX SE Belmont St · Portland", slotId: "comp-4-photo",
            fields: [["Units","5"],["Year","1908"],["Avg SF","1,065"],["Sale Date","Apr-25"],["Price","$1.64M"],["$ / Unit","$328,000"],["$ / SF","$308"],["Cap","5.95%"]] },
          { label: "Comp · 05", title: "Buckman 4-Plex", address: "5XX SE 14th Ave · Portland", slotId: "comp-5-photo",
            fields: [["Units","4"],["Year","1915"],["Avg SF","1,022"],["Sale Date","Feb-25"],["Price","$1.33M"],["$ / Unit","$332,500"],["$ / SF","$325"],["Cap","5.62%"]] },
          { label: "Comp · 06", title: "Hawthorne Triplex", address: "37XX SE Hawthorne · Portland", slotId: "comp-6-photo",
            fields: [["Units","3"],["Year","1919"],["Avg SF","1,058"],["Sale Date","Nov-24"],["Price","$1.05M"],["$ / Unit","$350,000"],["$ / SF","$331"],["Cap","5.55%"]] },
          { label: "Comp · 07", title: "Irvington 6-Plex", address: "23XX NE 14th Ave · Portland", slotId: "comp-7-photo",
            fields: [["Units","6"],["Year","1924"],["Avg SF","1,060"],["Sale Date","Sep-24"],["Price","$1.895M"],["$ / Unit","$315,833"],["$ / SF","$298"],["Cap","5.78%"]] }
        ]
      }
    }
  ]
};
