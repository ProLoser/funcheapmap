const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('filter groups nearby events and recalculates groups when zoom changes', async () => {
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
  let zoom = 16;
  const map = { getZoom: () => zoom };
  const geometry = { lat: 37.779, lng: -122.419 };
  const distantGeometry = { lat: 37.789, lng: -122.419 };
  const events = [
    { title: 'First', venue: 'Venue A', geometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Second', venue: 'Venue A', geometry: { lat: 37.78, lng: -122.42 }, date: '2026-01-02', categories: ['Techno'] },
    { title: 'Third', venue: 'Venue B', geometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Fourth', venue: '', geometry: distantGeometry, date: '2026-01-01', categories: ['House'] },
    { title: 'Fifth', venue: '', geometry: distantGeometry, date: '2026-01-01', categories: ['House'] }
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
  assert.equal(markers.length, 2);
  assert.deepEqual(markers.map(marker => marker.content.glyphText), ['2', '2']);
  assert.equal(events[0].marker.map, null);
  assert.equal(events[1].marker.map, map);
  assert.equal(events[2].marker.map, null);
  assert.equal(events[3].marker.map, null);
  assert.equal(events[4].marker.map, null);
  assert.equal(form.elements.countEvents.innerText, 5);

  zoom = 13;
  await context.window.filter();
  assert.equal(markers[2].content.glyphText, '3');
  assert.equal(markers[3].content.glyphText, '2');
  assert.equal(events[1].marker.map, null);

  await context.window.filter({ category: 'House' });
  assert.equal(markers[2].map, null);
  assert.equal(markers[3].map, null);
  assert.equal(markers.length, 6);
  assert.equal(events[0].marker.map, null);
  assert.equal(events[1].marker.map, null);
  assert.equal(events[2].marker.map, null);
  assert.equal(form.elements.countEvents.innerText, 4);
});
