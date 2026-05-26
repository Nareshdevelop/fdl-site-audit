// fdl-site-audit — open-source SMB website audit core
//
// Pure Node.js, zero dependencies. Audits any website on 5 pillars (100 pts total):
//   Performance (25) · SEO (25) · Mobile (20) · Security (15) · AEO/Modernity (15)
//
// Powered by fivedaylaunch.com. MIT-licensed. PRs welcome.
//
// Usage:
//   const { auditUrl } = require('fdl-site-audit');
//   const result = await auditUrl('https://example.com');
//   console.log(result.score, result.findings);

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const FETCH_TIMEOUT_MS = 12000;
const MAX_BODY_BYTES = 800_000;
const MIN_BODY_BYTES_FOR_AUDIT = 500;

function fetchUrl(targetUrl) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    const start = Date.now();
    let firstByteMs = null;
    let bodyBuf = [];
    let totalBytes = 0;
    try {
      const u = new URL(targetUrl);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: (u.pathname || '/') + (u.search || ''),
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; fdl-site-audit/1.0; +https://github.com/fivedaylaunch/fdl-site-audit)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
      }, (res) => {
        firstByteMs = Date.now() - start;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.destroy();
          const newUrl = new URL(res.headers.location, targetUrl).href;
          if (newUrl === targetUrl) return done({ ok: false, error: 'redirect_loop' });
          return fetchUrl(newUrl).then(done);
        }
        res.on('data', (chunk) => {
          if (totalBytes < MAX_BODY_BYTES) { bodyBuf.push(chunk); totalBytes += chunk.length; }
        });
        res.on('end', () => done({
          ok: true, status: res.statusCode, headers: res.headers,
          body: Buffer.concat(bodyBuf).toString('utf-8'),
          ttfb: firstByteMs, totalBytes, finalUrl: targetUrl,
        }));
      });
      req.on('error', (e) => done({ ok: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); done({ ok: false, error: 'timeout' }); });
    } catch (e) { done({ ok: false, error: e.message }); }
  });
}

function extractChecks(html, headers, url) {
  const h = html || '';
  const c = {};
  const titleMatch = h.match(/<title[^>]*>([^<]+)<\/title>/i);
  c.title = titleMatch ? titleMatch[1].trim() : null;
  c.title_len = c.title ? c.title.length : 0;
  const descMatch = h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
  c.description = descMatch ? descMatch[1].trim() : null;
  c.description_len = c.description ? c.description.length : 0;
  const h1Match = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  c.h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 200) : null;
  c.has_viewport = /<meta[^>]+name=["']viewport["']/i.test(h);
  c.has_favicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(h);
  c.has_og_image = /<meta[^>]+property=["']og:image["']/i.test(h);
  c.has_og_title = /<meta[^>]+property=["']og:title["']/i.test(h);
  c.has_jsonld = /<script[^>]+type=["']application\/ld\+json["']/i.test(h);
  c.has_microdata = /itemscope[^>]*itemtype=/i.test(h);
  const robotsMatch = h.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i);
  c.robots_content = robotsMatch ? robotsMatch[1] : null;
  const imgTags = h.match(/<img[^>]*>/gi) || [];
  const imgsWithAlt = imgTags.filter(t => /\salt\s*=/.test(t));
  c.img_count = imgTags.length;
  c.img_missing_alt = imgTags.length - imgsWithAlt.length;
  c.is_https = new URL(url).protocol === 'https:';
  if (c.is_https) {
    const mixed = h.match(/(?:src|href)=["']http:\/\/[^"']+/gi) || [];
    c.mixed_content_count = mixed.filter(m => !m.includes('http://www.w3.org')).length;
  } else { c.mixed_content_count = 0; }
  c.has_hsts = !!(headers['strict-transport-security']);
  c.script_count = (h.match(/<script[^>]+src=["']([^"']+)/gi) || []).length;
  return c;
}

function score(c, ttfb, pageBytes) {
  const findings = [];
  const breakdown = {};

  let perf = 25;
  if (ttfb > 800)  { perf -= 8;  findings.push(`Slow server response (TTFB ${ttfb}ms, target <600ms)`); }
  else if (ttfb > 600) perf -= 4;
  if (pageBytes > 500_000) { perf -= 10; findings.push(`Heavy page weight (${Math.round(pageBytes/1024)}KB, target <300KB)`); }
  else if (pageBytes > 300_000) perf -= 5;
  if (c.script_count > 15) { perf -= 5; findings.push(`Too many third-party scripts (${c.script_count}, recommend <10)`); }
  perf = Math.max(0, perf);
  breakdown.performance = { score: perf, max: 25, ttfb_ms: ttfb, page_bytes: pageBytes };

  let seo = 25;
  if (!c.title) { seo -= 8; findings.push('Missing <title> tag'); }
  else if (c.title_len < 30) { seo -= 3; findings.push(`Title too short (${c.title_len} chars) — Google prefers 50-60`); }
  else if (c.title_len > 70) { seo -= 2; findings.push(`Title too long (${c.title_len} chars) — Google truncates at ~60`); }
  if (!c.description) { seo -= 6; findings.push('Missing meta description'); }
  else if (c.description_len < 50 || c.description_len > 165) { seo -= 2; findings.push(`Meta description length is ${c.description_len} chars (target 120-160)`); }
  if (!c.h1) { seo -= 5; findings.push('No <h1> heading — major SEO signal missing'); }
  if (c.img_missing_alt > 3) { seo -= 3; findings.push(`${c.img_missing_alt} images missing alt text`); }
  if (c.robots_content && /noindex/i.test(c.robots_content)) { seo -= 8; findings.push('Page has noindex tag'); }
  seo = Math.max(0, seo);
  breakdown.seo = { score: seo, max: 25 };

  let mob = 20;
  if (!c.has_viewport) { mob -= 15; findings.push('No mobile viewport tag — page is unusable on phones'); }
  mob = Math.max(0, mob);
  breakdown.mobile = { score: mob, max: 20 };

  let sec = 15;
  if (!c.is_https) { sec -= 12; findings.push('No SSL/HTTPS — browsers warn visitors'); }
  if (c.mixed_content_count > 0) { sec -= 4; findings.push(`Mixed content (${c.mixed_content_count} insecure resources)`); }
  if (!c.has_hsts && c.is_https) sec -= 1;
  sec = Math.max(0, sec);
  breakdown.security = { score: sec, max: 15 };

  let aeo = 15;
  if (!c.has_jsonld && !c.has_microdata) { aeo -= 8; findings.push('No structured data (JSON-LD/schema) — invisible to ChatGPT, Perplexity, Gemini'); }
  if (!c.has_favicon) { aeo -= 2; findings.push('Missing favicon'); }
  if (!c.has_og_image) { aeo -= 3; findings.push('Missing og:image — no preview when shared on social'); }
  if (!c.has_og_title) aeo -= 2;
  aeo = Math.max(0, aeo);
  breakdown.aeo = { score: aeo, max: 15 };

  return {
    total: perf + seo + mob + sec + aeo,
    breakdown, findings,
  };
}

function gradeFromScore(s) {
  if (s == null) return { letter: '?', color: '#94a3b8', label: 'Could not audit' };
  if (s >= 90) return { letter: 'A', color: '#10b981', label: 'Excellent' };
  if (s >= 75) return { letter: 'B', color: '#22c55e', label: 'Good' };
  if (s >= 60) return { letter: 'C', color: '#eab308', label: 'Average' };
  if (s >= 40) return { letter: 'D', color: '#f97316', label: 'Below average' };
  return { letter: 'F', color: '#ef4444', label: 'Needs work' };
}

/**
 * Run a full audit on a URL.
 * @param {string} url - The URL to audit (https:// preferred; http will be tried as fallback).
 * @returns {Promise<{ok: boolean, url: string, score: number, grade: string, breakdown: object, findings: string[], page_bytes: number, ttfb_ms: number, error?: string}>}
 */
async function auditUrl(url) {
  // Normalize
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  let r = await fetchUrl(target);
  if (!r.ok && target.startsWith('https://')) {
    r = await fetchUrl(target.replace('https://', 'http://'));
  }
  if (!r.ok) {
    return { ok: false, url: target, error: r.error, score: null, grade: '?' };
  }
  if ((r.totalBytes || 0) < MIN_BODY_BYTES_FOR_AUDIT || [403, 406, 429].includes(r.status)) {
    return {
      ok: false, url: r.finalUrl, error: `Site blocks automated audit (HTTP ${r.status}, ${r.totalBytes||0} bytes)`,
      score: null, grade: '?', is_blocked: true,
    };
  }

  const checks = extractChecks(r.body || '', r.headers || {}, r.finalUrl);
  const s = score(checks, r.ttfb || 0, r.totalBytes || 0);
  const grade = gradeFromScore(s.total);
  return {
    ok: true, url: r.finalUrl, score: s.total, grade: grade.letter, grade_label: grade.label,
    breakdown: s.breakdown, findings: s.findings,
    page_bytes: r.totalBytes, ttfb_ms: r.ttfb,
    title: checks.title, description: checks.description, h1: checks.h1,
  };
}

module.exports = { auditUrl, gradeFromScore, extractChecks, score };
