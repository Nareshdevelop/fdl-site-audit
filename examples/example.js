// Example: audit a single site and pretty-print the result.

const { auditUrl, gradeFromScore } = require('../audit');

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.log('Usage: node example.js <url> [<url2> ...]');
  console.log('Example: node example.js stripe.com github.com');
  process.exit(1);
}

(async () => {
  for (const target of targets) {
    process.stdout.write(`Auditing ${target}... `);
    const r = await auditUrl(target);
    if (!r.ok) {
      console.log(`FAILED — ${r.error}`);
      continue;
    }
    const g = gradeFromScore(r.score);
    console.log(`\n  Score: ${r.score}/100  Grade ${g.letter}  (${g.label})`);
    console.log(`  Title: ${r.title || '(none)'}`);
    console.log(`  Page weight: ${Math.round(r.page_bytes / 1024)} KB  ·  TTFB: ${r.ttfb_ms} ms`);
    console.log(`  Breakdown:`);
    for (const [k, v] of Object.entries(r.breakdown)) {
      console.log(`    ${k.padEnd(14)} ${v.score}/${v.max}`);
    }
    if (r.findings.length === 0) {
      console.log('  ✓ No findings.');
    } else {
      console.log(`  Findings (${r.findings.length}):`);
      r.findings.forEach(f => console.log(`    - ${f}`));
    }
    console.log('');
  }
})();
