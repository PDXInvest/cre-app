export const config = { maxDuration: 60 }

/**
 * Server-side PDF export of the templated OM. The renderer at /om is now a
 * clean React document (no sidebar / editor chrome in client view) whose
 * print CSS sizes each .om-page to a full Letter-landscape sheet, so the
 * export is a straight page.pdf with no viewport/scale gymnastics.
 *
 * Uses Browserless /function (managed Chrome). Browserless JSON-stringifies
 * the return value, so the PDF is base64-encoded in the runtime (btoa, no
 * Node Buffer there) and decoded server-side.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { proposalId, orientation } = req.body
  if (!proposalId) return res.status(400).json({ error: 'proposalId required' })

  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return res.status(500).json({ error: 'BROWSERLESS_TOKEN not configured' })

  const isLandscape = orientation !== 'portrait'
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  const omUrl = `${proto}://${host}/om?proposal=${proposalId}&view=client`

  const fnCode = `
    export default async function ({ page }) {
      await page.goto(${JSON.stringify(omUrl)}, { waitUntil: 'networkidle0', timeout: 45000 });
      // Wait for the React renderer to mount the page stack.
      await page.waitForSelector('.om-page', { timeout: 30000 });
      // Brief settle for fonts + image-slot rendering.
      await new Promise(r => setTimeout(r, 1500));
      const pdf = await page.pdf({
        format: 'Letter',
        landscape: ${isLandscape},
        printBackground: true,
        scale: 1,
        margin: { top: '0', bottom: '0', left: '0', right: '0' }
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
