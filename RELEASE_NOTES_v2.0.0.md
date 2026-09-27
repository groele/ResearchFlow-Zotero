# ResearchFlow Companion v2.0.0

## Overview

Version 2.0.0 narrows ResearchFlow to a local-first capture, working-notes, task, evidence, settings, and export workflow. The main workspace now exposes only Overview and Settings, while the popup and side panel remain the active capture surfaces.

## Breaking changes

- Removed the dedicated Domain & Project Tree and Research Records dashboard sections.
- Removed manuscript kanban, submission timelines, reviewer-response editing, journal portals, and the generic AI copilot from the active extension.
- Removed OpenAI and DeepSeek host permissions and the retired `scripts/ai.js` runtime.
- Replaced the monolithic options controller with a small lifecycle entrypoint and focused dashboard/settings modules.

## Data and configuration

- Existing `projects`, `researchRecords`, `tasks`, and `evidence` data remains compatible.
- Historical manuscript, submission, and other retired fields are preserved when old databases are loaded, but they are not exposed by the v2 dashboard.
- Existing local, WebDAV, and GitHub metadata-sync settings remain normalized by the storage layer.

## Migration

1. Export a JSON backup from the previous version before upgrading.
2. Reload the unpacked extension from the v2.0.0 source directory.
3. Use the popup or side panel for project association and record capture.
4. Use Overview for open-task/evidence counts and Settings for preferences and JSON export.

## Verification

- Parsed `manifest.json`.
- Ran syntax checks for every JavaScript file.
- Ran all Node test suites, including core-domain and runtime-contract coverage.
- Ran an undefined-variable lint scan across all active scripts.
- Browser-smoke-tested Overview, Settings, side-panel metadata capture and save, and popup quick capture and save with zero console errors.

## Rollback and backup

Keep the pre-upgrade JSON export. To roll back the source, use commit `9a44591` from the `codex/researchflow-companion-v1.2.14` history, reload the unpacked extension, and re-import the backup only if required.
