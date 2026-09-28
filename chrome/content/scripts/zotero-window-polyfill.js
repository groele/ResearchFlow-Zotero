window.process = window.process || { env: { NODE_ENV: 'production' } };
window.global = window.global || window;
try {
  const args = window.arguments && window.arguments[0];
  if (args?.Zotero) window.Zotero = args.Zotero;
  if (args?.options) window._researchflowPending = args.options;
} catch (_) {
  // Browser extension pages do not provide Zotero window arguments.
}
