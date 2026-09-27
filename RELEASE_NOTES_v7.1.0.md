# ResearchFlow Companion v7.1.0

Version 7.1.0 makes the local-first privacy boundary explicit and adds practical workspace preferences.

## Added

- Adds a local-security assurance panel to Multi-Cloud Settings.
- Adds system, light, and dark appearance preferences with immediate persistence.
- Adds an automatic cloud-sync preference while preserving manual Force Sync.
- Collapses provider configuration into one storage-routing workspace and improves responsive navigation.

## Security

- Clarifies that the database remains local until a cloud provider is intentionally configured.
- Keeps WebDAV and GitHub credentials device-local and excluded from database exports and synchronized payloads.

## Verification

- Node syntax checks and all repository regression tests pass.
- Browser verification passes for English/Chinese, light/dark appearance, Local/WebDAV routing, 760px compact layout, and 540px mobile navigation without horizontal overflow.
