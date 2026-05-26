// Minimal smoke tests. No test framework — pure assertions.

const assert = require('assert');
const { gradeFromScore, score, extractChecks } = require('../audit');

console.log('Running fdl-site-audit tests...');

// gradeFromScore
assert.equal(gradeFromScore(95).letter, 'A');
assert.equal(gradeFromScore(80).letter, 'B');
assert.equal(gradeFromScore(65).letter, 'C');
assert.equal(gradeFromScore(45).letter, 'D');
assert.equal(gradeFromScore(20).letter, 'F');
assert.equal(gradeFromScore(null).letter, '?');
console.log('  ✓ gradeFromScore');

// extractChecks — basic HTML parsing
const html = `<!doctype html>
<html><head>
<title>Example Domain — A solid SEO-optimized title</title>
<meta name="description" content="A test description that is just about right in length for SEO purposes here.">
<meta name="viewport" content="width=device-width">
<link rel="icon" href="/favicon.ico">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:title" content="Example">
<script type="application/ld+json">{}</script>
</head><body><h1>Hello world</h1><img src="x.jpg" alt="x"></body></html>`;
const c = extractChecks(html, { 'strict-transport-security': 'max-age=31536000' }, 'https://example.com');
assert.equal(c.title, 'Example Domain — A solid SEO-optimized title');
assert.equal(c.h1, 'Hello world');
assert.equal(c.has_viewport, true);
assert.equal(c.has_favicon, true);
assert.equal(c.has_og_image, true);
assert.equal(c.has_jsonld, true);
assert.equal(c.is_https, true);
assert.equal(c.has_hsts, true);
console.log('  ✓ extractChecks');

// score — perfect site should score 100
const s = score(c, 200, 50_000);
assert.equal(s.total, 100, `expected 100, got ${s.total}`);
assert.equal(s.findings.length, 0);
console.log('  ✓ score (perfect site → 100)');

// score — broken site should score badly
const broken = extractChecks('<html></html>', {}, 'http://example.com');
const sBad = score(broken, 2000, 1_000_000);
assert.ok(sBad.total < 30, `expected score < 30, got ${sBad.total}`);
assert.ok(sBad.findings.length > 5, `expected > 5 findings`);
console.log('  ✓ score (broken site → <30)');

console.log('\nAll tests passed.');
