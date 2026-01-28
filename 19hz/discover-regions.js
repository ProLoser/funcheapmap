/**
 * This script would be run in a browser console on https://19hz.info/
 * to discover all available North American regions
 */

// Expected pattern based on problem statement:
// https://19hz.info/eventlisting_BayArea.php -> https://19hz.info/events_BayArea.csv

// To discover regions, user should:
// 1. Visit https://19hz.info/
// 2. Look for links or navigation to different regions
// 3. For each region page like eventlisting_REGION.php
// 4. Download the corresponding events_REGION.csv file

console.log('To discover regions manually:');
console.log('1. Visit https://19hz.info/ in your browser');
console.log('2. Look for region links or navigation menu');
console.log('3. List of typical regions to check:');

const typicalRegions = [
  'BayArea',
  'LosAngeles',
  'SanDiego',
  'Seattle',
  'Portland',
  'Denver',
  'Phoenix',
  'LasVegas',
  'Austin',
  'Chicago',
  'NewYork',
  'Boston',
  'Miami',
  'Atlanta',
  'WashingtonDC',
  'Toronto',
  'Vancouver',
  'Montreal'
];

typicalRegions.forEach(region => {
  const listingUrl = `https://19hz.info/eventlisting_${region}.php`;
  const csvUrl = `https://19hz.info/events_${region}.csv`;
  console.log(`${region}: ${listingUrl} -> ${csvUrl}`);
});

