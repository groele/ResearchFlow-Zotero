# ResearchFlow for Zotero 9.1.4 — Color, depth and icon-only toolbar

- Added a deep navy brand panel, softly tinted module headers and consistent teal, amber and rose accents.
- Restored visual depth with restrained shadows, colored statistic cards, clearer stage surfaces and journal badges.
- Distinguished workflow context from the submission editor through navy and teal panel treatments, while keeping the unified local typography introduced in 9.1.3.
- Removed visible text beside the Zotero toolbar icon, including reused buttons. The accessible name, tooltip and open command remain available.
- Added slow directional motion and a gentle Today-marker pulse to submitted, under-review and revision timelines. Accepted, published, rejected and preparation records stay static; reduced-motion preferences disable the effect.
- Preserved the data format, three-module shared editing, journal portals, native settings, backups and existing workflow behavior.

## Install

Install researchflow-zotero-9.1.4.xpi from Zotero's add-on manager, restart Zotero, and reopen ResearchFlow.

## Verification

- All 15 Node regression suites, JavaScript syntax checks and XPI packaging assertions passed.
- All 36 Chinese/English, light/dark, desktop/compact layout combinations passed. Workspace shared-edit flows and 468 Share Studio layout/export cases passed.
- Live motion checks confirmed actual movement on active timelines and static rendering for completed/preparation records, including reduced-motion behavior. Rejected attempts remain outside the active dashboard.
- Isolated Zotero 10.0.3 checks confirmed the icon-only 24px toolbar button opens the workspace, timeline animation runs, and all three modules still share edits and persist to disk.
- Preview images use synthetic data; private JSON exports and temporary test packages are excluded from the release.
