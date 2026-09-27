/*
 * ResearchFlow core domain
 *
 * The extension deliberately models only the research loop that it owns:
 * project -> captured record -> note/task. Retired Evidence Locker data is
 * removed when an older database enters the active application.
 */
(function attachResearchCore(global) {
  'use strict';

  const CORE_COLLECTIONS = ['researchAreas', 'projects', 'researchRecords', 'tasks'];

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createId(prefix) {
    return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  }

  function normalizeDatabase(database) {
    const db = database && typeof database === 'object' ? database : {};
    delete db.evidence;
    delete db.projectEvidenceLinks;
    delete db.recordEvidenceLinks;
    CORE_COLLECTIONS.forEach((key) => { db[key] = asArray(db[key]); });
    db.settings = db.settings && typeof db.settings === 'object' ? db.settings : {};
    db.settings.profile = db.settings.profile && typeof db.settings.profile === 'object'
      ? db.settings.profile
      : { language: 'en' };
    return db;
  }

  function now() {
    return new Date().toISOString();
  }

  function getProject(db, projectId) {
    return asArray(db.projects).find((project) => project.id === projectId) || null;
  }

  function projectName(db, projectId) {
    return getProject(db, projectId)?.title || 'Unassigned';
  }

  function getDashboardStats(db) {
    const normalized = normalizeDatabase(db);
    const records = normalized.researchRecords;
    const activeProjects = normalized.projects.filter((project) => project.status !== 'completed');
    return {
      projectCount: activeProjects.length,
      recordCount: records.length,
      taskCount: normalized.tasks.filter((task) => !task.completed).length,
      recentRecords: [...records].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))).slice(0, 6)
    };
  }

  function upsertProject(db, values) {
    const stamp = now();
    const title = String(values.title || '').trim();
    if (!title) throw new Error('Project title is required.');
    const project = values.id ? getProject(db, values.id) : null;
    const patch = {
      title,
      discipline: String(values.discipline || '').trim(),
      hypothesis: String(values.hypothesis || '').trim(),
      abstract: String(values.abstract || '').trim(),
      status: values.status === 'completed' ? 'completed' : 'active',
      updatedAt: stamp
    };
    if (project) {
      Object.assign(project, patch);
      return project;
    }
    const created = { id: createId('project'), createdAt: stamp, ...patch, tags: [] };
    db.projects.push(created);
    return created;
  }

  function upsertRecord(db, values) {
    const stamp = now();
    const title = String(values.title || '').trim();
    if (!title) throw new Error('Record title is required.');
    const record = values.id ? asArray(db.researchRecords).find((item) => item.id === values.id) : null;
    const patch = {
      projectId: values.projectId || null,
      title,
      recordType: values.recordType || 'literature',
      doi: String(values.doi || '').trim(),
      summary: String(values.summary || '').trim(),
      content: String(values.content || '').trim(),
      sourceUrl: String(values.sourceUrl || '').trim(),
      tags: String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      updatedAt: stamp
    };
    if (record) Object.assign(record, patch);
    else db.researchRecords.push({ id: createId('record'), createdAt: stamp, ...patch });
  }

  function deleteProject(db, projectId) {
    db.projects = asArray(db.projects).filter((project) => project.id !== projectId);
    db.researchRecords.forEach((record) => {
      if (record.projectId === projectId) record.projectId = null;
    });
    db.tasks.forEach((task) => {
      if (task.projectId === projectId) task.projectId = null;
    });
  }

  function deleteRecord(db, recordId) {
    db.researchRecords = asArray(db.researchRecords).filter((record) => record.id !== recordId);
  }

  global.RFCore = {
    CORE_COLLECTIONS,
    normalizeDatabase,
    getProject,
    projectName,
    getDashboardStats,
    upsertProject,
    upsertRecord,
    deleteProject,
    deleteRecord
  };
}(window));
