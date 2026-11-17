const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('filter groups events by venue rather than shared coordinates', async () => {
  const markers = [];
  class AdvancedMarkerElement {
    constructor(options) {
      Object.assign(this, options);
      markers.push(this);
    }
    addEventListener() {}
  }
  class PinElement {
    constructor(options) {
      Object.assign(this, options);
    }
  }
  const map = {};
  const geometry = { lat: 37.779, lng: -122.419 };
  const events = [
    { title: 'First', venue: 'Venue A', geometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Second', venue: 'Venue A', geometry: { lat: 37.78, lng: -122.42 }, date: '2026-01-02', categories: ['Techno'] },
    { title: 'Third', venue: 'Venue B', geometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Fourth', venue: '', geometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Fifth', venue: '', geometry, date: '2026-01-01', categories: ['House'] }
  ];
  events.forEach(event => event.marker = { map, content: { style: {} } });
  const form = { elements: { countEvents: {}, countCategories: {} } };
  const context = {
    window: { map, events: { get: () => events }, history: { replaceState() {} } },
    document: { getElementById: () => form },
    IntersectionObserver: class { observe() {} },
    google: { maps: { importLibrary: async () => ({ AdvancedMarkerElement, PinElement }) } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'map.js'), 'utf8'), context);

  await context.window.filter();
  assert.equal(markers.length, 1);
  assert.equal(markers[0].title, '2 events at Venue A');
  assert.equal(markers[0].content.glyphText, '2');
  assert.equal(events[0].marker.map, null);
  assert.equal(events[1].marker.map, null);
  assert.equal(events[2].marker.map, map);
  assert.equal(events[3].marker.map, map);
  assert.equal(events[4].marker.map, map);
  assert.equal(form.elements.countEvents.innerText, 5);

  await context.window.filter({ category: 'House' });
  assert.equal(markers[0].map, null);
  assert.equal(markers.length, 1);
  assert.equal(events[0].marker.map, map);
  assert.equal(events[1].marker.map, null);
  assert.equal(events[2].marker.map, map);
  assert.equal(form.elements.countEvents.innerText, 4);
});
