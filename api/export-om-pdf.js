import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { proposalId, orientation } = req.body
  if (!proposalId) return res.status(400).json({ error: 'proposalId required' })

  const isLandscape = orientation !== 'portrait'
  let browser
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: isLandscape ? 1056 : 816,
        height: isLandscape ? 816 : 1056,
        deviceScaleFactor: 2,
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host
    const url = `${proto}://${host}/om?proposal=${proposalId}&view=client`

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 50000 })

    // Wait for OM data layer to finish populating fields
    await page.waitForFunction(() => window.__omDataReady === true, { timeout: 30000 })

    // Extra settle time for fonts + image-slot custom elements to render
    await new Promise(r => setTimeout(r, 1500))

    const pdf = await page.pdf({
      format: 'Letter',
      landscape: isLandscape,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: false,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OM-${proposalId}.pdf"`)
    res.setHeader('Content-Length', pdf.length)
    res.status(200).send(pdf)
  } catch (err) {
    console.error('PDF export error:', err)
    res.status(500).json({ error: err.message || 'PDF generation failed' })
  } finally {
    if (browser) try { await browser.close() } catch {}
  }
}
