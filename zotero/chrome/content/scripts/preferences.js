/* ResearchFlow settings pane script for Zotero 7+ & 10 */
window.ResearchFlow_Preferences = (() => {
  const PREFIX = 'extensions.researchflow.';
  const HTML = 'http://www.w3.org/1999/xhtml';

  const DEFAULTS = {
    // Window Modes
    windowMode: 'tab',
    subwindowAlwaysOnTop: false,
    subwindowCompactMode: true,

    // Display & Views
    defaultView: 'view-dashboard',
    theme: 'system',
    language: 'zh',

    // ItemPane Sidebar
    enableItemPane: true,
    locateOnManuscriptClick: true,
    autoLinkSelectedPaper: true,

    // Sync & Backup
    autoSync: true,
    autoBackupOnSave: true
  };

  const FIELDS = {
    window: [
      ['windowMode', '工作区默认打开模式', 'select', [
        ['tab', '📑 Zotero 内部选项卡 (无缝融入主界面标签栏)'],
        ['subwindow', '🗗 伴读紧凑子窗口 (480×780，轻量悬浮，边读文献边跟踪稿件)'],
        ['window', '⬚ 独立桌面大窗口 (1240×820，大屏全景规划)']
      ]],
      ['subwindowAlwaysOnTop', '伴读子窗口始终置顶 (Always on Top，悬浮于 PDF 阅读器之上)', 'check'],
      ['subwindowCompactMode', '伴读子窗口启用紧凑工作台流式布局', 'check'],
    ],
    view: [
      ['defaultView', '工作区默认视图', 'select', [
        ['view-dashboard', '📊 仪表盘概览 (Dashboard Overview)'],
        ['view-manuscripts', '📋 论文稿件看板 (Manuscripts Kanban)'],
        ['view-submissions', '🚀 期刊投稿与同行评审 (Submissions & Review)'],
        ['view-settings', '⚙️ 多云同步与备份 (Multi-Cloud Settings)']
      ]],
      ['theme', '视觉外观主题', 'select', [
        ['system', '🔄 跟随操作系统外观'],
        ['light', '☀️ 清爽明亮 (Light)'],
        ['dark', '🌙 专注暗黑 (Dark)']
      ]],
      ['language', '界面默认语言', 'select', [
        ['zh', '🇨🇳 简体中文'],
        ['en', '🌐 English']
      ]]
    ],
    literature: [
      ['enableItemPane', '在文献右侧详情栏中展示“稿件管线”面板', 'check'],
      ['locateOnManuscriptClick', '在工作台中点击文献引用时，在 Zotero 文献库中高亮定位对应条目', 'check'],
      ['autoLinkSelectedPaper', '新建稿件管线时自动引用当前选中的文献条目', 'check']
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
      const doc = window.document;
      const status = doc.getElementById('rf-pref-status');
      if (status) status.textContent = '首选项已就绪。所有更改将实时生效并保存。';

      renderSection(doc, 'rf-pref-window', FIELDS.window);
      renderSection(doc, 'rf-pref-view', FIELDS.view);
      renderSection(doc, 'rf-pref-literature', FIELDS.literature);

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
          const db = await Zotero?.ResearchFlow?.loadDatabase?.();
          if (!db) return;
          const fp = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
          fp.init(window, '导出 ResearchFlow 完整数据库', Components.interfaces.nsIFilePicker.modeSave);
          fp.defaultExtension = 'json';
          fp.defaultString = `researchflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
          fp.appendFilter('JSON Files', '*.json');
          const rv = await new Promise((resolve) => fp.open(resolve));
          if (rv === Components.interfaces.nsIFilePicker.returnOK || rv === Components.interfaces.nsIFilePicker.returnReplace) {
            await IOUtils.writeUTF8(fp.file.path, JSON.stringify(db, null, 2));
            alert('导出成功！已将科研数据库保存至：\n' + fp.file.path);
          }
        } catch (e) {
          alert('导出失败：' + e.message);
        }
      });

      doc.getElementById('rf-btn-export-diag')?.addEventListener('click', async () => {
        try {
          const db = await Zotero?.ResearchFlow?.loadDatabase?.();
          const diag = {
            exportedAt: new Date().toISOString(),
            zoteroVersion: Zotero.version,
            researchflowVersion: '9.0.0',
            schemaVersion: db?.schemaVersion,
            counts: {
              manuscripts: db?.manuscripts?.length || 0,
              submissions: db?.submissions?.length || 0,
              projects: db?.projects?.length || 0,
              tasks: db?.tasks?.length || 0
            }
          };
          const fp = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
          fp.init(window, '导出 ResearchFlow 诊断报告', Components.interfaces.nsIFilePicker.modeSave);
          fp.defaultExtension = 'json';
          fp.defaultString = `researchflow_diagnostics_${new Date().toISOString().slice(0, 10)}.json`;
          fp.appendFilter('JSON Files', '*.json');
          const rv = await new Promise((resolve) => fp.open(resolve));
          if (rv === Components.interfaces.nsIFilePicker.returnOK || rv === Components.interfaces.nsIFilePicker.returnReplace) {
            await IOUtils.writeUTF8(fp.file.path, JSON.stringify(diag, null, 2));
            alert('诊断报告已成功导出！');
          }
        } catch (e) {
          alert('诊断报告导出失败：' + e.message);
        }
      });

      // Import File Button
      doc.getElementById('rf-btn-import-file')?.addEventListener('click', async () => {
        try {
          const fp = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
          fp.init(window, '选择 ResearchFlow 数据库备份', Components.interfaces.nsIFilePicker.modeOpen);
          fp.appendFilter('JSON Files', '*.json');
          const rv = await new Promise((resolve) => fp.open(resolve));
          if (rv === Components.interfaces.nsIFilePicker.returnOK && fp.file) {
            const content = await IOUtils.readUTF8(fp.file.path);
            const imported = JSON.parse(content);
            const mode = doc.getElementById('rf-import-mode')?.value || 'merge';
            const res = await Zotero?.ResearchFlow?.importDatabase?.(imported, mode);
            const statusEl = doc.getElementById('rf-import-status');
            if (statusEl) {
              statusEl.textContent = `✅ 导入成功！(${mode === 'merge' ? '已智能合并' : '已完全替换'}，当前共 ${res?.manuscripts?.length || 0} 个稿件管线)`;
            }
          }
        } catch (e) {
          alert('导入失败：' + e.message);
        }
      });

      // Restore Backup Button
      doc.getElementById('rf-btn-restore-backup')?.addEventListener('click', async () => {
        try {
          const res = await Zotero?.ResearchFlow?.restoreBackupDatabase?.();
          const statusEl = doc.getElementById('rf-import-status');
          if (statusEl) {
            statusEl.textContent = `✅ 备份恢复成功！(当前共 ${res?.manuscripts?.length || 0} 个稿件管线)`;
          }
        } catch (e) {
          alert('恢复备份失败：' + e.message);
        }
      });
    }
  };
})();
