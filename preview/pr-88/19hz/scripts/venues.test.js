const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('venue scripts extract, merge and geocode without losing existing data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), '19hz-venues-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const scripts = path.join(directory, 'scripts');
  fs.mkdirSync(scripts);
  for (const script of ['extract-venues.js', 'merge-venues.js', 'geocode-venues.js']) {
    fs.copyFileSync(path.join(__dirname, script), path.join(scripts, script));
  }
  const venuesFile = path.join(directory, 'venues.json');
  const existing = { name: 'Existing', address: 'San Francisco', geometry: { lat: 1, lng: 2 } };
  fs.writeFileSync(venuesFile, JSON.stringify([existing]));
  const mock = path.join(directory, 'mock.js');
  fs.writeFileSync(mock, `
    const { EventEmitter } = require('node:events');
    global.fetch = async url => ({
      ok: !process.env.FAIL_FETCH,
      status: 503,
      text: async () => 'date,title,genre,"New Venue (Oakland)"\\n'
    });
    require('node:https').get = (url, options, callback) => {
      const request = new EventEmitter();
      process.nextTick(() => {
        const response = new EventEmitter();
        response.statusCode = process.env.FAIL_GEOCODE ? 503 : 200;
        response.resume = () => {};
        callback(response);
        if (response.statusCode === 200) {
          response.emit('data', '[{"lat":"37.8","lon":"-122.2"}]');
          response.emit('end');
        }
      });
      return request;
    };
  `);
  const run = (script, env = {}) => spawnSync(process.execPath, ['--require', mock, script], {
    cwd: scripts,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });

  assert.equal(run('extract-venues.js').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'new-venues.json'))), [
    { name: 'New Venue (Oakland)', address: 'Oakland' }
  ]);
  assert.equal(run('merge-venues.js').status, 0);
  assert.equal(run('geocode-venues.js').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(venuesFile)), [
    existing,
    { name: 'New Venue (Oakland)', address: 'Oakland', geometry: { lat: 37.8, lng: -122.2 } }
  ]);

  const fetchFailure = run('extract-venues.js', { FAIL_FETCH: '1' });
  assert.notEqual(fetchFailure.status, 0);
  assert.match(fetchFailure.stderr, /HTTP 503/);

  fs.writeFileSync(venuesFile, JSON.stringify([{ name: 'New Venue', address: 'Oakland' }]));
  const geocodeFailure = run('geocode-venues.js', { FAIL_GEOCODE: '1' });
  assert.notEqual(geocodeFailure.status, 0);
  assert.match(geocodeFailure.stderr, /HTTP 503/);
});
