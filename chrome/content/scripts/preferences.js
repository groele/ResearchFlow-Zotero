/* ResearchFlow settings pane script for Zotero 7+ & 10 */
window.ResearchFlow_Preferences = (() => {
  let initialized = false;
  const PREFIX = 'extensions.researchflow.';
  const HTML = 'http://www.w3.org/1999/xhtml';

  const DEFAULTS = {
    // Window Modes
    windowMode: 'tab',
    subwindowAlwaysOnTop: false
  };

  const FIELDS = {
    window: [
      ['windowMode', '工作区默认打开模式', 'select', [
        ['tab', '📑 Zotero 内部选项卡 (无缝融入主界面标签栏)'],
        ['subwindow', '🗗 伴读紧凑子窗口 (480×780，轻量悬浮，边读文献边跟踪稿件)'],
        ['window', '⬚ 独立桌面大窗口 (1240×820，大屏全景规划)']
      ]],
      ['subwindowAlwaysOnTop', '伴读子窗口始终置顶', 'check']
    ]
  };

  const getPref = (key) => {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const val = Zotero.Prefs.get(`${PREFIX}${key}`, true);
        return val !== undefined ? val : DEFAULTS[key];
      }
    } catch (_) {}
    return DEFAULTS[key];
  };

  const setPref = (key, val) => {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        Zotero.Prefs.set(`${PREFIX}${key}`, val, true);
      }
    } catch (_) {}
  };

  const renderSection = (doc, containerId, fields) => {
    const container = doc.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    fields.forEach(([key, label, type, options]) => {
      const val = getPref(key);
      if (type === 'check') {
        const row = doc.createElementNS(HTML, 'label');
        row.className = 'rf-check-row';
        const chk = doc.createElementNS(HTML, 'input');
        chk.type = 'checkbox';
        chk.checked = Boolean(val);
        chk.addEventListener('change', () => {
          setPref(key, chk.checked);
          notifyConfigChanged();
        });
        const txt = doc.createElementNS(HTML, 'span');
        txt.className = 'rf-check-label';
        txt.textContent = label;
        row.append(chk, txt);
        container.appendChild(row);
      } else if (type === 'select') {
        const row = doc.createElementNS(HTML, 'div');
        row.className = 'rf-control-row';
        const lbl = doc.createElementNS(HTML, 'label');
        lbl.className = 'rf-control-label';
        lbl.textContent = label;
        const sel = doc.createElementNS(HTML, 'select');
        sel.className = 'rf-control';
        options.forEach(([optVal, optLabel]) => {
          const opt = doc.createElementNS(HTML, 'option');
          opt.value = optVal;
          opt.textContent = optLabel;
          if (String(optVal) === String(val)) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          setPref(key, sel.value);
          notifyConfigChanged();
        });
        row.append(lbl, sel);
        container.appendChild(row);
      }
    });
  };

  const notifyConfigChanged = () => {
    try {
      Zotero?.ResearchFlow?.notifyDataChanged?.();
    } catch (_) {}
  };

  return {
    init(window) {
      if (initialized) return;
      initialized = true;
      const doc = window.document;
      const status = doc.getElementById('rf-pref-status');
      if (status) status.textContent = '首选项已就绪。所有更改将实时生效并保存。';

      renderSection(doc, 'rf-pref-window', FIELDS.window);

      // Display data path
      try {
        const pathLabel = doc.getElementById('rf-data-path-label');
        if (pathLabel && Zotero?.ResearchFlow?.getDataFilePath) {
          pathLabel.textContent = Zotero.ResearchFlow.getDataFilePath();
        }
      } catch (_) {}

      // Fast Launch Buttons
      doc.getElementById('rf-btn-open-workspace')?.addEventListener('click', () => {
        Zotero?.ResearchFlow?.openResearchFlow?.({ currentWindowType: 'tab' }, window, 'tab');
      });
      doc.getElementById('rf-btn-open-subwindow')?.addEventListener('click', () => {
        Zotero?.ResearchFlow?.openStandaloneWindow?.({}, window, 'subwindow');
      });
      doc.getElementById('rf-btn-open-window')?.addEventListener('click', () => {
        Zotero?.ResearchFlow?.openStandaloneWindow?.({}, window, 'window');
      });

      // Export Buttons
      doc.getElementById('rf-btn-export-db')?.addEventListener('click', async () => {
        try {
          if (!Zotero?.ResearchFlow?.exportDatabaseFile) throw new Error('ResearchFlow 宿主尚未就绪');
          const result = await Zotero.ResearchFlow.exportDatabaseFile();
          if (result?.cancelled) return;
          if (!result?.success) throw new Error(result?.error || '数据库导出失败');
          if (status) status.textContent = `数据库已导出至：${result.filePath}`;
        } catch (e) {
          if (status) status.textContent = `导出失败：${e.message}`;
        }
      });

      doc.getElementById('rf-btn-export-diag')?.addEventListener('click', async () => {
        try {
          const db = await Zotero?.ResearchFlow?.loadDatabase?.();
          const diag = {
            exportedAt: new Date().toISOString(),
            zoteroVersion: Zotero.version,
            researchflowVersion: '9.1.0',
            schemaVersion: db?.schemaVersion,
            counts: {
              manuscripts: db?.manuscripts?.length || 0,
              submissions: db?.submissions?.length || 0,
              projects: db?.projects?.length || 0,
              tasks: db?.tasks?.length || 0
            }
          };
          if (!Zotero?.ResearchFlow?.exportDiagnosticsFile) throw new Error('ResearchFlow 宿主尚未就绪');
          const result = await Zotero.ResearchFlow.exportDiagnosticsFile(diag);
          if (result?.cancelled) return;
          if (!result?.success) throw new Error(result?.error || '诊断报告导出失败');
          if (status) status.textContent = `诊断报告已导出至：${result.filePath}`;
        } catch (e) {
          if (status) status.textContent = `诊断报告导出失败：${e.message}`;
        }
      });

      // Import File Button
      doc.getElementById('rf-btn-import-file')?.addEventListener('click', async () => {
        const statusEl = doc.getElementById('rf-import-status');
        try {
          if (!Zotero?.ResearchFlow?.importDatabaseFile) throw new Error('ResearchFlow 宿主尚未就绪');
          const mode = doc.getElementById('rf-import-mode')?.value || 'merge';
          const result = await Zotero.ResearchFlow.importDatabaseFile(mode);
          if (result?.cancelled) return;
          if (!result?.success) throw new Error(result?.error || '数据库导入失败');
          if (statusEl) statusEl.textContent = `✅ 导入成功！(${mode === 'merge' ? '已智能合并' : '已完全替换'}，当前共 ${result.data?.manuscripts?.length || 0} 个稿件管线)`;
        } catch (e) {
          if (statusEl) statusEl.textContent = `导入失败：${e.message}`;
        }
      });

      // Restore Backup Button
      doc.getElementById('rf-btn-restore-backup')?.addEventListener('click', async () => {
        const statusEl = doc.getElementById('rf-import-status');
        try {
          if (!Zotero?.ResearchFlow?.restoreBackupDatabase) throw new Error('ResearchFlow 宿主尚未就绪');
          const res = await Zotero.ResearchFlow.restoreBackupDatabase();
          if (statusEl) {
            statusEl.textContent = `✅ 备份恢复成功！(当前共 ${res?.manuscripts?.length || 0} 个稿件管线)`;
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = `恢复备份失败：${e.message}`;
        }
      });
    }
  };
})();

// Zotero loads preference scripts before inserting the pane markup. Observe the
// insertion so every control is initialized on first open, even when XUL's
// synthetic showing event is not delivered to an imported HTML/XUL fragment.
(() => {
  const paneId = 'researchflow-preferences-pane';
  const start = () => {
    if (!window.document.getElementById(paneId)) return false;
    window.ResearchFlow_Preferences.init(window);
    return true;
  };
  if (start()) return;
  const observer = new window.MutationObserver(() => {
    if (start()) observer.disconnect();
  });
  observer.observe(window.document.documentElement, { childList: true, subtree: true });
})();
