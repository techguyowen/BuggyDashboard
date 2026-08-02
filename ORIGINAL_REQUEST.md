# Original User Request

## Initial Request — 2026-08-01T12:02:59-04:00

Convert the live auction tracking dashboard and Puppeteer scraper codebase from Triangle Liquidators (`auction.triangleliquidators.com`) to Buggy Busters (`https://auction.buggybusters.com/`).

Working directory: `/Users/techguyowen/Downloads/Buggy Dashboard copy/Buggy Dashboard`
Integrity mode: development

## Requirements

### R1. UI & Branding Rebranding
Update all frontend templates (`public/index.html`, metadata, titles, logos, tooltips, and favicon references) to replace all references to "Triangle Liquidators" with "Buggy Busters", using `https://auction.buggybusters.com/` as the primary target domain.

### R2. Scraper & Backend API Adaptation
Update `server.js` and any related backend services so that all Puppeteer scraping operations, login authentication, watched-lot sync, and sample/fallback catalog links query and scrape `https://auction.buggybusters.com/`.

### R3. Financial Fee Structure & Configuration
Ensure the financial calculator logic (Buyer's Premium, Tax rates, Credit Card fees) accurate reflects Buggy Busters' structure or remains flexibly configurable, with clear UI descriptions.

### R4. Application Integrity & Functional Verification
Ensure the server starts cleanly without errors, all endpoints respond correctly, and the front-end loads without broken branding or dead links to the old domain.

## Acceptance Criteria

### Branding & UI Integrity
- Zero remaining references to "Triangle Liquidators" or `triangleliquidators.com` across UI HTML, scripts, metadata, and CSS.
- All page titles, headers, brand logos, modals, and tooltips display "Buggy Busters" branding.

### Scraper & Backend Functionality
- All Puppeteer navigation calls (`goto`), endpoint URLs, and watchlist sync functions in `server.js` target `https://auction.buggybusters.com/`.
- Sample data and fallback links point to valid Buggy Busters URLs.

### Server & System Verification
- Node server starts up without missing dependencies or broken route configurations.

## Follow-up — 2026-08-02T13:09:22Z

Adapt the backend and scanner to live Buggy Busters catalog structures, purge old cached items, update the UI color scheme for Buggy Busters branding, and verify live item scraping.

Working directory: `/Users/techguyowen/Downloads/Buggy Dashboard copy/Buggy Dashboard`
Integrity mode: development

## Requirements

### R1. Backend & Live Scanner Buggy Busters Adaptation
Adapt the Puppeteer crawler, selectors, and API endpoints in `server.js` to target and parse live auction listings from `https://auction.buggybusters.com/`.

### R2. Database & Cache Purge
Clear out all legacy cached auction items from `catalog_cache.json` and reset the in-memory master catalog store to ensure only fresh Buggy Busters items are stored and served.

### R3. UI Color Scheme Redesign
Update the frontend stylesheet and theme variables in `public/index.html` (and CSS) with a refreshed color palette suited for Buggy Busters branding (e.g., custom accent colors, modern dark glassmorphism).

### R4. Live Item Scraping Test & Verification
Execute automated tests and live scraper validation to verify that actual auction items, images, bids, and titles are correctly pulled from `https://auction.buggybusters.com/`.

## Acceptance Criteria

### Backend & Crawler
- Puppeteer crawler successfully navigates `https://auction.buggybusters.com/` and parses live auction lots.
- `catalog_cache.json` is cleared of legacy items and populated only with newly scraped Buggy Busters lots.

### UI & Styling
- Modernized color scheme and CSS variables updated across the dashboard UI.
- All elements render seamlessly with the new theme.

### Verification
- Automated tests verify live item extraction, catalog API responses, and database cleanliness.
