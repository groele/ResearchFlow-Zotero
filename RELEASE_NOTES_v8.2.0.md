# ResearchFlow Companion v8.2.0

2026-09-19 · Academic gradient share-card collection

## Changes

- Add four academic gradient card styles: Cobalt Paper, Violet Index, Sage Archive, and Sandstone.
- Keep the new gradients inside the exported sharing card itself, with restrained paper surfaces, readable academic typography, and stable timeline contrast.
- Preserve all previous Paper, Ink, Blueprint, Minimal, Cyber Neon, Aurora Lab, and Terminal Grid card styles.
- Extend browser coverage to 132 measured card layouts across English and Chinese content, 11 styles, and 0–100 milestones.

## Compatibility

- Existing local data and saved share preferences remain supported.
- New card appearance values are `cobalt`, `violet`, `sage`, and `sand`; unknown values continue to fall back to Paper.

## Verification

PowerShell 7 verification passed all Node regression suites, production syntax checks, real MV3 extension smoke tests, mocked Chrome workspace smoke tests, and 132 Share Studio layout cases including real PNG exports, privacy changes, mobile layout, zoom, and blob cleanup.
