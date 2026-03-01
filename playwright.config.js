module.exports = {
  testDir: 'tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
}
