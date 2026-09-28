// HTTP test harness for Zotero's host and device-local UI APIs.
(() => {
  const values = globalThis.__RF_PRELOAD_STORAGE || JSON.parse(sessionStorage.getItem('qa-zotero-state') || '{}');
  const persist = () => sessionStorage.setItem('qa-zotero-state', JSON.stringify(values));
  const listeners = [];
  globalThis.RFPlatform = {
    storage: {
      local: {
        get(keys, callback) {
          const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
          const result = Object.fromEntries(names.filter(name => name in values).map(name => [name, values[name]]));
          callback?.(result); return Promise.resolve(result);
        },
        set(next, callback) { Object.assign(values, structuredClone(next)); persist(); callback?.(); return Promise.resolve(); },
        remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; persist(); callback?.(); return Promise.resolve(); }
      }, onChanged: { addListener() {} }
    },
    runtime: {
      getURL: path => new URL(path, location.origin+'/').href,
      sendMessage(message, callback) { listeners.forEach(fn => fn(message)); callback?.({success:true}); return Promise.resolve({success:true}); },
      onMessage: { addListener(fn) { listeners.push(fn); } }
    }
  };
  globalThis.Zotero = { ResearchFlow: {
    async loadDatabase() {
      if (!values.researchflow_db) values.researchflow_db = await fetch(new URL('data/preloaded_db.json', location.origin)).then(r => r.json());
      return structuredClone(values.researchflow_db);
    },
    async saveDatabase(data) {
      const snapshot = { ...structuredClone(data), revision: Number(values.researchflow_db?.revision || 0) + 1, lastUpdated: Date.now() };
      values.researchflow_db = snapshot;
      persist();
      window.postMessage({type:'RESEARCHFLOW_DATA_UPDATED',data:structuredClone(snapshot)}, '*');
      return structuredClone(snapshot);
    },
    async exportDatabaseFile() { globalThis.__qaNativeExportCount = (globalThis.__qaNativeExportCount || 0) + 1; return {success:true}; },
    getCollections: async () => [], getCurrentActiveItem: () => null
  } };
  globalThis.__zoteroMockValues = values;
  globalThis.close = () => {};
})();
