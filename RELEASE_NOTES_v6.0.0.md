# ResearchFlow Companion v6.0.0

## Overview

Version 6.0.0 simplifies the active extension surface and hardens submission tracking, automatic persistence, synchronization, backup restoration, and journal-portal capture.

## Added

- Links an existing manuscript directly from an unlinked submission workflow.
- Normalizes legacy submission statuses into one canonical lifecycle.
- Records deletion tombstones so stale cloud snapshots cannot restore deleted submissions or other synchronized entities.
- Provides real-browser smoke coverage for the dashboard, submission workspace, local settings route, language persistence, and removed modules.

## Changed

- Separates the primary new-submission action from the compact journal-portal launcher.
- Shows only the configuration card for the selected synchronization provider.
- Saves interface-language changes immediately without a separate save action.
- Disables manual synchronization when the database route is local-only.
- Serializes background database writes to prevent overlapping updates from losing data.
- Advances the portable database schema to version 7.

## Fixed

- Deleted synchronized records no longer reappear after merging an older remote snapshot.
- Legacy status aliases no longer produce inconsistent labels or workflow states.
- Imported databases are validated before replacing the active in-memory database and retain a recoverable pre-import backup.
- The submission editor no longer exposes internal render-version diagnostics.
- Invalid or incomplete synchronization mappings provide bounded feedback instead of launching an unusable sync request.

## Breaking changes and migration

- Evidence Locker, popup, side panel, generic AI, domain/project-tree, and research-record modules are not part of the active v6 product.
- Historical Evidence Locker payloads are removed rather than retained for compatibility.
- Database schema 7 adds deletion tombstones. Older clients do not understand this deletion contract and should not be used to write into the same remote database.
- Synchronization credentials remain device-local and are excluded from exports and cloud payloads.

## Verification

- Nine Node regression suites pass.
- Every production JavaScript file passes syntax validation.
- Repository diff validation passes.
- Real installed Chrome passes the browser smoke flow against both the source tree and the actual unpacked-extension load directory.
- Source and load-directory hashes match for all active runtime files.

## Backup and rollback

- Export a JSON backup before downgrading.
- Keep v6 clients on every device that writes to the same GitHub or WebDAV database.
- Downgrading does not restore removed modules, Evidence Locker data, or device-local synchronization credentials.
