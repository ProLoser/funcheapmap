#!/bin/bash

# Script to download CSV files for North American regions from 19hz.info
# Usage: ./download-regions.sh

echo "======================================"
echo "19hz Region CSV Downloader"
echo "======================================"
echo ""
echo "This script attempts to download CSV files for North American regions"
echo "from https://19hz.info/"
echo ""

# Create array to store successful downloads
declare -a successful_regions=()

# List of potential North American regions
regions=(
  "BayArea"
  "LosAngeles"
  "SanDiego"
  "Seattle"
  "Portland"
  "Denver"
  "Phoenix"
  "LasVegas"
  "Austin"
  "Chicago"
  "NewYork"
  "Boston"
  "Miami"
  "Atlanta"
  "WashingtonDC"
  "Toronto"
  "Vancouver"
  "Montreal"
  "SanFrancisco"
  "Sacramento"
  "SanJose"
  "Oakland"
)

echo "Attempting to download CSV files for ${#regions[@]} regions..."
echo ""

for region in "${regions[@]}"; do
  url="https://19hz.info/events_${region}.csv"
  filename="events_${region}.csv"
  
  # Skip if already exists
  if [ -f "$filename" ]; then
    echo "⊙ $region: Already downloaded (${filename})"
    successful_regions+=("$region")
    continue
  fi
  
  # Attempt download
  if curl -s -f -L -m 10 "$url" -o "$filename" 2>/dev/null; then
    # Check if file has content
    size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null)
    if [ -s "$filename" ] && [ "$size" -gt 100 ]; then
      echo "✓ $region: Downloaded (${size} bytes)"
      successful_regions+=("$region")
    else
      echo "✗ $region: File too small or empty"
      rm -f "$filename"
    fi
  else
    echo "✗ $region: Not available"
  fi
  
  sleep 0.5  # Be nice to the server
done

echo ""
echo "======================================"
echo "Download Summary"
echo "======================================"
echo "Total regions found: ${#successful_regions[@]}"
echo ""

if [ ${#successful_regions[@]} -gt 0 ]; then
  echo "Available CSV files:"
  ls -lh events_*.csv 2>/dev/null
  echo ""
  echo "Next steps:"
  echo "1. For each new region CSV, create a venues JSON file:"
  echo "   node geocode-venues.js events_REGION.csv venues_REGION.json"
  echo ""
  echo "2. Add each region to regions.json configuration file"
  echo ""
  echo "3. See README.md for detailed instructions"
else
  echo "No CSV files were downloaded."
  echo "You may need to download them manually from https://19hz.info/"
fi

