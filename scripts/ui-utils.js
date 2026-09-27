(function initResearchFlowUiUtils(root) {
  const DOI_PATTERN = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;

  function cleanDoiFromText(value) {
    if (!value) return '';
    const match = String(value).match(DOI_PATTERN);
    if (!match) return '';
    return match[1]
      .replace(/^doi:\s*/i, '')
      .replace(/^https?:\/\/doi\.org\//i, '')
      .replace(/[.,;)\s]+$/, '')
      .trim();
  }

  function cleanResearchTitle(value) {
    if (!value) return '';
    return String(value)
      .replace(/^(arXiv|PubMed|bioRxiv|Nature|Science|IEEE|Springer|Wiley|ACS)\s*(:|：|-)\s*/i, '')
      .replace(/\s*\|\s*.*$/g, '')
      .replace(/\s*-\s*PubMed$/i, '')
      .trim();
  }

  function normalizeFeedbackType(type) {
    if (type === 'success') return 'success';
    if (type === 'danger' || type === 'error') return 'danger';
    if (type === 'info') return 'info';
    return 'warning';
  }

  function getToastBadgeClass(type) {
    return `badge badge-${normalizeFeedbackType(type)}`;
  }

  function getSubmissionStatusBadgeClass(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'published' || normalized === 'accepted' || normalized === 'accept') {
      return 'badge badge-success';
    }
    if (normalized === 'rejected') return 'badge badge-danger';
    if (normalized === 'revision' || normalized === 'revise' || normalized === 'major_revision' || normalized === 'minor_revision') {
      return 'badge badge-warning';
    }
    if (normalized === 'submitted') return 'badge badge-purple';
    return 'badge badge-info';
  }

  function getWorkflowStatusBadgeClass(entityType, status) {
    const entity = String(entityType || '').trim().toLowerCase();
    const normalized = String(status || '').trim().toLowerCase();
    if (entity === 'submission') return getSubmissionStatusBadgeClass(normalized);
    if (entity === 'timeline') {
      if (normalized === 'completed' || normalized === 'done') return 'badge badge-success';
      if (normalized === 'blocked' || normalized === 'overdue') return 'badge badge-danger';
      if (normalized === 'active' || normalized === 'in_progress') return 'badge badge-info';
      return 'badge badge-warning';
    }
    if (entity === 'manuscript') {
      if (normalized === 'published' || normalized === 'accepted') return 'badge badge-success';
      if (normalized === 'submitted' || normalized === 'under_review') return 'badge badge-info';
      if (normalized === 'revision' || normalized === 'drafting' || normalized === 'figure_preparation' || normalized === 'internal_review') return 'badge badge-warning';
      return 'badge badge-purple';
    }
    if (entity === 'record') {
      if (normalized === 'literature_review') return 'badge badge-info';
      if (normalized === 'experiment' || normalized === 'analysis') return 'badge badge-success';
      if (normalized === 'simulation') return 'badge badge-purple';
      return 'badge badge-warning';
    }
    if (entity === 'project') {
      if (normalized === 'archived' || normalized === 'blocked') return 'badge badge-danger';
      if (normalized === 'completed') return 'badge badge-success';
      return 'badge badge-purple';
    }
    return 'badge badge-info';
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function buildSubmissionRelationshipSummary(values = {}) {
    const submission = values.submission || {};
    const manuscript = values.manuscript || null;
    const project = values.project || null;
    const records = Array.isArray(values.records) ? values.records : [];
    const timelineNodes = Array.isArray(submission.timelineNodes) ? submission.timelineNodes : [];
    const reviewMatrix = Array.isArray(submission.reviewMatrix)
      ? submission.reviewMatrix
      : (Array.isArray(submission.rebuttalMatrix) ? submission.rebuttalMatrix : []);
    const projectId = project?.id || manuscript?.projectId || submission.projectId || '';
    const recordCount = records.filter(record => record && record.projectId === projectId).length;
    const completedTimelineNodeCount = timelineNodes.filter(node => {
      const status = String(node?.status || '').toLowerCase();
      return status === 'completed' || status === 'done';
    }).length;
    const manuscriptTitle = manuscript?.title || submission.title || 'Detached submission';
    const projectTitle = project?.title || 'Unlinked project';

    return {
      projectTitle,
      manuscriptTitle,
      recordCount,
      timelineNodeCount: timelineNodes.length,
      completedTimelineNodeCount,
      reviewerCommentCount: reviewMatrix.length,
      isOrphanSubmission: !manuscript || !project,
      summaryLine: `${manuscriptTitle} in ${projectTitle}: ${pluralize(recordCount, 'record')}, ${pluralize(timelineNodes.length, 'timeline event')}, ${pluralize(reviewMatrix.length, 'reviewer comment')}.`
    };
  }

  function buildProjectDeleteImpactSummary(values = {}) {
    const project = values.project || {};
    const db = values.db || {};
    const projectId = project.id || '';
    const tasks = Array.isArray(db.tasks) ? db.tasks : [];
    const records = Array.isArray(db.researchRecords) ? db.researchRecords : [];
    const manuscripts = Array.isArray(db.manuscripts) ? db.manuscripts : [];
    const submissions = Array.isArray(db.submissions) ? db.submissions : [];
    const linkedManuscripts = manuscripts.filter(man => man && man.projectId === projectId);
    const linkedManuscriptIds = new Set(linkedManuscripts.map(man => man.id));
    const linkedSubmissions = submissions.filter(sub => {
      if (!sub) return false;
      return sub.projectId === projectId || linkedManuscriptIds.has(sub.manuscriptId);
    });
    const taskCount = tasks.filter(task => task && task.projectId === projectId).length;
    const recordCount = records.filter(record => record && record.projectId === projectId).length;
    const manuscriptCount = linkedManuscripts.length;
    const submissionCount = linkedSubmissions.length;
    const totalLinkedItems = taskCount + recordCount + manuscriptCount + submissionCount;
    const projectTitle = project.title || 'Untitled Project';

    return {
      projectTitle,
      taskCount,
      recordCount,
      manuscriptCount,
      submissionCount,
      totalLinkedItems,
      confirmationMessage: `Delete "${projectTitle}"? This affects ${pluralize(taskCount, 'task')}, ${pluralize(recordCount, 'research record')}, ${pluralize(manuscriptCount, 'manuscript')}, and ${pluralize(submissionCount, 'submission')}.`
    };
  }

  function getTabKey(tab) {
    if (!tab) return '';
    return `${tab.id || 'active'}:${tab.url || ''}`;
  }

  function toDateInputValue(value, fallbackValue = '') {
    if (!value) return fallbackValue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallbackValue;
    return parsed.toISOString().slice(0, 10);
  }

  function toNoonIsoDate(value) {
    const inputValue = toDateInputValue(value);
    return inputValue ? `${inputValue}T12:00:00.000Z` : null;
  }

  function getRecordFormMode(record = null, options = {}) {
    const isDuplicate = Boolean(record && options.duplicate);
    const isEdit = Boolean(record && !isDuplicate);
    if (isDuplicate) {
      return {
        isEdit: false,
        isDuplicate: true,
        title: 'Duplicate Research Record',
        submitLabel: 'Create Copy'
      };
    }
    if (isEdit) {
      return {
        isEdit: true,
        isDuplicate: false,
        title: 'Modify Research Record',
        submitLabel: 'Save Changes'
      };
    }
    return {
      isEdit: false,
      isDuplicate: false,
      title: 'Log New Research Record',
      submitLabel: 'Log Record'
    };
  }

  function shouldAutoCapture(state) {
    return Boolean(
      state &&
      state.capturePaneActive &&
      !state.scrapeButtonDisabled &&
      !state.formDirty &&
      state.activeTabKey &&
      state.activeTabKey !== state.lastCapturedTabKey
    );
  }

  function shouldNotifyMetadataCaptureFailure(state) {
    return Boolean(state && !state.isAutomaticCapture);
  }

  function isSafeWebUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }

  function buildSubmissionIdentityUpdate(values = {}) {
    const title = String(values.title || '').trim();
    const journal = String(values.journal || '').trim();
    const journalUrl = String(values.journalUrl || '').trim();

    if (!title) {
      return { ok: false, error: 'Manuscript title is required.' };
    }

    if (journalUrl) {
      try {
        if (!isSafeWebUrl(journalUrl)) throw new Error('Invalid web URL');
      } catch (_) {
        return { ok: false, error: 'Journal URL must be a valid URL.' };
      }
    }

    return { ok: true, title, journal, journalUrl };
  }

  function buildSubmissionEditCenterUpdate(values = {}) {
    const identity = buildSubmissionIdentityUpdate(values);
    if (!identity.ok) return identity;

    const articleUrl = String(values.articleUrl || '').trim();
    if (articleUrl) {
      try {
        if (!isSafeWebUrl(articleUrl)) throw new Error('Invalid web URL');
      } catch (_) {
        return { ok: false, error: 'Article URL must be a valid URL.' };
      }
    }

    const allowedStatuses = new Set([
      'submitted',
      'under_review',
      'revision',
      'accepted',
      'published',
      'rejected'
    ]);
    const status = String(values.status || 'submitted').trim();

    return {
      ok: true,
      title: identity.title,
      journal: identity.journal,
      journalUrl: identity.journalUrl,
      status: allowedStatuses.has(status) ? status : 'submitted',
      submissionDate: String(values.submissionDate || '').trim(),
      firstDecisionDate: String(values.firstDecisionDate || '').trim(),
      revisionDueDate: String(values.revisionDueDate || '').trim(),
      decisionDate: String(values.decisionDate || '').trim(),
      doi: cleanDoiFromText(values.doi) || String(values.doi || '').trim(),
      articleUrl
    };
  }

  function buildSubmissionEditSyncPlan(values = {}) {
    const update = buildSubmissionEditCenterUpdate(values);
    if (!update.ok) return update;

    const isPublicationStatus = update.status === 'accepted' || update.status === 'published';
    const doi = cleanDoiFromText(update.doi) || String(update.doi || '').trim();
    const articleUrl = update.articleUrl || (doi ? `https://doi.org/${doi}` : '');
    const decisionDate = toNoonIsoDate(update.decisionDate);
    const firstDecisionDate = toNoonIsoDate(update.firstDecisionDate);

    return {
      ok: true,
      manuscriptPatch: {
        title: update.title,
        targetJournals: update.journal ? [update.journal] : []
      },
      detachedSubmissionTitle: update.title,
      submissionPatch: {
        targetJournal: update.journal || null,
        journalUrl: update.journalUrl || null,
        submissionDate: toNoonIsoDate(update.submissionDate),
        firstDecisionDate,
        revisionDueDate: toNoonIsoDate(update.revisionDueDate),
        decisionDate,
        status: update.status
      },
      publicationPatch: isPublicationStatus
        ? {
            doi: doi || null,
            articleUrl: articleUrl || null
          }
        : null,
      shouldClearPublication: !isPublicationStatus,
      shouldMarkRejected: update.status === 'rejected',
      rejectionDate: update.status === 'rejected'
        ? (update.decisionDate || update.firstDecisionDate || '')
        : ''
    };
  }

  function shouldCelebrateAcceptance(previousStatus, nextStatus) {
    const previous = String(previousStatus || '').trim().toLowerCase();
    const next = String(nextStatus || '').trim().toLowerCase();
    return next === 'accepted' && previous !== 'accepted' && previous !== 'published';
  }

  function buildSubmissionCreateMode(values = {}) {
    const selectedManuscriptId = String(values.selectedManuscriptId || '').trim();
    const targetJournal = String(values.targetJournal || '').trim();
    const title = String(values.newManuscriptTitle || '').trim();
    const isNew = selectedManuscriptId === '__new__';

    if (!targetJournal) {
      return { ok: false, error: 'Target journal is required.' };
    }
    if (isNew && !title) {
      return { ok: false, error: 'Manuscript title is required.' };
    }
    if (!isNew && !selectedManuscriptId) {
      return { ok: false, error: 'Select or create a manuscript first.' };
    }

    return {
      ok: true,
      mode: isNew ? 'new' : 'existing',
      manuscriptId: isNew ? '' : selectedManuscriptId,
      targetJournal,
      title
    };
  }

  function getTimelineEventDate(node, key) {
    if (!node || typeof node !== 'object') return '';
    const completedOnly = key === 'r1_comments' || key === 'accept' || key === 'online';
    return completedOnly
      ? String(node.completeDate || '')
      : String(node.completeDate || node.planDate || node.dueDate || '');
  }

  function findCapturedSubmissionMatch({ submissions = [], manuscripts = [], capture = {} } = {}) {
    const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const externalId = normalize(capture.externalManuscriptId);
    const title = normalize(capture.manuscriptTitle);
    const journal = normalize(capture.targetJournal);
    const origin = String(capture.sourceOrigin || '').trim().toLowerCase();
    const manuscriptsById = new Map(manuscripts.map(item => [item.id, item]));

    return submissions.find((submission) => {
      const sameJournal = journal && normalize(submission.targetJournal || submission.journal) === journal;
      const sameOrigin = origin && String(submission.captureProvenance?.sourceOrigin || '').trim().toLowerCase() === origin;
      const existingExternalId = normalize(submission.externalManuscriptId);
      if (externalId && existingExternalId) return externalId === existingExternalId && Boolean(sameJournal && sameOrigin);
      if (!origin || !title || !journal) return false;
      const manuscript = manuscriptsById.get(submission.manuscriptId);
      const submissionJournal = submission.targetJournal || submission.journal || '';
      return String(submission.captureProvenance?.sourceOrigin || '').trim().toLowerCase() === origin
        && normalize(manuscript?.title || submission.title) === title
        && normalize(submissionJournal) === journal;
    }) || null;
  }

  function normalizeSearchText(value) {
    return String(value ?? '').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();
  }

  function matchesSubmissionSearch(searchText, status, query, filter = 'all') {
    const terms = Array.isArray(query) ? query : normalizeSearchText(query).split(/\s+/).filter(Boolean);
    const groups = { active: ['submitted', 'under_review', 'revision'], revision: ['revision'], accepted: ['accepted', 'published'], rejected: ['rejected'] };
    return (!groups[filter] || groups[filter].includes(status)) && terms.every(term => searchText.includes(term));
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = {
    cleanDoiFromText,
    cleanResearchTitle,
    normalizeFeedbackType,
    getToastBadgeClass,
    getSubmissionStatusBadgeClass,
    getWorkflowStatusBadgeClass,
    buildSubmissionRelationshipSummary,
    buildProjectDeleteImpactSummary,
    getTabKey,
    toDateInputValue,
    getRecordFormMode,
    shouldAutoCapture,
    shouldNotifyMetadataCaptureFailure,
    isSafeWebUrl,
    buildSubmissionIdentityUpdate,
    buildSubmissionEditCenterUpdate,
    buildSubmissionEditSyncPlan,
    shouldCelebrateAcceptance,
    buildSubmissionCreateMode,
    getTimelineEventDate,
    findCapturedSubmissionMatch,
    normalizeSearchText,
    matchesSubmissionSearch,
    escapeHTML
  };

  root.RFUI = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
