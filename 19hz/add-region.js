#!/usr/bin/env node

/**
 * Helper script to generate regions.json entries
 * Usage: node add-region.js REGION_ID "Region Name" LAT LNG
 * Example: node add-region.js LosAngeles "Los Angeles" 34.0522 -118.2437
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 4) {
  console.error('Usage: node add-region.js REGION_ID "Region Name" LAT LNG');
  console.error('Example: node add-region.js LosAngeles "Los Angeles" 34.0522 -118.2437');
  process.exit(1);
}

const [regionId, regionName, lat, lng] = args;

// Validate coordinates
const latitude = parseFloat(lat);
const longitude = parseFloat(lng);

if (isNaN(latitude) || isNaN(longitude)) {
  console.error('Error: Invalid coordinates');
  process.exit(1);
}

// Load existing regions
const regionsPath = path.join(__dirname, 'regions.json');
let regions = [];

if (fs.existsSync(regionsPath)) {
  regions = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
}

// Check if region already exists
if (regions.some(r => r.id === regionId)) {
  console.error(`Error: Region "${regionId}" already exists`);
  process.exit(1);
}

// Create new region entry
const newRegion = {
  id: regionId,
  name: regionName,
  csvFile: `events_${regionId}.csv`,
  venuesFile: `venues_${regionId}.json`,
  center: {
    lat: latitude,
    lng: longitude
  }
};

// Add to regions array
regions.push(newRegion);

// Save back to file
fs.writeFileSync(regionsPath, JSON.stringify(regions, null, 2) + '\n');

console.log(`✓ Added region "${regionName}" to regions.json`);
console.log(JSON.stringify(newRegion, null, 2));
console.log('');
console.log('Next steps:');
console.log(`1. Make sure events_${regionId}.csv exists in this directory`);
console.log(`2. Run: node geocode-venues.js events_${regionId}.csv venues_${regionId}.json`);
console.log('3. Refresh the map to see events from this region');
