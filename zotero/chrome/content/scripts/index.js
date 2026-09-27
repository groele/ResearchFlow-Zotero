/**
 * ResearchFlow for Zotero - Host Runtime Script
 * Seamlessly integrates ResearchFlow with Zotero 7+ & 10 desktop:
 * - Native Zotero Tab & Standalone Companion Window / Subwindow
 * - Main Toolbar Icon & Tools Menu
 * - Library Item & Collection Context Menus (New manuscript pipeline from item or collection)
 * - PDF Reader companion (Convert selection/annotation to manuscript records or tasks)
 * - Item Pane Section (Manuscript pipeline status, target journal, & progress bar)
 * - Automated Zotero Child Note Cloud Syncing (Multi-device cloud synchronization)
 * - High-speed IOUtils JSON persistence in Zotero Data Directory
 */

(function () {
  if (typeof Zotero === 'undefined') {
    return;
  }

  const Cc = typeof Components !== 'undefined' ? Components.classes : null;
  const Ci = typeof Components !== 'undefined' ? Components.interfaces : null;
  const Cu = typeof Components !== 'undefined' ? Components.utils : null;

  const ADDON_ID = 'researchflow@groele.org';
  const CHROME_ROOT = 'chrome://researchflow/content/';
  const PREF_PREFIX = 'extensions.researchflow.';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Data helpers
  const itemSelectUri = (item) => {
    if (!item) return '';
    const key = item.key || item.id;
    const groupID = Zotero.Libraries?.get?.(item.libraryID)?.groupID;
    return groupID
      ? `zotero://select/groups/${groupID}/items/${key}`
      : `zotero://select/library/items/${key}`;
  };

  const getLiteratureItem = (item) => {
    if (!item) return null;
    let target = item;
    try {
      if (target.topLevelItem && typeof target.topLevelItem.isRegularItem === 'function' && target.topLevelItem.isRegularItem()) {
        return target.topLevelItem;
      }
    } catch (_) {}
    if (typeof target.isAttachment === 'function' && target.isAttachment()) {
      if (target.parentItemID) {
        target = Zotero.Items.get(target.parentItemID) || target;
      }
    }
    if (typeof target.isNote === 'function' && target.isNote()) {
      if (target.parentItemID) {
        target = Zotero.Items.get(target.parentItemID) || target;
      }
    }
    try {
      if (target.topLevelItem && typeof target.topLevelItem.isRegularItem === 'function' && target.topLevelItem.isRegularItem()) {
        return target.topLevelItem;
      }
    } catch (_) {}
    return target && typeof target.isRegularItem === 'function' && target.isRegularItem() ? target : null;
  };

  
  const STATUS_TAG_MAP = {
    idea: 'ResearchFlow/01-选题大纲',
    outline: 'ResearchFlow/01-选题大纲',
    data_collection: 'ResearchFlow/01-选题大纲',
    figure_preparation: 'ResearchFlow/02-图表初稿',
    drafting: 'ResearchFlow/02-图表初稿',
    internal_review: 'ResearchFlow/02-组内评审',
    submitted: 'ResearchFlow/03-已正式投稿',
    under_review: 'ResearchFlow/04-同行审稿中',
    revision: 'ResearchFlow/05-修回修订中',
    accepted: 'ResearchFlow/06-已录用Accepted',
    published: 'ResearchFlow/07-已正式发表'
  };

  const extractCiteKey = (target) => {
    if (!target) return '';
    const extra = typeof target.getField === 'function' ? (target.getField('extra') || '') : '';
    const m = extra.match(/(?:Citation Key|tex\.citationkey|bibtex):\s*([^\s\n\r]+)/i);
    if (m && m[1]) return m[1].trim();

    let firstAuthor = 'author';
    try {
      const creators = target.getCreators?.() || [];
      if (creators.length > 0) {
        firstAuthor = (creators[0].lastName || creators[0].name || 'author').replace(/[^a-zA-Z]/g, '').toLowerCase();
      }
    } catch (_) {}
    const date = typeof target.getField === 'function' ? target.getField('date') : '';
    const ym = String(date || '').match(/\b(19|20)\d{2}\b/);
    const year = ym ? ym[0] : '2024';

    const title = (typeof target.getField === 'function' ? target.getField('title') : '') || '';
    const firstWord = (title.split(/\s+/)[0] || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    return `${firstAuthor}${year}${firstWord ? firstWord : ''}`;
  };

  const generateBibTeX = (target) => {
    if (!target) return '';
    const citekey = extractCiteKey(target);
    const title = typeof target.getField === 'function' ? (target.getField('title') || '') : '';
    const journal = typeof target.getField === 'function'
      ? (target.getField('publicationTitle') || target.getField('proceedingsTitle') || target.getField('publisher') || '')
      : '';
    const date = typeof target.getField === 'function' ? target.getField('date') : '';
    const ym = String(date || '').match(/\b(19|20)\d{2}\b/);
    const year = ym ? ym[0] : '';
    const doi = typeof target.getField === 'function' ? (target.getField('DOI') || '') : '';
    const url = typeof target.getField === 'function' ? (target.getField('url') || '') : '';

    let authorStr = '';
    try {
      const creators = target.getCreators?.() || [];
      authorStr = creators.map((c) => `${c.lastName || ''}, ${c.firstName || ''}`.trim()).filter(Boolean).join(' and ');
    } catch (_) {}

    return `@article{${citekey},
  title = {${title}},
  author = {${authorStr}},
  journal = {${journal}},
  year = {${year}}${doi ? `,\n  doi = {${doi}}` : ''}${url ? `,\n  url = {${url}}` : ''}
}`;
  };

  const generateAPACitation = (target) => {
    if (!target) return '';
    let authors = [];
    try {
      authors = (target.getCreators?.() || []).map((c) => c.lastName ? `${c.lastName}, ${c.firstName ? c.firstName[0] + '.' : ''}` : c.name).filter(Boolean);
    } catch (_) {}
    const authorStr = authors.length > 0 ? (authors.slice(0, 3).join(', ') + (authors.length > 3 ? ', et al.' : '')) : 'Anonymous';
    const date = typeof target.getField === 'function' ? target.getField('date') : '';
    const ym = String(date || '').match(/\b(19|20)\d{2}\b/);
    const yearStr = ym ? `(${ym[0]})` : '(n.d.)';
    const title = (typeof target.getField === 'function' ? target.getField('title') : '') || '';
    const journal = typeof target.getField === 'function' ? (target.getField('publicationTitle') || '') : '';
    const doi = typeof target.getField === 'function' ? target.getField('DOI') : '';

    return `${authorStr} ${yearStr}. ${title}. ${journal ? journal + '.' : ''}${doi ? ' https://doi.org/' + doi : ''}`.trim();
  };

  const getLiteratureAnnotations = (item) => {
    const target = getLiteratureItem(item);
    if (!target) return [];
    const annotations = [];
    try {
      const attIds = typeof target.getAttachments === 'function' ? target.getAttachments() : [];
      for (const attId of attIds) {
        const att = Zotero.Items.get(attId);
        if (att && ((typeof att.isPDFAttachment === 'function' && att.isPDFAttachment()) || att.contentType === 'application/pdf')) {
          const groupID = Zotero.Libraries?.get?.(att.libraryID)?.groupID;
          const pdfBaseUri = groupID
            ? `zotero://open-pdf/groups/${groupID}/items/${att.key}`
            : `zotero://open-pdf/library/items/${att.key}`;

          if (typeof att.getAnnotations === 'function') {
            const annos = att.getAnnotations();
            for (const a of (annos || [])) {
              if (a.annotationText || a.annotationComment) {
                let pageIndex = 0;
                try {
                  if (a.annotationPosition) {
                    const pos = typeof a.annotationPosition === 'string' ? JSON.parse(a.annotationPosition) : a.annotationPosition;
                    pageIndex = typeof pos.pageIndex === 'number' ? pos.pageIndex : 0;
                  }
                } catch (_) {}
                const pageNum = a.annotationPageLabel || (pageIndex + 1);

                annotations.push({
                  key: a.key,
                  type: a.annotationType || 'highlight',
                  text: String(a.annotationText || '').trim(),
                  comment: String(a.annotationComment || '').trim(),
                  color: a.annotationColor || '#ffd400',
                  page: pageNum,
                  pageIndex,
                  date: a.dateModified || a.dateAdded || '',
                  pdfUri: `${pdfBaseUri}?page=${pageIndex + 1}&annotation=${a.key}`
                });
              }
            }
          }
        }
      }
    } catch (err) {
      Zotero.logError?.('[ResearchFlow] getLiteratureAnnotations error: ' + err);
    }
    return annotations;
  };

  const getRelatedItems = (item) => {
    const target = getLiteratureItem(item);
    if (!target) return [];
    const related = [];
    try {
      if (typeof target.getRelatedItemIDs === 'function') {
        const rIds = target.getRelatedItemIDs();
        for (const rId of (rIds || []).slice(0, 6)) {
          const rItem = Zotero.Items.get(rId);
          const lit = getLiteratureItem(rItem);
          if (lit) {
            const date = typeof lit.getField === 'function' ? lit.getField('date') : '';
            const ym = String(date || '').match(/\b(19|20)\d{2}\b/);
            related.push({
              id: lit.id,
              key: lit.key,
              title: (typeof lit.getField === 'function' ? lit.getField('title') : '') || '未命名文献',
              year: ym ? ym[0] : '',
              authors: (lit.getCreators?.() || []).map((c) => c.lastName || c.name).filter(Boolean).slice(0, 2).join(', '),
              zoteroUri: itemSelectUri(lit)
            });
          }
        }
      }
    } catch (_) {}
    return related;
  };

  const getLiteratureCollections = (item) => {
    const target = getLiteratureItem(item);
    if (!target) return [];
    const collections = [];
    try {
      if (typeof target.getCollections === 'function') {
        const colIds = target.getCollections();
        for (const cId of (colIds || [])) {
          const col = Zotero.Collections?.get?.(cId);
          if (col) {
            let path = col.name;
            let parentID = col.parentID;
            let depth = 0;
            while (parentID && depth < 6) {
              const p = Zotero.Collections?.get?.(parentID);
              if (!p) break;
              path = `${p.name} / ${path}`;
              parentID = p.parentID;
              depth++;
            }
            collections.push({
              id: col.id,
              key: col.key,
              name: col.name,
              path
            });
          }
        }
      }
    } catch (_) {}
    return collections;
  };

  const getLiteratureNotes = (item) => {
    const target = getLiteratureItem(item);
    if (!target) return [];
    const notes = [];
    try {
      if (typeof target.getNotes === 'function') {
        const noteIds = target.getNotes();
        for (const nId of (noteIds || [])) {
          const nItem = Zotero.Items?.get?.(nId);
          if (nItem && typeof nItem.isNote === 'function' && nItem.isNote()) {
            const rawNote = (typeof nItem.getNote === 'function' ? nItem.getNote() : '') || '';
            if (rawNote.includes('[ResearchFlow]') || rawNote.includes('ResearchFlow for Zotero')) {
              continue;
            }
            const snippet = rawNote.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (snippet || rawNote) {
              const titleMatch = rawNote.match(/<(?:h[1-6]|p|strong)[^>]*>(.*?)<\/(?:h[1-6]|p|strong)>/i);
              const noteTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : (snippet.slice(0, 24) || 'Zotero 笔记');
              notes.push({
                id: nItem.id,
                key: nItem.key,
                title: noteTitle,
                rawHtml: rawNote,
                snippet: snippet.slice(0, 300) + (snippet.length > 300 ? '…' : ''),
                date: nItem.dateModified || nItem.dateAdded || '',
                zoteroUri: itemSelectUri(nItem)
              });
            }
          }
        }
      }
    } catch (err) {
      Zotero.logError?.('[ResearchFlow] getLiteratureNotes error: ' + err);
    }
    return notes;
  };

  const getLiteratureReadingAssets = (item) => {
    const target = getLiteratureItem(item);
    if (!target) {
      return { annotations: [], notes: [], collections: [], tags: [], relatedItems: [], citekey: '', bibtex: '', citationApa: '' };
    }
    return {
      annotations: getLiteratureAnnotations(target),
      notes: getLiteratureNotes(target),
      collections: getLiteratureCollections(target),
      tags: typeof target.getTags === 'function' ? target.getTags().map((t) => t.tag || String(t)).filter(Boolean) : [],
      relatedItems: getRelatedItems(target),
      citekey: extractCiteKey(target),
      bibtex: generateBibTeX(target),
      citationApa: generateAPACitation(target)
    };
  };

  const serializeLiteratureItem = (item) => {
    const target = getLiteratureItem(item);
    if (!target) return null;

    const title = (typeof target.getField === 'function' ? target.getField('title') : target.title) || '无标题文献';
    const date = typeof target.getField === 'function' ? target.getField('date') : target.date;
    let year = '';
    if (date) {
      const match = String(date).match(/\b(19|20)\d{2}\b/);
      year = match ? match[0] : String(date).slice(0, 4);
    }

    let authors = [];
    try {
      if (typeof target.getCreators === 'function') {
        authors = target.getCreators().map((c) => c.lastName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean);
      }
    } catch (_) {}

    const publication = typeof target.getField === 'function'
      ? (target.getField('publicationTitle') || target.getField('proceedingsTitle') || target.getField('publisher') || '')
      : '';

    const doi = typeof target.getField === 'function' ? (target.getField('DOI') || '') : '';
    const url = typeof target.getField === 'function' ? (target.getField('url') || '') : '';
    const abstract = typeof target.getField === 'function' ? (target.getField('abstractNote') || '') : '';

    let tags = [];
    try {
      if (typeof target.getTags === 'function') {
        tags = target.getTags().map((t) => t.tag || String(t)).filter(Boolean);
      }
    } catch (_) {}

    // Main PDF attachment URI
    let pdfUri = null;
    try {
      if (typeof target.getAttachments === 'function') {
        const attIds = target.getAttachments();
        for (const attId of attIds) {
          const att = Zotero.Items.get(attId);
          if (att && ((typeof att.isPDFAttachment === 'function' && att.isPDFAttachment()) || att.contentType === 'application/pdf')) {
            const groupID = Zotero.Libraries?.get?.(att.libraryID)?.groupID;
            pdfUri = groupID
              ? `zotero://open-pdf/groups/${groupID}/items/${att.key}`
              : `zotero://open-pdf/library/items/${att.key}`;
            break;
          }
        }
      }
    } catch (_) {}

    const citekey = extractCiteKey(target);
    const bibtex = generateBibTeX(target);
    const citationApa = generateAPACitation(target);
    const relatedItems = getRelatedItems(target);
    const annotations = getLiteratureAnnotations(target);
    const annotationCount = annotations.length;
    const collections = getLiteratureCollections(target);
    const notes = getLiteratureNotes(target);
    const notesCount = notes.length;

    return {
      key: target.key || String(target.id),
      id: target.id,
      libraryID: target.libraryID,
      title,
      authors: authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' 等' : ''),
      authorList: authors,
      year,
      publication,
      doi,
      url,
      abstract,
      tags,
      collections,
      citekey,
      bibtex,
      citationApa,
      annotationCount,
      notesCount,
      relatedItems,
      zoteroUri: itemSelectUri(target),
      pdfUri,
    };
  };

  // Tracking structures
  const injectedElements = new Map();
  const pendingWindowLoads = new Map();
  let windowListener = null;

  Zotero.ResearchFlow = {
    rootURI: typeof rootURI !== 'undefined' ? rootURI : '',
    addonId: ADDON_ID,
    serializeLiteratureItem,
    getLiteratureAnnotations,
    getLiteratureNotes,
    getLiteratureCollections,
    getLiteratureReadingAssets,
    extractCiteKey,
    generateBibTeX,
    generateAPACitation,
    getRelatedItems,
    getLiteratureItem,

    localizedDocs: new Set(),
    _cachedData: null,
    _dataListeners: new Set(),
    itemPaneSectionID: null,
    notifierID: null,
    _menuManagerItem: null,
    _menuManagerReader: null,

    ensureLocalization(doc) {
      if (!doc || this.localizedDocs.has(doc)) return;
      const existing = doc.querySelector('link[rel="localization"][href="researchflow.ftl"]');
      if (existing) return;
      try {
        doc.defaultView?.MozXULElement?.insertFTLIfNeeded('researchflow.ftl');
        if (doc.querySelector('link[rel="localization"][href="researchflow.ftl"]')) {
          this.localizedDocs.add(doc);
        }
      } catch (error) {
        Zotero.logError?.('[ResearchFlow] Could not load translations: ' + error);
      }
    },

    getPref(key, defaultValue) {
      try {
        if (Zotero.Prefs) {
          const val = Zotero.Prefs.get(`${PREF_PREFIX}${key}`, true);
          return val !== undefined ? val : defaultValue;
        }
      } catch (_) {}
      return defaultValue;
    },

    setPref(key, value) {
      try {
        if (Zotero.Prefs) {
          Zotero.Prefs.set(`${PREF_PREFIX}${key}`, value, true);
        }
      } catch (_) {}
    },

    getDataFilePath() {
      return PathUtils.join(Zotero.DataDirectory.dir, 'researchflow-data.json');
    },

    getBackupFilePath() {
      return PathUtils.join(Zotero.DataDirectory.dir, 'researchflow-pre-import-backup.json');
    },

    registerDataListener(callback) {
      if (typeof callback === 'function') {
        this._dataListeners.add(callback);
      }
    },

    unregisterDataListener(callback) {
      this._dataListeners.delete(callback);
    },

    
    broadcastToIframes(msg) {
      try {
        const windows = Services.wm.getEnumerator(null);
        while (windows.hasMoreElements()) {
          const win = windows.getNext();
          const iframe = win.document?.getElementById('researchflow-tab-iframe');
          if (iframe?.contentWindow?.postMessage) {
            try { iframe.contentWindow.postMessage(msg, '*'); } catch (_) {}
          }
          if (win.name === 'ResearchFlow_Window' || win.name === 'ResearchFlow_SubWindow' || win.document?.title?.includes('ResearchFlow')) {
            if (typeof win.postMessage === 'function') {
              try { win.postMessage(msg, '*'); } catch (_) {}
            }
          }
        }
      } catch (_) {}
    },

    
    async syncStatusTagToItem(item, status) {
      const target = getLiteratureItem(item);
      if (!target) return false;
      try {
        const existingTags = typeof target.getTags === 'function' ? target.getTags() : [];
        for (const t of existingTags) {
          const tagName = t.tag || String(t);
          if (tagName.startsWith('ResearchFlow/') || tagName.startsWith('RF/')) {
            target.removeTag(tagName);
          }
        }
        const newTag = STATUS_TAG_MAP[status] || `ResearchFlow/${status}`;
        target.addTag(newTag, 0);
        await target.saveTx();
        return true;
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] syncStatusTagToItem error: ' + e);
        return false;
      }
    },

    async addItemToPipelineCollection(item) {
      const target = getLiteratureItem(item);
      if (!target) return null;
      const libraryID = target.libraryID || Zotero.Libraries?.userLibraryID || 1;
      const collectionName = '🚀 ResearchFlow 论文管线';
      try {
        let collection = Zotero.Collections?.getByLibrary?.(libraryID)
          ?.find((c) => !c.deleted && c.name === collectionName) || null;
        if (!collection && Zotero.Collection) {
          collection = new Zotero.Collection();
          collection.libraryID = libraryID;
          collection.name = collectionName;
          await collection.saveTx();
        }
        if (collection) {
          if (typeof target.inCollection === 'function' && !target.inCollection(collection.id)) {
            target.addToCollection(collection.id);
            await target.saveTx();
          }
        }
        return collection;
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] addItemToPipelineCollection error: ' + e);
        return null;
      }
    },

    showToast(title, message, type = 'info', duration = 3500) {
      try {
        if (Zotero.ProgressWindow) {
          const pw = new Zotero.ProgressWindow({ closeOnClick: true });
          pw.changeHeadline(`ResearchFlow · ${title}`);
          const icon = (type === 'success')
            ? 'chrome://zotero/skin/tick.png'
            : (type === 'error')
              ? 'chrome://zotero/skin/cross.png'
              : (type === 'warning')
                ? 'chrome://zotero/skin/warning.png'
                : `${CHROME_ROOT}icons/researchflow.svg`;
          const itemProgress = new pw.ItemProgress(icon, message);
          itemProgress.setProgress(100);
          pw.show();
          pw.startCloseTimer(duration);
        }
      } catch (_) {}
    },

    initNotifier() {
      if (!Zotero.Notifier?.registerObserver) return;
      try {
        this.notifierID = Zotero.Notifier.registerObserver({
          notify: async (event, type, ids) => {
            if (type === 'item') {
              if (event === 'modify' || event === 'trash' || event === 'delete' || event === 'add') {
                this.notifyDataChanged();
                this.broadcastToIframes({
                  type: 'RESEARCHFLOW_ITEM_UPDATED',
                  event,
                  ids
                });
              }
            } else if (type === 'collection') {
              this.broadcastToIframes({
                type: 'RESEARCHFLOW_COLLECTION_UPDATED',
                event,
                ids
              });
            }
          }
        }, ['item', 'collection'], ADDON_ID);
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] Notifier registration failed: ' + err);
      }
    },

    destroyNotifier() {
      if (this.notifierID && Zotero.Notifier?.unregisterObserver) {
        try {
          Zotero.Notifier.unregisterObserver(this.notifierID);
        } catch (_) {}
        this.notifierID = null;
      }
    },

    registerMenus() {
      if (Zotero.MenuManager && typeof Zotero.MenuManager.registerMenu === 'function') {
        try {
          this._menuManagerItem = Zotero.MenuManager.registerMenu({
            menuID: 'researchflow-itemmenu-actions',
            pluginID: ADDON_ID,
            target: 'main/library/item',
            menus: [
              {
                menuType: 'menuitem',
                label: '新建论文稿件管线',
                icon: `${CHROME_ROOT}icons/researchflow.svg`,
                onCommand: () => {
                  try {
                    this.createManuscriptFromSelection();
                  } catch (err) {
                    Zotero.logError?.('[ResearchFlow] MenuManager create error: ' + err);
                  }
                }
              },
              {
                menuType: 'menuitem',
                label: '关联到现有稿件',
                icon: `${CHROME_ROOT}icons/researchflow.svg`,
                onCommand: () => {
                  try {
                    this.linkSelectionToManuscript();
                  } catch (err) {
                    Zotero.logError?.('[ResearchFlow] MenuManager link error: ' + err);
                  }
                }
              }
            ]
          });

          this._menuManagerReader = Zotero.MenuManager.registerMenu({
            menuID: 'researchflow-reader-context',
            pluginID: ADDON_ID,
            target: 'main/reader/context',
            menus: [
              {
                menuType: 'menuitem',
                label: '📝 摘录至 ResearchFlow 稿件研究笔记',
                icon: `${CHROME_ROOT}icons/researchflow.svg`,
                onCommand: () => {
                  try {
                    this.createRecordFromReader();
                  } catch (err) {
                    Zotero.logError?.('[ResearchFlow] Reader context error: ' + err);
                  }
                }
              }
            ]
          });
        } catch (err) {
          Zotero.logError?.('[ResearchFlow] MenuManager register failed: ' + err);
        }
      }
    },

    unregisterMenus() {
      if (this._menuManagerItem && Zotero.MenuManager?.unregisterMenu) {
        try { Zotero.MenuManager.unregisterMenu(this._menuManagerItem); } catch (_) {}
        this._menuManagerItem = null;
      }
      if (this._menuManagerReader && Zotero.MenuManager?.unregisterMenu) {
        try { Zotero.MenuManager.unregisterMenu(this._menuManagerReader); } catch (_) {}
        this._menuManagerReader = null;
      }
    },

    async searchLibrary(query, limit = 15) {
      if (!query || typeof query !== 'string') return [];
      const q = query.trim();
      if (!q) return [];
      try {
        const results = [];
        const seenKeys = new Set();
        if (Zotero.Search) {
          const s = new Zotero.Search();
          s.libraryID = Zotero.Libraries?.userLibraryID || 1;
          s.addCondition('quicksearch-titleCreatorYear', 'contains', q);
          const ids = (await s.search()) || [];
          for (const id of ids.slice(0, limit * 2)) {
            const it = Zotero.Items.get(id);
            const lit = getLiteratureItem(it);
            if (lit && !seenKeys.has(lit.key)) {
              seenKeys.add(lit.key);
              results.push(serializeLiteratureItem(lit));
              if (results.length >= limit) break;
            }
          }
        }
        return results;
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] searchLibrary error: ' + err);
        return [];
      }
    },

    notifyDataChanged() {
      for (const listener of this._dataListeners) {
        try { listener(); } catch (_) {}
      }
      this.broadcastToIframes({ type: 'RESEARCHFLOW_DATA_UPDATED', data: this._cachedData });
    },

    async loadDatabase() {
      if (this._cachedData) return this._cachedData;
      const filePath = this.getDataFilePath();
      try {
        const exists = await IOUtils.exists(filePath);
        if (exists) {
          const content = await IOUtils.readUTF8(filePath);
          this._cachedData = JSON.parse(content);
          return this._cachedData;
        }
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] Failed to read researchflow-data.json: ' + e);
      }

      // Fallback: load bundled preloaded database if file does not exist
      try {
        const preloadedPath = PathUtils.join(
          this.rootURI.replace(/^file:\/\/\/?/, '').replace(/\//g, PathUtils.sep || '\\'),
          'data',
          'preloaded_db.json'
        );
        if (await IOUtils.exists(preloadedPath)) {
          const content = await IOUtils.readUTF8(preloadedPath);
          this._cachedData = JSON.parse(content);
          await this.saveDatabase(this._cachedData);
          return this._cachedData;
        }
      } catch (_) {}

      // Default fallback database
      this._cachedData = {
        schemaVersion: 7,
        lastUpdated: Date.now(),
        updatedAt: new Date().toISOString(),
        revision: 1,
        deviceId: 'zotero_' + Math.random().toString(36).slice(2),
        researchAreas: [],
        projects: [],
        researchRecords: [],
        manuscripts: [],
        submissions: [],
        tasks: [],
        deletedEntities: { researchAreas: [], projects: [], researchRecords: [], manuscripts: [], submissions: [], tasks: [] },
        settings: {
          syncProviders: { metadata: { provider: 'local', config: {}, autoSync: true } },
          profile: { displayName: '', chineseName: '', englishName: '', affiliation: '', orcid: '', language: 'zh', theme: 'system' }
        }
      };
      await this.saveDatabase(this._cachedData);
      return this._cachedData;
    },

    async saveDatabase(data) {
      if (!data || typeof data !== 'object') return this._cachedData;
      this._cachedData = { ...this._cachedData, ...data, lastUpdated: Date.now(), updatedAt: new Date().toISOString() };
      const filePath = this.getDataFilePath();
      try {
        const jsonStr = JSON.stringify(this._cachedData, null, 2);
        const tmpPath = `${filePath}.tmp-${Date.now()}`;
        await IOUtils.writeUTF8(filePath, jsonStr, { tmpPath });
        this.notifyDataChanged();
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] Failed to write researchflow-data.json: ' + e);
      }
      return this._cachedData;
    },

    async importDatabase(importedData, mode = 'merge') {
      if (!importedData || typeof importedData !== 'object') throw new Error('无效的导入数据');
      // Create pre-import snapshot
      const current = await this.loadDatabase();
      this.initNotifier();
      this.registerMenus();
      try {
        await IOUtils.writeUTF8(this.getBackupFilePath(), JSON.stringify(current, null, 2));
      } catch (_) {}

      if (mode === 'overwrite') {
        this._cachedData = { ...importedData, lastUpdated: Date.now(), updatedAt: new Date().toISOString() };
      } else {
        // Smart merge collections
        const mergeCol = (oldArr = [], newArr = []) => {
          const map = new Map();
          oldArr.forEach((item) => { if (item?.id) map.set(item.id, item); });
          newArr.forEach((item) => { if (item?.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item }); });
          return Array.from(map.values());
        };
        this._cachedData = {
          ...current,
          ...importedData,
          projects: mergeCol(current.projects, importedData.projects),
          manuscripts: mergeCol(current.manuscripts, importedData.manuscripts),
          submissions: mergeCol(current.submissions, importedData.submissions),
          tasks: mergeCol(current.tasks, importedData.tasks),
          researchRecords: mergeCol(current.researchRecords, importedData.researchRecords),
          lastUpdated: Date.now(),
          updatedAt: new Date().toISOString()
        };
      }
      return this.saveDatabase(this._cachedData);
    },

    async restoreBackupDatabase() {
      const backupPath = this.getBackupFilePath();
      const exists = await IOUtils.exists(backupPath);
      if (!exists) throw new Error('未找到前次导入备份文件');
      const content = await IOUtils.readUTF8(backupPath);
      const restored = JSON.parse(content);
      return this.saveDatabase(restored);
    },

    async exportDatabaseFile(window = null) {
      try {
        if (!Cc || !Ci) throw new Error('Components.classes or interfaces not available');
        const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
        const win = Zotero.getMainWindow?.() || (typeof Services !== 'undefined' && Services.wm?.getMostRecentWindow('navigator:browser')) || null;
        fp.init(win, '导出 ResearchFlow 数据库', Ci.nsIFilePicker.modeSave);
        fp.defaultExtension = 'json';
        fp.appendFilter('JSON Files (*.json)', '*.json');
        const dateStr = new Date().toISOString().split('T')[0];
        fp.defaultString = `researchflow-export-${dateStr}.json`;

        const res = await new Promise((resolve) => fp.open(resolve));
        if (res === Ci.nsIFilePicker.returnOK || res === Ci.nsIFilePicker.returnReplace) {
          const filePath = fp.file.path;
          const data = await this.loadDatabase();
          const jsonStr = JSON.stringify(data, null, 2);
          await IOUtils.writeUTF8(filePath, jsonStr);
          this.showToast('导出成功', `数据库已保存至：${filePath}`, 'success');
          return { success: true, filePath };
        }
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] exportDatabaseFile error: ' + err);
        this.showToast('导出失败', String(err.message || err), 'error');
        return { success: false, error: err.message };
      }
      return { success: false, cancelled: true };
    },

    async importDatabaseFile(mode = 'merge', window = null) {
      try {
        if (!Cc || !Ci) throw new Error('Components.classes or interfaces not available');
        const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
        const win = Zotero.getMainWindow?.() || (typeof Services !== 'undefined' && Services.wm?.getMostRecentWindow('navigator:browser')) || null;
        fp.init(win, '选择 ResearchFlow JSON 备份文件导入', Ci.nsIFilePicker.modeOpen);
        fp.defaultExtension = 'json';
        fp.appendFilter('JSON Files (*.json)', '*.json');

        const res = await new Promise((resolve) => fp.open(resolve));
        if (res === Ci.nsIFilePicker.returnOK) {
          const filePath = fp.file.path;
          const rawText = await IOUtils.readUTF8(filePath);
          let importedJson;
          try {
            importedJson = JSON.parse(rawText);
          } catch (pe) {
            throw new Error('所选文件不是合法的 JSON 格式备份');
          }
          const saved = await this.importDatabase(importedJson, mode);
          this.showToast('导入成功', `已成功从 ${fp.file.leafName} 导入并同步数据库！`, 'success');
          return { success: true, data: saved };
        }
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] importDatabaseFile error: ' + err);
        this.showToast('导入失败', String(err.message || err), 'error');
        return { success: false, error: err.message };
      }
      return { success: false, cancelled: true };
    },

    async exportDiagnosticsFile(report = null, window = null) {
      try {
        if (!Cc || !Ci) throw new Error('Components.classes or interfaces not available');
        const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
        const win = Zotero.getMainWindow?.() || (typeof Services !== 'undefined' && Services.wm?.getMostRecentWindow('navigator:browser')) || null;
        fp.init(win, '导出 ResearchFlow 诊断报告', Ci.nsIFilePicker.modeSave);
        fp.defaultExtension = 'json';
        fp.appendFilter('JSON Files (*.json)', '*.json');
        const dateStr = new Date().toISOString().slice(0, 10);
        fp.defaultString = `researchflow-diagnostics-${dateStr}.json`;

        const res = await new Promise((resolve) => fp.open(resolve));
        if (res === Ci.nsIFilePicker.returnOK || res === Ci.nsIFilePicker.returnReplace) {
          const filePath = fp.file.path;
          const jsonStr = JSON.stringify(report || {}, null, 2);
          await IOUtils.writeUTF8(filePath, jsonStr);
          this.showToast('导出成功', `诊断信息已保存至：${filePath}`, 'success');
          return { success: true, filePath };
        }
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] exportDiagnosticsFile error: ' + err);
        this.showToast('导出失败', String(err.message || err), 'error');
        return { success: false, error: err.message };
      }
      return { success: false, cancelled: true };
    },

    /**
     * Automated Zotero Child Note Cloud Sync
     * Creates or updates a formatted child note containing manuscript tracking and review milestones
     */
    async syncManuscriptToChildNote(item, manuscript = null) {
      const target = getLiteratureItem(item);
      if (!target) return null;

      try {
        const db = await this.loadDatabase();
        let targetMan = manuscript;
        if (!targetMan) {
          targetMan = (db.manuscripts || []).find((m) => {
            if (m.zoteroItemKey && m.zoteroItemKey === target.key) return true;
            if (m.doi && target.getField && m.doi.toLowerCase() === (target.getField('DOI') || '').toLowerCase()) return true;
            return false;
          });
        }
        if (!targetMan) return null;

        const meta = serializeLiteratureItem(target);
        const statusMap = {
          idea: '选题萌芽',
          outline: '大纲规划',
          data_collection: '数据整理',
          figure_preparation: '图表绘制',
          drafting: '初稿撰写中',
          internal_review: '组内评审',
          submitted: '已正式投稿',
          under_review: '期刊同行审稿中',
          revision: '审稿意见修回修订中',
          accepted: '🎉 已正式录用 (Accepted)',
          published: '🚀 正式发表 (Published)'
        };
        const statusText = statusMap[targetMan.status] || targetMan.status || '撰写中';

        // Check if there are linked submissions
        const linkedSubmissions = (db.submissions || []).filter((s) => s.manuscriptId === targetMan.id);
        const sub = linkedSubmissions[0] || null;

        let noteHtml = `<h1>🚀 [ResearchFlow] 论文稿件与审稿跟踪快报</h1>`;
        noteHtml += `<p><strong>稿件标题：</strong>${escapeHtml(targetMan.title)}</p>`;
        noteHtml += `<p><strong>目标期刊：</strong>${escapeHtml(targetMan.targetJournal || targetMan.targetJournals?.[0] || '待定')} | <strong>当前状态：</strong><span style="color:#cc292b; font-weight:700;">${escapeHtml(statusText)}</span></p>`;
        if (targetMan.citekey || meta.citekey) {
          noteHtml += `<p><strong>Citation Key:</strong> <code>[@${escapeHtml(targetMan.citekey || meta.citekey)}]</code></p>`;
        }
        if (targetMan.doi) {
          noteHtml += `<p><strong>DOI:</strong> <a href="https://doi.org/${encodeURIComponent(targetMan.doi)}">${escapeHtml(targetMan.doi)}</a></p>`;
        }
        noteHtml += `<p><strong>关联文献：</strong>${escapeHtml(meta.title)} (${escapeHtml(meta.authors)} ${escapeHtml(meta.year)})</p>`;
        if (meta.citationApa) {
          noteHtml += `<p><strong>标准引用 (APA):</strong> ${escapeHtml(meta.citationApa)}</p>`;
        }
        if (targetMan.abstract) {
          noteHtml += `<h3>📄 稿件摘要 / 研读笔记草稿</h3><blockquote>${escapeHtml(targetMan.abstract).replace(/\n/g, '<br/>')}</blockquote>`;
        }

        if (sub && Array.isArray(sub.timelineNodes) && sub.timelineNodes.length > 0) {
          noteHtml += `<h3>📅 稿件管线里程碑时间轴</h3><ul>`;
          for (const node of sub.timelineNodes) {
            const completedMark = node.completed ? '✅' : '⏳';
            const dateStr = node.date ? ` (${escapeHtml(node.date)})` : '';
            noteHtml += `<li>${completedMark} <strong>${escapeHtml(node.name)}</strong>${dateStr}</li>`;
          }
          noteHtml += `</ul>`;
        }

        if (sub?.refereeFeedback) {
          noteHtml += `<h3>📝 审稿人总体意见与修回要点</h3>`;
          noteHtml += `<blockquote>${escapeHtml(sub.refereeFeedback).replace(/\n/g, '<br/>')}</blockquote>`;
        }

        const reviewRows = (Array.isArray(sub?.reviewMatrix) && sub.reviewMatrix.length > 0)
          ? sub.reviewMatrix
          : (Array.isArray(sub?.rebuttalMatrix) ? sub.rebuttalMatrix : []);

        if (reviewRows.length > 0) {
          noteHtml += `<h3>📋 审稿人逐条意见与修回回复矩阵 (Response Matrix)</h3>`;
          noteHtml += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:12px; border-color:#cbd5e1;">`;
          noteHtml += `<tr style="background:#f1f5f9; font-weight:600;"><th style="width:45%; text-align:left;">审稿人意见 (Reviewer Comment)</th><th style="width:55%; text-align:left;">作者修回回复 (Author Response)</th></tr>`;
          for (let i = 0; i < reviewRows.length; i++) {
            const r = reviewRows[i];
            const cmt = escapeHtml(r.comment || '').replace(/\n/g, '<br/>');
            const resp = escapeHtml(r.response || '').replace(/\n/g, '<br/>');
            noteHtml += `<tr><td style="vertical-align:top; background:#f8fafc;"><strong>#${i + 1}</strong><br/>${cmt || '<em style="color:#94a3b8;">暂无内容</em>'}</td><td style="vertical-align:top;">${resp || '<em style="color:#94a3b8;">待撰写回复</em>'}</td></tr>`;
          }
          noteHtml += `</table>`;
        }

        noteHtml += `<hr/><p style="font-size:11px;color:#94a3b8;">由 ResearchFlow for Zotero 自动生成并同步至 Zotero 云端笔记 | 更新时间：${new Date().toLocaleString()}</p>`;

        // Find existing ResearchFlow child note
        let targetNote = null;
        if (typeof target.getNotes === 'function') {
          const noteIDs = target.getNotes();
          for (const nid of noteIDs) {
            const noteItem = Zotero.Items.get(nid);
            if (noteItem && typeof noteItem.isNote === 'function' && noteItem.isNote()) {
              const content = noteItem.getNote();
              if (content && (content.includes('[ResearchFlow]') || content.includes('ResearchFlow for Zotero'))) {
                targetNote = noteItem;
                break;
              }
            }
          }
        }

        if (targetNote) {
          targetNote.setNote(noteHtml);
          await targetNote.saveTx();
        } else {
          const newNote = new Zotero.Item('note');
          newNote.libraryID = target.libraryID;
          newNote.parentID = target.id;
          newNote.setNote(noteHtml);
          try {
            newNote.addTag('ResearchFlow');
          } catch (_) {}
          await newNote.saveTx();
          targetNote = newNote;
        }

        return targetNote;
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] syncManuscriptToChildNote error: ' + e);
        return null;
      }
    },

    createXULElement(doc, tagName) {
      if (!doc) return null;
      if (typeof doc.createXULElement === 'function') {
        return doc.createXULElement(tagName);
      }
      return doc.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', tagName);
    },

    async init() {
      Zotero.log('[ResearchFlow] Initializing host runtime...');
      await this.loadDatabase();

      this.initWindowListener();

      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        this.addToWindow(win);
      }

      // Register Zotero Preference Pane
      if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.register === 'function') {
        try {
          const prefSrc = this.rootURI
            ? `${this.rootURI}chrome/content/preferences.xhtml`
            : `${CHROME_ROOT}preferences.xhtml`;
          const prefScript = this.rootURI
            ? `${this.rootURI}chrome/content/scripts/preferences.js`
            : `${CHROME_ROOT}scripts/preferences.js`;
          const prefCss = this.rootURI
            ? `${this.rootURI}chrome/content/assets/preferences.css`
            : `${CHROME_ROOT}assets/preferences.css`;
          const prefIcon = this.rootURI
            ? `${this.rootURI}chrome/content/icons/researchflow.svg`
            : `${CHROME_ROOT}icons/researchflow.svg`;

          Zotero.PreferencePanes.register({
            pluginID: ADDON_ID,
            src: prefSrc,
            label: 'ResearchFlow',
            image: prefIcon,
            scripts: [prefScript],
            stylesheets: [prefCss],
          });
        } catch (prefErr) {
          Zotero.log?.('[ResearchFlow] PreferencePanes registration note: ' + prefErr);
        }
      }

      // Register ItemPane Section (Literature details inspector panel)
      this.registerItemPaneSection();

      Zotero.log('[ResearchFlow] Initialized successfully in Zotero');
    },

    initWindowListener() {
      windowListener = {
        onOpenWindow: (xulWindow) => {
          let domWindow;
          try {
            domWindow = xulWindow
              .QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          } catch (_) {
            return;
          }
          const onLoad = () => {
            domWindow.removeEventListener('load', onLoad, false);
            pendingWindowLoads.delete(domWindow);
            if (!domWindow.closed) Zotero.ResearchFlow?.addToWindow(domWindow);
          };
          pendingWindowLoads.set(domWindow, onLoad);
          domWindow.addEventListener('load', onLoad, { once: true });
          if (domWindow.document?.readyState === 'complete') onLoad();
        },
        onCloseWindow: (xulWindow) => {
          try {
            const domWindow = xulWindow
              .QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
            const onLoad = pendingWindowLoads.get(domWindow);
            if (onLoad) domWindow.removeEventListener('load', onLoad, false);
            pendingWindowLoads.delete(domWindow);
            Zotero.ResearchFlow?.removeFromWindow(domWindow);
          } catch (_) {}
        }
      };
      Services.wm.addListener(windowListener);
    },

    addToWindow(window) {
      if (!window || !window.document) return;
      const doc = window.document;

      const staleMenuIds = [
        'researchflow-itemmenu-separator',
        'researchflow-itemmenu-create',
        'researchflow-itemmenu-link',
        'researchflow-collectionmenu-separator',
        'researchflow-collectionmenu-create',
      ];
      for (const id of staleMenuIds) {
        try { doc.getElementById(id)?.remove(); } catch (_) {}
      }

      if (doc.getElementById('researchflow-tools-menu')) return;

      const windowElements = [];
      this.ensureLocalization(doc);

      // 1. Add to "Tools" Menu
      const toolsPopup = doc.getElementById('menu_ToolsPopup');
      if (toolsPopup) {
        const toolsItem = this.createXULElement(doc, 'menuitem');
        toolsItem.id = 'researchflow-tools-menu';
        toolsItem.setAttribute('label', 'ResearchFlow OS 科研工作台');
        toolsItem.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        toolsItem.setAttribute('class', 'menuitem-iconic');
        toolsItem.addEventListener('command', () => {
          this.triggerResearchFlowOpen(window);
        });
        toolsPopup.appendChild(toolsItem);
        windowElements.push(toolsItem);

        const prefItem = this.createXULElement(doc, 'menuitem');
        prefItem.id = 'researchflow-tools-preferences';
        prefItem.setAttribute('label', 'ResearchFlow 偏好设置...');
        prefItem.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        prefItem.setAttribute('class', 'menuitem-iconic');
        prefItem.addEventListener('command', () => {
          this.openPreferencesPane(window);
        });
        toolsPopup.appendChild(prefItem);
        windowElements.push(prefItem);
      }

      // 2. Add to Item Context Menu (文献右键菜单)
      const itemMenu = doc.getElementById('zotero-itemmenu');
      if (itemMenu) {
        const separator = this.createXULElement(doc, 'menuseparator');
        separator.id = 'researchflow-itemmenu-separator';
        itemMenu.appendChild(separator);
        windowElements.push(separator);

        const createFromItem = this.createXULElement(doc, 'menuitem');
        createFromItem.id = 'researchflow-itemmenu-create';
        createFromItem.setAttribute('label', '新建论文稿件管线');
        createFromItem.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        createFromItem.setAttribute('class', 'menuitem-iconic');
        createFromItem.addEventListener('command', () => {
          try {
            this.createManuscriptFromSelection(window);
          } catch (err) {
            Zotero.logError?.('[ResearchFlow] Failed to create manuscript from item context menu: ' + err);
          }
        });
        itemMenu.appendChild(createFromItem);
        windowElements.push(createFromItem);

        const linkToItem = this.createXULElement(doc, 'menuitem');
        linkToItem.id = 'researchflow-itemmenu-link';
        linkToItem.setAttribute('label', '关联到现有稿件');
        linkToItem.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        linkToItem.setAttribute('class', 'menuitem-iconic');
        linkToItem.addEventListener('command', () => {
          try {
            this.linkSelectionToManuscript(window);
          } catch (err) {
            Zotero.logError?.('[ResearchFlow] Failed to link item: ' + err);
          }
        });
        itemMenu.appendChild(linkToItem);
        windowElements.push(linkToItem);
      }

      // 3. Add to Collection Context Menu (分类文件夹右键菜单)
      const collectionMenu = doc.getElementById('zotero-collectionmenu');
      if (collectionMenu) {
        const colSep = this.createXULElement(doc, 'menuseparator');
        colSep.id = 'researchflow-collectionmenu-separator';
        collectionMenu.appendChild(colSep);
        windowElements.push(colSep);

        const colCreate = this.createXULElement(doc, 'menuitem');
        colCreate.id = 'researchflow-collectionmenu-create';
        colCreate.setAttribute('label', '为此分类创建论文稿件管线');
        colCreate.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        colCreate.setAttribute('class', 'menuitem-iconic');
        colCreate.addEventListener('command', () => {
          try {
            const pane = window.ZoteroPane || (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
            const collection = pane?.getSelectedCollection?.();
            if (collection) {
              this.createManuscriptFromCollection(collection, window);
            } else {
              alert('请先在左侧选择一个分类文件夹。');
            }
          } catch (err) {
            Zotero.logError?.('[ResearchFlow] collection menu error: ' + err);
          }
        });
        collectionMenu.appendChild(colCreate);
        windowElements.push(colCreate);
      }

      // 4. Inject Tab & Toolbar Icon Style
      try {
        if (!doc.getElementById('researchflow-tab-style')) {
          const style = doc.createElement('style');
          style.id = 'researchflow-tab-style';
          style.textContent = `
            tab[type="researchflow"] .tab-icon,
            .tab[type="researchflow"] .tab-icon {
              list-style-image: url("${CHROME_ROOT}icons/researchflow.svg") !important;
              width: 16px !important;
              height: 16px !important;
              max-width: 16px !important;
              max-height: 16px !important;
            }

            #researchflow-toolbar-button,
            toolbarbutton#researchflow-toolbar-button {
              width: 24px !important;
              height: 24px !important;
              min-width: 24px !important;
              max-width: 28px !important;
              max-height: 28px !important;
              padding: 2px !important;
              margin: 0 2px !important;
              box-sizing: border-box !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              overflow: hidden !important;
            }

            #researchflow-toolbar-button .toolbarbutton-icon,
            #researchflow-toolbar-button image,
            #researchflow-toolbar-button img {
              width: 16px !important;
              height: 16px !important;
              min-width: 16px !important;
              max-width: 16px !important;
              min-height: 16px !important;
              max-height: 16px !important;
              object-fit: contain !important;
              display: block !important;
              margin: 0 auto !important;
            }

            menuitem#researchflow-tools-menu .menu-iconic-icon,
            menuitem#researchflow-tools-preferences .menu-iconic-icon,
            menuitem#researchflow-itemmenu-create .menu-iconic-icon,
            menuitem#researchflow-itemmenu-link .menu-iconic-icon,
            menuitem#researchflow-collectionmenu-create .menu-iconic-icon {
              width: 16px !important;
              height: 16px !important;
              max-width: 16px !important;
              max-height: 16px !important;
            }
          `;
          (doc.head || doc.documentElement).appendChild(style);
          windowElements.push(style);
        }
      } catch (_) {}

      // 5. Global Keyboard Shortcuts: Ctrl+Alt+R to open, Ctrl+Shift+R to capture/create from selection or reader
      const handleGlobalKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault?.();
          e.stopPropagation?.();
          this.triggerResearchFlowOpen(window);
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault?.();
          e.stopPropagation?.();
          const tabs = window?.Zotero_Tabs || (typeof Zotero_Tabs !== 'undefined' ? Zotero_Tabs : null);
          if (tabs && tabs.selectedTab && tabs.selectedTab.type === 'reader') {
            this.createRecordFromReader(window);
          } else {
            this.createManuscriptFromSelection(window);
          }
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      windowElements.push({
        remove: () => window.removeEventListener('keydown', handleGlobalKeyDown, true),
      });

      // 6. Host-level listener for postMessages from iframes
      const handleHostMessage = (event) => {
        try {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (typeof data.type !== 'string' || !data.type.startsWith('RESEARCHFLOW_')) return;

          const sourceWin = event.source;
          const iframe = window.document.getElementById('researchflow-tab-iframe');

          const replyResult = (msgObj) => {
            try {
              if (sourceWin && typeof sourceWin.postMessage === 'function') {
                sourceWin.postMessage(msgObj, '*');
              } else if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(msgObj, '*');
              }
            } catch (_) {}
          };

          // A. Ready Handshake
          if (data.type === 'RESEARCHFLOW_READY') {
            this.loadDatabase().then((storedData) => {
              replyResult({
                type: 'RESEARCHFLOW_INIT_DATA',
                data: storedData,
                pending: iframe?._researchflowPending || null
              });
              if (iframe) iframe._researchflowPending = null;
            });
            return;
          }

          // B. Storage Save Request
          if (data.type === 'RESEARCHFLOW_STORAGE_SET' && data.payload) {
            this.saveDatabase(data.payload).then(() => {
              if (data.requestId) {
                replyResult({ requestId: data.requestId, success: true });
              }
            });
            return;
          }

          // C. Select item in Zotero library
          if (data.type === 'RESEARCHFLOW_SELECT_ITEM' && data.itemKey) {
            try {
              const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
              if (item && window.ZoteroPane) {
                window.ZoteroPane.selectItem(item.id);
              }
            } catch (_) {}
            return;
          }

          // D. Get active item from Zotero
          if (data.type === 'RESEARCHFLOW_GET_ACTIVE_ITEM') {
            const active = this.getCurrentActiveItem(window);
            const serialized = active ? serializeLiteratureItem(active) : null;
            replyResult({
              requestId: data.requestId,
              item: serialized
            });
            return;
          }

          // E. Open PDF Attachment in Reader
          if (data.type === 'RESEARCHFLOW_OPEN_PDF' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
            if (item) {
              this.openPdfAttachment(item, data.page);
            }
            return;
          }

          // F. Sync to Zotero Child Note
          if (data.type === 'RESEARCHFLOW_SYNC_NOTE' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
            if (item) {
              this.syncManuscriptToChildNote(item).then((note) => {
                if (data.requestId) {
                  replyResult({ requestId: data.requestId, success: Boolean(note), noteId: note?.id });
                }
              });
            }
            return;
          }

          // G. Get Zotero Collections
          if (data.type === 'RESEARCHFLOW_GET_COLLECTIONS') {
            const cols = this.getZoteroCollections(data.libraryID);
            replyResult({
              requestId: data.requestId,
              collections: cols
            });
            return;
          }

          // H. Open Zotero Preferences
          
          // I. Search Zotero Library
          if (data.type === 'RESEARCHFLOW_SEARCH_LIBRARY') {
            this.searchLibrary(data.query, data.limit || 15).then((results) => {
              replyResult({
                requestId: data.requestId,
                results: results || []
              });
            });
            return;
          }

          
          // K. Get Literature PDF Annotations & Highlights
          if (data.type === 'RESEARCHFLOW_GET_ANNOTATIONS' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
            const annos = item ? getLiteratureAnnotations(item) : [];
            replyResult({ requestId: data.requestId, annotations: annos });
            return;
          }

          // L. Sync Status Tag to Zotero Item
          if (data.type === 'RESEARCHFLOW_SYNC_STATUS_TAG' && data.itemKey && data.status) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
            if (item) {
              this.syncStatusTagToItem(item, data.status).then((success) => {
                replyResult({ requestId: data.requestId, success });
              });
            } else {
              replyResult({ requestId: data.requestId, success: false });
            }
            return;
          }

          // M. Add Item to Pipeline Collection
          if (data.type === 'RESEARCHFLOW_ADD_TO_PIPELINE_COLLECTION' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, data.itemKey);
            if (item) {
              this.addItemToPipelineCollection(item).then((col) => {
                replyResult({ requestId: data.requestId, success: Boolean(col) });
              });
            } else {
              replyResult({ requestId: data.requestId, success: false });
            }
            return;
          }

          // N. Get Reading Assets (Annotations, Notes, Collections, Tags, Related)
          if (data.type === 'RESEARCHFLOW_GET_READING_ASSETS' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries?.userLibraryID || 1, data.itemKey);
            const assets = item ? getLiteratureReadingAssets(item) : { annotations: [], notes: [], collections: [], tags: [], relatedItems: [] };
            replyResult({ requestId: data.requestId, assets });
            return;
          }

          // O. Get Literature Notes
          if (data.type === 'RESEARCHFLOW_GET_NOTES' && data.itemKey) {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries?.userLibraryID || 1, data.itemKey);
            const notes = item ? getLiteratureNotes(item) : [];
            replyResult({ requestId: data.requestId, notes });
            return;
          }

          // P. Export Database
          if (data.type === 'RESEARCHFLOW_EXPORT_DB') {
            this.exportDatabaseFile(window).then((result) => {
              replyResult({ requestId: data.requestId, ...result });
            });
            return;
          }

          // Q. Import Database
          if (data.type === 'RESEARCHFLOW_IMPORT_DB') {
            this.importDatabaseFile(data.mode || 'merge', window).then((result) => {
              replyResult({ requestId: data.requestId, ...result });
            });
            return;
          }

          // R. Export Diagnostics
          if (data.type === 'RESEARCHFLOW_EXPORT_DIAGNOSTICS') {
            this.exportDiagnosticsFile(data.report, window).then((result) => {
              replyResult({ requestId: data.requestId, ...result });
            });
            return;
          }

          // S. Restore Backup Database
          if (data.type === 'RESEARCHFLOW_RESTORE_BACKUP') {
            this.restoreBackupDatabase().then((restored) => {
              replyResult({ requestId: data.requestId, success: true, data: restored });
            }).catch((err) => {
              replyResult({ requestId: data.requestId, success: false, error: err.message });
            });
            return;
          }

          // J. Show Native Zotero ProgressWindow Toast
          if (data.type === 'RESEARCHFLOW_SHOW_TOAST') {
            this.showToast(data.title || '通知', data.message || '', data.toastType || 'info');
            return;
          }
          if (data.type === 'RESEARCHFLOW_OPEN_PREFS') {
            this.openPreferencesPane(window);
            return;
          }
          if (data.type === 'RESEARCHFLOW_OPEN_EXTERNAL' && data.url) {
            try {
              if (typeof Zotero.launchURL === 'function') {
                Zotero.launchURL(data.url);
              } else {
                const uri = Services.io.newURI(data.url);
                Cc['@mozilla.org/uriloader/external-protocol-service;1']
                  ?.getService(Ci.nsIExternalProtocolService)
                  ?.loadURI(uri);
              }
            } catch (_) {}
            return;
          }
        } catch (err) {
          Zotero.logError?.('[ResearchFlow] handleHostMessage error: ' + err);
        }
      };

      window.addEventListener('message', handleHostMessage);
      windowElements.push({
        remove: () => window.removeEventListener('message', handleHostMessage),
      });

      // 7. Toolbar Button Injection
      this.ensureToolbarButton(window, windowElements);

      injectedElements.set(window, windowElements);
    },

    removeFromWindow(window) {
      if (!window || !injectedElements.has(window)) return;
      const elements = injectedElements.get(window);
      elements.forEach((el) => {
        try {
          if (typeof el?.remove === 'function') el.remove();
          else if (el?.parentNode) el.parentNode.removeChild(el);
        } catch (_) {}
      });
      injectedElements.delete(window);
    },

    ensureToolbarButton(window, windowElements, retryCount = 0) {
      if (!window || !window.document) return;
      const doc = window.document;

      const toolbar =
        doc.getElementById('zotero-item-toolbar') ||
        doc.getElementById('zotero-items-toolbar') ||
        doc.getElementById('zotero-tb') ||
        doc.querySelector('toolbar');

      if (!toolbar) {
        if (retryCount < 5) {
          window.setTimeout(() => this.ensureToolbarButton(window, windowElements, retryCount + 1), 500);
        }
        return;
      }

      const isResearchFlowButton = (b) =>
        b.id === 'researchflow-toolbar-button' ||
        (b.getAttribute('label') === 'ResearchFlow' && String(b.getAttribute('image') || '').includes('researchflow.svg'));

      const existing = Array.from(doc.querySelectorAll('toolbarbutton')).filter(isResearchFlowButton);
      let btn = existing[0] || null;
      if (existing.length > 1) {
        for (let i = 1; i < existing.length; i++) {
          try { existing[i].remove(); } catch (_) {}
        }
      }

      if (!btn) {
        btn = this.createXULElement(doc, 'toolbarbutton');
        btn.id = 'researchflow-toolbar-button';
        btn.setAttribute('label', 'ResearchFlow');
        btn.setAttribute('tooltiptext', '打开 ResearchFlow 科研全流程工作台 (Ctrl+Alt+R)');
        btn.setAttribute('image', `${CHROME_ROOT}icons/researchflow.svg`);
        btn.setAttribute('class', 'zotero-tb-button toolbarbutton-1 chromeclass-toolbar-additional');
        btn.setAttribute(
          'style',
          'cursor: pointer; margin: 0 2px; width: 24px; height: 24px; min-width: 24px; max-width: 28px; max-height: 28px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden;'
        );
        btn.addEventListener('command', (e) => {
          if (e) {
            e.preventDefault?.();
            e.stopPropagation?.();
          }
          this.triggerResearchFlowOpen(window);
        });
      }

      const constrainIcon = () => {
        try {
          const img = btn?.querySelector('.toolbarbutton-icon') || btn?.querySelector('image') || btn?.querySelector('img');
          if (img) {
            img.style.width = '16px';
            img.style.height = '16px';
            img.style.maxWidth = '16px';
            img.style.maxHeight = '16px';
            img.setAttribute('width', '16');
            img.setAttribute('height', '16');
          }
        } catch (_) {}
      };
      constrainIcon();
      window.setTimeout(constrainIcon, 150);
      window.setTimeout(constrainIcon, 800);

      // Anchor before search box
      const toolbarChildren = Array.from(toolbar.children || []);
      const flexibleSpacerIndex = toolbarChildren.findIndex((child) => {
        const tag = String(child.localName || child.tagName || '').toLowerCase();
        return tag === 'toolbarspring' ||
          (tag === 'spacer' && Number(child.getAttribute('flex') || 0) > 0) ||
          child.id === 'zotero-tb-search' ||
          child.id === 'zotero-tb-search-textbox' ||
          child.classList?.contains('zotero-search-box') ||
          child.classList?.contains('search-box');
      });

      const leadingActionItems = flexibleSpacerIndex >= 0
        ? toolbarChildren.slice(0, flexibleSpacerIndex)
        : toolbarChildren;

      const toolbarButtons = leadingActionItems.filter((child) =>
        String(child.localName || child.tagName || '').toLowerCase() === 'toolbarbutton' &&
        !isResearchFlowButton(child) &&
        !child.hidden &&
        child.getAttribute('hidden') !== 'true' &&
        child.getAttribute('collapsed') !== 'true'
      );

      const anchor = toolbarButtons.reverse().find((child) => {
        try {
          const style = window.getComputedStyle(child);
          return style.display !== 'none' && style.visibility !== 'collapse';
        } catch (_) {
          return true;
        }
      }) || null;

      if (anchor && anchor.parentNode === toolbar) {
        if (anchor.nextSibling !== btn) {
          anchor.parentNode.insertBefore(btn, anchor.nextSibling);
        }
      } else {
        const searchBox =
          doc.getElementById('zotero-tb-search-textbox') ||
          doc.getElementById('zotero-tb-search') ||
          toolbar.querySelector('input') ||
          (flexibleSpacerIndex >= 0 ? toolbarChildren[flexibleSpacerIndex] : null);
        if (searchBox && searchBox.parentNode === toolbar) {
          toolbar.insertBefore(btn, searchBox);
        } else {
          toolbar.appendChild(btn);
        }
      }

      if (windowElements && !windowElements.includes(btn)) {
        windowElements.push(btn);
      }
    },

    getSelectedRegularItems(window) {
      const pane =
        window?.ZoteroPane ||
        (Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null) ||
        (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
      let rawSelection = [];
      try {
        if (pane?.getSelectedItems) {
          rawSelection = pane.getSelectedItems();
        }
      } catch (_) {}
      return rawSelection.map(getLiteratureItem).filter(Boolean);
    },

    getCurrentActiveItem(window) {
      const tabs = window?.Zotero_Tabs || (typeof Zotero_Tabs !== 'undefined' ? Zotero_Tabs : null);
      if (tabs && tabs.selectedTab && tabs.selectedTab.type === 'reader') {
        const reader = Zotero.Reader?.getByTabID?.(tabs.selectedTab.id);
        const itemID = reader?.itemID || tabs.selectedTab.data?.itemID;
        if (itemID) {
          const item = Zotero.Items.get(itemID);
          return getLiteratureItem(item);
        }
      }
      const selected = this.getSelectedRegularItems(window);
      return selected[0] || null;
    },

    getZoteroCollections(libraryID = null) {
      const targetLibID = libraryID || Zotero.Libraries?.userLibraryID || 1;
      const collections = Zotero.Collections?.getByLibrary?.(targetLibID) || [];
      return collections.map((col) => {
        let itemKeys = [];
        try {
          const childIds = typeof col.getChildItems === 'function' ? col.getChildItems() : [];
          itemKeys = (childIds || []).map((id) => {
            const it = Zotero.Items.get(id);
            return it?.key || null;
          }).filter(Boolean);
        } catch (_) {}
        return {
          id: col.id,
          key: col.key,
          name: col.name,
          parentID: col.parentID,
          itemKeys
        };
      });
    },

    openPdfAttachment(item, page = null) {
      const target = getLiteratureItem(item);
      if (!target) return;
      try {
        const attIds = typeof target.getAttachments === 'function' ? target.getAttachments() : [];
        for (const attId of attIds) {
          const att = Zotero.Items.get(attId);
          if (att && ((typeof att.isPDFAttachment === 'function' && att.isPDFAttachment()) || att.contentType === 'application/pdf')) {
            const win = Zotero.getMainWindow?.() || Services.wm.getMostRecentWindow('navigator:browser');
            const pageIndex = (page && Number(page) > 0) ? Math.max(0, Number(page) - 1) : 0;
            if (Zotero.Reader && typeof Zotero.Reader.open === 'function') {
              Promise.resolve(Zotero.Reader.open(att.id, { pageIndex })).catch(() => {
                try { Zotero.Reader.open({ itemID: att.id, pageIndex }); } catch (_) {}
              });
              return;
            }
            if (win?.ZoteroPane?.openAttachment) {
              win.ZoteroPane.openAttachment(att.id);
              return;
            }
            break;
          }
        }
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] openPdfAttachment error: ' + err);
      }
    },

    createManuscriptFromSelection(window) {
      const items = this.getSelectedRegularItems(window);
      if (!items || items.length === 0) {
        alert('请在 Zotero 文献库中先选中一篇论文条目。');
        return;
      }
      const serialized = serializeLiteratureItem(items[0]);
      this.triggerResearchFlowOpen(window, {
        action: 'create_manuscript_from_item',
        item: serialized
      });
    },

    linkSelectionToManuscript(window) {
      const items = this.getSelectedRegularItems(window);
      if (!items || items.length === 0) {
        alert('请在 Zotero 文献库中先选中一篇论文条目。');
        return;
      }
      const serialized = serializeLiteratureItem(items[0]);
      this.triggerResearchFlowOpen(window, {
        action: 'link_item_to_manuscript',
        item: serialized
      });
    },

    async createManuscriptFromCollection(collection, window = null) {
      if (!collection) return;
      try {
        const win = window || (Zotero.getMainWindow ? Zotero.getMainWindow() : null);
        const childItemIDs = collection.getChildItems ? collection.getChildItems() : [];
        const childMetas = [];
        for (const id of childItemIDs.slice(0, 30)) {
          const item = Zotero.Items.get(id);
          const lit = getLiteratureItem(item);
          if (lit) {
            childMetas.push(serializeLiteratureItem(lit));
          }
        }
        this.triggerResearchFlowOpen(win, {
          action: 'create_from_collection',
          collectionName: collection.name,
          collectionId: collection.id,
          items: childMetas
        });
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] createManuscriptFromCollection error: ' + err);
      }
    },

    async createRecordFromReader(window = null) {
      const win = window || (Zotero.getMainWindow ? Zotero.getMainWindow() : null);
      const tabs = win?.Zotero_Tabs || (typeof Zotero_Tabs !== 'undefined' ? Zotero_Tabs : null);
      if (!tabs || !tabs.selectedTab || tabs.selectedTab.type !== 'reader') {
        const selected = this.getSelectedRegularItems(win);
        if (selected.length > 0) {
          this.createManuscriptFromSelection(win);
        }
        return;
      }

      try {
        const reader = Zotero.Reader?.getByTabID?.(tabs.selectedTab.id);
        const itemID = reader?.itemID || tabs.selectedTab.data?.itemID;
        if (!itemID) return;

        const attachmentItem = Zotero.Items.get(itemID);
        const regularItem = getLiteratureItem(attachmentItem);
        if (!regularItem) return;

        const meta = serializeLiteratureItem(regularItem);

        // Get selected text if any
        let selectedText = '';
        try {
          if (typeof reader.getSelectedText === 'function') {
            selectedText = await reader.getSelectedText();
          }
        } catch (_) {}

        if (!selectedText && reader._iframeWindow) {
          try {
            selectedText = reader._iframeWindow.getSelection?.()?.toString() || '';
          } catch (_) {}
        }
        selectedText = String(selectedText || '').trim();

        // Get page index
        let pageIndex = 0;
        try {
          if (reader.state && typeof reader.state.pageIndex === 'number') {
            pageIndex = reader.state.pageIndex;
          } else if (reader._iframeWindow?.PDFViewerApplication?.page) {
            pageIndex = reader._iframeWindow.PDFViewerApplication.page - 1;
          }
        } catch (_) {}
        const pageNum = pageIndex + 1;

        // Construct PDF anchor deep link
        const pdfKey = attachmentItem?.key || meta.key;
        const groupID = Zotero.Libraries?.get?.(regularItem.libraryID)?.groupID;
        const pageLink = groupID
          ? `zotero://open-pdf/groups/${groupID}/items/${pdfKey}?page=${pageNum}`
          : `zotero://open-pdf/library/items/${pdfKey}?page=${pageNum}`;

        this.triggerResearchFlowOpen(win, {
          action: 'reader_excerpt',
          item: meta,
          excerpt: selectedText,
          page: pageNum,
          pdfLink: pageLink
        });
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] createRecordFromReader error: ' + err);
      }
    },

    triggerResearchFlowOpen(window, options = {}) {
      const mode = this.getPref('windowMode', 'tab');
      if (mode === 'subwindow') {
        this.openStandaloneWindow(options, window, 'subwindow');
      } else if (mode === 'window') {
        this.openStandaloneWindow(options, window, 'window');
      } else {
        this.openResearchFlow(options, window, 'tab');
      }
    },

    openResearchFlow(options = {}, targetWindow = null, windowType = 'tab') {
      try {
        const mainWin = (targetWindow && targetWindow.Zotero_Tabs)
          ? targetWindow
          : (Zotero.getMainWindow ? Zotero.getMainWindow() : Services.wm.getMostRecentWindow('navigator:browser'));

        if (windowType === 'tab' && mainWin && mainWin.Zotero_Tabs) {
          const tabs = mainWin.Zotero_Tabs;
          // Check if tab already exists
          const existingTab = tabs._tabs?.find?.((t) => t.type === 'researchflow') ||
            tabs._tabs?.find?.((t) => t.title && t.title.includes('ResearchFlow'));

          if (existingTab) {
            tabs.select(existingTab.id);
            if (mainWin.focus) mainWin.focus();

            const iframe = mainWin.document.getElementById('researchflow-tab-iframe') ||
              (existingTab.container && existingTab.container.querySelector('iframe'));
            if (iframe) {
              iframe._researchflowPending = options;
              try {
                if (iframe.contentWindow?.postMessage) {
                  iframe.contentWindow.postMessage({ type: 'RESEARCHFLOW_NAVIGATE', options }, '*');
                }
              } catch (_) {}
            }
            return;
          }

          // Open new internal tab
          const tabResult = tabs.add({
            type: 'researchflow',
            title: 'ResearchFlow OS',
            select: true,
            data: options,
            onClose: () => {
              Zotero.log?.('[ResearchFlow] Tab closed');
            }
          });

          const container = (tabResult && tabResult.container) ||
            (tabs.getTabContainer && tabs.getTabContainer(tabResult.id || tabResult)) ||
            (tabs.getTab && tabs.getTab(tabResult?.id)?.container);

          if (container) {
            const doc = container.ownerDocument || mainWin.document;
            const iframe = doc.createElement('iframe');
            iframe.id = 'researchflow-tab-iframe';
            iframe.setAttribute('src', `${CHROME_ROOT}index.html`);
            iframe.setAttribute('style', 'width: 100%; height: 100%; border: none; flex: 1; display: block;');
            iframe.setAttribute('flex', '1');
            iframe._researchflowReady = false;
            iframe._researchflowPending = options;

            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.overflow = 'hidden';

            iframe.addEventListener('load', () => {
              try {
                if (iframe.contentWindow) {
                  iframe.contentWindow.Zotero = Zotero;
                  iframe.contentWindow._researchflowPending = options;
                  if (iframe.contentWindow.postMessage) {
                    iframe.contentWindow.postMessage({ type: 'RESEARCHFLOW_NAVIGATE', options }, '*');
                  }
                }
              } catch (_) {}
            });

            container.appendChild(iframe);
          }

          if (mainWin.focus) mainWin.focus();
          return;
        }
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] openResearchFlow error: ' + e);
      }

      this.openStandaloneWindow(options, targetWindow, 'window');
    },

    openStandaloneWindow(options = {}, targetWindow = null, windowType = 'window') {
      try {
        const ww = Services.ww;
        let features = '';
        let windowName = '';
        const url = `${CHROME_ROOT}index.html?mode=${encodeURIComponent(windowType)}`;
        if (windowType === 'subwindow') {
          const alwaysRaised = this.getPref('subwindowAlwaysOnTop', false) ? ',alwaysRaised=yes' : '';
          features = `chrome,dialog=no,all,resizable=yes,minimizable=yes,width=480,height=780,top=80,left=80${alwaysRaised}`;
          windowName = 'ResearchFlow_SubWindow';
        } else {
          features = 'chrome,dialog=no,all,resizable=yes,minimizable=yes,width=1240,height=820,centerscreen';
          windowName = 'ResearchFlow_Window';
        }

        const mainWin = (targetWindow && targetWindow.Zotero_Tabs)
          ? targetWindow
          : (Zotero.getMainWindow ? Zotero.getMainWindow() : Services.wm.getMostRecentWindow('navigator:browser'));

        const win = ww.openWindow(
          mainWin,
          url,
          windowName,
          features,
          { Zotero, options: { ...options, currentWindowType: windowType } }
        );
        if (win && win.focus) win.focus();
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] openStandaloneWindow error: ' + err);
      }
    },

    openPreferencesPane(window) {
      try {
        const win = window || Zotero.getMainWindow?.();
        if (Zotero.Utilities?.Internal?.openPreferences) {
          Zotero.Utilities.Internal.openPreferences('researchflow-preferences-pane');
        } else if (win?.openPreferences) {
          win.openPreferences('researchflow-preferences-pane');
        } else {
          win?.openDialog?.('chrome://zotero/content/preferences/preferences.xhtml', 'Preferences', 'chrome,titlebar,toolbar,centerscreen,dialog=yes');
        }
      } catch (e) {
        Zotero.logError?.('[ResearchFlow] Could not open preferences: ' + e);
      }
    },

    registerItemPaneSection() {
      if (typeof Zotero.ItemPaneManager?.registerSection !== 'function') return;
      try {
        const sectionStates = new WeakMap();
        const icon = `${CHROME_ROOT}icons/researchflow.svg`;

        this.itemPaneSectionID = Zotero.ItemPaneManager.registerSection({
          paneID: 'researchflow-item-pane',
          pluginID: ADDON_ID,
          header: { l10nID: 'researchflow-item-pane-header', icon },
          sidenav: { l10nID: 'researchflow-item-pane-header', icon },
          onInit: ({ doc, body, item, refresh }) => {
            const document = doc || body?.ownerDocument;
            if (document) {
              this.ensureLocalization(document);
            }
            const target = getLiteratureItem(item);
            const state = {
              itemKey: target?.key || null,
              refresh,
              onDataChanged: () => {
                Promise.resolve(refresh?.()).catch((err) => {
                  Zotero.logError?.('[ResearchFlow] ItemPane refresh failed: ' + err);
                });
              }
            };
            this.registerDataListener(state.onDataChanged);
            sectionStates.set(body, state);
          },
          onDestroy: ({ body }) => {
            const state = sectionStates.get(body);
            if (state?.onDataChanged) {
              this.unregisterDataListener(state.onDataChanged);
            }
            sectionStates.delete(body);
          },
          onItemChange: ({ body, item, setEnabled }) => {
            const target = getLiteratureItem(item);
            const state = sectionStates.get(body);
            if (state) state.itemKey = target?.key || null;
            setEnabled(Boolean(target));
          },
          onRender: async ({ doc, body, item, setSectionSummary }) => {
            if (!body) return;
            const document = doc || body.ownerDocument;
            body.replaceChildren();
            const target = getLiteratureItem(item);
            if (!target) return;

            const db = await this.loadDatabase();
            const targetKey = target.key;
            const targetDoi = (typeof target.getField === 'function' ? target.getField('DOI') : '') || '';

            // Find linked manuscripts
            const manuscripts = (db.manuscripts || []).filter((m) => {
              if (m.zoteroItemKey && m.zoteroItemKey === targetKey) return true;
              if (targetDoi && m.doi && m.doi.toLowerCase() === targetDoi.toLowerCase()) return true;
              return false;
            });

            const count = manuscripts.length;
            setSectionSummary?.(count ? `${count} 个稿件管线` : '');

            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:6px 2px; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; width:100%; box-sizing:border-box;';

            if (count > 0) {
              manuscripts.forEach((m) => {
                const card = document.createElement('div');
                card.style.cssText = 'background:var(--fill-secondary, var(--background-secondary, rgba(127,127,127,0.06))); border:1px solid var(--border-primary, var(--border-color, rgba(127,127,127,0.2))); border-radius:6px; padding:8px 10px; display:flex; flex-direction:column; gap:6px; box-sizing:border-box; color:var(--text-primary, inherit);';

                const header = document.createElement('div');
                header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:6px;';

                const titleEl = document.createElement('div');
                titleEl.style.cssText = 'font-weight:600; font-size:12px; color:#cc292b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;';
                titleEl.textContent = m.title || '未命名稿件';

                const statusStyles = {
                  idea: { bg: 'rgba(100,116,139,0.12)', color: '#475569', label: '选题中', pct: 15 },
                  drafting: { bg: 'rgba(204,41,43,0.12)', color: '#cc292b', label: '初稿撰写', pct: 40 },
                  under_review: { bg: 'rgba(37,99,235,0.12)', color: '#2563eb', label: '同行审稿', pct: 65 },
                  revision: { bg: 'rgba(217,119,6,0.12)', color: '#d97706', label: '修回修订', pct: 80 },
                  accepted: { bg: 'rgba(5,150,105,0.12)', color: '#059669', label: '已录用', pct: 95 },
                  published: { bg: 'rgba(5,150,105,0.22)', color: '#047857', label: '已发表', pct: 100 }
                };
                const st = statusStyles[m.status] || { bg: 'rgba(204,41,43,0.12)', color: '#cc292b', label: m.status || '撰写中', pct: 50 };

                const badge = document.createElement('span');
                badge.style.cssText = `font-size:10px; padding:2px 7px; border-radius:4px; background:${st.bg}; color:${st.color}; font-weight:600; white-space:nowrap;`;
                badge.textContent = st.label;

                header.append(titleEl, badge);

                // Progress Bar
                const progTrack = document.createElement('div');
                progTrack.style.cssText = 'width:100%; height:3px; background:var(--fill-tertiary, rgba(127,127,127,0.15)); border-radius:2px; overflow:hidden;';
                const progFill = document.createElement('div');
                progFill.style.cssText = `width:${st.pct}%; height:100%; background:${st.color}; border-radius:2px; transition:width 0.3s ease;`;
                progTrack.appendChild(progFill);

                const meta = document.createElement('div');
                meta.style.cssText = 'font-size:11px; color:var(--text-secondary, #64748b); display:flex; justify-content:space-between;';
                meta.textContent = m.targetJournal ? `目标期刊: ${m.targetJournal}` : '自拟稿件管线';

                // Action buttons row
                const actionRow = document.createElement('div');
                actionRow.style.cssText = 'display:flex; gap:6px; justify-content:flex-end; margin-top:4px; flex-wrap:wrap;';

                const btnView = document.createElement('button');
                btnView.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #cc292b; background:transparent; color:#cc292b; cursor:pointer; font-weight:500;';
                btnView.textContent = '🔍 查看';
                btnView.title = '在 ResearchFlow 工作台中打开该稿件';
                btnView.addEventListener('click', () => {
                  Zotero.ResearchFlow.triggerResearchFlowOpen(document.defaultView, {
                    view: 'view-manuscripts',
                    manuscriptId: m.id
                  });
                });
                actionRow.appendChild(btnView);

                const btnSyncNote = document.createElement('button');
                btnSyncNote.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid var(--border-primary, #cbd5e1); background:var(--fill-secondary, rgba(127,127,127,0.08)); color:var(--text-primary, #334155); cursor:pointer; font-weight:500;';
                btnSyncNote.textContent = '📝 同步笔记';
                btnSyncNote.title = '将稿件进展与审稿矩阵同步为文献子笔记 (支持 Zotero 云端全平台多端同步)';
                btnSyncNote.addEventListener('click', async () => {
                  btnSyncNote.textContent = '⏳ 同步中...';
                  const note = await Zotero.ResearchFlow.syncManuscriptToChildNote(target, m);
                  if (note) {
                    btnSyncNote.textContent = '✅ 已同步';
                    setTimeout(() => { btnSyncNote.textContent = '📝 同步笔记'; }, 2000);
                  } else {
                    btnSyncNote.textContent = '❌ 失败';
                  }
                });
                actionRow.appendChild(btnSyncNote);

                const metaData = serializeLiteratureItem(target);
                if (metaData?.pdfUri) {
                  const btnPdf = document.createElement('button');
                  btnPdf.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #059669; background:transparent; color:#059669; cursor:pointer; font-weight:500;';
                  btnPdf.textContent = '📖 PDF';
                  btnPdf.title = '在 Zotero PDF 阅读器中打开';
                  btnPdf.addEventListener('click', () => {
                    Zotero.ResearchFlow.openPdfAttachment(target);
                  });
                  actionRow.appendChild(btnPdf);
                }

                // Synergistic metadata row: CiteKey & Annotations count
                const synergyBar = document.createElement('div');
                synergyBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--text-secondary, #475569); background:var(--fill-tertiary, rgba(127,127,127,0.08)); padding:4px 6px; border-radius:4px; margin-top:2px;';

                const citeChip = document.createElement('span');
                citeChip.style.cssText = 'cursor:pointer; font-family:monospace; background:rgba(37,99,235,0.08); color:#2563eb; padding:1px 5px; border-radius:3px; font-weight:600;';
                citeChip.textContent = `[@${metaData.citekey}]`;
                citeChip.title = '点击复制 Citation Key';
                citeChip.addEventListener('click', () => {
                  try {
                    const clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']?.getService(Components.interfaces.nsIClipboardHelper);
                    if (clipboard) clipboard.copyString(`[@${metaData.citekey}]`);
                  } catch (_) {}
                  citeChip.textContent = '✅ 已复制';
                  setTimeout(() => { citeChip.textContent = `[@${metaData.citekey}]`; }, 1800);
                });

                const annoInfo = document.createElement('span');
                annoInfo.style.cssText = 'font-size:10px; color:var(--text-secondary, #64748b);';
                annoInfo.textContent = metaData.annotationCount > 0 ? `📑 ${metaData.annotationCount} 条批注` : '暂无批注';

                const notesInfo = document.createElement('span');
                notesInfo.style.cssText = 'font-size:10px; color:#2563eb;';
                notesInfo.textContent = metaData.notesCount > 0 ? `📝 ${metaData.notesCount} 篇笔记` : '';

                synergyBar.append(citeChip, annoInfo);
                if (metaData.notesCount > 0) synergyBar.appendChild(notesInfo);

                // Add APA copy button to action row
                const btnApa = document.createElement('button');
                btnApa.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid var(--border-primary, #cbd5e1); background:var(--fill-secondary, rgba(127,127,127,0.08)); color:var(--text-secondary, #475569); cursor:pointer; font-weight:500;';
                btnApa.textContent = '📋 引用';
                btnApa.title = '复制标准引用 (APA)';
                btnApa.addEventListener('click', () => {
                  try {
                    const clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']?.getService(Components.interfaces.nsIClipboardHelper);
                    if (clipboard) clipboard.copyString(metaData.citationApa);
                  } catch (_) {}
                  btnApa.textContent = '✅ 已复制';
                  setTimeout(() => { btnApa.textContent = '📋 引用'; }, 1800);
                });

                // Add BibTeX copy button to action row
                const btnBib = document.createElement('button');
                btnBib.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid var(--border-primary, #cbd5e1); background:var(--fill-secondary, rgba(127,127,127,0.08)); color:var(--text-secondary, #475569); cursor:pointer; font-weight:500;';
                btnBib.textContent = '📋 BibTeX';
                btnBib.title = '复制 BibTeX 引用条目';
                btnBib.addEventListener('click', () => {
                  try {
                    const clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']?.getService(Components.interfaces.nsIClipboardHelper);
                    if (clipboard) clipboard.copyString(metaData.bibtex);
                  } catch (_) {}
                  btnBib.textContent = '✅ 已复制';
                  setTimeout(() => { btnBib.textContent = '📋 BibTeX'; }, 1800);
                });
                actionRow.insertBefore(btnBib, actionRow.firstChild);
                actionRow.insertBefore(btnApa, actionRow.firstChild);

                card.append(header, progTrack, meta, synergyBar, actionRow);
                wrap.appendChild(card);
              });
            } else {
              const emptyCard = document.createElement('div');
              emptyCard.style.cssText = 'background:var(--fill-secondary, var(--background-secondary, rgba(127,127,127,0.04))); border:1px dashed var(--border-primary, var(--border-color, rgba(127,127,127,0.25))); border-radius:6px; padding:14px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px;';

              const emptyText = document.createElement('div');
              emptyText.style.cssText = 'font-size:11px; color:var(--text-secondary, #64748b);';
              emptyText.textContent = '此文献尚未关联论文稿件管线';

              const btnRow = document.createElement('div');
              btnRow.style.cssText = 'display:flex; gap:8px;';

              const createBtn = document.createElement('button');
              createBtn.style.cssText = 'font-size:11px; padding:5px 12px; border-radius:5px; background:#cc292b; color:#fff; border:1px solid #b71c1c; cursor:pointer; font-weight:500;';
              createBtn.textContent = '➕ 新建稿件管线';
              createBtn.addEventListener('click', () => {
                const serialized = serializeLiteratureItem(target);
                Zotero.ResearchFlow.triggerResearchFlowOpen(document.defaultView, {
                  action: 'create_manuscript_from_item',
                  item: serialized
                });
              });

              const linkBtn = document.createElement('button');
              linkBtn.style.cssText = 'font-size:11px; padding:5px 12px; border-radius:5px; background:var(--fill-secondary, rgba(127,127,127,0.1)); color:var(--text-primary, #334155); border:1px solid var(--border-primary, #cbd5e1); cursor:pointer; font-weight:500;';
              linkBtn.textContent = '🔗 关联现有稿件';
              linkBtn.addEventListener('click', () => {
                const serialized = serializeLiteratureItem(target);
                Zotero.ResearchFlow.triggerResearchFlowOpen(document.defaultView, {
                  action: 'link_item_to_manuscript',
                  item: serialized
                });
              });

              btnRow.append(createBtn, linkBtn);
              emptyCard.append(emptyText, btnRow);
              wrap.appendChild(emptyCard);
            }

            body.appendChild(wrap);
          }
        });
      } catch (err) {
        Zotero.logError?.('[ResearchFlow] registerItemPaneSection error: ' + err);
      }
    },

    async shutdown() {
      this._dataListeners.clear();
      this.destroyNotifier();
      this.unregisterMenus();
      if (windowListener) {
        Services.wm.removeListener(windowListener);
        windowListener = null;
      }
      for (const [win, elements] of injectedElements) {
        elements.forEach((el) => {
          try {
            if (typeof el?.remove === 'function') el.remove();
            else if (el?.parentNode) el.parentNode.removeChild(el);
          } catch (_) {}
        });
      }
      injectedElements.clear();
      if (this.itemPaneSectionID && Zotero.ItemPaneManager?.unregisterSection) {
        try {
          Zotero.ItemPaneManager.unregisterSection(this.itemPaneSectionID);
        } catch (_) {}
      }
      Zotero.log('[ResearchFlow] Shutdown complete');
    }
  };

  // Kickstart initialization
  Zotero.ResearchFlow.init().catch((err) => {
    Zotero.logError?.('[ResearchFlow] init error: ' + err);
  });
})();
