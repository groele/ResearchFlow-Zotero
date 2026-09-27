/**
 * ResearchFlow Companion - focused MV3 service worker.
 *
 * Responsibilities:
 * - inspect the active tab for Google Scholar-compatible pages before opening the workspace;
 * - receive reviewed submission-portal captures;
 * - serialize database writes across extension pages;
 * - run explicit or scheduled database synchronization.
 */

importScripts('storage.js', 'journal-portals.js');

let databaseWriteQueue = Promise.resolve();
// Sync commits and page saves share one writer; network waits stay outside it.
storage.enqueueCommit = operation => {
  const result = databaseWriteQueue.catch(() => {}).then(operation);
  databaseWriteQueue = result;
  return result;
};
const PENDING_ACADEMIC_DRAFT_KEY = 'researchflow_pending_academic_draft';

async function openWorkspacePage(mode = '') {
  const workspaceUrl = chrome.runtime.getURL('pages/options.html');
  const captureUrl = mode ? `${workspaceUrl}?mode=${encodeURIComponent(mode)}` : workspaceUrl;
  const tabs = await chrome.tabs.query({});
  const existingWorkspace = tabs.find(tab => (
    tab.id
    && typeof tab.url === 'string'
    && tab.url.startsWith(workspaceUrl)
  ));

  if (existingWorkspace) {
    await chrome.tabs.update(existingWorkspace.id, mode ? { url: captureUrl, active: true } : { active: true });
    if (existingWorkspace.windowId) {
      await chrome.windows.update(existingWorkspace.windowId, { focused: true }).catch(() => {});
    }
    return;
  }

  await chrome.tabs.create({ url: captureUrl, active: true });
}

async function openSubmissionCapturePage() {
  return openWorkspacePage('submission-capture');
}

async function captureScholarPageFromTab(tab) {
  if (!Number.isInteger(tab?.id) || !/^https?:\/\//i.test(String(tab.url || ''))) return null;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/scholar-mirrors.js']
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.RFScholarMirrors?.captureResults(document, window.location.href, 8) || null
    });
    const capture = results?.[0]?.result;
    return capture?.isScholarPage && capture.results?.length ? capture : null;
  } catch (error) {
    console.warn('Scholar page inspection unavailable:', error?.message || error);
    return null;
  }
}

function buildPendingAcademicDraft(capture) {
  const now = Date.now();
  const safeResult = result => ({
    title: safeText(result?.title, 500),
    authors: safeText(result?.authors, 600),
    authorList: Array.isArray(result?.authorList)
      ? result.authorList.map(author => safeText(author, 200)).filter(Boolean).slice(0, 30)
      : [],
    abstract: safeText(result?.abstract, 4000),
    publication: safeText(result?.publication, 240),
    doi: safeText(result?.doi, 240),
    articleUrl: safeText(result?.articleUrl, 2000),
    pdfUrl: safeText(result?.pdfUrl, 2000),
    sourcePageUrl: safeText(result?.sourcePageUrl || capture.sourcePageUrl, 2000),
    sourceHost: safeText(result?.sourceHost || capture.sourceHost, 255),
    sourceType: safeText(result?.sourceType || capture.sourceType, 40),
    confidenceScore: Number(result?.confidenceScore || capture.confidenceScore) || 0,
    evidence: Array.isArray(result?.evidence || capture.evidence)
      ? (result.evidence || capture.evidence).slice(0, 12)
      : []
  });
  const capturedResults = (Array.isArray(capture.results) ? capture.results : [capture])
    .map(safeResult)
    .filter(result => result.title)
    .slice(0, 8);
  const first = capturedResults[0] || {};
  return {
    ...first,
    results: capturedResults,
    createdAt: now,
    expiresAt: now + (30 * 60 * 1000)
  };
}

async function handleToolbarClick(tab) {
  const capture = await captureScholarPageFromTab(tab);
  if (!capture) {
    await openWorkspacePage();
    return;
  }

  await chrome.storage.local.set({
    [PENDING_ACADEMIC_DRAFT_KEY]: buildPendingAcademicDraft(capture)
  });
  await openWorkspacePage('academic-capture');
}

chrome.action.onClicked.addListener(tab => {
  handleToolbarClick(tab).catch(error => {
    console.error('Toolbar action failed:', error);
    chrome.runtime.openOptionsPage();
  });
});

function safeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildPendingSubmissionDraft(request, sender) {
  const supplied = request.capture || request.draft || {};
  const detected = self.RFJournalPortals?.buildSubmissionCapture({
    url: supplied.portalUrl || supplied.journalUrl || sender.tab?.url || '',
    title: supplied.pageTitle || sender.tab?.title || '',
    signals: {
      journalName: supplied.journalName || supplied.targetJournal,
      manuscriptTitle: supplied.manuscriptTitle,
      manuscriptId: supplied.manuscriptId,
      status: supplied.workflowStage || supplied.status,
      submissionDate: supplied.submissionDate,
      revisionDueDate: supplied.revisionDueDate,
      firstAuthor: supplied.firstAuthor,
      authors: supplied.authors,
      abstract: supplied.abstract,
      keywords: supplied.keywords
    }
  });
  if (!detected) return null;

  const now = Date.now();
  return {
    targetJournal: safeText(detected.journalName, 160),
    journalUrl: detected.portalUrl,
    platformId: detected.platformId,
    platformName: detected.platformName,
    sourceOrigin: detected.origin,
    manuscriptTitle: safeText(detected.manuscriptTitle, 500),
    manuscriptId: safeText(detected.manuscriptId, 120),
    workflowStage: safeText(detected.workflowStage, 40),
    submissionDate: detected.submissionDate || new Date(now).toISOString().slice(0, 10),
    revisionDueDate: detected.revisionDueDate || '',
    firstAuthor: safeText(detected.firstAuthor, 160),
    authors: safeText(detected.authors, 600),
    abstract: safeText(detected.abstract, 4000),
    keywords: safeText(detected.keywords, 500),
    confidenceScore: Number(detected.confidenceScore) || 0,
    confidenceLevel: safeText(detected.confidenceLevel, 20),
    detectedFieldCount: Number(detected.detectedFieldCount) || 0,
    evidence: Array.isArray(detected.evidence) ? detected.evidence.slice(0, 12) : [],
    createdAt: now,
    expiresAt: now + (30 * 60 * 1000)
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== 'object') return false;
  if (['LOAD_DATABASE', 'SAVE_DATABASE', 'TRIGGER_SYNC'].includes(request.action)
      && sender.url && !sender.url.startsWith(chrome.runtime.getURL(''))) {
    sendResponse({ success: false, error: 'This operation requires a ResearchFlow workspace page.' });
    return false;
  }
  if (request.action === 'LOAD_DATABASE') {
    storage.enqueueCommit(() => storage.loadAll())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'SAVE_DATABASE') {
    if (!request.data || typeof request.data !== 'object' || Array.isArray(request.data)) {
      sendResponse({ success: false, error: 'Invalid database payload.' });
      return false;
    }
    const write = storage.enqueueCommit(async () => {
        let nextDatabase = request.data;
        const currentDatabase = await storage.loadAll();
        if (!request.mergeOnConflict && Number(request.replace ? request.expectedRevision : request.data?.revision || 0) !== Number(currentDatabase.revision || 0)) {
          throw new Error('Database changed in another page. Reload before saving; your changes were not committed.');
        }
        if (request.mergeOnConflict) {
          nextDatabase = await storage.mergeDatabases(request.data, currentDatabase);
        }
        nextDatabase = { ...nextDatabase, revision: currentDatabase.revision };
        return storage.saveAll(nextDatabase, { localOnly: true });
      });
    write
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'TRIGGER_SYNC') {
    const report = result => chrome.runtime.sendMessage?.({ action: 'SYNC_STATE', ...result })?.catch(() => {});
    report({ syncing: true });
    storage.syncDatabaseNow()
      .then(result => { report(result); sendResponse(result); })
      .catch(error => {
        const result = { success: false, error: error.message };
        report(result);
        sendResponse(result);
      });
    return true;
  }

  if (request.action === 'OPEN_SUBMISSION_CAPTURE') {
    const pendingDraft = buildPendingSubmissionDraft(request, sender);
    if (!pendingDraft) {
      sendResponse({ success: false, error: 'Unsupported submission portal.' });
      return true;
    }

    chrome.storage.local
      .set({ researchflow_pending_submission_draft: pendingDraft })
      .then(() => openSubmissionCapturePage())
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});
