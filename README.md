# [FunCheapSF Mapper](https://proloser.github.io/funcheapmap/)
A map of FunCheapSF events

Data is refreshed every other day by Apify crawler.

[![Screenshot](https://proloser.github.io/funcheapmap/screenshot.png)](https://proloser.github.io/funcheapmap/)

Latest version has a button to quickly add events to your calendar of choice
<img width="741" alt="Screenshot 2024-08-05 at 1 38 18 PM" src="https://github.com/user-attachments/assets/14fcbafa-13b7-447e-9f1e-d018c191983c">

## Setup

### Local Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:
   ```
   APIFY_TOKEN=your_actual_apify_token_here
   GOOGLE_TOKEN=your_actual_google_maps_api_key_here
   SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
   ```
   
   **To get Spotify API credentials:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account
   - Click "Create app"
   - Fill in app name and description
   - Copy the Client ID and Client Secret

3. Open `index.html` in your browser directly, or use a local server:
   ```bash
   python -m http.server 8080
   # or
   npx http-server -p 8080
   ```

### GitHub Pages Deployment

The site automatically deploys to GitHub Pages when you push to the `gh-pages` branch.

**Required GitHub Secrets:**

You need to add your API tokens as GitHub secrets:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:
   - Name: `APIFY_TOKEN`, Value: Your Apify API token
   - Name: `GOOGLE_TOKEN`, Value: Your Google Maps API key
   - Name: `SPOTIFY_CLIENT_ID`, Value: Your Spotify Client ID
   - Name: `SPOTIFY_CLIENT_SECRET`, Value: Your Spotify Client Secret
5. Click **Add secret** for each

The GitHub Actions workflow will automatically inject these tokens into the JavaScript files at build time.

### Monthly console check

On the first of each month at 15:17 UTC, the monthly console check loads the production site in Chromium, waits for event initialization, and records console errors and uncaught exceptions. It can also be started from the Actions tab with **Run workflow**. The first run reports all errors it sees; later runs create an issue only for a previously unreported sanitized error, even if its earlier issue was closed. URLs and common credential fields are redacted from issue text.

Missing-geometry warnings are counted separately: the check mentions @ProLoser in an issue, or comments on the existing open issue each month they recur. It does not attempt automated fixes. GitHub notification settings determine how issue mentions and new issues are delivered. A failed page load or initialization fails the workflow rather than reporting a clean check. The check covers initial loading only, not subsequent interactions.
