# ResearchFlow for Zotero 10.0.0

- Remove the unavailable system image-sharing action from Share Studio.
- Replace the web download link with Zotero's native PNG Save As dialog. Choose the destination folder and see the complete saved path in Share Studio.
- Confirm success only after the file write completes; handle cancellation and write errors separately and prevent duplicate save dialogs.
- Keep image-copy errors visible without starting an unexpected download.
- Align workspace and diagnostic version labels with 10.0.0 and fix the automatic-update manifest URL.

Existing manuscripts, submission history, preferences, and local data use the same format; no migration is required. Install `researchflow-zotero-10.0.0.xpi` through Zotero's add-on manager and reopen ResearchFlow after the update.

The Save As dialog replaces the previous download action. The destination is the path selected in that dialog.

Validation: eight Node regression tests, syntax checks for all JavaScript files, and installation-archive/source consistency checks passed. An isolated Zotero 10.0.3 run exercised the real Share Studio renderer, bridge, native FilePicker module, and IOUtils writes with automated file-picker responses. It verified a decodable 1440 × 1800 PNG, the full saved-path message, cancellation, overwrite, filesystem errors, duplicate-click prevention, and a dialog response delayed beyond six seconds. Manual interaction with the operating-system Save As window was not tested.
