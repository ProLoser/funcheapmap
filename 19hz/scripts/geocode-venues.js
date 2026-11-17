const fs = require('fs');
const path = require('path');
const https = require('https');

const INPUT_FILE = path.join(__dirname, '../venues.json');
const OUTPUT_FILE = path.join(__dirname, '../venues.json');
const DELAY_MS = 1000;
const force = process.argv.includes('--force');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    const options = {
      headers: {
        'User-Agent': 'FunCheapSFMap/1.0'
      }
    };
    
    https.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Geocoding request failed: HTTP ${response.statusCode}`));
        return;
      }
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon)
            });
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function processVenues() {
  console.log('Reading data file...');
  const inputExists = fs.existsSync(INPUT_FILE);
  const rawData = inputExists ? fs.readFileSync(INPUT_FILE, 'utf8') : '[]';
  const data = JSON.parse(rawData);
  if (!inputExists) fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  
  const venuesWithoutGeometry = data.filter(venue => !venue.geometry);
  const venuesWithGeometry = data.filter(venue => venue.geometry);
  const venuesToGeocode = force ? data : venuesWithoutGeometry;
  
  console.log(`Total venues: ${data.length}`);
  console.log(`Venues with geometry: ${venuesWithGeometry.length}`);
  console.log(`Venues missing geometry: ${venuesWithoutGeometry.length}`);
  console.log('');
  
  console.log(`Venues to geocode${force ? ' (forced)' : ''}: ${venuesToGeocode.length}`);

  let successCount = 0;
  let failCount = 0;
  
  for (const [index, venue] of venuesToGeocode.entries()) {
    const query = venue.label;
    
    if (!query) {
      console.log(`[${index + 1}/${venuesToGeocode.length}] Skipping ${venue.name} - no label`);
      failCount++;
      continue;
    }
    
    try {
      console.log(`[${index + 1}/${venuesToGeocode.length}] Geocoding: ${query}`);
      
      const geometry = await geocodeAddress(query);
      
      if (geometry) {
        venue.geometry = geometry;
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
        console.log(`  ✓ Found: ${geometry.lat}, ${geometry.lng}`);
        successCount++;
      } else {
        console.log(`  ✗ No results found`);
        failCount++;
      }
      
      if (index < venuesToGeocode.length - 1) {
        await delay(DELAY_MS);
      }
    } catch (error) {
      throw new Error(`Failed to geocode ${venue.name}: ${error.message}`, { cause: error });
    }
  }
  
  console.log('');
  console.log('='.repeat(50));
  console.log('Geocoding complete!');
  console.log(`Successfully geocoded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Output saved to: ${OUTPUT_FILE}`);
}

processVenues().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
