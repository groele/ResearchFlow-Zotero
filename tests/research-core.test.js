const assert = require('node:assert/strict');

global.window = global;
require('../scripts/core/research-core.js');

const db = RFCore.normalizeDatabase({
  projects: null,
  researchRecords: 'invalid',
  tasks: [{ id: 'done', completed: true }, { id: 'open', completed: false }],
  evidence: [{ id: 'legacy-evidence' }],
  projectEvidenceLinks: [{ id: 'legacy-project-link' }],
  recordEvidenceLinks: [{ id: 'legacy-record-link' }],
  settings: null
});

assert.deepEqual(db.projects, []);
assert.deepEqual(db.researchRecords, []);
assert.equal('evidence' in db, false);
assert.equal('projectEvidenceLinks' in db, false);
assert.equal('recordEvidenceLinks' in db, false);
assert.equal(db.settings.profile.language, 'en');

const createdProject = RFCore.upsertProject(db, {
  title: '  Focused project  ',
  discipline: 'Physics',
  status: 'active'
});
assert.equal(db.projects.length, 1);
assert.equal(db.projects[0].title, 'Focused project');
assert.equal(createdProject, db.projects[0], 'project creation should return the saved project for linked workflows');

RFCore.upsertRecord(db, {
  title: '  Captured result  ',
  projectId: db.projects[0].id,
  recordType: 'analysis',
  tags: 'optics, reproducibility'
});
assert.equal(db.researchRecords.length, 1);
assert.deepEqual(db.researchRecords[0].tags, ['optics', 'reproducibility']);

assert.deepEqual(
  { taskCount: RFCore.getDashboardStats(db).taskCount },
  { taskCount: 1 }
);

RFCore.deleteProject(db, db.projects[0].id);
assert.equal(db.projects.length, 0);
assert.equal(db.researchRecords[0].projectId, null);

assert.throws(
  () => RFCore.upsertRecord(db, { title: '   ' }),
  /Record title is required/
);

console.log('research core tests passed');
