/**
 * Tests for the UGC sanitization utilities.
 *
 * Injects a variety of XSS and markup payloads and asserts they are
 * neutralised in output.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeShortText,
  sanitizeLongText,
  sanitizeResponse,
} from '../utils/sanitize.js';

// ─── Basic stripping ──────────────────────────────────────────────────────────

describe('sanitizeText — basic HTML stripping', () => {
  it('removes a simple script tag', () => {
    const out = sanitizeText('<script>alert("xss")</script>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
  });

  it('removes inline event handler attributes', () => {
    const out = sanitizeText('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('<img');
  });

  it('removes SVG-based XSS', () => {
    const out = sanitizeText('<svg onload="alert(document.cookie)"></svg>');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('onload');
  });

  it('removes iframe injection', () => {
    const out = sanitizeText('<iframe src="https://evil.com"></iframe>');
    expect(out).not.toContain('<iframe');
  });

  it('strips anchor with javascript: href', () => {
    const out = sanitizeText('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('javascript:');
  });

  it('strips bold/em tags but preserves visible text', () => {
    const out = sanitizeText('<b>Hello</b> <em>world</em>');
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<em>');
    expect(out).toContain('Hello');
    expect(out).toContain('world');
  });
});

// ─── Entity-encoded payloads ──────────────────────────────────────────────────

describe('sanitizeText — entity-encoded XSS', () => {
  it('handles &lt;script&gt; encoding', () => {
    const out = sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
  });

  it('handles &#60; numeric entity for <', () => {
    const out = sanitizeText('&#60;script&#62;evil()&#60;/script&#62;');
    expect(out).not.toContain('<script>');
  });

  it('handles hex entity &#x3C; for <', () => {
    const out = sanitizeText('&#x3C;img src=x onerror=alert(1)&#x3E;');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
  });
});

// ─── Protocol stripping ───────────────────────────────────────────────────────

describe('sanitizeText — dangerous protocol stripping', () => {
  it('strips javascript: as a bare value', () => {
    const out = sanitizeText('javascript:alert(1)');
    expect(out).not.toContain('javascript:');
  });

  it('strips data: URI', () => {
    const out = sanitizeText('data:text/html,<script>alert(1)</script>');
    expect(out).toBe('');
  });

  it('strips vbscript: protocol', () => {
    const out = sanitizeText('vbscript:msgbox(1)');
    expect(out).not.toContain('vbscript:');
  });

  it('allows https:// URLs in text (only stripping if whole value is dangerous)', () => {
    // A full sentence mentioning a URL should keep the URL visible
    const out = sanitizeText('Visit https://example.com for more info.');
    expect(out).toContain('https://example.com');
  });
});

// ─── Length limits ────────────────────────────────────────────────────────────

describe('sanitizeText — length enforcement', () => {
  it('truncates to default maxLength (10000)', () => {
    const long = 'A'.repeat(15_000);
    const out = sanitizeText(long);
    expect(out.length).toBe(10_000);
  });

  it('truncates to custom maxLength', () => {
    const out = sanitizeText('Hello world', { maxLength: 5 });
    expect(out).toBe('Hello');
  });

  it('does not truncate content within the limit', () => {
    const text = 'Short text';
    expect(sanitizeText(text)).toBe('Short text');
  });
});

// ─── Whitespace and control characters ───────────────────────────────────────

describe('sanitizeText — whitespace normalisation', () => {
  it('normalises CRLF to LF', () => {
    const out = sanitizeText('line1\r\nline2\r\nline3');
    expect(out).not.toContain('\r');
    expect(out).toContain('\n');
  });

  it('removes null bytes', () => {
    const out = sanitizeText('hello\x00world');
    expect(out).not.toContain('\x00');
  });

  it('removes other control characters', () => {
    const out = sanitizeText('abc\x01\x02\x03def');
    expect(out).toBe('abcdef');
  });

  it('preserves tab characters (legitimate whitespace)', () => {
    const out = sanitizeLongText('column1\tcolumn2');
    expect(out).toContain('\t');
  });
});

// ─── Null / non-string input ──────────────────────────────────────────────────

describe('sanitizeText — edge inputs', () => {
  it('returns empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeText(undefined)).toBe('');
  });

  it('returns empty string for non-string number', () => {
    expect(sanitizeText(42)).toBe('');
  });

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });
});

// ─── sanitizeShortText ────────────────────────────────────────────────────────

describe('sanitizeShortText', () => {
  it('collapses newlines to spaces', () => {
    const out = sanitizeShortText('line1\nline2');
    expect(out).not.toContain('\n');
    expect(out).toContain('line1');
    expect(out).toContain('line2');
  });

  it('enforces default 500-char limit', () => {
    const out = sanitizeShortText('X'.repeat(600));
    expect(out.length).toBe(500);
  });
});

// ─── sanitizeResponse ─────────────────────────────────────────────────────────

describe('sanitizeResponse', () => {
  it('strips script tags from host response', () => {
    const out = sanitizeResponse('<script>steal(cookie)</script>Thanks for staying!');
    expect(out).not.toContain('<script>');
    expect(out).toContain('Thanks for staying');
  });

  it('enforces 2000-char limit by default', () => {
    const out = sanitizeResponse('Y'.repeat(3000));
    expect(out.length).toBe(2000);
  });
});

// ─── Multi-vector payloads ────────────────────────────────────────────────────

describe('sanitizeText — combined attack vectors', () => {
  const PAYLOADS = [
    '<IMG SRC=x onerror="alert(String.fromCharCode(88,83,83))">',
    '"><script>alert(document.domain)</script>',
    "'><script>alert(1)</script>",
    '<body onload=alert(1)>',
    '<<SCRIPT>alert("XSS");//<</SCRIPT>',
    '<scr<script>ipt>alert(1)</scr<script>ipt>',
    '<script/xss src="http://evil.com/evil.js">',
    '<!--[if gte IE 4]><SCRIPT>alert("XSS");</SCRIPT><![endif]-->',
    '%3cscript%3ealert(1)%3c/script%3e',
  ];

  for (const payload of PAYLOADS) {
    it(`neutralises payload: ${payload.slice(0, 50)}`, () => {
      const out = sanitizeText(payload);
      // The output must not contain any opening angle bracket followed by
      // a known dangerous tag name
      expect(out).not.toMatch(/<\s*(script|img|body|iframe|svg|object|embed)/i);
      expect(out).not.toContain('onerror');
      expect(out).not.toContain('onload');
      expect(out).not.toContain('javascript:');
    });
  }
});
