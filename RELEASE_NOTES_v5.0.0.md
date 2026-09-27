# ResearchFlow Companion v5.0.0

## Overview

Version 5.0.0 consolidates the focused manuscript and submission workspace, intelligent journal-portal capture, first-author tracking, automatic form persistence, and a hardened synchronization boundary.

## Added

- Detects mainstream submission systems and offers an in-page quick-entry card.
- Opens captured information directly in a human-review form.
- Creates linked project, manuscript, and submission records after confirmation.
- Tracks first-author information in submission records and dashboard pipelines.
- Saves submission-editor fields automatically and reports save status accessibly.
- Prevents duplicate captured submissions by checking manuscript identifiers and capture provenance.

## Changed

- The capture review is a non-blocking partial-screen side card; the underlying workspace remains visible and interactive.
- GitHub tokens and WebDAV credentials are stored in a device-local credential record instead of the portable database.
- Database schema version 6 removes synchronization secrets from database payloads.
- Pending edits are flushed when the workspace becomes hidden or closes.
- Captured drafts remain recoverable until confirmation succeeds or the draft expires.

## Fixed

- Revision deadlines are no longer interpreted as completed R1 or first-decision dates.
- JSON exports, WebDAV uploads, and GitHub uploads redact tokens, passwords, and temporary synchronization metadata.
- Incomplete or malformed synchronization mappings do not launch background synchronization.
- Submission capture, first-author typography, settings controls, and automatic save feedback follow the main workspace design system.

## Breaking changes and migration

- Evidence Locker, the generic AI assistant, popup, side panel, domain/project-tree view, and research-record view remain removed from the active product.
- Synchronization credentials are migrated automatically from legacy database settings into device-local Chrome storage and removed from subsequent database writes.
- Users restoring a sanitized JSON backup must re-enter GitHub or WebDAV credentials on that device.
- If an older ResearchFlow database was previously uploaded to GitHub/WebDAV or exported, rotate any token or password that may have been present in that historical file.

## Verification

- All Node regression suites pass.
- JavaScript syntax checks pass for active scripts.
- Browser regression covers capture review, linked record creation, first-author display, date semantics, automatic save, and settings layout.
- Repository diff and release metadata checks pass before tagging.

## Backup and rollback

- Export a v5 JSON backup before downgrading.
- A v5 backup contains research data and non-sensitive routing metadata, but intentionally excludes synchronization credentials.
- Downgrading does not restore removed modules or credentials to the portable database.
