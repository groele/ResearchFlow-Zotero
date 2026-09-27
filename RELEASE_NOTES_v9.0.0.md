# ResearchFlow Companion 9.0.0 — Share Studio

This major product release turns the sharing dialog into a configurable card studio, with visible style choices, adjustable branding, and safer exports.

## Design and usability

- Browse all 13 existing card styles through color previews. Selecting a tile updates the full card and the keyboard-accessible style selector.
- Choose subtle, balanced, or prominent branding. The seal, wordmark, and motto resize together, with measured text bounds and clearance from the headline and divider.
- Use a wider desktop editing panel with readable visibility controls. Mobile keeps the preview above the scrollable settings and export actions within reach.
- Reset design settings without revealing hidden manuscript titles, authors, dates, or other fields.

## Export and reliability

- Select standard (720 px), high (1440 px), or ultra (2160 px) export width for ordinary cards.
- Long exports automatically reduce scale to keep the bitmap within 24 million pixels and a 16,384 px edge; the output details report the adjustment.
- When a timeline exceeds 64 displayed milestones, the output details explicitly report the summarized earlier milestones.
- Hide the previous image immediately when changing settings, preventing an outdated sensitive preview from remaining visible.
- Recover from preview-generation errors using an inline retry action. Export stays disabled until a valid replacement is ready.
- Serialize preference saves across dialog sessions and wait for pending saves before reopening. Report preference-save errors separately from image-generation errors.
- Existing submissions and visibility preferences remain compatible; no database migration is required.

## Validation

- Full `tests/verify.ps1 -Browser` verification, including real Manifest V3 extension smoke tests.
- 468 layout combinations across 13 themes, three brand sizes, two languages, and six timeline lengths.
- Browser checks for style selection, ultra resolution, bounded long exports, injected render-failure recovery, privacy-preserving reset, preference persistence, PNG download, mobile control reachability, and blob URL cleanup.
- Exported cards and desktop/mobile studio screenshots reviewed visually.

## Upgrade

Extract the release ZIP into your extension folder, reload ResearchFlow in Chrome's extension manager, and reopen its workspace. The extension manager and workspace should both show 9.0.0.
