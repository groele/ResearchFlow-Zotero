(function journalPortalModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.RFJournalPortals = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createJournalPortalApi() {
  'use strict';

  const PORTAL_RULES = [
    {
      id: 'scholarone',
      platformName: 'ScholarOne Manuscripts',
      publisherName: '',
      matches: hostname => hostname === 'manuscriptcentral.com' || hostname.endsWith('.manuscriptcentral.com')
    },
    {
      id: 'editorial-manager',
      platformName: 'Editorial Manager',
      publisherName: '',
      matches: hostname => hostname === 'editorialmanager.com' || hostname.endsWith('.editorialmanager.com')
    },
    {
      id: 'ejournalpress',
      platformName: 'eJournalPress',
      publisherName: '',
      matches: hostname => hostname === 'ejournalpress.com' || hostname.endsWith('.ejournalpress.com')
    },
    {
      id: 'acs-paragon',
      platformName: 'ACS Paragon Plus',
      publisherName: 'ACS Publications',
      matches: hostname => hostname === 'publish.acs.org'
    },
    {
      id: 'wiley-submission',
      platformName: 'Wiley Submission',
      publisherName: 'Wiley',
      matches: hostname => hostname === 'submission.wiley.com'
    },
    {
      id: 'nature-submission',
      platformName: 'Springer Nature Submissions',
      publisherName: 'Springer Nature',
      matches: (hostname, pathname) => (
        hostname === 'submission.nature.com' ||
        (hostname.endsWith('.nature.com') && (
          hostname.startsWith('mts-') ||
          /\/cgi-bin\/main\.plex/i.test(pathname)
        ))
      )
    },
    {
      id: 'peerx-press',
      platformName: 'Peer X-Press',
      publisherName: 'AIP Publishing',
      matches: hostname => hostname === 'peerx-press.org' || hostname.endsWith('.peerx-press.org')
    },
    {
      id: 'mdpi-susy',
      platformName: 'MDPI SuSy',
      publisherName: 'MDPI',
      matches: hostname => hostname === 'susy.mdpi.com'
    },
    {
      id: 'frontiers-review',
      platformName: 'Frontiers Review',
      publisherName: 'Frontiers',
      matches: hostname => hostname === 'review.frontiersin.org'
    },
    {
      id: 'aps-authors',
      platformName: 'APS Authors',
      publisherName: 'American Physical Society',
      matches: hostname => hostname === 'authors.aps.org'
    },
    {
      id: 'science-submission',
      platformName: 'Science Journals Submission',
      publisherName: 'Science Journals',
      matches: hostname => hostname === 'submission.science.org'
    }
  ];

  const GENERIC_TITLE_PATTERN = /\b(log\s*in|sign\s*in|welcome|dashboard|authors?\s*center|submission\s*system|manuscripts?|manuscript\s*submission|manuscript\s*central|scholarone|editorial\s*manager|ejournalpress|peer\s*x-press|paragon\s*plus|springer\s*nature\s*submissions?|environment)\b/gi;

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/[®™©]/g, '')
      .trim();
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url;
    } catch (_) {
      return null;
    }
  }

  function titleCandidates(title) {
    const normalized = cleanText(title);
    if (!normalized) return [];

    const candidates = [normalized];
    normalized.split(/\s+(?:\||—|–|-|::)\s+/).forEach(part => candidates.push(part));

    return [...new Set(candidates)]
      .map(part => cleanText(part.replace(GENERIC_TITLE_PATTERN, '')))
      .map(part => part.replace(/^[\s:|—–-]+|[\s:|—–-]+$/g, ''))
      .filter(part => part.length >= 3 && part.length <= 120)
      .filter(part => !/^(home|login|sign in|dashboard|authors?)$/i.test(part))
      .sort((a, b) => {
        const aWords = a.split(/\s+/).length;
        const bWords = b.split(/\s+/).length;
        const aScore = (aWords >= 2 ? 20 : 0) - Math.abs(a.length - 35);
        const bScore = (bWords >= 2 ? 20 : 0) - Math.abs(b.length - 35);
        return bScore - aScore;
      });
  }

  function natureJournalFromHost(hostname) {
    const known = {
      'mts-ncomms.nature.com': 'Nature Communications',
      'mts-nature.nature.com': 'Nature',
      'mts-nmat.nature.com': 'Nature Materials',
      'mts-nnano.nature.com': 'Nature Nanotechnology',
      'mts-nphoton.nature.com': 'Nature Photonics',
      'mts-nphys.nature.com': 'Nature Physics'
    };
    return known[hostname] || '';
  }

  function deriveJournalName(rule, title, hostname, journalHint = '') {
    const cleanedHint = cleanText(journalHint);
    if (cleanedHint && cleanedHint.length <= 160) return cleanedHint;

    const natureName = rule.id === 'nature-submission' ? natureJournalFromHost(hostname) : '';
    if (natureName) return natureName;

    const candidate = titleCandidates(title)[0] || '';
    const genericPublisherLabels = new Set(['acs', 'wiley', 'mdpi', 'aps', 'science', 'frontiers', 'nature']);
    if (
      candidate &&
      candidate.toLowerCase() !== rule.platformName.toLowerCase() &&
      !genericPublisherLabels.has(candidate.toLowerCase())
    ) {
      return candidate;
    }

    return rule.publisherName || rule.platformName;
  }

  function detectSubmissionPortal(input = {}) {
    const url = safeUrl(input.url);
    if (!url) return null;

    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname || '/';
    const rule = PORTAL_RULES.find(item => item.matches(hostname, pathname));
    if (!rule) return null;

    const journalName = deriveJournalName(rule, input.title, hostname, input.journalName);
    return {
      platformId: rule.id,
      platformName: rule.platformName,
      journalName,
      portalUrl: url.href,
      origin: url.origin,
      hostname,
      confidence: journalName === (rule.publisherName || rule.platformName) ? 'platform' : 'journal'
    };
  }

  function firstUseful(...values) {
    for (const value of values) {
      const cleaned = cleanText(value);
      if (cleaned) return cleaned;
    }
    return '';
  }

  function normalizeDate(value) {
    const cleaned = cleanText(value);
    if (!cleaned) return '';
    const isoMatch = cleaned.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
    const parsed = new Date(cleaned);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0')
    ].join('-');
  }

  function deriveFirstAuthor(value) {
    const cleaned = cleanText(value);
    if (!cleaned) return '';
    const first = cleaned.split(/\s*(?:;|；|\n|\band\b)\s*/i)[0] || '';
    return cleanText(first).slice(0, 160);
  }

  function inferWorkflowStage(input = {}) {
    const classify = value => {
      const text = cleanText(value).toLowerCase();
      if (!text) return 'unknown';
      if (/\b(reject(?:ed|ion)?|declin(?:ed|e))\b/.test(text) || /拒稿|拒绝|退稿/.test(text)) return 'rejected';
      if (/\b(accept(?:ed|ance)?)\b/.test(text) || /已接受|接收|录用/.test(text)) return 'accepted';
      if (/\b(revision|revise|resubmi(?:t|ssion)|major revision|minor revision)\b/.test(text) || /修回|返修/.test(text)) return 'revision';
      if (/\b(under review|in review|reviewers? invited|peer review)\b/.test(text) || /审稿中|同行评审/.test(text)) return 'under_review';
      if (/\b(submitted|submission complete|manuscript received)\b/.test(text) || /已投稿|投稿成功|已提交/.test(text)) return 'submitted';
      if (/\b(draft|begin submission|start new submission)\b/.test(text) || /新投稿|开始投稿|草稿/.test(text)) return 'draft';
      return 'unknown';
    };

    const explicitStatus = classify(input.status);
    if (explicitStatus !== 'unknown') return explicitStatus;
    return classify([input.title, input.url, input.pageText].filter(Boolean).join(' '));
  }

  function buildSubmissionCapture(input = {}) {
    const signals = input.signals && typeof input.signals === 'object' ? input.signals : {};
    const portal = detectSubmissionPortal({
      url: input.url,
      title: input.title,
      journalName: signals.journalName
    });
    if (!portal) return null;

    const manuscriptTitle = firstUseful(signals.manuscriptTitle, signals.articleTitle);
    const manuscriptId = firstUseful(signals.manuscriptId, signals.referenceNumber).slice(0, 120);
    const authors = firstUseful(signals.authors).slice(0, 600);
    const firstAuthor = firstUseful(signals.firstAuthor, deriveFirstAuthor(authors)).slice(0, 160);
    const abstract = firstUseful(signals.abstract).slice(0, 4000);
    const keywords = firstUseful(signals.keywords).slice(0, 500);
    const workflowStage = inferWorkflowStage({
      status: signals.status,
      title: input.title,
      url: input.url,
      pageText: signals.pageText
    });
    const submissionDate = normalizeDate(signals.submissionDate);
    const revisionDueDate = normalizeDate(signals.revisionDueDate);

    const evidence = ['supported-domain'];
    let confidenceScore = 55;
    if (portal.confidence === 'journal') {
      confidenceScore += 12;
      evidence.push('journal');
    }
    if (manuscriptTitle) {
      confidenceScore += 12;
      evidence.push('manuscript-title');
    }
    if (manuscriptId) {
      confidenceScore += 7;
      evidence.push('manuscript-id');
    }
    if (workflowStage !== 'unknown') {
      confidenceScore += 6;
      evidence.push('workflow-stage');
    }
    if (submissionDate || revisionDueDate) {
      confidenceScore += 6;
      evidence.push('workflow-date');
    }
    if (authors || abstract || keywords) {
      confidenceScore += 2;
      evidence.push('manuscript-details');
    }
    confidenceScore = Math.min(100, confidenceScore);

    return {
      ...portal,
      manuscriptTitle,
      manuscriptId,
      firstAuthor,
      authors,
      abstract,
      keywords,
      workflowStage,
      submissionDate,
      revisionDueDate,
      confidenceScore,
      confidenceLevel: confidenceScore >= 85 ? 'high' : (confidenceScore >= 70 ? 'medium' : 'low'),
      detectedFieldCount: [
        portal.journalName,
        manuscriptTitle,
        manuscriptId,
        firstAuthor,
        workflowStage !== 'unknown' ? workflowStage : '',
        submissionDate,
        revisionDueDate,
        authors,
        abstract,
        keywords
      ].filter(Boolean).length,
      evidence
    };
  }

  function isSubmissionPortalUrl(value) {
    return Boolean(detectSubmissionPortal({ url: value, title: '' }));
  }

  return {
    PORTAL_RULES,
    cleanText,
    detectSubmissionPortal,
    buildSubmissionCapture,
    deriveFirstAuthor,
    inferWorkflowStage,
    normalizeDate,
    isSubmissionPortalUrl
  };
});
