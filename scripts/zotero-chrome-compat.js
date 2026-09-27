// Chrome APIs used by the shared workspace UI, backed by Zotero's own window.
// This file is injected only into the Zotero package, before storage.js.
(function () {
  if (typeof window === 'undefined' || window.location?.protocol !== 'chrome:' || window.location?.host !== 'researchflow') return;

  const listeners = new Set();
  const changeListeners = new Set();
  const prefix = 'researchflow.zotero.ui.';
  const emit = (message) => {
    for (const listener of listeners) {
      try { listener(message, {}, () => {}); } catch (error) { console.error('[ResearchFlow] UI listener failed:', error); }
    }
  };
  const keysOf = (keys) => Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : keys && typeof keys === 'object' ? Object.keys(keys) : [];
  const host = () => {
    try { return (window.Zotero || window.parent?.Zotero || window.arguments?.[0]?.Zotero)?.ResearchFlow; }
    catch (_) { return null; }
  };
  const read = (key) => {
    const value = window.localStorage.getItem(prefix + key);
    return value === null ? undefined : JSON.parse(value);
  };
  const readAll = async (keys = []) => {
    if (host()?.loadUiState) return host().loadUiState();
    const result = {};
    for (const key of keys) result[key] = read(key);
    return result;
  };
  const finish = (operation, callback) => {
    const result = Promise.resolve().then(operation);
    if (typeof callback !== 'function') return result;
    return result.then((value) => {
      callback(value);
      return value;
    }, (error) => {
      console.error('[ResearchFlow] Zotero compatibility operation failed:', error);
      globalThis.chrome.runtime.lastError = { message: String(error?.message || error) };
      try { callback(undefined); } finally { delete globalThis.chrome.runtime.lastError; }
      return undefined;
    });
  };
  const local = {
    get(keys, callback) {
      return finish(async () => {
        const stored = await readAll(keysOf(keys));
        const result = keys && !Array.isArray(keys) && typeof keys === 'object' ? { ...keys } : {};
        for (const key of keysOf(keys)) {
          const value = stored[key];
          if (value !== undefined) result[key] = value;
        }
        return result;
      }, callback);
    },
    set(values, callback) {
      return finish(async () => {
        const stored = await readAll(Object.keys(values || {}));
        const changes = {};
        for (const [key, value] of Object.entries(values || {})) {
          changes[key] = { oldValue: stored[key], newValue: value };
        }
        if (host()?.updateUiState) await host().updateUiState(values);
        else for (const [key, value] of Object.entries(values || {})) window.localStorage.setItem(prefix + key, JSON.stringify(value));
        for (const listener of changeListeners) listener(changes, 'local');
      }, callback);
    },
    remove(keys, callback) {
      return finish(async () => {
        const stored = await readAll(keysOf(keys));
        const changes = {};
        for (const key of keysOf(keys)) {
          changes[key] = { oldValue: stored[key], newValue: undefined };
        }
        if (host()?.updateUiState) await host().updateUiState({}, keysOf(keys));
        else for (const key of keysOf(keys)) window.localStorage.removeItem(prefix + key);
        for (const listener of changeListeners) listener(changes, 'local');
      }, callback);
    }
  };

  // Zotero is a privileged chrome window, but it is not a Chrome extension.
  // Keep its compatibility API local to this origin and never replace a real extension API.
  if (globalThis.chrome?.runtime?.id) return;
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: (listener) => listeners.add(listener), removeListener: (listener) => listeners.delete(listener) },
      getURL: (path) => `chrome://researchflow/content/${String(path || '').replace(/^\/+/, '')}`,
      sendMessage(message, callback) {
        const operation = async () => {
          if (message?.action === 'DATABASE_UPDATED' || message?.action === 'SYNC_STATE') {
            emit(message);
            return { success: true };
          }
          throw new Error(`Unsupported Zotero runtime request: ${message?.action || 'unknown'}`);
        };
        return finish(operation, callback);
      }
    },
    storage: {
      local,
      onChanged: { addListener: (listener) => changeListeners.add(listener), removeListener: (listener) => changeListeners.delete(listener) }
    }
  };
})();
