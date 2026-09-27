# ResearchFlow Companion v6.1.0

## Overview

Version 6.1.0 refines the active ResearchFlow workspace with a unified scientific-console settings experience and improves submission-state reliability, acceptance feedback, automatic persistence, and browser regression coverage.

## Added

- Celebrates a newly accepted manuscript or submission with an accessible, one-time confetti milestone.
- Adds focused browser regression coverage for acceptance transitions, automatic saves, local synchronization mode, and responsive settings layouts.
- Presents local-only storage as an explicit route with clear privacy and backup expectations.

## Changed

- Rebuilds Multi-Cloud Settings as an integrated two-column control console instead of a collection of floating cards.
- Uses a restrained ink, indigo, and signal-green visual system with technical indexing, consistent controls, and responsive layouts.
- Unifies manuscript and submission status presentation around the canonical lifecycle.
- Keeps provider credentials progressively disclosed and device-local.
- Resets the workspace scroll position when switching between primary views.

## Fixed

- Acceptance feedback runs only after the accepted state is persisted and does not restart during later edits.
- Submission and manuscript status changes use isolated persistence transactions to reduce stale-write and partial-update risks.
- Automatic submission saves refresh status indicators without rebuilding the active form or losing focus.
- Multi-cloud settings retain correct provider visibility, bilingual labels, and zero horizontal overflow at desktop and compact widths.

## Compatibility

- Backward compatible with v6.0.x research databases; no data migration is required.
- Evidence Locker, generic AI, popup, side-panel, domain/project-tree, and research-record modules remain removed.
- Synchronization credentials remain device-local and are excluded from exported or synchronized JSON.

## Verification

- Node regression suites for the restored workspace, UI utilities, and storage synchronization pass.
- Production JavaScript syntax validation passes.
- Repository whitespace validation passes.
- Installed Chrome renders the redesigned settings console in English and Chinese without console errors, page errors, or horizontal overflow.

## Backup and rollback

- Export a JSON backup before changing extension versions.
- Rolling back to v6.0.1 preserves the database but removes the v6.1.0 visual treatment and reliability improvements.
