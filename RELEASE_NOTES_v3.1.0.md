# ResearchFlow Companion v3.1.0

## Overview

Version 3.1.0 restores the functional main workspace after the v3.0.0 scope reduction. Dashboard pipelines, manuscript kanban, submissions, peer-review matrices, journal portals, metadata synchronization, and JSON backup/import are active again.

## Changes

- Restored Dashboard Overview, Manuscripts Kanban, and Submissions & Review.
- Restored journal portals, compliance checklists, reviewer-response editing, timeline events, and pipeline metrics.
- Removed the popup and side panel completely; the toolbar icon opens the full workspace.
- Kept Domain & Project Tree, Research Records dashboard, Evidence Locker, and generic AI assistant removed.
- Removed AI drafting, AI guideline parsing, AI credentials, and evidence-file routing.

## Data migration

Schema version 5 normalizes manuscripts and submissions while permanently removing `evidence`, `projectEvidenceLinks`, `recordEvidenceLinks`, AI settings, and evidence file-provider settings.

## Verification

- Main workspace DOM contract and localization tests.
- JavaScript syntax and undefined-variable checks.
- Storage, toolbar-entrypoint, manuscript, submission, import/export, and removed-module regression checks.

## Upgrade

Reload the unpacked extension from the v3.1.0 source directory. Close any already-open ResearchFlow tabs and click the toolbar icon to open the restored workspace.
