# Project: Buggy Busters Auction Tracker Migration

## Architecture
- Node.js Express server (`server.js`) with Puppeteer scraping engine
- Single-page Frontend (`public/index.html`, `public/favicon.svg`)
- Financial calculator utility functions (in both `server.js` and `public/index.html`)
- Local JSON cache storage (`catalog_cache.json`)

## Code Layout
- `server.js`: Express REST API, Puppeteer background scraper targeting `https://auction.buggybusters.com/`, login auth, watched-lot sync, disk cache auto-persistence
- `public/index.html`: SPA UI layout with modern obsidian dark glassmorphism styling, CSS variables, client-side financial calc, localStorage handlers, IndexedDB catalog cache
- `public/favicon.svg`: Brand favicon asset
- `package.json`: Project dependencies and scripts
- `catalog_cache.json`: Local cached auction catalog data (3,080 fresh Buggy Busters lots, 0 legacy items)
- `test/`: Automated test suite directory (`branding.test.js`, `backend.test.js`, `financials.test.js`, `financial_edge_cases.test.js`, `server_smoke.test.js`)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Branding & UI Rebranding | `public/index.html`, `public/favicon.svg` | None | DONE |
| 2 | M2: Backend & Scraper Migration | `server.js`, `catalog_cache.json`, `package.json`, `README.md` | None | DONE |
| 3 | M3: Financial Fee Structure & Config Centralization | Fee logic in `server.js` & `public/index.html`, sidebar UI text | None | DONE |
| 4 | M4: Test Suite & Automated Verification | `test/`, `package.json` test script, E2E testing | M1, M2, M3 | DONE |
| 5 | M5: Live Buggy Busters Scanner Adaptation & UI Redesign | `server.js`, `catalog_cache.json`, `public/index.html`, live scraper validation | M1-M4 | DONE |

## Interface Contracts
### Backend API Endpoints
- `GET /api/scrape`: Returns active catalog items scraped from `https://auction.buggybusters.com/`
- `POST /api/auth/login`: Headless authentication to `https://auction.buggybusters.com/login`
- `POST /api/watchlist/sync`: Sync watched lots with `https://auction.buggybusters.com/watched-lots`
- `GET /api/stream`: SSE real-time catalog updates stream
- `GET /api/financials`: Returns calculated fee breakdown (15% BP, 7.25% Tax, 3% CC Fee)
