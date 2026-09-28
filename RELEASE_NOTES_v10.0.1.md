# ResearchFlow for Zotero 10.0.1

Fix the undersized ResearchFlow toolbar icon. The toolbar button now uses Zotero's 28 × 28 size and 4 px spacing, with a 20 × 20 icon matching the neighboring toolbar controls. The initial and delayed icon-size settings agree, so startup no longer restores the smaller icon.

Install `researchflow-zotero-10.0.1.xpi` and restart Zotero to refresh the toolbar. Existing manuscripts and submission data do not require migration.

Validation: JavaScript syntax and archive/source consistency checks passed. In an isolated Zotero 10.0.3 run, the rendered ResearchFlow icon measured 20 × 20, matching the preceding native icons; the button measured 28 × 28 and shared their vertical center after the delayed startup updates. The toolbar screenshot was visually checked.
