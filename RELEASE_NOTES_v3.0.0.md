# ResearchFlow Companion v3.0.0

## Overview

Version 3.0.0 removes Evidence Locker and the generic AI assistant from the active extension. Clicking the toolbar icon now opens the full ResearchFlow workspace directly instead of opening a popup or side panel.

## Breaking changes

- Removed the Evidence Locker page, navigation, metrics, relationship controls, file uploads, and provider-specific upload paths.
- Removed the side-panel AI assistant UI, behavior, and residual chat styles.
- Database schema version 4 permanently removes `evidence`, `projectEvidenceLinks`, and `recordEvidenceLinks` when an older database is loaded.
- Removed the toolbar popup entrypoint. The toolbar action opens `pages/options.html`.

## Affected data and configuration

- Historical Evidence Locker data is not retained, synchronized, or exported.
- Existing projects, research records, tasks, profile settings, and metadata-sync settings remain supported.
- The side panel remains an optional capture and working-notes surface, but toolbar clicks never open it.

## Migration

1. Export a backup before upgrading only if old Evidence Locker data must be archived outside ResearchFlow.
2. Install or reload the extension from the v3.0.0 source.
3. Click the toolbar icon to open the full workspace.

## Verification

- Parsed `manifest.json` and `data/preloaded_db.json`.
- Ran syntax checks for every active JavaScript file.
- Ran all Node test suites, including AI/Evidence removal and toolbar-entrypoint contracts.
- Ran an undefined-variable lint scan across all active scripts.

## Rollback and backup

Evidence data is deleted during schema normalization. To retain or recover it, keep a pre-upgrade JSON export and use the v2.0.0 source without importing the normalized v3 database.
