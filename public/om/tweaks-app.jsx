/*
 * Tweaks panel for the Offering Memorandum / Proposal.
 *
 * Exposes:
 *   - Page orientation (landscape / portrait)
 *   - Accent color, heading font
 *   - Postcard size toggle (6×4 standard / 8.5×5.5 jumbo)
 *
 * Page inclusion (checkboxes for each page) lives in the sidebar, not here —
 * see the inline #om-nav script in Offering Memorandum.html.
 */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#A51123",
  "headingFont": "DM Serif Display",
  "orientation": "landscape",
  "postcardSize": "standard"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  '#A51123', // EP Burgundy
  '#E20A24', // EP Red
  '#1F3A5F', // Navy
  '#2F5D3F', // Forest
  '#5B3B82', // Plum
  '#B66A2A'  // Copper
];

const HEADING_FONTS = [
  'DM Serif Display',
  'Playfair Display',
  'Montserrat',
  'Cormorant Garamond',
  'Libre Caslon Text'
];

function applyTweaks(t) {
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--serif', `"${t.headingFont}", Georgia, serif`);
  ensureFont(t.headingFont);
  applyOrientation(t.orientation);
  applyPostcardSize(t.postcardSize);
}

/* Toggle between landscape (default) and portrait. Updates the
   `.om-shell.is-portrait` class on screen and rewrites the @page rule
   used by the print stylesheet so Save-as-PDF respects the choice. */
function applyOrientation(orient) {
  const shell = document.getElementById('omShell');
  if (shell) shell.classList.toggle('is-portrait', orient === 'portrait');

  let style = document.getElementById('om-print-orientation');
  if (!style) {
    style = document.createElement('style');
    style.id = 'om-print-orientation';
    document.head.appendChild(style);
  }
  if (orient === 'portrait') {
    style.textContent = `@media print { @page { size: 8.5in 11in; margin: 0; } .om-page { width: 8.5in !important; min-height: 11in !important; } }`;
  } else {
    style.textContent = `@media print { @page { size: 11in 8.5in; margin: 0; } .om-page { width: 11in !important; min-height: 8.5in !important; } }`;
  }
}

/* Postcard size — swap the .pc-6x4 / .pc-jumbo class on every postcard
   element. The size label on each page also updates. */
function applyPostcardSize(size) {
  const isJumbo = size === 'jumbo';
  document.querySelectorAll('.postcard-page .pc').forEach((el) => {
    el.classList.toggle('pc-6x4', !isJumbo);
    el.classList.toggle('pc-jumbo', isJumbo);
  });
  document.querySelectorAll('.postcard-page .stage-meta, #postcard-a-size-label, #postcard-b-size-label').forEach((el) => {
    if (!el) return;
    el.textContent = isJumbo ? '8.5 × 5.5 in · Jumbo' : '6 × 4 in · Standard';
  });
}

const loadedFonts = new Set(['DM Serif Display', 'Montserrat']);
function ensureFont(name) {
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const fam = name.replace(/ /g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/* -------------------------------------------------------------
 * The panel
 * ------------------------------------------------------------- */
const { useEffect } = React;

function OMTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => { applyTweaks(t); }, [t.accent, t.headingFont, t.orientation, t.postcardSize]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Page">
        <TweakRadio
          label="Orientation"
          value={t.orientation}
          options={[
            {value:'landscape', label:'Landscape'},
            {value:'portrait',  label:'Portrait'}
          ]}
          onChange={(v) => setTweak('orientation', v)}
        />
      </TweakSection>

      <TweakSection title="Theme">
        <TweakColor
          label="Accent color"
          value={t.accent}
          options={ACCENT_OPTIONS}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSelect
          label="Heading font"
          value={t.headingFont}
          options={HEADING_FONTS}
          onChange={(v) => setTweak('headingFont', v)}
        />
      </TweakSection>

      <TweakSection title="Marketing Collateral">
        <TweakRadio
          label="Postcard size"
          value={t.postcardSize}
          options={[
            {value:'standard', label:'6 × 4'},
            {value:'jumbo',    label:'8.5 × 5.5'}
          ]}
          onChange={(v) => setTweak('postcardSize', v)}
        />
      </TweakSection>

      <TweakSection title="Export">
        <TweakButton
          label="Print / Save as PDF"
          onClick={() => window.print()}
        />
        <p style={{margin:'8px 0 0',fontSize:10.5,lineHeight:1.5,color:'#888'}}>
          In the browser print dialog: choose <strong>Save as PDF</strong>, set margins to <strong>None</strong>, and keep background graphics <strong>on</strong>. Unchecked pages in the sidebar are skipped.
        </p>
      </TweakSection>
    </TweaksPanel>
  );
}

// Apply persisted tweaks immediately on load (before React mounts)
applyTweaks(TWEAK_DEFAULTS);

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<OMTweaks />);
