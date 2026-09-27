(function scholarMirrorModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.RFScholarMirrors = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createScholarMirrorApi() {
  'use strict';

  const DOI_PATTERN = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
  const RESULT_SELECTORS = [
    '#gs_res_ccl_mid .gs_r',
    '.gs_r.gs_or.gs_scl',
    '.gs_scl',
    '[data-cid].gs_r',
    '[data-rp]'
  ];

  function cleanText(value, maxLength = 4000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return /^https?:$/.test(url.protocol) ? url : null;
    } catch (_) {
      return null;
    }
  }

  function isOfficialScholarHost(hostname) {
    const host = cleanText(hostname, 255).toLowerCase();
    return host === 'scholar.google.com'
      || host === 'scholar.googleusercontent.com'
      || /^scholar\.google\.[a-z.]+$/.test(host);
  }

  function queryFirst(scope, selectors) {
    for (const selector of selectors) {
      const node = scope?.querySelector?.(selector);
      if (node) return node;
    }
    return null;
  }

  function countMatches(scope, selectors) {
    return selectors.reduce((count, selector) => {
      try {
        return count + Number(scope?.querySelectorAll?.(selector)?.length || 0);
      } catch (_) {
        return count;
      }
    }, 0);
  }

  function scholarFingerprint(documentLike, pageUrl = '') {
    const url = safeUrl(pageUrl);
    const official = isOfficialScholarHost(url?.hostname);
    let score = official ? 30 : 0;
    const evidence = [];

    const resultCount = countMatches(documentLike, RESULT_SELECTORS);
    if (resultCount > 0) {
      score += 35;
      evidence.push('result-container');
    }
    if (queryFirst(documentLike, ['h3.gs_rt', '.gs_rt', '#gs_res_ccl_mid'])) {
      score += 25;
      evidence.push('result-title');
    }
    if (queryFirst(documentLike, ['.gs_a', '.gs_rs', '.gs_fl', '.gs_or_ggsm'])) {
      score += 20;
      evidence.push('scholar-metadata');
    }
    if (queryFirst(documentLike, [
      'form[action*="/scholar"]',
      'input[name="q"][type="text"]',
      '#gs_hdr_tsi',
      '#gs_top'
    ])) {
      score += 20;
      evidence.push('scholar-search');
    }

    const title = cleanText(documentLike?.title, 240);
    if (/google\s*scholar|谷歌学术|学术搜索/i.test(title)) {
      score += 15;
      evidence.push('page-title');
    }

    return {
      detected: resultCount > 0
        && score >= 75
        && (official || evidence.includes('scholar-metadata') || evidence.includes('scholar-search')),
      score: Math.min(score, 100),
      evidence,
      official,
      hostname: url?.hostname || ''
    };
  }

  function findResults(documentLike) {
    const seen = new Set();
    const results = [];
    for (const selector of RESULT_SELECTORS) {
      const nodes = Array.from(documentLike?.querySelectorAll?.(selector) || []);
      nodes.forEach(node => {
        if (
          !seen.has(node)
          && queryFirst(node, ['h3.gs_rt a', '.gs_rt a', 'h3 a', '.gs_rt'])
        ) {
          seen.add(node);
          results.push(node);
        }
      });
    }
    return results;
  }

  function extractDoi(...values) {
    for (const value of values) {
      const match = cleanText(value).match(DOI_PATTERN);
      if (match) return match[1].replace(/[.,;)\]]+$/, '');
    }
    return '';
  }

  function parseCitationLine(value) {
    const text = cleanText(value, 1000);
    const parts = text.split(/\s+-\s+/).map(part => cleanText(part, 500)).filter(Boolean);
    return {
      authors: parts[0] || '',
      publication: parts.length > 1 ? parts.slice(1).join(' — ') : ''
    };
  }

  function cleanResultTitle(value) {
    return cleanText(value, 500)
      .replace(/^(?:\[(?:PDF|HTML|BOOK|CITATION|引用|图书)\]\s*)+/i, '')
      .trim();
  }

  function unwrapScholarUrl(value, pageUrl = '') {
    const parsed = safeUrl(value);
    if (!parsed) return '';
    if (/\/scholar_(?:url|lookup)/i.test(parsed.pathname)) {
      const target = parsed.searchParams.get('url') || parsed.searchParams.get('q');
      const unwrapped = safeUrl(target);
      if (unwrapped) return unwrapped.href;
    }
    if (parsed.origin === safeUrl(pageUrl)?.origin && parsed.searchParams.has('url')) {
      const unwrapped = safeUrl(parsed.searchParams.get('url'));
      if (unwrapped) return unwrapped.href;
    }
    return parsed.href;
  }

  function parseAuthorList(value) {
    const text = cleanText(value, 1000);
    if (!text) return [];
    const separator = /[;；]|\s+\band\b\s+|\s+、\s*/i;
    let parts = text.split(separator).map(part => cleanText(part, 200)).filter(Boolean);
    if (parts.length === 1 && text.includes(',')) {
      const commaParts = text.split(/\s*,\s*/).map(part => cleanText(part, 200)).filter(Boolean);
      const looksLikeAuthorList = commaParts.length > 1
        && commaParts.length <= 30
        && commaParts.every(part => part.split(/\s+/).length <= 6);
      if (looksLikeAuthorList) parts = commaParts;
    }
    return parts;
  }

  function captureResult(result, fingerprint, pageUrl = '') {
    const titleNode = queryFirst(result, ['h3.gs_rt a', '.gs_rt a', 'h3 a', '.gs_rt']);
    const citationNode = queryFirst(result, ['.gs_a', '[class*="author"]', '[class*="citation"]']);
    const abstractNode = queryFirst(result, ['.gs_rs', '[class*="abstract"]', '[class*="snippet"]']);
    const pdfNode = queryFirst(result, [
      '.gs_or_ggsm a[href]',
      '.gs_ggs a[href]',
      'a[href$=".pdf"]',
      'a[href*=".pdf?"]',
      'a[href*="/pdf/"]'
    ]);
    const citation = parseCitationLine(citationNode?.textContent);
    const sourceUrl = unwrapScholarUrl(titleNode?.href, pageUrl);
    const pdfUrl = unwrapScholarUrl(pdfNode?.href, pageUrl);
    const resultText = cleanText(result?.textContent, 8000);
    const title = cleanResultTitle(titleNode?.textContent);
    if (!title) return null;

    return {
      sourceType: fingerprint.official ? 'google-scholar' : 'google-scholar-mirror',
      sourceHost: fingerprint.hostname,
      title,
      authors: citation.authors,
      authorList: parseAuthorList(citation.authors),
      publication: citation.publication,
      abstract: cleanText(abstractNode?.textContent, 4000),
      doi: extractDoi(sourceUrl, pdfUrl, resultText),
      articleUrl: sourceUrl,
      pdfUrl,
      sourcePageUrl: safeUrl(pageUrl)?.href || '',
      confidenceScore: fingerprint.score,
      evidence: fingerprint.evidence
    };
  }

  function captureResults(documentLike, pageUrl = '', maxResults = 8) {
    const fingerprint = scholarFingerprint(documentLike, pageUrl);
    if (!fingerprint.detected) {
      return {
        isScholarPage: false,
        confidenceScore: fingerprint.score,
        evidence: fingerprint.evidence,
        results: []
      };
    }

    const results = findResults(documentLike)
      .slice(0, Math.max(1, Math.min(Number(maxResults) || 8, 20)))
      .map(result => captureResult(result, fingerprint, pageUrl))
      .filter(Boolean);

    return {
      isScholarPage: results.length > 0,
      confidenceScore: fingerprint.score,
      evidence: fingerprint.evidence,
      sourceHost: fingerprint.hostname,
      sourceType: fingerprint.official ? 'google-scholar' : 'google-scholar-mirror',
      sourcePageUrl: safeUrl(pageUrl)?.href || '',
      results
    };
  }

  function capturePage(documentLike, pageUrl = '') {
    const capture = captureResults(documentLike, pageUrl, 1);
    const first = capture.results[0];
    return first
      ? { isScholarPage: true, ...first }
      : {
          isScholarPage: false,
          confidenceScore: capture.confidenceScore,
          evidence: capture.evidence
        };
  }

  return {
    RESULT_SELECTORS,
    cleanText,
    isOfficialScholarHost,
    scholarFingerprint,
    parseCitationLine,
    parseAuthorList,
    extractDoi,
    captureResults,
    capturePage
  };
});
