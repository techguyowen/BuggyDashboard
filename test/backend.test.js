const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.resolve(__dirname, '../server.js');

test('Backend: server.js contains target URLs for buggybusters.com', () => {
  const content = fs.readFileSync(SERVER_PATH, 'utf8');

  // Verify scraper and auth target URLs
  assert.strictEqual(
    content.includes("https://auction.buggybusters.com/"),
    true,
    'server.js must contain target homepage URL https://auction.buggybusters.com/'
  );
  assert.strictEqual(
    content.includes("https://auction.buggybusters.com/login"),
    true,
    'server.js must contain login target URL https://auction.buggybusters.com/login'
  );
  assert.strictEqual(
    content.includes("https://auction.buggybusters.com/watched-lots"),
    true,
    'server.js must contain watched-lots target URL https://auction.buggybusters.com/watched-lots'
  );
});

test('Backend: server.js defines expected API routes and status messages', () => {
  const content = fs.readFileSync(SERVER_PATH, 'utf8');

  // Verify API route definitions
  assert.strictEqual(content.includes('/api/auth/login'), true, 'server.js must define /api/auth/login endpoint');
  assert.strictEqual(content.includes('/api/watchlist/sync'), true, 'server.js must define /api/watchlist/sync endpoint');
  assert.strictEqual(content.includes('/api/scrape'), true, 'server.js must define /api/scrape endpoint');
  assert.strictEqual(content.includes('/api/progress'), true, 'server.js must define /api/progress endpoint');

  // Verify Buggy Busters user status messages
  assert.strictEqual(
    content.includes('Invalid login credentials for Buggy Busters account.'),
    true,
    'server.js must present Buggy Busters login error message'
  );
  assert.strictEqual(
    content.includes('imported from Buggy Busters account.'),
    true,
    'server.js must present Buggy Busters watchlist sync message'
  );
  assert.strictEqual(
    content.includes('🚀 Buggy Busters Auction Tracker Running'),
    true,
    'server.js must print Buggy Busters startup banner'
  );
});
