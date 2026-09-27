// ResearchFlow Zotero Bridge - Facilitates communication between ResearchFlow UI and Zotero host

const ZoteroBridge = {
  isZotero: false,
  _pendingRequestId: 0,
  _requestCallbacks: new Map(),

  init() {
    this.detectEnvironment();
    this.setupMessageListener();

    if (this.isZotero) {
      document.documentElement.classList.add('zotero-env');
      document.body?.classList?.add('zotero-env');
      this.sendToHost({ type: 'RESEARCHFLOW_READY' });
      console.log('[ResearchFlow] Running in Zotero environment');

      if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
          const link = e.target?.closest?.('a[href^="http"]');
          if (link && !link.dataset.internal) {
            e.preventDefault();
            this.openExternal(link.href);
          }
        });
      }
    }

    // Process initial options from window.arguments or window._researchflowPending
    const initialOptions = window.arguments?.[0]?.options || window._researchflowPending;
    if (initialOptions) {
      this.handleHostNavigation(initialOptions);
    }
  },

  detectEnvironment() {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search || '');
        const mode = params.get('mode');
        if (mode === 'subwindow' || window.arguments?.[0]?.options?.currentWindowType === 'subwindow') {
          document.documentElement.classList.add('subwindow-mode');
          document.body?.classList?.add('subwindow-mode');
        }

        if (window.arguments && window.arguments[0] && window.arguments[0].Zotero) {
          window.Zotero = window.arguments[0].Zotero;
          this.isZotero = true;
          return;
        }
        if (window.Zotero) {
          this.isZotero = true;
          return;
        }
        if (window.parent && window.parent !== window && window.parent.Zotero) {
          window.Zotero = window.parent.Zotero;
          this.isZotero = true;
          return;
        }
        // In iframe under chrome://researchflow/
        if (window.location && (window.location.protocol === 'chrome:' || window.parent !== window)) {
          this.isZotero = true;
          return;
        }
      }
    } catch (_) {}
    this.isZotero = false;
  },

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handle async request callbacks
      if (data.requestId && this._requestCallbacks.has(data.requestId)) {
        const cb = this._requestCallbacks.get(data.requestId);
        this._requestCallbacks.delete(data.requestId);
        cb(data);
        return;
      }

      // Handle initial data handshake
      if (data.type === 'RESEARCHFLOW_INIT_DATA') {
        if (data.data && typeof window.storage !== 'undefined') {
          window.storage.cache = data.data;
        }
        if (data.pending) {
          this.handleHostNavigation(data.pending);
        }
      }

      // Handle direct navigation request from host
      if (data.type === 'RESEARCHFLOW_NAVIGATE') {
        this.handleHostNavigation(data.options);
      }

      // Handle data updated notification from host
      if (data.type === 'RESEARCHFLOW_DATA_UPDATED' && data.data) {
        if (typeof window.applyDatabaseUpdate === 'function') {
          window.applyDatabaseUpdate(data.data);
        } else {
          if (typeof window.storage !== 'undefined') {
            window.storage.cache = data.data;
          }
          if (typeof window.renderDashboard === 'function' && document.getElementById('view-dashboard')?.classList.contains('active')) {
            window.renderDashboard();
          } else if (typeof window.renderKanban === 'function' && document.getElementById('view-manuscripts')?.classList.contains('active')) {
            window.renderKanban();
          } else if (typeof window.renderSubmissions === 'function' && document.getElementById('view-submissions')?.classList.contains('active')) {
            window.renderSubmissions();
          }
        }
      }

      // Handle collection updated notification from host
      if (data.type === 'RESEARCHFLOW_COLLECTION_UPDATED') {
        if (typeof window.refreshZoteroCollectionFilter === 'function') {
          window.refreshZoteroCollectionFilter();
        }
      }

      // Handle item updated notification from host
      if (data.type === 'RESEARCHFLOW_ITEM_UPDATED') {
        if (typeof window.storage !== 'undefined' && typeof window.storage.getAll === 'function') {
          window.storage.getAll().then((freshDb) => {
            if (freshDb && typeof window.applyDatabaseUpdate === 'function') {
              window.applyDatabaseUpdate(freshDb);
            }
          }).catch(console.error);
        } else {
          if (typeof window.renderDashboard === 'function' && document.getElementById('view-dashboard')?.classList.contains('active')) {
            window.renderDashboard();
          } else if (typeof window.renderKanban === 'function' && document.getElementById('view-manuscripts')?.classList.contains('active')) {
            window.renderKanban();
          } else if (typeof window.renderSubmissions === 'function' && document.getElementById('view-submissions')?.classList.contains('active')) {
            window.renderSubmissions();
          }
        }
      }
    });
  },

  sendToHost(msg) {
    if (!this.isZotero) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
        return;
      }
      if (window.opener) {
        window.opener.postMessage(msg, '*');
        return;
      }
    } catch (_) {}
  },

  request(type, payload = {}) {
    if (!this.isZotero) return Promise.resolve(null);
    const requestId = `rf_req_${++this._pendingRequestId}_${Date.now()}`;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this._requestCallbacks.delete(requestId);
        resolve(null);
      }, 6000);

      this._requestCallbacks.set(requestId, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      this.sendToHost({ type, requestId, ...payload });
    });
  },

  async getActiveItem() {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.getCurrentActiveItem) {
        const item = zotero.ResearchFlow.getCurrentActiveItem();
        if (item) {
          return zotero.ResearchFlow.serializeLiteratureItem?.(item) || item;
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_GET_ACTIVE_ITEM');
    return res?.item || null;
  },

  openPdf(itemKey, page = null) {
    if (!itemKey) return;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries.userLibraryID, itemKey);
        if (item && zotero.ResearchFlow?.openPdfAttachment) {
          zotero.ResearchFlow.openPdfAttachment(item, page);
          return;
        }
      }
    } catch (_) {}
    this.sendToHost({ type: 'RESEARCHFLOW_OPEN_PDF', itemKey, page });
  },

  async syncNote(itemKey) {
    if (!itemKey) return false;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries.userLibraryID, itemKey);
        if (item && zotero.ResearchFlow?.syncManuscriptToChildNote) {
          const note = await zotero.ResearchFlow.syncManuscriptToChildNote(item);
          return Boolean(note);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_SYNC_NOTE', { itemKey });
    return Boolean(res?.success);
  },

  async getCollections(libraryID = null) {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.getZoteroCollections) {
        return zotero.ResearchFlow.getZoteroCollections(libraryID);
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_GET_COLLECTIONS', { libraryID });
    return res?.collections || [];
  },

  async searchLibrary(query, limit = 15) {
    if (!query) return [];
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.searchLibrary) {
        return await zotero.ResearchFlow.searchLibrary(query, limit);
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_SEARCH_LIBRARY', { query, limit });
    return res?.results || [];
  },

  showNativeToast(title, message, type = 'info') {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.showToast) {
        zotero.ResearchFlow.showToast(title, message, type);
        return;
      }
    } catch (_) {}
    this.sendToHost({ type: 'RESEARCHFLOW_SHOW_TOAST', title, message, toastType: type });
  },

  async getAnnotations(itemKey) {
    if (!itemKey) return [];
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.getLiteratureAnnotations && zotero.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries?.userLibraryID || 1, itemKey);
        if (item) {
          return zotero.ResearchFlow.getLiteratureAnnotations(item);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_GET_ANNOTATIONS', { itemKey });
    return res?.annotations || [];
  },

  async getReadingAssets(itemKey) {
    if (!itemKey) return { annotations: [], notes: [], collections: [], tags: [], relatedItems: [] };
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.getLiteratureReadingAssets && zotero.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries?.userLibraryID || 1, itemKey);
        if (item) {
          return zotero.ResearchFlow.getLiteratureReadingAssets(item);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_GET_READING_ASSETS', { itemKey });
    return res?.assets || { annotations: [], notes: [], collections: [], tags: [], relatedItems: [] };
  },

  async getNotes(itemKey) {
    if (!itemKey) return [];
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.getLiteratureNotes && zotero.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries?.userLibraryID || 1, itemKey);
        if (item) {
          return zotero.ResearchFlow.getLiteratureNotes(item);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_GET_NOTES', { itemKey });
    return res?.notes || [];
  },

  async syncStatusTag(itemKey, status) {
    if (!itemKey || !status) return false;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.syncStatusTagToItem && zotero.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries?.userLibraryID || 1, itemKey);
        if (item) {
          return await zotero.ResearchFlow.syncStatusTagToItem(item, status);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_SYNC_STATUS_TAG', { itemKey, status });
    return Boolean(res?.success);
  },

  async addToPipelineCollection(itemKey) {
    if (!itemKey) return false;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.addItemToPipelineCollection && zotero.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries?.userLibraryID || 1, itemKey);
        if (item) {
          const col = await zotero.ResearchFlow.addItemToPipelineCollection(item);
          return Boolean(col);
        }
      }
    } catch (_) {}
    const res = await this.request('RESEARCHFLOW_ADD_TO_PIPELINE_COLLECTION', { itemKey });
    return Boolean(res?.success);
  },

  async exportDatabase() {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.exportDatabaseFile) {
        const res = await zotero.ResearchFlow.exportDatabaseFile();
        if (res && (res.success || res.cancelled)) return res;
      }
    } catch (_) {}
    return await this.request('RESEARCHFLOW_EXPORT_DB');
  },

  async importDatabase(mode = 'merge') {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.importDatabaseFile) {
        const res = await zotero.ResearchFlow.importDatabaseFile(mode);
        if (res && (res.success || res.cancelled)) return res;
      }
    } catch (_) {}
    return await this.request('RESEARCHFLOW_IMPORT_DB', { mode });
  },

  async exportDiagnostics(report) {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.exportDiagnosticsFile) {
        const res = await zotero.ResearchFlow.exportDiagnosticsFile(report);
        if (res && (res.success || res.cancelled)) return res;
      }
    } catch (_) {}
    return await this.request('RESEARCHFLOW_EXPORT_DIAGNOSTICS', { report });
  },

  async restoreBackup() {
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.ResearchFlow?.restoreBackupDatabase) {
        const restored = await zotero.ResearchFlow.restoreBackupDatabase();
        return { success: true, data: restored };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
    return await this.request('RESEARCHFLOW_RESTORE_BACKUP');
  },

  async copyText(text, successToast = '已复制到剪贴板') {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (typeof window.showGlobalToast === 'function' && successToast) {
          window.showGlobalToast(successToast, 'success');
        }
        return true;
      }
    } catch (_) {}
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (typeof window.showGlobalToast === 'function' && successToast) {
        window.showGlobalToast(successToast, 'success');
      }
      return true;
    } catch (e) {
      console.warn('[ZoteroBridge] copyText failed:', e);
      return false;
    }
  },

  handleHostNavigation(options) {
    if (!options || typeof options !== 'object') return;

    // View switching
    if (options.view) {
      const navBtn = document.querySelector(`.nav-item[data-view="${options.view}"]`);
      if (navBtn) {
        navBtn.click();
      }
    }

    // Action handling
    if (options.action === 'create_manuscript_from_item' && options.item) {
      const item = options.item;
      const kanbanBtn = document.querySelector('.nav-item[data-view="view-manuscripts"]');
      if (kanbanBtn) kanbanBtn.click();

      setTimeout(() => {
        if (typeof window.openManuscriptModal === 'function') {
          window.openManuscriptModal(null, {
            title: item.title || '',
            publication: item.publication || '',
            abstract: item.abstract || '',
            authors: item.authors || '',
            doi: item.doi || '',
            articleUrl: item.url || '',
            zoteroItemKey: item.key || '',
            zoteroUri: item.zoteroUri || '',
            pdfUri: item.pdfUri || '',
            citekey: item.citekey || '',
            bibtex: item.bibtex || '',
            citationApa: item.citationApa || '',
            relatedItems: item.relatedItems || [],
            collections: item.collections || [],
            tags: item.tags || [],
            status: 'idea'
          });
          if (typeof window.showGlobalToast === 'function') {
            window.showGlobalToast(`已从 Zotero 文献《${(item.title || '').slice(0, 18)}…》导入元数据`, 'success');
          }
        }
      }, 200);
    } else if (options.action === 'link_item_to_manuscript' && options.item) {
      const item = options.item;
      const kanbanBtn = document.querySelector('.nav-item[data-view="view-manuscripts"]');
      if (kanbanBtn) kanbanBtn.click();

      setTimeout(() => {
        if (typeof window.showLinkManuscriptModal === 'function') {
          window.showLinkManuscriptModal(item);
        }
      }, 200);
    } else if (options.action === 'reader_excerpt') {
      const kanbanBtn = document.querySelector('.nav-item[data-view="view-manuscripts"]');
      if (kanbanBtn) kanbanBtn.click();

      setTimeout(() => {
        if (typeof window.openManuscriptModal === 'function') {
          const excerptText = options.excerpt
            ? `【PDF 第 ${options.page || 1} 页原文摘录】\n${options.excerpt}\n\n[📖 在 Zotero 阅读器中查看原文](${options.pdfLink || ''})`
            : (options.item?.abstract || '');
          window.openManuscriptModal(null, {
            title: options.item?.title ? `研读笔记：${options.item.title}` : 'PDF 摘录笔记',
            publication: options.item?.publication || '',
            abstract: excerptText,
            authors: options.item?.authors || '',
            doi: options.item?.doi || '',
            articleUrl: options.pdfLink || options.item?.url || '',
            zoteroItemKey: options.item?.key || '',
            zoteroUri: options.item?.zoteroUri || '',
            pdfUri: options.pdfLink || options.item?.pdfUri || '',
            citekey: options.item?.citekey || '',
            bibtex: options.item?.bibtex || '',
            citationApa: options.item?.citationApa || '',
            relatedItems: options.item?.relatedItems || [],
            status: 'idea'
          });
          if (typeof window.showGlobalToast === 'function') {
            window.showGlobalToast(`已从 PDF 第 ${options.page || 1} 页载入摘录内容与文献关联`, 'success');
          }
        }
      }, 200);
    } else if (options.action === 'create_from_collection') {
      const kanbanBtn = document.querySelector('.nav-item[data-view="view-manuscripts"]');
      if (kanbanBtn) kanbanBtn.click();

      setTimeout(() => {
        if (typeof window.openManuscriptModal === 'function') {
          const colItems = options.items || [];
          const summary = colItems.slice(0, 5).map((it, idx) => `${idx + 1}. ${it.title} (${it.authors || ''} ${it.year || ''})`.trim()).join('\n');
          window.openManuscriptModal(null, {
            title: `${options.collectionName || '文献分类'} 论文写作管线`,
            publication: '',
            abstract: `基于 Zotero 分类【${options.collectionName || '文献分类'}】创建。\n共包含文献 ${colItems.length} 篇：\n${summary}${colItems.length > 5 ? '\n…' : ''}`,
            authors: '',
            doi: '',
            zoteroItemKey: colItems[0]?.key || '',
            zoteroUri: colItems[0]?.zoteroUri || '',
            pdfUri: colItems[0]?.pdfUri || '',
            status: 'idea'
          });
          if (typeof window.showGlobalToast === 'function') {
            window.showGlobalToast(`已基于分类【${options.collectionName || ''}】初始化论文稿件管线`, 'success');
          }
        }
      }, 200);
    } else if (options.manuscriptId) {
      const kanbanBtn = document.querySelector('.nav-item[data-view="view-manuscripts"]');
      if (kanbanBtn) kanbanBtn.click();
      setTimeout(() => {
        const card = document.querySelector(`[data-manuscript-id="${options.manuscriptId}"]`) ||
          document.querySelector(`[data-id="${options.manuscriptId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight-pulse');
          setTimeout(() => card.classList.remove('highlight-pulse'), 2500);
        }
      }, 300);
    }
  },

  selectItemInZotero(itemKey) {
    if (!itemKey) return;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (zotero?.Items?.getByLibraryAndKey) {
        const item = zotero.Items.getByLibraryAndKey(zotero.Libraries.userLibraryID, itemKey);
        const win = window.parent?.ZoteroPane ? window.parent : window;
        if (item && win.ZoteroPane?.selectItem) {
          win.ZoteroPane.selectItem(item.id);
          return;
        }
      }
    } catch (_) {}
    this.sendToHost({ type: 'RESEARCHFLOW_SELECT_ITEM', itemKey });
  },

  openExternal(url) {
    if (!url) return;
    try {
      const zotero = window.Zotero || window.parent?.Zotero;
      if (typeof zotero?.launchURL === 'function') {
        zotero.launchURL(url);
        return;
      }
    } catch (_) {}
    this.sendToHost({ type: 'RESEARCHFLOW_OPEN_EXTERNAL', url });
    try {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
      }
    } catch (_) {}
  }
};

// Initialize bridge
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ZoteroBridge.init());
  } else {
    ZoteroBridge.init();
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.ZoteroBridge = ZoteroBridge;
}
