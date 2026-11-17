const { writeFileSync } = require('node:fs')
async function checkConsole(chromium, url = 'https://funcheapsfmap.com/', settleTime = 5000) {
  const findings = { errors: [], geometryCount: 0, failed: false }
  let browser
  try {
    browser = await chromium.launch()
    const page = await browser.newPage()
    page.on('console', message => {
      if (message.type() === 'warning' && message.text().startsWith('Event Geometry Missing')) findings.geometryCount++
      else if (message.type() === 'error') findings.errors.push(message.text())
    })
    page.on('pageerror', error => findings.errors.push(error.message))
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (!response || !response.ok()) throw new Error('Production site returned an unsuccessful response')
    await page.waitForFunction(() => window.events && Array.isArray(window.events.cache) && document.querySelector('#map-canvas #controls'), null, { timeout: 60000 })
    await page.waitForTimeout(settleTime)
  } catch (error) {
    findings.failed = true
    console.error('The production site check could not complete:', error.message.replace(/https?:\/\/\S+/g, '[URL]'))
  } finally {
    if (browser) await browser.close()
  }
  return findings
}

if (require.main === module) checkConsole(require('playwright').chromium).then(findings => {
  writeFileSync('console-findings.json', JSON.stringify(findings))
  if (findings.failed) process.exitCode = 1
})

module.exports = checkConsole
