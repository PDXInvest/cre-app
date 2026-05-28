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

  try {
    const bl = await fetch(`https://production-sfo.browserless.io/pdf?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: omUrl,
        viewport: { width: vpW, height: vpH },
        gotoOptions: { waitUntil: 'networkidle0', timeout: 45000 },
        // Wait until the OM data layer signals it has populated the page
        waitForFunction: {
          fn: 'function(){return window.__omDataReady===true}',
          timeout: 30000,
        },
        options: {
          width: pdfW,
          height: pdfH,
          printBackground: true,
          scale: 1,
          margin: { top: '0', bottom: '0', left: '0', right: '0' },
          preferCSSPageSize: false,
        },
      }),
    })

    if (!bl.ok) {
      const text = await bl.text().catch(() => '')
      console.error('Browserless error', bl.status, text)
      return res.status(502).json({ error: `Browserless failed (${bl.status})` })
    }

    const arrayBuffer = await bl.arrayBuffer()
    const pdf = Buffer.from(arrayBuffer)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OM-${proposalId}.pdf"`)
    res.setHeader('Content-Length', pdf.length)
    res.status(200).send(pdf)
  } catch (err) {
    console.error('PDF export error:', err)
    res.status(500).json({ error: err.message || 'PDF generation failed' })
  }
}
