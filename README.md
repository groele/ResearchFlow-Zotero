# ResearchFlow for Zotero

[中文说明](README.zh-CN.md) · [Download XPI](https://github.com/groele/ResearchFlow-Zotero/releases/latest)

ResearchFlow is a Zotero Desktop plugin for manuscript planning, submission tracking, and review timelines. This repository distributes only the Zotero plugin. The former Chrome Companion entrypoint, webpage detectors, service worker, browser ZIP packages, and installation instructions have been removed.

## Install 9.1.3

1. Download [researchflow-zotero-9.1.3.xpi](https://github.com/groele/ResearchFlow-Zotero/releases/download/v9.1.3/researchflow-zotero-9.1.3.xpi).
2. In Zotero, open **Tools → Plugins** (called **Add-ons** in some versions), choose **Install Add-on From File**, and select the XPI.
3. Restart Zotero and open ResearchFlow from its toolbar or Tools menu.

Validated on Zotero 10.0.3. The manifest declares Zotero 7+ compatibility; other versions have not all been exercised on desktop.

## Features

- **Dashboard:** shared manuscript timelines, workflow statistics, date editing, and configurable PNG cards.
- **Manuscript Kanban:** planning and status changes, literature links, metadata from Zotero items, collections, and PDF excerpts.
- **Submissions and reviews:** attempts, transfer history, author and journal fields, deadlines, milestones, review matrix, and checklists.
- **Common submission portals:** add, edit, and delete your own HTTP/HTTPS journal submission URLs.
- **Zotero settings:** appearance, language, optional WebDAV/GitHub sync, JSON import/export, and restoration of the pre-import backup.

The three workspace views edit the same linked records. A manuscript follows its current submission attempt; historical attempts keep their own journal and status. Acceptance and online publication dates are stored separately. Cloud settings are opened through Zotero preferences. Browser-only automatic webpage recognition is absent.

## Data

Files are kept in the Zotero data directory:

| File | Purpose |
| --- | --- |
| researchflow-data.json | Main workflow database |
| researchflow-pre-import-backup.json | Snapshot created before import |
| researchflow-ui-state.json | Device-local UI state and credentials |

Existing JSON exports remain importable. Credentials are excluded from workflow exports and cloud payloads. Keep a JSON backup before replacing or restoring your database. Cloud synchronization is optional and requires your own service configuration.

## Development

Node.js 22+ and PowerShell 7 are required for packaging.

```powershell
npm run build:zotero
npm test
# Optional UI automation in a test browser with mocked Zotero APIs:
npm install --no-save --no-package-lock playwright
npx playwright install chromium
pwsh -NoProfile -File tests/verify.ps1 -Browser
```

The XPI is generated in dist-zip; unpacked staging is in dist-zotero. Packaging uses an explicit Zotero runtime allowlist. Browser automation checks the HTML interface without installing a Chrome extension. It does not replace native Zotero or real cloud-account verification.

The zotero/chrome directory, chrome.manifest, chrome:// resource URLs, and ChromeUtils are Gecko/Zotero mechanisms. They are required by Zotero and do not constitute a Google Chrome version.

See [architecture](ARCHITECTURE.md), [usage](guide.md), and [9.1.3 changes](RELEASE_NOTES_v9.1.3.md). For a defect, report the Zotero version, steps, and ResearchFlow errors from **Help → Debug Output Logging**.

The interface uses local fonts without remote font requests. Chinese prioritizes installed Noto Sans SC with native CJK fallbacks; English uses Segoe UI. Headings, body text, numerals, and controls share a consistent font family and restrained weights.
