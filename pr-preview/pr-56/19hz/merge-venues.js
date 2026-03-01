const fs = require('fs');

console.log('Loading existing venues...');
const existingVenues = JSON.parse(fs.readFileSync('venues.json', 'utf8'));

console.log('Loading new venues...');
const newVenues = JSON.parse(fs.readFileSync('new-venues.json', 'utf8'));

console.log(`Existing venues: ${existingVenues.length}`);
console.log(`New venues: ${newVenues.length}`);

const venueMap = new Map();

existingVenues.forEach(venue => {
  const key = venue.name.toLowerCase();
  venueMap.set(key, venue);
});

let addedCount = 0;

newVenues.forEach(venue => {
  const key = venue.name.toLowerCase();
  if (!venueMap.has(key)) {
    venueMap.set(key, venue);
    addedCount++;
  }
});

const mergedVenues = Array.from(venueMap.values()).sort((a, b) => 
  a.name.localeCompare(b.name)
);

console.log(`\nAdded ${addedCount} new venues`);
console.log(`Total venues: ${mergedVenues.length}`);

fs.writeFileSync('venues.json', JSON.stringify(mergedVenues, null, 2));
console.log('\nUpdated venues.json');
