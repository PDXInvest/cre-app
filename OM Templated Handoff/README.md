# OM Templated — POC files

Proof-of-concept of the templated OM renderer described in the
architectural brief.

## Files

- `Offering Memorandum (Templated).html` — Shell + all CSS. Open this.
- `om-data.js` — Default Glisan document (also serves as the JSON shape reference).
- `om-templates.jsx` — The 4 templates (`cover`, `narrative`, `table`, `card-grid`) + `TEMPLATE_REGISTRY`.
- `om-render.jsx` — Page render loop + JSON paste pane + `{{property.*}}` interpolation.
- `image-slot.js` — Drag-and-drop image placeholder web component (dependency).

## Running it

Open `Offering Memorandum (Templated).html` in a browser. No build step.

(Files use unpkg CDN for React + Babel. To run fully offline,
swap CDN URLs for local copies.)

## Editor vs. client view

- `?view=client` hides the Data pane for a clean proposal view.
- Default view shows the bottom-right "Data" pill for pasting JSON.

## Adding a new template

1. Add a React component to `om-templates.jsx`.
2. Register it in the `TEMPLATE_REGISTRY` map at the bottom of that file.
3. Add styles to the `<style>` block in the HTML shell.

That's it. No other files need to change.

## Adding/removing/reordering pages

JSON only — no code changes. The `pages` array in the document is
the document order. Inclusion = presence in the array.
