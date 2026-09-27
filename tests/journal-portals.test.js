const assert = require('node:assert/strict');
const portals = require('../scripts/journal-portals.js');

const scholarOne = portals.detectSubmissionPortal({
  url: 'https://mc.manuscriptcentral.com/nanoletters',
  title: 'Nano Letters - ScholarOne Manuscripts'
});
assert.equal(scholarOne.platformId, 'scholarone');
assert.equal(scholarOne.journalName, 'Nano Letters');
assert.equal(scholarOne.origin, 'https://mc.manuscriptcentral.com');

const editorialManager = portals.detectSubmissionPortal({
  url: 'https://www.editorialmanager.com/afm/default2.aspx',
  title: 'Editorial Manager® - Advanced Functional Materials'
});
assert.equal(editorialManager.platformId, 'editorial-manager');
assert.equal(editorialManager.journalName, 'Advanced Functional Materials');

const natureCommunications = portals.detectSubmissionPortal({
  url: 'https://mts-ncomms.nature.com/cgi-bin/main.plex',
  title: 'Log In'
});
assert.equal(natureCommunications.platformId, 'nature-submission');
assert.equal(natureCommunications.journalName, 'Nature Communications');

const acs = portals.detectSubmissionPortal({
  url: 'https://publish.acs.org/',
  title: 'ACS Paragon Plus Environment'
});
assert.equal(acs.platformId, 'acs-paragon');
assert.equal(acs.journalName, 'ACS Publications');

assert.equal(
  portals.detectSubmissionPortal({
    url: 'https://pubs.acs.org/doi/10.1021/example',
    title: 'An article page'
  }),
  null,
  'publisher article pages should not trigger the submission prompt'
);
assert.equal(portals.isSubmissionPortalUrl('chrome://extensions'), false);
assert.equal(portals.isSubmissionPortalUrl('https://example.com/login'), false);

const capturedScholarOne = portals.buildSubmissionCapture({
  url: 'https://mc.manuscriptcentral.com/nanoletters?STATE=UNDER_REVIEW',
  title: 'Author Dashboard | ScholarOne Manuscripts',
  signals: {
    journalName: 'Nano Letters',
    manuscriptTitle: 'Interfacial polarization controls valley transport',
    manuscriptId: 'NL-2026-00421',
    status: 'Under Review',
    submissionDate: '2026-07-21',
    authors: 'A. Researcher; B. Scientist'
  }
});
assert.equal(capturedScholarOne.journalName, 'Nano Letters');
assert.equal(capturedScholarOne.manuscriptTitle, 'Interfacial polarization controls valley transport');
assert.equal(capturedScholarOne.manuscriptId, 'NL-2026-00421');
assert.equal(capturedScholarOne.firstAuthor, 'A. Researcher');
assert.equal(capturedScholarOne.workflowStage, 'under_review');
assert.equal(capturedScholarOne.submissionDate, '2026-07-21');
assert.equal(capturedScholarOne.confidenceLevel, 'high');
assert(capturedScholarOne.confidenceScore >= 85);
assert(capturedScholarOne.evidence.includes('manuscript-title'));

assert.equal(portals.inferWorkflowStage({ status: 'Major Revision' }), 'revision');
assert.equal(portals.inferWorkflowStage({ status: '已录用' }), 'accepted');
assert.equal(portals.inferWorkflowStage({ status: 'Decision: Rejected' }), 'rejected');
assert.equal(
  portals.inferWorkflowStage({ status: 'Under Review', pageText: 'Accepted manuscripts help Start new submission' }),
  'under_review',
  'an explicit status field should outrank unrelated page navigation text'
);
assert.equal(portals.normalizeDate('July 28, 2026'), '2026-07-28');
assert.equal(portals.deriveFirstAuthor('Chen Xiao; Li Ming; Wang Lei'), 'Chen Xiao');

console.log('journal portal detection tests passed');
