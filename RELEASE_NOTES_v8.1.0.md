# ResearchFlow Companion v8.1.0

2026-09-19 · Technology themed Share Studio cards

## Changes

- Add three technology themed share-card appearances: Cyber Neon, Aurora Lab, and Terminal Grid.
- Add dark gradients, restrained grid texture, luminous accents, and square technical timeline nodes while keeping the same measured text wrapping and privacy controls.
- Preserve all existing Paper, Ink, Blueprint, and Minimal preferences and exports.
- Extend browser smoke coverage to 84 layout cases across English and Chinese content, seven appearances, and 0–100 milestones.

## Compatibility

- The extension remains Manifest V3 and requires Chrome 116 or later.
- Existing local data, schema 7 backups, and all v8.0.0 share preferences remain supported.
- New appearance values are `cyber`, `aurora`, and `terminal`; unknown values safely fall back to Paper.

## Verification

PowerShell 7 verification passed all Node regression suites, production syntax checks, real MV3 extension smoke tests, mocked Chrome workspace smoke tests, and 84 Share Studio layout cases including real PNG exports, mobile layout, privacy changes, zoom, and blob cleanup.
