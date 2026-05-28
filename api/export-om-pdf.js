export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { proposalId, orientation } = req.body
  if (!proposalId) return res.status(400).json({ error: 'proposalId required' })

  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return res.status(500).json({ error: 'BROWSERLESS_TOKEN not configured' })

  const isLandscape = orientation !== 'portrait'
  const vpW = isLandscape ? 1056 : 816
  const vpH = isLandscape ? 816 : 1056
  const pdfW = isLandscape ? '11in' : '8.5in'
  const pdfH = isLandscape ? '8.5in' : '11in'
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  const omUrl = `${proto}://${host}/om?proposal=${proposalId}&view=client`

  const styleContent = `
    .om-sidebar, #tweaks-root, .om-collapse-strip, .om-generate-btn { display: none !important; }
    .om-shell { display: block !important; width: ${vpW}px !important; grid-template-columns: 1fr !important; }
    .om-stage { display: block !important; width: ${vpW}px !important; padding: 0 !important; margin: 0 !important; }
    .om-page { width: ${vpW}px !important; margin: 0 !important; }
  `

  // Real Puppeteer code run on Browserless — setViewport BEFORE goto so the
  // page lays out at the correct width from the start.
  // Browserless /function JSON-stringifies the return value, so we can't
  // return raw bytes or a Response. base64-encode the PDF inside the function
  // (browser-like runtime — use btoa, not Buffer) and decode server-side.
  // deviceScaleFactor:1 — 2x DPI ballooned the PDF.
  const fnCode = `
    export default async function ({ page }) {
      await page.setViewport({ width: ${vpW}, height: ${vpH}, deviceScaleFactor: 1 });
      await page.goto(${JSON.stringify(omUrl)}, { waitUntil: 'networkidle0', timeout: 45000 });
      try { await page.waitForFunction(() => window.__omDataReady === true, { timeout: 30000 }); } catch (e) {}
      await new Promise(r => setTimeout(r, 2000));
      await page.addStyleTag({ content: ${JSON.stringify(styleContent)} });
      const pdf = await page.pdf({
        width: ${JSON.stringify(pdfW)},
        height: ${JSON.stringify(pdfH)},
        printBackground: true,
        scale: 1,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        preferCSSPageSize: false
      });
      const bytes = new Uint8Array(pdf);
      let binary = '';
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      }
      return { pdf: btoa(binary) };
    }
  `

  try {
    const bl = await fetch(`https://production-sfo.browserless.io/function?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: fnCode }),
    })

    if (!bl.ok) {
      const text = await bl.text().catch(() => '')
      console.error('Browserless error:', bl.status, text)
      return res.status(502).json({ error: 'Browserless failed: ' + text.slice(0, 200) })
    }

    const json = await bl.json().catch(() => null)
    const b64 = json?.pdf || json?.data?.pdf
    if (!b64) {
      console.error('Browserless returned no pdf field:', JSON.stringify(json).slice(0, 300))
      return res.status(502).json({ error: 'Browserless returned no PDF data' })
    }
    const pdf = Buffer.from(b64, 'base64')

    if (!pdf.length || pdf.slice(0, 4).toString() !== '%PDF') {
      console.error('Invalid PDF output, first bytes:', pdf.slice(0, 16).toString())
      return res.status(502).json({ error: 'Generated output is not a valid PDF' })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OM-${proposalId}.pdf"`)
    res.setHeader('Content-Length', pdf.length)
    res.status(200).send(pdf)
  } catch (err) {
    console.error('PDF export error:', err)
    res.status(500).json({ error: err.message || 'PDF generation failed' })
  }
}
