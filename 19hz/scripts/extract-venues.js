const fs = require('fs');
const path = require('path');

const VENUES_FILE = path.join(__dirname, '../venues.json');

const CSV_FILES = [
  'BayArea', 'LosAngeles', 'Seattle', 'Atlanta', 'Miami', 'DC', 'Toronto',
  'Iowa', 'Texas', 'PHL', 'Denver', 'CHI', 'Detroit', 'Massachusetts',
  'LasVegas', 'Phoenix', 'PNW'
].map(region => `https://19hz.info/events_${region}.csv`);

function parseCSV(csvText) {
  const rows = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    row.push(currentField.trim());
    rows.push(row);
  }
  
  return rows;
}

async function extractVenuesFromCSV(url) {
  console.log(`\nProcessing ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  const venues = new Set();
  
  rows.forEach((row, index) => {
    if (row.length >= 4) {
      const venueName = row[3];
      if (venueName && venueName.includes('(') && venueName.includes(')')) {
        venues.add(venueName);
      }
    }
  });
  
  console.log(`Found ${venues.size} unique venues`);
  return Array.from(venues).sort();
}

async function main() {
  console.log('Extracting venues from CSV files...');
  const existingVenues = fs.existsSync(VENUES_FILE)
    ? JSON.parse(fs.readFileSync(VENUES_FILE, 'utf8'))
    : [];
  const allVenues = new Map(existingVenues.map(venue => [venue.label.toLowerCase(), venue]));
  let extractedCount = 0;

  for (const file of CSV_FILES) {
    const venues = await extractVenuesFromCSV(file);
    venues.forEach(venue => {
      const match = venue.match(/^(.+?)\s*\((.+)\)$/);
      if (!match) return;
      extractedCount++;
      const key = venue.toLowerCase();
      if (!allVenues.has(key)) {
        allVenues.set(key, { label: venue, name: match[1].trim(), address: match[2].trim() });
      }
    });
  }

  if (!extractedCount) throw new Error('No venues found in CSV files');
  console.log(`\nTotal unique venues across all files: ${allVenues.size}`);
  const sortedVenues = Array.from(allVenues.values()).sort((firstVenue, secondVenue) => firstVenue.label.localeCompare(secondVenue.label));
  fs.writeFileSync(VENUES_FILE, JSON.stringify(sortedVenues, null, 2));
  console.log(`Done! Wrote ${allVenues.size} venues to venues.json`);
}

main().catch(error => {
  console.error('Failed to extract venues:', error);
  process.exitCode = 1;
});
