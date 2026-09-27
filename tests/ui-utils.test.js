const assert = require('node:assert/strict');

const RFUI = require('../scripts/ui-utils.js');

assert.equal(RFUI.cleanDoiFromText('https://doi.org/10.1038/s41586-024-12345-6.'), '10.1038/s41586-024-12345-6');
assert.equal(RFUI.cleanDoiFromText(undefined), '');

assert.equal(RFUI.cleanResearchTitle(undefined), '');
assert.equal(RFUI.cleanResearchTitle('Nature: Example Paper | Nature'), 'Example Paper');
assert.equal(RFUI.cleanResearchTitle('PubMed - A precise result - PubMed'), 'A precise result');

assert.equal(RFUI.getToastBadgeClass('success'), 'badge badge-success');
assert.equal(RFUI.getToastBadgeClass('danger'), 'badge badge-danger');
assert.equal(RFUI.getToastBadgeClass('error'), 'badge badge-danger');
assert.equal(RFUI.getToastBadgeClass('info'), 'badge badge-info');
assert.equal(RFUI.getToastBadgeClass('unknown'), 'badge badge-warning');

assert.equal(RFUI.getSubmissionStatusBadgeClass('published'), 'badge badge-success');
assert.equal(RFUI.getSubmissionStatusBadgeClass('accepted'), 'badge badge-success');
assert.equal(RFUI.getSubmissionStatusBadgeClass('rejected'), 'badge badge-danger');
assert.equal(RFUI.getSubmissionStatusBadgeClass('revision'), 'badge badge-warning');
assert.equal(RFUI.getSubmissionStatusBadgeClass('under_review'), 'badge badge-info');
assert.equal(RFUI.getSubmissionStatusBadgeClass('submitted'), 'badge badge-purple');
assert.equal(RFUI.getSubmissionStatusBadgeClass('unknown'), 'badge badge-info');

assert.equal(
  RFUI.getTimelineEventDate({ completeDate: '', planDate: '', dueDate: '2026-08-18' }, 'r1_comments'),
  '',
  'an R1 deadline must not be treated as a completed first-decision date'
);
assert.equal(
  RFUI.getTimelineEventDate({ completeDate: '2026-08-02', dueDate: '2026-08-18' }, 'r1_comments'),
  '2026-08-02'
);
assert.equal(
  RFUI.getTimelineEventDate({ completeDate: '', planDate: '', dueDate: '2026-08-18' }, 'submit'),
  '2026-08-18'
);
const capturedSubmissions = [{
  id: 'sub_1',
  manuscriptId: 'man_1',
  externalManuscriptId: 'AFM-26-10482',
  targetJournal: 'Advanced Functional Materials',
  captureProvenance: { sourceOrigin: 'https://www.editorialmanager.com' }
}];
const capturedManuscripts = [{ id: 'man_1', title: 'Strain-Gated Exciton–Trion Nonlinearities' }];
assert.equal(
  RFUI.findCapturedSubmissionMatch({
    submissions: capturedSubmissions,
    manuscripts: capturedManuscripts,
    capture: { externalManuscriptId: 'afm-26-10482', targetJournal: 'Advanced Functional Materials', sourceOrigin: 'https://www.editorialmanager.com' }
  })?.id,
  'sub_1',
  'external manuscript identifiers should prevent duplicate capture'
);
assert.equal(
  RFUI.findCapturedSubmissionMatch({
    submissions: capturedSubmissions,
    manuscripts: capturedManuscripts,
    capture: {
      manuscriptTitle: 'Strain-Gated Exciton–Trion Nonlinearities',
      targetJournal: 'Advanced Functional Materials',
      sourceOrigin: 'https://www.editorialmanager.com'
    }
  })?.id,
  'sub_1',
  'capture provenance should prevent duplicates when an external identifier is absent'
);

assert.equal(RFUI.getWorkflowStatusBadgeClass('submission', 'rejected'), 'badge badge-danger');
assert.equal(RFUI.getWorkflowStatusBadgeClass('manuscript', 'published'), 'badge badge-success');
assert.equal(RFUI.getWorkflowStatusBadgeClass('manuscript', 'drafting'), 'badge badge-warning');
assert.equal(RFUI.getWorkflowStatusBadgeClass('timeline', 'completed'), 'badge badge-success');
assert.equal(RFUI.getWorkflowStatusBadgeClass('timeline', 'blocked'), 'badge badge-danger');
assert.equal(RFUI.getWorkflowStatusBadgeClass('record', 'literature_review'), 'badge badge-info');
assert.equal(RFUI.getWorkflowStatusBadgeClass('project', 'active'), 'badge badge-purple');

assert.deepEqual(RFUI.buildSubmissionRelationshipSummary({
  submission: {
    id: 'sub_1',
    manuscriptId: 'man_1',
    projectId: 'proj_1',
    timelineNodes: [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'pending' }
    ],
    rebuttalMatrix: [{}, {}]
  },
  manuscript: { id: 'man_1', title: 'Interface Ferroelectricity', projectId: 'proj_1' },
  project: { id: 'proj_1', title: 'ReS2 sliding project' },
  records: [
    { id: 'rec_1', projectId: 'proj_1' },
    { id: 'rec_2', projectId: 'other' }
  ]
}), {
  projectTitle: 'ReS2 sliding project',
  manuscriptTitle: 'Interface Ferroelectricity',
  recordCount: 1,
  timelineNodeCount: 3,
  completedTimelineNodeCount: 2,
  reviewerCommentCount: 2,
  isOrphanSubmission: false,
  summaryLine: 'Interface Ferroelectricity in ReS2 sliding project: 1 record, 3 timeline events, 2 reviewer comments.'
});

assert.deepEqual(RFUI.buildSubmissionRelationshipSummary({
  submission: {
    id: 'sub_review_matrix',
    manuscriptId: 'man_1',
    projectId: 'proj_1',
    timelineNodes: [],
    reviewMatrix: [{}, {}, {}]
  },
  manuscript: { id: 'man_1', title: 'Review Matrix Manuscript', projectId: 'proj_1' },
  project: { id: 'proj_1', title: 'Central review project' },
  records: []
}).reviewerCommentCount, 3);

assert.deepEqual(RFUI.buildSubmissionRelationshipSummary({
  submission: {
    id: 'sub_prefers_review_matrix',
    manuscriptId: 'man_1',
    projectId: 'proj_1',
    timelineNodes: [],
    reviewMatrix: [],
    rebuttalMatrix: [{}, {}]
  },
  manuscript: { id: 'man_1', title: 'Empty Review Matrix Manuscript', projectId: 'proj_1' },
  project: { id: 'proj_1', title: 'Central review project' },
  records: []
}).reviewerCommentCount, 0);

assert.deepEqual(RFUI.buildSubmissionRelationshipSummary({
  submission: { id: 'sub_orphan', timelineNodes: [] },
  manuscript: null,
  project: null,
  records: []
}).isOrphanSubmission, true);

assert.deepEqual(RFUI.buildProjectDeleteImpactSummary({
  project: { id: 'proj_1', title: 'ReS2 sliding project' },
  db: {
    tasks: [{ projectId: 'proj_1' }, { projectId: 'proj_1' }, { projectId: 'other' }],
    researchRecords: [{ projectId: 'proj_1' }],
    manuscripts: [{ id: 'man_1', projectId: 'proj_1' }, { id: 'man_2', projectId: 'proj_1' }],
    submissions: [{ manuscriptId: 'man_1' }, { projectId: 'proj_1' }, { projectId: 'other' }]
  }
}), {
  projectTitle: 'ReS2 sliding project',
  taskCount: 2,
  recordCount: 1,
  manuscriptCount: 2,
  submissionCount: 2,
  totalLinkedItems: 7,
  confirmationMessage: 'Delete "ReS2 sliding project"? This affects 2 tasks, 1 research record, 2 manuscripts, and 2 submissions.'
});

assert.equal(RFUI.toDateInputValue('2026-06-23T08:30:00.000Z'), '2026-06-23');
assert.equal(RFUI.toDateInputValue('not-a-date', '2026-01-02'), '2026-01-02');
assert.equal(RFUI.toDateInputValue(null, '2026-01-02'), '2026-01-02');

assert.deepEqual(RFUI.getRecordFormMode(null), {
  isEdit: false,
  isDuplicate: false,
  title: 'Log New Research Record',
  submitLabel: 'Log Record'
});
assert.deepEqual(RFUI.getRecordFormMode({ id: 'rec_1' }), {
  isEdit: true,
  isDuplicate: false,
  title: 'Modify Research Record',
  submitLabel: 'Save Changes'
});
assert.deepEqual(RFUI.getRecordFormMode({ id: 'rec_1' }, { duplicate: true }), {
  isEdit: false,
  isDuplicate: true,
  title: 'Duplicate Research Record',
  submitLabel: 'Create Copy'
});

assert.equal(RFUI.shouldNotifyMetadataCaptureFailure({
  isAutomaticCapture: true,
  isRestrictedPage: false
}), false);
assert.equal(RFUI.shouldNotifyMetadataCaptureFailure({
  isAutomaticCapture: true,
  isRestrictedPage: true
}), false);
assert.equal(RFUI.shouldNotifyMetadataCaptureFailure({
  isAutomaticCapture: false,
  isRestrictedPage: false
}), true);
assert.equal(RFUI.shouldNotifyMetadataCaptureFailure({
  isAutomaticCapture: false,
  isRestrictedPage: true
}), true);

assert.deepEqual(RFUI.buildSubmissionIdentityUpdate({
  title: '  Revised paper title  ',
  journal: '  Advanced Materials  ',
  journalUrl: ' https://example.com/submission '
}), {
  ok: true,
  title: 'Revised paper title',
  journal: 'Advanced Materials',
  journalUrl: 'https://example.com/submission'
});
assert.deepEqual(RFUI.buildSubmissionIdentityUpdate({
  title: '',
  journal: 'Nature',
  journalUrl: ''
}), {
  ok: false,
  error: 'Manuscript title is required.'
});
assert.deepEqual(RFUI.buildSubmissionIdentityUpdate({
  title: 'Paper',
  journal: 'Nature',
  journalUrl: 'not a url'
}), {
  ok: false,
  error: 'Journal URL must be a valid URL.'
});

assert.deepEqual(RFUI.buildSubmissionEditCenterUpdate({
  title: '  Revised submission title  ',
  journal: '  Advanced Functional Materials  ',
  journalUrl: ' https://example.com/submit ',
  status: 'accepted',
  submissionDate: '2026-01-10',
  firstDecisionDate: '2026-02-12',
  revisionDueDate: '2026-03-01',
  decisionDate: '2026-04-15',
  doi: ' https://doi.org/10.1002/adfm.202528029 ',
  articleUrl: ' https://advanced.onlinelibrary.wiley.com/doi/10.1002/adfm.202528029 '
}), {
  ok: true,
  title: 'Revised submission title',
  journal: 'Advanced Functional Materials',
  journalUrl: 'https://example.com/submit',
  status: 'accepted',
  submissionDate: '2026-01-10',
  firstDecisionDate: '2026-02-12',
  revisionDueDate: '2026-03-01',
  decisionDate: '2026-04-15',
  doi: '10.1002/adfm.202528029',
  articleUrl: 'https://advanced.onlinelibrary.wiley.com/doi/10.1002/adfm.202528029'
});
assert.deepEqual(RFUI.buildSubmissionEditCenterUpdate({
  title: '',
  journal: 'Nature',
  journalUrl: ''
}), {
  ok: false,
  error: 'Manuscript title is required.'
});
assert.deepEqual(RFUI.buildSubmissionEditCenterUpdate({
  title: 'Paper',
  journal: 'Nature',
  journalUrl: 'not a url'
}), {
  ok: false,
  error: 'Journal URL must be a valid URL.'
});
assert.deepEqual(RFUI.buildSubmissionEditCenterUpdate({
  title: 'Paper',
  journal: 'Nature',
  articleUrl: 'not a url'
}), {
  ok: false,
  error: 'Article URL must be a valid URL.'
});

assert.deepEqual(RFUI.buildSubmissionEditSyncPlan({
  title: '  Final shared title  ',
  journal: '  Nature Materials  ',
  journalUrl: ' https://example.com/portal ',
  status: 'published',
  submissionDate: '2026-01-10',
  firstDecisionDate: '2026-02-12',
  revisionDueDate: '2026-03-01',
  decisionDate: '2026-04-15',
  doi: 'https://doi.org/10.1038/s41563-026-01234-5',
  articleUrl: ''
}), {
  ok: true,
  manuscriptPatch: {
    title: 'Final shared title',
    targetJournals: ['Nature Materials']
  },
  detachedSubmissionTitle: 'Final shared title',
  submissionPatch: {
    targetJournal: 'Nature Materials',
    journalUrl: 'https://example.com/portal',
    submissionDate: '2026-01-10T12:00:00.000Z',
    firstDecisionDate: '2026-02-12T12:00:00.000Z',
    revisionDueDate: '2026-03-01T12:00:00.000Z',
    decisionDate: '2026-04-15T12:00:00.000Z',
    status: 'published'
  },
  publicationPatch: {
    doi: '10.1038/s41563-026-01234-5',
    articleUrl: 'https://doi.org/10.1038/s41563-026-01234-5'
  },
  shouldClearPublication: false,
  shouldMarkRejected: false,
  rejectionDate: ''
});
assert.deepEqual(RFUI.buildSubmissionEditSyncPlan({
  title: 'Active review title',
  journal: '',
  journalUrl: '',
  status: 'under_review',
  doi: '10.1000/unused'
}), {
  ok: true,
  manuscriptPatch: {
    title: 'Active review title',
    targetJournals: []
  },
  detachedSubmissionTitle: 'Active review title',
  submissionPatch: {
    targetJournal: null,
    journalUrl: null,
    submissionDate: null,
    firstDecisionDate: null,
    revisionDueDate: null,
    decisionDate: null,
    status: 'under_review'
  },
  publicationPatch: null,
  shouldClearPublication: true,
  shouldMarkRejected: false,
  rejectionDate: ''
});
assert.deepEqual(RFUI.buildSubmissionEditSyncPlan({
  title: 'Rejected title',
  journal: 'Science',
  status: 'rejected',
  firstDecisionDate: '2026-02-12',
  decisionDate: ''
}).shouldMarkRejected, true);
assert.deepEqual(RFUI.buildSubmissionEditSyncPlan({
  title: 'Rejected title',
  journal: 'Science',
  status: 'rejected',
  firstDecisionDate: '2026-02-12',
  decisionDate: ''
}).rejectionDate, '2026-02-12');

assert.equal(
  RFUI.shouldCelebrateAcceptance('under_review', 'accepted'),
  true,
  'the first persisted transition into accepted should celebrate'
);
assert.equal(
  RFUI.shouldCelebrateAcceptance('accepted', 'accepted'),
  false,
  'editing an already accepted submission should not celebrate repeatedly'
);
assert.equal(
  RFUI.shouldCelebrateAcceptance('published', 'accepted'),
  false,
  'moving backward from published should not replay the acceptance celebration'
);
assert.equal(
  RFUI.shouldCelebrateAcceptance('revision', 'published'),
  false,
  'publishing is not the acceptance-status easter egg'
);

assert.deepEqual(RFUI.buildSubmissionCreateMode({
  selectedManuscriptId: 'man_1',
  newManuscriptTitle: '',
  targetJournal: 'Nature'
}), {
  ok: true,
  mode: 'existing',
  manuscriptId: 'man_1',
  targetJournal: 'Nature',
  title: ''
});
assert.deepEqual(RFUI.buildSubmissionCreateMode({
  selectedManuscriptId: '__new__',
  newManuscriptTitle: '  New paper  ',
  targetJournal: '  Science  '
}), {
  ok: true,
  mode: 'new',
  manuscriptId: '',
  targetJournal: 'Science',
  title: 'New paper'
});
assert.deepEqual(RFUI.buildSubmissionCreateMode({
  selectedManuscriptId: '__new__',
  newManuscriptTitle: '',
  targetJournal: 'Nature'
}), {
  ok: false,
  error: 'Manuscript title is required.'
});
assert.deepEqual(RFUI.buildSubmissionCreateMode({
  selectedManuscriptId: 'man_1',
  newManuscriptTitle: '',
  targetJournal: ''
}), {
  ok: false,
  error: 'Target journal is required.'
});

assert.equal(RFUI.shouldAutoCapture({
  capturePaneActive: true,
  scrapeButtonDisabled: false,
  formDirty: false,
  activeTabKey: '1:https://example.com/a',
  lastCapturedTabKey: ''
}), true);

assert.equal(RFUI.shouldAutoCapture({
  capturePaneActive: true,
  scrapeButtonDisabled: false,
  formDirty: true,
  activeTabKey: '1:https://example.com/a',
  lastCapturedTabKey: ''
}), false);

assert.equal(RFUI.shouldAutoCapture({
  capturePaneActive: true,
  scrapeButtonDisabled: false,
  formDirty: false,
  activeTabKey: '1:https://example.com/a',
  lastCapturedTabKey: '1:https://example.com/a'
}), false);

console.log('ui-utils tests passed');

assert.equal(RFUI.findCapturedSubmissionMatch({ submissions: capturedSubmissions, capture: {
  externalManuscriptId: 'AFM-26-10482', targetJournal: 'Other journal', sourceOrigin: 'https://www.editorialmanager.com'
} }), null, 'same number on a different journal must not overwrite a submission');
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:secret@example.com']) {
  assert.equal(RFUI.buildSubmissionIdentityUpdate({ title: 'Test', journalUrl: url }).ok, false);
  assert.equal(RFUI.buildSubmissionEditCenterUpdate({ title: 'Test', articleUrl: url }).ok, false);
}

assert.equal(RFUI.findCapturedSubmissionMatch({ submissions: capturedSubmissions, manuscripts: capturedManuscripts, capture: {
  externalManuscriptId: 'AFM-26-99999', manuscriptTitle: capturedManuscripts[0].title,
  targetJournal: 'Advanced Functional Materials', sourceOrigin: 'https://www.editorialmanager.com'
} }), null, 'a new numbered submission must not collapse into an earlier attempt with the same title');
