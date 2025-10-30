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

2. Add your Apify API token to `.env`:
   ```
   APIFY_TOKEN=your_actual_apify_token_here
   ```

3. Open `index.html` in your browser directly, or use a local server:
   ```bash
   python -m http.server 8080
   # or
   npx http-server -p 8080
   ```

### GitHub Pages Deployment

The site automatically deploys to GitHub Pages when you push to the `gh-pages` branch.

**Required GitHub Secret:**

You need to add your Apify API token as a GitHub secret:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `APIFY_TOKEN`
5. Value: Your Apify API token
6. Click **Add secret**

The GitHub Actions workflow will automatically inject this token into the JavaScript file at build time.
