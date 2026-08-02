# E2E Test Infra: Buggy Busters Auction Tracker

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Systematic testing across 4 tiers: Feature Coverage, Boundary/Edge Cases, Pairwise Interactions, and Real-World Application Scenarios.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | UI Branding & Links | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ | ✓ |
| 2 | Backend Scraper & API URLs | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| 3 | Financial Fee Structure & Calculator | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ | ✓ |
| 4 | Server & Endpoint Integrity | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test runner: `npm test` using node test runner or Jest suite in `test/`
- Test files:
  - `test/branding.test.js`: Checks for zero remaining references to Triangle Liquidators and presence of Buggy Busters domain
  - `test/backend.test.js`: Checks `server.js` route URLs, scraper defaults, and fallback endpoints
  - `test/financials.test.js`: Verifies exact Buyer's Premium (15%), Tax (7.25%), CC Fee (3%), total compounding, and rounding parity between frontend and backend
- Expected: All tests pass with exit code 0
