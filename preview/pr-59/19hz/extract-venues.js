const fs = require('fs');

const CSV_FILES = [
  https://19hz.info/events_BayArea.csv
  https://19hz.info/events_LosAngeles.csv
  https://19hz.info/events_Seattle.csv
  https://19hz.info/events_Atlanta.csv
  https://19hz.info/events_Miami.csv
  https://19hz.info/events_DC.csv
  https://19hz.info/events_Toronto.csv
  https://19hz.info/events_Iowa.csv
  https://19hz.info/events_Texas.csv
  https://19hz.info/events_PHL.csv
  https://19hz.info/events_Denver.csv
  https://19hz.info/events_CHI.csv
  https://19hz.info/events_Detroit.csv
  https://19hz.info/events_Massachusetts.csv
  https://19hz.info/events_LasVegas.csv
  https://19hz.info/events_Phoenix.csv
  https://19hz.info/events_ORE.csv
  https://19hz.info/events_BC.csv
];

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

function extractVenuesFromCSV(filename) {
  console.log(`\nProcessing ${filename}...`);
  const csvText = fs.readFileSync(filename, 'utf8');
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

console.log('Extracting venues from CSV files...');

const allVenues = new Map();

CSV_FILES.forEach(file => {
  const venues = extractVenuesFromCSV(file);
  venues.forEach(venue => {
    const match = venue.match(/^(.+?)\s*\((.+)\)$/);
    if (match) {
      const name = match[1].trim();
      const address = match[2].trim();
      allVenues.set(venue, { name: venue, address: address });
    }
  });
});

console.log(`\nTotal unique venues across all files: ${allVenues.size}`);
console.log('\nWriting to new-venues.json...');

const venueArray = Array.from(allVenues.values());
fs.writeFileSync('new-venues.json', JSON.stringify(venueArray, null, 2));

console.log(`Done! Wrote ${venueArray.length} venues to new-venues.json`);
