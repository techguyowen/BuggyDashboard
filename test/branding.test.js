const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['.agents', 'node_modules', '.git', 'test']);
const IGNORED_FILES = new Set(['ORIGINAL_REQUEST.md', 'PROJECT.md', 'TEST_INFRA.md']);

function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (IGNORED_FILES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    // Explicitly ignore files inside test/, .agents/, node_modules/, .git/ or matching IGNORED_FILES
    const parts = relPath.split(path.sep);
    if (parts.some(p => IGNORED_DIRS.has(p) || IGNORED_FILES.has(p))) continue;

    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

test('Branding: zero occurrences of legacy branding outside .agents/', () => {
  const files = getFilesRecursively(ROOT_DIR);
  const legacyTerms = [
    'triangle' + 'liquidators',
    'Triangle ' + 'Liquidators',
    'triangle' + 'liquidators.com'
  ];
  const violations = [];

  for (const filePath of files) {
    if (filePath.endsWith('.png') || filePath.endsWith('.ico') || filePath.endsWith('.svg') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const term of legacyTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        violations.push({ file: path.relative(ROOT_DIR, filePath), term });
      }
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `Found legacy branding occurrences: ${JSON.stringify(violations, null, 2)}`
  );
});

test('Branding: verifies presence of Buggy Busters domain in key files', () => {
  const targetDomain = 'auction.buggybusters.com';
  const keyFiles = ['server.js', 'package.json', 'README.md', 'public/index.html', 'catalog_cache.json'];

  for (const relPath of keyFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    assert.strictEqual(fs.existsSync(fullPath), true, `File should exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.strictEqual(
      content.includes(targetDomain) || content.includes('buggybusters') || content.includes('Buggy Busters'),
      true,
      `File ${relPath} must contain Buggy Busters domain or reference`
    );
  }
});
