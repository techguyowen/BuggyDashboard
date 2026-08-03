const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.resolve(__dirname, '../server.js');

test('Expiration & Buffer: server.js uses getEasternDateStr for Eastern Time timezone alignment', () => {
  const content = fs.readFileSync(SERVER_PATH, 'utf8');

  assert.strictEqual(
    content.includes('function getEasternDateStr'),
    true,
    'server.js must define getEasternDateStr helper function'
  );
  assert.strictEqual(
    content.includes("timeZone: 'America/New_York'"),
    true,
    'getEasternDateStr must target America/New_York timezone'
  );
  assert.strictEqual(
    content.includes('const todayStr = getEasternDateStr();'),
    true,
    'Scraper must use getEasternDateStr() instead of UTC to compare auction slug dates'
  );
});

test('Expiration & Buffer: server.js retains items ending today until 11:59:59 PM EDT', () => {
  const content = fs.readFileSync(SERVER_PATH, 'utf8');

  assert.strictEqual(
    content.includes('T23:59:59-04:00'),
    true,
    'Pruning logic must calculate 11:59:59 PM EDT cutoff for retention'
  );
  assert.strictEqual(
    content.includes('itemCutoffMs'),
    true,
    'Pruning logic must evaluate itemCutoffMs against nowMs'
  );
});
