(() => {
  const values = globalThis.__RF_PRELOAD_STORAGE || {};
  const listeners = [];

  globalThis.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const names = Array.isArray(keys) ? keys : Object.keys(keys || {});
          const result = Object.fromEntries(
            names.filter(name => name in values).map(name => [name, values[name]])
          );
          callback?.(result);
          return Promise.resolve(result);
        },
        set(next, callback) {
          Object.assign(values, next);
          callback?.();
          return Promise.resolve();
        },
        remove(keys, callback) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
          callback?.();
          return Promise.resolve();
        }
      },
      onChanged: { addListener() {} }
    },
    runtime: {
      lastError: null,
      getURL(path) {
        return new URL(path, `${location.origin}/`).href;
      },
      sendMessage(message, callback) {
        let response = { success: true };
        if (message?.action === 'LOAD_DATABASE') {
          fetch(new URL('data/preloaded_db.json', location.origin)).then(r => r.json()).then(async data => {
            const normalized = await globalThis.storage.ensureDbShape(values.researchflow_db || data, { stamp: false });
            values.researchflow_db = normalized;
            callback?.({ success: true, data: normalized });
          });
          return Promise.resolve();
        } else if (message?.action === 'TRIGGER_SYNC') {
          response = { success: false, error: 'No provider configured' };
        } else if (message?.action === 'SAVE_DATABASE') {
          const nextDatabase = {
            ...(message.data || {}),
            revision: Number(message.data?.revision || 0) + 1,
            lastUpdated: Date.now(),
            updatedAt: new Date().toISOString()
          };
          values.researchflow_db = nextDatabase;
          response = { success: true, data: nextDatabase };
        }
        callback?.(response);
        return Promise.resolve(response);
      },
      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        }
      }
    },
    tabs: {
      async query() {
        return [];
      },
      async create() {
        return {};
      }
    }
  };

  globalThis.__chromeMockValues = values;
  globalThis.close = () => {};
})();
