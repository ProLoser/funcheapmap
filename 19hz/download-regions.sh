#!/bin/bash

# List of potential North American regions
regions=(
  "LosAngeles"
  "Seattle"
  "Portland"
  "SanDiego"
  "Denver"
  "Chicago"
  "Austin"
  "LasVegas"
  "Phoenix"
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

echo "Attempting to download CSV files for North American regions..."

for region in "${regions[@]}"; do
  url="https://19hz.info/events_${region}.csv"
  filename="events_${region}.csv"
  
  echo "Trying: $url"
  
  # Use curl with timeout and follow redirects
  if curl -s -f -L -m 10 "$url" -o "$filename" 2>/dev/null; then
    # Check if file has content (more than 100 bytes to ensure it's not an error page)
    if [ -s "$filename" ] && [ $(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null) -gt 100 ]; then
      echo "✓ Downloaded: $filename ($(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null) bytes)"
    else
      echo "✗ File too small or empty: $filename"
      rm -f "$filename"
    fi
  else
    echo "✗ Failed: $url"
  fi
  
  sleep 0.5  # Be nice to the server
done

echo ""
echo "Downloaded files:"
ls -lh events_*.csv
