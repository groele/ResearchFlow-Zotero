"""Build a source-only Zotero installation archive with consistent release metadata."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
version = manifest['version']
addon_id = manifest['applications']['zotero']['id']
update = json.loads((ROOT / 'update.json').read_text(encoding='utf-8'))['addons'][addon_id]['updates'][0]
name = f'researchflow-zotero-{version}.xpi'
assert update['version'] == version
assert update['update_link'].endswith(f'/v{version}/{name}')
for section in ('applications', 'browser_specific_settings'):
    assert manifest[section]['zotero']['update_url'].endswith('/main/update.json')
for relative in ('chrome/content/index.html', 'chrome/content/pages/options.html',
                 'chrome/content/scripts/options.js', 'chrome/content/scripts/preferences.js'):
    assert version in (ROOT / relative).read_text(encoding='utf-8'), relative
files = [ROOT / p for p in ('bootstrap.js', 'chrome.manifest', 'manifest.json', 'prefs.js')]
files += [p for folder in ('chrome', 'locale') for p in (ROOT / folder).rglob('*') if p.is_file()]
with zipfile.ZipFile(ROOT / name, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, path.relative_to(ROOT).as_posix())
with zipfile.ZipFile(ROOT / name) as archive:
    assert archive.testzip() is None
print(f'{name}: {len(files)} runtime files, version {version}')
