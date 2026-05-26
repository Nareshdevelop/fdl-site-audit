# fdl-site-audit

> Free, deterministic, zero-dependency website audit library. The same engine that powers [the public registry at fivedaylaunch.com/sites](https://fivedaylaunch.com/sites).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![No dependencies](https://img.shields.io/badge/dependencies-0-blue)](./package.json)

Audit any website on **5 pillars** (100 points total):

| Pillar | Max | What it checks |
|---|---|---|
| **Performance** | 25 | TTFB, page weight, third-party script count |
| **SEO** | 25 | Title, meta description, H1, alt text, noindex |
| **Mobile** | 20 | Viewport tag, responsive readiness |
| **Security** | 15 | HTTPS, mixed content, HSTS |
| **AEO / Modernity** | 15 | JSON-LD, favicon, og:image, og:title |

Scored deterministically — no AI inference, no LLM tokens, no API keys, no rate limits, **no cost**. Average audit takes under a second.

## Install

```bash
npm install fdl-site-audit
```

## Usage

```javascript
const { auditUrl } = require('fdl-site-audit');

(async () => {
  const result = await auditUrl('https://example.com');
  console.log(`Score: ${result.score}/100 (Grade ${result.grade})`);
  console.log(`Findings: ${result.findings.length}`);
  result.findings.forEach(f => console.log('  -', f));
})();
```

### Example output

```js
{
  ok: true,
  url: 'https://example.com',
  score: 85,
  grade: 'B',
  grade_label: 'Good',
  breakdown: {
    performance: { score: 10, max: 25, ttfb_ms: 97, page_bytes: 579130 },
    seo: { score: 25, max: 25 },
    mobile: { score: 20, max: 20 },
    security: { score: 15, max: 15 },
    aeo: { score: 15, max: 15 }
  },
  findings: [
    'Heavy page weight (566KB, target <300KB)',
    'Too many third-party scripts (71, recommend <10)'
  ],
  page_bytes: 579130,
  ttfb_ms: 97,
  title: 'Example Title',
  description: 'Example meta description',
  h1: 'Example H1'
}
```

### Grade scale

| Score | Grade | Label |
|---|---|---|
| 90-100 | **A** | Excellent |
| 75-89 | **B** | Good |
| 60-74 | **C** | Average |
| 40-59 | **D** | Below average |
| 0-39 | **F** | Needs work |

## API

### `auditUrl(url) → Promise<result>`

Run a full audit on a URL. Returns a result object with `ok`, `score`, `grade`, `breakdown`, `findings`, and metadata.

If the site blocks automated audits (HTTP 403/406/429 or tiny response body), `result.ok` is `false` and `result.is_blocked` is `true`.

### `gradeFromScore(score) → { letter, color, label }`

Convert a numeric score (0-100) into a letter grade with display color.

### `extractChecks(html, headers, url) → object`

Pure HTML-to-checks extraction. Useful if you've already fetched the page and just want to score it.

### `score(checks, ttfb_ms, page_bytes) → { total, breakdown, findings }`

Pure scoring function. Useful for testing or rebuilding the scoring logic.

## Why this exists

Most SMB website audit tools are either paid ($$$/mo SaaS), gated (Google PageSpeed needs API quotas), or biased toward enterprise concerns. `fdl-site-audit` is the small-business-first audit:

- **Free forever.** MIT-licensed, zero dependencies.
- **Self-hostable.** Works in any Node 18+ environment. No external API calls beyond fetching the target URL itself.
- **AEO-aware.** Scoring weighs structured data (JSON-LD/schema) for AI-search visibility — most modern audits ignore this.
- **No false precision.** 5 simple pillars beat 80 obscure metrics. Findings are concrete and actionable.

Used in production by [fivedaylaunch.com](https://fivedaylaunch.com) to audit thousands of small business websites.

## Integration ideas

- **CI gate:** fail your build if your site scores below B.
- **Free public tool:** spin up a `/audit?url=X` endpoint in your own app.
- **Pre-sales lead-gen:** audit a prospect's site before your sales call.
- **Sentiment dashboard:** track score history for your portfolio of client sites.
- **Comparison tool:** audit two sites and show side-by-side.

## Contributing

PRs welcome. Particularly looking for:

- Additional check primitives (e.g. WebP image detection, lazy-load coverage, font-display checks)
- Performance benchmarks
- Test coverage
- Per-niche scoring presets (e.g. e-commerce vs blog vs SaaS)

## License

MIT © 2026 [fivedaylaunch.com](https://fivedaylaunch.com)

---

Built by the team at [fivedaylaunch.com](https://fivedaylaunch.com) — we build small business websites in 5 days for $799.
