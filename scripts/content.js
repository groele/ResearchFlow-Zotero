/**
 * ResearchFlow Companion - submission portal assistant.
 *
 * The active runtime only offers reviewed submission capture on supported
 * journal portals. Retired article-cache and research-record entrypoints are
 * intentionally not started.
 */

// ─── 防重复注入保护（executeScript 可能被调用多次）───────────────────────────
// 用 window.__rf_injected 做标志；用 IIFE 包裹，避免 throw 产生未捕获异常
(function rfContentScriptMain() {
  if (window.__rf_injected) {
    // The assistant has already been initialized for this page.
    return;
  }
  window.__rf_injected = true;

function showPageToast(message, type = 'success') {
  let container = document.getElementById('rf-page-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'rf-page-toast-container';
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      font-family: 'Inter', -apple-system, sans-serif;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `rf-page-toast rf-toast-${type}`;
  toast.style.cssText = `
    padding: 12px 20px;
    background: rgba(19, 23, 34, 0.95);
    color: #f1f5f9;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(12px);
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  `;

  const colors = {
    success: '#10b981',
    info: '#06b6d4',
    warning: '#f59e0b',
    danger: '#ef4444'
  };

  const color = colors[type] || colors.success;

  toast.innerHTML = `
    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; box-shadow: 0 0 8px ${color}"></span>
    <span data-toast-message></span>
  `;

  toast.querySelector('[data-toast-message]').textContent = String(message || '');
  toast.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove toast after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 3500);
}

// ─── 投稿网站智能识别与快捷录入 ───────────────────────────────────────────────

const SUBMISSION_ASSIST_STORAGE_KEY = 'researchflow_submission_assist';
const SUBMISSION_ASSIST_SNOOZE_MS = 12 * 60 * 60 * 1000;

function extensionContextIsValid() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id) && Boolean(chrome.storage?.local);
}

function safeExtensionStorageGet(keys, fallback = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };
    const timeoutId = window.setTimeout(() => finish(fallback), 1500);
    if (!extensionContextIsValid()) {
      finish(fallback);
      return;
    }
    try {
      chrome.storage.local.get(keys, result => {
        if (chrome.runtime.lastError) {
          finish(fallback);
          return;
        }
        finish(result || fallback);
      });
    } catch {
      finish(fallback);
    }
  });
}

function safeExtensionStorageSet(payload) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };
    const timeoutId = window.setTimeout(() => finish(false), 1500);
    if (!extensionContextIsValid()) {
      finish(false);
      return;
    }
    try {
      chrome.storage.local.set(payload, () => finish(!chrome.runtime.lastError));
    } catch {
      finish(false);
    }
  });
}


function safeExtensionSendMessage(message, callback) {
  if (!extensionContextIsValid()) return false;
  try {
    chrome.runtime.sendMessage(message, response => callback(response, chrome.runtime.lastError));
    return true;
  } catch {
    return false;
  }
}

async function readSubmissionAssistState() {
  const result = await safeExtensionStorageGet([SUBMISSION_ASSIST_STORAGE_KEY]);
  const stored = result?.[SUBMISSION_ASSIST_STORAGE_KEY] || {};
  return {
    enabled: stored.enabled !== false,
    captureDetailsEnabled: stored.captureDetailsEnabled !== false,
    disabledOrigins: Array.isArray(stored.disabledOrigins) ? stored.disabledOrigins : [],
    snoozedUntil: stored.snoozedUntil && typeof stored.snoozedUntil === 'object'
      ? stored.snoozedUntil
      : {}
  };
}

async function updateSubmissionAssistState(mutator) {
  const state = await readSubmissionAssistState();
  const nextState = mutator(state) || state;
  await safeExtensionStorageSet({ [SUBMISSION_ASSIST_STORAGE_KEY]: nextState });
  return nextState;
}

function getMetaValue(names) {
  for (const name of names) {
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name;
    const node = document.querySelector(`meta[name="${escaped}"], meta[property="${escaped}"]`);
    const value = node?.getAttribute('content')?.replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return '';
}

function getFieldIdentity(field) {
  const label = field.labels?.[0]?.textContent || '';
  return [
    field.name,
    field.id,
    field.getAttribute('aria-label'),
    field.getAttribute('title'),
    field.getAttribute('placeholder'),
    label
  ].filter(Boolean).join(' ').replace(/[_-]+/g, ' ').toLowerCase();
}

function findSubmissionField(patterns, maxLength = 1000) {
  const fields = document.querySelectorAll('input, textarea, select');
  for (const field of fields) {
    const type = String(field.type || '').toLowerCase();
    if (['password', 'email', 'file', 'hidden'].includes(type)) continue;
    if (!patterns.some(pattern => pattern.test(getFieldIdentity(field)))) continue;
    const value = String(field.value || field.selectedOptions?.[0]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (value && value.length <= maxLength) return value;
  }

  const labels = document.querySelectorAll('th, dt, label, [class*="label"], [class*="field-name"]');
  for (const label of Array.from(labels).slice(0, 2500)) {
    const labelText = String(label.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!labelText || labelText.length > 120 || !patterns.some(pattern => pattern.test(labelText))) continue;
    const candidate = label.nextElementSibling || label.parentElement?.querySelector('td, dd, [class*="value"]');
    const value = String(candidate?.textContent || '').replace(/\s+/g, ' ').trim();
    if (value && value !== labelText && value.length <= maxLength) return value;
  }
  return '';
}

function collectSubmissionPageSignals() {
  const citationTitle = getMetaValue(['citation_title', 'dc.title']);
  const ogTitle = getMetaValue(['og:title']);
  const bodyText = String(document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 12000);
  return {
    journalName: findSubmissionField([
      /\bjournal(?:\s+name)?\b/, /\bpublication\b/, /期刊(?:名称)?/
    ], 160) || getMetaValue(['citation_journal_title', 'prism.publicationName']),
    manuscriptTitle: findSubmissionField([
      /\bmanuscript\s+title\b/, /\barticle\s+title\b/, /\bsubmission\s+title\b/,
      /\bpaper\s+title\b/, /稿件题目/, /文章标题/, /论文题目/
    ], 500) || citationTitle || (/submission|manuscript|editorial/i.test(ogTitle) ? '' : ogTitle),
    manuscriptId: findSubmissionField([
      /\bmanuscript\s+(?:id|number|no\.?)\b/, /\bsubmission\s+(?:id|number|no\.?)\b/,
      /\breference\s+(?:id|number|no\.?)\b/, /稿件(?:编号|号码)/, /投稿编号/
    ], 120),
    status: findSubmissionField([
      /\bmanuscript\s+status\b/, /\bsubmission\s+status\b/, /^status$/, /稿件状态/, /投稿状态/
    ], 160),
    submissionDate: findSubmissionField([
      /\bdate\s+submitted\b/, /\bsubmission\s+date\b/, /\bsubmitted\s+on\b/, /投稿日期/, /提交日期/
    ], 100),
    revisionDueDate: findSubmissionField([
      /\brevision\s+(?:due|deadline)\b/, /\bresponse\s+due\b/, /修回(?:期限|日期)/, /回复期限/
    ], 100),
    firstAuthor: findSubmissionField([
      /\bfirst\s+author\b/, /\blead\s+author\b/, /第一作者/, /首位作者/
    ], 160),
    authors: findSubmissionField([
      /\b(?:manuscript\s+)?authors?\b/, /作者(?:列表)?/
    ], 600) || getMetaValue(['citation_author']),
    abstract: findSubmissionField([
      /\babstract\b/, /摘要/
    ], 4000) || getMetaValue(['citation_abstract', 'dc.description']),
    keywords: findSubmissionField([
      /\bkey\s*words?\b/, /关键词/
    ], 500) || getMetaValue(['citation_keywords']),
    pageText: bodyText
  };
}

function buildCurrentSubmissionCapture() {
  const detector = window.RFJournalPortals;
  if (!detector) return null;
  const signals = collectSubmissionPageSignals();
  return detector.buildSubmissionCapture({
    url: window.location.href,
    title: document.title,
    signals
  });
}

function getSubmissionAssistCopy(captureDetailsEnabled = true) {
  const chinese = /^zh\b/i.test(navigator.language || '');
  return chinese
    ? {
        eyebrow: '检测到投稿系统',
        description: captureDetailsEnabled
          ? '一键采集页面中的稿件与流程信息，进入新建项目核对页。'
          : '详细信息捕获已关闭，仅带入期刊、入口和日期。',
        capture: captureDetailsEnabled ? '一键捕获信息' : '录入投稿',
        later: '稍后提醒',
        never: '不再提示此网站',
        opening: '正在采集并打开核对页…',
        confidence: '识别置信度',
        fields: '已识别 {count} 项信息',
        close: '关闭快捷提示'
      }
    : {
        eyebrow: 'Submission portal detected',
        description: captureDetailsEnabled
          ? 'Capture manuscript and workflow details into a new project review form.'
          : 'Detailed capture is off; only the journal, portal, and date will be carried over.',
        capture: captureDetailsEnabled ? 'Capture information' : 'Track submission',
        later: 'Remind me later',
        never: 'Do not show on this site',
        opening: 'Capturing and opening review…',
        confidence: 'Recognition confidence',
        fields: '{count} fields detected',
        close: 'Close quick entry'
      };
}

function renderSubmissionAssist(portal, captureDetailsEnabled = true) {
  if (document.getElementById('rf-submission-assist-host')) return;

  const copy = getSubmissionAssistCopy(captureDetailsEnabled);
  const host = document.createElement('div');
  host.id = 'rf-submission-assist-host';
  host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      * { box-sizing: border-box; }
      .rf-slip {
        position: relative;
        width: min(344px, calc(100vw - 28px));
        overflow: hidden;
        color: #1f2a33;
        background:
          linear-gradient(135deg, rgba(216, 91, 52, .055) 0 1px, transparent 1px 12px),
          #fffdf8;
        border: 1px solid rgba(31, 42, 51, .16);
        border-radius: 16px 16px 16px 5px;
        box-shadow: 0 24px 60px rgba(15, 27, 38, .22), 0 4px 14px rgba(15, 27, 38, .10);
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        transform: translateY(18px) scale(.98);
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
        animation: rf-slip-in .42s cubic-bezier(.2, .8, .2, 1) forwards;
      }
      .rf-slip::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 5px;
        background: #d85b34;
      }
      .rf-main { padding: 17px 17px 13px 21px; }
      .rf-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      .rf-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin: 0 0 8px;
        color: #2f6f5e;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .rf-pulse {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #2f8b70;
        box-shadow: 0 0 0 4px rgba(47, 139, 112, .12);
      }
      h2 {
        margin: 0;
        max-width: 260px;
        color: #17232d;
        font-family: Georgia, "Songti SC", serif;
        font-size: 19px;
        font-weight: 700;
        line-height: 1.22;
        letter-spacing: -.015em;
      }
      .rf-close {
        flex: 0 0 auto;
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        margin: -5px -5px 0 0;
        padding: 0;
        color: #6b747b;
        background: transparent;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }
      .rf-close:hover, .rf-close:focus-visible { color: #17232d; background: rgba(31, 42, 51, .07); }
      .rf-platform {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 9px;
        color: #68737c;
        font-size: 12px;
      }
      .rf-platform strong { color: #47535c; font-weight: 700; }
      .rf-domain {
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rf-description { margin: 11px 0 0; color: #53606a; font-size: 12px; line-height: 1.5; }
      .rf-confidence {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        color: #5f6c75;
        font-size: 11px;
      }
      .rf-confidence-meter {
        flex: 1;
        height: 5px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(31, 42, 51, .09);
      }
      .rf-confidence-meter span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2f8b70, #77b69f);
      }
      .rf-fields {
        flex: 0 0 auto;
        color: #2f6f5e;
        font-weight: 700;
      }
      .rf-actions { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 14px; }
      button { font: inherit; }
      .rf-primary, .rf-secondary {
        min-height: 36px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 750;
      }
      .rf-primary {
        color: #fffaf4;
        background: #d85b34;
        border: 1px solid #c94d28;
        box-shadow: 0 7px 18px rgba(216, 91, 52, .23);
      }
      .rf-primary:hover { background: #c94d28; transform: translateY(-1px); }
      .rf-primary:disabled { opacity: .72; cursor: wait; transform: none; }
      .rf-secondary {
        padding: 0 14px;
        color: #34434d;
        background: rgba(255, 255, 255, .7);
        border: 1px solid rgba(31, 42, 51, .17);
      }
      .rf-secondary:hover { background: #fff; border-color: rgba(31, 42, 51, .3); }
      .rf-never {
        display: block;
        margin: 8px auto 0;
        padding: 2px 5px;
        color: #7a8389;
        background: transparent;
        border: 0;
        cursor: pointer;
        font-size: 11px;
        text-decoration: underline;
        text-decoration-color: rgba(122, 131, 137, .42);
        text-underline-offset: 3px;
      }
      .rf-never:hover { color: #37434c; }
      @keyframes rf-slip-in {
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      @media (max-width: 520px) {
        .rf-slip { width: calc(100vw - 24px); }
        h2 { font-size: 18px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rf-slip { animation: none; transform: none; opacity: 1; }
        .rf-primary:hover { transform: none; }
      }
    </style>
    <aside class="rf-slip" role="dialog" aria-modal="false" aria-live="polite" aria-labelledby="rf-assist-title">
      <div class="rf-main">
        <div class="rf-topline">
          <div>
            <p class="rf-eyebrow"><span class="rf-pulse"></span><span id="rf-assist-eyebrow"></span></p>
            <h2 id="rf-assist-title"></h2>
          </div>
          <button class="rf-close" type="button" aria-label="${copy.close}">×</button>
        </div>
        <div class="rf-platform">
          <strong id="rf-assist-platform"></strong>
          <span aria-hidden="true">·</span>
          <span class="rf-domain" id="rf-assist-domain"></span>
        </div>
        <p class="rf-description" id="rf-assist-description"></p>
        <div class="rf-confidence">
          <span id="rf-assist-confidence"></span>
          <span class="rf-confidence-meter" aria-hidden="true"><span id="rf-assist-confidence-bar"></span></span>
          <span class="rf-fields" id="rf-assist-fields"></span>
        </div>
        <div class="rf-actions">
          <button class="rf-primary" type="button"></button>
          <button class="rf-secondary" type="button"></button>
        </div>
        <button class="rf-never" type="button"></button>
      </div>
    </aside>
  `;

  shadow.getElementById('rf-assist-eyebrow').textContent = copy.eyebrow;
  shadow.getElementById('rf-assist-title').textContent = portal.journalName;
  shadow.getElementById('rf-assist-platform').textContent = portal.platformName;
  shadow.getElementById('rf-assist-domain').textContent = portal.hostname;
  shadow.getElementById('rf-assist-description').textContent = copy.description;
  shadow.getElementById('rf-assist-confidence').textContent = `${copy.confidence} ${portal.confidenceScore}%`;
  shadow.getElementById('rf-assist-confidence-bar').style.width = `${portal.confidenceScore}%`;
  shadow.getElementById('rf-assist-fields').textContent = copy.fields.replace('{count}', portal.detectedFieldCount);

  const card = shadow.querySelector('.rf-slip');
  const closeButton = shadow.querySelector('.rf-close');
  const captureButton = shadow.querySelector('.rf-primary');
  const laterButton = shadow.querySelector('.rf-secondary');
  const neverButton = shadow.querySelector('.rf-never');
  captureButton.textContent = copy.capture;
  laterButton.textContent = copy.later;
  neverButton.textContent = copy.never;

  const removeCard = () => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(12px) scale(.98)';
    window.setTimeout(() => host.remove(), 180);
  };

  const snooze = async () => {
    await updateSubmissionAssistState(state => {
      state.snoozedUntil[portal.origin] = Date.now() + SUBMISSION_ASSIST_SNOOZE_MS;
      return state;
    });
    removeCard();
  };

  closeButton.addEventListener('click', snooze);
  laterButton.addEventListener('click', snooze);
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      snooze();
    }
  });
  neverButton.addEventListener('click', async () => {
    await updateSubmissionAssistState(state => {
      if (!state.disabledOrigins.includes(portal.origin)) {
        state.disabledOrigins.push(portal.origin);
      }
      delete state.snoozedUntil[portal.origin];
      return state;
    });
    removeCard();
  });

  captureButton.addEventListener('click', () => {
    const currentCapture = captureDetailsEnabled
      ? (buildCurrentSubmissionCapture() || portal)
      : portal;
    captureButton.disabled = true;
    captureButton.textContent = copy.opening;
    const sent = safeExtensionSendMessage({
      action: 'OPEN_SUBMISSION_CAPTURE',
      capture: currentCapture
    }, (response, runtimeError) => {
      if (!sent) {
        captureButton.disabled = false;
        captureButton.textContent = copy.capture;
        removeCard();
        return;
      }
      if (runtimeError || !response?.success) {
        captureButton.disabled = false;
        captureButton.textContent = copy.capture;
        showPageToast(response?.error || runtimeError?.message || 'Unable to open ResearchFlow.', 'danger');
        return;
      }
      updateSubmissionAssistState(state => {
        state.snoozedUntil[portal.origin] = Date.now() + SUBMISSION_ASSIST_SNOOZE_MS;
        return state;
      }).finally(removeCard);
    });
  });

  document.documentElement.appendChild(host);
}

async function maybeOfferSubmissionCapture() {
  if (!window.RFJournalPortals || document.getElementById('rf-submission-assist-host')) return;

  const state = await readSubmissionAssistState();
  if (!state.enabled) return;
  const portal = state.captureDetailsEnabled
    ? buildCurrentSubmissionCapture()
    : window.RFJournalPortals.buildSubmissionCapture({
        url: window.location.href,
        title: document.title,
        signals: {}
      });
  if (!portal) return;
  if (state.disabledOrigins.includes(portal.origin)) return;
  if (Number(state.snoozedUntil[portal.origin] || 0) > Date.now()) return;

  renderSubmissionAssist(portal, state.captureDetailsEnabled);
}

function scheduleSubmissionAssist() {
  if (window.__rf_submission_assist_scheduled) return;
  window.__rf_submission_assist_scheduled = true;
  [0, 1200, 3500].forEach(delay => {
    window.setTimeout(() => {
      maybeOfferSubmissionCapture().catch(() => {});
    }, delay);
  });
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

function scrapeAcademicMetadata() {
  const url = window.location.href;
  const meta = {
    title:     document.title,
    doi:       '',
    authors:   [],
    abstract:  '',
    pdfUrl:    '',
    journal:   '',
    sourceUrl: url,
    pubDate:   '',
    siteType:  'generic'
  };

  // ── 层1: 标准 Meta 标签 (Dublin Core / Highwire Press) ──
  extractMetaTags(meta);

  // ── 层2: 平台专属解析器 ──
  const siteType = detectSiteType(url);
  meta.siteType = siteType;
  PLATFORM_SCRAPERS[siteType]?.(meta);

  // ── 层3: 通用启发式PDF链接检测 (当前两层均未找到PDF URL时触发) ──
  if (!meta.pdfUrl) {
    meta.pdfUrl = findPdfLinkHeuristic();
  }

  // ── 层3b: 通用DOI检测 (meta标签和专属解析器均未找到DOI时触发) ──
  if (!meta.doi) {
    meta.doi = findDoiOnPage();
  }

  // ── DOI 清理 ──
  if (meta.doi) {
    meta.doi = meta.doi
      .replace(/^doi:\s*/i, '')
      .replace(/^https?:\/\/doi\.org\//i, '')
      .replace(/[.,;)\s]+$/, '')
      .trim();
  }

  // ── 字符串清理 ──
  meta.title    = cleanString(meta.title);
  meta.abstract = cleanString(meta.abstract);

  return meta;
}

// ─── 平台识别 ────────────────────────────────────────────────────────────────

function detectSiteType(url) {
  if (url.includes('arxiv.org'))                                        return 'arxiv';
  if (url.includes('biorxiv.org') || url.includes('medrxiv.org'))      return 'biorxiv';
  if (url.includes('pubmed.ncbi.nlm.nih.gov'))                         return 'pubmed';
  if (url.includes('pmc.ncbi.nlm.nih.gov'))                            return 'pmc';
  if (url.includes('nature.com'))                                       return 'nature';
  if (url.includes('ieeexplore.ieee.org'))                              return 'ieee';
  if (url.includes('link.springer.com') || url.includes('springer.com')) return 'springer';
  if (url.includes('sciencedirect.com') || url.includes('elsevier.com')) return 'sciencedirect';
  if (url.includes('dl.acm.org'))                                       return 'acm';
  if (url.includes('onlinelibrary.wiley.com') || url.includes('wiley.com')) return 'wiley';
  if (url.includes('journals.plos.org') || url.includes('plosone.org')) return 'plos';
  if (url.includes('ssrn.com'))                                         return 'ssrn';
  if (url.includes('researchgate.net'))                                 return 'researchgate';
  if (url.includes('semanticscholar.org'))                              return 'semanticscholar';
  if (url.includes('scholar.google.com'))                               return 'scholar';
  if (url.includes('overleaf.com'))                                     return 'overleaf';
  if (url.includes('science.org') || url.includes('sciencemag.org'))   return 'science';
  if (url.includes('cell.com'))                                         return 'cell';
  if (url.includes('aps.org') || url.includes('journals.aps.org'))     return 'aps';
  if (url.includes('tandfonline.com'))                                  return 'tandfonline';
  return 'generic';
}

// ─── 平台专属解析器注册表 ────────────────────────────────────────────────────

const PLATFORM_SCRAPERS = {

  arxiv(meta) {
    meta.journal = 'arXiv';
    // 标题
    const titleEl = document.querySelector('h1.title, h1.arxiv-title');
    if (titleEl) meta.title = titleEl.textContent.replace(/^title:\s*/i, '').trim();
    // 作者
    const authorEls = document.querySelectorAll('.authors a, .arxiv-authors a');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('blockquote.abstract');
    if (absEl) meta.abstract = absEl.textContent.replace(/^abstract:\s*/i, '').trim();
    // PDF URL — 优先读取页面链接，否则构造
    const pdfLink = document.querySelector(
      'a.download-pdf, .extra-services .full-text a[href*="/pdf"], a[href*="arxiv.org/pdf"]'
    );
    if (pdfLink) {
      meta.pdfUrl = pdfLink.href;
    } else {
      const m = window.location.href.match(/(?:abs|html)\/([^?#]+)/);
      if (m) meta.pdfUrl = `https://arxiv.org/pdf/${m[1]}.pdf`;
    }
    // DOI (arXiv论文DOI格式: 10.48550/arXiv.xxxx.xxxxx)
    if (!meta.doi) {
      const m = window.location.href.match(/abs\/(\d{4}\.\d{4,5}(?:v\d+)?)/);
      if (m) meta.doi = `10.48550/arXiv.${m[1]}`;
    }
    // 发表日期
    const dateEl = document.querySelector('.dateline, .submission-history');
    if (dateEl) meta.pubDate = dateEl.textContent.replace(/\s+/g, ' ').trim().substring(0, 60);
  },

  biorxiv(meta) {
    meta.journal = window.location.href.includes('medrxiv.org') ? 'medRxiv' : 'bioRxiv';
    // 摘要
    const absEl = document.querySelector('.section.abstract p, #abstract p, .abstract-content p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF (meta citation_pdf_url 通常已涵盖; 备用选择器)
    if (!meta.pdfUrl) {
      const pdfEl = document.querySelector('a.article-dl-pdf-link, a[href$=".full.pdf"], a[href*="/full.pdf"]');
      if (pdfEl) meta.pdfUrl = pdfEl.href;
    }
    // 日期
    const dateEl = document.querySelector('.pub-date, .article-date');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.textContent.trim();
  },

  pubmed(meta) {
    meta.journal = document.querySelector('.journal-actions-trigger')?.textContent?.trim() || meta.journal;
    // 标题
    const titleEl = document.querySelector('h1.heading-title, .article-details h1');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.authors-list-item .full-name, .authors .author-list-item button');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('#eng-abstract, .abstract-content, #abstract .abstract-content');
    if (absEl) meta.abstract = absEl.textContent.replace(/\s+/g, ' ').trim();
    // DOI
    const doiEl = document.querySelector('.citation-doi, a[data-ga-category="full-text-links"][href*="doi.org"]');
    if (doiEl && !meta.doi) meta.doi = (doiEl.textContent || doiEl.href || '').trim();
    // PDF/Full text link — PubMed本身无PDF，指向期刊
    const ftLink = document.querySelector('.full-text-links-list a, a[data-ga-category="full-text-links"]');
    if (ftLink && !meta.pdfUrl) meta.pdfUrl = ftLink.href;
    // 日期
    const dateEl = document.querySelector('.cit, span.citation-year');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.textContent.trim().substring(0, 20);
  },

  pmc(meta) {
    meta.journal = document.querySelector('.fm-jrnl, .jrnl')?.textContent?.trim() || meta.journal;
    const absEl = document.querySelector('#abstract p, .abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PMC 提供免费PDF
    const pdfEl = document.querySelector('a[href*="pdf"], a.pdf-link, .pdf-link a');
    if (pdfEl && !meta.pdfUrl) meta.pdfUrl = pdfEl.href;
  },

  nature(meta) {
    meta.journal = document.querySelector('.c-article-info-details [data-test="journal-title"], .app-article-masthead__journal a')?.textContent?.trim() || 'Nature';
    // 标题
    const titleEl = document.querySelector('h1.c-article-title, h1[data-article-title]');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('li.c-article-author-list__item a, .c-article-author-list a');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('#Abs1-content p, section[data-title="Abstract"] p, .c-article-section__content p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a[data-article-pdf], a.c-article-item__pdf-button, a[href*="/articles/"][href$=".pdf"], ' +
      'a.c-pdf-download__link, [data-track-action="download pdf"] a, a[data-track-action="download pdf"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a[data-track-action="view doi"], .c-article-info-details a[href*="doi.org"]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
    // 日期
    const dateEl = document.querySelector('time[itemprop="datePublished"], .c-article-info-details time');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
  },

  ieee(meta) {
    meta.journal = document.querySelector('.stats-document-abstract-publishedIn a, .publication-title')?.textContent?.trim() || 'IEEE';
    // IEEE使用React渲染，数据可能在 script 标签中
    // 优先从页面JSON-LD提取
    const ldJson = extractJsonLd();
    if (ldJson) {
      if (ldJson.name && !meta.title)              meta.title    = ldJson.name;
      if (ldJson.description && !meta.abstract)    meta.abstract = ldJson.description;
      if (ldJson.author && !meta.authors?.length) {
        meta.authors = Array.isArray(ldJson.author)
          ? ldJson.author.map(a => a.name || a).filter(Boolean)
          : [ldJson.author];
      }
    }
    // 标题备用
    const titleEl = document.querySelector('h1.document-title span, h1.title, .document-title');
    if (titleEl && !meta.title) meta.title = titleEl.textContent.trim();
    // 摘要
    const absEl = document.querySelector('.abstract-text .u-mb-1, div.abstract-text');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.replace(/^abstract:\s*/i, '').trim();
    // PDF — IEEE有直接PDF按钮
    const pdfEl = document.querySelector(
      'a.pdf-btn-link, a[href*="/stamp/stamp.jsp"], a[href*="ieeexplore.ieee.org"][href*=".pdf"], ' +
      '.pdf-btn a, button.xpl-btn-pdf + a, a[aria-label*="PDF"]'
    );
    if (pdfEl) {
      // stamp.jsp链接需要转换
      let href = pdfEl.href || '';
      if (href.includes('stamp/stamp.jsp') && href.includes('arnumber=')) {
        const arnMatch = href.match(/arnumber=(\d+)/);
        if (arnMatch) href = `https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=${arnMatch[1]}`;
      }
      meta.pdfUrl = href;
    }
    // 日期
    const dateEl = document.querySelector('.doc-abstract-pubdate, .u-pb-1.doc-abstract-pubdate');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.textContent.trim();
  },

  springer(meta) {
    meta.journal = document.querySelector('.app-article-masthead__journal a, .ArticleContext__journalTitle a, #journal-title')?.textContent?.trim() || 'Springer';
    // 标题
    const titleEl = document.querySelector('h1.ArticleTitle, h1.c-article-title, h1[data-test="article-title"]');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.authors__list .authors__name, a.c-article-author-list__item');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('#Abs1-content p, section#Abs1 p, .AbstractSection p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a.c-pdf-download__link, a[data-track-action="Book PDF"], a[href*=".pdf"][data-track-action], ' +
      'a.pdf-download-btn, a[data-test="pdf-link"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a[href*="doi.org/10."], .c-bibliographic-information__value a[href*="doi.org"]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
    // 日期
    const dateEl = document.querySelector('time[itemprop="datePublished"], .c-article-info-details time');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
  },

  sciencedirect(meta) {
    meta.journal = document.querySelector('.publication-title-link, .js-publication-title')?.textContent?.trim() || 'Elsevier';
    // ScienceDirect大量使用React，优先JSON-LD
    const ldJson = extractJsonLd();
    if (ldJson) {
      if (ldJson.name && !meta.title)           meta.title    = ldJson.name;
      if (ldJson.description && !meta.abstract) meta.abstract = ldJson.description;
    }
    // 标题备用
    const titleEl = document.querySelector('h1.title-text, span.title-text, h1[class*="ArticleTitle"]');
    if (titleEl && !meta.title) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.author-name span.given-name, .authors-group .author');
    if (authorEls.length > 0 && !meta.authors?.length) {
      meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    }
    // 摘要
    const absEl = document.querySelector('.abstract.author p, div.abstract p, #abstracts p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a.pdf-download, a[href*="pdfft"], button[data-aa-button="PDF download"], ' +
      'a[class*="download-pdf"], a[href*="/pii/"][href*="pdf"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a.anchor.doi, a[href*="doi.org/10."]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
  },

  acm(meta) {
    meta.journal = document.querySelector('.epub-section__title, .issue-item__detail a')?.textContent?.trim() || 'ACM';
    // 标题
    const titleEl = document.querySelector('h1.citation__title, .citation__title');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.author-name, .loa a[title]');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => (el.getAttribute('title') || el.textContent).trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('.abstractSection p, section#abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector('a.btn--pdf, a[href*="/doi/pdf/"], a[href$=".pdf"][class*="pdf"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a[href*="doi.org/10."]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
    // 日期
    const dateEl = document.querySelector('.issue-item__detail .dot-separator');
    if (dateEl && !meta.pubDate) meta.pubDate = dateEl.textContent.trim();
  },

  wiley(meta) {
    meta.journal = document.querySelector('.journal-banner-title, .productTitle a, .journal-title')?.textContent?.trim() || 'Wiley';
    // 标题
    const titleEl = document.querySelector('h1.citation__title, h1[class*="article-title"]');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.loa-authors .accordion-tabbed__tab-mobile a, .author-name');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('section.article-section.article-section__abstract p, .article-section__content p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a.article-support-text[href*="pdf"], a[href*="epdf"], a.pdf-download, ' +
      'a[data-track="PDF download"], a[class*="pdf-download"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a[href*="doi.org/10."]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
  },

  plos(meta) {
    meta.journal = document.querySelector('#breadcrumb li:nth-child(2) a, .journal-name')?.textContent?.trim() || 'PLOS';
    // 摘要
    const absEl = document.querySelector('.abstract-content p, #artText .abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a[data-interactable-type="download-pdf"], a.btn-pdf, a[href*="type=printable"], ' +
      'a[id*="downloadPdf"], a[href*="/article/file"][href*="type=printable"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // 构造PDF URL (PLOS有固定格式)
    if (!meta.pdfUrl && meta.doi) {
      meta.pdfUrl = `https://journals.plos.org/plosone/article/file?id=${encodeURIComponent(meta.doi)}&type=printable`;
    }
  },

  ssrn(meta) {
    meta.journal = 'SSRN';
    // 标题
    const titleEl = document.querySelector('h1[itemprop="name"], .paper-title h1');
    if (titleEl) meta.title = titleEl.textContent.trim();
    // 作者
    const authorEls = document.querySelectorAll('.authors a[href*="author="], .author-name');
    if (authorEls.length > 0) meta.authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);
    // 摘要
    const absEl = document.querySelector('.abstract-text p, [class*="abstract"] p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector('a.abstractDownloadLink[href*="pdf"], a[href*="delivery.php"], a.ssrn-link[href*="pdf"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    // DOI
    const doiEl = document.querySelector('a[href*="doi.org/10."]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
  },

  researchgate(meta) {
    meta.journal = 'ResearchGate';
    // ResearchGate 重度JavaScript渲染，尝试从meta和JSON-LD提取
    const ldJson = extractJsonLd();
    if (ldJson) {
      if (ldJson.name && !meta.title)           meta.title    = ldJson.name;
      if (ldJson.description && !meta.abstract) meta.abstract = ldJson.description;
    }
    // 标题备用
    const titleEl = document.querySelector('[class*="research-detail-header-section"] h1');
    if (titleEl && !meta.title) meta.title = titleEl.textContent.trim();
    // PDF
    const pdfEl = document.querySelector(
      'a[data-testid="pdf-link"], a[class*="download"][href*="pdf"], ' +
      'a[href*="/publication/"][href*="/fulltext/"]'
    );
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  semanticscholar(meta) {
    meta.journal = 'Semantic Scholar';
    const titleEl = document.querySelector('h1[data-test-id="paper-detail-title"], h1.paper-detail-title');
    if (titleEl) meta.title = titleEl.textContent.trim();
    const absEl = document.querySelector('[data-test-id="paper-abstract"] p, .abstract__text');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    // PDF via Open Access
    const pdfEl = document.querySelector('a[data-heap-id*="pdf"], a[href*="pdf"][class*="flex-row"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  scholar(meta) {
    meta.journal = meta.journal || 'Google Scholar';
    // Google Scholar结果页面 — 仅尝试提取标题/PDF链接
    const titleEl = document.querySelector('#gs_res_ccl_mid .gs_rt a, h3.gs_rt a');
    if (titleEl) { meta.title = titleEl.textContent.trim(); meta.pdfUrl = titleEl.href; }
    const pdfEl = document.querySelector('.gs_or_ggsm a[href*=".pdf"], a.gs_ggs a');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  science(meta) {
    meta.journal = document.querySelector('.journal-banner span, .core-self-citation .title')?.textContent?.trim() || 'Science';
    const absEl = document.querySelector('.section.abstract p, #abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    const pdfEl = document.querySelector('a[href*="/doi/pdf/"], a.c-pdf-download__link, a[data-article-pdf]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  cell(meta) {
    meta.journal = document.querySelector('.journal-title, .publication-title')?.textContent?.trim() || 'Cell Press';
    const absEl = document.querySelector('.abstract p, #abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    const pdfEl = document.querySelector('a.pdf-download, a[href*="/pdf"], a[class*="pdf"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  aps(meta) {
    meta.journal = document.querySelector('.pub-name, .journal-name')?.textContent?.trim() || 'APS';
    const absEl = document.querySelector('#abstract p, .abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    const pdfEl = document.querySelector('a[href*=".pdf"][class*="download"], a[href*="PhysRev"][href*=".pdf"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
  },

  tandfonline(meta) {
    meta.journal = document.querySelector('.journal-heading a, #journalInfoTitle')?.textContent?.trim() || 'T&F Online';
    const absEl = document.querySelector('.abstractSection p, .NLM_abstract p');
    if (absEl && !meta.abstract) meta.abstract = absEl.textContent.trim();
    const pdfEl = document.querySelector('a[href*="/doi/pdf/"], a.pdf-download, a[data-track="PDF download"]');
    if (pdfEl) meta.pdfUrl = pdfEl.href;
    const doiEl = document.querySelector('a[href*="doi.org/10."]');
    if (doiEl && !meta.doi) meta.doi = doiEl.href;
  },

  overleaf(meta) {
    const nameEl = document.querySelector('.project-name, [data-testid="project-name"]');
    if (nameEl) meta.title = nameEl.textContent.trim();
  },

  generic(meta) {
    // 通用解析: 尝试 JSON-LD 提取
    const ldJson = extractJsonLd();
    if (ldJson) {
      if (ldJson.headline && !meta.title)        meta.title    = ldJson.headline;
      if (ldJson.name && !meta.title)            meta.title    = ldJson.name;
      if (ldJson.description && !meta.abstract)  meta.abstract = ldJson.description;
      if (ldJson.author && !meta.authors?.length) {
        const authors = Array.isArray(ldJson.author) ? ldJson.author : [ldJson.author];
        meta.authors = authors.map(a => (typeof a === 'object' ? a.name : a)).filter(Boolean);
      }
    }
  }
};

// ─── 层1: 标准 Meta 标签提取 ─────────────────────────────────────────────────

function extractMetaTags(meta) {
  const getMetaContent = (names) => {
    for (const name of names) {
      const byName = document.querySelector(`meta[name="${name}"]`);
      if (byName?.content) return byName.content;
      const byProp = document.querySelector(`meta[property="${name}"]`);
      if (byProp?.content) return byProp.content;
    }
    return '';
  };

  // 批量作者标签
  const authorTags = document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"], meta[name="author"]');
  const authorArr = [];
  authorTags.forEach(tag => {
    const v = tag.getAttribute('content');
    if (v && !authorArr.includes(v)) authorArr.push(v);
  });

  meta.title   = getMetaContent(['citation_title', 'dc.title', 'og:title', 'twitter:title']) || meta.title;
  meta.doi     = getMetaContent(['citation_doi', 'dc.identifier', 'dc.identifier.doi', 'prism.doi']) || meta.doi;
  meta.authors = authorArr.length > 0 ? authorArr : meta.authors;
  meta.abstract= getMetaContent(['citation_abstract', 'dc.description', 'description', 'og:description']) || meta.abstract;
  meta.pdfUrl  = getMetaContent(['citation_pdf_url']) || meta.pdfUrl;
  meta.journal = getMetaContent(['citation_journal_title', 'dc.relation.journal', 'citation_conference_title', 'prism.publicationName']) || meta.journal;
  meta.pubDate = getMetaContent(['citation_publication_date', 'citation_date', 'dc.date', 'prism.publicationDate']) || meta.pubDate;
}

// ─── 层2辅助: JSON-LD 结构化数据提取 ────────────────────────────────────────

function extractJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      // 支持直接对象或数组
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        // 匹配ScholarlyArticle, Article, BlogPosting
        if (item['@type'] && /Article|ScholarlyArticle|BlogPosting/i.test(item['@type'])) {
          return item;
        }
      }
      // 如果没有匹配类型，返回第一个有 name/headline 的对象
      for (const item of items) {
        if (item.name || item.headline) return item;
      }
    } catch (_) { /* JSON parse error, skip */ }
  }
  return null;
}

// ─── 层3: 通用启发式 PDF 链接检测 ───────────────────────────────────────────

function findPdfLinkHeuristic() {
  // 对页面上所有链接评分，取得分最高的
  const candidates = [];
  const allLinks = document.querySelectorAll('a[href]');

  for (const link of allLinks) {
    const href = link.href || '';
    const text = (link.textContent || '').toLowerCase().trim();
    const title = (link.getAttribute('title') || '').toLowerCase();
    const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
    const cls = (link.className || '').toLowerCase();

    // 跳过无效链接
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href === '#') continue;
    // 跳过导航/社交链接
    if (/twitter|facebook|linkedin|youtube|reddit|github|mailto|login|register|signup|subscribe/i.test(href)) continue;

    let score = 0;

    // 高置信度指标
    if (/\.pdf($|\?)/i.test(href))                            score += 40;
    if (/\/pdf\//i.test(href))                                score += 25;
    if (/\/pdf$/i.test(href))                                 score += 25;
    if (/download.*pdf|pdf.*download/i.test(href))            score += 20;
    if (/fulltext|full.text|full_text/i.test(href))           score += 15;
    if (/pdfft|epdf|stamp\/stamp/i.test(href))                score += 30;
    if (/\/doi\/pdf\//i.test(href))                           score += 35;
    if (/type=printable/i.test(href))                         score += 20;

    // 文本/标签指标
    if (/\bpdf\b/i.test(text))                                score += 20;
    if (/download.*pdf|pdf.*download/i.test(text))            score += 25;
    if (/full.?text/i.test(text))                             score += 10;
    if (/\bpdf\b/i.test(title) || /\bpdf\b/i.test(ariaLabel)) score += 15;

    // CSS类名指标
    if (/pdf/i.test(cls))                                     score += 15;
    if (/download/i.test(cls))                                score += 5;

    if (score >= 20) candidates.push({ href, score });
  }

  if (candidates.length === 0) return '';
  // 返回得分最高的
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].href;
}

// ─── DOI 快速检测（优先级由高到低，避免全文扫描） ─────────────────────────

const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;

function findDoiOnPage() {
  const match = (str) => {
    if (!str) return '';
    const m = str.match(DOI_REGEX);
    return m ? m[1].replace(/[.,;)\s]+$/, '') : '';
  };

  // 1. URL中直接提取
  let doi = match(window.location.href);
  if (doi) return doi;

  // 2. 页面标题
  doi = match(document.title);
  if (doi) return doi;

  // 3. DOI链接 (a[href*="doi.org"])
  const doiLinks = document.querySelectorAll('a[href*="doi.org/10."]');
  for (const link of doiLinks) {
    doi = match(link.href);
    if (doi) return doi;
  }

  // 4. 常见DOI容器元素（精准选择器，快速）
  const doiSelectors = [
    '[data-doi]', '.doi', '.doi-link', '.citation-doi', '.article-doi',
    '.publication-doi', '#doi', 'span[class*="doi"]', 'p[class*="doi"]',
    'a[class*="doi"]', '[class*="article-info"] a[href*="10."]'
  ];
  for (const sel of doiSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      if (sel === '[data-doi]') {
        const attr = el.getAttribute('data-doi');
        if (attr) return attr;
      }
      doi = match(el.textContent);
      if (doi) return doi;
    }
  }

  // 5. 最终降级: 仅扫描页面前3000字符（比原来的30000减少90%）
  if (document.body) {
    const snippet = document.body.innerText?.substring(0, 3000) || '';
    doi = match(snippet);
    if (doi) return doi;
  }

  return '';
}

// ─── 通用工具函数 ─────────────────────────────────────────────────────────────

function cleanString(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

// ─── 主入口：只启动投稿网站识别 ─────────────────────────────────────────────
(function proactiveInit() {
  scheduleSubmissionAssist();
})();

// ─── IIFE 闭合 ───────────────────────────────────────────────────────────────
})(); // rfContentScriptMain IIFE 结束
