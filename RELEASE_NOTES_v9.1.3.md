# ResearchFlow for Zotero 9.1.3 — Typography and visual refinement

- Unified local UI typography across headings, body text, numbers, forms, dialogs, and native Zotero preferences. Chinese uses installed Noto Sans SC with native CJK fallbacks; English uses Segoe UI. No fonts are downloaded.
- Replaced heavy display numerals and compressed title tracking with medium weights, normal spacing, and more comfortable line heights.
- Softened navigation and primary actions, reduced card shadows and tinted surfaces, and made journal metadata neutral.
- Simplified the submission editor: removed decorative gradients, the ENTRY EDITOR stamp, and focus animation; retained clear focus and save/error states.
- Aligned visible ResearchFlow names in the workspace, tab, native menu, and preferences.
- Preserved shared editing, current-attempt history, journal portals, Zotero integration, backups, and the existing JSON schema.

## Install

Install researchflow-zotero-9.1.3.xpi using Zotero's add-on manager, restart Zotero, and reopen the workspace.

## Verification

- All 15 Node regression suites, JavaScript syntax checks, and XPI package assertions passed.
- Browser checks passed for 36 language/theme/viewport/view combinations, workspace shared editing, and 468 Share Studio layout cases, including real image export and download checks.
- Isolated Zotero 10.0.3 desktop checks confirmed consistent local typography, medium title/numeral weights, shared edits between all three modules, and persistence to disk.
- Preview images use synthetic manuscript data. The user's original JSON and production Zotero data are preserved. Real cloud accounts were not exercised in this visual update.
