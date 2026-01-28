# 19hz Multi-Region Integration

## Overview
This integration loads events from multiple North American regions from 19hz.info and displays them on an interactive map.

## Setup Instructions

### 1. Discover Available Regions

Visit https://19hz.info/ in your browser and look for region links. Common North American regions include:
- Bay Area (already configured)
- Los Angeles
- San Diego
- Seattle
- Portland
- Denver
- Phoenix
- Las Vegas
- Austin
- Chicago
- New York
- Boston
- Miami
- Atlanta
- Washington DC
- Toronto
- Vancouver
- Montreal

### 2. Download CSV Files

For each region you want to add:
1. Visit the region's event listing page: `https://19hz.info/eventlisting_REGION.php`
2. Download the corresponding CSV file: `https://19hz.info/events_REGION.csv`
3. Save it to the `/19hz/` folder

Example for Los Angeles:
```bash
cd 19hz
curl -O https://19hz.info/events_LosAngeles.csv
```

### 3. Geocode Venues

For each new region, you need to geocode the venues:

1. Run the geocoding script for the region:
```bash
cd 19hz
node geocode-venues.js events_REGIONNAME.csv venues_REGIONNAME.json
```

This will create a venues JSON file with geocoded locations for all venues in that region's CSV.

### 4. Update regions.json

Add each new region to `regions.json`:

```json
[
  {
    "id": "BayArea",
    "name": "San Francisco Bay Area",
    "csvFile": "events_BayArea.csv",
    "venuesFile": "venues.json",
    "center": {
      "lat": 37.76173100956567,
      "lng": -122.4386811010743
    }
  },
  {
    "id": "LosAngeles",
    "name": "Los Angeles",
    "csvFile": "events_LosAngeles.csv",
    "venuesFile": "venues_LosAngeles.json",
    "center": {
      "lat": 34.0522,
      "lng": -118.2437
    }
  }
]
```

## Architecture

### Map Centering
The map now defaults to a North America view (centered at 39.8283°N, 98.5795°W with zoom level 4) instead of focusing only on San Francisco.

### Multi-Region Loading
The `Events` class now:
1. Loads `regions.json` configuration
2. Queries each region's CSV and venues in parallel
3. Merges all events into a single data store
4. Each event includes a `region` field for filtering

### File Structure
```
19hz/
├── index.html              # Main HTML page
├── map.js                  # Map and event handling logic
├── regions.json            # Region configuration
├── events_BayArea.csv      # Bay Area events CSV
├── venues.json             # Bay Area venues with geocoding
├── events_REGION.csv       # Additional region CSVs
├── venues_REGION.json      # Additional region venues
└── geocode-venues.js       # Venue geocoding utility
```

## Features

- **Multi-region support**: Load events from multiple cities/regions
- **North America view**: Default map centered on North America
- **Region filtering**: Each event tagged with its region
- **Automatic merging**: All regions' events appear on the same map
- **Error handling**: Failed region loads don't break other regions

## Development

To test locally:
```bash
python -m http.server 8000
# Visit http://localhost:8000/19hz/index.html
```
