const assert = require('node:assert/strict');
const scholar = require('../scripts/scholar-mirrors.js');

function fakeNode(values = {}) {
  return {
    ...values,
    querySelector(selector) {
      return values.nodes?.[selector] || null;
    },
    querySelectorAll(selector) {
      return values.lists?.[selector] || [];
    }
  };
}

const titleLink = fakeNode({
  textContent: 'Mirror-resilient scholarly metadata extraction',
  href: 'https://doi.org/10.1000/example.2026'
});
const citation = fakeNode({ textContent: 'A. Researcher, B. Scientist - Nature Methods, 2026' });
const abstract = fakeNode({ textContent: 'A compact abstract captured from a Scholar result.' });
const pdf = fakeNode({ href: 'https://example.edu/paper.pdf' });
const result = fakeNode({
  textContent: 'Mirror-resilient scholarly metadata extraction 10.1000/example.2026',
  nodes: {
    'h3.gs_rt a': titleLink,
    '.gs_a': citation,
    '.gs_rs': abstract,
    '.gs_or_ggsm a[href]': pdf
  }
});
const documentLike = fakeNode({
  title: '学术搜索',
  nodes: {
    'h3.gs_rt': titleLink,
    '.gs_a': citation,
    'form[action*="/scholar"]': fakeNode()
  },
  lists: {
    '#gs_res_ccl_mid .gs_r': [result]
  }
});

const mirrorCapture = scholar.capturePage(documentLike, 'https://unknown-mirror.example/scholar?q=metadata');
assert.equal(mirrorCapture.isScholarPage, true);
assert.equal(mirrorCapture.sourceType, 'google-scholar-mirror');
assert.equal(mirrorCapture.title, 'Mirror-resilient scholarly metadata extraction');
assert.equal(mirrorCapture.authors, 'A. Researcher, B. Scientist');
assert.deepEqual(mirrorCapture.authorList, ['A. Researcher', 'B. Scientist']);
assert.equal(mirrorCapture.publication, 'Nature Methods, 2026');
assert.equal(mirrorCapture.doi, '10.1000/example.2026');
assert.equal(mirrorCapture.pdfUrl, 'https://example.edu/paper.pdf');
assert(mirrorCapture.confidenceScore >= 55);

assert.equal(
  scholar.scholarFingerprint(fakeNode({ title: 'Ordinary article' }), 'https://example.com/article').detected,
  false
);
assert.equal(scholar.isOfficialScholarHost('scholar.google.com'), true);
assert.equal(scholar.isOfficialScholarHost('scholar.google.co.uk'), true);
assert.equal(scholar.isOfficialScholarHost('google.example.com'), false);
assert.equal(
  scholar.capturePage(fakeNode({ title: 'Google Scholar' }), 'https://scholar.google.com/').isScholarPage,
  false,
  'the official Scholar home page should not create an empty manuscript'
);

const ordinaryCollision = fakeNode({
  title: 'Ordinary dashboard',
  nodes: { 'h3.gs_rt': titleLink },
  lists: { '[data-rp]': [result] }
});
assert.equal(
  scholar.capturePage(ordinaryCollision, 'https://example.com/dashboard').isScholarPage,
  false,
  'generic result-like markup without Scholar metadata should be rejected'
);

const wrappedTitleLink = fakeNode({
  textContent: '[PDF] Redirected scholarly result',
  href: 'https://mirror.example/scholar_url?url=https%3A%2F%2Fpublisher.example%2Fpaper'
});
const wrappedResult = fakeNode({
  nodes: {
    'h3.gs_rt a': wrappedTitleLink,
    '.gs_a': fakeNode({ textContent: 'C. Author; D. Author - Example Letters, 2025' })
  }
});
const multipleDocument = fakeNode({
  title: 'Google Scholar mirror',
  nodes: {
    'h3.gs_rt': titleLink,
    '.gs_a': citation,
    'form[action*="/scholar"]': fakeNode()
  },
  lists: {
    '#gs_res_ccl_mid .gs_r': [result, wrappedResult]
  }
});
const multipleCapture = scholar.captureResults(
  multipleDocument,
  'https://mirror.example/scholar?q=two'
);
assert.equal(multipleCapture.results.length, 2);
assert.equal(multipleCapture.results[1].title, 'Redirected scholarly result');
assert.equal(multipleCapture.results[1].articleUrl, 'https://publisher.example/paper');

console.log('Google Scholar mirror compatibility tests passed');
