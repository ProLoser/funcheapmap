const fs = require('fs');
const https = require('https');

const INPUT_FILE = 'venues.json';
const OUTPUT_FILE = 'venues.json';
const DELAY_MS = 1000; // Nominatim requires 1 request per second

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
  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  // Remove control characters except newlines, tabs, and carriage returns
  const data = JSON.parse(rawData);
  
  const venuesWithoutGeometry = data.filter(venue => !venue.geometry);
  const venuesWithGeometry = data.filter(venue => venue.geometry);
  
  console.log(`Total venues: ${data.length}`);
  console.log(`Venues with geometry: ${venuesWithGeometry.length}`);
  console.log(`Venues missing geometry: ${venuesWithoutGeometry.length}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < venuesWithoutGeometry.length; i++) {
    const venue = venuesWithoutGeometry[i];
    
    if (!venue.address) {
      console.log(`[${i + 1}/${venuesWithoutGeometry.length}] Skipping ${venue.name} - no address`);
      failCount++;
      continue;
    }
    
    try {
      console.log(`[${i + 1}/${venuesWithoutGeometry.length}] Geocoding: ${venue.name} (${venue.address})`);
      
      const geometry = await geocodeAddress(venue.address);
      
      if (geometry) {
        venue.geometry = geometry;
        console.log(`  ✓ Found: ${geometry.lat}, ${geometry.lng}`);
        successCount++;
      } else {
        console.log(`  ✗ No results found`);
        failCount++;
      }
      
      // Save progress after each successful geocoding
      const updatedVenues = [...venuesWithGeometry, ...venuesWithoutGeometry];
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedVenues, null, 2));
      
      // Rate limiting - wait before next request
      if (i < venuesWithoutGeometry.length - 1) {
        await delay(DELAY_MS);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      failCount++;
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
