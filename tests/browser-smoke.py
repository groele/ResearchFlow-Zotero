import pathlib
import sys

from playwright.sync_api import sync_playwright


base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
root = pathlib.Path(__file__).resolve().parents[1]
mock_path = root / "tests" / "fixtures" / "chrome-mock.js"
artifact_dir = root / "output" / "browser-smoke-latest"
artifact_dir.mkdir(parents=True, exist_ok=True)
chrome_candidates = (
    pathlib.Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    pathlib.Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
)
chrome_executable = next((path for path in chrome_candidates if path.exists()), None)
if not chrome_executable:
    raise RuntimeError("Google Chrome executable was not found")
console_errors = []
page_errors = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=str(chrome_executable),
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.add_init_script(path=str(mock_path))
    page = context.new_page()
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(f"{base_url}/pages/options.html", wait_until="networkidle")
    page.locator("#view-dashboard").wait_for(state="visible")
    page.screenshot(path=str(artifact_dir / "01-dashboard.png"))

    share_buttons = page.locator(".btn-pipeline-share")
    assert share_buttons.count() > 0, "dashboard pipelines should expose a share shortcut"
    share_buttons.first.click()
    share_preview = page.locator(".share-preview-shell")
    share_preview.wait_for(state="visible")
    page.wait_for_function(
        """() => {
          const image = document.querySelector('.share-preview-frame img');
          const frame = document.querySelector('.share-preview-frame');
          return frame?.dataset.renderState === 'ready'
            && image?.complete && image.naturalWidth === 1080 && image.naturalHeight === 1350;
        }"""
    )
    assert page.locator(".share-preview-frame img").get_attribute("src").startswith("blob:")
    assert "Generated locally" in page.locator(".share-preview-header p").inner_text()
    visibility_controls = page.locator("[data-share-field]")
    assert visibility_controls.count() == 7
    assert page.locator('[data-share-field="title"]').is_checked()
    page.locator('label:has([data-share-field="title"])').click()
    page.wait_for_function(
        """() => globalThis.__chromeMockValues?.researchflow_share_visibility?.title === false"""
    )
    page.locator("#share-image-size").select_option("story")
    page.wait_for_function(
        """() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready'
          && document.querySelector('.share-preview-frame img')?.naturalHeight === 1920"""
    )
    page.locator("#share-image-size").select_option("portrait")
    page.wait_for_function(
        """() => document.querySelector('.share-preview-frame')?.dataset.renderState === 'ready'
          && document.querySelector('.share-preview-frame img')?.naturalHeight === 1350"""
    )
    journal_control = page.locator('[data-share-field="journal"]')
    page.locator('label:has([data-share-field="journal"])').click()
    page.wait_for_function(
        """() => globalThis.__chromeMockValues?.researchflow_share_visibility?.journal === false"""
    )
    page.wait_for_function(
        """() => document.querySelector('.share-preview-frame img')?.complete"""
    )
    assert page.locator('.share-preview-frame img').get_attribute("src").startswith("blob:")
    page.screenshot(path=str(artifact_dir / "01-share-preview.png"))
    with page.expect_download() as share_download:
        page.locator("#btn-share-download").click()
    assert share_download.value.suggested_filename.endswith("-journey.png")
    page.locator("#btn-close-modal").click()
    assert page.locator("#modal-container").get_attribute("aria-hidden") == "true"
    assert page.evaluate("() => activeSharePreviewUrl === null")

    for view_id in ("view-manuscripts", "view-submissions", "view-settings"):
        page.locator(f'.nav-item[data-view="{view_id}"]').click()
        page.locator(f"#{view_id}").wait_for(state="visible")
        # The active view uses a 300 ms fade/slide transition. Capture only
        # after it has settled so visual artifacts represent the final UI.
        page.wait_for_timeout(350)
        if view_id == "view-submissions":
            page.locator(".submission-tools-row").wait_for(state="visible")
            assert not page.locator("[data-editor-mount-badge]").count()
            assert page.locator("#btn-link-submission-manuscript").count() <= 1
            page.screenshot(path=str(artifact_dir / "02-submissions.png"))
            selected_submission_id = page.locator("#submission-detail-panel").get_attribute(
                "data-current-submission-id"
            )
            page.locator("#sub-edit-status").select_option("accepted")
            celebration = page.locator("[data-acceptance-celebration]")
            celebration.wait_for(state="visible")
            page.wait_for_function(
                """submissionId => (
                    globalThis.__chromeMockValues?.researchflow_db?.submissions
                      ?.find(item => item.id === submissionId)?.status === 'accepted'
                )""",
                arg=selected_submission_id,
            )
            page.locator(
                "[data-submission-autosave-status][data-state='saved']"
            ).wait_for(state="visible")
            assert "ACCEPTED" in page.locator(
                "[data-submission-status-badge='stage']"
            ).inner_text()
            assert page.locator(
                "[data-submission-status-badge='editor']"
            ).inner_text().strip() == "ACCEPTED"
            celebration_handle = celebration.element_handle()
            page.screenshot(path=str(artifact_dir / "02-acceptance-celebration.png"))

            page.locator(".submission-author-details summary").click()
            page.locator("#sub-edit-first-author").fill("Celebration Stability Check")
            page.wait_for_function(
                """submissionId => (
                    globalThis.__chromeMockValues?.researchflow_db?.submissions
                      ?.find(item => item.id === submissionId)?.firstAuthor
                      === 'Celebration Stability Check'
                )""",
                arg=selected_submission_id,
            )
            assert celebration.count() == 1
            assert celebration_handle.evaluate(
                "node => node.isConnected"
            ), "editing an accepted submission should not restart the celebration"
        if view_id == "view-settings":
            assert page.locator("#settings-webdav-card").is_hidden()
            assert page.locator("#settings-github-card").is_hidden()
            assert page.locator("#btn-manual-sync").is_disabled()
            assert not page.locator("#btn-save-language").count()
            page.screenshot(path=str(artifact_dir / "03-settings-local.png"))

    restore_button = page.locator("#btn-restore-import-backup")
    restore_button.wait_for(state="visible")
    assert restore_button.inner_text().strip(), "restore button should have a localized label"

    page.locator("#btn-export-db").focus()
    page.evaluate(
        """() => openModal(`
          <div class="modal-header">
            <h2>Focus regression</h2>
            <button class="btn-secondary btn-icon" id="btn-close-modal">Close</button>
          </div>
        `)"""
    )
    page.wait_for_function("() => document.activeElement?.id === 'btn-close-modal'")
    page.locator("#btn-close-modal").click()
    assert page.locator("#modal-container").get_attribute("aria-hidden") == "true"
    assert page.locator("#modal-container").get_attribute("inert") is not None
    assert page.evaluate(
        "() => !document.querySelector('#modal-container').contains(document.activeElement)"
    ), "closing a modal should move focus outside before applying aria-hidden"

    page.locator("#ui-language").select_option("zh")
    page.wait_for_function(
        "() => globalThis.__chromeMockValues?.researchflow_db?.settings?.profile?.language === 'zh'"
    )
    assert "语言切换后会自动保存" in page.locator("#language-auto-save-status").inner_text()

    page.locator("[data-acceptance-celebration]").wait_for(
        state="detached", timeout=6000
    )
    page.locator('.nav-item[data-view="view-manuscripts"]').click()
    page.locator("#view-manuscripts").wait_for(state="visible")
    page.wait_for_timeout(350)
    manuscript_select = None
    manuscript_id = None
    status_selects = page.locator(".kanban-card-select")
    for index in range(status_selects.count()):
        candidate = status_selects.nth(index)
        if candidate.input_value() not in ("accepted", "published"):
            manuscript_select = candidate
            manuscript_id = candidate.get_attribute("id").replace(
                "sel-man-status-", "", 1
            )
            break
    assert manuscript_select is not None, "fixture should include an active manuscript"
    manuscript_select.select_option("accepted")
    page.locator("[data-acceptance-celebration]").wait_for(state="visible")
    page.wait_for_timeout(600)
    page.wait_for_function(
        """manuscriptId => (
            globalThis.__chromeMockValues?.researchflow_db?.manuscripts
              ?.find(item => item.id === manuscriptId)?.status === 'accepted'
        )""",
        arg=manuscript_id,
    )
    page.screenshot(path=str(artifact_dir / "04-kanban-acceptance.png"))
    page.locator('.nav-item[data-view="view-settings"]').click()
    page.locator("#view-settings").wait_for(state="visible")

    with page.expect_download() as download_info:
        page.locator("#btn-export-db").click()
    assert download_info.value.suggested_filename.endswith(".json")

    assert not page.locator("#view-evidence").count(), "Evidence Locker must stay removed"
    assert not page.locator("#view-projects").count(), "project-tree view must stay removed"
    assert not page.locator("#view-library").count(), "research-record view must stay removed"
    assert not page_errors, f"page errors: {page_errors}"
    assert not console_errors, f"console errors: {console_errors}"

    browser.close()

print("browser smoke test passed")
