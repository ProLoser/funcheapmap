# 19hz Event Mapper with Spotify Preview

Variation of my funcheapsfmap based off of data scraped from 19hz with a spotify embedded player so you can try preview the artists.

## Venues
Venues are stored in [venues.json](./venues.json). To update them, run **Update 19hz venues** from the repository's Actions tab. The workflow runs the extraction, merge, and geocoding scripts and opens or updates a pull request when the venue file changes.

The repository's Actions settings must allow GitHub Actions to create pull requests. The workflow uses `GITHUB_TOKEN` with contents and pull request write permissions.
