# ResearchFlow Companion v7.2.0

## Manuscript workspace refinement

- Removed the retired linked-project context selector and label from manuscript editing.
- New manuscripts no longer create a project relationship from the manuscript form.
- Existing legacy `projectId` values remain untouched for compatibility and data safety.
- Submission capture continues to create its reviewed project, manuscript, and submission chain.

## Verification

- All Node.js unit and contract tests passed.
- `node --check scripts/options.js` passed.
