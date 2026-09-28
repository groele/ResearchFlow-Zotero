/**
 * ResearchFlow OS - Options Dashboard Controller
 * Manages full routing, CRUD forms, kanbans, timeline charts, and sync settings.
 */

let db = null;

function applyDatabaseUpdate(newData) {
  if (!newData) return;
  // Zotero echoes a successful save to the originating page. A delayed echo
  // must not replace newer edits or rebuild the editor between keystrokes.
  if (db && Number(newData.revision || 0) <= Number(db.revision || 0)
    && Number(newData.lastUpdated || 0) <= Number(db.lastUpdated || 0)) return;
  db = newData;
  syncManuscriptStatusesFromSubmissions(db);
  if (typeof window.storage !== 'undefined') {
    window.storage.cache = newData;
  }
  const activeView = document.querySelector('.content-view.active')?.id;
  if (activeView === 'view-dashboard') renderDashboard();
  else if (activeView === 'view-manuscripts') renderKanban();
  else if (activeView === 'view-submissions') {
    const editorState = document.querySelector('[data-submission-autosave-status]')?.dataset.state;
    renderSubmissions({ refreshDetails: pendingSubmissionSaves === 0 && !['pending', 'saving', 'invalid', 'error'].includes(editorState) });
  }
}
let selectedProjectId = null;
let selectedSubmissionId = null;
let currentDashboardFilter = 'all'; // 'all', 'accepted', 'active'
let currentLanguage = 'en';
let isPipelineExpanded = false;
let showEmptyKanbanColumns = false;
let submissionAutoSaveCleanup = null;
let pendingSubmissionSaves = 0;
let acceptanceCelebrationCleanup = null;
let previousModalFocus = null;
let activeSharePreviewUrl = null;
let activeSharePreviewCleanup = null;
let sharePreferenceWrites = Promise.resolve();

const RF_OPTIONS_RENDER_VERSION = '9.1.3';
const PRE_IMPORT_BACKUP_KEY = 'researchflow_pre_import_backup';
const SHARE_PREFS_STORAGE_KEY = 'researchflow_share_visibility';
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const UI_THEME_OPTIONS = new Set(['system', 'light', 'dark']);

const I18N = {
  en: {
    searchClear: 'Clear search', searchStatus: 'Filter by status', searchAll: 'All statuses', searchActive: 'In progress', searchRevision: 'Revision', searchAccepted: 'Accepted / Published', searchRejected: 'Rejected', searchEmpty: 'No matching submissions', searchEmptyHelp: 'Try a shorter keyword or another status.', searchReset: 'Clear filters',
    shareZoom: 'Enlarge preview',
    shareFit: 'Fit image',
    shareAppearance: 'Card appearance',
    shareGallery: 'Explore styles',
    shareBrandSize: 'Brand presence',
    shareBrandCompact: 'Subtle', shareBrandBalanced: 'Balanced', shareBrandBold: 'Prominent',
    shareResolution: 'Export quality', shareResolutionStandard: 'Standard · 720 px wide', shareResolutionHigh: 'High · 1440 px wide', shareResolutionUltra: 'Ultra · 2160 px wide',
    shareResolutionLimited: 'Resolution adjusted for a long image',
    shareOmitted: '{count} earlier milestones are summarized in the card',
    shareRetry: 'Retry preview', sharePreviewError: 'Preview could not be generated. Try again or choose a lower export quality.',
    shareStyleReset: 'Reset design', shareStyleResetHelp: 'Resets the style and export settings. Hidden information stays hidden.',
    sharePrefsFailed: 'The image is ready to use, but these settings could not be saved.',
    shareEstuary: 'Estuary · blue to jade',
    shareIris: 'Iris · blue to rose',
    shareAmber: 'Amber · sand to sage',
    shareJournal: 'Journal cover · editorial',
    shareConference: 'Conference poster · teal',
    shareArchive: 'Lab archive · ledger',
    sharePaper: 'Paper · calm & clear',
    shareInk: 'Ink · after hours',
    shareBlueprint: 'Blueprint · structured',
    shareMinimal: 'Minimal · title first',
    shareCyber: 'Cyber Neon · signal glow',
    shareAurora: 'Aurora Lab · spectral',
    shareTerminal: 'Terminal Grid · precise',
    shareRendering: 'Preparing your image…',
    submissionSearch: 'Find a submission',
    submissionSearchPlaceholder: 'Title, journal, author or ID',
    submissionSearchCount: '{count} / {total}',
    dashboardNav: 'Dashboard Overview',
    manuscriptsNav: 'Manuscripts Kanban',
    submissionsNav: 'Submissions & Review',
    settingsNav: 'Multi-Cloud Settings',
    forceSync: 'Sync cloud now',
    dashboardTitle: 'Dashboard Overview',
    dashboardSubtitle: "A bird's eye view of your scientific progress and pipelines.",
    acceptedPublished: '🎉 Accepted & Published',
    activeReview: '🕒 Active Submissions',
    totalSubmissions: '📊 Total Submission Attempts',
    clickToFilter: 'Click to filter',
    timelineTitle: '📅 Manuscript Pipeline Timelines',
    timelineSubtitle: 'Track experiments, writing, submission, revision, acceptance, and publication through visual manuscript pipelines.',
    timelineSortedBySubmissionDate: 'Latest submissions first',
    compact: 'Compact',
    expanded: 'Expanded',
    allPipelines: 'All pipelines',
    activePipelines: 'Active in review',
    acceptedPipelines: 'Accepted / published',
    metricExpSubmit: 'Avg. experiment → submit',
    metricSubmitToday: 'Unaccepted: submit → today',
    metricR1Today: 'Unaccepted: R1 → today',
    metricSubmitAccept: 'Accepted: submit → accept',
    recentLogs: '⚡ Recent Research Logs',
    timelineAlerts: '🔔 Timeline Alerts',
    addEvent: '+ Event',
    latestEvent: 'Latest Event',
    timelineEvents: 'Timeline Events',
    manageEvents: 'Manage Events',
    openSubmissionDetails: 'Details',
    shareJourney: 'Share journey',
    shareJourneyTitle: 'Submission journey',
    shareJourneyHelp: 'Generated locally. Nothing is uploaded until you choose to share it.',
    shareJourneySystem: 'Share image',
    shareJourneyDownload: 'Download PNG',
    shareJourneyCopy: 'Copy image',
    shareJourneyCopied: 'Share image copied to clipboard.',
    shareJourneyDownloaded: 'Share image downloaded.',
    shareJourneyReady: 'Share image is ready.',
    shareJourneyFailed: 'Could not generate the share image.',
    shareJourneyUnsupported: 'Image sharing is unavailable here. Download the PNG instead.',
    shareJourneyEyebrow: 'RESEARCHFLOW · SUBMISSION JOURNEY',
    shareJourneyStatus: 'CURRENT STATUS',
    shareJourneyDuration: 'DAYS IN THIS JOURNEY',
    shareJourneyTimeline: 'JOURNEY MILESTONES',
    shareJournalLabel: 'TARGET JOURNAL',
    shareJourneyNoEvents: 'No dated milestones yet',
    shareJourneyFooter: 'Built locally from your ResearchFlow timeline',
    shareVisibilityTitle: 'Visible information',
    shareVisibilityHelp: 'Your choices are remembered for the next image.',
    shareTimelineStart: 'Timeline starts at',
    shareTimelineStartExperiment: 'Experiment start',
    shareTimelineStartSubmission: 'Submission start',
    shareFieldTitle: 'Title',
    shareFieldJournal: 'Journal',
    shareFieldAuthor: 'First author',
    shareFieldStatus: 'Status',
    shareFieldDuration: 'Journey days',
    shareFieldDates: 'Milestone dates',
    shareFieldFooter: 'ResearchFlow branding',
    shareSizeTitle: 'Image size',
    shareSizePortrait: 'Portrait · expands to fit',
    shareSizeStory: 'Story · taller composition',
    shareSizeAuto: 'Adaptive long image',
    noEventYet: 'No event yet',
    addEventStart: 'Add an event to start tracking',
    clickAddEvent: 'Click here to add a timeline event for this manuscript.',
    clickEditEvent: 'Click to edit this event.',
    settingsTitle: 'Multi-Cloud Settings',
    settingsSubtitle: 'Manage synchronization, workspace preferences, and backups.',
    settingsKicker: 'Workspace control',
    settingsTrustSummary: 'Data protection summary',
    settingsLocalFirst: 'Local database',
    settingsDeviceSecrets: 'Device-only credentials',
    settingsPreferencesAutosave: 'Optional cloud sync',
    settingsSecurityEyebrow: 'Privacy by architecture',
    settingsSecurityTitle: 'Privacy by default',
    settingsSecurityHelp: 'Your research data stays on this device by default. Cloud sync only starts after you choose and configure a provider; passwords and tokens stay out of database files, exports, and cloud payloads.',
    settingsRoutingEyebrow: 'Data destination',
    settingsRoutePrivacy: 'Secrets are stored only on this device.',
    settingsLocalEyebrow: 'Active route',
    settingsLocalTitle: 'Local cache only',
    settingsLocalHelp: 'Research data remains inside this local device (Zotero data directory) until you export or select a cloud route.',
    settingsLocalPointAccount: 'No account required',
    settingsLocalPointSync: 'Manual cloud sync is off',
    settingsLocalPointBackup: 'JSON backup remains available',
    settingsProviderEyebrow: 'Provider credentials',
    settingsWebdavHelp: 'Connect a private WebDAV folder for the database JSON.',
    settingsCredentialNote: 'Credentials never enter exported or synchronized JSON.',
    settingsGithubHelp: 'Store the database JSON in a private repository branch.',
    settingsGithubCredentialNote: 'Use a repository-scoped token with Contents access.',
    settingsLanguageEyebrow: 'Interface',
    settingsAssistEyebrow: 'Browser intelligence',
    settingsBackupEyebrow: 'Data resilience',
    settingsBackupNote: 'A recoverable snapshot is kept before every valid import.',
    languageCardTitle: 'Interface Preferences',
    languageLabel: 'Display Language',
    languageHelp: 'Choose the language and appearance used across this workspace.',
    languageAutoSaved: 'Interface preferences are saved automatically.',
    appearanceLabel: 'Appearance',
    appearanceSystem: 'Follow system',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    appearanceSaved: 'Appearance preference saved.',
    autoCloudSyncLabel: 'Automatic cloud sync',
    autoCloudSyncHelp: 'Sync valid cloud routes shortly after local changes are saved.',
    autoCloudSyncLocalHelp: 'Choose WebDAV or GitHub to enable automatic cloud sync.',
    detectedSubmissionPrefilled: 'Captured from {platform}. Review every field before creating the project.',
    captureReviewTitle: 'Review captured submission',
    captureReviewHelp: 'Nothing is saved yet. Check the detected fields, then confirm to create a linked project, manuscript, and submission record.',
    captureConfidence: 'Recognition confidence',
    captureFieldsDetected: '{count} fields detected',
    captureProjectTitle: 'New Project Name',
    captureProjectPlaceholder: 'e.g. Nano Letters submission — interface polarization',
    manuscriptIdLabel: 'Manuscript / Submission ID',
    capturedStatusLabel: 'Detected Workflow Status',
    firstAuthorLabel: 'First Author',
    firstAuthorHelp: 'Shown on the dashboard and kept with the linked manuscript.',
    firstAuthorPlaceholder: 'e.g. Alex Chen',
    firstAuthorNotSet: 'Not set',
    authorsLabel: 'Authors',
    abstractLabel: 'Abstract / Project Summary',
    keywordsLabel: 'Keywords',
    revisionDueLabel: 'Revision Due Date',
    confirmCreateProject: 'Confirm & Create Project',
    captureCreatedToast: 'New project, manuscript, and submission created after review.',
    captureExistingOpenedToast: 'This captured submission already exists. The existing record was opened.',
    confidenceHigh: 'High',
    confidenceMedium: 'Medium',
    confidenceLow: 'Needs review',
    cloudRoutingTitle: 'Cloud synchronization',
    webdavTitle: 'WebDAV Credentials',
    githubTitle: 'GitHub Private Repository Sync',
    backupTitle: 'Database Backup & Import',
    saveLanguage: 'Save Language',
    saveMappings: 'Save Storage Mapping',
    exportDb: 'Export Database',
    exportDiagnostics: 'Export Diagnostics',
    importJson: 'Import JSON',
    restoreImportBackup: 'Restore Pre-Import Backup',
    languageSaved: 'Language preference saved.',
    databaseExported: 'Database JSON exported!',
    diagnosticsExported: 'Privacy-safe diagnostics exported.',
    databaseImported: 'Database JSON imported successfully.',
    importBackupRestored: 'The database state from before the last import was restored.',
    noImportBackup: 'No pre-import backup is available on this device.',
    restoreImportConfirm: 'Restore the database state saved immediately before the last import? Current unsaved changes will be replaced.',
    importFileTooLarge: 'The selected backup is larger than 25 MB and was not opened.',
    invalidBackup: 'This file is not a recognized ResearchFlow database backup.',
    noUrgentEvents: 'No urgent review or timeline events.',
    noRecentRecords: 'No research records captured yet.',
    noPipelines: 'No manuscript submission pipelines in progress.',
    eventNameRequired: 'Event name is required.',
    zoteroSync: 'Import to Zotero',
    untitledEvent: 'Untitled Event',
    untitledManuscript: 'Untitled Manuscript',
    untitledProject: 'Untitled Project',
    targetJournal: 'Target Journal',
    typeNoEvent: 'No Event',
    eventTypeResearch: 'Research',
    eventTypeWriting: 'Writing',
    eventTypeSubmission: 'Submission',
    eventTypeReview: 'Review',
    eventTypeRevision: 'Revision',
    eventTypePublication: 'Publication',
    eventTypeSpecial: 'Special',
    statusCompleted: 'Completed',
    statusActive: 'Active',
    statusPending: 'Planned',
    statusBlocked: 'Blocked',
    inlineAddTimelineEvent: 'Add timeline event',
    keyEventPreset: 'Key Event',
    customEvent: 'Custom event',
    eventNotesShort: 'Notes',
    cancel: 'Cancel',
    eventPlaceholder: 'Event, e.g. R1 comments received',
    noDate: 'No date',
    days: 'days',
    dayUnitShort: 'd',
    relativeToday: 'today',
    relativeDaysAgo: '{count} days ago',
    relativeInDays: 'in {count} days',
    nodesSaved: '{count} nodes saved',
    expSubmitShort: 'Exp→Submit',
    keyEventRail: 'Key event rail',
    countingNow: 'Counting now',
    completedInterval: 'Completed interval',
    displayPrepareLabel: 'Experiment → Submission',
    displayPrepareCaption: 'Current focus: finish the pre-submission cycle.',
    displayAcceptedLabel: 'Submission → Acceptance',
    displayAcceptedCaption: 'Accepted manuscripts show the total time from submission to acceptance.',
    displayR1Label: 'R1 Comments → Today',
    displayR1Caption: 'R1 returned; the active window now starts from the first decision.',
    displayReviewLabel: 'Submission → Today',
    displayReviewCaption: 'Not accepted yet; keep counting the waiting time after submission.',
    milestoneExperimentStart: 'Experiments started',
    milestoneExperimentDone: 'Experiments done',
    milestoneSubmission: 'Submission',
    milestoneAcceptance: 'Acceptance',
    milestoneR1Comments: 'R1 comments',
    milestoneToday: 'Today',
    statePreparing: 'Preparing',
    stateOnline: 'Online',
    stateAccepted: 'Accepted',
    stateAfterR1: 'After R1',
    stateUnderReview: 'Under Review',
    stateSubmitted: 'Submitted',
    stateNotSubmitted: 'Not submitted',
    stateSinceR1: '{count} d since R1',
    stateSinceSubmit: '{count} d since submit',
    defaultExperimentsStarted: 'Experiments Started',
    defaultExperimentsCompleted: 'Experiments Completed',
    defaultDataOrganization: 'Data Organization',
    defaultDraftCompleted: 'Draft Completed',
    defaultManuscriptSubmitted: 'Manuscript Submitted',
    defaultReviewCommentsR1: 'Review Comments R1',
    defaultR1RevisionSubmitted: 'R1 Revision Submitted',
    defaultReviewCommentsR2: 'Review Comments R2',
    defaultR2RevisionSubmitted: 'R2 Revision Submitted',
    defaultAccepted: 'Accepted',
    defaultOnlinePublication: 'Online Publication',
    defaultProof: 'Proof',
    editTimelineEvent: 'Edit Timeline Event',
    close: 'Close',
    eventName: 'Event Name',
    type: 'Type',
    status: 'Status',
    keyEventMapping: 'Key Event Mapping',
    eventDate: 'Event Date',
    eventDateHelp: 'One timeline event only needs one date: the day this mapped event happened. Deadlines and source dates are managed in the Submission Entry Editor.',
    plannedDate: 'Planned Date',
    initialSubmissionDate: 'Initial Submission Date',
    deadlineDate: 'Deadline / Due Date',
    completionDate: 'Completion Date',
    firstDecisionDate: 'First Decision / R1 Date',
    revisionDueDateLabel: 'Revision Due Date',
    timelineDateSource: 'Date source',
    doiLabel: 'DOI',
    articlePage: 'Article page',
    doiNotSet: 'DOI not set',
    trackSubmissionTitle: 'Track Journal Submission',
    manuscriptPaper: 'Manuscript / Paper',
    targetJournalInput: 'Target Journal',
    articleUrlLabel: 'Article / Journal URL',
    articleUrlPlaceholder: 'https://doi.org/10.xxxx/xxxxx',
    trackSubmissionButton: 'Track Submission',
    manuscriptJournalRequired: 'Manuscript and Journal are required',
    submissionAddedToast: 'New submission added to pipeline!',
    dateSourceSubmission: 'submission record',
    dateSourceTimeline: 'timeline node',
    dateSourceMissing: 'not set',
    planToday: 'Plan Today',
    setToday: 'Set Today',
    due14: 'Due +14d',
    markActive: 'Mark Active',
    markDoneToday: 'Mark Done Today',
    clearDates: 'Clear Dates',
    clearDate: 'Clear Date',
    notes: 'Notes',
    notesPlaceholder: 'Decision details, reviewer deadline, portal note, or next action...',
    delete: 'Delete',
    saveChanges: 'Save Changes',
    keyAuto: 'Auto detect',
    keyExperimentsStarted: 'Key: Experiments started',
    keyExperimentsDone: 'Key: Experiments done',
    keyDraftDone: 'Key: Draft done',
    keySubmitted: 'Key: Submitted',
    keyR1Comments: 'Key: R1 comments',
    keyR1Resubmitted: 'Key: R1 resubmitted',
    keyR2Comments: 'Key: R2 comments',
    keyR2Resubmitted: 'Key: R2 resubmitted',
    keyAccepted: 'Key: Accepted',
    keyOnlinePublished: 'Key: Online / Published',
    statusPlannedNotStarted: 'Planned / Not Started',
    statusInProgress: 'In Progress',
    statusBlockedException: 'Blocked / Exception',
    statusOverdue: 'Overdue',
    statusDueSoon: 'Due soon',
    statusUpcoming: 'Upcoming',
    specialException: 'Special / Exception',
    manuscriptNotFound: 'Manuscript not found. Refreshing workspace.',
    manuscriptStatusUpdated: 'Manuscript status updated.',
    manuscriptStatusUpdatedTo: 'Manuscript status updated to {status}.',
    submissionNotFound: 'Submission not found. Refreshing dashboard.',
    eventNotFound: 'Event not found. Refreshing dashboard.',
    eventAddedToast: 'Added event "{name}".',
    eventSavedToast: 'Event "{name}" saved.',
    eventRemovedToast: 'Event removed from pipeline',
    confirmDeleteEvent: 'Are you sure you want to delete event "{name}"?',
    confirmUpdateEvent: 'This key event already exists. Update "{name}" instead of adding a duplicate?',
    statusRejected: 'Rejected',
    markRejected: 'Mark Rejected',
    transferToJournal: 'Transfer to New Journal',
    transferSubmissionTitle: 'Rejected: Submit to Another Journal',
    newTargetJournal: 'New Target Journal',
    rejectionDate: 'Rejection Date',
    rejectionNote: 'Decision note',
    transferButton: 'Create New Submission',
    rejectedToast: 'Submission marked rejected.',
    transferToast: 'New target journal submission created.',
    manuscriptsTitle: 'Manuscripts Kanban',
    manuscriptsSubtitle: 'Track your writing process from outline/drafting to final peer-review.',
    addManuscript: '+ Add Manuscript',
    kanbanIdea: 'Idea & Outline',
    kanbanDrafting: 'Drafting & Figures',
    kanbanSubmitted: 'Submitted',
    kanbanAccepted: 'Accepted / Published',
    kanbanShowEmpty: 'Show empty stages',
    kanbanHideEmpty: 'Hide empty stages',
    kanbanStageSummary: '{count} of {total} stages contain manuscripts',
    submissionsPageTitle: 'Submissions & Peer Review Matrix',
    submissionsPageSubtitle: 'Follow each submission from journal entry through review, revision, and publication.',
    activeSubmissionsTitle: 'Active Submissions',
    activeSubmissionsHelp: 'Choose a submission to read its timeline, status, and review notes.',
    submissionEmptyDetail: 'Select a submission; the entry editor opens under Workflow Context.',
    journalPortalsTitle: 'Quick Submission Portals',
    journalPortalsHelp: 'Open, edit, or add your journal submission websites.',
    trackNewSubmissionButton: '+ Track New Submission',
    submissionDetailKicker: 'Journal Submission',
    currentStageLabel: 'Current Stage',
    trackedSinceLabel: 'Tracked since',
    workflowContextTitle: 'Workflow Context',
    workflowNeedsLinking: 'Needs linking',
    linkManuscript: 'Link manuscript',
    linkSubmissionTitle: 'Link Submission to Manuscript',
    linkSubmissionHelp: 'Choose the manuscript that owns this submission record.',
    linkSubmissionConfirm: 'Link Submission',
    linkSubmissionSaved: 'Submission linked to the selected manuscript.',
    noManuscriptsToLink: 'No manuscripts are available. Create a manuscript first.',
    workflowLinkedFlow: 'Linked flow',
    workflowManuscriptLabel: 'Manuscript',
    workflowTimelineLabel: 'Timeline',
    workflowReviewerCommentsLabel: 'Reviewer Comments',
    editFields: 'Edit fields',
    jumpToEditor: 'Jump to editor',
    submissionEntryEditorTitle: 'Submission Entry Editor',
    submissionEntryEditorHelp: 'Edit the selected entry here. Changes are saved automatically as you type.',
    linkedManuscriptBadge: 'Linked manuscript',
    detachedSubmissionBadge: 'Detached submission',
    manuscriptSection: 'Manuscript',
    manuscriptTitleLabel: 'Manuscript Title',
    paperTitlePlaceholder: 'Paper title',
    submissionPortalUrl: 'Submission Portal URL',
    reviewTimingSection: 'Review Timing',
    publicationSection: 'Publication',
    submissionChecklistSection: 'Submission Checklist',
    peerReviewMatrixSection: 'Peer Review Response Matrix',
    addComment: 'Add Comment',
    reviewEditorHelp: 'Reviewer comments and author responses are saved automatically as you type.',
    autoSavePending: 'Waiting to save',
    autoSaveSaving: 'Saving changes…',
    autoSaveSaved: 'All changes saved',
    autoSaveInvalid: 'Check the highlighted field',
    autoSaveFailed: 'Auto-save failed. Your text remains in this form.',
    acceptanceCelebrationEyebrow: 'Milestone unlocked',
    acceptanceCelebrationTitle: 'Accepted — congratulations!',
    acceptanceCelebrationBody: '{title} has crossed an important research milestone.',
    transferRoundHelp: 'Close the current round and create the next target journal record in one step.',
    savedReviewPreviewTitle: 'Saved Review Preview',
    savedReviewPreviewHelp: 'Read-only snapshot kept in sync with the Submission Entry Editor.',
    exportTable: 'Export Table',
    emptyReviewEditor: 'No reviewer comments recorded. Add one here; it will save automatically.',
    emptyReviewPreview: 'No saved reviewer comments yet.',
    reviewerCommentLabel: 'Reviewer Comment #{count}',
    reviewerCommentPlaceholder: 'Paste reviewer comment...',
    authorResponseLabel: 'Author Response',
    authorResponsePlaceholder: 'Draft your professional response...',
    copy: 'Copy',
    removeComment: 'Remove comment',
    checklistLabel: 'Checklist',
    responsesLabel: 'Responses',
    responseSaved: 'Response saved',
    responsePending: 'Response pending',
    noCommentText: 'No comment text saved yet.',
    submissionEditsSaved: 'Submission edits saved.',
    confirmDeleteSubmission: 'Delete tracking for this submission?',
    confirmMarkRejected: 'Mark this submission as rejected?',
    deleteSubmissionTitle: 'Delete submission tracking',
    cycleTimeCompleted: 'Cycle Time Completed',
    cycleTimeCompletedText: 'Submitted {start}; accepted/published {end}. Total duration: {days} days.',
    submissionCycleTracking: 'Submission Cycle Tracking',
    submissionCycleText: 'Submitted {start}. Current elapsed time: {days} days in review.',
    publicationLinksKept: 'Publication links are kept for Accepted or Published submissions.',
    editorRenderFailedTitle: 'Submission editor failed to render',
    editorRenderFailedHelp: 'The submission detail template did not create the edit form. Reload the extension and report this state if it persists.',
    editorMounted: 'Edit form active v{version}',
    editorMissing: 'Edit form missing v{version}',
    noSubmissionsTracked: 'No submissions tracked yet.',
    portalEmpty: 'No journal portals saved.',
    portalDeleteTitle: 'Delete portal',
    portalDeleteConfirm: 'Are you sure you want to delete the portal for {name}?',
    portalDeletedToast: 'Portal "{name}" deleted',
    addPortalTitle: 'Add Journal Submission Portal',
    portalNameLabel: 'Journal / Publisher Name',
    portalNamePlaceholder: 'e.g. ACS, Wiley, Nature, APL',
    portalUrlLabel: 'Portal Login URL',
    portalColorLabel: 'Brand Theme Color',
    portalColorHelp: 'Pick custom color for brand avatar badge',
    addPortalButton: 'Add Portal',
    fillAllFields: 'Please fill out all fields.',
    validUrlRequired: 'Please enter a valid URL (e.g. https://example.com)',
    portalAddedToast: 'Journal portal "{name}" added.',
    storageRoutingHelp: 'Choose where the ResearchFlow metadata database is synchronized.',
    routeDbLabel: 'Sync destination',
    optionLocalCache: 'None (Local Cache Only)',
    optionWebDavDrive: 'WebDAV Drive (Jianguoyun, Nextcloud)',
    optionGithubRepo: 'GitHub Private Repository',
    localSyncSummary: 'Local-only mode: data stays on this device and manual cloud sync is disabled.',
    webdavSyncSummary: 'WebDAV mode: configure and test the WebDAV account shown below.',
    githubSyncSummary: 'GitHub mode: configure and test the private repository shown below.',
    webdavUrlLabel: 'WebDAV Server Base URL',
    usernameEmailLabel: 'Username / Email',
    appPasswordLabel: 'App-Specific Password',
    testWebdav: 'Test WebDAV Connection',
    githubPatLabel: 'GitHub Personal Access Token (PAT)',
    githubRepoLabel: 'Repository Name (owner/repo)',
    githubBranchLabel: 'Branch Name',
    testGithub: 'Test GitHub Repository',
    backupHelp: 'Export your research database to JSON, or import/migrate existing ResearchFlow JSON backups.',
    noReviewerCommentsExport: 'No reviewer comments to export.',
    latexDownloaded: 'LaTeX template downloaded.',
    currentJournalLabel: 'Current journal',
    transferModalHelp: 'This will mark the current submission as rejected and create a new active submission for the next journal.',
    validPortalUrlOrBlank: 'Please enter a valid portal URL, or leave it blank.',
    newManuscriptTitleLabel: 'New Manuscript Title',
    createNewManuscriptOption: '+ Create new manuscript...',
    targetJournalPlaceholder: 'e.g. Advanced Functional Materials',
    rejectionNotePlaceholder: 'Optional editor decision, scope mismatch, reviewer summary, or next-action note...',
    editManuscriptMetadata: 'Edit Manuscript Metadata',
    addNewManuscriptTitle: 'Add New Manuscript',
    writingStatus: 'Writing Status',
    statusIdea: 'Idea',
    statusOutline: 'Outline',
    statusFiguresPrep: 'Figures Prep',
    statusDrafting: 'Drafting',
    statusInternalReview: 'Internal Review',
    abstractDraft: 'Abstract Draft',
    abstractPlaceholder: 'Outline manuscript abstract draft...',
    createManuscript: 'Create Manuscript',
    academicCapturePrefilled: 'Scholar result captured for review. Confirm the fields before creating the manuscript.',
    scholarSourcePage: 'Scholar result / article URL',
    manuscriptTitleRequired: 'Enter a manuscript title before continuing.',
    academicCaptureChooseTitle: 'Choose a Scholar result',
    academicCaptureChooseHelp: 'Select the paper you intended to capture. Nothing is saved until you confirm the form.',
    academicCaptureSource: 'Capture source',
    academicCaptureConfidence: 'Detection confidence',
    academicCaptureDetected: 'results detected',
    academicDuplicateConfirm: 'A matching manuscript already exists. Update the existing record with the reviewed fields?',
    academicDuplicateUpdated: 'Existing manuscript updated without creating a duplicate.',
    academicCaptureSaved: 'Zotero manuscript reviewed and saved.'
  },
  zh: {
    searchClear: '清除关键词', searchStatus: '按状态筛选', searchAll: '全部状态', searchActive: '进行中', searchRevision: '修回中', searchAccepted: '已接收 / 发表', searchRejected: '已拒稿', searchEmpty: '没有找到匹配的投稿', searchEmptyHelp: '试试更短的关键词，或切换投稿状态。', searchReset: '清除筛选条件',
    shareZoom: '放大预览',
    shareFit: '适应窗口',
    shareAppearance: '卡片风格',
    shareGallery: '浏览风格',
    shareBrandSize: '品牌视觉大小',
    shareBrandCompact: '精致', shareBrandBalanced: '均衡', shareBrandBold: '醒目',
    shareResolution: '导出清晰度', shareResolutionStandard: '标准 · 宽 720 像素', shareResolutionHigh: '高清 · 宽 1440 像素', shareResolutionUltra: '超清 · 宽 2160 像素',
    shareResolutionLimited: '长图已自动调整分辨率',
    shareOmitted: '另有 {count} 个较早节点在图中以提示概括',
    shareRetry: '重新生成', sharePreviewError: '预览生成失败，请重试或降低导出清晰度。',
    shareStyleReset: '重置设计', shareStyleResetHelp: '恢复风格与导出设置，已隐藏的信息仍保持隐藏。',
    sharePrefsFailed: '图片可以正常使用，但此次设置未能保存。',
    shareEstuary: '江湾 · 雾蓝青玉渐变',
    shareIris: '鸢尾 · 蓝紫蔷薇渐变',
    shareAmber: '琥珀 · 暖砂青灰渐变',
    shareJournal: '期刊封面 · 学术蓝',
    shareConference: '会议海报 · 青绿渐变',
    shareArchive: '实验档案 · 暖纸记录',
    sharePaper: '清纸 · 简洁明亮',
    shareInk: '墨夜 · 深色质感',
    shareBlueprint: '蓝图 · 理性结构',
    shareMinimal: '极简 · 聚焦标题',
    shareCyber: '赛博霓虹 · 信号光晕',
    shareAurora: '极光实验室 · 光谱感',
    shareTerminal: '终端网格 · 精密感',
    shareRendering: '正在生成分享图…',
    submissionSearch: '查找投稿',
    submissionSearchPlaceholder: '搜索标题、期刊、作者或编号',
    submissionSearchCount: '{count} / {total} 条',
    dashboardNav: '仪表盘总览',
    manuscriptsNav: '手稿看板',
    submissionsNav: '投稿与审稿',
    settingsNav: '多云设置',
    forceSync: '立即同步云端',
    dashboardTitle: '仪表盘总览',
    dashboardSubtitle: '集中查看科研进展、投稿状态和关键时间线。',
    acceptedPublished: '🎉 已接收 / 已发表',
    activeReview: '🕒 进行中的投稿',
    totalSubmissions: '📊 投稿尝试总数',
    clickToFilter: '点击筛选',
    timelineTitle: '📅 手稿流水线时间线',
    timelineSubtitle: '通过可视化手稿流水线跟踪实验、写作、投稿、修改、接收和发表。',
    timelineSortedBySubmissionDate: '按投稿时间排序',
    compact: '紧凑',
    expanded: '展开',
    allPipelines: '全部流水线',
    activePipelines: '进行中的审稿',
    acceptedPipelines: '已接收 / 已发表',
    metricExpSubmit: '平均 实验 → 投稿',
    metricSubmitToday: '未接收：投稿 → 今天',
    metricR1Today: '未接收：R1 → 今天',
    metricSubmitAccept: '已接收：投稿 → 接收',
    recentLogs: '⚡ 最近研究动态',
    timelineAlerts: '🔔 时间线提醒',
    addEvent: '+ 事件',
    latestEvent: '最新事件',
    timelineEvents: '时间线事件',
    manageEvents: '管理事件',
    openSubmissionDetails: '详情',
    shareJourney: '分享历程',
    shareJourneyTitle: '投稿历程分享图',
    shareJourneyHelp: '图片仅在本地生成，只有在你主动分享时才会离开设备。',
    shareJourneySystem: '分享图片',
    shareJourneyDownload: '下载 PNG',
    shareJourneyCopy: '复制图片',
    shareJourneyCopied: '分享图已复制到剪贴板。',
    shareJourneyDownloaded: '分享图已下载。',
    shareJourneyReady: '分享图已生成。',
    shareJourneyFailed: '分享图生成失败。',
    shareJourneyUnsupported: '当前环境无法直接分享图片，请下载 PNG。',
    shareJourneyEyebrow: 'RESEARCHFLOW · 投稿历程',
    shareJourneyStatus: '当前状态',
    shareJourneyDuration: '历程天数',
    shareJourneyTimeline: '关键节点',
    shareJournalLabel: '目标期刊',
    shareJourneyNoEvents: '暂无已记录日期的节点',
    shareJourneyFooter: '由 ResearchFlow 在本地根据你的时间线生成',
    shareVisibilityTitle: '显示内容',
    shareVisibilityHelp: '隐藏选择会自动保存，并沿用到下一张分享图。',
    shareTimelineStart: '时间线起点',
    shareTimelineStartExperiment: '实验开始',
    shareTimelineStartSubmission: '投稿开始',
    shareFieldTitle: '题目',
    shareFieldJournal: '期刊',
    shareFieldAuthor: '第一作者',
    shareFieldStatus: '当前状态',
    shareFieldDuration: '历程天数',
    shareFieldDates: '节点日期',
    shareFieldFooter: 'ResearchFlow 品牌标识',
    shareSizeTitle: '图片尺寸',
    shareSizePortrait: '竖版海报 · 随内容延展',
    shareSizeStory: '故事长幅 · 更高的构图',
    shareSizeAuto: '自适应长图',
    noEventYet: '暂无事件',
    addEventStart: '添加事件开始跟踪',
    clickAddEvent: '点击此处为此手稿添加时间线事件。',
    clickEditEvent: '点击编辑此事件。',
    settingsTitle: '多云设置',
    settingsSubtitle: '管理云端同步、工作区偏好与数据备份。',
    settingsKicker: '工作区控制中心',
    settingsTrustSummary: '数据保护摘要',
    settingsLocalFirst: '数据库本地保存',
    settingsDeviceSecrets: '凭据仅限本设备',
    settingsPreferencesAutosave: '云同步按需开启',
    settingsSecurityEyebrow: '架构级隐私保护',
    settingsSecurityTitle: '默认隐私保护',
    settingsSecurityHelp: '研究数据默认仅保存在当前设备。只有在你主动选择并配置云服务后才会同步；密码与令牌不会进入数据库文件、导出备份或云端同步载荷。',
    settingsRoutingEyebrow: '数据去向',
    settingsRoutePrivacy: '密码与令牌只保存在当前设备。',
    settingsLocalEyebrow: '当前存储方式',
    settingsLocalTitle: '仅使用本地缓存',
    settingsLocalHelp: '研究数据保存在当前本地设备（Zotero 数据目录）中，直到你导出备份或选择云端同步。',
    settingsLocalPointAccount: '无需注册同步账号',
    settingsLocalPointSync: '云端手动同步已关闭',
    settingsLocalPointBackup: '仍可随时导出 JSON',
    settingsProviderEyebrow: '服务凭据',
    settingsWebdavHelp: '连接私有 WebDAV 文件夹，用于保存数据库 JSON。',
    settingsCredentialNote: '凭据不会进入导出文件或远程同步数据库。',
    settingsGithubHelp: '将数据库 JSON 保存到私有仓库的指定分支。',
    settingsGithubCredentialNote: '建议使用仅限目标仓库且具有 Contents 权限的令牌。',
    settingsLanguageEyebrow: '界面',
    settingsAssistEyebrow: '浏览器智能识别',
    settingsBackupEyebrow: '数据韧性',
    settingsBackupNote: '每次有效导入前都会保留一个可恢复快照。',
    languageCardTitle: '界面偏好',
    languageLabel: '显示语言',
    languageHelp: '设置整个工作区使用的语言与外观模式。',
    languageAutoSaved: '界面偏好修改后会自动保存。',
    appearanceLabel: '外观模式',
    appearanceSystem: '跟随系统',
    appearanceLight: '浅色',
    appearanceDark: '深色',
    appearanceSaved: '外观偏好已保存。',
    autoCloudSyncLabel: '自动云同步',
    autoCloudSyncHelp: '本地修改保存后，自动同步到已配置完成的云端。',
    autoCloudSyncLocalHelp: '选择 WebDAV 或 GitHub 后可启用自动云同步。',
    detectedSubmissionPrefilled: '已从 {platform} 捕获信息，请逐项核对后再新建项目。',
    captureReviewTitle: '核对捕获的投稿信息',
    captureReviewHelp: '当前尚未保存。请人工核对识别字段，确认后再创建相互关联的项目、稿件和投稿记录。',
    captureConfidence: '识别置信度',
    captureFieldsDetected: '已识别 {count} 项信息',
    captureProjectTitle: '新建项目名称',
    captureProjectPlaceholder: '例如：Nano Letters 投稿—界面极化研究',
    manuscriptIdLabel: '稿件 / 投稿编号',
    capturedStatusLabel: '识别到的流程状态',
    firstAuthorLabel: '第一作者',
    firstAuthorHelp: '将在仪表盘条目中显示，并同步保存到关联稿件。',
    firstAuthorPlaceholder: '例如：陈晓明',
    firstAuthorNotSet: '未填写',
    authorsLabel: '作者',
    abstractLabel: '摘要 / 项目说明',
    keywordsLabel: '关键词',
    revisionDueLabel: '修回截止日期',
    confirmCreateProject: '确认并新建项目',
    captureCreatedToast: '已在人工核对后创建项目、稿件和投稿记录。',
    captureExistingOpenedToast: '该投稿已录入，已打开现有记录以避免重复创建。',
    confidenceHigh: '高',
    confidenceMedium: '中',
    confidenceLow: '需重点核对',
    cloudRoutingTitle: '云端同步',
    webdavTitle: 'WebDAV 凭据',
    githubTitle: 'GitHub 私有仓库同步',
    backupTitle: '数据库备份与导入',
    saveLanguage: '保存语言设置',
    saveMappings: '保存存储映射',
    exportDb: '导出数据库',
    exportDiagnostics: '导出诊断信息',
    importJson: '导入 JSON',
    restoreImportBackup: '恢复导入前备份',
    languageSaved: '语言偏好已保存。',
    databaseExported: '数据库 JSON 已导出！',
    diagnosticsExported: '已导出不含凭据的诊断信息。',
    databaseImported: '数据库 JSON 已成功导入。',
    importBackupRestored: '已恢复到上一次导入操作前的数据库状态。',
    noImportBackup: '当前设备上没有可恢复的导入前备份。',
    restoreImportConfirm: '确定恢复上一次导入前保存的数据库吗？当前未保存的更改将被替换。',
    importFileTooLarge: '所选备份超过 25 MB，未执行读取。',
    invalidBackup: '该文件不是可识别的 ResearchFlow 数据库备份。',
    noUrgentEvents: '暂无紧急审稿或时间线事件。',
    noRecentRecords: '暂无研究动态。',
    noPipelines: '暂无进行中的手稿投稿流水线。',
    eventNameRequired: '事件名称必填。',
    zoteroSync: '导入到 Zotero',
    untitledEvent: '未命名事件',
    untitledManuscript: '未命名手稿',
    untitledProject: '未命名项目',
    targetJournal: '目标期刊',
    typeNoEvent: '无事件',
    eventTypeResearch: '研究',
    eventTypeWriting: '写作',
    eventTypeSubmission: '投稿',
    eventTypeReview: '审稿',
    eventTypeRevision: '修改',
    eventTypePublication: '出版',
    eventTypeSpecial: '特殊',
    statusCompleted: '已完成',
    statusActive: '进行中',
    statusPending: '计划中',
    statusBlocked: '受阻',
    inlineAddTimelineEvent: '添加时间线事件',
    keyEventPreset: '关键事件',
    customEvent: '自定义事件',
    eventNotesShort: '备注',
    cancel: '取消',
    eventPlaceholder: '事件，如 收到 R1 审稿意见',
    noDate: '无日期',
    days: '天',
    dayUnitShort: '天',
    relativeToday: '今天',
    relativeDaysAgo: '{count} 天前',
    relativeInDays: '{count} 天后',
    nodesSaved: '已保存 {count} 个节点',
    expSubmitShort: '实验→投稿',
    keyEventRail: '关键事件轨',
    countingNow: '计时中',
    completedInterval: '已完成区间',
    displayPrepareLabel: '实验 → 投稿',
    displayPrepareCaption: '当前重点：完成投稿前周期。',
    displayAcceptedLabel: '投稿 → 接收',
    displayAcceptedCaption: '已接收手稿显示从投稿到接收的总时长。',
    displayR1Label: 'R1 审稿意见 → 今天',
    displayR1Caption: 'R1 意见已返回；活动窗口现在从第一次决定开始算起。',
    displayReviewLabel: '投稿 → 今天',
    displayReviewCaption: '尚未接收；继续计算投稿后的等待时长。',
    milestoneExperimentStart: '实验开始',
    milestoneExperimentDone: '实验完成',
    milestoneSubmission: '投稿',
    milestoneAcceptance: '接收',
    milestoneR1Comments: 'R1 意见',
    milestoneToday: '今天',
    statePreparing: '准备中',
    stateOnline: '在线',
    stateAccepted: '已接收',
    stateAfterR1: 'R1 之后',
    stateUnderReview: '审稿中',
    stateSubmitted: '已投稿',
    stateNotSubmitted: '未投稿',
    stateSinceR1: '距 R1 {count} 天',
    stateSinceSubmit: '距投稿 {count} 天',
    defaultExperimentsStarted: '实验开始',
    defaultExperimentsCompleted: '实验完成',
    defaultDataOrganization: '数据整理',
    defaultDraftCompleted: '初稿完成',
    defaultManuscriptSubmitted: '手稿已投稿',
    defaultReviewCommentsR1: 'R1 审稿意见',
    defaultR1RevisionSubmitted: 'R1 修改稿已提交',
    defaultReviewCommentsR2: 'R2 审稿意见',
    defaultR2RevisionSubmitted: 'R2 修改稿已提交',
    defaultAccepted: '已接收',
    defaultOnlinePublication: '网络见刊',
    defaultProof: '校样',
    editTimelineEvent: '编辑时间线事件',
    close: '关闭',
    eventName: '事件名称',
    type: '类型',
    status: '状态',
    keyEventMapping: '关键事件映射',
    eventDate: '事件日期',
    eventDateHelp: '时间线事件仅需一个日期：事件发生日。截止日期在投稿编辑器中管理。',
    plannedDate: '计划日期',
    initialSubmissionDate: '首次投稿日期',
    deadlineDate: '截止日期',
    completionDate: '完成日期',
    firstDecisionDate: '首次决定 / R1 日期',
    revisionDueDateLabel: '修改截止日期',
    timelineDateSource: '日期来源',
    doiLabel: 'DOI',
    articlePage: '文章页面',
    doiNotSet: '未设置 DOI',
    trackSubmissionTitle: '跟踪期刊投稿',
    manuscriptPaper: '手稿 / 论文',
    targetJournalInput: '目标期刊',
    articleUrlLabel: '文章 / 期刊 URL',
    articleUrlPlaceholder: 'https://doi.org/10.xxxx/xxxxx',
    trackSubmissionButton: '跟踪投稿',
    manuscriptJournalRequired: '手稿和目标期刊为必填项',
    submissionAddedToast: '新投稿已添加到流水线！',
    dateSourceSubmission: '投稿记录',
    dateSourceTimeline: '时间线节点',
    dateSourceMissing: '未设置',
    planToday: '计划为今天',
    setToday: '设为今天',
    due14: '截止 +14天',
    markActive: '标记为进行中',
    markDoneToday: '今天标记完成',
    clearDates: '清除日期',
    clearDate: '清除日期',
    notes: '备注',
    notesPlaceholder: '决定细节、审稿截止日、系统备注或下一步...',
    delete: '删除',
    saveChanges: '保存更改',
    keyAuto: '自动识别',
    keyExperimentsStarted: '关键：实验开始',
    keyExperimentsDone: '关键：实验完成',
    keyDraftDone: '关键：初稿完成',
    keySubmitted: '关键：已投稿',
    keyR1Comments: '关键：R1 意见',
    keyR1Resubmitted: '关键：R1 已重投',
    keyR2Comments: '关键：R2 意见',
    keyR2Resubmitted: '关键：R2 已重投',
    keyAccepted: '关键：已接收',
    keyOnlinePublished: '关键：网络见刊',
    statusPlannedNotStarted: '计划中 / 未开始',
    statusInProgress: '进行中',
    statusBlockedException: '受阻 / 异常',
    statusOverdue: '已逾期',
    statusDueSoon: '即将到期',
    statusUpcoming: '未来计划',
    specialException: '特殊 / 异常',
    manuscriptNotFound: '未找到手稿记录，正在刷新工作区。',
    manuscriptStatusUpdated: '手稿状态已更新。',
    manuscriptStatusUpdatedTo: '手稿状态已更新为“{status}”。',
    submissionNotFound: '未找到投稿记录。正在刷新仪表盘。',
    eventNotFound: '未找到事件。正在刷新仪表盘。',
    eventAddedToast: '已添加事件“{name}”。',
    eventSavedToast: '已保存事件“{name}”。',
    eventRemovedToast: '已从流水线移除事件',
    confirmDeleteEvent: '确定要删除事件“{name}”吗？',
    confirmUpdateEvent: '此关键事件已存在。是否更新“{name}”而非重复添加？',
    statusRejected: '已拒稿',
    markRejected: '标记为拒稿',
    transferToJournal: '转投新期刊',
    transferSubmissionTitle: '拒稿：转投其他期刊',
    newTargetJournal: '新目标期刊',
    rejectionDate: '拒稿日期',
    rejectionNote: '决定备注',
    transferButton: '创建新投稿',
    rejectedToast: '已标记为拒稿。',
    transferToast: '新的目标期刊投稿已创建。',
    manuscriptsTitle: '手稿看板',
    manuscriptsSubtitle: '跟踪从提纲、写作到投稿和同行评审的全过程。',
    addManuscript: '+ 新建手稿',
    kanbanIdea: '想法与提纲',
    kanbanDrafting: '写作与图件',
    kanbanSubmitted: '已投稿',
    kanbanAccepted: '已接收 / 已发表',
    kanbanShowEmpty: '显示空阶段',
    kanbanHideEmpty: '隐藏空阶段',
    kanbanStageSummary: '4 个阶段中有 {count} 个包含手稿',
    submissionsPageTitle: '投稿与同行评审矩阵',
    submissionsPageSubtitle: '按期刊追踪投稿、审稿、返修与发表，并集中管理回复记录。',
    activeSubmissionsTitle: '进行中的投稿',
    activeSubmissionsHelp: '选择投稿，查看时间线、状态和审稿记录。',
    submissionEmptyDetail: '选择一个投稿；编辑区会在工作流上下文下方打开。',
    journalPortalsTitle: '常用投稿入口',
    journalPortalsHelp: '打开、编辑或添加期刊投稿网址。',
    trackNewSubmissionButton: '+ 跟踪新投稿',
    submissionDetailKicker: '期刊投稿',
    currentStageLabel: '当前阶段',
    trackedSinceLabel: '跟踪始于',
    workflowContextTitle: '工作流上下文',
    workflowNeedsLinking: '需要关联',
    linkManuscript: '关联手稿',
    linkSubmissionTitle: '将投稿关联到手稿',
    linkSubmissionHelp: '请选择此投稿记录所属的手稿。',
    linkSubmissionConfirm: '确认关联',
    linkSubmissionSaved: '投稿已关联到所选手稿。',
    noManuscriptsToLink: '暂无可关联手稿，请先新建手稿。',
    workflowLinkedFlow: '已关联流程',
    workflowManuscriptLabel: '手稿',
    workflowTimelineLabel: '时间线',
    workflowReviewerCommentsLabel: '审稿意见',
    editFields: '编辑字段',
    jumpToEditor: '前往编辑器',
    submissionEntryEditorTitle: '投稿记录编辑器',
    submissionEntryEditorHelp: '在此编辑选中的条目，填写内容会自动保存。',
    linkedManuscriptBadge: '已关联手稿',
    detachedSubmissionBadge: '未关联手稿',
    manuscriptSection: '手稿',
    manuscriptTitleLabel: '手稿题目',
    paperTitlePlaceholder: '论文题目',
    submissionPortalUrl: '投稿入口 URL',
    reviewTimingSection: '审稿时间线',
    publicationSection: '出版信息',
    submissionChecklistSection: '投稿清单',
    peerReviewMatrixSection: '同行评审回复矩阵',
    addComment: '添加审稿意见',
    reviewEditorHelp: '审稿意见和作者回复会在填写时自动保存。',
    autoSavePending: '等待保存',
    autoSaveSaving: '正在保存更改…',
    autoSaveSaved: '所有更改均已自动保存',
    autoSaveInvalid: '请检查当前填写内容',
    autoSaveFailed: '自动保存失败，当前填写内容仍保留在表单中。',
    acceptanceCelebrationEyebrow: '重要里程碑达成',
    acceptanceCelebrationTitle: '文章已接收，恭喜！',
    acceptanceCelebrationBody: '《{title}》跨过了一个重要的科研里程碑。',
    transferRoundHelp: '一步关闭当前轮次并创建下一个目标期刊记录。',
    savedReviewPreviewTitle: '已保存审稿预览',
    savedReviewPreviewHelp: '与投稿记录编辑器自动同步的只读快照。',
    exportTable: '导出表格',
    emptyReviewEditor: '暂未记录审稿意见；在此添加后将自动保存。',
    emptyReviewPreview: '暂无已保存的审稿意见。',
    reviewerCommentLabel: '审稿意见 #{count}',
    reviewerCommentPlaceholder: '粘贴审稿意见...',
    authorResponseLabel: '作者回复',
    authorResponsePlaceholder: '撰写你的专业回复...',
    copy: '复制',
    removeComment: '删除意见',
    checklistLabel: '清单',
    responsesLabel: '回复',
    responseSaved: '回复已保存',
    responsePending: '等待回复',
    noCommentText: '暂未保存意见文本。',
    submissionEditsSaved: '投稿编辑已保存。',
    confirmDeleteSubmission: '确定删除此投稿跟踪？',
    confirmMarkRejected: '确定将此投稿标记为拒稿？',
    deleteSubmissionTitle: '删除投稿跟踪',
    noReviewerCommentsExport: '暂无审稿意见可导出。',
    latexDownloaded: 'LaTeX 模板已下载。',
    currentJournalLabel: '当前期刊',
    transferModalHelp: '这会将当前投稿标记为拒稿，并为下一个期刊创建新的进行中投稿。',
    validPortalUrlOrBlank: '请输入有效的期刊入口 URL，或保持为空。',
    newManuscriptTitleLabel: '新手稿题目',
    createNewManuscriptOption: '+ 创建新手稿...',
    targetJournalPlaceholder: '例如：Advanced Functional Materials',
    rejectionNotePlaceholder: '可选的主编决定、范围不符说明、审稿总结或下一步操作备注...',
    editManuscriptMetadata: '编辑手稿元数据',
    addNewManuscriptTitle: '添加新手稿',
    writingStatus: '写作状态',
    statusIdea: '想法',
    statusOutline: '提纲',
    statusFiguresPrep: '图件准备',
    statusDrafting: '写作中',
    statusInternalReview: '内部评审',
    abstractDraft: '摘要草稿',
    abstractPlaceholder: '撰写手稿摘要草稿...',
    createManuscript: '创建手稿',
    academicCapturePrefilled: '已捕获学术搜索结果，请核对信息后创建手稿。',
    scholarSourcePage: '学术结果 / 文章链接',
    manuscriptTitleRequired: '请填写手稿题目后再继续。',
    academicCaptureChooseTitle: '选择要录入的学术结果',
    academicCaptureChooseHelp: '请选择你要捕获的论文；在核对表单并确认前不会写入数据库。',
    academicCaptureSource: '捕获来源',
    academicCaptureConfidence: '识别置信度',
    academicCaptureDetected: '条结果已识别',
    academicDuplicateConfirm: '检测到相同手稿。是否用当前核对后的信息更新已有记录，避免重复创建？',
    academicDuplicateUpdated: '已更新现有手稿，未创建重复条目。',
    academicCaptureSaved: 'Zotero 手稿已核对并保存。',
    storageRoutingHelp: '选择 ResearchFlow 元数据数据库的存储与同步位置。',
    routeDbLabel: '同步位置',
    optionLocalCache: '无（仅使用本地缓存）',
    optionWebDavDrive: 'WebDAV 网盘（坚果云、Nextcloud）',
    optionGithubRepo: 'GitHub 私有仓库',
    localSyncSummary: '仅本地模式：数据保存在当前设备，云端手动同步已停用。',
    webdavSyncSummary: 'WebDAV 模式：请在下方配置并测试 WebDAV 账户。',
    githubSyncSummary: 'GitHub 模式：请在下方配置并测试私有仓库。',
    webdavUrlLabel: 'WebDAV 服务器基础 URL',
    usernameEmailLabel: '用户名 / 邮箱',
    appPasswordLabel: '应用专用密码',
    testWebdav: '测试 WebDAV 连接',
    githubPatLabel: 'GitHub Personal Access Token（PAT）',
    githubRepoLabel: '仓库名称（所有者/仓库）',
    githubBranchLabel: '分支名称',
    testGithub: '测试 GitHub 仓库',
    backupHelp: '将研究数据库导出为 JSON，或导入并迁移现有的 ResearchFlow JSON 备份。'
  }
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
}

function normalizeThemePreference(value) {
  const normalized = String(value || 'system').trim().toLowerCase();
  return UI_THEME_OPTIONS.has(normalized) ? normalized : 'system';
}

function resolvePreferredLanguage() {
  if (db?.settings?.profile?.language === 'zh' || db?.settings?.profile?.language === 'en') {
    return db.settings.profile.language;
  }
  try {
    const zotero = (typeof Zotero !== 'undefined' ? Zotero : null) || (typeof window !== 'undefined' ? (window.Zotero || window.parent?.Zotero) : null);
    if (zotero?.locale && String(zotero.locale).toLowerCase().startsWith('zh')) return 'zh';
    if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('zh')) return 'zh';
  } catch (_) {}
  return 'en';
}

function applyThemePreference(value) {
  const theme = normalizeThemePreference(value);
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = 'light dark';
    try {
      const parentDoc = window.parent?.document?.documentElement;
      const isDarkParent =
        parentDoc?.classList?.contains('dark') ||
        parentDoc?.getAttribute('data-theme') === 'dark' ||
        parentDoc?.getAttribute('tz-theme') === 'dark' ||
        window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
      if (isDarkParent) {
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.style.colorScheme = 'dark';
      }
    } catch (_) {}
  } else {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
  return theme;
}

function isDarkThemeActive() {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme) return explicitTheme === 'dark';
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function tf(key, vars = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeSubmissionStatus(value) {
  const normalized = normalizeText(value).replace(/[\s-]+/g, '_');
  const aliases = {
    accept: 'accepted',
    accepted: 'accepted',
    online: 'published',
    publication: 'published',
    published: 'published',
    underreview: 'under_review',
    in_review: 'under_review',
    review: 'under_review',
    revise: 'revision',
    revision_required: 'revision',
    resubmit: 'revision',
    reject: 'rejected',
    rejected: 'rejected',
    submit: 'submitted'
  };
  const canonical = aliases[normalized] || normalized;
  return ['submitted', 'under_review', 'revision', 'accepted', 'published', 'rejected'].includes(canonical)
    ? canonical
    : 'submitted';
}

function normalizeSubmissionStatuses(database) {
  let changed = false;
  (database?.submissions || []).forEach((submission) => {
    changed = normalizeWorkflowFields(submission) || changed;
    const canonical = normalizeSubmissionStatus(submission.status);
    if (submission.status !== canonical) {
      submission.status = canonical;
      submission.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  return changed;
}

function normalizeDoi(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

function extractDoiFromText(value) {
  const match = String(value || '').match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? normalizeDoi(match[0].replace(/[.,;)\]]+$/, '')) : '';
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setAllText(selector, value) {
  document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
}

function setPlaceholder(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('placeholder', value);
}

function setTitle(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('title', value);
}

function setOptionText(selector, value, text) {
  const option = document.querySelector(`${selector} option[value="${value}"]`);
  if (option) option.textContent = text;
}

function setTableHeaderText(selector, index, value) {
  const header = document.querySelectorAll(`${selector} th`)[index];
  if (header) header.textContent = value;
}

function setNavText(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  const icon = el.querySelector('svg');
  window.RFUI.setHTML(el, '');
  if (icon) el.appendChild(icon);
  el.appendChild(document.createTextNode(value));
}

function setButtonText(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  const icon = el.querySelector('svg');
  window.RFUI.setHTML(el, '');
  if (icon) el.appendChild(icon);
  el.appendChild(document.createTextNode(value));
}

function setFilterCardTitle(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  window.RFUI.setHTML(el, `${escapeHTML(value)} <span class="filter-tip">${escapeHTML(t('clickToFilter'))}</span>`);
}

function applyLanguage() {
  setNavText('.nav-item[data-view="view-dashboard"]', t('dashboardNav'));
  setNavText('.nav-item[data-view="view-manuscripts"]', t('manuscriptsNav'));
  setNavText('.nav-item[data-view="view-submissions"]', t('submissionsNav'));
  setNavText('.nav-item[data-view="view-settings"]', t('settingsNav'));

  setText('#view-dashboard .view-header h1', t('dashboardTitle'));
  setText('#view-dashboard .view-header .text-muted', t('dashboardSubtitle'));
  setFilterCardTitle('#card-filter-accepted h4', t('acceptedPublished'));
  setFilterCardTitle('#card-filter-active h4', t('activeReview'));
  setFilterCardTitle('#card-filter-all h4', t('totalSubmissions'));
  setAllText('.filter-tip', t('clickToFilter'));
  setText('.pipeline-module-header h3', t('timelineTitle'));
  setText('.pipeline-module-header .text-muted', t('timelineSubtitle'));
  updatePipelineViewToggle();
  setText('#dashboard-filter-label', getDashboardFilterLabel());
  const summaryCards = document.querySelectorAll('.timeline-summary-header .summary-card .label');
  if (summaryCards[0]) summaryCards[0].textContent = t('metricExpSubmit');
  if (summaryCards[1]) summaryCards[1].textContent = t('metricSubmitToday');
  if (summaryCards[2]) summaryCards[2].textContent = t('metricR1Today');
  if (summaryCards[3]) summaryCards[3].textContent = t('metricSubmitAccept');
  const recentHeads = document.querySelectorAll('#view-dashboard .recent-box h3');
  if (recentHeads[0]) recentHeads[0].textContent = t('timelineAlerts');

  setText('#view-manuscripts .view-header h1', t('manuscriptsTitle'));
  setText('#view-manuscripts .view-header .text-muted', t('manuscriptsSubtitle'));
  setButtonText('#btn-add-manuscript', t('addManuscript'));
  setText('.kanban-col[data-status="idea"] .col-header h3', `💡 ${t('kanbanIdea')}`);
  setText('.kanban-col[data-status="drafting"] .col-header h3', `📝 ${t('kanbanDrafting')}`);
  setText('.kanban-col[data-status="submitted"] .col-header h3', `🚀 ${t('kanbanSubmitted')}`);
  setText('.kanban-col[data-status="accepted"] .col-header h3', `🎉 ${t('kanbanAccepted')}`);
  updateKanbanEmptyColumns();

  setText('#view-submissions .view-header h1', t('submissionsPageTitle'));
  setText('#view-submissions .view-header .text-muted', t('submissionsPageSubtitle'));
  setText('.portal-dock-title', t('journalPortalsTitle'));
  setText('#portal-dock-help', t('journalPortalsHelp'));
  setTitle('#btn-add-portal', t('addPortalTitle'));
  setButtonText('#btn-add-submission', t('trackNewSubmissionButton'));
  setText('.submission-list-head h3', t('activeSubmissionsTitle'));
  setText('.submission-list-head .text-muted', t('activeSubmissionsHelp'));
  setText('#submission-search-label', t('submissionSearch'));
  document.getElementById('submission-search')?.setAttribute('placeholder', t('submissionSearchPlaceholder'));
  document.getElementById('submission-search-clear')?.setAttribute('aria-label', t('searchClear'));
  document.getElementById('submission-search-status')?.setAttribute('aria-label', t('searchStatus'));
  for (const [value, key] of [['all', 'searchAll'], ['active', 'searchActive'], ['revision', 'searchRevision'], ['accepted', 'searchAccepted'], ['rejected', 'searchRejected']]) setOptionText('#submission-search-status', value, t(key));
  setText('#submission-search-empty-title', t('searchEmpty'));
  setText('#submission-search-empty-help', t('searchEmptyHelp'));
  setText('#submission-search-reset', t('searchReset'));
  setText('#submission-detail-panel .empty-state h3', t('submissionEmptyDetail'));

  setText('#view-settings .view-header h1', t('settingsTitle'));
  setText('#view-settings .view-header .text-muted', t('settingsSubtitle'));
  document.querySelector('.settings-trust-strip')?.setAttribute('aria-label', t('settingsTrustSummary'));
  setText('#settings-security-title', t('settingsSecurityTitle'));
  setText('#settings-security-help', t('settingsSecurityHelp'));
  setText('#settings-route-privacy-note', t('settingsRoutePrivacy'));
  setText('#settings-local-title', t('settingsLocalTitle'));
  setText('#settings-local-help', t('settingsLocalHelp'));
  setText('#settings-local-point-account', t('settingsLocalPointAccount'));
  setText('#settings-local-point-sync', t('settingsLocalPointSync'));
  setText('#settings-local-point-backup', t('settingsLocalPointBackup'));
  setText('#settings-webdav-help', t('settingsWebdavHelp'));
  setText('#settings-credential-note', t('settingsCredentialNote'));
  setText('#settings-github-help', t('settingsGithubHelp'));
  setText('#settings-github-credential-note', t('settingsGithubCredentialNote'));
  setText('#settings-backup-note', t('settingsBackupNote'));
  setText('#settings-language-card h3', t('languageCardTitle'));
  setText('label[for="ui-language"]', t('languageLabel'));
  setText('label[for="ui-theme"]', t('appearanceLabel'));
  setOptionText('#ui-theme', 'system', t('appearanceSystem'));
  setOptionText('#ui-theme', 'light', t('appearanceLight'));
  setOptionText('#ui-theme', 'dark', t('appearanceDark'));
  setText('#language-help', t('languageHelp'));
  setText('#language-auto-save-status', t('languageAutoSaved'));
  setText('#auto-cloud-sync-label', t('autoCloudSyncLabel'));
  setText('#settings-cloud-card h3', t('cloudRoutingTitle'));
  setText('#settings-webdav-card h3', t('webdavTitle'));
  setText('#settings-github-card h3', t('githubTitle'));
  setText('#settings-backup-card h3', t('backupTitle'));
  setText('#settings-cloud-card .text-muted', t('storageRoutingHelp'));
  setText('label[for="route-db"]', t('routeDbLabel'));
  setOptionText('#route-db', 'local', t('optionLocalCache'));
  setOptionText('#route-db', 'webdav', t('optionWebDavDrive'));
  setOptionText('#route-db', 'github', t('optionGithubRepo'));
  setButtonText('#btn-save-settings', t('saveMappings'));
  setButtonText('#btn-sync-cloud-now', t('forceSync'));
  setText('label[for="webdav-url"]', t('webdavUrlLabel'));
  setText('label[for="webdav-username"]', t('usernameEmailLabel'));
  setText('label[for="webdav-password"]', t('appPasswordLabel'));
  setButtonText('#btn-test-webdav', t('testWebdav'));
  setText('label[for="github-token"]', t('githubPatLabel'));
  setText('label[for="github-repo"]', t('githubRepoLabel'));
  setText('label[for="github-branch"]', t('githubBranchLabel'));
  setButtonText('#btn-test-github', t('testGithub'));
  setText('#settings-backup-card .text-muted', t('backupHelp'));
  setButtonText('#btn-export-db', t('exportDb'));
  setButtonText('#btn-export-diagnostics', t('exportDiagnostics'));
  setButtonText('#btn-trigger-import', t('importJson'));
  setButtonText('#btn-restore-import-backup', t('restoreImportBackup'));
  updateSyncProviderVisibility();
}

async function renderAllViews() {
  submissionAutoSaveCleanup?.();
  const panel = document.getElementById('submission-detail-panel');
  if (panel) { window.RFUI.setHTML(panel, ''); delete panel.dataset.currentSubmissionId; }
  currentLanguage = resolvePreferredLanguage();
  applyThemePreference(db.settings?.profile?.theme || 'system');
  applyLanguage();
  renderDashboard();
  renderKanban();
  renderSubmissions();
  setupZoteroIntegrations();
}

function refreshActiveViewForLanguage() {
  const activeViewId = document.querySelector('.content-view.active')?.id || 'view-dashboard';
  if (activeViewId === 'view-dashboard') renderDashboard();
  if (activeViewId === 'view-manuscripts') renderKanban();
  if (activeViewId === 'view-submissions') renderSubmissions();
  if (activeViewId === 'view-settings') loadSettings().catch(console.error);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Routing
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.content-view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (!db || !canLeaveSubmissionEditor()) return;
      const targetView = item.getAttribute('data-view');
      if (targetView === 'view-settings' && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero
        && !document.documentElement.classList.contains('settings-only')) {
        ZoteroBridge.sendToHost({ type: 'RESEARCHFLOW_OPEN_PREFS' });
        return;
      }
      if (targetView !== 'view-submissions') submissionAutoSaveCleanup?.();

      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetView).classList.add('active');
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;

      // Trigger tab-specific loaders
      if (targetView === 'view-dashboard') renderDashboard();
      if (targetView === 'view-manuscripts') renderKanban();
      if (targetView === 'view-submissions') renderSubmissions();
      if (targetView === 'view-settings') {
        loadSettings().catch(console.error).finally(() => {
          updateSyncProviderVisibility();
        });
      }
    });
  });

  setupSubmissionSearch();

  // Load Database
  try {
    db = await window.storage.loadAll();
  } catch (error) {
    const view = document.getElementById('view-dashboard');
    view.replaceChildren();
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = `无法加载本地数据 / Unable to load local data: ${error.message}`;
    const retry = document.createElement('button');
    retry.className = 'btn-primary';
    retry.textContent = '重新加载 / Retry';
    retry.addEventListener('click', () => location.reload());
    view.append(message, retry);
    return;
  }
  applyThemePreference(db.settings?.profile?.theme || 'system');
  currentLanguage = resolvePreferredLanguage();
  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';

  // Dynamic Database Migration: Translate Chinese nodes to English & filter out '手稿定稿'
  const originalDatabase = structuredClone(db);
  let dbMigrationChanged = false;
  if (db && db.submissions) {
    dbMigrationChanged = normalizeSubmissionStatuses(db) || dbMigrationChanged;
    db.submissions.forEach(sub => {
      if (sub.timelineNodes && sub.timelineNodes.length > 0) {
        const originalLength = sub.timelineNodes.length;
        // Filter out '手稿定稿'
        sub.timelineNodes = sub.timelineNodes.filter(node => {
          const nameTrimmed = (node.name || '').trim();
          return nameTrimmed !== '手稿定稿' && nameTrimmed !== 'Manuscript Finalization';
        });

        const nameMapping = {
          '实验完成': 'Experiments Completed',
          '数据整理': 'Data Organization',
          '初稿完成': 'Draft Completed',
          '投稿': 'Manuscript Submitted',
          '审稿意见 R1': 'Review Comments R1',
          'R1 修回提交': 'R1 Revision Submitted',
          '审稿意见 R2': 'Review Comments R2',
          'R2 修回提交': 'R2 Revision Submitted',
          '接收': 'Accepted',
          'Online': 'Online Publication',
          'Proof': 'Proof'
        };

        sub.timelineNodes.forEach(node => {
          const nameTrimmed = (node.name || '').trim();
          if (nameMapping[nameTrimmed]) {
            node.name = nameMapping[nameTrimmed];
            dbMigrationChanged = true;
          }
        });

        if (sub.timelineNodes.length !== originalLength) {
          dbMigrationChanged = true;
        }
      }
    });

    dbMigrationChanged = clearUnacceptedPublicationLinks(db) || dbMigrationChanged;
    dbMigrationChanged = syncManuscriptStatusesFromSubmissions(db) || dbMigrationChanged;

    db.submissions.forEach(sub => { dbMigrationChanged = normalizeSubmissionTimeline(sub) || dbMigrationChanged; });
    if (dbMigrationChanged) {
      try {
        const backupKey = 'researchflow_pre_workflow_sync_backup';
        const existing = await RFPlatform.storage.local.get([backupKey]);
        if (!existing[backupKey]) await RFPlatform.storage.local.set({ [backupKey]: { createdAt: new Date().toISOString(), database: originalDatabase } });
        db = await window.storage.saveAll(db, { mergeOnConflict: true });
      }
      catch (error) { showGlobalToast(error.message, 'error'); }
    }
  }

  // Set up synchronization alerts/updates
  RFPlatform.runtime.onMessage.addListener((message) => {
    if (message.action === 'DATABASE_UPDATED') {
      applyDatabaseUpdate(message.data);
    }
  });

  // Initial load
  applyLanguage();
  renderDashboard();
  setupSettingsListeners();
  setupSaveErrorListener();
  setupGlobalModalListeners();
  setupJournalPortalListeners();
  setupDashboardFilterListeners();
  if (document.documentElement.classList.contains('settings-only')) {
    views.forEach(view => view.classList.toggle('active', view.id === 'view-settings'));
    await loadSettings();
  }
  // Pipeline View Toggle and Drawer Event Listeners
  initializePipelineViewMode();
  initializeKanbanEmptyColumnsMode();
  const btnToggle = document.getElementById('btn-pipeline-view-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      setPipelineViewMode(!isPipelineExpanded);
    });
  }

  window._researchflowWorkspaceReady = true;
  window.dispatchEvent(new Event('researchflow-workspace-ready'));
});

function initializePipelineViewMode() {
  RFPlatform.storage.local.get(['researchflow_pipeline_expanded'], (result) => {
    setPipelineViewMode(Boolean(result.researchflow_pipeline_expanded), { persist: false });
  });
}

function updateKanbanEmptyColumns() {
  const board = document.querySelector('.kanban-board');
  const button = document.getElementById('btn-toggle-empty-kanban');
  board?.classList.toggle('show-empty-columns', showEmptyKanbanColumns);
  if (button) {
    button.setAttribute('aria-pressed', String(showEmptyKanbanColumns));
    button.textContent = t(showEmptyKanbanColumns ? 'kanbanHideEmpty' : 'kanbanShowEmpty');
  }
}

function initializeKanbanEmptyColumnsMode() {
  const button = document.getElementById('btn-toggle-empty-kanban');
  button?.addEventListener('click', () => {
    showEmptyKanbanColumns = !showEmptyKanbanColumns;
    updateKanbanEmptyColumns();
    RFPlatform.storage.local.set({ researchflow_kanban_show_empty: showEmptyKanbanColumns });
  });
  RFPlatform.storage.local.get(['researchflow_kanban_show_empty'], result => {
    showEmptyKanbanColumns = result?.researchflow_kanban_show_empty === true;
    updateKanbanEmptyColumns();
  });
}

function setPipelineViewMode(expanded, options = {}) {
  isPipelineExpanded = Boolean(expanded);
  const container = document.getElementById('dashboard-gantt');
  if (container) container.classList.toggle('expanded', isPipelineExpanded);
  updatePipelineViewToggle();
  if (options.persist !== false) {
    RFPlatform.storage.local.set({ researchflow_pipeline_expanded: isPipelineExpanded });
  }
}

function updatePipelineViewToggle() {
  const container = document.getElementById('dashboard-gantt');
  if (container) container.classList.toggle('expanded', isPipelineExpanded);

  const label = document.getElementById('pipeline-view-label');
  if (label) label.textContent = isPipelineExpanded ? t('expanded') : t('compact');

  const icon = document.getElementById('pipeline-view-icon');
  if (icon) icon.textContent = isPipelineExpanded ? '▦' : '▤';

  const button = document.getElementById('btn-pipeline-view-toggle');
  if (button) {
    button.classList.toggle('active', isPipelineExpanded);
    button.setAttribute('aria-pressed', String(isPipelineExpanded));
  }
}

function buildDefaultSubmissionTimeline(submission) {
  const stamp = Date.now();
  const definitions = [
    ['Experiments Started', 'research', 'completed'],
    ['Experiments Completed', 'research', 'completed'],
    ['Data Organization', 'research', 'completed'],
    ['Draft Completed', 'writing', 'completed'],
    ['Manuscript Submitted', 'submission', 'active'],
    ['Review Comments R1', 'review', 'pending'],
    ['R1 Revision Submitted', 'revision', 'pending'],
    ['Accepted', 'publication', 'pending'],
    ['Online Publication', 'publication', 'pending']
  ];
  return definitions.map(([name, type, status], index) => ({
    id: `node_${index + 1}_${submission.id}_${stamp}`,
    name,
    type,
    planDate: '',
    completeDate: '',
    dueDate: '',
    status,
    notes: ''
  }));
}

function getSubmissionShareEvents(submission, startMode = 'experiment') {
  const events = autoSortNodes(submission.timelineNodes || [])
    .map(node => ({
      name: getTimelineNodeDisplayName(node),
      date: getNodeDate(node),
      type: node.type || 'special',
      status: computeNodeStatus(node),
      completed: Boolean(node.completeDate),
      due: !node.completeDate && !node.planDate && Boolean(node.dueDate),
      key: inferKey(node)
    }))
    .filter(event => event.date && Number.isFinite(new Date(event.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!events.length) return events;
  const analysis = analyzeSubmission(submission);
  const submissionStart = analysis.submitDate;
  const experimentStart = analysis.experimentStartDate
    || events.find(event => event.key === 'experiment_start')?.date
    || events.find(event => event.type === 'research')?.date
    || events[0].date;
  const anchor = startMode === 'submission' ? (submissionStart || events[0].date) : experimentStart;
  return events.filter(event => new Date(event.date) >= new Date(anchor));
}

function normalizeShareVisibility(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const size = ['portrait', 'story', 'auto'].includes(value.size) ? value.size : 'portrait';
  const timelineStart = value.timelineStart === 'submission' ? 'submission' : 'experiment';
  return {
    title: value.title !== false,
    journal: value.journal !== false,
    author: value.author !== false,
    status: value.status !== false,
    duration: value.duration !== false,
    dates: value.dates !== false,
    footer: value.footer !== false,
    brandSize: ['compact', 'balanced', 'bold'].includes(value.brandSize) ? value.brandSize : 'balanced',
    resolution: [1, 2, 3].includes(Number(value.resolution)) ? Number(value.resolution) : 2,
    appearance: ['paper', 'ink', 'blueprint', 'minimal', 'cyber', 'aurora', 'terminal', 'journal', 'conference', 'archive', 'estuary', 'iris', 'amber'].includes(value.appearance) ? value.appearance : 'paper',
    size,
    timelineStart
  };
}

function createSubmissionShareCanvas(submission, visibility = {}) {
  const visible = normalizeShareVisibility(visibility);
  const snapshot = structuredClone(submission);
  const manuscript = db?.manuscripts?.find(item => item.id === submission.manuscriptId);
  const title = manuscript?.title || submission.title || t('untitledManuscript');
  const analysis = analyzeSubmission(snapshot);
  const events = getSubmissionShareEvents(snapshot, visible.timelineStart);
  const zh = currentLanguage === 'zh';
  const start = visible.timelineStart === 'submission'
    ? analysis.submitDate
    : analysis.experimentStartDate || events.find(event => event.type === 'research')?.date || events[0]?.date;
  const status = normalizeSubmissionStatus(submission.status);
  const end = analysis.accepted ? analysis.acceptDate || analysis.onlineDate
    : status === 'rejected' ? submission.rejectedAt || submission.decisionDate : todayString();
  const duration = start && end && new Date(start) <= new Date(end) ? getDaysDiff(start, end) : null;
  const startLabel = visible.timelineStart === 'submission' ? (zh ? '投稿' : 'submission') : (zh ? '首个记录节点' : 'first recorded milestone');
  const endLabel = analysis.accepted ? (zh ? '接收 / 发表' : 'acceptance / publication') : status === 'rejected' ? (zh ? '决定日期' : 'decision') : (zh ? '今天' : 'today');
  const typeLabels = zh
    ? { research: '研究', writing: '写作', submission: '投稿', review: '审稿', revision: '修回', publication: '出版', special: '节点' }
    : { research: 'Research', writing: 'Writing', submission: 'Submission', review: 'Review', revision: 'Revision', publication: 'Publication', special: 'Milestone' };
  const model = {
    language: currentLanguage,
    title,
    journal: getSubmissionJournalName(submission),
    author: getSubmissionFirstAuthor(submission, manuscript),
    status: getSubmissionStatusLabel(submission.status),
    duration,
    durationLabel: zh ? `从${startLabel}至${endLabel}` : `From ${startLabel} to ${endLabel}`,
    events: events.map(event => {
      const parsed = new Date(event.date);
      return {
        name: event.name,
        completed: event.completed,
        typeLabel: typeLabels[event.type] || typeLabels.special,
        dateKindLabel: event.completed ? (zh ? '已记录' : 'Recorded') : event.due ? (zh ? '截止日期' : 'Due date') : (zh ? '计划日期' : 'Planned'),
        dateLabel: new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).format(parsed),
        yearLabel: String(parsed.getUTCFullYear())
      };
    })
  };
  const result = window.RFShareCard.render(model, visible);
  // Hidden manuscript titles must not leak through filenames or native share text.
  return { ...result, title: visible.title ? title : (zh ? '投稿历程' : 'Submission journey') };
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png', 0.96);
  });
}

function safeShareFileName(title) {
  const base = String(title || 'submission-journey')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 72);
  return `${base || 'submission'}${/journey$/i.test(base) ? '' : '-journey'}.png`;
}

function downloadShareBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openSubmissionSharePreview(submissionId, triggerButton) {
  const submission = db.submissions.find(item => item.id === submissionId);
  if (!submission) return;
  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.setAttribute('aria-busy', 'true');
  }

  try {
    await sharePreferenceWrites.catch(() => {});
    const stored = await RFPlatform.storage.local.get([SHARE_PREFS_STORAGE_KEY]);
    let visibility = normalizeShareVisibility(stored?.[SHARE_PREFS_STORAGE_KEY]);
    let currentBlob = null;
    let currentFileName = '';
    let currentTitle = '';
    let previewRenderId = 0;
    const fields = [
      ['title', 'shareFieldTitle'],
      ['journal', 'shareFieldJournal'],
      ['author', 'shareFieldAuthor'],
      ['status', 'shareFieldStatus'],
      ['duration', 'shareFieldDuration'],
      ['dates', 'shareFieldDates'],
      ['footer', 'shareFieldFooter']
    ];
    const visibilityControls = fields.map(([key, labelKey]) => `
      <label class="share-visibility-chip">
        <input type="checkbox" data-share-field="${key}" ${visibility[key] ? 'checked' : ''}>
        <span class="share-visibility-check" aria-hidden="true">✓</span>
        <span>${escapeHTML(t(labelKey))}</span>
      </label>
    `).join('');
    const styleGallery = window.RFShareCard.getAppearances().map(style => {
      const name = t(`share${style.id[0].toUpperCase()}${style.id.slice(1)}`);
      const background = style.paperGradient ? `linear-gradient(135deg, ${style.paperGradient.join(', ')})` : style.paper;
      return `<button type="button" class="share-style-tile" data-share-style="${style.id}" aria-pressed="${visibility.appearance === style.id}" title="${escapeHTML(name)}"><span class="share-style-sample" aria-hidden="true" style="--sample-bg:${background};--sample-ink:${style.ink};--sample-accent:${style.accent}"><i></i><b>Aa</b><em></em></span><span>${escapeHTML(name.split(' · ')[0])}</span></button>`;
    }).join('');

    openModal(`
      <div class="share-preview-shell">
        <div class="share-preview-header">
          <div>
            <span class="share-preview-kicker">ResearchFlow / Share Studio</span>
            <h2>${escapeHTML(t('shareJourneyTitle'))}</h2>
            <p>${escapeHTML(t('shareJourneyHelp'))}</p>
          </div>
          <button class="btn-icon share-preview-close" id="btn-close-modal" type="button" aria-label="${escapeHTML(t('close'))}">×</button>
        </div>
        <div class="share-preview-workbench">
          <aside class="share-visibility-panel" aria-label="${escapeHTML(t('shareVisibilityTitle'))}">
            <div class="share-visibility-heading">
              <strong>${escapeHTML(t('shareVisibilityTitle'))}</strong>
              <small>${escapeHTML(t('shareVisibilityHelp'))}</small>
            </div>
            <label class="share-size-control" for="share-appearance"><span>${escapeHTML(t('shareAppearance'))}</span><select id="share-appearance"><option value="paper" ${visibility.appearance === 'paper' ? 'selected' : ''}>${escapeHTML(t('sharePaper'))}</option><option value="ink" ${visibility.appearance === 'ink' ? 'selected' : ''}>${escapeHTML(t('shareInk'))}</option><option value="blueprint" ${visibility.appearance === 'blueprint' ? 'selected' : ''}>${escapeHTML(t('shareBlueprint'))}</option><option value="minimal" ${visibility.appearance === 'minimal' ? 'selected' : ''}>${escapeHTML(t('shareMinimal'))}</option><option value="cyber" ${visibility.appearance === 'cyber' ? 'selected' : ''}>${escapeHTML(t('shareCyber'))}</option><option value="aurora" ${visibility.appearance === 'aurora' ? 'selected' : ''}>${escapeHTML(t('shareAurora'))}</option><option value="terminal" ${visibility.appearance === 'terminal' ? 'selected' : ''}>${escapeHTML(t('shareTerminal'))}</option><option value="journal" ${visibility.appearance === 'journal' ? 'selected' : ''}>${escapeHTML(t('shareJournal'))}</option><option value="conference" ${visibility.appearance === 'conference' ? 'selected' : ''}>${escapeHTML(t('shareConference'))}</option><option value="archive" ${visibility.appearance === 'archive' ? 'selected' : ''}>${escapeHTML(t('shareArchive'))}</option><option value="estuary" ${visibility.appearance === 'estuary' ? 'selected' : ''}>${escapeHTML(t('shareEstuary'))}</option><option value="iris" ${visibility.appearance === 'iris' ? 'selected' : ''}>${escapeHTML(t('shareIris'))}</option><option value="amber" ${visibility.appearance === 'amber' ? 'selected' : ''}>${escapeHTML(t('shareAmber'))}</option></select></label>
            <details class="share-style-browser" open><summary>${escapeHTML(t('shareGallery'))}</summary><div class="share-style-gallery" role="group" aria-label="${escapeHTML(t('shareAppearance'))}">${styleGallery}</div></details>
            <div class="share-visibility-list">${visibilityControls}</div>
            <label class="share-size-control" for="share-brand-size"><span>${escapeHTML(t('shareBrandSize'))}</span><select id="share-brand-size" ${visibility.footer ? '' : 'disabled'}>${['compact','balanced','bold'].map(key => `<option value="${key}" ${visibility.brandSize === key ? 'selected' : ''}>${escapeHTML(t(`shareBrand${key[0].toUpperCase()}${key.slice(1)}`))}</option>`).join('')}</select></label>
            <div class="share-timeline-start-control">
              <span>${escapeHTML(t('shareTimelineStart'))}</span>
              <div class="share-timeline-start-options" role="group" aria-label="${escapeHTML(t('shareTimelineStart'))}">
                <label><input type="radio" name="share-timeline-start" value="experiment" ${visibility.timelineStart === 'experiment' ? 'checked' : ''}><span>${escapeHTML(t('shareTimelineStartExperiment'))}</span></label>
                <label><input type="radio" name="share-timeline-start" value="submission" ${visibility.timelineStart === 'submission' ? 'checked' : ''}><span>${escapeHTML(t('shareTimelineStartSubmission'))}</span></label>
              </div>
            </div>
            <label class="share-size-control" for="share-image-size">
              <span>${escapeHTML(t('shareSizeTitle'))}</span>
              <select id="share-image-size">
                <option value="portrait" ${visibility.size === 'portrait' ? 'selected' : ''}>${escapeHTML(t('shareSizePortrait'))}</option>
                <option value="story" ${visibility.size === 'story' ? 'selected' : ''}>${escapeHTML(t('shareSizeStory'))}</option>
                <option value="auto" ${visibility.size === 'auto' ? 'selected' : ''}>${escapeHTML(t('shareSizeAuto'))}</option>
              </select>
            </label>
            <label class="share-size-control" for="share-resolution"><span>${escapeHTML(t('shareResolution'))}</span><select id="share-resolution">${[[1,'shareResolutionStandard'],[2,'shareResolutionHigh'],[3,'shareResolutionUltra']].map(([value,key]) => `<option value="${value}" ${visibility.resolution === value ? 'selected' : ''}>${escapeHTML(t(key))}</option>`).join('')}</select></label>
            <button type="button" class="btn-secondary share-design-reset" id="btn-share-reset" title="${escapeHTML(t('shareStyleResetHelp'))}">${escapeHTML(t('shareStyleReset'))}</button>
            <small class="share-reset-help">${escapeHTML(t('shareStyleResetHelp'))}</small>
          </aside>
          <div class="share-preview-frame" data-render-state="idle" aria-live="polite">
            <div class="share-preview-loading" data-share-loading>${escapeHTML(t('shareRendering'))}</div>
            <div class="share-preview-error" data-share-error hidden role="alert"><p>${escapeHTML(t('sharePreviewError'))}</p><button type="button" class="btn-secondary" id="btn-share-retry">${escapeHTML(t('shareRetry'))}</button></div>
            <img alt="${escapeHTML(t('shareJourneyTitle'))}">
          </div>
        </div>
        <div class="share-preview-actions">
          <span class="share-local-note" id="share-output-details" role="status">${escapeHTML(t('shareJourneyHelp'))}</span>
          <button class="btn-secondary" id="btn-share-zoom" type="button" aria-pressed="false">${escapeHTML(t('shareZoom'))}</button>
          <button class="btn-primary" id="btn-share-system" type="button">${escapeHTML(t('shareJourneySystem'))}</button>
          <button class="btn-secondary" id="btn-share-download" type="button">${escapeHTML(t('shareJourneyDownload'))}</button>
          <button class="btn-secondary" id="btn-share-copy" type="button">${escapeHTML(t('shareJourneyCopy'))}</button>
        </div>
      </div>
    `);

    const image = modalContent.querySelector('.share-preview-frame img');
    const previewFrame = modalContent.querySelector('.share-preview-frame');
    const loading = modalContent.querySelector('[data-share-loading]');
    const errorPanel = modalContent.querySelector('[data-share-error]');
    document.getElementById('btn-share-zoom').addEventListener('click', event => {
      const zoomed = previewFrame.classList.toggle('is-zoomed');
      event.currentTarget.setAttribute('aria-pressed', String(zoomed));
      event.currentTarget.textContent = t(zoomed ? 'shareFit' : 'shareZoom');
      previewFrame.scrollTo({ top: 0, left: 0 });
    });
    let closed = false;
    let renderTimer = null;
    const pendingUrls = new Set();
    const actionButtons = modalContent.querySelectorAll('#btn-share-system, #btn-share-download, #btn-share-copy');
    const setBusy = () => {
      currentBlob = null;
      actionButtons.forEach(button => { button.disabled = true; });
      previewFrame.dataset.renderState = 'rendering';
      previewFrame.setAttribute('aria-busy', 'true');
      loading.hidden = false;
      document.getElementById('share-output-details').textContent = t('shareRendering');
      errorPanel.hidden = true;
      image.hidden = true;
      image.classList.add('is-rendering');
    };
    activeSharePreviewCleanup = () => {
      closed = true;
      previewRenderId += 1;
      clearTimeout(renderTimer);
      currentBlob = null;
      pendingUrls.forEach(url => URL.revokeObjectURL(url));
      pendingUrls.clear();
      activeSharePreviewCleanup = null;
    };
    const renderPreviewSafe = async (renderId) => {
      let nextUrl = '';
      try {
        if (closed || renderId !== previewRenderId) return;
        const chosen = { ...visibility };
        const { canvas, title, layout, resolutionLimited } = createSubmissionShareCanvas(submission, chosen);
        const exportWidth = canvas.width, exportHeight = canvas.height;
        let blob;
        try { blob = await canvasToPngBlob(canvas); }
        finally { canvas.width = canvas.height = 1; }
        if (closed || renderId !== previewRenderId) return;
        nextUrl = URL.createObjectURL(blob);
        pendingUrls.add(nextUrl);
        const decoded = new Image();
        decoded.src = nextUrl;
        await decoded.decode();
        if (closed || renderId !== previewRenderId) return;
        const previousUrl = activeSharePreviewUrl;
        image.src = nextUrl;
        await image.decode();
        if (closed || renderId !== previewRenderId) return;
        activeSharePreviewUrl = nextUrl;
        pendingUrls.delete(nextUrl);
        currentBlob = blob;
        currentTitle = title;
        currentFileName = safeShareFileName(title);
        previewFrame.dataset.shareSize = chosen.size;
        previewFrame.dataset.appearance = chosen.appearance;
        previewFrame.dataset.renderState = 'ready';
        previewFrame.setAttribute('aria-busy', 'false');
        image.classList.remove('is-rendering');
        image.hidden = false;
        loading.hidden = true;
        actionButtons.forEach(button => { button.disabled = false; });
        document.getElementById('share-output-details').textContent = `${exportWidth} × ${exportHeight} · PNG · ${Math.ceil(blob.size / 1024)} KB${resolutionLimited ? ` · ${t('shareResolutionLimited')}` : ''}${layout.omitted ? ` · ${t('shareOmitted').replace('{count}', layout.omitted)}` : ''}`;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch (error) {
        if (closed || renderId !== previewRenderId) return;
        loading.hidden = true;
        errorPanel.hidden = false;
        image.hidden = true;
        image.classList.remove('is-rendering');
        previewFrame.dataset.renderState = 'error';
        previewFrame.setAttribute('aria-busy', 'false');
        document.getElementById('share-output-details').textContent = t('shareJourneyFailed');
      } finally {
        if (nextUrl && pendingUrls.has(nextUrl)) {
          URL.revokeObjectURL(nextUrl);
          pendingUrls.delete(nextUrl);
        }
      }
    };
    const updatePreview = patch => {
      visibility = normalizeShareVisibility({ ...visibility, ...patch });
      const snapshot = { ...visibility };
      sharePreferenceWrites = sharePreferenceWrites.catch(() => {}).then(() => RFPlatform.storage.local.set({ [SHARE_PREFS_STORAGE_KEY]: snapshot }));
      sharePreferenceWrites.catch(() => { if (!closed) showGlobalToast(t('sharePrefsFailed'), 'warning'); });
      modalContent.querySelectorAll('[data-share-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.shareStyle === visibility.appearance)));
      document.getElementById('share-appearance').value = visibility.appearance;
      document.getElementById('share-brand-size').value = visibility.brandSize;
      document.getElementById('share-brand-size').disabled = !visibility.footer;
      document.getElementById('share-resolution').value = String(visibility.resolution);
      document.getElementById('share-image-size').value = visibility.size;
      // Invalidate the downloadable image synchronously before the first async yield.
      const renderId = ++previewRenderId;
      setBusy();
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => renderPreviewSafe(renderId), 80);
    };
    modalContent.querySelectorAll('[data-share-field]').forEach(control => {
      control.addEventListener('change', () => updatePreview({ [control.dataset.shareField]: control.checked }));
    });
    modalContent.querySelectorAll('input[name="share-timeline-start"]').forEach(control => {
      control.addEventListener('change', () => updatePreview({ timelineStart: control.value }));
    });
    document.getElementById('share-image-size')?.addEventListener('change', event => updatePreview({ size: event.target.value }));
    document.getElementById('share-appearance')?.addEventListener('change', event => updatePreview({ appearance: event.target.value }));
    modalContent.querySelectorAll('[data-share-style]').forEach(button => button.addEventListener('click', () => updatePreview({ appearance: button.dataset.shareStyle })));
    document.getElementById('share-brand-size').addEventListener('change', event => updatePreview({ brandSize: event.target.value }));
    document.getElementById('share-resolution').addEventListener('change', event => updatePreview({ resolution: event.target.value }));
    document.getElementById('btn-share-reset').addEventListener('click', () => updatePreview({ appearance: 'paper', size: 'portrait', brandSize: 'balanced', resolution: 2 }));
    document.getElementById('btn-share-retry').addEventListener('click', () => { setBusy(); renderPreviewSafe(++previewRenderId); });
    setBusy();
    await renderPreviewSafe(++previewRenderId);
    if (closed) return;

    const systemButton = document.getElementById('btn-share-system');
    const canSystemShare = Boolean(navigator.share && navigator.canShare);
    if (!canSystemShare) systemButton.hidden = true;
    systemButton?.addEventListener('click', async () => {
      if (!currentBlob) return;
      const file = new File([currentBlob], currentFileName, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) {
        showGlobalToast(t('shareJourneyUnsupported'), 'warning');
        return;
      }
      try {
        await navigator.share({ files: [file], title: t('shareJourneyTitle'), text: currentTitle });
      } catch (error) {
        if (error?.name !== 'AbortError') showGlobalToast(t('shareJourneyUnsupported'), 'warning');
      }
    });
    document.getElementById('btn-share-download')?.addEventListener('click', () => {
      if (!currentBlob) return;
      downloadShareBlob(currentBlob, currentFileName);
      showGlobalToast(t('shareJourneyDownloaded'), 'success');
    });
    const copyButton = document.getElementById('btn-share-copy');
    const canCopyImage = Boolean(window.ClipboardItem && navigator.clipboard?.write);
    if (!canCopyImage) copyButton.hidden = true;
    copyButton?.addEventListener('click', async () => {
      if (!currentBlob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentBlob })]);
        showGlobalToast(t('shareJourneyCopied'), 'success');
      } catch {
        downloadShareBlob(currentBlob, currentFileName);
        showGlobalToast(t('shareJourneyDownloaded'), 'success');
      }
    });
  } catch (error) {
    console.error(error);
    showGlobalToast(t('shareJourneyFailed'), 'error');
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.removeAttribute('aria-busy');
    }
  }
}

// --- DASHBOARD Lifecycle Filters ---
function setupDashboardFilterListeners() {
  const cardAccepted = document.getElementById('card-filter-accepted');
  const cardActive = document.getElementById('card-filter-active');
  const cardAll = document.getElementById('card-filter-all');

  if (!cardAccepted || !cardActive || !cardAll) return;

  const clearActiveClasses = () => {
    [cardAccepted, cardActive, cardAll].forEach(card => {
      card.classList.remove('active');
      card.setAttribute('aria-pressed', 'false');
    });
  };

  cardAccepted.addEventListener('click', () => {
    currentDashboardFilter = 'accepted';
    clearActiveClasses();
    cardAccepted.classList.add('active');
    cardAccepted.setAttribute('aria-pressed', 'true');
    renderDashboard();
  });

  cardActive.addEventListener('click', () => {
    currentDashboardFilter = 'active';
    clearActiveClasses();
    cardActive.classList.add('active');
    cardActive.setAttribute('aria-pressed', 'true');
    renderDashboard();
  });

  cardAll.addEventListener('click', () => {
    currentDashboardFilter = 'all';
    clearActiveClasses();
    cardAll.classList.add('active');
    cardAll.setAttribute('aria-pressed', 'true');
    renderDashboard();
  });
}


// A failed local write still needs a visible error after removing the unused
// sidebar sync card.
function setupSaveErrorListener() {
  window.addEventListener('researchflow-save-state', event => {
    const { state, error } = event.detail;
    if (state === 'error') showGlobalToast(error || '保存失败，请重试', 'error');
  });
}

// --- MANUSCRIPT KEY EVENT RAIL UTILITIES (gemini-code-1779592757736) ---
const typeMeta = {
  research: { color: "#2563eb", labelKey: "eventTypeResearch" },
  writing: { color: "#7c3aed", labelKey: "eventTypeWriting" },
  submission: { color: "#f97316", labelKey: "eventTypeSubmission" },
  review: { color: "#f97316", labelKey: "eventTypeReview" },
  revision: { color: "#dc2626", labelKey: "eventTypeRevision" },
  rejection: { color: "#b91c1c", labelKey: "statusRejected" },
  publication: { color: "#16a34a", labelKey: "eventTypePublication" },
  special: { color: "#64748b", labelKey: "eventTypeSpecial" }
};

function getTimelineTypeMeta(type) {
  const meta = typeMeta[type] || typeMeta.special;
  return { ...meta, label: t(meta.labelKey || 'eventTypeSpecial') };
}

const defaultTimelineNameKeys = {
  'Experiments Started': 'defaultExperimentsStarted',
  '实验开始': 'defaultExperimentsStarted',
  'Experiments Completed': 'defaultExperimentsCompleted',
  '实验完成': 'defaultExperimentsCompleted',
  'Data Organization': 'defaultDataOrganization',
  '数据整理': 'defaultDataOrganization',
  'Draft Completed': 'defaultDraftCompleted',
  '初稿完成': 'defaultDraftCompleted',
  'Manuscript Submitted': 'defaultManuscriptSubmitted',
  '手稿已投稿': 'defaultManuscriptSubmitted',
  'Review Comments R1': 'defaultReviewCommentsR1',
  '收到 R1 审稿意见': 'defaultReviewCommentsR1',
  'R1 Revision Submitted': 'defaultR1RevisionSubmitted',
  'R1 修回已提交': 'defaultR1RevisionSubmitted',
  'Review Comments R2': 'defaultReviewCommentsR2',
  '收到 R2 审稿意见': 'defaultReviewCommentsR2',
  'R2 Revision Submitted': 'defaultR2RevisionSubmitted',
  'R2 修回已提交': 'defaultR2RevisionSubmitted',
  'Accepted': 'defaultAccepted',
  '已接收': 'defaultAccepted',
  'Online Publication': 'defaultOnlinePublication',
  '上线发表': 'defaultOnlinePublication',
  'Proof': 'defaultProof',
  '校样': 'defaultProof'
};

function getTimelineNodeDisplayName(node) {
  const rawName = (node?.name || '').trim();
  if (!rawName) return t('untitledEvent');
  const defaultKey = defaultTimelineNameKeys[rawName];
  return defaultKey ? t(defaultKey) : rawName;
}

function getDaysDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1) || isNaN(d2)) return null;

  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.max(0, Math.round((utc2 - utc1) / 86400000));
}

function getRelativeDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const today = new Date();
  const utcDate = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((utcToday - utcDate) / 86400000);

  if (diff === 0) return t('relativeToday');
  if (diff > 0) return tf('relativeDaysAgo', { count: diff });
  return tf('relativeInDays', { count: Math.abs(diff) });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateString(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(value) {
  const normalized = normalizeDateString(value);
  return normalized ? `${normalized}T12:00:00.000Z` : null;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeLatex(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%#_{}])/g, '\\$1')
    .replace(/\$/g, '\\$')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\n/g, '\\\\ ');
}

function getNodeDate(node) {
  return node?.completeDate || node?.planDate || node?.dueDate || '';
}

function getLatestTimelineNode(nodes = []) {
  const datedNodes = nodes
    .filter(getNodeDate)
    .sort((a, b) => new Date(getNodeDate(b)) - new Date(getNodeDate(a)));

  if (datedNodes.length) return datedNodes[0];

  return [...nodes].reverse().find(node =>
    node.status === 'active' ||
    node.status === 'completed' ||
    node.status === 'blocked' ||
    node.status === 'danger'
  ) || nodes[0] || null;
}

function createTimelineNode(subId, values = {}) {
  const now = new Date().toISOString();
  return {
    id: `node_${subId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: (values.name || t('untitledEvent')).trim(),
    type: values.type || 'research',
    key: values.key || 'auto',
    status: values.status || 'pending',
    planDate: values.planDate || '',
    dueDate: values.dueDate || '',
    completeDate: values.completeDate || '',
    notes: values.notes || '',
    createdAt: now,
    updatedAt: now
  };
}

function buildTimelineEventManager(sub, options = {}) {
  const nodes = autoSortNodes(sub.timelineNodes || []);
  if (!nodes.length) return '';
  const inModal = options.inModal === true;

  const items = nodes.map(node => {
    const computedStatus = computeNodeStatus(node);
    const meta = getTimelineTypeMeta(node.type);
    const date = getNodeDate(node);
    return `
      <div class="timeline-event-chip ${inModal ? 'modal-event-chip' : ''}" data-node-id="${escapeHTML(node.id)}" style="--event-color:${meta.color}">
        <button class="timeline-event-main btn-event-edit" type="button" data-sub-id="${escapeHTML(sub.id)}" data-node-id="${escapeHTML(node.id)}" title="${escapeHTML(t('clickEditEvent'))}">
          <span class="timeline-event-dot"></span>
          <span class="timeline-event-text">
            <strong>${escapeHTML(getTimelineNodeDisplayName(node))}</strong>
            <small>${date ? escapeHTML(formatShortDate(date)) : t('noDate')} · ${escapeHTML(getNodeStatusLabel(computedStatus))}</small>
          </span>
        </button>
        <button class="timeline-event-delete btn-event-delete" type="button" data-sub-id="${escapeHTML(sub.id)}" data-node-id="${escapeHTML(node.id)}" title="${escapeHTML(t('delete'))}">×</button>
      </div>
    `;
  }).join('');

  return `
    <div class="timeline-event-manager ${inModal ? 'modal-event-manager' : ''}">
      <div class="timeline-event-manager-head">${t('timelineEvents')}</div>
      <div class="timeline-event-list">${items}</div>
    </div>
  `;
}

function openTimelineEventManager(subId) {
  const sub = db.submissions.find(s => s.id === subId);
  if (!sub) {
    showGlobalToast(t('submissionNotFound'), 'error');
    return;
  }

  openModal(`
    <div class="modal-header">
      <h2>${t('timelineEvents')}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal" title="${escapeHTML(t('close'))}">✕</button>
    </div>
    ${buildTimelineEventManager(sub, { inModal: true }) || `<p class="empty-state">${t('noEventYet')}</p>`}
    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-footer-close-events">${escapeHTML(t('close') || '关闭')}</button>
    </div>
  `);

  document.getElementById('btn-footer-close-events')?.addEventListener('click', closeModal);

  modalContent.querySelectorAll('.btn-event-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal();
      openStageDrawer(btn.getAttribute('data-sub-id'), btn.getAttribute('data-node-id'));
    });
  });

  modalContent.querySelectorAll('.btn-event-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const latestSub = db.submissions.find(s => s.id === btn.getAttribute('data-sub-id'));
      const nodeId = btn.getAttribute('data-node-id');
      const node = latestSub?.timelineNodes?.find(n => n.id === nodeId);
      if (!latestSub || !node) {
        showGlobalToast(t('eventNotFound'), 'error');
        closeModal();
        renderDashboard();
        return;
      }
      if (!confirm(tf('confirmDeleteEvent', { name: getTimelineNodeDisplayName(node) }))) return;
      deleteTimelineNode(latestSub, nodeId);
      syncManuscriptStatusFromSubmission(latestSub);
      await window.storage.saveAll(db);
      closeModal();
      renderDashboard();
      renderKanban();
      renderSubmissions();
      showGlobalToast(t('eventRemovedToast'), 'success');
    });
  });
}

function deleteTimelineNode(sub, nodeId) {
  if (!sub || !Array.isArray(sub.timelineNodes)) return null;
  const node = sub.timelineNodes.find(n => n.id === nodeId);
  if (!node) return null;
  const key = inferKey(node);

  sub.timelineNodes = sub.timelineNodes.filter(n => n.id !== nodeId);

  if (key === 'submit') {
    sub.submissionDate = null;
    if (sub.status === 'submitted') sub.status = 'under_review';
  } else if (key === 'r1_comments') {
    sub.firstDecisionDate = null;
    sub.revisionDueDate = null;
    if (sub.status === 'revision') sub.status = 'under_review';
  } else if (key === 'accept' || key === 'online') {
    sub.decisionDate = null;
    sub.acceptedAt = null;
    sub.publishedAt = null;
    if (sub.status === 'accepted' || sub.status === 'published') {
      sub.status = getTimelineNodeByKey(sub, 'r1_comments') ? 'revision' : 'under_review';
    }
    clearPublicationLinkFields(sub);
    clearPublicationTimelineCompletion(sub);
  } else if (key === 'rejected') {
    sub.rejectedAt = null;
    sub.rejectionNote = '';
    if (sub.status === 'rejected') {
      sub.status = getTimelineNodeByKey(sub, 'r1_comments') ? 'revision' : 'under_review';
    }
  }

  sub.updatedAt = new Date().toISOString();
  return node;
}

function buildOptions(options, selectedValue) {
  return options.map(option => {
    const value = typeof option === 'string' ? option : option.value;
    const label = typeof option === 'string' ? option : option.label;
    return `<option value="${escapeHTML(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHTML(label)}</option>`;
  }).join('');
}

function getInlineEventPresets() {
  return [
    { key: 'submit', label: t('defaultManuscriptSubmitted'), name: 'Manuscript Submitted', type: 'submission' },
    { key: 'r1_comments', label: t('defaultReviewCommentsR1'), name: 'Review Comments R1', type: 'review' },
    { key: 'r1_revised', label: t('defaultR1RevisionSubmitted'), name: 'R1 Revision Submitted', type: 'revision' },
    { key: 'r2_comments', label: t('defaultReviewCommentsR2'), name: 'Review Comments R2', type: 'review' },
    { key: 'r2_revised', label: t('defaultR2RevisionSubmitted'), name: 'R2 Revision Submitted', type: 'revision' },
    { key: 'accept', label: t('defaultAccepted'), name: 'Accepted', type: 'publication' },
    { key: 'online', label: t('defaultOnlinePublication'), name: 'Online Publication', type: 'publication' },
    { key: 'rejected', label: t('statusRejected'), name: 'Rejected', type: 'rejection' },
    { key: 'experiment_start', label: t('defaultExperimentsStarted'), name: 'Experiments Started', type: 'research' },
    { key: 'experiment_done', label: t('defaultExperimentsCompleted'), name: 'Experiments Completed', type: 'research' },
    { key: 'draft_done', label: t('defaultDraftCompleted'), name: 'Draft Completed', type: 'writing' },
    { key: 'custom', label: t('customEvent'), name: '', type: 'review' }
  ];
}

function getInlineEventPreset(key) {
  return getInlineEventPresets().find(preset => preset.key === key) || getInlineEventPresets()[0];
}

function buildInlineStageEditor(subId) {
  const keyOptions = getInlineEventPresets().map(preset => ({ value: preset.key, label: preset.label }));
  const typeOptions = [
    { value: 'research', label: t('eventTypeResearch') },
    { value: 'writing', label: t('eventTypeWriting') },
    { value: 'submission', label: t('eventTypeSubmission') },
    { value: 'review', label: t('eventTypeReview') },
    { value: 'revision', label: t('eventTypeRevision') },
    { value: 'rejection', label: t('statusRejected') },
    { value: 'publication', label: t('eventTypePublication') },
    { value: 'special', label: t('eventTypeSpecial') }
  ];

  return `
    <div class="inline-stage-editor" data-sub-id="${escapeHTML(subId)}" hidden>
      <div class="inline-stage-head">
        <span class="inline-stage-title"><span class="inline-stage-title-mark" aria-hidden="true">+</span>${t('inlineAddTimelineEvent')}</span>
        <button class="btn-secondary btn-sm btn-inline-stage-cancel" type="button">${t('cancel')}</button>
      </div>
      <div class="inline-stage-fields" role="group" aria-label="${escapeHTML(t('inlineAddTimelineEvent'))}">
        <select class="inline-stage-key" aria-label="${escapeHTML(t('keyEventPreset'))}" title="${escapeHTML(t('keyEventPreset'))}">${buildOptions(keyOptions, 'submit')}</select>
        <input type="text" class="inline-stage-name" aria-label="${escapeHTML(t('eventName'))}" value="${escapeHTML(t('defaultManuscriptSubmitted'))}" placeholder="${escapeHTML(t('eventPlaceholder'))}" maxlength="160">
        <input type="date" class="inline-stage-date" aria-label="${escapeHTML(t('eventDate'))}" value="${todayString()}">
        <select class="inline-stage-type" aria-label="${escapeHTML(t('eventTypeSpecial'))}">${buildOptions(typeOptions, 'submission')}</select>
        <input type="text" class="inline-stage-notes" aria-label="${escapeHTML(t('eventNotesShort'))}" placeholder="${escapeHTML(t('eventNotesShort'))}" maxlength="500">
        <button class="btn-primary btn-sm btn-inline-stage-save" type="button">${t('addEvent').replace('+ ', '')}</button><span class="inline-stage-status" data-inline-stage-status role="status" aria-live="polite"></span>
      </div>
    </div>
  `;
}

function toggleInlineStageEditor(card, shouldOpen = null) {
  const editor = card?.querySelector('.inline-stage-editor');
  if (!editor) return;
  if (shouldOpen !== false) setPipelineViewMode(true);
  editor.hidden = shouldOpen === null ? !editor.hidden : !shouldOpen;
  if (!editor.hidden) {
    syncInlineStagePreset(editor);
    const nameInput = editor.querySelector('.inline-stage-name');
    if (nameInput) nameInput.focus();
  }
}

function syncInlineStagePreset(editor) {
  const keySelect = editor.querySelector('.inline-stage-key');
  const nameInput = editor.querySelector('.inline-stage-name');
  const typeSelect = editor.querySelector('.inline-stage-type');
  if (!keySelect || !nameInput || !typeSelect) return;

  const preset = getInlineEventPreset(keySelect.value);
  if (preset.key !== 'custom') {
    nameInput.value = t(defaultTimelineNameKeys[preset.name] || '') || preset.label || preset.name;
    typeSelect.value = preset.type;
  } else if (nameInput.readOnly) {
    nameInput.value = '';
  }
  nameInput.readOnly = preset.key !== 'custom';
  typeSelect.disabled = preset.key !== 'custom';
}

function applyInlineEventToSubmission(sub, key, eventDate, note = '') {
  const isoDate = dateInputToIso(eventDate);
  if (key === 'submit') {
    sub.submissionDate = isoDate;
  } else if (key === 'r1_comments' || key === 'r2_comments') {
    if (key === 'r1_comments') sub.firstDecisionDate = isoDate;
    if (!hasPublicationStatus(sub) && sub.status !== 'rejected') sub.status = 'revision';
  } else if (key === 'r1_revised' || key === 'r2_revised') {
    if (!hasPublicationStatus(sub) && sub.status !== 'rejected') sub.status = 'under_review';
  } else if (key === 'accept') {
    sub.decisionDate = isoDate;
    sub.acceptedAt = isoDate;
    if (sub.status !== 'published') sub.status = 'accepted';
  } else if (key === 'online') {
    sub.decisionDate = sub.decisionDate || isoDate;
    sub.status = 'published';
    sub.publishedAt = isoDate;
    sub.acceptedAt = sub.acceptedAt || sub.decisionDate;
  } else if (key === 'rejected') {
    markSubmissionRejected(sub, eventDate, note);
  }
}

function setInlineStageBusy(editor, busy, message = '') {
  const button = editor?.querySelector('.btn-inline-stage-save');
  const status = editor?.querySelector('[data-inline-stage-status]');
  if (button) {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  }
  if (status) status.textContent = message;
}

async function saveInlineStageEvent(editor) {
  const subId = editor.getAttribute('data-sub-id');
  const sub = db.submissions.find(s => s.id === subId);
  if (!sub) {
    showGlobalToast(t('submissionNotFound'), 'error');
    renderDashboard();
    return;
  }

  const selectedKey = editor.querySelector('.inline-stage-key')?.value || 'custom';
  const preset = getInlineEventPreset(selectedKey);
  const name = editor.querySelector('.inline-stage-name').value.trim() || preset.name;
  const eventDate = editor.querySelector('.inline-stage-date').value || todayString();
  const type = editor.querySelector('.inline-stage-type').value;
  const notes = editor.querySelector('.inline-stage-notes')?.value.trim() || '';

  if (!name) {
    alert(t('eventNameRequired'));
    editor.querySelector('.inline-stage-name').focus();
    return;
  }

  if (!Array.isArray(sub.timelineNodes)) sub.timelineNodes = [];
  let node = null;
  const nodeKey = selectedKey === 'custom' ? 'auto' : selectedKey;

  if (selectedKey === 'rejected') {
    const existingRejected = getTimelineNodeByKey(sub, 'rejected');
    if (existingRejected && !confirm(tf('confirmUpdateEvent', { name: getTimelineNodeDisplayName(existingRejected) }))) {
      return;
    }
    markSubmissionRejected(sub, eventDate, notes);
    node = getTimelineNodeByKey(sub, 'rejected');
  } else {
    node = selectedKey === 'custom' ? null : getTimelineNodeByKey(sub, selectedKey);
    if (node && selectedKey !== 'custom' && node.completeDate) {
      const shouldUpdate = confirm(tf('confirmUpdateEvent', { name: getTimelineNodeDisplayName(node) }));
      if (!shouldUpdate) return;
    }
    const nodeValues = {
      key: nodeKey,
      name,
      type,
      status: 'completed',
      planDate: '',
      dueDate: '',
      completeDate: eventDate,
      notes
    };

    if (node) {
      Object.assign(node, nodeValues, { updatedAt: new Date().toISOString() });
    } else {
      node = createTimelineNode(subId, nodeValues);
      sub.timelineNodes.push(node);
    }
    applyInlineEventToSubmission(sub, nodeKey, eventDate, notes);
  }

  normalizeSubmissionTimeline(sub);
  syncManuscriptStatusFromSubmission(sub);
  await window.storage.saveAll(db);
  renderDashboard();
  renderKanban();
  renderSubmissions();
  showGlobalToast(tf('eventAddedToast', { name: getTimelineNodeDisplayName(node) }), 'success');
}

function inferKey(node) {
  if (node.key && node.key !== 'auto') return node.key;
  const t = `${node.name || ''} ${node.notes || ''}`.toLowerCase();
  if (/reject|rejected|decline|declined|拒稿|拒绝|退稿/.test(t) || node.type === 'rejection') return 'rejected';
  if (/online|publication|published|见刊|上线/.test(t) || node.type === 'publication' && t.includes('online')) return 'online';
  if (/accept|accepted|接收|录用/.test(t) || node.type === 'publication' && t.includes('accept')) return 'accept';
  if (/r2|second/.test(t) && (/submit|revis|修回|resubmitted/.test(t) || node.type === 'revision')) return 'r2_revised';
  if (/r2|second/.test(t) && (/comment|decision|review|意见|returned/.test(t) || node.type === 'review')) return 'r2_comments';
  if (/r1|first/.test(t) && (/submit|revis|修回|resubmitted/.test(t) || node.type === 'revision')) return 'r1_revised';
  if (/r1|first|comment|decision|审稿意见|一审|returned/.test(t) || node.type === 'review' || node.type === 'revision') return 'r1_comments';
  if (/submit|submission|submitted|投稿/.test(t) || node.type === 'submission') return 'submit';
  if (/draft|manuscript|completed|finished|手稿/.test(t) || node.type === 'writing') return 'draft_done';
  if (/experiment\s*(start|started|begin|began)|start(ed)?\s*(experiment|research)|实验(开始|启动)|研究开始/.test(t)) return 'experiment_start';
  if (/experiment|data|complete|completed|实验|数据/.test(t) || node.type === 'research') return 'experiment_done';
  return 'auto';
}

function getTimelineNodeByKey(sub, key) {
  return (sub.timelineNodes || []).find(node => node.key === key || inferKey(node) === key) || null;
}

function setTimelineNodeDate(node, date, field = 'completeDate') {
  if (!node || !date) return false;
  let changed = false;
  ['planDate', 'dueDate', 'completeDate'].forEach(dateField => {
    const next = dateField === field ? date : '';
    if ((node[dateField] || '') !== next) {
      node[dateField] = next;
      changed = true;
    }
  });
  return changed;
}

function createCanonicalTimelineNode(subId, key, name, type, status = 'pending') {
  return createTimelineNode(subId, { key, name, type, status });
}

function ensureTimelineNode(sub, key, name, type, status = 'pending') {
  if (!Array.isArray(sub.timelineNodes)) sub.timelineNodes = [];
  let node = getTimelineNodeByKey(sub, key);
  if (!node) {
    node = createCanonicalTimelineNode(sub.id, key, name, type, status);
    sub.timelineNodes.push(node);
    return { node, changed: true };
  }

  let changed = false;
  if (node.key !== key) {
    node.key = key;
    changed = true;
  }
  if (!node.type || node.type === 'special') {
    node.type = type;
    changed = true;
  }
  return { node, changed };
}

function initializeSubmissionTimelineNodes(sub) {
  const submitDate = normalizeDateString(sub.submissionDate);
  const firstDecisionDate = normalizeDateString(sub.firstDecisionDate);
  const revisionDueDate = normalizeDateString(sub.revisionDueDate);
  const decisionDate = normalizeDateString(sub.decisionDate);

  sub.timelineNodes = [
    createTimelineNode(sub.id, { key: 'experiment_start', name: 'Experiments Started', type: 'research', status: 'completed' }),
    createTimelineNode(sub.id, { key: 'experiment_done', name: 'Experiments Completed', type: 'research', status: 'completed' }),
    createTimelineNode(sub.id, { key: 'draft_done', name: 'Draft Completed', type: 'writing', status: submitDate ? 'completed' : 'pending' }),
    createTimelineNode(sub.id, {
      key: 'submit',
      name: 'Manuscript Submitted',
      type: 'submission',
      status: submitDate ? 'completed' : 'pending',
      completeDate: submitDate
    }),
    createTimelineNode(sub.id, {
      key: 'r1_comments',
      name: 'Review Comments R1',
      type: 'review',
      status: firstDecisionDate ? 'completed' : (revisionDueDate ? 'active' : 'pending'),
      completeDate: firstDecisionDate,
      dueDate: firstDecisionDate ? '' : revisionDueDate
    }),
    createTimelineNode(sub.id, { key: 'r1_revised', name: 'R1 Revision Submitted', type: 'revision', status: 'pending' }),
    createTimelineNode(sub.id, {
      key: 'accept',
      name: 'Accepted',
      type: 'publication',
      status: decisionDate && hasPublicationStatus(sub) ? 'completed' : 'pending',
      completeDate: decisionDate && hasPublicationStatus(sub) ? decisionDate : ''
    }),
    createTimelineNode(sub.id, {
      key: 'online',
      name: 'Online Publication',
      type: 'publication',
      status: decisionDate && sub.status === 'published' ? 'completed' : 'pending',
      completeDate: decisionDate && sub.status === 'published' ? decisionDate : ''
    })
  ];
}

function syncSubmissionFieldsFromTimeline(sub) {
  if (!sub || !Array.isArray(sub.timelineNodes)) return false;
  let changed = false;
  const submitNode = getTimelineNodeByKey(sub, 'submit');
  const submitNodeDate = normalizeDateString(getNodeDate(submitNode));
  if (submitNodeDate && normalizeDateString(sub.submissionDate) !== submitNodeDate) {
    sub.submissionDate = dateInputToIso(submitNodeDate);
    changed = true;
  }

  const r1Node = getTimelineNodeByKey(sub, 'r1_comments');
  const r1Date = normalizeDateString(r1Node?.completeDate || '');
  if (r1Date && normalizeDateString(sub.firstDecisionDate) !== r1Date) {
    sub.firstDecisionDate = dateInputToIso(r1Date);
    changed = true;
  }

  const acceptNode = getTimelineNodeByKey(sub, 'accept') || getTimelineNodeByKey(sub, 'online');
  const acceptDate = normalizeDateString(acceptNode?.completeDate || '');
  if (acceptDate && normalizeDateString(sub.decisionDate) !== acceptDate) {
    sub.decisionDate = dateInputToIso(acceptDate);
    changed = true;
  }

  return changed;
}

function normalizeSubmissionTimeline(sub) {
  if (!sub) return false;
  let changed = false;
  if (!Array.isArray(sub.timelineNodes) || sub.timelineNodes.length === 0) {
    initializeSubmissionTimelineNodes(sub);
    changed = true;
  }

  const submitDate = normalizeDateString(sub.submissionDate);
  if (submitDate) {
    const result = ensureTimelineNode(sub, 'submit', 'Manuscript Submitted', 'submission', 'completed');
    changed = result.changed || changed;
    changed = setTimelineNodeDate(result.node, submitDate, 'completeDate') || changed;
    if (result.node.status !== 'completed') {
      result.node.status = 'completed';
      changed = true;
    }
  } else {
    changed = syncSubmissionFieldsFromTimeline(sub) || changed;
  }

  const firstDecisionDate = normalizeDateString(sub.firstDecisionDate);
  if (firstDecisionDate) {
    const result = ensureTimelineNode(sub, 'r1_comments', 'Review Comments R1', 'review', 'completed');
    changed = result.changed || changed;
    changed = setTimelineNodeDate(result.node, firstDecisionDate, 'completeDate') || changed;
    if (result.node.status !== 'completed') {
      result.node.status = 'completed';
      changed = true;
    }
  }

  const revisionDueDate = normalizeDateString(sub.revisionDueDate);
  if (revisionDueDate && !firstDecisionDate) {
    const result = ensureTimelineNode(sub, 'r1_comments', 'Review Comments R1', 'review', 'active');
    changed = result.changed || changed;
    if ((result.node.dueDate || '') !== revisionDueDate) {
      result.node.dueDate = revisionDueDate;
      changed = true;
    }
    if (result.node.status === 'pending') {
      result.node.status = 'active';
      changed = true;
    }
  }

  const decisionDate = normalizeDateString(sub.decisionDate);
  if (decisionDate && hasPublicationStatus(sub)) {
    const result = ensureTimelineNode(sub, 'accept', 'Accepted', 'publication', 'completed');
    changed = result.changed || changed;
    changed = setTimelineNodeDate(result.node, decisionDate, 'completeDate') || changed;
    if (result.node.status !== 'completed') {
      result.node.status = 'completed';
      changed = true;
    }
  }
  if (sub.status === 'published') {
    const onlineDate = normalizeDateString(sub.publishedAt || getTimelineNodeByKey(sub, 'online')?.completeDate || sub.decisionDate);
    if (onlineDate) {
      const result = ensureTimelineNode(sub, 'online', 'Online Publication', 'publication', 'completed');
      changed = result.changed || changed;
      changed = setTimelineNodeDate(result.node, onlineDate, 'completeDate') || changed;
      if (result.node.status !== 'completed') { result.node.status = 'completed'; changed = true; }
    }
  }

  if (changed) sub.updatedAt = new Date().toISOString();
  return changed;
}

function analyzeSubmission(sub) {
  normalizeSubmissionTimeline(sub);
  const events = [...(sub.timelineNodes || [])].sort((a, b) => {
    const da = a.completeDate || a.planDate || a.dueDate || a.createdAt || '';
    const db = b.completeDate || b.planDate || b.dueDate || b.createdAt || '';
    return new Date(da) - new Date(db);
  });

  const getKeyEventDate = (key) => {
    const node = events.find(e => inferKey(e) === key);
    const nodeDate = node ? normalizeDateString(window.RFUI.getTimelineEventDate(node, key)) : null;
    if (key === 'submit') return normalizeDateString(sub.submissionDate) || nodeDate;
    if (key === 'r1_comments') return normalizeDateString(sub.firstDecisionDate) || nodeDate;
    if (key === 'accept' || key === 'online') {
      return normalizeDateString(sub.decisionDate) && hasPublicationStatus(sub)
        ? normalizeDateString(sub.decisionDate)
        : nodeDate;
    }
    return nodeDate;
  };

  const datedResearchEvent = events.find(e => e.type === 'research' && getNodeDate(e));
  const experimentStartDate = getKeyEventDate('experiment_start');
  const experimentDate = getKeyEventDate('experiment_done') || (datedResearchEvent ? getNodeDate(datedResearchEvent) : null);
  const submitDate = getKeyEventDate('submit');
  const submitNode = events.find(e => inferKey(e) === 'submit');
  const submitDateSource = normalizeDateString(sub.submissionDate)
    ? t('dateSourceSubmission')
    : (normalizeDateString(getNodeDate(submitNode)) ? t('dateSourceTimeline') : t('dateSourceMissing'));
  const r1Date = getKeyEventDate('r1_comments');
  const acceptDate = getKeyEventDate('accept');
  const onlineDate = getKeyEventDate('online');

  const latest = getLatestTimelineNode(sub.timelineNodes || []);
  const accepted = Boolean(acceptDate) || hasPublicationStatus(sub);

  const expToSubmit = experimentDate && submitDate ? getDaysDiff(experimentDate, submitDate) : null;
  const submitToNow = submitDate && !accepted ? getDaysDiff(submitDate, todayString()) : null;
  const r1ToNow = r1Date && !accepted ? getDaysDiff(r1Date, todayString()) : null;
  const submitToAccept = submitDate && acceptDate ? getDaysDiff(submitDate, acceptDate) : null;
  const acceptToOnline = acceptDate && onlineDate ? getDaysDiff(acceptDate, onlineDate) : null;

  let display = {
    mode: "prepare",
    label: t('displayPrepareLabel'),
    value: expToSubmit,
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    caption: t('displayPrepareCaption'),
    pending: false,
    milestones: [
      { name: t('milestoneExperimentStart'), date: experimentStartDate, color: '#0891b2', emphasis: true, node: events.find(e => inferKey(e) === 'experiment_start') },
      { name: t('milestoneExperimentDone'), date: experimentDate, color: "#2563eb", emphasis: true, node: events.find(e => inferKey(e) === 'experiment_done') },
      { name: t('milestoneSubmission'), date: submitDate, color: "#f97316", emphasis: true, node: events.find(e => inferKey(e) === 'submit') }
    ]
  };

  if (accepted) {
    display = {
      mode: "accepted",
      label: t('displayAcceptedLabel'),
      value: submitToAccept,
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      caption: t('displayAcceptedCaption'),
      pending: false,
      milestones: [
        { name: t('milestoneSubmission'), date: submitDate, color: "#f97316", emphasis: true, node: events.find(e => inferKey(e) === 'submit') },
        { name: t('milestoneAcceptance'), date: acceptDate, color: "#16a34a", emphasis: true, node: events.find(e => inferKey(e) === 'accept') }
      ]
    };
  } else if (r1Date) {
    display = {
      mode: "r1-active",
      label: t('displayR1Label'),
      value: r1ToNow,
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
      caption: t('displayR1Caption'),
      pending: true,
      milestones: [
        { name: t('milestoneSubmission'), date: submitDate, color: "#f97316", emphasis: false, node: events.find(e => inferKey(e) === 'submit') },
        { name: t('milestoneR1Comments'), date: r1Date, color: "#dc2626", emphasis: true, node: events.find(e => inferKey(e) === 'r1_comments') },
        { name: t('milestoneToday'), date: todayString(), color: "#dc2626", emphasis: true, today: true }
      ]
    };
  } else if (submitDate) {
    display = {
      mode: "under-review",
      label: t('displayReviewLabel'),
      value: submitToNow,
      color: "#f97316",
      bg: "#fff7ed",
      border: "#fed7aa",
      caption: t('displayReviewCaption'),
      pending: true,
      milestones: [
        { name: t('milestoneSubmission'), date: submitDate, color: "#f97316", emphasis: true, node: events.find(e => inferKey(e) === 'submit') },
        { name: t('milestoneToday'), date: todayString(), color: "#f97316", emphasis: true, today: true }
      ]
    };
  }

  // Adjust display theme variables based on prefers-color-scheme dynamically
  const isDarkMode = isDarkThemeActive();
  if (isDarkMode) {
    if (display.mode === 'prepare') {
      display.bg = 'rgba(37,99,235,0.08)';
      display.border = 'rgba(37,99,235,0.3)';
    } else if (display.mode === 'accepted') {
      display.bg = 'rgba(22,163,74,0.08)';
      display.border = 'rgba(22,163,74,0.3)';
    } else if (display.mode === 'r1-active') {
      display.bg = 'rgba(220,38,38,0.08)';
      display.border = 'rgba(220,38,38,0.3)';
    } else if (display.mode === 'under-review') {
      display.bg = 'rgba(249,115,22,0.08)';
      display.border = 'rgba(249,115,22,0.3)';
    }
  }

  // The editable submission status is the source of truth. Timeline dates add
  // context, but must never promote a submitted record to "under review".
  const explicitStatus = normalizeSubmissionStatus(sub.status || 'submitted');
  const statusPresentation = {
    submitted: { label: t('stateSubmitted'), color: '#64748b' },
    under_review: { label: t('stateUnderReview'), color: '#0891b2' },
    revision: { label: getSubmissionStatusLabel('revision'), color: '#d97706' },
    accepted: { label: t('stateAccepted'), color: '#16a34a' },
    published: { label: t('stateOnline'), color: '#15803d' },
    rejected: { label: getSubmissionStatusLabel('rejected'), color: '#dc2626' }
  }[explicitStatus] || { label: t('statePreparing'), color: '#64748b' };
  let stateLabel = statusPresentation.label;
  let stateColor = statusPresentation.color;
  let stateNote = submitDate ? tf('stateSinceSubmit', { count: submitToNow ?? "—" }) : t('stateNotSubmitted');
  if (explicitStatus === 'revision' && r1Date) stateNote = tf('stateSinceR1', { count: r1ToNow ?? "—" });
  if (explicitStatus === 'accepted' && acceptDate) stateNote = formatShortDate(acceptDate);
  if (explicitStatus === 'published' && onlineDate) stateNote = formatShortDate(onlineDate);

  return { events, experimentStartDate, experimentDate, submitDate, submitDateSource, r1Date, acceptDate, onlineDate, latest, accepted, expToSubmit, submitToNow, r1ToNow, submitToAccept, acceptToOnline, display, stateLabel, stateColor, stateNote };
}

function isAcceptedSubmission(sub) {
  return Boolean(sub && analyzeSubmission(sub).accepted);
}

function hasPublicationStatus(sub) {
  const status = normalizeSubmissionStatus(sub?.status);
  return status === 'accepted' || status === 'published';
}

function canHavePublicationLink(sub) {
  if (!sub) return false;
  if (hasPublicationStatus(sub)) return true;
  if (normalizeDateString(sub.acceptedAt || sub.publishedAt)) return true;
  return isAcceptedSubmission(sub);
}

function clearPublicationLinkFields(sub) {
  if (!sub) return false;
  let changed = false;
  ['doi', 'DOI', 'articleDoi', 'articleUrl', 'publicationUrl', 'journalArticleUrl'].forEach(field => {
    if (sub[field]) {
      sub[field] = null;
      changed = true;
    }
  });
  return changed;
}

function clearPublicationTimelineCompletion(sub) {
  if (!sub || !Array.isArray(sub.timelineNodes)) return false;
  let changed = false;
  sub.timelineNodes.forEach(node => {
    if (inferKey(node) !== 'accept' && inferKey(node) !== 'online') return;
    if (node.completeDate) {
      node.completeDate = '';
      changed = true;
    }
    if (node.status === 'completed') {
      node.status = 'pending';
      changed = true;
    }
  });
  return changed;
}

function clearUnacceptedPublicationLinks(database) {
  if (!database || !Array.isArray(database.submissions)) return false;
  let changed = false;
  database.submissions.forEach(sub => {
    if (!canHavePublicationLink(sub)) {
      changed = clearPublicationLinkFields(sub) || changed;
    }
  });
  return changed;
}

function getDashboardFilterLabel() {
  if (currentDashboardFilter === 'accepted') return t('acceptedPipelines');
  if (currentDashboardFilter === 'active') return t('activePipelines');
  return t('allPipelines');
}

function getSubmissionAttentionScore(sub) {
  const analysis = analyzeSubmission(sub);
  const nodes = sub.timelineNodes || [];
  const hasBlocked = nodes.some(n => computeNodeStatus(n) === 'blocked');
  const hasOverdue = nodes.some(n => computeNodeStatus(n) === 'overdue');
  const hasDueSoon = nodes.some(n => computeNodeStatus(n) === 'due_soon');
  const hasRevision = /revision/.test(sub.status || '') || Boolean(analysis.r1Date);

  if (hasBlocked || hasOverdue) return 0;
  if (hasRevision) return 1;
  if (!analysis.accepted && analysis.submitDate) return 2;
  if (hasDueSoon) return 3;
  if (!analysis.submitDate) return 4;
  return analysis.accepted ? 6 : 5;
}

function getSubmissionDoi(sub) {
  if (!canHavePublicationLink(sub)) return '';

  const direct = normalizeDoi(sub?.doi || sub?.DOI || sub?.articleDoi || sub?.metadata?.doi || sub?.attributes?.doi);
  if (direct) return direct;

  const textDoi = extractDoiFromText([sub?.notes, sub?.summary, sub?.description, sub?.articleUrl, sub?.journalUrl].filter(Boolean).join(' '));
  if (textDoi) return textDoi;

  const manuscript = db?.manuscripts?.find(m => m.id === sub?.manuscriptId);
  const title = normalizeText(manuscript?.title || sub?.title || '');
  const journal = normalizeText(sub?.targetJournal || sub?.journalName || '');
  const achievement = db?.achievements?.find(ach => {
    const achTitle = normalizeText(ach.title || '');
    const achJournal = normalizeText(ach.journal || '');
    return ach.doi && (
      (title && achTitle && (achTitle === title || achTitle.includes(title) || title.includes(achTitle))) ||
      (journal && achJournal && achJournal === journal)
    );
  });
  return normalizeDoi(achievement?.doi || '');
}

function getSubmissionJournalName(sub) {
  if (!sub) return t('targetJournal');
  const manuscript = db?.manuscripts?.find(m => m.id === sub.manuscriptId);
  const manuscriptJournal = Array.isArray(manuscript?.targetJournals)
    ? manuscript.targetJournals[0]
    : manuscript?.targetJournal;
  return sub.targetJournal || sub.journalName || sub.journal || sub.publisher || manuscriptJournal || t('targetJournal');
}

function normalizeAuthorName(author) {
  if (typeof author === 'string') return author.trim();
  if (!author || typeof author !== 'object') return '';
  return String(author.name || author.fullName || author.displayName || '').trim();
}

function firstAuthorFromList(authors) {
  if (Array.isArray(authors)) {
    return normalizeAuthorName(authors.find(author => normalizeAuthorName(author)));
  }
  const value = String(authors || '').trim();
  if (!value) return '';
  return value.split(/\s*(?:;|；|\n|\band\b)\s*/i)[0].trim();
}

function getSubmissionFirstAuthor(sub, manuscript = null) {
  const man = manuscript || db?.manuscripts?.find(item => item.id === sub?.manuscriptId);
  return String(
    sub?.firstAuthor ||
    man?.firstAuthor ||
    firstAuthorFromList(man?.authors) ||
    firstAuthorFromList(sub?.authors) ||
    ''
  ).trim();
}

function getSubmissionArticleUrl(sub) {
  if (!canHavePublicationLink(sub)) return '';

  const explicitUrl = String(sub?.articleUrl || sub?.publicationUrl || sub?.url || sub?.journalArticleUrl || '').trim();
  if (explicitUrl) return explicitUrl;
  const doi = getSubmissionDoi(sub);
  return doi ? `https://doi.org/${doi}` : '';
}

function getSubmissionSortTime(sub) {
  const analysis = analyzeSubmission(sub);
  const normalized = normalizeDateString(sub?.submissionDate) || analysis.submitDate || normalizeDateString(sub?.submittedAt);
  if (normalized) return new Date(`${normalized}T12:00:00.000Z`).getTime();
  return 0;
}

function sortDashboardSubmissions(submissions) {
  return [...submissions].sort((a, b) => {
    const submittedA = getSubmissionSortTime(a);
    const submittedB = getSubmissionSortTime(b);
    if (submittedA !== submittedB) return submittedB - submittedA;

    const da = getNodeDate(getLatestTimelineNode(a.timelineNodes || [])) || a.updatedAt || a.createdAt || '';
    const db = getNodeDate(getLatestTimelineNode(b.timelineNodes || [])) || b.updatedAt || b.createdAt || '';
    return new Date(db || 0) - new Date(da || 0);
  });
}

function normalizeSyncedPublicationStatus(status) {
  const normalized = normalizeText(status);
  if (normalized === 'accept') return 'accepted';
  return normalized;
}

function isSubmissionLifecycleStatus(status) {
  return ['submitted', 'under_review', 'revision', 'accepted', 'published'].includes(normalizeSyncedPublicationStatus(status));
}

function getSubmissionLifecycleRank(status) {
  const ranks = {
    submitted: 1,
    under_review: 2,
    revision: 3,
    accepted: 4,
    published: 5
  };
  return ranks[normalizeSyncedPublicationStatus(status)] || 0;
}

function getLinkedActiveSubmissions(manuscriptId, database = db) {
  const current = window.RFCore.getCurrentSubmission(database, manuscriptId);
  return current ? [current] : [];
}

function syncLinkedSubmissionsFromManuscript(manuscript, database = db) {
  if (!manuscript) return false;
  const nextStatus = normalizeSyncedPublicationStatus(manuscript.status);
  let changed = false;

  getLinkedActiveSubmissions(manuscript.id, database).forEach(sub => {
    const patch = {
      title: manuscript.title,
      targetJournal: manuscript.targetJournals?.[0] || null,
      firstAuthor: manuscript.firstAuthor || firstAuthorFromList(manuscript.authors) || null
    };
    if (isSubmissionLifecycleStatus(nextStatus) || nextStatus === 'rejected') patch.status = nextStatus;
    if (nextStatus === 'accepted' || nextStatus === 'published') {
      patch.doi = manuscript.doi || sub.doi || null;
      patch.articleUrl = manuscript.articleUrl || sub.articleUrl || null;
    }
    if (Object.entries(patch).some(([key, value]) => sub[key] !== value)) {
      const previousStatus = sub.status;
      Object.assign(sub, patch);
      sub.updatedAt = new Date().toISOString();
      if (isSubmissionLifecycleStatus(nextStatus) && nextStatus !== 'accepted' && nextStatus !== 'published') {
        clearPublicationLinkFields(sub);
        clearPublicationTimelineCompletion(sub);
      }
      if (previousStatus === 'published' && nextStatus === 'accepted') clearOnlinePublicationCompletion(sub);
      normalizeSubmissionTimeline(sub);
      changed = true;
    }
    changed = syncWorkflowAliases(sub, manuscript) || changed;
  });

  return syncLinkedManuscriptSnapshots(manuscript, database) || changed;
}

function setManuscriptStatus(manuscript, status, { syncSubmissions = true, database = db } = {}) {
  if (!manuscript) return false;
  const nextStatus = normalizeSyncedPublicationStatus(status);
  let changed = false;
  if (manuscript.status !== nextStatus) {
    manuscript.status = nextStatus;
    manuscript.updatedAt = new Date().toISOString();
    changed = true;
  }
  if (syncSubmissions) {
    changed = syncLinkedSubmissionsFromManuscript(manuscript, database) || changed;
  }
  return changed;
}

async function persistManuscriptStatusChange(manuscript, nextStatus) {
  const liveManuscript = db.manuscripts.find(item => item.id === manuscript.id);
  if (!liveManuscript) throw new Error(t('manuscriptNotFound'));
  validateLinkedManuscriptStatus(liveManuscript, nextStatus);
  const previousStatus = normalizeSyncedPublicationStatus(liveManuscript.status);
  const workingDatabase = typeof structuredClone === 'function'
    ? structuredClone(db)
    : JSON.parse(JSON.stringify(db));
  const workingManuscript = workingDatabase.manuscripts.find(item => item.id === manuscript.id);
  if (!workingManuscript) throw new Error(t('manuscriptNotFound'));

  setManuscriptStatus(workingManuscript, nextStatus, { database: workingDatabase });
  const savedDatabase = await window.storage.saveAll(workingDatabase, { mergeOnConflict: true });
  db = savedDatabase || workingDatabase;
  const savedManuscript = db.manuscripts.find(item => item.id === manuscript.id);
  if (!savedManuscript) throw new Error(t('manuscriptNotFound'));
  Object.assign(manuscript, savedManuscript);

  if (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero && savedManuscript.zoteroItemKey) {
    try {
      ZoteroBridge.syncStatusTag(savedManuscript.zoteroItemKey, savedManuscript.status);
      ZoteroBridge.syncNote(savedManuscript.zoteroItemKey);
    } catch (_) {}
  }

  return {
    manuscript: savedManuscript,
    shouldCelebrate: window.RFUI.shouldCelebrateAcceptance(
      previousStatus,
      normalizeSyncedPublicationStatus(savedManuscript.status)
    )
  };
}

function syncManuscriptStatusFromSubmission(submission, database = db) {
  if (!submission) return false;
  const manuscript = database?.manuscripts?.find(man => man.id === submission.manuscriptId);
  if (!manuscript) return false;
  if (window.RFCore.getCurrentSubmission(database, manuscript.id)?.id !== submission.id) return false;
  const normalized = normalizeWorkflowFields(submission);
  const patch = {
    status: normalizeSubmissionStatus(submission.status),
    targetJournals: 'targetJournal' in submission ? (submission.targetJournal ? [submission.targetJournal] : []) : (manuscript.targetJournals || []),
    firstAuthor: submission.firstAuthor || manuscript.firstAuthor || firstAuthorFromList(manuscript.authors) || null
  };
  if (hasPublicationStatus(submission)) {
    patch.doi = submission.doi || manuscript.doi || null;
    patch.articleUrl = submission.articleUrl || manuscript.articleUrl || null;
  }
  const changed = Object.entries(patch).some(([key, value]) => JSON.stringify(manuscript[key]) !== JSON.stringify(value));
  if (changed) Object.assign(manuscript, patch, { updatedAt: submission.updatedAt || new Date().toISOString() });
  return syncLinkedManuscriptSnapshots(manuscript, database) || changed || normalized;
}

function normalizeWorkflowFields(sub) {
  let changed = false;
  for (const [alias, key] of [['journalName', 'targetJournal'], ['submittedAt', 'submissionDate'], ['decisionAt', 'decisionDate'], ['revisionDeadline', 'revisionDueDate']]) {
    if (!(key in sub) && alias in sub) { sub[key] = sub[alias]; changed = true; }
  }
  return changed;
}

function validateLinkedManuscriptStatus(manuscript, status) {
  if (window.RFCore.getCurrentSubmission(db, manuscript.id) && !isSubmissionLifecycleStatus(status) && status !== 'rejected') {
    throw new Error(currentLanguage === 'zh'
      ? '该手稿已有投稿记录，请选择投稿、审稿、返修、接收、发表或拒稿状态。若需退回准备阶段，请先删除对应投稿跟踪。'
      : 'This manuscript has a submission. Choose a submission status, or delete its submission tracking before returning to preparation.');
  }
}

function syncWorkflowAliases(sub, manuscript) {
  let changed = normalizeWorkflowFields(sub);
  const set = (object, key, value) => {
    if (JSON.stringify(object[key]) !== JSON.stringify(value)) { object[key] = value; changed = true; }
  };
  for (const [alias, key] of [['journalName', 'targetJournal'], ['submittedAt', 'submissionDate'], ['decisionAt', 'decisionDate'], ['revisionDeadline', 'revisionDueDate']]) {
    if (alias in sub) set(sub, alias, sub[key] ?? null);
  }
  if ('title' in sub) set(sub, 'title', manuscript.title);
  if ('targetJournal' in manuscript) set(manuscript, 'targetJournal', manuscript.targetJournals?.[0] || null);
  if (sub.manuscript && typeof sub.manuscript === 'object' && !Array.isArray(sub.manuscript)) {
    for (const key of ['id', 'title', 'status', 'firstAuthor', 'updatedAt']) set(sub.manuscript, key, manuscript[key] ?? null);
    if ('targetJournal' in sub.manuscript) set(sub.manuscript, 'targetJournal', manuscript.targetJournals?.[0] || null);
    if ('targetJournals' in sub.manuscript) set(sub.manuscript, 'targetJournals', manuscript.targetJournals || []);
  }
  return changed;
}

function syncLinkedManuscriptSnapshots(manuscript, database) {
  let changed = false;
  (database.submissions || []).filter(sub => sub.manuscriptId === manuscript.id).forEach(sub => {
    changed = syncWorkflowAliases(sub, manuscript) || changed;
  });
  return changed;
}

function syncManuscriptStatusesFromSubmissions(database) {
  if (!database || !Array.isArray(database.manuscripts) || !Array.isArray(database.submissions)) return false;
  let changed = false;
  database.manuscripts.forEach(manuscript => {
    const current = window.RFCore.getCurrentSubmission(database, manuscript.id);
    if (!current) return;
    // Repair the legacy accepted/published split only when an online event is completed.
    const online = getTimelineNodeByKey(current, 'online');
    if (current.status === 'accepted' && manuscript.status === 'published' && online?.completeDate) {
      current.status = 'published';
      current.publishedAt = current.publishedAt || dateInputToIso(normalizeDateString(online.completeDate));
      changed = true;
    }
    changed = syncManuscriptStatusFromSubmission(current, database) || changed;
  });
  return changed;
}

function clearOnlinePublicationCompletion(sub) {
  delete sub.publishedAt;
  (sub.timelineNodes || []).filter(node => inferKey(node) === 'online').forEach(node => {
    node.completeDate = '';
    node.status = 'pending';
  });
}

function createRejectedTimelineNode(sub, rejectionDate, note = '') {
  if (!Array.isArray(sub.timelineNodes)) sub.timelineNodes = [];
  const existing = sub.timelineNodes.find(node => inferKey(node) === 'rejected');
  const date = rejectionDate || todayString();
  const values = {
    key: 'rejected',
    name: 'Rejected',
    type: 'rejection',
    status: 'blocked',
    planDate: '',
    dueDate: '',
    completeDate: date,
    notes: note
  };

  if (existing) {
    Object.assign(existing, values, { updatedAt: new Date().toISOString() });
    return existing;
  }

  const node = createTimelineNode(sub.id, values);
  sub.timelineNodes.push(node);
  return node;
}

function markSubmissionRejected(sub, rejectionDate = todayString(), note = '') {
  if (!sub) return false;
  const isoDate = dateInputToIso(rejectionDate);
  sub.status = 'rejected';
  sub.decisionDate = isoDate;
  sub.firstDecisionDate = sub.firstDecisionDate || isoDate;
  sub.rejectedAt = isoDate;
  sub.rejectionNote = note || sub.rejectionNote || '';
  if (note) sub.notes = [sub.notes, `Rejected: ${note}`].filter(Boolean).join('\n');
  clearPublicationLinkFields(sub);
  clearPublicationTimelineCompletion(sub);
  createRejectedTimelineNode(sub, rejectionDate, note);
  sub.updatedAt = new Date().toISOString();
  return true;
}

function getNextSubmissionRound(manuscriptId) {
  const rounds = (db?.submissions || [])
    .filter(sub => sub.manuscriptId === manuscriptId)
    .map(sub => Number(sub.roundIndex) || 1);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

function createTransferredSubmission(sourceSub, targetJournal, submissionDate = todayString(), journalUrl = '') {
  const manuscript = db.manuscripts.find(m => m.id === sourceSub.manuscriptId);
  const now = new Date().toISOString();
  const newSub = {
    id: 'sub_' + Math.random().toString(36).substring(2, 9),
    userId: sourceSub.userId || 'user',
    manuscriptId: sourceSub.manuscriptId,
    projectId: sourceSub.projectId || manuscript?.projectId || null,
    targetJournal,
    journalUrl: journalUrl || null,
    doi: null,
    articleUrl: null,
    status: 'submitted',
    submissionDate: dateInputToIso(submissionDate),
    decisionDate: null,
    revisionDueDate: null,
    firstDecisionDate: null,
    previousSubmissionId: sourceSub.id,
    previousJournal: getSubmissionJournalName(sourceSub),
    firstAuthor: getSubmissionFirstAuthor(sourceSub, manuscript) || null,
    roundIndex: getNextSubmissionRound(sourceSub.manuscriptId),
    complianceChecklist: {},
    complianceChecklistKeys: Array.isArray(sourceSub.complianceChecklistKeys) ? sourceSub.complianceChecklistKeys : undefined,
    reviewMatrix: [],
    timelineNodes: [],
    notes: `Transferred after rejection from ${getSubmissionJournalName(sourceSub)}.`,
    createdAt: now,
    updatedAt: now
  };
  normalizeSubmissionTimeline(newSub);
  return newSub;
}

function getSubmissionBadgeClass(sub) {
  const status = normalizeSyncedPublicationStatus(sub?.status || 'submitted');
  if (status === 'rejected') return 'danger';
  if (status === 'revision') return 'warning';
  if (status === 'accepted' || status === 'published') return 'success';
  return 'purple';
}

// --- VIEW 1: DASHBOARD OVERVIEW ---
// --- VIEW 1: DASHBOARD OVERVIEW ---
function renderDashboard() {
  const manuscriptsById = new Map(db.manuscripts.map(manuscript => [manuscript.id, manuscript]));
  // Calculate interactive stats counts
  const allSubmissions = db.submissions;
  const visibleSubmissions = allSubmissions.filter(s => s.status !== 'rejected');
  let timelineChanged = false;
  visibleSubmissions.forEach(sub => {
    if (!Array.isArray(sub.timelineNodes) || sub.timelineNodes.length === 0) {
      sub.timelineNodes = buildDefaultSubmissionTimeline(sub);
      timelineChanged = true;
    }
    timelineChanged = normalizeSubmissionTimeline(sub) || timelineChanged;
  });
  // Rendering is read-only with respect to persistence; user actions own commits.
  const acceptedCount = visibleSubmissions.filter(isAcceptedSubmission).length;
  const activeCount = visibleSubmissions.filter(s => !isAcceptedSubmission(s)).length;
  const totalCount = allSubmissions.length;

  document.getElementById('stat-accepted-submissions').textContent = acceptedCount;
  document.getElementById('stat-active-submissions').textContent = activeCount;
  document.getElementById('stat-total-submissions').textContent = totalCount;
  const filterLabel = document.getElementById('dashboard-filter-label');
  if (filterLabel) filterLabel.textContent = getDashboardFilterLabel();

  // Calculate top summary metrics using analyzeSubmission
  const analyses = db.submissions.filter(s => s.status !== 'rejected').map(analyzeSubmission);
  const expSubmit = analyses.map(a => a.expToSubmit).filter(v => v !== null && !isNaN(v) && v >= 0);
  const submitNow = analyses.filter(a => !a.accepted).map(a => a.submitToNow).filter(v => v !== null && !isNaN(v) && v >= 0);
  const r1Now = analyses.filter(a => !a.accepted).map(a => a.r1ToNow).filter(v => v !== null && !isNaN(v) && v >= 0);
  const submitAccept = analyses.filter(a => a.accepted).map(a => a.submitToAccept).filter(v => v !== null && !isNaN(v) && v >= 0);

  applyLanguage();
  const avgText = (arr) => arr.length ? `${Math.round(arr.reduce((s, n) => s + n, 0) / arr.length)}${t('dayUnitShort')}` : "—";

  if (document.getElementById("mExpSubmit")) document.getElementById("mExpSubmit").textContent = avgText(expSubmit);
  if (document.getElementById("mSubmitNow")) document.getElementById("mSubmitNow").textContent = avgText(submitNow);
  if (document.getElementById("mR1Now")) document.getElementById("mR1Now").textContent = avgText(r1Now);
  if (document.getElementById("mSubmitAccept")) document.getElementById("mSubmitAccept").textContent = avgText(submitAccept);

  // 1. Pipeline Timeline Cards
  const ganttBox = document.getElementById('dashboard-gantt');
  window.RFUI.setHTML(ganttBox, '');

  // Apply active filter state
  let submissionsList = visibleSubmissions;
  if (currentDashboardFilter === 'accepted') {
    submissionsList = submissionsList.filter(isAcceptedSubmission);
  } else if (currentDashboardFilter === 'active') {
    submissionsList = submissionsList.filter(s => !isAcceptedSubmission(s));
  }
  submissionsList = sortDashboardSubmissions(submissionsList);

  if (submissionsList.length === 0) {
    window.RFUI.setHTML(ganttBox, `<p class="empty-state">${t('noPipelines')}</p>`);
  } else {
    submissionsList.forEach((sub, index) => {
      const displayIndex = submissionsList.length - index;
      const man = manuscriptsById.get(sub.manuscriptId);
      const manTitle = man ? man.title : t('untitledManuscript');
      const journalName = getSubmissionJournalName(sub);
      const firstAuthor = getSubmissionFirstAuthor(sub, man);

      // Analyze submission via the unified helper
      const a = analyzeSubmission(sub);

      // Determine visual stage category borders
      let stageClass = 'stage-active';
      if (a.accepted || sub.status === 'accepted' || sub.status === 'published') {
        stageClass = 'stage-accepted';
      } else if ((sub.status || '').includes('revision')) {
        stageClass = 'stage-revision';
      } else {
        const sortedNodes = autoSortNodes(sub.timelineNodes);
        const hasOverdue = sortedNodes.some(n => { const s = computeNodeStatus(n); return s === 'overdue' || s === 'blocked'; });
        if (hasOverdue) stageClass = 'stage-exception';
      }

      // Build premium 4-column event rail card matching the reference design
      const card = document.createElement('div');
      card.className = `pipeline-card ${stageClass}`;

      const latestMeta = a.latest ? getTimelineTypeMeta(a.latest.type) : { color: "#64748b", label: t('typeNoEvent') };
      const latestDate = a.latest ? getNodeDate(a.latest) : '';
      const latestRelative = latestDate ? getRelativeDateLabel(latestDate) : '';
      const submissionDoi = getSubmissionDoi(sub);
      const articleUrl = getSubmissionArticleUrl(sub);
      const doiHtml = submissionDoi
        ? `<a class="doi-link" href="${escapeHTML(articleUrl || `https://doi.org/${submissionDoi}`)}" target="_blank" rel="noopener noreferrer">${t('doiLabel')}: ${escapeHTML(submissionDoi)}</a>`
        : (articleUrl
          ? `<a class="doi-link" href="${escapeHTML(articleUrl)}" target="_blank" rel="noopener noreferrer">${t('articlePage')}</a>`
          : `<span class="doi-missing">${t('doiNotSet')}</span>`);

      // Col 2 Event Rail details
      const milestones = a.display.milestones.filter(m => m.name && m.date !== undefined);
      const count = Math.max(2, milestones.length);

      let railHtml = `
        <div class="event-rail" style="--count:${count}">
          <div class="rail-track ${a.display.pending ? "pending" : ""}"></div>
      `;

      milestones.forEach(m => {
        const isInteractive = m.node ? true : false;
        railHtml += `
          <div class="milestone">
            <div class="dot-wrap">
              <div class="dot ${m.emphasis ? "emphasis" : ""} ${m.today ? "today" : ""} ${isInteractive ? "interactive-dot" : ""}"
                   style="--dot-color:${m.color || a.display.color}; ${isInteractive ? 'cursor: pointer;' : ''}"
                   ${isInteractive ? `data-node-id="${escapeHTML(m.node.id)}" data-sub-id="${escapeHTML(sub.id)}" title="${escapeHTML(t('clickEditEvent'))}: ${escapeHTML(m.name)}"` : ''}></div>
            </div>
            <div class="milestone-name">${escapeHTML(m.name)}</div>
            <div class="milestone-date">${m.date ? formatShortDate(m.date) : "—"}</div>
          </div>
        `;
      });

      railHtml += `
        </div>
        <div class="rail-caption">
          <span>${t('keyEventRail')}</span>
          <span class="caption-highlight">${a.display.pending ? t('countingNow') : t('completedInterval')}</span>
        </div>
      `;

      window.RFUI.setHTML(card, `
        <!-- Col 1: Manuscript Info -->
        <div class="project-info">
          <div class="project-heading-row">
            <span class="submission-index">${displayIndex}</span>
            <div class="journal">${escapeHTML(journalName)}</div>
            <span class="pipeline-compact-status" style="--state-color:${a.stateColor}">${escapeHTML(a.stateLabel)}</span>
          </div>
          <h3 class="project-title" title="${escapeHTML(manTitle)}">${escapeHTML(manTitle)}</h3>
          <div class="project-meta">
            <span>${tf('nodesSaved', { count: sub.timelineNodes.length })}</span>
            <span>${t('timelineSortedBySubmissionDate')}: ${a.submitDate ? escapeHTML(formatShortDate(a.submitDate)) : t('noDate')}</span>
            <span>${t('expSubmitShort')} ${a.expToSubmit === null ? "—" : a.expToSubmit + t('dayUnitShort')}</span>
            <span>${t('timelineDateSource')}: ${escapeHTML(a.submitDateSource)}</span>
            <span class="pipeline-first-author ${firstAuthor ? '' : 'is-empty'}" title="${escapeHTML(t('firstAuthorLabel'))}: ${escapeHTML(firstAuthor || t('firstAuthorNotSet'))}">
              <span class="pipeline-first-author-label">${escapeHTML(t('firstAuthorLabel'))}:</span>
              <strong>${escapeHTML(firstAuthor || t('firstAuthorNotSet'))}</strong>
            </span>
          </div>
          <div class="pipeline-link-row">
            ${doiHtml}
            ${man?.zoteroItemKey ? `
              <span class="zotero-card-badge" data-item-key="${escapeHTML(man.zoteroItemKey)}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 文献库中选中此条目' : 'Select in Zotero library')}" style="margin-left: 6px;">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H6.4l5.6 6v2H2v-2h7.6L4 5V3z"/></svg>
                Zotero
              </span>
              ${man.citekey ? `<span class="zotero-citekey-badge" data-citekey="${escapeHTML(man.citekey)}" title="${escapeHTML(currentLanguage === 'zh' ? '点击复制 Citation Key' : 'Click to copy Citation Key')}">[@${escapeHTML(man.citekey)}]</span>` : ''}
              ${man.pdfUri ? `<span class="zotero-pdf-badge" data-item-key="${escapeHTML(man.zoteroItemKey)}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 阅读器中打开 PDF' : 'Open PDF in Zotero reader')}">📖 PDF</span>` : ''}
            ` : ''}
          </div>
          <div class="pipeline-actions" style="margin-top: 12px; display: flex; gap: 8px;">
            <button type="button" class="btn-secondary btn-sm btn-pipeline-open" data-sub-id="${escapeHTML(sub.id)}" aria-label="${escapeHTML(t('openSubmissionDetails'))}: ${escapeHTML(manTitle)}">${escapeHTML(t('openSubmissionDetails'))}</button>
            <button class="btn-secondary btn-sm btn-pipeline-add" data-sub-id="${escapeHTML(sub.id)}">${t('addEvent')}</button>
            <button class="btn-secondary btn-sm btn-pipeline-manage" data-sub-id="${escapeHTML(sub.id)}">${t('manageEvents')}</button>
            <button class="btn-secondary btn-sm btn-pipeline-share" data-sub-id="${escapeHTML(sub.id)}" title="${escapeHTML(t('shareJourney'))}" aria-label="${escapeHTML(t('shareJourney'))}: ${escapeHTML(manTitle)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
              <span>${escapeHTML(t('shareJourney'))}</span>
            </button>
          </div>
        </div>

        <!-- Col 2: Middle Core Panel -->
        <div class="core-panel" style="--panel-color:${a.display.color}; --panel-bg:${a.display.bg}; --panel-border:${a.display.border}">
          <div class="core-head">
            <div>
              <div class="core-label">${escapeHTML(a.display.label)}</div>
              <div class="core-sub">${escapeHTML(a.display.caption)}</div>
            </div>
            <div class="core-value"><strong>${a.display.value === null ? "—" : a.display.value}</strong><span>${t('days')}</span></div>
          </div>
          ${railHtml}
        </div>

        <!-- Col 3: Latest Node Window -->
        <div class="latest-window" data-sub-id="${escapeHTML(sub.id)}" data-latest-id="${a.latest ? escapeHTML(a.latest.id) : ''}">
          <div class="latest-head">
            <span>${t('latestEvent')}</span>
            <span class="node-type" style="--node-color:${latestMeta.color}">${escapeHTML(latestMeta.label)}</span>
          </div>
          <div class="latest-title">${a.latest ? escapeHTML(getTimelineNodeDisplayName(a.latest)) : t('noEventYet')}</div>
          <div class="latest-date">${a.latest ? `${latestDate ? escapeHTML(formatShortDate(latestDate)) : t('noDate')}${latestRelative ? ` · ${escapeHTML(latestRelative)}` : ''}` : t('addEventStart')}</div>
          <div class="latest-note">${a.latest ? escapeHTML(a.latest.notes || t('clickEditEvent')) : t('clickAddEvent')}</div>
        </div>

        <!-- Col 4: State Box -->
        <div class="state-box">
          <span class="state-pill" style="--state-color:${a.stateColor}">${escapeHTML(a.stateLabel)}</span>
          <div class="state-note">${escapeHTML(a.stateNote)}</div>
        </div>
        ${buildInlineStageEditor(sub.id)}
      `);

      // Setup click listeners for interactive dots in Col 2
      card.querySelectorAll('.dot.interactive-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = dot.getAttribute('data-node-id');
          const subId = dot.getAttribute('data-sub-id');
          openStageDrawer(subId, nodeId);
        });
      });

      // Setup click listener for latest-window in Col 3
      const latestWindow = card.querySelector('.latest-window');
      if (latestWindow) {
        latestWindow.addEventListener('click', (e) => {
          e.stopPropagation();
          const latestId = latestWindow.getAttribute('data-latest-id');
          const subId = latestWindow.getAttribute('data-sub-id');
          if (latestId) {
            openStageDrawer(subId, latestId);
          } else {
            toggleInlineStageEditor(card, true);
          }
        });
      }

      ganttBox.appendChild(card);
    });

    // Delegate inline event creation.
    ganttBox.querySelectorAll('.btn-pipeline-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleInlineStageEditor(btn.closest('.pipeline-card'), true);
      });
    });

    ganttBox.querySelectorAll('.btn-pipeline-open').forEach(btn => {
      btn.addEventListener('click', () => navigateToSubmissionDetails(btn.getAttribute('data-sub-id')));
    });

    ganttBox.querySelectorAll('.btn-inline-stage-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleInlineStageEditor(btn.closest('.pipeline-card'), false);
      });
    });

    ganttBox.querySelectorAll('.btn-pipeline-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTimelineEventManager(btn.getAttribute('data-sub-id'));
      });
    });

    ganttBox.querySelectorAll('.btn-pipeline-share').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        openSubmissionSharePreview(btn.getAttribute('data-sub-id'), btn);
      });
    });

    ganttBox.querySelectorAll('.zotero-card-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = badge.getAttribute('data-item-key');
        if (key && typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.selectItemInZotero(key);
        }
      });
    });

    ganttBox.querySelectorAll('.zotero-citekey-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const ck = badge.getAttribute('data-citekey');
        if (ck && typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.copyText(`[@${ck}]`, currentLanguage === 'zh' ? `已复制 Citation Key: [@${ck}]` : `Copied Citation Key: [@${ck}]`);
        }
      });
    });

    ganttBox.querySelectorAll('.zotero-pdf-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = badge.getAttribute('data-item-key');
        if (key && typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.openPdf(key);
        }
      });
    });

    ganttBox.querySelectorAll('.inline-stage-key').forEach(select => {
      select.addEventListener('change', () => {
        syncInlineStagePreset(select.closest('.inline-stage-editor'));
      });
    });

    ganttBox.querySelectorAll('.btn-inline-stage-save').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const editor = btn.closest('.inline-stage-editor');
        if (!editor || btn.disabled) return;
        setInlineStageBusy(editor, true);
        let errorMessage = '';
        try {
          await saveInlineStageEvent(editor);
        } catch (error) {
          errorMessage = error?.message || t('autoSaveFailed');
          showGlobalToast(errorMessage, 'error');
        } finally {
          if (editor.isConnected) setInlineStageBusy(editor, false, errorMessage);
        }
      });
    });

    ganttBox.querySelectorAll('.inline-stage-fields input').forEach(input => {
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        input.closest('.inline-stage-editor')?.querySelector('.btn-inline-stage-save')?.click();
      });
    });
  }


  // 2. Recent Research Logs (Removed)

  // 3. Timeline alerts and review milestones
  const reviewMilestones = document.getElementById('dashboard-pending-milestones');
  window.RFUI.setHTML(reviewMilestones, '');

  const timelineAlerts = [];
  db.submissions
    .filter(s => s.status !== 'rejected')
    .forEach(sub => {
      const man = db.manuscripts.find(m => m.id === sub.manuscriptId);
      (sub.timelineNodes || []).forEach(node => {
        const computedStatus = computeNodeStatus(node);
        const importantType = node.type === 'review' || node.type === 'revision' || node.type === 'publication';
        const actionable = computedStatus === 'overdue' || computedStatus === 'due_soon' || computedStatus === 'blocked' || node.status === 'active';
        const hasTimelineDate = Boolean(node.dueDate || node.planDate || node.completeDate);
        if (!actionable && !hasTimelineDate) return;
        if (!importantType && !actionable) return;
        if (computedStatus === 'completed') return;

        timelineAlerts.push({
          sub,
          node,
          computedStatus,
          title: `${getSubmissionJournalName(sub)}: ${getTimelineNodeDisplayName(node)}`,
          date: node.dueDate || node.planDate || node.completeDate || sub.revisionDueDate || '',
          manTitle: man ? man.title : t('untitledManuscript')
        });
      });
    });

  const statusRank = { overdue: 0, blocked: 1, due_soon: 2, in_progress: 3, not_started: 4, upcoming: 5 };
  timelineAlerts.sort((a, b) => {
    const ra = statusRank[a.computedStatus] ?? 9;
    const rb = statusRank[b.computedStatus] ?? 9;
    if (ra !== rb) return ra - rb;
    return new Date(a.date || '2999-12-31') - new Date(b.date || '2999-12-31');
  });

  if (timelineAlerts.length === 0) {
    window.RFUI.setHTML(reviewMilestones, `<p class="empty-state">${t('noUrgentEvents')}</p>`);
  } else {
    timelineAlerts.slice(0, 5).forEach(alert => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      item.title = alert.manTitle;

      const title = document.createElement('span');
      title.className = 'recent-item-title';
      title.textContent = alert.title;

      const badge = document.createElement('span');
      const badgeClass = alert.computedStatus === 'overdue' || alert.computedStatus === 'blocked'
        ? 'danger'
        : alert.computedStatus === 'due_soon'
          ? 'warning'
          : 'info';
      badge.className = `badge badge-${badgeClass}`;
      badge.textContent = getNodeStatusLabel(alert.computedStatus);

      const date = document.createElement('span');
      date.className = 'recent-item-date';
      date.textContent = alert.date ? formatShortDate(alert.date) : t('noDate');

      item.appendChild(title);
      item.appendChild(badge);
      item.appendChild(date);
      reviewMilestones.appendChild(item);
    });
  }
}

// --- PIPELINE TIMELINE HELPERS ---
function getSubmissionCycleTime(sub) {
  const start = sub.submissionDate ? new Date(sub.submissionDate) : (sub.createdAt ? new Date(sub.createdAt) : new Date());

  const isCompleted = sub.status === 'accepted' || sub.status === 'published';
  let end = new Date();

  if (isCompleted) {
    if (sub.decisionDate) {
      end = new Date(sub.decisionDate);
    } else {
      // Fallback: look for completed milestone nodes like '接收', 'Online'
      const completionNode = sub.timelineNodes?.find(n => {
        if (!n.name || !n.completeDate) return false;
        const nodeName = n.name.toLowerCase();
        return n.name.includes('接收') || nodeName.includes('accept') || nodeName.includes('online');
      });
      if (completionNode) {
        end = new Date(completionNode.completeDate);
      } else if (sub.updatedAt) {
        end = new Date(sub.updatedAt);
      }
    }
  }

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    days: diffDays,
    isCompleted: isCompleted,
    startDateStr: start.toLocaleDateString(),
    endDateStr: end.toLocaleDateString()
  };
}

function computeNodeStatus(node) {
  if (node.completeDate || node.status === 'completed') return 'completed';
  if (node.status === 'danger' || node.status === 'blocked') return 'blocked';

  if (node.dueDate) {
    const dueTime = new Date(node.dueDate).getTime();
    const now = new Date(); now.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueTime - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'due_soon';
  }

  if (node.status === 'active') return 'in_progress';
  if (node.status === 'pending') return 'not_started';
  return 'upcoming';
}

function getNodeStatusLabel(status) {
  const keyMap = {
    completed: 'statusCompleted',
    blocked: 'statusBlocked',
    overdue: 'statusOverdue',
    due_soon: 'statusDueSoon',
    in_progress: 'statusInProgress',
    not_started: 'statusPlannedNotStarted',
    upcoming: 'statusUpcoming'
  };
  return t(keyMap[status] || 'statusUpcoming');
}

function autoSortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const getDate = (n) => n.completeDate || n.planDate || n.dueDate || n.createdAt || '';
    const da = getDate(a);
    const db = getDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da) - new Date(db);
  });
}

function getCapsuleIcon(status, type) {
  if (status === 'completed') return '✓';
  if (status === 'blocked') return '✕';
  if (status === 'overdue') return '🔴';
  if (status === 'due_soon') return '⚠';
  if (status === 'in_progress') return '●';
  if (status === 'not_started' || status === 'upcoming') return '◯';
  if (status === 'milestone') return '⭐';
  return '◯';
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleDateString(locale, currentLanguage === 'zh'
      ? { month: 'numeric', day: 'numeric' }
      : { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function openStageDrawer(subId, nodeId) {
  const sub = db.submissions.find(s => s.id === subId);
  if (!sub) return;
  if (!Array.isArray(sub.timelineNodes)) sub.timelineNodes = [];

  const node = sub.timelineNodes.find(n => n.id === nodeId);
  if (!node) {
    showGlobalToast(t('eventNotFound'), 'error');
    renderDashboard();
    return;
  }

  const typeOptions = [
    { value: 'research', label: t('eventTypeResearch') },
    { value: 'writing', label: t('eventTypeWriting') },
    { value: 'submission', label: t('eventTypeSubmission') },
    { value: 'review', label: t('eventTypeReview') },
    { value: 'revision', label: t('eventTypeRevision') },
    { value: 'publication', label: t('eventTypePublication') },
    { value: 'special', label: t('specialException') }
  ];

  const keyOptions = [
    { value: 'auto', label: t('keyAuto') },
    { value: 'experiment_start', label: t('keyExperimentsStarted') },
    { value: 'experiment_done', label: t('keyExperimentsDone') },
    { value: 'draft_done', label: t('keyDraftDone') },
    { value: 'submit', label: t('keySubmitted') },
    { value: 'r1_comments', label: t('keyR1Comments') },
    { value: 'r1_revised', label: t('keyR1Resubmitted') },
    { value: 'r2_comments', label: t('keyR2Comments') },
    { value: 'r2_revised', label: t('keyR2Resubmitted') },
    { value: 'accept', label: t('keyAccepted') },
    { value: 'online', label: t('keyOnlinePublished') }
  ];
  const eventDateValue = normalizeDateString(node.completeDate || node.planDate || node.dueDate || '');

  openModal(`
    <div class="modal-header">
      <h2>${t('editTimelineEvent')}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal" title="${escapeHTML(t('close'))}">×</button>
    </div>

    <div class="stage-editor">
      <div class="form-group">
        <label>${t('eventName')}</label>
        <input type="text" id="drawer-node-name" value="${escapeHTML(node.name || '')}" placeholder="${escapeHTML(t('eventPlaceholder'))}">
      </div>

      <div class="stage-editor-grid">
        <div class="form-group">
          <label>${t('type')}</label>
          <select id="drawer-node-type">${buildOptions(typeOptions, node.type || 'research')}</select>
        </div>
        <div class="form-group">
          <label>${t('keyEventMapping')}</label>
          <select id="drawer-node-key">${buildOptions(keyOptions, node.key || 'auto')}</select>
        </div>
        <div class="form-group">
          <label>${t('eventDate')}</label>
          <input type="date" id="drawer-node-date" value="${escapeHTML(eventDateValue)}">
        </div>
      </div>

      <div class="stage-quick-row">
        <button class="btn-secondary btn-sm" id="drawer-btn-date-today">${t('setToday')}</button>
        <button class="btn-secondary btn-sm" id="drawer-btn-clear-date">${t('clearDate')}</button>
      </div>
      <p class="text-muted" style="font-size:11px; line-height:1.5; margin-top:8px;">${t('eventDateHelp')}</p>

      <div class="form-group">
        <label>${t('notes')}</label>
        <textarea id="drawer-node-notes" placeholder="${escapeHTML(t('notesPlaceholder'))}">${escapeHTML(node.notes || '')}</textarea>
      </div>
    </div>

    <div class="stage-modal-actions">
      <button class="btn-danger" id="drawer-btn-delete">${t('delete')}</button>
      <button class="btn-primary" id="drawer-btn-save">${t('saveChanges')}</button>
    </div>
  `);

  const setDate = (inputId, offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    document.getElementById(inputId).value = d.toISOString().slice(0, 10);
  };

  document.getElementById('drawer-btn-date-today').onclick = () => setDate('drawer-node-date');
  document.getElementById('drawer-btn-clear-date').onclick = () => {
    document.getElementById('drawer-node-date').value = '';
  };

  document.getElementById('drawer-btn-save').onclick = async () => {
    const nextName = document.getElementById('drawer-node-name').value.trim();
    if (!nextName) {
      alert(t('eventNameRequired'));
      return;
    }

    node.name = nextName;
    node.type = document.getElementById('drawer-node-type').value;
    node.key = document.getElementById('drawer-node-key').value;
    const eventDate = normalizeDateString(document.getElementById('drawer-node-date').value);
    node.status = eventDate ? 'completed' : 'pending';
    node.planDate = '';
    node.dueDate = '';
    node.completeDate = eventDate;
    node.notes = document.getElementById('drawer-node-notes').value.trim();
    node.updatedAt = new Date().toISOString();

    const nodeKey = inferKey(node);
    if (nodeKey === 'submit') {
      sub.submissionDate = eventDate ? dateInputToIso(eventDate) : null;
    } else if (nodeKey === 'r1_comments') {
      sub.firstDecisionDate = eventDate ? dateInputToIso(eventDate) : null;
    } else if (nodeKey === 'accept' || nodeKey === 'online') {
      if (eventDate) applyInlineEventToSubmission(sub, nodeKey, eventDate);
      else if (nodeKey === 'online') {
        sub.publishedAt = null;
        if (sub.status === 'published') sub.status = 'accepted';
      } else {
        sub.decisionDate = null;
        sub.acceptedAt = null;
      }
    }
    normalizeSubmissionTimeline(sub);
    syncManuscriptStatusFromSubmission(sub);

    await window.storage.saveAll(db);
    closeModal();
    renderDashboard();
    showGlobalToast(tf('eventSavedToast', { name: node.name }), 'success');
  };

  document.getElementById('drawer-btn-delete').onclick = async () => {
    if (confirm(tf('confirmDeleteEvent', { name: node.name }))) {
      deleteTimelineNode(sub, nodeId);
      syncManuscriptStatusFromSubmission(sub);
      await window.storage.saveAll(db);
      closeModal();
      renderDashboard();
      renderKanban();
      renderSubmissions();
      showGlobalToast(t('eventRemovedToast'), 'success');
    }
  };
}


// --- VIEW 4: MANUSCRIPTS KANBAN BOARD ---
function renderKanban() {
  const columns = ['idea', 'drafting', 'submitted', 'accepted'];
  columns.forEach(col => {
    window.RFUI.setHTML(document.getElementById(`cards-${col}`), '');
  });

  // Handle pending Zotero literature link banner
  const viewSection = document.getElementById('view-manuscripts');
  let banner = document.getElementById('zotero-link-banner');
  if (window._pendingZoteroLinkItem && viewSection) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'zotero-link-banner';
      banner.className = 'zotero-link-banner';
      const board = viewSection.querySelector('.kanban-board');
      if (board) viewSection.insertBefore(banner, board);
      else viewSection.prepend(banner);
    }
    const pItem = window._pendingZoteroLinkItem;
    window.RFUI.setHTML(banner, `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">📎</span>
        <div>
          <div style="font-weight:600; color:hsl(var(--text-primary));">正在关联 Zotero 文献：${escapeHTML(pItem.title || '无标题文献')}</div>
          <div style="font-size:11px; color:hsl(var(--text-secondary));">${escapeHTML(pItem.authors || '')} ${pItem.year ? `· ${escapeHTML(pItem.year)}` : ''} ${pItem.publication ? `· ${escapeHTML(pItem.publication)}` : ''}</div>
        </div>
      </div>
      <button class="btn-secondary" id="btn-cancel-zotero-link" style="padding:4px 10px; font-size:12px;">取消关联</button>
    `);
    document.getElementById('btn-cancel-zotero-link')?.addEventListener('click', () => {
      window._pendingZoteroLinkItem = null;
      renderKanban();
    });
  } else if (banner) {
    banner.remove();
  }

  const mCount = { idea: 0, drafting: 0, submitted: 0, accepted: 0 };
  let visibleManuscripts = db.manuscripts || [];
  if (window._activeZoteroCollectionFilter && window._activeZoteroCollectionItemKeys) {
    visibleManuscripts = visibleManuscripts.filter(m =>
      m.zoteroItemKey && window._activeZoteroCollectionItemKeys.has(m.zoteroItemKey)
    );
  }

  visibleManuscripts.forEach(m => {
    // Map granular status to simple column headers
    let col = 'idea';
    if (m.status === 'outline' || m.status === 'idea' || m.status === 'data_collection') col = 'idea';
    else if (m.status === 'drafting' || m.status === 'figure_preparation' || m.status === 'internal_review' || m.status === 'rejected') col = 'drafting';
    else if (m.status === 'submitted' || m.status === 'under_review' || m.status === 'revision') col = 'submitted';
    else if (m.status === 'accepted' || m.status === 'published') col = 'accepted';

    mCount[col]++;
    const linkedSubmission = window.RFCore.getCurrentSubmission(db, m.id);
    const currentJournal = linkedSubmission?.targetJournal || linkedSubmission?.journalName || m.targetJournals?.[0] || (currentLanguage === 'zh' ? '待定' : 'TBD');

    const card = document.createElement('div');
    card.className = `glass-card kanban-card kanban-status-${normalizeKanbanStatusClass(m.status)}`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', m.id);
    card.setAttribute('data-manuscript-id', m.id);

    let zoteroRowHtml = '';
    if (m.zoteroItemKey) {
      zoteroRowHtml = `
        <div class="kanban-zotero-row">
          <span class="zotero-card-badge" data-item-key="${escapeHTML(m.zoteroItemKey)}" title="在 Zotero 文献库中选中此条目">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H6.4l5.6 6v2H2v-2h7.6L4 5V3z"/></svg>
            Zotero
          </span>
          ${m.citekey ? `
          <span class="zotero-citekey-badge" id="badge-citekey-${m.id}" data-citekey="${escapeHTML(m.citekey)}" title="点击复制 Citation Key">
            [@${escapeHTML(m.citekey)}]
          </span>` : ''}
          ${m.pdfUri ? `
          <span class="zotero-pdf-badge" data-item-key="${escapeHTML(m.zoteroItemKey)}" title="在 Zotero PDF 阅读器中打开">
            📖 PDF
          </span>` : ''}
          ${m.annotationCount ? `
          <span class="zotero-anno-badge" title="包含 ${m.annotationCount} 条 Zotero PDF 高亮批注">
            📑 ${m.annotationCount}
          </span>` : ''}
          <span class="zotero-sync-note-badge" id="badge-sync-note-${m.id}" data-item-key="${escapeHTML(m.zoteroItemKey)}" title="同步审稿进展至 Zotero 云端笔记">
            📝 同步
          </span>
        </div>
      `;
    }

    const pendingLinkBtnHtml = window._pendingZoteroLinkItem ? `
      <button class="btn-primary" style="padding: 2px 8px; font-size:10px; height: 24px; background:#cc292b; border-color:#cc292b;" id="btn-link-this-${m.id}">🔗 ${currentLanguage === 'zh' ? '关联此文献' : 'Link Item'}</button>
    ` : '';

    const targetJournalLabel = currentLanguage === 'zh' ? '目标期刊' : 'Target';
    const editLabel = currentLanguage === 'zh' ? '编辑' : 'Edit';

    window.RFUI.setHTML(card, `
      <div class="kanban-card-title-row">
        <h4 title="${escapeHTML(m.title)}">${escapeHTML(m.title)}</h4>
      </div>
      <div class="kanban-card-meta-row">
        <span class="kanban-status-pill">${escapeHTML(getManuscriptStatusLabel(m.status))}</span>
        <p>${targetJournalLabel}: <strong>${escapeHTML(currentJournal)}</strong></p>
      </div>
      ${zoteroRowHtml}
      <div class="kanban-card-controls">
        <select class="kanban-card-select" id="sel-man-status-${m.id}" aria-label="${escapeHTML(t('status'))}: ${escapeHTML(m.title)}">
          <option value="idea" ${m.status === 'idea' ? 'selected' : ''}>${escapeHTML(t('statusIdea'))}</option>
          <option value="outline" ${m.status === 'outline' ? 'selected' : ''}>${escapeHTML(t('statusOutline'))}</option>
          <option value="figure_preparation" ${m.status === 'figure_preparation' ? 'selected' : ''}>${escapeHTML(t('statusFiguresPrep'))}</option>
          <option value="drafting" ${m.status === 'drafting' ? 'selected' : ''}>${escapeHTML(t('statusDrafting'))}</option>
          <option value="internal_review" ${m.status === 'internal_review' ? 'selected' : ''}>${escapeHTML(t('statusInternalReview'))}</option>
          <option value="submitted" ${m.status === 'submitted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('submitted'))}</option>
          <option value="under_review" ${m.status === 'under_review' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('under_review'))}</option>
          <option value="revision" ${m.status === 'revision' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('revision'))}</option>
          <option value="accepted" ${m.status === 'accepted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('accepted'))}</option>
          <option value="published" ${m.status === 'published' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('published'))}</option>
          <option value="rejected" ${m.status === 'rejected' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('rejected'))}</option>
        </select>
        <div class="kanban-card-actions">
          ${pendingLinkBtnHtml}
          ${linkedSubmission ? `<button type="button" class="btn-secondary btn-open-linked-submission" data-sub-id="${escapeHTML(linkedSubmission.id)}" aria-label="${escapeHTML(t('openSubmissionDetails'))}: ${escapeHTML(m.title)}">${escapeHTML(t('openSubmissionDetails'))}</button>` : ''}
          <button type="button" class="btn-secondary btn-edit-manuscript" id="btn-edit-man-${m.id}">${editLabel}</button>
        </div>
      </div>
    `);

    // HTML5 Drag Event Listeners
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', m.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    document.getElementById(`cards-${col}`).appendChild(card);

    card.querySelector('.btn-open-linked-submission')?.addEventListener('click', event => {
      event.stopPropagation();
      navigateToSubmissionDetails(event.currentTarget.dataset.subId);
    });

    // Bind status change dropdown
    document.getElementById(`sel-man-status-${m.id}`).addEventListener('change', async (e) => {
      try {
        const result = await persistManuscriptStatusChange(m, e.target.value);
        if (m.zoteroItemKey && typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.syncStatusTag(m.zoteroItemKey, e.target.value);
          ZoteroBridge.addToPipelineCollection(m.zoteroItemKey);
        }
        renderKanban();
        renderDashboard();
        renderSubmissions();
        showGlobalToast(t('manuscriptStatusUpdated'), 'success');
        if (result.shouldCelebrate) {
          showAcceptanceCelebration({ title: result.manuscript.title, manuscriptId: result.manuscript.id });
        }
      } catch (error) {
        console.error('Manuscript status save failed:', error);
        renderKanban();
        showGlobalToast(error.message || t('autoSaveFailed'), 'error');
      }
    });

    // Bind edit button
    document.getElementById(`btn-edit-man-${m.id}`).addEventListener('click', () => {
      openManuscriptModal(m);
    });

    // Pending link button
    const btnLinkThis = card.querySelector(`#btn-link-this-${m.id}`);
    if (btnLinkThis) {
      btnLinkThis.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pItem = window._pendingZoteroLinkItem;
        if (!pItem) return;
        m.zoteroItemKey = pItem.key;
        m.zoteroUri = pItem.zoteroUri;
        m.pdfUri = pItem.pdfUri;
        if (!m.doi && pItem.doi) m.doi = pItem.doi;
        m.updatedAt = new Date().toISOString();
        await window.storage.saveAll(db);
        window._pendingZoteroLinkItem = null;
        renderKanban();
        showGlobalToast(`已将文献《${(pItem.title || '').slice(0, 18)}…》成功关联到稿件！`, 'success');
        if (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) {
          ZoteroBridge.syncNote(m.zoteroItemKey);
        }
      });
    }

    // Zotero badge clicks
    const zoteroBadge = card.querySelector('.zotero-card-badge');
    if (zoteroBadge) {
      zoteroBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.selectItemInZotero(m.zoteroItemKey);
        }
      });
    }

    const pdfBadge = card.querySelector('.zotero-pdf-badge');
    if (pdfBadge) {
      pdfBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.openPdf(m.zoteroItemKey);
        }
      });
    }

    const citeBadge = card.querySelector(`#badge-citekey-${m.id}`);
    if (citeBadge && m.citekey) {
      citeBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof ZoteroBridge !== 'undefined') {
          ZoteroBridge.copyText(`[@${m.citekey}]`, currentLanguage === 'zh' ? `已复制 Citation Key: [@${m.citekey}]` : `Copied Citation Key: [@${m.citekey}]`);
        }
      });
    }

    const syncBadge = card.querySelector(`#badge-sync-note-${m.id}`);
    if (syncBadge) {
      syncBadge.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (typeof ZoteroBridge !== 'undefined') {
          syncBadge.textContent = currentLanguage === 'zh' ? '⏳ 同步中' : '⏳ Syncing';
          const ok = await ZoteroBridge.syncNote(m.zoteroItemKey);
          if (ok) {
            syncBadge.textContent = currentLanguage === 'zh' ? '✅ 已同步' : '✅ Synced';
            showGlobalToast(currentLanguage === 'zh' ? '审稿进展已成功同步至 Zotero 云端笔记！' : 'Synced pipeline progress to Zotero child note!', 'success');
            setTimeout(() => { syncBadge.textContent = currentLanguage === 'zh' ? '📝 同步' : '📝 Sync'; }, 2000);
          } else {
            syncBadge.textContent = currentLanguage === 'zh' ? '❌ 失败' : '❌ Failed';
            setTimeout(() => { syncBadge.textContent = currentLanguage === 'zh' ? '📝 同步' : '📝 Sync'; }, 2000);
          }
        }
      });
    }
  });

  columns.forEach(col => {
    document.getElementById(`count-${col}`).textContent = mCount[col];
    document.querySelector(`.kanban-col[data-status="${col}"]`)?.classList.toggle('is-empty', mCount[col] === 0);

    // HTML5 Column Drop Event Listeners
    const colCardsContainer = document.getElementById(`cards-${col}`);
    if (!colCardsContainer.dataset.dragBound) {
      colCardsContainer.dataset.dragBound = 'true';

      colCardsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        colCardsContainer.classList.add('drag-over');
      });

      colCardsContainer.addEventListener('dragleave', () => {
        colCardsContainer.classList.remove('drag-over');
      });

      colCardsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        colCardsContainer.classList.remove('drag-over');

        const manuscriptId = e.dataTransfer.getData('text/plain');
        const man = db.manuscripts.find(x => x.id === manuscriptId);
        if (man) {
          // Move status to the category column
          let newStatus = col;
          if (col === 'idea') newStatus = 'idea';
          else if (col === 'drafting') newStatus = 'drafting';
          else if (col === 'submitted') newStatus = 'submitted';
          else if (col === 'accepted') newStatus = 'accepted';

          try {
            const result = await persistManuscriptStatusChange(man, newStatus);
            renderKanban();
            renderDashboard();
            renderSubmissions();
            showGlobalToast(tf('manuscriptStatusUpdatedTo', { status: getManuscriptStatusLabel(newStatus) }), 'success');
            if (result.shouldCelebrate) {
              showAcceptanceCelebration({ title: result.manuscript.title, manuscriptId: result.manuscript.id });
            }
          } catch (error) {
            console.error('Manuscript status drop save failed:', error);
            renderKanban();
            showGlobalToast(error.message || t('autoSaveFailed'), 'error');
          }
        }
      });
    }
  });
  document.querySelector('.kanban-board')?.classList.toggle('all-empty', visibleManuscripts.length === 0);
  setText('#kanban-stage-summary', tf('kanbanStageSummary', { count: columns.filter(col => mCount[col] > 0).length, total: columns.length }));
  updateKanbanEmptyColumns();
}

function normalizeKanbanStatusClass(status) {
  const normalized = normalizeText(status || 'idea').replace(/_/g, '-');
  if (['idea', 'outline', 'data-collection'].includes(normalized)) return normalized;
  if (['figure-preparation', 'drafting', 'internal-review'].includes(normalized)) return normalized;
  if (['submitted', 'under-review', 'revision'].includes(normalized)) return normalized;
  if (['accepted', 'published'].includes(normalized)) return normalized;
  return 'idea';
}

function getManuscriptStatusLabel(status) {
  const labels = {
    idea: t('statusIdea'),
    outline: t('statusOutline'),
    data_collection: currentLanguage === 'zh' ? '数据整理' : 'Data Collection',
    figure_preparation: t('statusFiguresPrep'),
    drafting: t('statusDrafting'),
    internal_review: t('statusInternalReview'),
    submitted: getSubmissionStatusLabel('submitted'),
    under_review: getSubmissionStatusLabel('under_review'),
    revision: getSubmissionStatusLabel('revision'),
    accepted: getSubmissionStatusLabel('accepted'),
    published: getSubmissionStatusLabel('published'),
    rejected: getSubmissionStatusLabel('rejected')
  };
  return labels[status] || String(status || 'idea').replace(/_/g, ' ');
}

function getSubmissionStatusLabel(status) {
  const canonicalStatus = normalizeSubmissionStatus(status);
  const labels = {
    submitted: t('stateSubmitted'),
    under_review: t('stateUnderReview'),
    revision: t('eventTypeRevision'),
    accepted: t('stateAccepted'),
    published: currentLanguage === 'zh' ? '已发表' : 'Published',
    rejected: t('statusRejected')
  };
  return labels[canonicalStatus] || String(canonicalStatus || t('stateSubmitted')).replace(/_/g, ' ');
}

// Add/Edit Manuscript Modal
document.getElementById('btn-add-manuscript').addEventListener('click', () => {
  openManuscriptModal(null);
});

function splitAcademicAuthors(value) {
  if (Array.isArray(value)) return value.map(normalizeAuthorName).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  let authors = text
    .split(/\s*(?:;|；|\n|\band\b|、)\s*/i)
    .map(author => author.trim())
    .filter(Boolean);
  if (authors.length === 1 && text.includes(',')) {
    const commaAuthors = text.split(/\s*,\s*/).map(author => author.trim()).filter(Boolean);
    if (
      commaAuthors.length > 1
      && commaAuthors.length <= 30
      && commaAuthors.every(author => author.split(/\s+/).length <= 6)
    ) {
      authors = commaAuthors;
    }
  }
  return authors;
}

function normalizeAcademicTitle(value) {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeAcademicUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid']
      .forEach(key => url.searchParams.delete(key));
    return url.href.replace(/\/$/, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function findAcademicManuscriptMatch({ title, doi, articleUrl }) {
  const normalizedDoi = normalizeDoi(doi);
  const normalizedUrl = normalizeAcademicUrl(articleUrl);
  const normalizedTitle = normalizeAcademicTitle(title);
  return db.manuscripts.find(manuscript => {
    const manuscriptDoi = normalizeDoi(manuscript.doi);
    if (normalizedDoi && manuscriptDoi && normalizedDoi === manuscriptDoi) return true;
    const manuscriptUrl = normalizeAcademicUrl(manuscript.articleUrl);
    if (normalizedUrl && manuscriptUrl && normalizedUrl === manuscriptUrl) return true;
    return normalizedTitle
      && normalizedTitle.length >= 16
      && normalizedTitle === normalizeAcademicTitle(manuscript.title);
  }) || null;
}

function academicCaptureProvenance(prefill) {
  if (!prefill) return null;
  return {
    sourceType: prefill.sourceType || 'zotero-library',
    sourceHost: prefill.sourceHost || '',
    sourcePageUrl: prefill.sourcePageUrl || '',
    pdfUrl: prefill.pdfUrl || '',
    confidenceScore: Number(prefill.confidenceScore) || 0,
    capturedAt: new Date().toISOString(),
    reviewedByUser: true
  };
}

function buildAcademicCaptureSummary(prefill) {
  if (!prefill) return '';
  const source = prefill.sourceHost || prefill.sourceType || 'Zotero';
  const confidence = Math.max(0, Math.min(Number(prefill.confidenceScore) || 0, 100));
  return `
    <section class="academic-capture-review" aria-label="${escapeHTML(t('academicCaptureSource'))}">
      <div class="academic-capture-review-icon" aria-hidden="true">S</div>
      <div>
        <strong>${escapeHTML(t('academicCaptureSource'))}</strong>
        <span>${escapeHTML(source)}</span>
      </div>
      <div class="academic-capture-confidence">
        <strong>${escapeHTML(t('academicCaptureConfidence'))}</strong>
        <span>${confidence}%</span>
      </div>
    </section>
  `;
}

function openManuscriptModal(man = null, prefill = null) {
  const isEdit = !!man;
  const initialTitle = isEdit ? man.title : prefill?.title;
  const initialJournal = isEdit ? man.targetJournals?.[0] : prefill?.publication;
  const initialAbstract = isEdit ? man.abstract : prefill?.abstract;
  const initialAuthors = isEdit
    ? (Array.isArray(man.authors) ? man.authors.join('; ') : man.authors)
    : (Array.isArray(prefill?.authorList) && prefill.authorList.length
      ? prefill.authorList.join('; ')
      : prefill?.authors);
  const initialDoi = isEdit ? man.doi : prefill?.doi;
  const initialArticleUrl = isEdit ? man.articleUrl : (prefill?.articleUrl || prefill?.pdfUrl);
  const initialStatus = isEdit
    ? man.status
    : (prefill?.status || (prefill?.isCapturedPublication ? 'published' : 'idea'));

  let currentZoteroItemKey = isEdit ? (man.zoteroItemKey || null) : (prefill?.zoteroItemKey || null);
  let currentZoteroUri = isEdit ? (man.zoteroUri || null) : (prefill?.zoteroUri || null);
  let currentPdfUri = isEdit ? (man.pdfUri || null) : (prefill?.pdfUri || null);
  let currentCiteKey = isEdit ? (man.citekey || '') : (prefill?.citekey || '');
  let currentBibtex = isEdit ? (man.bibtex || '') : (prefill?.bibtex || '');
  let currentCitationApa = isEdit ? (man.citationApa || '') : (prefill?.citationApa || '');
  let currentRelatedItems = isEdit ? (man.relatedItems || []) : (prefill?.relatedItems || []);

  const isZoteroEnv = Boolean(
    (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
    (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero))
  );

  const zoteroActionBarHtml = isZoteroEnv ? `
    <div class="zotero-modal-action-bar" id="zotero-modal-hub" style="background:var(--material-background, rgba(0,0,0,0.02)); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div id="zotero-bind-status" style="font-size:12px; display:flex; align-items:center; gap:8px; cursor:pointer;" title="点击检索或关联 Zotero 文献库">
          ${currentZoteroItemKey
            ? `<span style="color:#059669; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                已关联 Zotero 文献条目
              </span>`
            : `<span style="color:#64748b; font-weight:500; display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                ${escapeHTML(currentLanguage === 'zh' ? '未绑定 Zotero 文献条目 (点击可搜索关联)' : 'No Zotero item linked (Click to search)')}
              </span>`}
          <span id="zotero-modal-citekey" class="zotero-citekey-badge" style="${currentCiteKey ? '' : 'display:none;'}" title="点击复制 Citation Key">[@${escapeHTML(currentCiteKey)}]</span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button type="button" class="btn-secondary" id="btn-zotero-fetch-active" style="padding:4px 9px; font-size:11px; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" title="读取 Zotero 当前选中的文献条目并自动填充各字段">
            📥 从当前选中导入
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-toggle-search" style="padding:4px 9px; font-size:11px; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" title="在 Zotero 文献库中按关键词检索文献">
            🔍 检索文献库
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-copy-bib" style="padding:4px 8px; font-size:11px; color:#475569; ${currentBibtex ? '' : 'display:none;'}" title="复制 BibTeX 引用条目">
            📋 BibTeX
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-copy-apa" style="padding:4px 8px; font-size:11px; color:#475569; ${currentCitationApa ? '' : 'display:none;'}" title="复制标准引用 (APA)">
            📋 引用
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-toggle-annos" style="padding:4px 8px; font-size:11px; color:#d97706; ${currentZoteroItemKey ? '' : 'display:none;'}" title="查看并引用 Zotero 研读资产库：PDF划线批注、独立文献笔记、知识库分类与标签">
            📑 研读资产
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-open-pdf" style="padding:4px 8px; font-size:11px; color:#059669; ${currentZoteroItemKey ? '' : 'display:none;'}" title="在 Zotero 阅读器中打开 PDF">
            📖 原文 PDF
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-sync-note" style="padding:4px 8px; font-size:11px; color:#cc292b; border-color:rgba(204,41,43,0.3); font-weight:500; ${currentZoteroItemKey ? '' : 'display:none;'}" title="同步稿件进展至 Zotero 云笔记">
            📝 同步笔记
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-locate" style="padding:4px 8px; font-size:11px; ${currentZoteroItemKey ? '' : 'display:none;'}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 文献库中定位该条目' : 'Locate item in Zotero library')}">
            🔗 ${escapeHTML(currentLanguage === 'zh' ? '定位' : 'Locate')}
          </button>
          <button type="button" class="btn-secondary" id="btn-zotero-unlink" style="padding:4px 8px; font-size:11px; color:#ef4444; ${currentZoteroItemKey ? '' : 'display:none;'}" title="${escapeHTML(currentLanguage === 'zh' ? '解除与 Zotero 文献的绑定' : 'Unlink from Zotero item')}">
            ✕ ${escapeHTML(currentLanguage === 'zh' ? '解绑' : 'Unlink')}
          </button>
        </div>
      </div>

      <!-- Quick Active Item Prompt Banner -->
      <div id="zotero-active-item-banner" style="display:none; background:rgba(37, 99, 235, 0.08); border:1px solid rgba(37, 99, 235, 0.25); border-radius:6px; padding:7px 10px; font-size:11.5px; color:#1d4ed8; justify-content:space-between; align-items:center;">
        <span id="zotero-active-item-text" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:78%;"></span>
        <button type="button" class="btn-primary" id="btn-zotero-quick-bind-active" style="padding:3px 9px; font-size:11px; cursor:pointer; flex-shrink:0;">⚡ 一键关联填入</button>
      </div>

      <!-- Live Search Box with Dropdown -->
      <div id="zotero-search-container" style="position:relative; width:100%; display:${currentZoteroItemKey ? 'none' : 'block'};">
        <input type="text" id="ipt-zotero-live-search" placeholder="${escapeHTML(currentLanguage === 'zh' ? '🔍 检索 Zotero 10 文献库 (输入标题/作者/DOI/年份) 快速关联并填充...' : '🔍 Search Zotero 10 library (title/author/DOI/year) to link...')}" style="font-size:12px; padding:7px 10px; width:100%; box-sizing:border-box; background:var(--input-bg); color:hsl(var(--text-primary)); border:1px solid var(--input-border); border-radius:6px; outline:none;">
        <div id="zotero-search-results-dropdown" class="zotero-search-dropdown" style="display:none;"></div>
      </div>

      <div id="man-zotero-annotations-panel" class="zotero-annotations-panel" style="display:none;"></div>
      <div id="man-zotero-related-panel" style="display:none; font-size:11px; color:hsl(var(--text-secondary));">
        <strong>🔗 Zotero 关联文献网络：</strong>
        <div id="man-zotero-related-chips" class="zotero-related-chips"></div>
      </div>
    </div>
  ` : '';

  openModal(`
    <div class="modal-header">
      <h2>${escapeHTML(isEdit ? t('editManuscriptMetadata') : t('addNewManuscriptTitle'))}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal" title="关闭">✕</button>
    </div>

    ${buildAcademicCaptureSummary(prefill)}
    ${zoteroActionBarHtml}

    <div class="form-group">
      <label>${escapeHTML(t('manuscriptTitleLabel'))}</label>
      <input type="text" id="man-title" value="${escapeHTML(initialTitle || '')}" placeholder="${escapeHTML(t('paperTitlePlaceholder'))}">
    </div>

    <div class="grid-cols-2">
      <div class="form-group">
        <label>${escapeHTML(t('writingStatus'))}</label>
        <select id="man-status">
          <option value="idea" ${initialStatus === 'idea' ? 'selected' : ''}>${escapeHTML(t('statusIdea'))}</option>
          <option value="outline" ${initialStatus === 'outline' ? 'selected' : ''}>${escapeHTML(t('statusOutline'))}</option>
          <option value="figure_preparation" ${initialStatus === 'figure_preparation' ? 'selected' : ''}>${escapeHTML(t('statusFiguresPrep'))}</option>
          <option value="drafting" ${initialStatus === 'drafting' ? 'selected' : ''}>${escapeHTML(t('statusDrafting'))}</option>
          <option value="internal_review" ${initialStatus === 'internal_review' ? 'selected' : ''}>${escapeHTML(t('statusInternalReview'))}</option>
          <option value="submitted" ${initialStatus === 'submitted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('submitted'))}</option>
          <option value="under_review" ${initialStatus === 'under_review' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('under_review'))}</option>
          <option value="revision" ${initialStatus === 'revision' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('revision'))}</option>
          <option value="accepted" ${initialStatus === 'accepted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('accepted'))}</option>
          <option value="published" ${initialStatus === 'published' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('published'))}</option>
          <option value="rejected" ${initialStatus === 'rejected' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('rejected'))}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${escapeHTML(t('targetJournalInput'))}</label>
        <input type="text" id="man-journal" value="${escapeHTML(initialJournal || '')}" placeholder="${escapeHTML(t('targetJournalPlaceholder'))}">
      </div>
    </div>

    <div class="form-group">
      <label>${escapeHTML(t('authorsLabel'))}</label>
      <input type="text" id="man-authors" value="${escapeHTML(initialAuthors || '')}" placeholder="A. Researcher; B. Scientist">
    </div>

    <div class="grid-cols-2">
      <div class="form-group">
        <label>${escapeHTML(t('doiLabel'))}</label>
        <input type="text" id="man-doi" value="${escapeHTML(initialDoi || '')}" placeholder="10.xxxx/xxxxx">
      </div>
      <div class="form-group">
        <label>${escapeHTML(t('scholarSourcePage'))}</label>
        <input type="url" id="man-article-url" value="${escapeHTML(initialArticleUrl || '')}" placeholder="https://…">
      </div>
    </div>

    <div class="form-group">
      <label>${escapeHTML(t('abstractDraft'))}</label>
      <textarea id="man-abstract" placeholder="${escapeHTML(t('abstractPlaceholder'))}">${escapeHTML(initialAbstract || '')}</textarea>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-cancel-man">${escapeHTML(t('cancel') || '取消')}</button>
      <button type="button" class="btn-primary" id="btn-submit-man" style="min-width:120px;">${escapeHTML(isEdit ? t('saveChanges') : t('createManuscript'))}</button>
    </div>
  `);

  document.getElementById('btn-cancel-man')?.addEventListener('click', closeModal);

  if (isZoteroEnv) {
    const applyItemToForm = (item) => {
      if (!item) return;
      if (item.title) document.getElementById('man-title').value = item.title;
      if (item.publication) document.getElementById('man-journal').value = item.publication;
      if (item.authors) document.getElementById('man-authors').value = item.authors;
      if (item.doi) document.getElementById('man-doi').value = item.doi;
      if (item.url) document.getElementById('man-article-url').value = item.url;
      if (item.abstract) document.getElementById('man-abstract').value = item.abstract;
      updateZoteroBindUI(item);
      const searchContainer = document.getElementById('zotero-search-container');
      if (searchContainer) searchContainer.style.display = 'none';
      showGlobalToast(`已关联并填充文献《${(item.title || '').slice(0, 18)}…》元数据`, 'success');
      if (typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.showNativeToast('文献已关联', item.title, 'success');
      }
    };

    const updateZoteroBindUI = (item) => {
      const statusEl = document.getElementById('zotero-bind-status');
      const pdfBtn = document.getElementById('btn-zotero-open-pdf');
      const syncBtn = document.getElementById('btn-zotero-sync-note');
      const locateBtn = document.getElementById('btn-zotero-locate');
      const unlinkBtn = document.getElementById('btn-zotero-unlink');
      const bibBtn = document.getElementById('btn-zotero-copy-bib');
      const apaBtn = document.getElementById('btn-zotero-copy-apa');
      const annoBtn = document.getElementById('btn-zotero-toggle-annos');
      const searchContainer = document.getElementById('zotero-search-container');

      if (item && item.key) {
        currentZoteroItemKey = item.key;
        currentZoteroUri = item.zoteroUri;
        currentPdfUri = item.pdfUri;
        currentCiteKey = item.citekey || '';
        currentBibtex = item.bibtex || '';
        currentCitationApa = item.citationApa || '';
        currentRelatedItems = item.relatedItems || [];

        if (statusEl) {
          window.RFUI.setHTML(statusEl, `<span style="color:#059669; font-weight:600; display:inline-flex; align-items:center; gap:5px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>已关联: ${escapeHTML((item.title || '').slice(0, 22))}…</span>`);
          if (currentCiteKey) {
            const citeEl = document.createElement('span');
            citeEl.className = 'zotero-citekey-badge';
            citeEl.textContent = `[@${currentCiteKey}]`;
            citeEl.title = '点击复制 Citation Key';
            citeEl.addEventListener('click', (e) => {
              e.stopPropagation();
              if (typeof ZoteroBridge !== 'undefined') {
                ZoteroBridge.copyText(`[@${currentCiteKey}]`, `已复制 Citation Key: [@${currentCiteKey}]`);
              }
            });
            statusEl.appendChild(citeEl);
          }
        }
        if (pdfBtn) pdfBtn.style.display = item.pdfUri ? '' : 'none';
        if (syncBtn) syncBtn.style.display = '';
        if (locateBtn) locateBtn.style.display = '';
        if (unlinkBtn) unlinkBtn.style.display = '';
        if (bibBtn) bibBtn.style.display = currentBibtex ? '' : 'none';
        if (apaBtn) apaBtn.style.display = currentCitationApa ? '' : 'none';
        if (annoBtn) annoBtn.style.display = '';
        if (searchContainer) searchContainer.style.display = 'none';

        // Render related items if present
        const relPanel = document.getElementById('man-zotero-related-panel');
        const relChips = document.getElementById('man-zotero-related-chips');
        if (relPanel && relChips && Array.isArray(item.relatedItems) && item.relatedItems.length > 0) {
          window.RFUI.setHTML(relChips, '');
          item.relatedItems.forEach(r => {
            const chip = document.createElement('span');
            chip.className = 'zotero-related-chip';
            chip.textContent = `${(r.title || '').slice(0, 16)}… (${r.year || ''})`;
            chip.title = `${r.title} - ${r.authors} (点击在文献库定位)`;
            chip.addEventListener('click', () => {
              if (typeof ZoteroBridge !== 'undefined') {
                ZoteroBridge.selectItemInZotero(r.key);
              }
            });
            relChips.appendChild(chip);
          });
          relPanel.style.display = 'block';
        } else if (relPanel) {
          relPanel.style.display = 'none';
        }
      } else {
        currentZoteroItemKey = null;
        currentZoteroUri = null;
        currentPdfUri = null;
        currentCiteKey = '';
        currentBibtex = '';
        currentCitationApa = '';
        currentRelatedItems = [];
        if (statusEl) {
          window.RFUI.setHTML(statusEl, `<span style="color:#64748b; font-weight:500; display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>${escapeHTML(currentLanguage === 'zh' ? '未绑定 Zotero 文献条目 (点击可搜索关联)' : 'No Zotero item linked (Click to search)')}</span>`);
        }
        if (pdfBtn) pdfBtn.style.display = 'none';
        if (syncBtn) syncBtn.style.display = 'none';
        if (locateBtn) locateBtn.style.display = 'none';
        if (unlinkBtn) unlinkBtn.style.display = 'none';
        if (bibBtn) bibBtn.style.display = 'none';
        if (apaBtn) apaBtn.style.display = 'none';
        if (annoBtn) annoBtn.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'block';
        const relPanel = document.getElementById('man-zotero-related-panel');
        if (relPanel) relPanel.style.display = 'none';
        const annoPanel = document.getElementById('man-zotero-annotations-panel');
        if (annoPanel) annoPanel.style.display = 'none';
      }
    };

    // Auto-detect currently active item in Zotero asynchronously
    setTimeout(async () => {
      try {
        if (typeof ZoteroBridge !== 'undefined' && !currentZoteroItemKey) {
          const activeItem = await ZoteroBridge.getActiveItem();
          const banner = document.getElementById('zotero-active-item-banner');
          const textEl = document.getElementById('zotero-active-item-text');
          const quickBindBtn = document.getElementById('btn-zotero-quick-bind-active');
          if (activeItem && activeItem.title && banner && textEl) {
            window.RFUI.setHTML(textEl, `📌 <strong>检测到 Zotero 选中文献：</strong>《${escapeHTML(activeItem.title)}》`);
            banner.style.display = 'flex';
            quickBindBtn?.addEventListener('click', () => {
              applyItemToForm(activeItem);
              banner.style.display = 'none';
            });
          }
        }
      } catch (_) {}
    }, 60);

    // Clicking bind status card focuses / opens search
    document.getElementById('zotero-bind-status')?.addEventListener('click', () => {
      const searchContainer = document.getElementById('zotero-search-container');
      const searchInput = document.getElementById('ipt-zotero-live-search');
      if (searchContainer) {
        searchContainer.style.display = 'block';
        searchInput?.focus();
      }
    });

    document.getElementById('btn-zotero-toggle-search')?.addEventListener('click', () => {
      const searchContainer = document.getElementById('zotero-search-container');
      const searchInput = document.getElementById('ipt-zotero-live-search');
      if (searchContainer) {
        searchContainer.style.display = searchContainer.style.display === 'none' ? 'block' : 'none';
        if (searchContainer.style.display === 'block') searchInput?.focus();
      }
    });

    // Citekey, BibTeX, and APA buttons
    document.getElementById('zotero-modal-citekey')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCiteKey && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.copyText(`[@${currentCiteKey}]`, `已复制 Citation Key: [@${currentCiteKey}]`);
      }
    });

    document.getElementById('btn-zotero-copy-bib')?.addEventListener('click', () => {
      if (currentBibtex && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.copyText(currentBibtex, '已复制 BibTeX 引用条目');
      }
    });

    document.getElementById('btn-zotero-copy-apa')?.addEventListener('click', () => {
      if (currentCitationApa && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.copyText(currentCitationApa, '已复制标准引用 (APA)');
      }
    });

    // Annotations panel toggle & load
    document.getElementById('btn-zotero-toggle-annos')?.addEventListener('click', async () => {
      const panel = document.getElementById('man-zotero-annotations-panel');
      if (!panel || !currentZoteroItemKey || typeof ZoteroBridge === 'undefined') return;
      if (panel.style.display !== 'none') {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'flex';
      window.RFUI.setHTML(panel, '<div style="font-size:11px; color:#64748b; padding:8px; text-align:center;">⏳ 正在读取 Zotero 研读资产库 (PDF划线、独立笔记、分类标签)...</div>');

      const assets = typeof ZoteroBridge.getReadingAssets === 'function'
        ? await ZoteroBridge.getReadingAssets(currentZoteroItemKey)
        : { annotations: await ZoteroBridge.getAnnotations(currentZoteroItemKey), notes: [], collections: [], tags: [] };

      const annos = assets.annotations || [];
      const notes = assets.notes || [];
      const collections = assets.collections || [];
      const tags = assets.tags || [];

      window.RFUI.setHTML(panel, `
        <div class="zotero-drawer-tabs">
          <button type="button" class="zotero-drawer-tab active" data-tab="annos">
            🖍️ PDF 批注 <span class="zotero-drawer-badge">${annos.length}</span>
          </button>
          <button type="button" class="zotero-drawer-tab" data-tab="notes">
            📝 独立笔记 <span class="zotero-drawer-badge">${notes.length}</span>
          </button>
          <button type="button" class="zotero-drawer-tab" data-tab="meta">
            📁 分类与标签 <span class="zotero-drawer-badge">${collections.length + tags.length}</span>
          </button>
        </div>
        <div id="zotero-tab-content-annos" class="zotero-drawer-section"></div>
        <div id="zotero-tab-content-notes" class="zotero-drawer-section" style="display:none;"></div>
        <div id="zotero-tab-content-meta" class="zotero-drawer-section" style="display:none;"></div>
      `);

      // Tab switching
      panel.querySelectorAll('.zotero-drawer-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', (e) => {
          e.preventDefault();
          panel.querySelectorAll('.zotero-drawer-tab').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          const targetTab = tabBtn.dataset.tab;
          const secAnnos = panel.querySelector('#zotero-tab-content-annos');
          const secNotes = panel.querySelector('#zotero-tab-content-notes');
          const secMeta = panel.querySelector('#zotero-tab-content-meta');
          if (secAnnos) secAnnos.style.display = targetTab === 'annos' ? 'flex' : 'none';
          if (secNotes) secNotes.style.display = targetTab === 'notes' ? 'flex' : 'none';
          if (secMeta) secMeta.style.display = targetTab === 'meta' ? 'flex' : 'none';
        });
      });

      // 1. Populate Annotations
      const annosContainer = panel.querySelector('#zotero-tab-content-annos');
      if (annos.length === 0) {
        window.RFUI.setHTML(annosContainer, '<div style="font-size:11px; color:#64748b; padding:8px; text-align:center;">该文献 PDF 暂无高亮划线。您可在 Zotero 阅读器中选中文字添加高亮与批注。</div>');
      } else {
        if (annos.length > 1) {
          const batchBar = document.createElement('div');
          batchBar.className = 'zotero-batch-toolbar';
          window.RFUI.setHTML(batchBar, `
            <span>共检测到 <strong>${annos.length}</strong> 条 PDF 批注划线</span>
            <button type="button" class="btn-secondary" id="btn-batch-insert-annos" style="font-size:10px; padding:2px 8px; color:var(--text-accent, #cc292b); font-weight:600; cursor:pointer;">
              ➕ 全部汇入研读草稿
            </button>
          `);
          batchBar.querySelector('#btn-batch-insert-annos')?.addEventListener('click', () => {
            const absBox = document.getElementById('man-abstract');
            if (absBox) {
              const allQuotes = annos
                .filter(a => a.text || a.comment)
                .map(a => `> "${a.text || a.comment}" (第 ${a.page} 页)`)
                .join('\n\n');
              absBox.value = (absBox.value + '\n\n【Zotero PDF 研读摘录汇编】\n' + allQuotes).trim();
              showGlobalToast(`已将全部 ${annos.length} 条批注汇入草稿！`, 'success');
            }
          });
          annosContainer.appendChild(batchBar);
        }

        annos.forEach(a => {
          const itemEl = document.createElement('div');
          itemEl.className = 'zotero-annotation-item';
          window.RFUI.setHTML(itemEl, `
            <div class="zotero-annotation-head">
              <span style="font-weight:600; color:${a.color || '#cc292b'};">● 第 ${a.page} 页 ${a.type === 'note' ? '独立批注' : '高亮划线'}</span>
              <span>${a.date ? new Date(a.date).toLocaleDateString() : ''}</span>
            </div>
            ${a.text ? `<div class="zotero-annotation-body" style="border-left-color:${a.color || '#ffd400'};">${escapeHTML(a.text)}</div>` : ''}
            ${a.comment ? `<div class="zotero-annotation-comment">💡 批注：${escapeHTML(a.comment)}</div>` : ''}
            <div class="zotero-annotation-actions">
              <button type="button" class="btn-secondary btn-quote-insert" style="font-size:10px; padding:2px 6px;">➕ 插入草稿</button>
              <button type="button" class="btn-secondary btn-quote-jump" style="font-size:10px; padding:2px 6px;">📖 原文第 ${a.page} 页</button>
            </div>
          `);
          itemEl.querySelector('.btn-quote-insert')?.addEventListener('click', () => {
            const absBox = document.getElementById('man-abstract');
            if (absBox) {
              const quoteContent = `\n\n> "${a.text || a.comment}" (第 ${a.page} 页)`;
              absBox.value = (absBox.value + quoteContent).trim();
              showGlobalToast('已将划线批注插入到研读草稿中', 'success');
            }
          });
          itemEl.querySelector('.btn-quote-jump')?.addEventListener('click', () => {
            if (currentZoteroItemKey && typeof ZoteroBridge !== 'undefined') {
              ZoteroBridge.openPdf(currentZoteroItemKey, a.pageIndex + 1);
            }
          });
          annosContainer.appendChild(itemEl);
        });
      }

      // 2. Populate Notes
      const notesContainer = panel.querySelector('#zotero-tab-content-notes');
      if (notes.length === 0) {
        window.RFUI.setHTML(notesContainer, '<div style="font-size:11px; color:#64748b; padding:8px; text-align:center;">该文献在 Zotero 中暂无独立文献笔记。您可在 Zotero 中为该条目添加子笔记记录研读心得。</div>');
      } else {
        notes.forEach(n => {
          const noteEl = document.createElement('div');
          noteEl.className = 'zotero-note-item';
          window.RFUI.setHTML(noteEl, `
            <div class="zotero-note-head">
              <span>📝 ${escapeHTML(n.title || 'Zotero 笔记')}</span>
              <span style="font-size:10px; color:#64748b; font-weight:normal;">${n.date ? new Date(n.date).toLocaleDateString() : ''}</span>
            </div>
            <div class="zotero-note-body">${escapeHTML(n.snippet || '')}</div>
            <div class="zotero-note-actions">
              <button type="button" class="btn-secondary btn-insert-note" style="font-size:10px; padding:2px 6px;">➕ 插入草稿</button>
              <button type="button" class="btn-secondary btn-locate-note" style="font-size:10px; padding:2px 6px;">🔗 定位笔记</button>
            </div>
          `);
          noteEl.querySelector('.btn-insert-note')?.addEventListener('click', () => {
            const absBox = document.getElementById('man-abstract');
            if (absBox) {
              const noteContent = `\n\n【Zotero 研读笔记摘记】\n${n.snippet || ''}`;
              absBox.value = (absBox.value + noteContent).trim();
              showGlobalToast('已将文献笔记插入到研读草稿中', 'success');
            }
          });
          noteEl.querySelector('.btn-locate-note')?.addEventListener('click', () => {
            if (typeof ZoteroBridge !== 'undefined') {
              ZoteroBridge.selectItemInZotero(n.key);
            }
          });
          notesContainer.appendChild(noteEl);
        });
      }

      // 3. Populate Collections & Tags
      const metaContainer = panel.querySelector('#zotero-tab-content-meta');
      window.RFUI.setHTML(metaContainer, '');
      if (collections.length > 0) {
        const colSection = document.createElement('div');
        window.RFUI.setHTML(colSection, `<strong style="font-size:11px; color:hsl(var(--text-secondary)); display:block; margin-bottom:4px;">📁 所属 Zotero 知识库分类：</strong>`);
        const pillsWrap = document.createElement('div');
        pillsWrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';
        collections.forEach(col => {
          const pill = document.createElement('span');
          pill.className = 'zotero-collection-pill';
          pill.textContent = `📁 ${col.path || col.name}`;
          pillsWrap.appendChild(pill);
        });
        colSection.appendChild(pillsWrap);
        metaContainer.appendChild(colSection);
      }

      if (tags.length > 0) {
        const tagSection = document.createElement('div');
        tagSection.style.marginTop = '6px';
        window.RFUI.setHTML(tagSection, `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:11px; color:hsl(var(--text-secondary));">🏷️ Zotero 文献标签：</strong>
            <button type="button" class="btn-secondary" id="btn-extract-tags-to-notes" style="font-size:10px; padding:2px 6px;">➕ 提取为主题标签</button>
          </div>
        `);
        const tagsWrap = document.createElement('div');
        tagsWrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
        tags.forEach(tg => {
          const tagPill = document.createElement('span');
          tagPill.className = 'zotero-tag-pill';
          tagPill.textContent = `#${tg}`;
          tagsWrap.appendChild(tagPill);
        });
        tagSection.appendChild(tagsWrap);

        tagSection.querySelector('#btn-extract-tags-to-notes')?.addEventListener('click', () => {
          const absBox = document.getElementById('man-abstract');
          if (absBox) {
            const tagsText = `\n\n【主题关键词】：${tags.join(', ')}`;
            absBox.value = (absBox.value + tagsText).trim();
            showGlobalToast(`已将 ${tags.length} 个标签添加至研读草稿！`, 'success');
          }
        });
        metaContainer.appendChild(tagSection);
      }

      if (collections.length === 0 && tags.length === 0) {
        window.RFUI.setHTML(metaContainer, '<div style="font-size:11px; color:#64748b; padding:8px; text-align:center;">该文献暂未分配分类目录与标签。</div>');
      }
    });

    // Live search in Zotero library
    const searchInput = document.getElementById('ipt-zotero-live-search');
    const dropdown = document.getElementById('zotero-search-results-dropdown');
    let searchTimer = null;

    if (searchInput && dropdown) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimer);
        if (query.length < 2) {
          dropdown.style.display = 'none';
          window.RFUI.setHTML(dropdown, '');
          return;
        }
        searchTimer = setTimeout(async () => {
          window.RFUI.setHTML(dropdown, `<div class="zotero-search-empty">🔍 ${escapeHTML(currentLanguage === 'zh' ? '检索中...' : 'Searching...')}</div>`);
          dropdown.style.display = 'block';
          const results = typeof ZoteroBridge !== 'undefined'
            ? await ZoteroBridge.searchLibrary(query, 10)
            : [];
          if (!results || results.length === 0) {
            window.RFUI.setHTML(dropdown, `<div class="zotero-search-empty">${escapeHTML(currentLanguage === 'zh' ? '未找到匹配的 Zotero 文献' : 'No matching Zotero items found')}</div>`);
            return;
          }
          window.RFUI.setHTML(dropdown, '');
          results.forEach(res => {
            const itemEl = document.createElement('div');
            itemEl.className = 'zotero-search-result-item';
            window.RFUI.setHTML(itemEl, `
              <div class="zotero-search-result-title">${escapeHTML(res.title || '无标题文献')}</div>
              <div class="zotero-search-result-meta">${escapeHTML(res.authors || '')} ${res.year ? `· ${escapeHTML(res.year)}` : ''} ${res.publication ? `· ${escapeHTML(res.publication)}` : ''}</div>
            `);
            itemEl.addEventListener('click', () => {
              applyItemToForm(res);
              dropdown.style.display = 'none';
              searchInput.value = '';
            });
            dropdown.appendChild(itemEl);
          });
        }, 220);
      });

      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    document.getElementById('btn-zotero-fetch-active')?.addEventListener('click', async () => {
      const activeItem = typeof ZoteroBridge !== 'undefined'
        ? await ZoteroBridge.getActiveItem()
        : null;
      if (activeItem) {
        applyItemToForm(activeItem);
      } else {
        showGlobalToast('未在 Zotero 中检测到选中条目，请在文献库中单击选中目标论文。', 'warning');
      }
    });

    document.getElementById('btn-zotero-open-pdf')?.addEventListener('click', () => {
      if (currentZoteroItemKey && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.openPdf(currentZoteroItemKey);
      }
    });

    document.getElementById('btn-zotero-sync-note')?.addEventListener('click', async () => {
      if (currentZoteroItemKey && typeof ZoteroBridge !== 'undefined') {
        const ok = await ZoteroBridge.syncNote(currentZoteroItemKey);
        if (ok) {
          showGlobalToast('已同步审稿进展至 Zotero 云端笔记！', 'success');
        } else {
          showGlobalToast('同步失败，请检查条目是否存在', 'error');
        }
      }
    });

    document.getElementById('btn-zotero-locate')?.addEventListener('click', () => {
      if (currentZoteroItemKey && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.selectItemInZotero(currentZoteroItemKey);
      }
    });

    document.getElementById('btn-zotero-unlink')?.addEventListener('click', () => {
      updateZoteroBindUI(null);
      const searchContainer = document.getElementById('zotero-search-container');
      if (searchContainer) searchContainer.style.display = 'block';
      showGlobalToast('已解除 Zotero 文献绑定', 'info');
    });
  }

  document.getElementById('btn-submit-man').addEventListener('click', async () => {
    const title = document.getElementById('man-title').value.trim();
    const status = document.getElementById('man-status').value;
    const journal = document.getElementById('man-journal').value.trim();
    const authors = splitAcademicAuthors(document.getElementById('man-authors').value);
    const doi = normalizeDoi(document.getElementById('man-doi').value);
    const articleUrl = document.getElementById('man-article-url').value.trim();
    const abstract = document.getElementById('man-abstract').value.trim();

    if (!title) {
      alert(t('manuscriptTitleRequired'));
      return;
    }

    const duplicate = !isEdit && prefill
      ? findAcademicManuscriptMatch({ title, doi, articleUrl })
      : null;
    if (duplicate && !confirm(t('academicDuplicateConfirm'))) return;

    const targetManuscript = isEdit ? man : duplicate;
    if (targetManuscript) {
      try { validateLinkedManuscriptStatus(targetManuscript, status); }
      catch (error) { showGlobalToast(error.message, 'error'); return; }
      // The manuscript editor no longer exposes project context. Preserve a
      // legacy relationship on edits so existing records remain intact, while
      // new manuscripts stay independent of the retired project framework.
      targetManuscript.title = title;
      setManuscriptStatus(targetManuscript, status);
      targetManuscript.targetJournals = journal ? [journal] : [];
      targetManuscript.abstract = abstract;
      targetManuscript.authors = authors;
      targetManuscript.firstAuthor = authors[0] || targetManuscript.firstAuthor || null;
      targetManuscript.doi = doi || null;
      targetManuscript.articleUrl = articleUrl || null;
      if (currentZoteroItemKey !== undefined) {
        targetManuscript.zoteroItemKey = currentZoteroItemKey;
        targetManuscript.zoteroUri = currentZoteroUri;
        targetManuscript.pdfUri = currentPdfUri;
        targetManuscript.citekey = currentCiteKey || targetManuscript.citekey || null;
        targetManuscript.bibtex = currentBibtex || targetManuscript.bibtex || null;
        targetManuscript.citationApa = currentCitationApa || targetManuscript.citationApa || null;
      }
      if (prefill) targetManuscript.academicCaptureProvenance = academicCaptureProvenance(prefill);
      targetManuscript.updatedAt = new Date().toISOString();
      syncLinkedSubmissionsFromManuscript(targetManuscript);
    } else {
      const newMan = {
        id: 'man_' + Math.random().toString(36).substring(2, 9),
        userId: 'user',
        title,
        shortTitle: null,
        manuscriptType: 'article',
        status,
        abstract,
        keywords: [],
        authors,
        firstAuthor: authors[0] || null,
        correspondingAuthors: [],
        targetJournals: journal ? [journal] : [],
        doi: doi || null,
        articleUrl: articleUrl || null,
        zoteroItemKey: currentZoteroItemKey || null,
        zoteroUri: currentZoteroUri || null,
        pdfUri: currentPdfUri || null,
        citekey: currentCiteKey || null,
        bibtex: currentBibtex || null,
        citationApa: currentCitationApa || null,
        academicCaptureProvenance: academicCaptureProvenance(prefill),
        currentVersion: '1.0',
        plannedFigures: [],
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.manuscripts.push(newMan);
    }

    await window.storage.saveAll(db);
    if (currentZoteroItemKey && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) {
      ZoteroBridge.syncStatusTag(currentZoteroItemKey, status);
      ZoteroBridge.addToPipelineCollection(currentZoteroItemKey);
      ZoteroBridge.syncNote(currentZoteroItemKey);
    }
    closeModal();
    renderKanban();
    renderDashboard();
    renderSubmissions();
    showGlobalToast(
      duplicate
        ? t('academicDuplicateUpdated')
        : (prefill ? t('academicCaptureSaved') : 'Manuscripts updated!'),
      'success'
    );
  });
}

// --- VIEW 5: SUBMISSIONS & REBUTTAL MATRIX ---
function focusSubmissionEditCenter() {
  const detailPanel = document.getElementById('submission-detail-panel');
  const editCenter = detailPanel?.querySelector('#submission-entry-editor-panel');
  const titleInput = editCenter?.querySelector('#sub-edit-title');
  if (!detailPanel || !editCenter) return;

  const panelRect = detailPanel.getBoundingClientRect();
  const editorRect = editCenter.getBoundingClientRect();
  const targetTop = Math.max(detailPanel.scrollTop + editorRect.top - panelRect.top - 12, 0);
  if (typeof detailPanel.scrollTo === 'function') {
    detailPanel.scrollTo({ top: targetTop, behavior: 'smooth' });
  } else {
    detailPanel.scrollTop = targetTop;
  }

  editCenter.classList.remove('submission-edit-center-focused');
  void editCenter.offsetWidth;
  editCenter.classList.add('submission-edit-center-focused');
  window.setTimeout(() => editCenter.classList.remove('submission-edit-center-focused'), 2400);

  if (titleInput) {
    window.requestAnimationFrame(() => {
      try {
        titleInput.focus({ preventScroll: true });
      } catch (error) {
        titleInput.focus();
      }
      titleInput.select();
    });
  }
}

function canLeaveSubmissionEditor() {
  const editor = document.getElementById('submission-entry-editor-panel');
  const state = editor?.querySelector('[data-submission-autosave-status]')?.dataset.state;
  if (!editor || !['pending', 'invalid', 'error'].includes(state)) return true;
  const plan = window.RFUI.buildSubmissionEditSyncPlan(getSubmissionEditValues('sub-edit'));
  if (plan.ok) return true;
  showGlobalToast(plan.error, 'error');
  document.getElementById('sub-edit-title')?.focus();
  return false;
}

function openSubmissionForEditing(sub, options = {}) {
  if (!canLeaveSubmissionEditor()) return;
  submissionAutoSaveCleanup?.();
  selectedSubmissionId = sub.id;
  renderSubmissions();
  renderSubmissionDetails(sub);
  if (options.focusEditCenter) {
    requestAnimationFrame(focusSubmissionEditCenter);
  }
}

function navigateToSubmissionDetails(submissionId) {
  const submission = db.submissions.find(item => item.id === submissionId);
  if (!submission) {
    showGlobalToast(t('submissionNotFound'), 'error');
    return;
  }
  const submissionView = document.getElementById('view-submissions');
  if (!submissionView.classList.contains('active')) {
    document.querySelector('.nav-item[data-view="view-submissions"]')?.click();
  }
  if (!submissionView.classList.contains('active')) return;
  openSubmissionForEditing(submission);
  document.getElementById('submission-detail-panel')?.scrollTo({ top: 0 });
}

function getDefaultSubmissionChecklistKeys() {
  return [
    { key: 'cover_letter_ready', label: 'Cover Letter drafted' },
    { key: 'title_page_ready', label: 'Title page formatted' },
    { key: 'data_availability_statement', label: 'Data Availability statement' },
    { key: 'author_contribution', label: 'CRedIT Author statements' },
    { key: 'figure_resolution_checked', label: 'High-res figures checked' },
    { key: 'conflict_of_interest', label: 'Conflict of Interest statement' }
  ];
}

function getSubmissionChecklistKeys(sub) {
  return Array.isArray(sub?.complianceChecklistKeys) && sub.complianceChecklistKeys.length > 0
    ? sub.complianceChecklistKeys
    : getDefaultSubmissionChecklistKeys();
}

function getSubmissionReviewMatrixRows(sub) {
  if (Array.isArray(sub?.reviewMatrix)) return sub.reviewMatrix;
  if (Array.isArray(sub?.rebuttalMatrix)) return sub.rebuttalMatrix;
  return [];
}

function collectSubmissionChecklistFromEditor() {
  const compliance = {};
  document.querySelectorAll('#sub-edit-compliance-checklist-container [data-checklist-key]').forEach(input => {
    compliance[input.dataset.checklistKey] = input.checked;
  });
  return compliance;
}

function collectSubmissionChecklistKeysFromEditor() {
  return Array.from(document.querySelectorAll('#sub-edit-compliance-checklist-container [data-checklist-key]')).map(input => ({
    key: input.dataset.checklistKey,
    label: input.dataset.checklistLabel || input.dataset.checklistKey
  }));
}

function collectSubmissionReviewMatrixFromEditor() {
  return Array.from(document.querySelectorAll('#sub-edit-review-matrix-container .submission-edit-review-row')).map((row, index) => ({
    id: row.dataset.reviewId || `rev_${Date.now()}_${index}`,
    comment: row.querySelector('.sub-edit-review-comment')?.value || '',
    response: row.querySelector('.sub-edit-review-response')?.value || '',
    recordId: row.dataset.recordId || ''
  }));
}

function createSubmissionReviewEditorRow(row = {}, index = 0) {
  const safeId = String(row.id || `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'submission-edit-review-row';
  rowDiv.dataset.reviewId = safeId;
  rowDiv.dataset.recordId = row.recordId || '';
  window.RFUI.setHTML(rowDiv, `
    <div class="submission-edit-review-field">
      <div class="submission-edit-review-label">${escapeHTML(tf('reviewerCommentLabel', { count: index + 1 }))}</div>
      <textarea class="sub-edit-review-comment" placeholder="${escapeHTML(t('reviewerCommentPlaceholder'))}">${escapeHTML(row.comment || '')}</textarea>
      <div class="submission-edit-review-actions">
        <button type="button" class="btn-danger btn-icon btn-delete-review-row" title="${escapeHTML(t('removeComment'))}">
          <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="submission-edit-review-field">
      <div class="submission-edit-review-label-row">
        <div class="submission-edit-review-label">${escapeHTML(t('authorResponseLabel'))}</div>
        <button type="button" class="btn-secondary btn-copy-review-response">
          <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>${escapeHTML(t('copy'))}</span>
        </button>
      </div>
      <textarea class="sub-edit-review-response" placeholder="${escapeHTML(t('authorResponsePlaceholder'))}">${escapeHTML(row.response || '')}</textarea>
    </div>
  `);
  return rowDiv;
}

function reindexSubmissionReviewEditorRows(container) {
  container.querySelectorAll('.submission-edit-review-row').forEach((row, index) => {
    const label = row.querySelector('.submission-edit-review-label');
    if (label) label.textContent = tf('reviewerCommentLabel', { count: index + 1 });
  });
}

function renderSubmissionChecklistEditor(sub, checklistKeys) {
  const checklistBox = document.getElementById('sub-edit-compliance-checklist-container');
  if (!checklistBox) return;
  const compliance = sub.complianceChecklist && typeof sub.complianceChecklist === 'object' && !Array.isArray(sub.complianceChecklist)
    ? sub.complianceChecklist
    : {};
  window.RFUI.setHTML(checklistBox, '');
  checklistKeys.forEach(chk => {
    const label = document.createElement('label');
    label.className = 'submission-edit-check-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = compliance[chk.key] === true;
    input.dataset.checklistKey = chk.key;
    input.dataset.checklistLabel = chk.label;

    label.appendChild(input);
    label.appendChild(document.createTextNode(chk.label));
    checklistBox.appendChild(label);
  });
}

function renderSubmissionReviewMatrixEditor(sub, manAbstract) {
  const reviewBox = document.getElementById('sub-edit-review-matrix-container');
  const addButton = document.getElementById('btn-add-review-comment');
  if (!reviewBox) return;
  const rows = getSubmissionReviewMatrixRows(sub);
  window.RFUI.setHTML(reviewBox, '');
  if (rows.length === 0) {
    window.RFUI.setHTML(reviewBox, `<p class="empty-state">${escapeHTML(t('emptyReviewEditor'))}</p>`);
  } else {
    rows.forEach((row, index) => {
      reviewBox.appendChild(createSubmissionReviewEditorRow(row, index));
    });
  }

  if (addButton) {
    addButton.addEventListener('click', () => {
      const empty = reviewBox.querySelector('.empty-state');
      if (empty) window.RFUI.setHTML(reviewBox, '');
      reviewBox.appendChild(createSubmissionReviewEditorRow({ comment: '', response: '', recordId: '' }, reviewBox.querySelectorAll('.submission-edit-review-row').length));
      reviewBox.dispatchEvent(new CustomEvent('submission-autosave-request', {
        bubbles: true,
        detail: { immediate: true }
      }));
    });
  }

  reviewBox.addEventListener('click', async event => {
    const copyButton = event.target.closest('.btn-copy-review-response');
    if (copyButton) {
      const row = copyButton.closest('.submission-edit-review-row');
      const responseText = row?.querySelector('.sub-edit-review-response')?.value.trim() || '';
      if (!responseText) {
        showGlobalToast(t('responsePending'), 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(responseText);
        showGlobalToast(t('copy'), 'success');
      } catch (_) {
        showGlobalToast('Copy failed', 'danger');
      }
      return;
    }

    const deleteButton = event.target.closest('.btn-delete-review-row');
    if (deleteButton) {
      const row = deleteButton.closest('.submission-edit-review-row');
      row?.remove();
      reindexSubmissionReviewEditorRows(reviewBox);
      if (reviewBox.querySelectorAll('.submission-edit-review-row').length === 0) {
        window.RFUI.setHTML(reviewBox, `<p class="empty-state">${escapeHTML(t('emptyReviewEditor'))}</p>`);
      }
      reviewBox.dispatchEvent(new CustomEvent('submission-autosave-request', {
        bubbles: true,
        detail: { immediate: true }
      }));
      return;
    }

  });
}

function renderSubmissionReviewPreview(sub, checklistKeys) {
  const previewBox = document.getElementById('submission-review-preview');
  if (!previewBox) return;
  const compliance = sub.complianceChecklist && typeof sub.complianceChecklist === 'object' && !Array.isArray(sub.complianceChecklist)
    ? sub.complianceChecklist
    : {};
  const completedChecks = checklistKeys.filter(chk => compliance[chk.key] === true).length;
  const reviewRows = getSubmissionReviewMatrixRows(sub);
  const reviewPreview = reviewRows.length
    ? reviewRows.map((row, index) => `
        <div class="submission-review-preview-row">
          <strong>${escapeHTML(tf('reviewerCommentLabel', { count: index + 1 }))}</strong>
          <p>${escapeHTML(row.comment || t('noCommentText'))}</p>
          <span>${escapeHTML(row.response ? t('responseSaved') : t('responsePending'))}</span>
        </div>
      `).join('')
    : `<p class="empty-state">${escapeHTML(t('emptyReviewPreview'))}</p>`;
  window.RFUI.setHTML(previewBox, `
    <div class="workflow-context-grid submission-review-preview-grid">
      <div class="workflow-context-item"><span>${escapeHTML(t('checklistLabel'))}</span><strong>${completedChecks}/${checklistKeys.length}</strong></div>
      <div class="workflow-context-item"><span>${escapeHTML(t('workflowReviewerCommentsLabel'))}</span><strong>${reviewRows.length}</strong></div>
      <div class="workflow-context-item"><span>${escapeHTML(t('responsesLabel'))}</span><strong>${reviewRows.filter(row => row.response).length}/${reviewRows.length}</strong></div>
    </div>
    <div class="submission-review-preview-list">${reviewPreview}</div>
  `);
}

function getSubmissionEditValues(prefix) {
  return {
    title: document.getElementById(`${prefix}-title`).value,
    firstAuthor: document.getElementById(`${prefix}-first-author`)?.value || '',
    journal: document.getElementById(`${prefix}-journal`).value,
    journalUrl: document.getElementById(`${prefix}-journal-url`).value,
    status: document.getElementById(`${prefix}-status`).value,
    submissionDate: document.getElementById(`${prefix}-submission-date`).value,
    firstDecisionDate: document.getElementById(`${prefix}-r1-date`).value,
    revisionDueDate: document.getElementById(`${prefix}-revision-due`).value,
    decisionDate: document.getElementById(`${prefix}-decision-date`).value,
    doi: document.getElementById(`${prefix}-doi`).value,
    articleUrl: document.getElementById(`${prefix}-article-url`).value,
    complianceChecklist: collectSubmissionChecklistFromEditor(),
    complianceChecklistKeys: collectSubmissionChecklistKeysFromEditor(),
    reviewMatrix: collectSubmissionReviewMatrixFromEditor()
  };
}

function applySubmissionEditSync(sub, man, syncPlan, database = db) {
  const previousStatus = sub.status;
  if (man) {
    man.title = syncPlan.manuscriptPatch.title;
    if (window.RFCore.getCurrentSubmission(database, man.id)?.id === sub.id) {
      man.targetJournals = syncPlan.manuscriptPatch.targetJournals;
    }
    man.updatedAt = new Date().toISOString();
  } else {
    sub.title = syncPlan.detachedSubmissionTitle;
  }

  Object.assign(sub, syncPlan.submissionPatch);

  if (syncPlan.shouldMarkRejected) {
    markSubmissionRejected(sub, syncPlan.rejectionDate || todayString());
  } else {
    sub.status = syncPlan.submissionPatch.status;
  }

  if (syncPlan.submissionPatch.status === 'accepted') {
    sub.acceptedAt = sub.decisionDate || sub.acceptedAt || new Date().toISOString();
  } else if (syncPlan.submissionPatch.status === 'published') {
    sub.publishedAt = sub.publishedAt || getTimelineNodeByKey(sub, 'online')?.completeDate || sub.decisionDate || new Date().toISOString();
    sub.acceptedAt = sub.acceptedAt || sub.publishedAt;
  }
  if (previousStatus === 'published' && sub.status === 'accepted') clearOnlinePublicationCompletion(sub);

  if (syncPlan.publicationPatch) {
    const doi = normalizeDoi(syncPlan.publicationPatch.doi);
    sub.doi = doi || null;
    sub.articleUrl = syncPlan.publicationPatch.articleUrl || (doi ? `https://doi.org/${doi}` : null);
  } else if (syncPlan.shouldClearPublication) {
    clearPublicationLinkFields(sub);
    clearPublicationTimelineCompletion(sub);
  }

  sub.updatedAt = new Date().toISOString();
  normalizeSubmissionTimeline(sub);
  syncManuscriptStatusFromSubmission(sub, database);
  if (man) syncLinkedManuscriptSnapshots(man, database);
}

function refreshSubmissionStatusPresentation(sub) {
  const detailPanel = document.getElementById('submission-detail-panel');
  if (!detailPanel || detailPanel.dataset.currentSubmissionId !== sub.id) return;

  const status = normalizeSubmissionStatus(sub.status);
  const statusText = getSubmissionStatusLabel(status);
  const badgeClass = window.RFUI.getSubmissionStatusBadgeClass(status);
  detailPanel.querySelectorAll('[data-submission-status-badge]').forEach(badge => {
    badge.className = badgeClass;
    badge.textContent = badge.dataset.submissionStatusBadge === 'stage'
      ? `${t('currentStageLabel')}: ${statusText}`
      : statusText;
  });

  const summary = detailPanel.querySelector('[data-submission-status-summary]');
  if (summary) {
    const analysis = analyzeSubmission(sub);
    const submitDate = normalizeDateString(sub.submissionDate || analysis.submitDate);
    summary.textContent = `${getSubmissionJournalName(sub)} / ${statusText} / ${t('milestoneSubmission')} ${submitDate || t('noDate')}`;
  }

  const cycle = getSubmissionCycleTime(sub);
  const cycleCard = detailPanel.querySelector('[data-submission-cycle-card]');
  if (cycleCard) {
    cycleCard.classList.toggle('submission-cycle-card-complete', cycle.isCompleted);
    cycleCard.classList.toggle('submission-cycle-card-active', !cycle.isCompleted);
    const label = cycleCard.querySelector('[data-submission-cycle-label]');
    const text = cycleCard.querySelector('[data-submission-cycle-text]');
    const icon = cycleCard.querySelector('.submission-cycle-icon');
    if (label) label.textContent = t(cycle.isCompleted ? 'cycleTimeCompleted' : 'submissionCycleTracking');
    if (text) {
      text.textContent = cycle.isCompleted
        ? tf('cycleTimeCompletedText', { start: cycle.startDateStr, end: cycle.endDateStr, days: cycle.days })
        : tf('submissionCycleText', { start: cycle.startDateStr, days: cycle.days });
    }
    if (icon) {
      window.RFUI.setHTML(icon, cycle.isCompleted
        ? '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
        : '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>');
    }
  }
}

async function saveSubmissionEditFromValues(sub, prefix, options = {}) {
  const editValues = options.values || getSubmissionEditValues(prefix);
  const syncPlan = window.RFUI.buildSubmissionEditSyncPlan(editValues);
  if (!syncPlan.ok) {
    if (options.alertOnError !== false) alert(syncPlan.error);
    if (typeof options.onValidationError === 'function') options.onValidationError(syncPlan.error);
    return false;
  }

  const liveSub = db.submissions.find(item => item.id === sub.id);
  if (!liveSub) throw new Error(t('submissionNotFound'));
  const previousStatus = normalizeSubmissionStatus(liveSub.status);
  const workingDatabase = typeof structuredClone === 'function'
    ? structuredClone(db)
    : JSON.parse(JSON.stringify(db));
  const workingSub = workingDatabase.submissions.find(item => item.id === sub.id);
  if (!workingSub) throw new Error(t('submissionNotFound'));
  const workingMan = workingDatabase.manuscripts.find(item => item.id === workingSub.manuscriptId);

  applySubmissionEditSync(workingSub, workingMan, syncPlan, workingDatabase);
  const firstAuthor = String(editValues.firstAuthor || '').trim().slice(0, 160);
  workingSub.firstAuthor = firstAuthor || null;
  if (workingMan) workingMan.firstAuthor = firstAuthor || null;
  if (workingMan) syncLinkedManuscriptSnapshots(workingMan, workingDatabase);
  workingSub.complianceChecklist = editValues.complianceChecklist;
  workingSub.complianceChecklistKeys = editValues.complianceChecklistKeys;
  workingSub.reviewMatrix = editValues.reviewMatrix;
  const savedDatabase = await window.storage.saveAll(workingDatabase, {
    mergeOnConflict: options.mergeOnConflict === true
  });
  db = savedDatabase || workingDatabase;
  const savedSub = db.submissions.find(item => item.id === sub.id);
  if (!savedSub) throw new Error(t('submissionNotFound'));
  Object.assign(sub, savedSub);

  if (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero && workingMan?.zoteroItemKey) {
    try {
      ZoteroBridge.syncStatusTag(workingMan.zoteroItemKey, workingMan.status || savedSub.status);
      ZoteroBridge.syncNote(workingMan.zoteroItemKey);
    } catch (_) {}
  }

  const shouldCelebrate = window.RFUI.shouldCelebrateAcceptance(
    previousStatus,
    normalizeSubmissionStatus(savedSub.status)
  );
  const activeView = document.querySelector('.content-view.active')?.id;
  if (activeView === 'view-dashboard') renderDashboard();
  if (activeView === 'view-manuscripts') renderKanban();
  if (activeView === 'view-submissions') renderSubmissions({ refreshDetails: options.renderDetails !== false });
  if (options.renderDetails !== false) renderSubmissionDetails(savedSub);
  else if (selectedSubmissionId === savedSub.id) refreshSubmissionStatusPresentation(savedSub);
  if (options.notify !== false) showGlobalToast(t('submissionEditsSaved'), 'success');
  if (shouldCelebrate) showAcceptanceCelebration(savedSub);
  return true;
}

function setupSubmissionAutoSave(sub) {
  submissionAutoSaveCleanup?.();
  const editCenter = document.getElementById('submission-entry-editor-panel');
  const status = editCenter?.querySelector('[data-submission-autosave-status]');
  if (!editCenter || !status) return;

  let debounceTimer = null;
  let revision = 0;
  let saveChain = Promise.resolve();
  let lastSavedSnapshot = JSON.stringify(getSubmissionEditValues('sub-edit'));
  const debounceMs = 650;

  const setStatus = (state, message, detail = '') => {
    if (!editCenter.isConnected) return;
    status.dataset.state = state;
    status.title = detail || '';
    const label = status.querySelector('[data-submission-autosave-label]');
    if (label) label.textContent = message;
  };

  const persist = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const requestedRevision = revision;
    const values = getSubmissionEditValues('sub-edit');
    const currentSnapshot = JSON.stringify(values);
    pendingSubmissionSaves += 1;
    setStatus('saving', t('autoSaveSaving'));

    saveChain = saveChain
      .catch(() => {})
      .then(async () => {
        // Values are captured before navigation can replace the editor.
        if (currentSnapshot === lastSavedSnapshot) {
          if (requestedRevision === revision) setStatus('saved', t('autoSaveSaved'));
          return;
        }
        let validationError = '';
        const saved = await saveSubmissionEditFromValues(sub, 'sub-edit', {
          values,
          alertOnError: false,
          renderDetails: false,
          notify: false,
          mergeOnConflict: true,
          onValidationError: error => {
            validationError = error;
          }
        });
        if (!editCenter.isConnected) return;
        if (!saved) {
          setStatus('invalid', t('autoSaveInvalid'), validationError);
          return;
        }
        lastSavedSnapshot = currentSnapshot;
        if (requestedRevision === revision) {
          setStatus('saved', t('autoSaveSaved'));
          renderSubmissionReviewPreview(sub, getSubmissionChecklistKeys(sub));
        }
      })
      .catch(error => {
        console.error('Submission auto-save failed:', error);
        setStatus('error', t('autoSaveFailed'), String(error?.message || error || ''));
        showGlobalToast(t('autoSaveFailed'), 'error');
      })
      .finally(() => { pendingSubmissionSaves -= 1; });
  };

  const requestSave = ({ immediate = false } = {}) => {
    revision += 1;
    if (debounceTimer) clearTimeout(debounceTimer);
    setStatus('pending', t('autoSavePending'));
    if (immediate) {
      persist();
    } else {
      debounceTimer = window.setTimeout(persist, debounceMs);
    }
  };

  editCenter.addEventListener('input', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return;
    if (control.type === 'checkbox' || control.type === 'radio') return;
    requestSave();
  });

  editCenter.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return;
    requestSave({ immediate: true });
  });

  editCenter.addEventListener('submission-autosave-request', event => {
    requestSave({ immediate: event.detail?.immediate !== false });
  });

  const flushPendingSave = () => {
    if (debounceTimer) persist();
  };
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flushPendingSave();
  };
  window.addEventListener('pagehide', flushPendingSave);
  document.addEventListener('visibilitychange', flushWhenHidden);
  submissionAutoSaveCleanup = () => {
    flushPendingSave();
    window.removeEventListener('pagehide', flushPendingSave);
    document.removeEventListener('visibilitychange', flushWhenHidden);
    submissionAutoSaveCleanup = null;
  };
}

function setupSubmissionSearch() {
  const input = document.getElementById('submission-search');
  input.addEventListener('input', event => { if (!event.isComposing) applySubmissionSearch(); });
  input.addEventListener('compositionend', applySubmissionSearch);
  document.getElementById('submission-search-status').addEventListener('change', applySubmissionSearch);
  const clear = (all = false) => {
    input.value = '';
    if (all) document.getElementById('submission-search-status').value = 'all';
    applySubmissionSearch(); input.focus();
  };
  document.getElementById('submission-search-clear').addEventListener('click', () => clear());
  document.getElementById('submission-search-reset').addEventListener('click', () => clear(true));
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); clear(); }
    if (event.key === 'Enter') {
      event.preventDefault();
      document.querySelector('.submission-card-item:not([hidden]) .btn-edit-submission')?.click();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || modal.classList.contains('active')) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.getElementById('view-submissions').classList.contains('active')) { event.preventDefault(); input.focus(); }
  });
}

function applySubmissionSearch() {
  const input = document.getElementById('submission-search');
  const filter = document.getElementById('submission-search-status')?.value || 'all';
  const terms = window.RFUI.normalizeSearchText(input.value).split(/\s+/).filter(Boolean);
  const cards = document.querySelectorAll('#submissions-list-container .submission-card-item');
  let count = 0;
  cards.forEach(card => {
    const matches = window.RFUI.matchesSubmissionSearch(card.dataset.searchText, card.dataset.searchStatus, terms, filter);
    if (card.hidden === matches) card.hidden = !matches;
    if (matches) count += 1;
  });
  document.getElementById('submission-search-clear').hidden = !input.value;
  document.getElementById('submission-search-empty').hidden = count > 0 || cards.length === 0;
  document.getElementById('submission-search-count').textContent = tf('submissionSearchCount', { count, total: cards.length });
}

function renderSubmissions({ refreshDetails = true } = {}) {
  const container = document.getElementById('submissions-list-container');
  window.RFUI.setHTML(container, '');

  if (db.submissions.length === 0) {
    window.RFUI.setHTML(container, `<p class="empty-state">${escapeHTML(t('noSubmissionsTracked'))}</p>`);
    selectedSubmissionId = null;
  } else {
    const sortedSubmissions = sortDashboardSubmissions(db.submissions);
    const manuscriptsById = new Map(db.manuscripts.map(manuscript => [manuscript.id, manuscript]));
    const cards = document.createDocumentFragment();
    if (!sortedSubmissions.some(sub => sub.id === selectedSubmissionId)) {
      selectedSubmissionId = sortedSubmissions[0].id;
    }
    const selectedSubmission = sortedSubmissions.find(sub => sub.id === selectedSubmissionId) || sortedSubmissions[0];

    sortedSubmissions.forEach((sub, index) => {
      const displayIndex = sortedSubmissions.length - index;
      const card = document.createElement('div');
      card.className = `glass-card submission-card-item ${sub.id === selectedSubmissionId ? 'selected' : ''}`;

      // Find linked manuscript
      const man = manuscriptsById.get(sub.manuscriptId);
      const manTitle = man ? man.title : (sub.title || t('untitledManuscript'));
      const journalName = getSubmissionJournalName(sub);
      const statusText = getSubmissionStatusLabel(sub.status || 'submitted');
      card.dataset.searchStatus = normalizeSubmissionStatus(sub.status);
      card.dataset.searchText = window.RFUI.normalizeSearchText([manTitle, journalName, sub.externalManuscriptId, getSubmissionFirstAuthor(sub, man), man?.authors, man?.doi, sub.doi, statusText, sub.status].filter(Boolean).join(' '));
      const transferText = sub.previousJournal
        ? `<span class="submission-card-meta">${escapeHTML(t('transferToJournal'))}: ${escapeHTML(sub.previousJournal)}</span>`
        : '';

      window.RFUI.setHTML(card, `
        <div class="submission-card-heading">
          <div class="submission-card-title-group">
            <span class="submission-index">${displayIndex}</span>
            <div class="submission-card-copy">
              <h4>${escapeHTML(journalName)}</h4>
              <p class="submission-card-title">${escapeHTML(manTitle)}</p>
            </div>
          </div>
          <button class="btn-secondary btn-icon submission-card-edit btn-edit-submission" data-sub-id="${escapeHTML(sub.id)}" title="${escapeHTML(t('editFields'))}">
            <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
        </div>
        <div class="submission-card-footer">
          <span class="${window.RFUI.getSubmissionStatusBadgeClass(sub.status)}">${escapeHTML(statusText)}</span>
          ${transferText}
          ${man?.zoteroItemKey ? `
            <span class="zotero-card-badge" data-item-key="${escapeHTML(man.zoteroItemKey)}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 文献库中选中此条目' : 'Select in Zotero library')}" style="padding:1px 6px; font-size:10px; margin-left:auto;">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H6.4l5.6 6v2H2v-2h7.6L4 5V3z"/></svg>
              Zotero
            </span>
          ` : ''}
        </div>
      `);

      card.addEventListener('click', () => {
        openSubmissionForEditing(sub);
      });

      const editButton = card.querySelector('.btn-edit-submission');
      editButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openSubmissionForEditing(sub, { focusEditCenter: true });
      });

      const cardZoteroBadge = card.querySelector('.zotero-card-badge');
      if (cardZoteroBadge) {
        cardZoteroBadge.addEventListener('click', (event) => {
          event.stopPropagation();
          const key = cardZoteroBadge.getAttribute('data-item-key');
          if (key && typeof ZoteroBridge !== 'undefined') {
            ZoteroBridge.selectItemInZotero(key);
          }
        });
      }

      cards.appendChild(card);
    });
    container.appendChild(cards);

    const detailPanel = document.getElementById('submission-detail-panel');
    if (refreshDetails || detailPanel?.dataset.currentSubmissionId !== selectedSubmission.id) {
      renderSubmissionDetails(selectedSubmission);
    }
  }

  // Render journal portals section
  renderJournalPortals();
  applySubmissionSearch();
}

function renderJournalPortals() {
  const portalList = document.getElementById('journal-portals-list');
  if (!portalList) return;
  window.RFUI.setHTML(portalList, '');

  if (!db.settings) db.settings = {};
  if (!db.settings.journalPortals) {
    db.settings.journalPortals = [
      { id: 'acs', name: 'ACS', url: 'https://publish.acs.org/app/login?code=1000', color: '#002C6C', isDefault: true },
      { id: 'wiley', name: 'Wiley', url: 'https://submission.wiley.com/submission/dashboard', color: '#00A4E4', isDefault: true },
      { id: 'apl', name: 'APL', url: 'https://apl.peerx-press.org/cgi-bin/main.plex', color: '#D22630', isDefault: true },
      { id: 'nature', name: 'Nature', url: 'https://mts-ncomms.nature.com/cgi-bin/main.plex', color: '#B59E50', isDefault: true }
    ];
  }

  const portals = db.settings.journalPortals;

  if (portals.length === 0) {
    window.RFUI.setHTML(portalList, `<p class="empty-state" style="padding: 12px; font-size: 11px;">${escapeHTML(t('portalEmpty'))}</p>`);
    return;
  }

  portals.forEach(portal => {
    const card = document.createElement('div');
    card.className = 'portal-item-card';
    const safeUrl = window.RFUI.isSafeWebUrl(portal.url) ? portal.url : '';

    let domain = '';
    try {
      domain = new URL(portal.url).hostname;
    } catch (e) {
      domain = portal.url;
    }

    const initial = String(portal.name || '').charAt(0).toUpperCase();
    const portalColor = /^#[0-9a-f]{6}$/i.test(portal.color || '') ? portal.color : 'var(--accent-purple)';
    card.title = `${portal.name} - ${domain}`;

    window.RFUI.setHTML(card, `
      <a class="portal-open" href="${escapeHTML(safeUrl || '#')}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(portal.name)} · ${escapeHTML(domain)}">
      <div class="portal-info">
        <div class="portal-avatar" style="background-color: ${portalColor};">
          ${escapeHTML(initial)}
        </div>
        <div class="portal-text">
          <span class="portal-name">${escapeHTML(portal.name)}</span>
          <span class="portal-domain" title="${escapeHTML(portal.url)}">${escapeHTML(domain)}</span>
        </div>
      </div>
      </a>
      <div class="portal-actions">
        <button type="button" class="btn-edit-portal" title="${currentLanguage === 'zh' ? '编辑投稿入口' : 'Edit portal'}" aria-label="${currentLanguage === 'zh' ? '编辑' : 'Edit'} ${escapeHTML(portal.name)}">✎</button>
        <button type="button" class="btn-delete-portal" title="${escapeHTML(t('portalDeleteTitle'))}" aria-label="${escapeHTML(t('portalDeleteTitle'))} ${escapeHTML(portal.name)}" data-id="${escapeHTML(portal.id)}">
          ✕
        </button>
      </div>
    `);

    card.querySelector('.portal-open').addEventListener('click', event => {
      if (!safeUrl) event.preventDefault();
    });
    card.querySelector('.btn-edit-portal').addEventListener('click', () => openJournalPortalEditor(portal));

    // Hook up delete listener
    const deleteBtn = card.querySelector('.btn-delete-portal');
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm(tf('portalDeleteConfirm', { name: portal.name }))) {
        const previous = db.settings.journalPortals;
        try {
          db.settings.journalPortals = previous.filter(p => p.id !== portal.id);
          db = await window.storage.saveAll(db) || db;
          renderJournalPortals();
          showGlobalToast(tf('portalDeletedToast', { name: portal.name }), 'success');
        } catch (error) {
          db.settings.journalPortals = previous;
          showGlobalToast(error.message || String(error), 'error');
        }
      }
    });

    portalList.appendChild(card);
  });
}

function openJournalPortalEditor(portal = null) {
  const editing = Boolean(portal);
  openModal(`
    <div class="modal-header">
      <h2>${editing ? (currentLanguage === 'zh' ? '编辑投稿入口' : 'Edit journal portal') : escapeHTML(t('addPortalTitle'))}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal" aria-label="${escapeHTML(t('cancel'))}">✕</button>
    </div>
    <div class="form-group">
      <label for="portal-name">${escapeHTML(t('portalNameLabel'))}</label>
      <input type="text" id="portal-name" maxlength="60" value="${escapeHTML(portal?.name || '')}" placeholder="${escapeHTML(t('portalNamePlaceholder'))}">
    </div>
    <div class="form-group">
      <label for="portal-url">${escapeHTML(t('portalUrlLabel'))}</label>
      <input type="url" id="portal-url" value="${escapeHTML(portal?.url || '')}" placeholder="https://..." inputmode="url">
    </div>
    <div class="form-group">
      <label for="portal-color">${escapeHTML(t('portalColorLabel'))}</label>
      <div style="display: flex; gap: 12px; align-items: center;">
        <input type="color" id="portal-color" value="${/^#[0-9a-f]{6}$/i.test(portal?.color || '') ? portal.color : '#8b5cf6'}" style="width: 48px; height: 36px; border: none; padding: 0; background: transparent;">
        <span style="font-size: 12px; color: hsl(var(--text-muted));">${escapeHTML(t('portalColorHelp'))}</span>
      </div>
    </div>
    <button type="button" class="btn-primary w-full" id="btn-save-portal" style="margin-top:12px;">${editing ? (currentLanguage === 'zh' ? '保存修改' : 'Save changes') : escapeHTML(t('addPortalButton'))}</button>
  `);

  document.getElementById('btn-save-portal')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const name = document.getElementById('portal-name').value.trim();
    const url = document.getElementById('portal-url').value.trim();
    const color = document.getElementById('portal-color').value;
    if (!name || !url) { showGlobalToast(t('fillAllFields'), 'error'); return; }
    if (!window.RFUI.isSafeWebUrl(url)) { showGlobalToast(t('validUrlRequired'), 'error'); return; }

    const previous = Array.isArray(db.settings?.journalPortals) ? db.settings.journalPortals : [];
    const nextPortal = editing
      ? { ...portal, name, url, color }
      : { id: `portal_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11)}`, name, url, color, isDefault: false };
    const next = editing
      ? previous.map(item => item.id === portal.id ? nextPortal : item)
      : [...previous, nextPortal];
    button.disabled = true;
    try {
      db.settings.journalPortals = next;
      db = await window.storage.saveAll(db) || db;
      closeModal();
      renderJournalPortals();
      showGlobalToast(editing ? (currentLanguage === 'zh' ? '投稿入口已更新' : 'Portal updated') : tf('portalAddedToast', { name }), 'success');
    } catch (error) {
      db.settings.journalPortals = previous;
      showGlobalToast(error.message || String(error), 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function setupJournalPortalListeners() {
  document.getElementById('btn-add-portal')?.addEventListener('click', () => openJournalPortalEditor());
}

function openLinkSubmissionModal(submission) {
  const manuscripts = Array.isArray(db.manuscripts) ? db.manuscripts : [];
  if (manuscripts.length === 0) {
    showGlobalToast(t('noManuscriptsToLink'), 'warning');
    return;
  }

  const manuscriptOptions = manuscripts
    .slice()
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    .map(manuscript => `
      <option value="${escapeHTML(manuscript.id)}">${escapeHTML(manuscript.title || t('untitledManuscript'))}</option>
    `)
    .join('');

  openModal(`
    <div class="modal-header">
      <div>
        <h2>${escapeHTML(t('linkSubmissionTitle'))}</h2>
        <p class="text-muted">${escapeHTML(t('linkSubmissionHelp'))}</p>
      </div>
      <button class="btn-secondary btn-icon" id="btn-close-modal" aria-label="${escapeHTML(t('cancel'))}">✕</button>
    </div>
    <div class="form-group">
      <label for="submission-link-manuscript">${escapeHTML(t('workflowManuscriptLabel'))}</label>
      <select id="submission-link-manuscript">${manuscriptOptions}</select>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-cancel-link-sub">${escapeHTML(t('cancel') || '取消')}</button>
      <button type="button" class="btn-primary" id="btn-confirm-submission-link" style="min-width:130px;">
        ${escapeHTML(t('linkSubmissionConfirm'))}
      </button>
    </div>
  `);

  document.getElementById('btn-cancel-link-sub')?.addEventListener('click', closeModal);

  document.getElementById('btn-confirm-submission-link').addEventListener('click', async () => {
    const manuscriptId = document.getElementById('submission-link-manuscript').value;
    const manuscript = db.manuscripts.find(item => item.id === manuscriptId);
    if (!manuscript) return;
    const liveSubmission = db.submissions.find(item => item.id === submission.id);
    if (!liveSubmission) return;
    const previous = { manuscriptId: liveSubmission.manuscriptId, projectId: liveSubmission.projectId, updatedAt: liveSubmission.updatedAt };
    const manuscriptStates = db.manuscripts.map(item => [item, item.status, item.updatedAt]);
    try {
      liveSubmission.manuscriptId = manuscript.id;
      liveSubmission.projectId = manuscript.projectId || liveSubmission.projectId || null;
      liveSubmission.updatedAt = new Date().toISOString();
      syncManuscriptStatusesFromSubmissions(db);
      db = await window.storage.saveAll(db) || db;
      closeModal();
      renderDashboard();
      renderKanban();
      renderSubmissions();
      const linkedSubmission = db.submissions.find(item => item.id === submission.id);
      if (linkedSubmission) renderSubmissionDetails(linkedSubmission);
      showGlobalToast(t('linkSubmissionSaved'), 'success');
    } catch (error) {
      Object.assign(liveSubmission, previous);
      manuscriptStates.forEach(([item, status, updatedAt]) => { item.status = status; item.updatedAt = updatedAt; });
      showGlobalToast(error.message || String(error), 'error');
    }
  });
}

function renderSubmissionDetails(sub) {
  submissionAutoSaveCleanup?.();
  sub.status = normalizeSubmissionStatus(sub.status);
  normalizeSubmissionTimeline(sub);
  const detailPanel = document.getElementById('submission-detail-panel');
  const man = db.manuscripts.find(m => m.id === sub.manuscriptId);
  const project = db.projects.find(item => item.id === (sub.projectId || man?.projectId));
  const relationship = window.RFUI.buildSubmissionRelationshipSummary({
    submission: sub,
    manuscript: man,
    project,
    records: db.researchRecords
  });
  const manuscriptTitle = man ? man.title : (sub.title || t('untitledManuscript'));
  const manAbstract = man ? man.abstract || '' : '';
  const firstAuthor = getSubmissionFirstAuthor(sub, man);
  const journalName = getSubmissionJournalName(sub);
  const submissionJournalUrl = sub.journalUrl || sub.submissionUrl || '';
  const submissionDoi = getSubmissionDoi(sub);
  const articleUrl = getSubmissionArticleUrl(sub);
  const timelineAnalysis = analyzeSubmission(sub);
  const timelineSubmissionDate = normalizeDateString(sub.submissionDate || timelineAnalysis.submitDate);
  const timelineFirstDecisionDate = normalizeDateString(sub.firstDecisionDate || timelineAnalysis.r1Date);
  const timelineRevisionDueDate = normalizeDateString(sub.revisionDueDate);
  const timelineDecisionDate = normalizeDateString(sub.decisionDate || timelineAnalysis.acceptDate || timelineAnalysis.onlineDate);
  const statusText = getSubmissionStatusLabel(sub.status || 'submitted');
  const statusBadgeClass = window.RFUI.getSubmissionStatusBadgeClass(sub.status || 'submitted');

  // Cycle time duration calculations
  const cycle = getSubmissionCycleTime(sub);
  let cycleTimeHtml = '';

  if (cycle.isCompleted) {
    cycleTimeHtml = `
      <div class="submission-cycle-card submission-cycle-card-complete" data-submission-cycle-card>
        <span class="submission-cycle-icon" aria-hidden="true">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <div class="submission-cycle-copy">
          <span class="submission-cycle-label" data-submission-cycle-label>${escapeHTML(t('cycleTimeCompleted'))}</span>
          <span data-submission-cycle-text>${tf('cycleTimeCompletedText', { start: `<strong>${escapeHTML(cycle.startDateStr)}</strong>`, end: `<strong>${escapeHTML(cycle.endDateStr)}</strong>`, days: `<strong>${cycle.days}</strong>` })}</span>
        </div>
      </div>
    `;
  } else {
    cycleTimeHtml = `
      <div class="submission-cycle-card submission-cycle-card-active" data-submission-cycle-card>
        <span class="submission-cycle-icon" aria-hidden="true">
          <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        </span>
        <div class="submission-cycle-copy">
          <span class="submission-cycle-label" data-submission-cycle-label>${escapeHTML(t('submissionCycleTracking'))}</span>
          <span data-submission-cycle-text>${tf('submissionCycleText', { start: `<strong>${escapeHTML(cycle.startDateStr)}</strong>`, days: `<strong>${cycle.days}</strong>` })}</span>
        </div>
      </div>
    `;
  }

  window.RFUI.setHTML(detailPanel, `
    <div class="submission-detail-hero">
      <div class="submission-detail-heading">
        <span class="submission-detail-kicker">${escapeHTML(t('submissionDetailKicker'))}</span>
        <h2>${escapeHTML(journalName)}</h2>
      </div>
      <button class="btn-danger btn-icon submission-delete-button" id="btn-delete-sub" title="${escapeHTML(t('deleteSubmissionTitle'))}">
        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>

    <!-- Timeline indicators -->
    <div class="submission-detail-meta">
      <span class="${statusBadgeClass}" data-submission-status-badge="stage">${escapeHTML(t('currentStageLabel'))}: ${escapeHTML(statusText)}</span>
      <span class="recent-item-date">${escapeHTML(t('trackedSinceLabel'))}: ${sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : t('noDate')}</span>
    </div>

    <div class="glass-card workflow-context-card" data-submission-workflow-context="true">
      <div class="workflow-context-head">
        <div class="submission-work-title">
          <span class="submission-work-icon" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M5 8h14"/><path d="M5 16h14"/><circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/></svg>
          </span>
          <div>
            <h3>${escapeHTML(t('workflowContextTitle'))}</h3>
          </div>
        </div>
        <div class="workflow-context-actions">
          ${relationship.isOrphanSubmission ? `
            <span class="badge badge-warning">${escapeHTML(t('workflowNeedsLinking'))}</span>
            <button type="button" class="btn-secondary workflow-link-button" id="btn-link-submission-manuscript">
              ${escapeHTML(t('linkManuscript'))}
            </button>
          ` : `<span class="badge badge-success">${escapeHTML(t('workflowLinkedFlow'))}</span>`}
          <button type="button" class="btn-secondary workflow-edit-summary-button" id="btn-focus-edit-center" aria-controls="submission-entry-editor-panel">
            <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>${escapeHTML(t('jumpToEditor'))}</span>
          </button>
        </div>
      </div>
      <div class="workflow-context-grid">
        <div class="workflow-context-item">
          <span>${escapeHTML(t('workflowManuscriptLabel'))}</span>
          <strong>${escapeHTML(relationship.manuscriptTitle)}</strong>
        </div>
        <div class="workflow-context-item">
          <span>${escapeHTML(t('workflowTimelineLabel'))}</span>
          <strong>${relationship.completedTimelineNodeCount}/${relationship.timelineNodeCount}</strong>
        </div>
        <div class="workflow-context-item">
          <span>${escapeHTML(t('workflowReviewerCommentsLabel'))}</span>
          <strong>${relationship.reviewerCommentCount}</strong>
        </div>
      </div>
    </div>

    <div class="glass-card submission-edit-center submission-entry-editor-card" id="submission-entry-editor-panel" data-side-entry-editor="true">
      <div class="submission-edit-center-head">
        <div class="submission-edit-title-row">
          <span class="submission-edit-emblem" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="18" x2="13" y2="18"/></svg>
          </span>
          <div>
            <h3>${escapeHTML(t('submissionEntryEditorTitle'))}</h3>
            <p>${escapeHTML(t('submissionEntryEditorHelp'))}</p>
          </div>
        </div>
        <div class="submission-edit-badges">
          <span class="badge badge-purple">${escapeHTML(man ? t('linkedManuscriptBadge') : t('detachedSubmissionBadge'))}</span>
          <span class="${statusBadgeClass}" data-submission-status-badge="editor">${escapeHTML(statusText)}</span>
          ${articleUrl ? `<a class="doi-link" href="${escapeHTML(articleUrl)}" target="_blank" rel="noopener noreferrer">${t('articlePage')}</a>` : ''}
          ${man?.zoteroItemKey ? `
            <span class="zotero-card-badge" id="sub-detail-zotero-badge" data-item-key="${escapeHTML(man.zoteroItemKey)}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 文献库中选中此条目' : 'Select in Zotero library')}">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H6.4l5.6 6v2H2v-2h7.6L4 5V3z"/></svg>
              Zotero
            </span>
            ${man.citekey ? `<span class="zotero-citekey-badge" id="sub-detail-citekey-badge" data-citekey="${escapeHTML(man.citekey)}" title="${escapeHTML(currentLanguage === 'zh' ? '点击复制 Citation Key' : 'Click to copy Citation Key')}">[@${escapeHTML(man.citekey)}]</span>` : ''}
            ${man.pdfUri ? `<span class="zotero-pdf-badge" id="sub-detail-pdf-badge" data-item-key="${escapeHTML(man.zoteroItemKey)}" title="${escapeHTML(currentLanguage === 'zh' ? '在 Zotero 阅读器中打开 PDF' : 'Open PDF in Zotero reader')}">📖 PDF</span>` : ''}
          ` : ''}
        </div>
      </div>

      <div class="submission-edit-section">
        <div class="submission-edit-section-head">
          <span class="submission-edit-section-icon" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </span>
          <span>${escapeHTML(t('manuscriptSection'))}</span>
        </div>
        <div class="submission-edit-grid submission-edit-grid-identity">
          <div class="form-group submission-edit-title-field">
            <label>${escapeHTML(t('manuscriptTitleLabel'))}</label>
            <input type="text" id="sub-edit-title" value="${escapeHTML(manuscriptTitle)}" placeholder="${escapeHTML(t('paperTitlePlaceholder'))}">
          </div>
          <div class="form-group">
            <label>${t('targetJournalInput')}</label>
            <input type="text" id="sub-edit-journal" value="${escapeHTML(journalName)}" placeholder="${escapeHTML(t('targetJournalInput'))}">
          </div>
          <div class="form-group">
            <label>${escapeHTML(t('submissionPortalUrl'))}</label>
            <input type="url" id="sub-edit-journal-url" value="${escapeHTML(submissionJournalUrl)}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label>${t('status')}</label>
            <select id="sub-edit-status">
              <option value="submitted" ${sub.status === 'submitted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('submitted'))}</option>
              <option value="under_review" ${sub.status === 'under_review' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('under_review'))}</option>
              <option value="revision" ${sub.status === 'revision' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('revision'))}</option>
              <option value="accepted" ${sub.status === 'accepted' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('accepted'))}</option>
              <option value="published" ${sub.status === 'published' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('published'))}</option>
              <option value="rejected" ${sub.status === 'rejected' ? 'selected' : ''}>${escapeHTML(getSubmissionStatusLabel('rejected'))}</option>
            </select>
          </div>
        </div>
        <details class="submission-author-details">
          <summary>${escapeHTML(t('firstAuthorLabel'))}</summary>
        <div class="submission-first-author-module">
          <div class="submission-first-author-identity">
            <span class="submission-first-author-index" aria-hidden="true">1</span>
            <div>
              <label for="sub-edit-first-author">${escapeHTML(t('firstAuthorLabel'))}</label>
              <small>${escapeHTML(t('firstAuthorHelp'))}</small>
            </div>
          </div>
          <input type="text" id="sub-edit-first-author" value="${escapeHTML(firstAuthor)}" placeholder="${escapeHTML(t('firstAuthorPlaceholder'))}">
        </div>
        </details>
      </div>

      <div class="submission-edit-section">
        <div class="submission-edit-section-head">
          <span class="submission-edit-section-icon" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <span>${escapeHTML(t('reviewTimingSection'))}</span>
        </div>
        <div class="submission-edit-grid submission-edit-grid-dates">
          <div class="form-group">
            <label>${t('initialSubmissionDate')}</label>
            <input type="date" id="sub-edit-submission-date" value="${escapeHTML(timelineSubmissionDate)}">
          </div>
          <div class="form-group">
            <label>${t('firstDecisionDate')}</label>
            <input type="date" id="sub-edit-r1-date" value="${escapeHTML(timelineFirstDecisionDate)}">
          </div>
          <div class="form-group">
            <label>${t('revisionDueDateLabel')}</label>
            <input type="date" id="sub-edit-revision-due" value="${escapeHTML(timelineRevisionDueDate)}">
          </div>
          <div class="form-group">
            <label>${t('completionDate')} / ${t('stateAccepted')}</label>
            <input type="date" id="sub-edit-decision-date" value="${escapeHTML(timelineDecisionDate)}">
          </div>
        </div>
      </div>

      <div class="submission-edit-section">
        <div class="submission-edit-section-head">
          <span class="submission-edit-section-icon" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.33-1.33"/></svg>
          </span>
          <span>${escapeHTML(t('publicationSection'))}</span>
        </div>
        <div class="submission-edit-grid submission-edit-grid-publication">
          <div class="form-group">
            <label>${t('doiLabel')}</label>
            <input type="text" id="sub-edit-doi" value="${escapeHTML(submissionDoi)}" placeholder="10.1002/adfm.202528029">
          </div>
          <div class="form-group">
            <label>${t('articleUrlLabel')}</label>
            <input type="url" id="sub-edit-article-url" value="${escapeHTML(articleUrl)}" placeholder="${t('articleUrlPlaceholder')}">
          </div>
        </div>
      </div>

      <div class="submission-edit-section submission-edit-checklist-section">
        <div class="submission-edit-section-head submission-edit-section-head-row">
          <div class="submission-edit-section-title">
            <span class="submission-edit-section-icon" aria-hidden="true">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
            <span>${escapeHTML(t('submissionChecklistSection'))}</span>
          </div>
        </div>
        <div class="submission-checklist-grid submission-edit-checklist-grid" id="sub-edit-compliance-checklist-container"></div>
      </div>

      <div class="submission-edit-section submission-edit-review-section">
        <div class="submission-edit-section-head submission-edit-section-head-row">
          <div class="submission-edit-section-title">
            <span class="submission-edit-section-icon" aria-hidden="true">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>
            </span>
            <span>${escapeHTML(t('peerReviewMatrixSection'))}</span>
          </div>
          <button class="btn-primary submission-work-button" id="btn-add-review-comment">
            <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>${escapeHTML(t('addComment'))}</span>
          </button>
        </div>
        <div class="submission-edit-review-help">${escapeHTML(t('reviewEditorHelp'))}</div>
        <div class="submission-edit-review-container" id="sub-edit-review-matrix-container"></div>
      </div>

      <div class="submission-edit-savebar">
        <p>${escapeHTML(t('timelineDateSource'))}: ${escapeHTML(timelineAnalysis.submitDateSource)}. ${escapeHTML(t('publicationLinksKept'))}</p>
        <div class="submission-autosave-status" data-submission-autosave-status data-state="saved" role="status" aria-live="polite">
          <span class="submission-autosave-dot" aria-hidden="true"></span>
          <span data-submission-autosave-label>${escapeHTML(t('autoSaveSaved'))}</span>
        </div>
      </div>
    </div>

    <div class="glass-card submission-action-card" style="margin-top: 12px;">
      <div class="submission-action-copy">
        <span class="submission-action-icon" aria-hidden="true">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 12h14"/><path d="m12 6 6 6-6 6"/><path d="M4 5v14"/></svg>
        </span>
        <div>
          <h3>${t('transferToJournal')}</h3>
          <p>${escapeHTML(t('transferRoundHelp'))}</p>
        </div>
      </div>
      <div class="submission-action-buttons">
        <button class="btn-secondary" id="btn-mark-sub-rejected">
          <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>
          <span>${t('markRejected')}</span>
        </button>
        <button class="btn-primary" id="btn-transfer-submission">
          <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11v11"/><path d="M18 7 6 19"/></svg>
          <span>${t('transferToJournal')}</span>
        </button>
        </div>
    </div>

    <!-- Cycle Time Stats Panel -->
    ${cycleTimeHtml}

    <!-- Saved review preview and exports -->
    <div class="glass-card submission-work-card submission-readonly-review-card" style="margin-top: 16px;">
      <div class="submission-work-head">
        <div class="submission-work-title">
          <span class="submission-work-icon" aria-hidden="true">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>
          </span>
          <div>
            <h3>${escapeHTML(t('savedReviewPreviewTitle'))}</h3>
            <p>${escapeHTML(t('savedReviewPreviewHelp'))}</p>
          </div>
        </div>
        <div class="submission-work-actions">
          ${man?.zoteroItemKey ? `
          <button class="btn-secondary submission-work-button" id="btn-sync-submission-to-zotero" title="${escapeHTML(currentLanguage === 'zh' ? '同步审稿回复与修回矩阵至 Zotero 笔记' : 'Sync Review & Rebuttal Matrix to Zotero Note')}">
            <svg class="svg-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 3h12v2H6.4l5.6 6v2H2v-2h7.6L4 5V3z"/></svg>
            <span>${escapeHTML(currentLanguage === 'zh' ? '同步至 Zotero 笔记' : 'Sync to Zotero Note')}</span>
          </button>
          ` : ''}
          <button class="btn-secondary submission-work-button" id="btn-export-rebuttal-table">
            <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>${escapeHTML(t('exportTable'))}</span>
          </button>
        </div>
      </div>
      <div class="submission-review-preview" id="submission-review-preview"></div>
    </div>
  `);

  const workflowContextCard = detailPanel.querySelector('[data-submission-workflow-context="true"]');
  const editCenter = detailPanel.querySelector('.submission-edit-center');
  if (workflowContextCard && editCenter && workflowContextCard.nextElementSibling !== editCenter) {
    workflowContextCard.insertAdjacentElement('afterend', editCenter);
  }
  if (workflowContextCard && !detailPanel.querySelector('.submission-edit-center')) {
    workflowContextCard.insertAdjacentHTML('afterend', `
      <div class="glass-card submission-edit-center submission-edit-center-error">
        <div class="submission-edit-center-head">
          <div class="submission-edit-title-row">
            <span class="submission-edit-emblem" aria-hidden="true">
              <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <div>
              <h3>${escapeHTML(t('editorRenderFailedTitle'))}</h3>
              <p>${escapeHTML(t('editorRenderFailedHelp'))}</p>
            </div>
          </div>
        </div>
      </div>
    `);
  }
  const editorMounted = Boolean(detailPanel.querySelector('#sub-edit-title') && detailPanel.querySelector('[data-submission-autosave-status]'));
  detailPanel.dataset.rfRenderVersion = RF_OPTIONS_RENDER_VERSION;
  detailPanel.dataset.rfEditorMounted = editorMounted ? 'true' : 'false';
  detailPanel.dataset.currentSubmissionId = sub.id;
  detailPanel.scrollTop = 0;

  document.getElementById('btn-link-submission-manuscript')?.addEventListener('click', () => {
    openLinkSubmissionModal(sub);
  });

  const focusEditButton = document.getElementById('btn-focus-edit-center');
  if (focusEditButton) {
    focusEditButton.addEventListener('click', (event) => {
      event.preventDefault();
      focusSubmissionEditCenter();
    });
  }

  document.getElementById('btn-mark-sub-rejected').addEventListener('click', async () => {
    if (!confirm(t('confirmMarkRejected'))) return;
    markSubmissionRejected(sub, todayString());
    syncManuscriptStatusFromSubmission(sub);
    await window.storage.saveAll(db);
    renderDashboard();
    renderKanban();
    renderSubmissions();
    renderSubmissionDetails(sub);
    showGlobalToast(t('rejectedToast'), 'success');
  });

  document.getElementById('btn-transfer-submission').addEventListener('click', () => {
    openTransferSubmissionModal(sub);
  });

  // Delete submission
  document.getElementById('btn-delete-sub').addEventListener('click', async () => {
    if (confirm(t('confirmDeleteSubmission'))) {
      window.storage.recordEntityDeletion(db, 'submissions', sub.id);
      syncManuscriptStatusesFromSubmissions(db);
      selectedSubmissionId = null;
      await window.storage.saveAll(db);
      renderDashboard();
      renderKanban();
      renderSubmissions();
      window.RFUI.setHTML(document.getElementById('submission-detail-panel'), `
        <div class="empty-state">
          <svg class="svg-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <h3>${escapeHTML(t('submissionEmptyDetail'))}</h3>
        </div>
      `);
    }
  });

  const checklistKeys = getSubmissionChecklistKeys(sub);
  renderSubmissionChecklistEditor(sub, checklistKeys);
  renderSubmissionReviewMatrixEditor(sub, manAbstract);
  renderSubmissionReviewPreview(sub, checklistKeys);
  setupSubmissionAutoSave(sub);

  const btnSyncSubZotero = document.getElementById('btn-sync-submission-to-zotero');
  if (btnSyncSubZotero) {
    btnSyncSubZotero.addEventListener('click', () => {
      if (typeof ZoteroBridge !== 'undefined' && man?.zoteroItemKey) {
        btnSyncSubZotero.disabled = true;
        try {
          ZoteroBridge.syncNote(man.zoteroItemKey);
          showGlobalToast(currentLanguage === 'zh' ? '已触发同步审稿记录与修回矩阵至 Zotero 笔记' : 'Triggered sync of review & rebuttal matrix to Zotero note', 'success');
        } catch (_) {}
        setTimeout(() => { btnSyncSubZotero.disabled = false; }, 1200);
      }
    });
  }

  const subZoteroBadge = detailPanel.querySelector('#sub-detail-zotero-badge');
  if (subZoteroBadge) {
    subZoteroBadge.addEventListener('click', () => {
      if (man?.zoteroItemKey && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.selectItemInZotero(man.zoteroItemKey);
      }
    });
  }

  const subCitekeyBadge = detailPanel.querySelector('#sub-detail-citekey-badge');
  if (subCitekeyBadge && man?.citekey) {
    subCitekeyBadge.addEventListener('click', () => {
      if (typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.copyText(`[@${man.citekey}]`, currentLanguage === 'zh' ? `已复制 Citation Key: [@${man.citekey}]` : `Copied Citation Key: [@${man.citekey}]`);
      }
    });
  }

  const subPdfBadge = detailPanel.querySelector('#sub-detail-pdf-badge');
  if (subPdfBadge) {
    subPdfBadge.addEventListener('click', () => {
      if (man?.zoteroItemKey && typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.openPdf(man.zoteroItemKey);
      }
    });
  }

  // Action: Export LaTeX & Markdown Rebuttal Table
  document.getElementById('btn-export-rebuttal-table').addEventListener('click', () => {
    const savedReviewRows = getSubmissionReviewMatrixRows(sub);
    if (savedReviewRows.length === 0) {
      showGlobalToast(t('noReviewerCommentsExport'), 'warning');
      return;
    }

    // Generate Markdown table
    let mdCode = `# Rebuttal Matrix: ${manuscriptTitle}\n\n`;
    mdCode += `| # | Reviewer Comment | Author Response |\n`;
    mdCode += `|---|---|---|\n`;
    savedReviewRows.forEach((r, idx) => {
      const cmt = (r.comment || '').replace(/\|/g, '\\|').replace(/\n/g, '<br/>');
      const resp = (r.response || '').replace(/\|/g, '\\|').replace(/\n/g, '<br/>');
      mdCode += `| ${idx + 1} | ${cmt} | ${resp} |\n`;
    });

    // Generate LaTeX Code
    let latexCode = `\\documentclass{article}\n` +
                    `\\usepackage{booktabs} % For formal lines\n` +
                    `\\usepackage{longtable} % For multi-page tables\n` +
                    `\\usepackage{xcolor} % For row shading\n` +
                    `\\definecolor{commentgray}{HTML}{F6F8FA}\n\n` +
                    `\\begin{document}\n\n` +
                    `\\begin{longtable}{p{0.46\\textwidth} p{0.46\\textwidth}}\n` +
                    `\\caption{Reviewer Comments and Author Rebuttals} \\\\ \n` +
                    `\\toprule\n` +
                    `\\textbf{Reviewer Comment} & \\textbf{Author Response Rebuttal} \\\\ \n` +
                    `\\midrule\n` +
                    `\\end{firsthead}\n` +
                    `\\toprule\n` +
                    `\\textbf{Reviewer Comment} & \\textbf{Author Response Rebuttal} \\\\ \n` +
                    `\\midrule\n` +
                    `\\end{head}\n` +
                    `\\bottomrule\n` +
                    `\\end{foot}\n` +
                    `\\bottomrule\n` +
                    `\\end{lastfoot}\n`;

    savedReviewRows.forEach((matrixRow, idx) => {
      const escapedCmt = escapeLatex(matrixRow.comment || '');
      const escapedResp = escapeLatex(matrixRow.response || '');

      latexCode += `\\rowcolor{commentgray}\n` +
                   `{\\bf Reviewer Comment \\#${idx + 1}:} ${escapedCmt} &\n` +
                   `{\\bf Response:} ${escapedResp} \\\\ \\midrule\n`;
    });

    latexCode += `\\end{longtable}\n\n` +
                 `\\end{document}`;

    openModal(`
      <div class="modal-header">
        <h2>📋 ${escapeHTML(currentLanguage === 'zh' ? '导出审稿修回矩阵' : 'Export Rebuttal Matrix')}</h2>
        <button class="btn-secondary btn-icon" id="btn-close-modal">✕</button>
      </div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
        ${escapeHTML(currentLanguage === 'zh' ? `共检测到 ${savedReviewRows.length} 条审稿意见与回复，可直接复制或下载对应格式文件。` : `Detected ${savedReviewRows.length} comments and responses. Copy or download below.`)}
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button type="button" class="btn-secondary" id="modal-tab-md" style="font-size:12px; font-weight:600; padding:4px 12px; border-color:#cc292b; color:#cc292b;">Markdown 表格</button>
        <button type="button" class="btn-secondary" id="modal-tab-latex" style="font-size:12px; font-weight:600; padding:4px 12px;">LaTeX 表格</button>
      </div>
      <div class="form-group">
        <textarea id="rebuttal-export-preview" rows="11" readonly style="font-family:monospace; font-size:11px; line-height:1.5; width:100%; box-sizing:border-box; background:var(--input-bg); color:hsl(var(--text-primary)); border:1px solid var(--input-border); border-radius:6px; resize:vertical;"></textarea>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:14px;">
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-primary" id="btn-copy-rebuttal-content" style="font-size:12px;">
            <span>📋 ${escapeHTML(currentLanguage === 'zh' ? '复制到剪贴板' : 'Copy to Clipboard')}</span>
          </button>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-secondary" id="btn-download-tex" style="font-size:12px;">
            <span>💾 ${escapeHTML(currentLanguage === 'zh' ? '下载 .tex 文件' : 'Download .tex')}</span>
          </button>
          <button type="button" class="btn-secondary" id="btn-download-md" style="font-size:12px;">
            <span>💾 ${escapeHTML(currentLanguage === 'zh' ? '下载 .md 文件' : 'Download .md')}</span>
          </button>
        </div>
      </div>
    `);

    let currentFormat = 'md';
    const previewArea = document.getElementById('rebuttal-export-preview');
    const tabMd = document.getElementById('modal-tab-md');
    const tabLatex = document.getElementById('modal-tab-latex');

    const updatePreview = () => {
      if (!previewArea) return;
      if (currentFormat === 'md') {
        previewArea.value = mdCode;
        if (tabMd) { tabMd.style.borderColor = '#cc292b'; tabMd.style.color = '#cc292b'; }
        if (tabLatex) { tabLatex.style.borderColor = 'var(--input-border)'; tabLatex.style.color = 'hsl(var(--text-primary))'; }
      } else {
        previewArea.value = latexCode;
        if (tabLatex) { tabLatex.style.borderColor = '#cc292b'; tabLatex.style.color = '#cc292b'; }
        if (tabMd) { tabMd.style.borderColor = 'var(--input-border)'; tabMd.style.color = 'hsl(var(--text-primary))'; }
      }
    };
    updatePreview();

    tabMd?.addEventListener('click', () => { currentFormat = 'md'; updatePreview(); });
    tabLatex?.addEventListener('click', () => { currentFormat = 'latex'; updatePreview(); });

    document.getElementById('btn-copy-rebuttal-content')?.addEventListener('click', () => {
      const textToCopy = currentFormat === 'md' ? mdCode : latexCode;
      if (typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.copyText(textToCopy, currentLanguage === 'zh' ? `已复制 ${currentFormat === 'md' ? 'Markdown' : 'LaTeX'} 内容！` : `Copied ${currentFormat.toUpperCase()} to clipboard!`);
      } else {
        navigator.clipboard?.writeText(textToCopy);
        showGlobalToast(currentLanguage === 'zh' ? `已复制 ${currentFormat === 'md' ? 'Markdown' : 'LaTeX'} 内容！` : `Copied ${currentFormat.toUpperCase()} to clipboard!`, 'success');
      }
    });

    const triggerDownload = (content, filename, mimeType) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    document.getElementById('btn-download-tex')?.addEventListener('click', () => {
      triggerDownload(latexCode, `rebuttal_matrix_${sub.id}.tex`, 'text/plain;charset=utf-8');
      showGlobalToast(t('latexDownloaded'), 'success');
    });

    document.getElementById('btn-download-md')?.addEventListener('click', () => {
      triggerDownload(mdCode, `rebuttal_matrix_${sub.id}.md`, 'text/markdown;charset=utf-8');
      showGlobalToast(currentLanguage === 'zh' ? '已下载 Markdown 修回表格' : 'Downloaded Markdown table', 'success');
    });
  });
}

function openTransferSubmissionModal(sourceSub) {
  const sourceJournal = getSubmissionJournalName(sourceSub);
  const today = todayString();
  openModal(`
    <div class="modal-header">
      <h2>${t('transferSubmissionTitle')}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal">✕</button>
    </div>

    <div class="glass-card" style="margin-bottom:12px;">
      <p style="font-size:12px; margin:0;">${escapeHTML(t('currentJournalLabel'))}: <strong>${escapeHTML(sourceJournal)}</strong></p>
      <p class="text-muted" style="font-size:11px; margin-top:4px;">${escapeHTML(t('transferModalHelp'))}</p>
    </div>

    <div class="grid-cols-2" style="gap:10px;">
      <div class="form-group">
        <label>${t('rejectionDate')}</label>
        <input type="date" id="transfer-rejection-date" value="${today}">
      </div>
      <div class="form-group">
        <label>${t('milestoneSubmission')}</label>
        <input type="date" id="transfer-submission-date" value="${today}">
      </div>
    </div>

    <div class="form-group">
      <label>${t('newTargetJournal')}</label>
      <input type="text" id="transfer-target-journal" placeholder="${escapeHTML(t('targetJournalPlaceholder'))}">
    </div>

    <div class="form-group">
      <label>${escapeHTML(t('submissionPortalUrl'))}</label>
      <input type="url" id="transfer-journal-url" placeholder="https://...">
    </div>

    <div class="form-group">
      <label>${t('rejectionNote')}</label>
      <textarea id="transfer-rejection-note" rows="3" placeholder="${escapeHTML(t('rejectionNotePlaceholder'))}"></textarea>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-cancel-transfer">${escapeHTML(t('cancel') || '取消')}</button>
      <button type="button" class="btn-primary" id="btn-create-transfer-sub" style="min-width:130px;">${t('transferButton')}</button>
    </div>
  `);

  document.getElementById('btn-cancel-transfer')?.addEventListener('click', closeModal);

  document.getElementById('btn-create-transfer-sub').addEventListener('click', async () => {
    const targetJournal = document.getElementById('transfer-target-journal').value.trim();
    const rejectionDate = document.getElementById('transfer-rejection-date').value || today;
    const submissionDate = document.getElementById('transfer-submission-date').value || today;
    const journalUrl = document.getElementById('transfer-journal-url').value.trim();
    const rejectionNote = document.getElementById('transfer-rejection-note').value.trim();

    if (!targetJournal) {
      alert(t('manuscriptJournalRequired'));
      return;
    }

    if (journalUrl) {
      try {
        new URL(journalUrl);
      } catch (e) {
        alert(t('validPortalUrlOrBlank'));
        return;
      }
    }

    markSubmissionRejected(sourceSub, rejectionDate, rejectionNote);
    const newSub = createTransferredSubmission(sourceSub, targetJournal, submissionDate, journalUrl);
    db.submissions.push(newSub);
    syncManuscriptStatusFromSubmission(newSub);
    selectedSubmissionId = newSub.id;

    await window.storage.saveAll(db);
    closeModal();
    renderDashboard();
    renderKanban();
    renderSubmissions();
    renderSubmissionDetails(newSub);
    showGlobalToast(t('transferToast'), 'success');
  });
}


// Track New Submission trigger
document.getElementById('btn-add-submission').addEventListener('click', () => {
  let manOpts = db.manuscripts.map(m => `
    <option value="${escapeHTML(m.id)}">${escapeHTML(m.title || t('untitledManuscript'))}</option>
  `).join('');
  manOpts += `<option value="__new__">${escapeHTML(t('createNewManuscriptOption'))}</option>`;
  const defaultManuscriptMode = db.manuscripts.length === 0 ? '__new__' : (db.manuscripts[0]?.id || '__new__');
  manOpts = manOpts.replace(`value="${escapeHTML(defaultManuscriptMode)}"`, `value="${escapeHTML(defaultManuscriptMode)}" selected`);
  openModal(`
    <div class="modal-header">
      <h2>${t('trackSubmissionTitle')}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal">✕</button>
    </div>


    <div id="sub-zotero-active-item-banner" class="zotero-active-item-banner" style="display:none; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:rgba(204,0,0,0.06); border:1px solid rgba(204,0,0,0.22); border-radius:8px; margin-bottom:12px;">
      <span id="sub-zotero-active-item-text" style="font-size:12px; color:hsl(var(--text-primary)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:75%;"></span>
      <button type="button" class="btn-secondary" id="btn-sub-zotero-quick-bind-active" style="padding:4px 10px; font-size:11px; white-space:nowrap; border-color:rgba(204,0,0,0.3); color:#cc0000; font-weight:600; cursor:pointer;">⚡ 一键载入</button>
    </div>

    <div class="form-group">
      <label for="sub-man-select">${t('manuscriptPaper')}</label>
      <select id="sub-man-select">${manOpts}</select>
    </div>

    <div class="quick-new-manuscript-panel" id="sub-new-manuscript-panel" ${defaultManuscriptMode === '__new__' ? '' : 'hidden'}>
      <div class="form-group" style="margin-bottom:0;">
        <label for="sub-new-man-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${escapeHTML(t('newManuscriptTitleLabel'))}</span>
          <span style="font-size:10px; font-weight:normal; text-transform:none; color:hsl(var(--text-muted));">${escapeHTML(currentLanguage === 'zh' ? '将同步创建稿件条目' : 'Will create manuscript entry')}</span>
        </label>
        <input type="text" id="sub-new-man-title" placeholder="${escapeHTML(currentLanguage === 'zh' ? '输入论文稿件标题 (如: Deep Learning for Genomic Effect...)' : t('paperTitlePlaceholder'))}">
      </div>
    </div>

    <div class="grid-cols-2">
      <div class="form-group">
        <label for="sub-first-author">${escapeHTML(t('firstAuthorLabel'))}</label>
        <input type="text" id="sub-first-author" value="" placeholder="${escapeHTML(currentLanguage === 'zh' ? '例如: Zhang San' : t('firstAuthorPlaceholder'))}">
      </div>
      <div class="form-group">
        <label for="sub-journal">${t('targetJournalInput')}</label>
        <input type="text" id="sub-journal" placeholder="${escapeHTML(currentLanguage === 'zh' ? '例如: Nature / IEEE TPAMI' : t('targetJournalPlaceholder'))}">
      </div>
    </div>

    <div class="grid-cols-2">
      <div class="form-group">
        <label for="sub-journal-url">${escapeHTML(t('submissionPortalUrl'))}</label>
        <input type="url" id="sub-journal-url" placeholder="https://...">
      </div>
      <div class="form-group">
        <label for="sub-date">${t('initialSubmissionDate')}</label>
        <input type="date" id="sub-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" id="btn-cancel-sub">${escapeHTML(t('cancel') || '取消')}</button>
      <button type="button" class="btn-primary" id="btn-submit-sub" style="min-width:140px;">${t('trackSubmissionButton')}</button>
    </div>
  `);

  document.getElementById('btn-cancel-sub')?.addEventListener('click', closeModal);

  const manuscriptSelect = document.getElementById('sub-man-select');
  const newManuscriptPanel = document.getElementById('sub-new-manuscript-panel');

  const autoFillFromManuscript = (mId) => {
    if (mId && mId !== '__new__') {
      const selectedMan = (db.manuscripts || []).find(m => m.id === mId);
      if (selectedMan) {
        const authorInput = document.getElementById('sub-first-author');
        const journalInput = document.getElementById('sub-journal');
        const urlInput = document.getElementById('sub-journal-url');
        if (authorInput && !authorInput.value.trim() && selectedMan.authors) {
          authorInput.value = firstAuthorFromList(selectedMan.authors) || selectedMan.authors;
        }
        if (journalInput && !journalInput.value.trim() && (selectedMan.journal || selectedMan.publication)) {
          journalInput.value = selectedMan.journal || selectedMan.publication;
        }
        if (urlInput && !urlInput.value.trim() && (selectedMan.articleUrl || selectedMan.doi)) {
          urlInput.value = selectedMan.articleUrl || (selectedMan.doi ? `https://doi.org/${selectedMan.doi}` : '');
        }
      }
    }
  };

  manuscriptSelect.addEventListener('change', () => {
    const isNew = manuscriptSelect.value === '__new__';
    newManuscriptPanel.hidden = !isNew;
    if (isNew) {
      document.getElementById('sub-new-man-title')?.focus();
    } else {
      autoFillFromManuscript(manuscriptSelect.value);
    }
  });

  if (defaultManuscriptMode !== '__new__') {
    autoFillFromManuscript(defaultManuscriptMode);
  }

  // Active item detection in Zotero
  setTimeout(async () => {
    try {
      if (typeof ZoteroBridge !== 'undefined') {
        const activeItem = await ZoteroBridge.getActiveItem();
        const banner = document.getElementById('sub-zotero-active-item-banner');
        const textEl = document.getElementById('sub-zotero-active-item-text');
        const quickBindBtn = document.getElementById('btn-sub-zotero-quick-bind-active');
        if (activeItem && activeItem.title && banner && textEl) {
          window.RFUI.setHTML(textEl, `📌 <strong>${escapeHTML(currentLanguage === 'zh' ? '检测到 Zotero 选中文献：' : 'Active Zotero item: ')}</strong>《${escapeHTML(activeItem.title)}》`);
          banner.style.display = 'flex';
          quickBindBtn?.addEventListener('click', () => {
            const match = (db.manuscripts || []).find(m =>
              (m.zoteroItemKey && m.zoteroItemKey === activeItem.key) ||
              (m.title && m.title.trim().toLowerCase() === activeItem.title.trim().toLowerCase())
            );
            if (match) {
              manuscriptSelect.value = match.id;
              newManuscriptPanel.hidden = true;
            } else {
              manuscriptSelect.value = '__new__';
              newManuscriptPanel.hidden = false;
              const titleInput = document.getElementById('sub-new-man-title');
              if (titleInput) titleInput.value = activeItem.title;
            }
            const authorInput = document.getElementById('sub-first-author');
            const journalInput = document.getElementById('sub-journal');
            const urlInput = document.getElementById('sub-journal-url');
            if (authorInput && activeItem.authors) {
              authorInput.value = firstAuthorFromList(activeItem.authors) || activeItem.authors;
            }
            if (journalInput && activeItem.publication) {
              journalInput.value = activeItem.publication;
            }
            if (urlInput) {
              urlInput.value = activeItem.url || (activeItem.doi ? `https://doi.org/${activeItem.doi}` : '');
            }
            banner.style.display = 'none';
            showGlobalToast(currentLanguage === 'zh' ? '已从 Zotero 选中文献载入投稿信息' : 'Loaded submission metadata from active Zotero item', 'success');
          });
        }
      }
    } catch (_) {}
  }, 60);


  document.getElementById('btn-submit-sub').addEventListener('click', async () => {
    const createMode = window.RFUI.buildSubmissionCreateMode({
      selectedManuscriptId: manuscriptSelect.value,
      newManuscriptTitle: document.getElementById('sub-new-man-title')?.value || '',
      targetJournal: document.getElementById('sub-journal').value
    });
    const subDate = document.getElementById('sub-date').value;
    const journalUrl = document.getElementById('sub-journal-url').value.trim();
    const firstAuthor = document.getElementById('sub-first-author').value.trim().slice(0, 160);

    if (!createMode.ok) {
      alert(createMode.error);
      return;
    }

    if (journalUrl) {
      try {
        const parsedPortalUrl = new URL(journalUrl);
        if (!/^https?:$/.test(parsedPortalUrl.protocol)) throw new Error('unsupported protocol');
      } catch (_) {
        alert(t('validPortalUrlOrBlank'));
        return;
      }
    }


    let manuscriptId = createMode.manuscriptId;


    if (createMode.mode === 'new') {
      const newMan = {
        id: 'man_' + Math.random().toString(36).substring(2, 9),
        userId: 'user',
        projectId: null,
        title: createMode.title,
        shortTitle: null,
        manuscriptType: 'article',
        status: 'submitted',
        abstract: '',
        keywords: [],
        authors: firstAuthor ? [firstAuthor] : [],
        firstAuthor: firstAuthor || null,
        correspondingAuthors: [],
        targetJournals: [createMode.targetJournal],
        currentVersion: '1.0',
        plannedFigures: [],
        notes: 'Created inline while tracking a new submission',
        externalManuscriptId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.manuscripts.push(newMan);
      manuscriptId = newMan.id;
    }
    const linkedManuscript = db.manuscripts.find(m => m.id === manuscriptId);
    if (linkedManuscript && firstAuthor) {
      linkedManuscript.firstAuthor = firstAuthor;
      linkedManuscript.updatedAt = new Date().toISOString();
    }

    const newSub = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      userId: 'user',
      manuscriptId,
      projectId: db.manuscripts.find(m => m.id === manuscriptId)?.projectId || null,
      targetJournal: createMode.targetJournal,
      journalUrl: journalUrl || null,
      doi: null,
      articleUrl: null,
      status: 'submitted',
      submissionDate: dateInputToIso(subDate),
      decisionDate: null,
      revisionDueDate: null,
      firstDecisionDate: null,
      complianceChecklist: {},
      reviewMatrix: [],
      timelineNodes: [],
      externalManuscriptId: null,
      firstAuthor: firstAuthor || null,
      captureProvenance: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    normalizeSubmissionTimeline(newSub);
    db.submissions.push(newSub);
    syncManuscriptStatusFromSubmission(newSub);
    selectedSubmissionId = newSub.id;
    await window.storage.saveAll(db);

    closeModal();
    renderDashboard();
    renderKanban();
    renderSubmissions();
    showGlobalToast(t('submissionAddedToast'), 'success');
  });
});


// --- VIEW 6: MULTI-CLOUD SETTINGS ---


function updateSyncProviderVisibility() {
  const routeSelect = document.getElementById('route-db');
  if (!routeSelect) return;
  const provider = routeSelect.value || 'local';
  document.querySelectorAll('[data-sync-provider]').forEach((card) => {
    const isActive = card.dataset.syncProvider === provider;
    card.hidden = !isActive;
    card.style.display = isActive ? 'block' : 'none';
    card.classList.toggle('active', isActive);
    card.setAttribute('aria-hidden', String(!isActive));
  });

  const summary = document.getElementById('sync-route-summary');
  if (summary) {
    const summaryKey = provider === 'webdav'
      ? 'webdavSyncSummary'
      : (provider === 'github' ? 'githubSyncSummary' : 'localSyncSummary');
    summary.textContent = t(summaryKey);
    summary.dataset.provider = provider;
  }

  const localOnly = provider === 'local';
  const syncNowButton = document.getElementById('btn-sync-cloud-now');
  if (syncNowButton) {
    const configuredProvider = db?.settings?.syncProviders?.metadata?.provider || 'local';
    syncNowButton.disabled = localOnly || provider !== configuredProvider;
    syncNowButton.title = provider !== configuredProvider
      ? (currentLanguage === 'zh' ? '请先保存当前云端配置' : 'Save this cloud configuration first')
      : '';
  }

  const autoSyncToggle = document.getElementById('auto-cloud-sync');
  const autoSyncControl = document.getElementById('settings-auto-sync-control');
  const autoSyncHelp = document.getElementById('auto-cloud-sync-help');
  if (autoSyncToggle) {
    autoSyncToggle.disabled = localOnly;
    autoSyncToggle.checked = localOnly
      ? false
      : autoSyncToggle.dataset.savedValue !== 'false';
  }
  if (autoSyncControl) autoSyncControl.classList.toggle('is-disabled', localOnly);
  if (autoSyncHelp) {
    autoSyncHelp.textContent = t(localOnly ? 'autoCloudSyncLocalHelp' : 'autoCloudSyncHelp');
  }
}
window.updateSyncProviderVisibility = updateSyncProviderVisibility;

async function loadSettings() {
  const syncProviders = db.settings?.syncProviders || DEFAULT_DB.settings.syncProviders;
  const profile = db.settings?.profile || DEFAULT_DB.settings.profile;
  const credentials = await window.storage.loadSyncCredentials();

  const languageSelect = document.getElementById('ui-language');
  if (languageSelect) languageSelect.value = currentLanguage || profile.language || 'en';
  const themeSelect = document.getElementById('ui-theme');
  if (themeSelect) themeSelect.value = normalizeThemePreference(profile.theme);

  const autoSyncToggle = document.getElementById('auto-cloud-sync');
  if (autoSyncToggle) {
    const autoSyncEnabled = syncProviders.metadata.autoSync !== false;
    autoSyncToggle.dataset.savedValue = String(autoSyncEnabled);
    autoSyncToggle.checked = autoSyncEnabled;
  }

  // Cloud routing
  document.getElementById('route-db').value = syncProviders.metadata.provider || 'local';
  updateSyncProviderVisibility();

  // WebDAV
  document.getElementById('webdav-url').value = syncProviders.metadata.config?.url || '';
  document.getElementById('webdav-username').value = credentials.webdav?.username || '';
  document.getElementById('webdav-password').value = credentials.webdav?.password || '';

  // GitHub
  document.getElementById('github-token').value = credentials.github?.token || '';
  document.getElementById('github-repo').value = syncProviders.metadata.config?.repo || '';
  document.getElementById('github-branch').value = syncProviders.metadata.config?.branch || 'main';

  applyLanguage();
}

function setupSettingsListeners() {
  const languageSelect = document.getElementById('ui-language');
  if (languageSelect) {
    languageSelect.addEventListener('change', async () => {
      currentLanguage = languageSelect.value;
      document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
      db.settings = db.settings || {};
      db.settings.profile = db.settings.profile || {};
      db.settings.profile.language = currentLanguage;
      applyLanguage();
      refreshActiveViewForLanguage();
      languageSelect.disabled = true;
      try {
        await window.storage.saveAll(db);
      } finally {
        languageSelect.disabled = false;
      }
      showGlobalToast(t('languageSaved'), 'success');
    });
  }

  const themeSelect = document.getElementById('ui-theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', async () => {
      const previousTheme = normalizeThemePreference(db.settings?.profile?.theme);
      const nextTheme = applyThemePreference(themeSelect.value);
      db.settings = db.settings || {};
      db.settings.profile = db.settings.profile || {};
      db.settings.profile.theme = nextTheme;
      themeSelect.disabled = true;
      try {
        await window.storage.saveAll(db);
      } catch (error) {
        db.settings.profile.theme = previousTheme;
        themeSelect.value = previousTheme;
        applyThemePreference(previousTheme);
        throw error;
      } finally {
        themeSelect.disabled = false;
      }
      showGlobalToast(t('appearanceSaved'), 'success');
    });
  }

  const routeSelect = document.getElementById('route-db');
  if (routeSelect) {
    routeSelect.addEventListener('change', updateSyncProviderVisibility);
    routeSelect.addEventListener('input', updateSyncProviderVisibility);
    updateSyncProviderVisibility();
  }

  const autoSyncToggle = document.getElementById('auto-cloud-sync');
  if (autoSyncToggle) {
    autoSyncToggle.addEventListener('change', () => {
      autoSyncToggle.dataset.savedValue = String(autoSyncToggle.checked);
    });
  }

  // Save Mappings Button
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const routeDb = document.getElementById('route-db').value;

    const webdavConfig = {
      url: document.getElementById('webdav-url').value.trim(),
      username: document.getElementById('webdav-username').value.trim(),
      password: document.getElementById('webdav-password').value.trim()
    };

    const githubConfig = {
      token: document.getElementById('github-token').value.trim(),
      repo: document.getElementById('github-repo').value.trim(),
      branch: document.getElementById('github-branch').value.trim() || 'main'
    };
    const selectedConfig = routeDb === 'webdav'
      ? webdavConfig
      : (routeDb === 'github' ? githubConfig : {});
    const autoSync = document.getElementById('auto-cloud-sync')?.dataset.savedValue !== 'false';
    const configurationIssue = window.storage.getSyncConfigurationIssue({
      provider: routeDb,
      config: selectedConfig
    });
    if (configurationIssue) {
      showGlobalToast(configurationIssue, 'error');
      return;
    }

    await window.storage.saveSyncCredentials(routeDb, selectedConfig);
    const publicConfig = window.storage.getPublicSyncConfig(routeDb, selectedConfig);

    // Credentials are device-local and never enter the synchronized database.
    db.settings.syncProviders = {
      metadata: {
        provider: routeDb,
        config: publicConfig,
        autoSync
      }
    };

    await window.storage.saveAll(db);
    updateSyncProviderVisibility();
    showGlobalToast('Cloud database mapping saved!', 'success');
  });

  document.getElementById('btn-sync-cloud-now')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const result = await window.storage.syncDatabaseNow();
      if (!result?.success) throw new Error(result?.error || 'Cloud sync failed');
      db = await window.storage.loadAll();
      await renderAllViews();
      showGlobalToast(result.pending
        ? (currentLanguage === 'zh' ? '已同步，新的本机修改等待下一次同步' : 'Synced; newer local edits remain pending')
        : (currentLanguage === 'zh' ? '云端同步完成' : 'Cloud sync complete'), 'success');
    } catch (error) {
      showGlobalToast(error.message || String(error), 'error');
    } finally {
      button.removeAttribute('aria-busy');
      updateSyncProviderVisibility();
    }
  });

  // Test WebDAV Connection
  document.getElementById('btn-test-webdav').addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-webdav');
    btn.disabled = true;
    btn.textContent = 'Testing connection...';

    const config = {
      url: document.getElementById('webdav-url').value.trim(),
      username: document.getElementById('webdav-username').value.trim(),
      password: document.getElementById('webdav-password').value.trim()
    };

    const result = await window.storage.testConnection('webdav', config);
    if (result.success) {
      showGlobalToast('WebDAV drive connected successfully!', 'success');
    } else {
      alert(`WebDAV test failed: ${result.error}`);
    }
    btn.disabled = false;
    btn.textContent = 'Test WebDAV Connection';
  });

  // Test GitHub Connection
  document.getElementById('btn-test-github').addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-github');
    btn.disabled = true;
    btn.textContent = 'Testing repo...';

    const config = {
      token: document.getElementById('github-token').value.trim(),
      repo: document.getElementById('github-repo').value.trim(),
      branch: document.getElementById('github-branch').value.trim() || 'main'
    };

    const result = await window.storage.testConnection('github', config);
    if (result.success) {
      showGlobalToast('GitHub repository sync mapping validated!', 'success');
    } else {
      alert(`GitHub test failed: ${result.error}`);
    }
    btn.disabled = false;
    btn.textContent = 'Test GitHub Repository';
  });

  // --- DATABASE BACKUP & IMPORT LISTENERS ---
  // Export Database
  document.getElementById('btn-export-db').addEventListener('click', async () => {
    const isZoteroEnv = Boolean(
      (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
      (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero))
    );
    if (isZoteroEnv && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.exportDatabase) {
      try {
        const res = await ZoteroBridge.exportDatabase();
        if (res?.success) {
          showGlobalToast(t('databaseExported'), 'success');
          return;
        }
        if (res?.cancelled) {
          return;
        }
      } catch (e) {
        console.warn('[ResearchFlow] Zotero native export failed, falling back to browser download:', e);
      }
    }
    const safeDb = window.storage.sanitizeDatabaseForExternalUse(db);
    const exportBlob = new Blob([JSON.stringify(safeDb, null, 2)], { type: 'application/json;charset=utf-8' });
    const exportUrl = URL.createObjectURL(exportBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", exportUrl);
    downloadAnchor.setAttribute("download", `researchflow-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(exportUrl), 1000);
    showGlobalToast(t('databaseExported'), 'success');
  });

  document.getElementById('btn-export-diagnostics').addEventListener('click', async () => {
    const metadataRoute = db?.settings?.syncProviders?.metadata || { provider: 'local', config: {} };
    const effectiveRoute = await window.storage.getEffectiveMetadataProvider(db);
    const diagnosticReport = {
      generatedAt: new Date().toISOString(),
      extension: {
        name: RFPlatform?.runtime?.getManifest?.()?.name || 'ResearchFlow Zotero',
        version: RFPlatform?.runtime?.getManifest?.()?.version || RF_OPTIONS_RENDER_VERSION,
        schemaVersion: Number(db.schemaVersion) || null,
        revision: Number(db.revision) || 0
      },
      runtime: {
        language: currentLanguage,
        online: navigator.onLine,
        platform: navigator.platform || '',
        userAgent: navigator.userAgent || ''
      },
      database: {
        lastUpdated: db.updatedAt || null,
        counts: {
          projects: db.projects?.length || 0,
          manuscripts: db.manuscripts?.length || 0,
          submissions: db.submissions?.length || 0,
          tasks: db.tasks?.length || 0
        }
      },
      synchronization: {
        provider: metadataRoute.provider || 'local',
        configurationValid: !window.storage.getSyncConfigurationIssue(effectiveRoute)
      },
      capture: {
        submissionRecognitionEnabled: document.getElementById('submission-assist-enabled')?.checked !== false,
        detailedCaptureEnabled: document.getElementById('submission-assist-capture-enabled')?.checked !== false
      },
      privacy: {
        credentialsIncluded: false,
        manuscriptMetadataIncluded: false
      }
    };

    const isZoteroEnv = Boolean(
      (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
      (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero))
    );
    if (isZoteroEnv && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.exportDiagnostics) {
      try {
        const res = await ZoteroBridge.exportDiagnostics(diagnosticReport);
        if (res?.success) {
          showGlobalToast(t('diagnosticsExported'), 'success');
          return;
        }
        if (res?.cancelled) {
          return;
        }
      } catch (e) {
        console.warn('[ResearchFlow] Zotero native diagnostics export failed, falling back to blob:', e);
      }
    }

    const diagnosticBlob = new Blob(
      [JSON.stringify(diagnosticReport, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );
    const diagnosticUrl = URL.createObjectURL(diagnosticBlob);
    const anchor = document.createElement('a');
    anchor.href = diagnosticUrl;
    anchor.download = `researchflow-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(diagnosticUrl), 1000);
    showGlobalToast(t('diagnosticsExported'), 'success');
  });

  // Trigger File Import Dialog
  document.getElementById('btn-trigger-import').addEventListener('click', async () => {
    const isZoteroEnv = Boolean(
      (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
      (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero))
    );
    if (isZoteroEnv && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.importDatabase) {
      try {
        const res = await ZoteroBridge.importDatabase('merge');
        if (res?.success && res.data) {
          db = res.data;
          await renderAllViews();
          await loadSettings();
          showGlobalToast(t('databaseImported') || '数据库导入成功！', 'success');
          return;
        }
        if (res?.cancelled) {
          return;
        }
      } catch (e) {
        console.warn('[ResearchFlow] Zotero native import failed, falling back to file input:', e);
      }
    }
    document.getElementById('import-db-file').click();
  });

  document.getElementById('btn-restore-import-backup').addEventListener('click', async () => {
    if (!confirm(t('restoreImportConfirm'))) return;

    const isZoteroEnv = Boolean(
      (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
      (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero))
    );
    if (isZoteroEnv && typeof ZoteroBridge !== 'undefined' && ZoteroBridge.restoreBackup) {
      try {
        const res = await ZoteroBridge.restoreBackup();
        if (res?.success && res.data) {
          db = res.data;
          await renderAllViews();
          await loadSettings();
          showGlobalToast(t('importBackupRestored'), 'success');
          return;
        }
        if (res?.error) {
          showGlobalToast(res.error, 'error');
          return;
        }
      } catch (e) {
        console.warn('[ResearchFlow] Zotero restore failed, trying browser storage:', e);
      }
    }

    const result = await new Promise((resolve) => {
      RFPlatform.storage.local.get([PRE_IMPORT_BACKUP_KEY], resolve);
    });
    const backup = result?.[PRE_IMPORT_BACKUP_KEY];
    if (!backup?.database) {
      showGlobalToast(t('noImportBackup'), 'error');
      return;
    }

    try {
      const normalizedBackup = await window.storage.ensureDbShape(backup.database, { stamp: false });
      db = await window.storage.saveAll(normalizedBackup, { replace: true, expectedRevision: db.revision });
      await renderAllViews();
      await loadSettings();
      showGlobalToast(t('importBackupRestored'), 'success');
    } catch (err) {
      console.error('Failed to restore pre-import backup.', err);
      showGlobalToast(err.message || t('invalidBackup'), 'error');
    }
  });


  // Handle Imported JSON File and Adapt Schema Format
  document.getElementById('import-db-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      e.target.value = '';
      showGlobalToast(t('importFileTooLarge'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importJson = JSON.parse(event.target.result);
        const recognizedCollections = [
          'projects',
          'researchRecords',
          'manuscripts',
          'submissions',
          'tasks',
          'achievements',
          'honorOpportunities',
          'honorApplications'
        ];
        if (
          !importJson
          || typeof importJson !== 'object'
          || Array.isArray(importJson)
          || !recognizedCollections.some((key) => Array.isArray(importJson[key]))
        ) {
          throw new Error(t('invalidBackup'));
        }

        if (Number(importJson.schemaVersion) > 7) throw new Error('This backup requires a newer version of ResearchFlow.');
        function capitalize(str) {
          if (!str) return '';
          return str.charAt(0).toUpperCase() + str.slice(1);
        }

        // Clone current database structure (maintains user's credentials/settings if any)
        const newDb = JSON.parse(JSON.stringify(db));

        // 1. Convert Projects
        if (Array.isArray(importJson.projects)) {
          newDb.projects = importJson.projects.map(proj => ({
            id: proj.id,
            userId: proj.userId || 'user',
            areaId: proj.areaId || null,
            title: proj.title,
            shortTitle: proj.shortTitle || null,
            discipline: capitalize(proj.discipline) || (proj.area ? capitalize(proj.area.name) : 'General'),
            abstract: proj.description || '',
            hypothesis: proj.hypothesis || '',
            objectives: Array.isArray(proj.objectives) ? proj.objectives : [],
            keywords: Array.isArray(proj.keywords) ? proj.keywords : [],
            tags: Array.isArray(proj.tags) ? proj.tags : [],
            customFields: proj.customFields || {},
            currentStage: proj.currentStage || (proj.status === 'completed' ? 'Completed' : 'Planning'),
            status: proj.status || 'planning',
            createdAt: proj.createdAt,
            updatedAt: proj.updatedAt
          }));
        }

        // 2. Convert Research Records
        if (Array.isArray(importJson.researchRecords)) {
          newDb.researchRecords = importJson.researchRecords.map(rec => ({
            id: rec.id,
            userId: rec.userId || 'user',
            projectId: rec.projectId || null,
            title: rec.title,
            recordType: rec.recordType || 'note',
            discipline: rec.discipline || '',
            methodology: rec.methodology || '',
            summary: rec.summary || '',
            rawData: rec.rawData || null,
            content: rec.content || '',
            priority: rec.priority || 'medium',
            status: rec.status || 'idea',
            attributes: rec.attributes || {},
            tags: Array.isArray(rec.tags) ? rec.tags : [],
            occurredAt: rec.occurredAt || rec.createdAt,
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt
          }));
        }

        // 3. Convert Manuscripts
        if (Array.isArray(importJson.manuscripts)) {
          newDb.manuscripts = importJson.manuscripts.map(man => ({
            id: man.id,
            userId: man.userId || 'user',
            projectId: man.projectId || null,
            title: man.title,
            shortTitle: man.shortTitle || null,
            manuscriptType: man.manuscriptType || 'article',
            status: man.status || 'idea',
            abstract: man.abstract || '',
            keywords: Array.isArray(man.keywords) ? man.keywords : [],
            authors: Array.isArray(man.authors) ? man.authors : [],
            firstAuthor: man.firstAuthor || firstAuthorFromList(man.authors) || null,
            correspondingAuthors: Array.isArray(man.correspondingAuthors) ? man.correspondingAuthors : [],
            targetJournals: Array.isArray(man.targetJournals)
              ? man.targetJournals
              : (man.targetJournal ? [man.targetJournal] : []),
            doi: normalizeDoi(man.doi || man.DOI || '') || null,
            articleUrl: String(man.articleUrl || '').trim() || null,
            academicCaptureProvenance: man.academicCaptureProvenance
              && typeof man.academicCaptureProvenance === 'object'
              && !Array.isArray(man.academicCaptureProvenance)
              ? {
                  sourceType: String(man.academicCaptureProvenance.sourceType || '').slice(0, 40),
                  sourceHost: String(man.academicCaptureProvenance.sourceHost || '').slice(0, 255),
                  sourcePageUrl: String(man.academicCaptureProvenance.sourcePageUrl || '').slice(0, 2000),
                  pdfUrl: String(man.academicCaptureProvenance.pdfUrl || '').slice(0, 2000),
                  confidenceScore: Number(man.academicCaptureProvenance.confidenceScore) || 0,
                  capturedAt: man.academicCaptureProvenance.capturedAt || null,
                  reviewedByUser: man.academicCaptureProvenance.reviewedByUser === true
                }
              : null,
            currentVersion: man.currentVersion || '1.0',
            plannedFigures: Array.isArray(man.plannedFigures) ? man.plannedFigures : [],
            notes: man.notes || null,
            createdAt: man.createdAt,
            updatedAt: man.updatedAt
          }));
        }

        // 4. Convert Submissions
        if (Array.isArray(importJson.submissions)) {
          newDb.submissions = importJson.submissions.map(sub => {
            let compliance = {};
            if (sub.complianceChecklist && typeof sub.complianceChecklist === 'object' && !Array.isArray(sub.complianceChecklist)) {
              compliance = sub.complianceChecklist;
            }
            const status = sub.status || 'submitted';
            const importedSubmission = {
              status,
              acceptedAt: sub.acceptedAt || null,
              publishedAt: sub.publishedAt || null,
              decisionDate: sub.decisionDate || sub.decisionAt || null,
              timelineNodes: Array.isArray(sub.timelineNodes) ? sub.timelineNodes : []
            };
            const keepPublicationLink = canHavePublicationLink(importedSubmission);
            const doi = keepPublicationLink
              ? normalizeDoi(sub.doi || sub.DOI || extractDoiFromText(sub.notes || ''))
              : '';
            return {
              id: sub.id,
              userId: sub.userId || 'user',
              manuscriptId: sub.manuscriptId,
              projectId: sub.projectId || null,
              firstAuthor: sub.firstAuthor || firstAuthorFromList(sub.authors) || null,
              targetJournal: sub.targetJournal || sub.journalName || '',
              journalUrl: sub.journalUrl || sub.submissionUrl || null,
              doi: doi || null,
              articleUrl: keepPublicationLink ? (sub.articleUrl || sub.publicationUrl || sub.url || null) : null,
              status,
              submissionDate: sub.submissionDate || sub.submittedAt || null,
              decisionDate: sub.decisionDate || sub.decisionAt || null,
              firstDecisionDate: sub.firstDecisionDate || null,
              revisionDueDate: sub.revisionDueDate || sub.revisionDeadline || null,
              notes: sub.notes || null,
              complianceChecklist: compliance,
              complianceChecklistKeys: Array.isArray(sub.complianceChecklistKeys)
                ? sub.complianceChecklistKeys
                  .filter(item => item && typeof item === 'object')
                  .map(item => ({
                    key: String(item.key || '').trim(),
                    label: String(item.label || item.key || '').trim()
                  }))
                  .filter(item => item.key && item.label)
                : undefined,
              reviewMatrix: Array.isArray(sub.reviewMatrix)
                ? sub.reviewMatrix
                : (Array.isArray(sub.reviewRounds) ? sub.reviewRounds : []),
              timelineNodes: Array.isArray(sub.timelineNodes) ? sub.timelineNodes : [],
              previousSubmissionId: sub.previousSubmissionId || null,
              previousJournal: sub.previousJournal || null,
              roundIndex: Number.isFinite(Number(sub.roundIndex)) && Number(sub.roundIndex) > 0
                ? Number(sub.roundIndex)
                : 1,
              rejectedAt: sub.rejectedAt || null,
              rejectionNote: sub.rejectionNote || null,
              acceptedAt: sub.acceptedAt || null,
              publishedAt: sub.publishedAt || null,
              externalManuscriptId: sub.externalManuscriptId || null,
              customFields: sub.customFields && typeof sub.customFields === 'object' && !Array.isArray(sub.customFields)
                ? sub.customFields
                : {},
              createdAt: sub.createdAt,
              updatedAt: sub.updatedAt
            };
          });
        }

        // 5. Convert Achievements
        if (Array.isArray(importJson.achievements)) {
          newDb.achievements = importJson.achievements.map(ach => ({
            id: ach.id,
            userId: ach.userId || 'user',
            title: ach.title,
            achievementType: ach.achievementType,
            description: ach.description || null,
            date: ach.date,
            role: ach.role,
            doi: ach.doi || null,
            url: ach.url || null,
            journal: ach.journal || null,
            volume: ach.volume || null,
            pages: ach.pages || null,
            impactSummary: ach.impactSummary || null,
            metadata: ach.metadata || {},
            tags: Array.isArray(ach.tags) ? ach.tags : [],
            createdAt: ach.createdAt,
            updatedAt: ach.updatedAt
          }));
        }

        // 6. Convert Honors
        if (Array.isArray(importJson.honorOpportunities)) {
          newDb.honorOpportunities = importJson.honorOpportunities;
        }
        if (Array.isArray(importJson.honorApplications)) {
          newDb.honorApplications = importJson.honorApplications;
        }
        if (Array.isArray(importJson.tasks)) {
          newDb.tasks = importJson.tasks;
        }

        // Native backups must round-trip tombstones, capture provenance and extension fields.
        // Legacy conversions above remain available for older third-party formats.
        if (Number(importJson.schemaVersion) === 7) {
          Object.assign(newDb, importJson, { settings: newDb.settings, deviceId: db.deviceId, revision: db.revision });
          for (const key of ['researchAreas', 'projects', 'researchRecords', 'manuscripts', 'submissions', 'tasks']) {
            newDb[key] = Array.isArray(importJson[key]) ? importJson[key] : [];
          }
          newDb.deletedEntities = importJson.deletedEntities || {};
        }
        syncManuscriptStatusesFromSubmissions(newDb);
        const normalizedImport = await window.storage.ensureDbShape(newDb, { stamp: false });
        const safeCurrentDb = window.storage.sanitizeDatabaseForExternalUse(db);
        await new Promise((resolve, reject) => {
          RFPlatform.storage.local.set({
            [PRE_IMPORT_BACKUP_KEY]: {
              database: safeCurrentDb,
              createdAt: new Date().toISOString(),
              sourceFileName: String(file.name || '').slice(0, 260)
            }
          }, () => {
            if (RFPlatform.runtime.lastError) {
              reject(new Error(`Unable to create the pre-import backup: ${RFPlatform.runtime.lastError.message}`));
              return;
            }
            resolve();
          });
        });

        // Only replace the in-memory cache after parsing, conversion,
        // normalization and recovery-backup creation have all succeeded.
        db = await window.storage.saveAll(normalizedImport, { replace: true, expectedRevision: db.revision });
        await renderAllViews();
        await loadSettings();
        showGlobalToast(t('databaseImported'), 'success');
      } catch (err) {
        console.error('Failed to import database JSON.', err);
        showGlobalToast(err.message || t('invalidBackup'), 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      e.target.value = '';
      showGlobalToast(t('invalidBackup'), 'error');
    };
    reader.readAsText(file);
  });
}

// --- DYNAMIC DIALOG MODAL CONTROLLER ---
const modal = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-card-content');

function openModal(htmlContent) {
  activeSharePreviewCleanup?.();
  if (!modal.classList.contains('active')) {
    const activeElement = document.activeElement;
    previousModalFocus = activeElement instanceof HTMLElement && !modal.contains(activeElement)
      ? activeElement
      : null;
  }
  window.RFUI.setHTML(modalContent, htmlContent);
  modalContent.classList.toggle('stage-modal-wide', htmlContent.includes('stage-editor'));
  modalContent.classList.toggle('share-preview-card', htmlContent.includes('share-preview-shell'));
  const isCaptureReview = htmlContent.includes('submission-capture-review')
    || htmlContent.includes('academic-capture-review')
    || htmlContent.includes('academic-capture-chooser');
  modalContent.setAttribute('aria-modal', String(!isCaptureReview));
  const heading = modalContent.querySelector('h2');
  if (heading) {
    if (!heading.id) heading.id = `modal-title-${Date.now()}`;
    modalContent.setAttribute('aria-labelledby', heading.id);
  } else {
    modalContent.removeAttribute('aria-labelledby');
  }
  modal.inert = false;
  modal.removeAttribute('inert');
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('active');

  // Auto-bind close trigger inside modal
  const closeBtn = document.getElementById('btn-close-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  window.requestAnimationFrame(() => {
    const initialFocus = modalContent.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    (initialFocus || modalContent).focus();
  });
}

function closeModal() {
  activeSharePreviewCleanup?.();
  const restoreTarget = previousModalFocus?.isConnected && !modal.contains(previousModalFocus)
    ? previousModalFocus
    : null;
  if (restoreTarget) {
    restoreTarget.focus({ preventScroll: true });
  }
  const focusedElement = document.activeElement;
  if (focusedElement instanceof HTMLElement && modal.contains(focusedElement)) {
    focusedElement.blur();
  }

  modal.inert = true;
  modal.setAttribute('inert', '');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modalContent.classList.remove('submission-capture-card');
  modalContent.classList.remove('academic-capture-card');
  modalContent.classList.remove('share-preview-card');
  if (activeSharePreviewUrl) {
    URL.revokeObjectURL(activeSharePreviewUrl);
    activeSharePreviewUrl = null;
  }
  document.body.classList.remove('submission-capture-mode');
  document.body.classList.remove('academic-capture-mode');
  const url = new URL(window.location.href);
  if (url.searchParams.has('mode')) {
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
  }
  previousModalFocus = null;
}

function setupGlobalModalListeners() {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });
}

function showAcceptanceCelebration(submission) {
  acceptanceCelebrationCleanup?.();

  const manuscript = db.manuscripts.find(item => item.id === submission.manuscriptId);
  const title = String(manuscript?.title || submission.title || t('untitledManuscript')).trim();
  const layer = document.createElement('div');
  layer.className = 'acceptance-celebration';
  layer.dataset.acceptanceCelebration = 'active';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'assertive');
  layer.setAttribute('aria-atomic', 'true');

  const particles = document.createElement('div');
  particles.className = 'acceptance-confetti-field';
  particles.setAttribute('aria-hidden', 'true');

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (!reducedMotion) {
    const colors = ['#059669', '#10b981', '#06b6d4', '#f59e0b', '#fbbf24', '#f97316'];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 54; index += 1) {
      const particle = document.createElement('i');
      particle.className = 'acceptance-confetti-piece';
      particle.dataset.shape = index % 4 === 0 ? 'round' : 'strip';
      particle.style.setProperty('--confetti-x', `${Math.random() * 100}vw`);
      particle.style.setProperty('--confetti-drift', `${(Math.random() - 0.5) * 34}vw`);
      particle.style.setProperty('--confetti-rotate', `${540 + Math.random() * 900}deg`);
      particle.style.setProperty('--confetti-delay', `${Math.random() * 0.55}s`);
      particle.style.setProperty('--confetti-duration', `${2.25 + Math.random() * 1.15}s`);
      particle.style.setProperty('--confetti-color', colors[index % colors.length]);
      fragment.appendChild(particle);
    }
    particles.appendChild(fragment);
  }

  const banner = document.createElement('div');
  banner.className = 'acceptance-celebration-banner';

  const seal = document.createElement('span');
  seal.className = 'acceptance-celebration-seal';
  seal.setAttribute('aria-hidden', 'true');
  window.RFUI.setHTML(seal, `
    <svg viewBox="0 0 24 24">
      <path d="M7 12.4 10.2 16 17.4 8.2"></path>
      <circle cx="12" cy="12" r="9"></circle>
    </svg>
  `);

  const copy = document.createElement('span');
  copy.className = 'acceptance-celebration-copy';
  const eyebrow = document.createElement('small');
  eyebrow.textContent = t('acceptanceCelebrationEyebrow');
  const heading = document.createElement('strong');
  heading.textContent = t('acceptanceCelebrationTitle');
  const body = document.createElement('span');
  body.textContent = tf('acceptanceCelebrationBody', { title });
  copy.append(eyebrow, heading, body);
  banner.append(seal, copy);
  layer.append(particles, banner);
  document.body.appendChild(layer);

  let removeTimer = null;
  const leaveTimer = window.setTimeout(() => {
    layer.classList.add('is-leaving');
    removeTimer = window.setTimeout(() => cleanup(), 520);
  }, reducedMotion ? 2400 : 3300);

  const cleanup = () => {
    clearTimeout(leaveTimer);
    if (removeTimer) clearTimeout(removeTimer);
    layer.remove();
    if (acceptanceCelebrationCleanup === cleanup) acceptanceCelebrationCleanup = null;
  };
  acceptanceCelebrationCleanup = cleanup;
}

// --- GLOBALLY ACCESSIBLE TOAST BANNER ---
function showGlobalToast(message, type = 'success') {
  let toast = document.querySelector('[data-global-toast]');
  if (!toast) {
    toast = document.createElement('div');
    toast.dataset.globalToast = 'true';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '999999';
    toast.style.padding = '10px 20px';
    toast.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.4)';
    toast.style.fontSize = '13px';
    document.body.appendChild(toast);
  }

  clearTimeout(toast._hideTimer);
  clearTimeout(toast._removeTimer);
  toast.className = `badge badge-${type === 'success' ? 'success' : 'danger'}`;
  toast.style.opacity = '1';
  toast.style.transition = 'none';
  toast.style.animation = 'slideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards';
  toast.textContent = message;

  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    toast._removeTimer = setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Warn only while an edit is dirty or a commit is outstanding.
window.addEventListener('beforeunload', event => {
  const state = document.querySelector('[data-submission-autosave-status]')?.dataset.state;
  if (pendingSubmissionSaves || ['pending', 'saving', 'error', 'invalid'].includes(state)) {
    event.preventDefault();
    event.returnValue = '';
  }
});


window.showLinkManuscriptModal = function(item) {
  if (!item) return;
  const manuscripts = db.manuscripts || [];
  if (manuscripts.length === 0) {
    showGlobalToast(currentLanguage === 'zh' ? '当前管线中暂无稿件，正在为您直接新建稿件...' : 'No manuscripts found in pipeline. Creating new manuscript...', 'info');
    openManuscriptModal(null, {
      title: item.title || '',
      publication: item.publication || '',
      abstract: item.abstract || '',
      authors: item.authors || '',
      doi: item.doi || '',
      articleUrl: item.url || '',
      zoteroItemKey: item.key || '',
      zoteroUri: item.zoteroUri || '',
      pdfUri: item.pdfUri || '',
      citekey: item.citekey || '',
      bibtex: item.bibtex || '',
      citationApa: item.citationApa || '',
      relatedItems: item.relatedItems || [],
      collections: item.collections || [],
      tags: item.tags || []
    });
    return;
  }

  const listHtml = manuscripts.map(m => `
    <div class="zotero-link-manuscript-item" data-id="${m.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:8px; background:hsl(var(--card-bg));">
      <div style="flex:1; margin-right:12px; min-width:0;">
        <div style="font-weight:600; font-size:13px; color:hsl(var(--text-primary)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(m.title)}</div>
        <div style="font-size:11px; color:hsl(var(--text-secondary)); margin-top:2px; display:flex; gap:8px;">
          <span>${currentLanguage === 'zh' ? '状态' : 'Status'}: <strong>${escapeHTML(getManuscriptStatusLabel(m.status))}</strong></span>
          ${m.targetJournals?.[0] ? `<span>${currentLanguage === 'zh' ? '期刊' : 'Journal'}: ${escapeHTML(m.targetJournals[0])}</span>` : ''}
          ${m.zoteroItemKey ? `<span style="color:#059669;">(${currentLanguage === 'zh' ? '已关联文献' : 'Linked'})</span>` : `<span style="color:#64748b;">(${currentLanguage === 'zh' ? '未关联文献' : 'Unlinked'})</span>`}
        </div>
      </div>
      <button type="button" class="btn-primary btn-bind-manuscript" data-id="${m.id}" style="padding:4px 10px; font-size:11px; white-space:nowrap; cursor:pointer;">
        🔗 ${currentLanguage === 'zh' ? '绑定此稿件' : 'Bind Manuscript'}
      </button>
    </div>
  `).join('');

  openModal(`
    <div class="modal-header">
      <h2>🔗 ${currentLanguage === 'zh' ? '关联 Zotero 文献至稿件管线' : 'Link Zotero Item to Pipeline'}</h2>
      <button class="btn-secondary btn-icon" id="btn-close-modal">✕</button>
    </div>
    <div style="background:var(--material-background, rgba(0,0,0,0.02)); border:1px solid var(--border-color); border-radius:6px; padding:10px; margin-bottom:14px; font-size:12px;">
      <div style="font-weight:600; color:var(--text-accent, #cc292b);">${currentLanguage === 'zh' ? '选中 Zotero 文献：' : 'Selected Zotero Item:'}</div>
      <div style="margin-top:2px; color:hsl(var(--text-primary)); font-size:13px; font-weight:500;">${escapeHTML(item.title || (currentLanguage === 'zh' ? '未命名文献' : 'Untitled Literature'))}</div>
      <div style="font-size:11px; color:hsl(var(--text-secondary)); margin-top:2px;">
        ${escapeHTML(item.authors || '')} (${escapeHTML(item.year || '')}) ${item.citekey ? `<code>[@${escapeHTML(item.citekey)}]</code>` : ''}
      </div>
    </div>
    <div style="font-size:12px; font-weight:600; margin-bottom:8px; color:hsl(var(--text-primary));">${currentLanguage === 'zh' ? '请选择要绑定的 ResearchFlow 稿件：' : 'Select a ResearchFlow manuscript to link:'}</div>
    <div style="max-height:300px; overflow-y:auto; padding-right:4px;">
      ${listHtml}
    </div>
  `);

  document.querySelectorAll('.btn-bind-manuscript').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const manId = e.target.dataset.id;
      const targetMan = manuscripts.find(m => m.id === manId);
      if (!targetMan) return;
      targetMan.zoteroItemKey = item.key;
      targetMan.zoteroUri = item.zoteroUri;
      targetMan.pdfUri = item.pdfUri;
      targetMan.citekey = item.citekey || targetMan.citekey || null;
      targetMan.bibtex = item.bibtex || targetMan.bibtex || null;
      targetMan.citationApa = item.citationApa || targetMan.citationApa || null;
      targetMan.updatedAt = new Date().toISOString();

      await window.storage.saveAll(db);
      if (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) {
        ZoteroBridge.syncStatusTag(item.key, targetMan.status);
        ZoteroBridge.addToPipelineCollection(item.key);
        ZoteroBridge.syncNote(item.key);
      }
      closeModal();
      renderKanban();
      renderDashboard();
      renderSubmissions();
      showGlobalToast(currentLanguage === 'zh'
        ? `成功将《${(item.title || '').slice(0, 16)}…》关联至稿件《${(targetMan.title || '').slice(0, 16)}…》！`
        : `Successfully linked "${(item.title || '').slice(0, 16)}..." to manuscript "${(targetMan.title || '').slice(0, 16)}..."!`, 'success');
    });
  });
};

function setupZoteroIntegrations() {
  const isZotero = Boolean(
    (typeof ZoteroBridge !== 'undefined' && ZoteroBridge.isZotero) ||
    (typeof window !== 'undefined' && (window.Zotero || window.parent?.Zotero || window.arguments?.[0]?.Zotero))
  );

  if (!isZotero) return;

  document.documentElement.classList.add('zotero-env');
  document.body?.classList?.add('zotero-env');

  // 1. Kanban Quick Import Button
  const quickImportBtn = document.getElementById('btn-zotero-quick-import');
  if (quickImportBtn) {
    quickImportBtn.style.display = 'inline-flex';
    window.RFUI.setHTML(quickImportBtn, `<span>📥 ${currentLanguage === 'zh' ? '从 Zotero 选中导入' : 'Import from Zotero Selection'}</span>`);
    if (!quickImportBtn.dataset.bound) {
      quickImportBtn.dataset.bound = 'true';
      quickImportBtn.addEventListener('click', async () => {
        if (typeof ZoteroBridge === 'undefined') return;
        const activeItem = await ZoteroBridge.getActiveItem();
        if (activeItem) {
          openManuscriptModal(null, {
            title: activeItem.title || '',
            publication: activeItem.publication || '',
            abstract: activeItem.abstract || '',
            authors: activeItem.authors || '',
            doi: activeItem.doi || '',
            articleUrl: activeItem.url || '',
            zoteroItemKey: activeItem.key || '',
            zoteroUri: activeItem.zoteroUri || '',
            pdfUri: activeItem.pdfUri || '',
            citekey: activeItem.citekey || '',
            bibtex: activeItem.bibtex || '',
            citationApa: activeItem.citationApa || '',
            relatedItems: activeItem.relatedItems || [],
            collections: activeItem.collections || [],
            tags: activeItem.tags || []
          });
          showGlobalToast(`已从 Zotero 文献《${(activeItem.title || '').slice(0, 18)}…》导入元数据`, 'success');
        } else {
          showGlobalToast('未在 Zotero 中检测到选中条目，请在文献库中单击选中目标论文。', 'warning');
        }
      });
    }
  }

  // Zotero-specific settings controls are shown in the preference pane.
  const zSettingsCard = document.getElementById('zotero-native-settings-card');
  if (zSettingsCard) {
    zSettingsCard.style.display = 'block';
    if (currentLanguage === 'en') {
      const h3 = zSettingsCard.querySelector('h3');
      if (h3) h3.textContent = 'Zotero 10 Native Integration';
      const p = zSettingsCard.querySelector('.text-muted');
      if (p) p.textContent = 'Manage Zotero database storage and bi-directional child note synchronization';
      const desc = zSettingsCard.querySelector('div[style*="font-size:12px"]');
      if (desc) window.RFUI.setHTML(desc, 'ResearchFlow is running directly inside Zotero 10. Data is persisted to <code>researchflow-data.json</code> in your Zotero data directory.');
      const syncBtnText = zSettingsCard.querySelector('#btn-zotero-sync-all-notes span');
      if (syncBtnText) syncBtnText.textContent = '📝 Batch sync all manuscript pipelines to Zotero child notes';
      const prefsBtnText = zSettingsCard.querySelector('#btn-zotero-open-prefs span');
      if (prefsBtnText) prefsBtnText.textContent = '⚙️ Open Zotero Preferences Pane';
    }
  }
  const syncAllNotesBtn = document.getElementById('btn-zotero-sync-all-notes');
  if (syncAllNotesBtn && !syncAllNotesBtn.dataset.bound) {
    syncAllNotesBtn.dataset.bound = 'true';
    syncAllNotesBtn.addEventListener('click', async () => {
      showGlobalToast(currentLanguage === 'zh' ? '正在同步所有关联文献的云端子笔记...' : 'Syncing child notes to Zotero...', 'info');
      let count = 0;
      for (const m of db.manuscripts || []) {
        if (m.zoteroItemKey && typeof ZoteroBridge !== 'undefined') {
          const ok = await ZoteroBridge.syncNote(m.zoteroItemKey);
          if (ok) count++;
        }
      }
      showGlobalToast(currentLanguage === 'zh'
        ? `同步成功！已将 ${count} 篇文献的管线与审稿矩阵同步至 Zotero 云端子笔记。`
        : `Synced ${count} manuscript pipelines to Zotero child notes!`, 'success');
    });
  }
  const openPrefsBtn = document.getElementById('btn-zotero-open-prefs');
  if (openPrefsBtn && !openPrefsBtn.dataset.bound) {
    openPrefsBtn.dataset.bound = 'true';
    openPrefsBtn.addEventListener('click', () => {
      if (typeof ZoteroBridge !== 'undefined') {
        ZoteroBridge.sendToHost({ type: 'RESEARCHFLOW_OPEN_PREFS' });
      }
    });
  }

  // 4. Kanban Collection Filter Dropdown
  const collectionSelect = document.getElementById('sel-zotero-collection-filter');
  const collectionFilterContainer = document.getElementById('zotero-collection-filter-container');
  window.refreshZoteroCollectionFilter = async () => {
    if (!collectionSelect || typeof ZoteroBridge === 'undefined') return;
    const collections = await ZoteroBridge.getCollections();
    if (collections && collections.length > 0) {
      if (collectionFilterContainer) collectionFilterContainer.style.display = 'inline-flex';
      const prevVal = collectionSelect.value;
      window.RFUI.setHTML(collectionSelect, `<option value="">📁 ${escapeHTML(currentLanguage === 'zh' ? '全部文献分类' : 'All Collections')}</option>`);
      collections.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.key;
        const count = col.itemKeys?.length || 0;
        opt.textContent = `${col.name} (${count})`;
        collectionSelect.appendChild(opt);
      });
      collectionSelect.value = prevVal;
    }
  };
  if (collectionSelect && !collectionSelect.dataset.bound) {
    collectionSelect.dataset.bound = 'true';
    collectionSelect.addEventListener('change', async (e) => {
      const key = e.target.value;
      window._activeZoteroCollectionFilter = key;
      if (!key) {
        window._activeZoteroCollectionItemKeys = null;
      } else {
        const cols = await ZoteroBridge.getCollections();
        const targetCol = (cols || []).find(c => c.key === key);
        window._activeZoteroCollectionItemKeys = targetCol ? new Set(targetCol.itemKeys || []) : null;
      }
      renderKanban();
    });
  }
  window.refreshZoteroCollectionFilter().catch(console.error);
}

if (typeof window !== 'undefined') {
  window.openManuscriptModal = openManuscriptModal;
  window.renderKanban = renderKanban;
  window.renderDashboard = renderDashboard;
  window.renderSubmissions = renderSubmissions;
  window.applyDatabaseUpdate = applyDatabaseUpdate;
}
