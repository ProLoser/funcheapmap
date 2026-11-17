const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const checkConsole = require('./check-console')
const reportConsole = require('./report-console')

test('collects errors and geometry warnings through initialization', async () => {
  const handlers = {}
  const page = {
    on: (type, handler) => { handlers[type] = handler },
    goto: async () => {
      handlers.console({ type: () => 'warning', text: () => 'Event Geometry Missing {event: Object}' })
      handlers.console({ type: () => 'warning', text: () => 'Unrelated warning' })
      handlers.console({ type: () => 'error', text: () => 'Broken resource' })
      handlers.pageerror(new Error('Uncaught failure'))
      return { ok: () => true }
    },
    waitForFunction: async (predicate, argument, options) => {
      assert.equal(argument, null)
      assert.equal(options.timeout, 60000)
    },
    waitForTimeout: async () => {}
  }
  let closed = false
  const chromium = { launch: async () => ({ newPage: async () => page, close: async () => { closed = true } }) }
  assert.deepEqual(await checkConsole(chromium, 'http://example.test', 0), { errors: ['Broken resource', 'Uncaught failure'], geometryCount: 1, failed: false })
  assert.equal(closed, true)
})

test('marks unsuccessful navigation as a failed check', async () => {
  const page = { on: () => {}, goto: async () => ({ ok: () => false }) }
  const chromium = { launch: async () => ({ newPage: async () => page, close: async () => {} }) }
  assert.deepEqual(await checkConsole(chromium), { errors: [], geometryCount: 0, failed: true })
})

test('reports new errors once and reminds about recurring geometry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'console-check-'))
  const originalDirectory = process.cwd()
  process.chdir(directory)
  try {
    const issues = []
    const comments = []
    const github = {
      paginate: async () => issues,
      rest: { issues: {
        listForRepo: () => {},
        create: async issue => { issues.push({ ...issue, number: issues.length + 1, state: 'open' }) },
        createComment: async comment => { comments.push(comment) }
      } }
    }
    const context = { repo: { owner: 'owner', repo: 'repo' }, serverUrl: 'https://github.com', runId: 123 }
    writeFileSync('console-findings.json', JSON.stringify({ errors: ['Failed https://example.test/?token=secret', 'Failed https://example.test/?token=other'], geometryCount: 2 }))
    await reportConsole({ github, context })
    assert.equal(issues.length, 2)
    assert.match(issues[0].body, /Failed \[URL\]/)
    assert.doesNotMatch(issues[0].body, /secret|other/)
    assert.match(issues[1].body, /@ProLoser.*2 event/)
    issues[0].state = 'closed'
    await reportConsole({ github, context })
    assert.equal(issues.length, 2)
    assert.equal(comments.length, 1)
    assert.equal(comments[0].issue_number, issues[1].number)
    issues[1].state = 'closed'
    await reportConsole({ github, context })
    assert.equal(issues.length, 3)
    assert.match(issues[2].body, /@ProLoser/)
  } finally {
    process.chdir(originalDirectory)
    rmSync(directory, { recursive: true })
  }
})
