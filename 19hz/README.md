# 19hz Event Mapper with Spotify Preview

Variation of my funcheapsfmap based off of data scraped from 19hz with a spotify embedded player so you can try preview the artists.

## Venues
Venues are stored in [venues.json](./venues.json). To update them, run **Update 19hz venues** from the repository's Actions tab. The workflow runs the extraction, merge, and geocoding scripts and opens or updates a pull request when the venue file changes.

Geocoding searches for the venue name and address together. To retry existing extracted venues whose address is only a city, select **Re-geocode existing venues whose address is only their city** when starting the workflow, or run `node geocode-venues.js --refresh-city-only` from `19hz/scripts`. This can take a long time; existing coordinates are retained when a search has no result.

The repository's Actions settings must allow GitHub Actions to create pull requests. The workflow uses `GITHUB_TOKEN` with contents and pull request write permissions.
