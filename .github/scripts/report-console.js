const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')

module.exports = async ({ github, context }) => {
  const findings = JSON.parse(readFileSync('console-findings.json', 'utf8'))
  const { owner, repo } = context.repo
  const run = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`
  const issues = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'all', per_page: 100 })
  const sanitize = text => text.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]').replace(/\b(token|key|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').replace(/@/g, '@\u200b').replace(/[<>]/g, character => character === '<' ? '&lt;' : '&gt;').replace(/\s+/g, ' ').slice(0, 1000)
  const errors = [...new Set(findings.errors.map(sanitize))]

  for (const error of errors) {
    const fingerprint = createHash('sha256').update(error).digest('hex')
    const marker = `<!-- monthly-console-error:${fingerprint} -->`
    if (issues.some(issue => !issue.pull_request && issue.body?.includes(marker))) continue
    await github.rest.issues.create({
      owner, repo,
      title: `Website console error (${fingerprint.slice(0, 12)})`,
      body: `${marker}\nThe monthly production check detected a new console error or uncaught exception:\n\n> ${error}\n\nURLs and common credentials are redacted. See the [workflow run](${run}) for context.`
    })
  }

  if (findings.geometryCount) {
    const marker = '<!-- monthly-console-missing-geometry -->'
    const issue = issues.find(issue => !issue.pull_request && issue.state === 'open' && issue.body?.includes(marker))
    const body = `@ProLoser The production check found ${findings.geometryCount} event(s) with missing geometry. See the [workflow run](${run}).`
    if (issue) await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body })
    else await github.rest.issues.create({ owner, repo, title: 'Events missing geometry', body: `${marker}\n${body}` })
  }
}
