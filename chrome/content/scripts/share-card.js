/* Locally rendered submission posters. Measurement and drawing share one layout. */
(function (root) {
  const FONT = '"Microsoft YaHei UI", "PingFang SC", "Segoe UI", sans-serif';
  const DISPLAY = 'Georgia, "Songti SC", "Microsoft YaHei", serif';
  const BRAND_FONT = '"Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif';
  const THEMES = {
    estuary: { background: '#b3cfd5', paper: '#e4f2ef', ink: '#153d4a', muted: '#456773', line: '#9fbdc4', accent: '#186d7c', wash: '#d4e8ea', gradient: ['#8fb6cc', '#b3d2c5'], paperGradient: ['#cee0f5', '#e4f2ef', '#b8dccc'] },
    iris: { background: '#b7b3d2', paper: '#eee5ef', ink: '#323354', muted: '#62617a', line: '#bdb2cf', accent: '#665397', wash: '#e0daec', gradient: ['#aab8d4', '#d3b5c7'], paperGradient: ['#cfdcf5', '#eee5ef', '#dec0d0'] },
    amber: { background: '#d6baaa', paper: '#f8ecdc', ink: '#49352e', muted: '#786055', line: '#ccb6a2', accent: '#92512c', wash: '#efdfc9', gradient: ['#d8b298', '#b4c4b0'], paperGradient: ['#efd0b5', '#f8ecdc', '#ceddcb'] },
    journal: { background: '#dce5ed', paper: '#fafbfc', ink: '#18344c', muted: '#536779', line: '#cbd7e0', accent: '#27628e', wash: '#e9f0f6', gradient: ['#cbddea', '#ebe7f1'], paperGradient: ['#ffffff', '#edf3f8'] },
    conference: { background: '#103e48', paper: '#f4fbfa', ink: '#133d44', muted: '#486e71', line: '#b9d7d6', accent: '#087c82', wash: '#dceeed', gradient: ['#174659', '#23786c'], paperGradient: ['#ffffff', '#e0f2ee'] },
    archive: { background: '#ddd6c8', paper: '#fffaf0', ink: '#383c34', muted: '#666c5e', line: '#d6d6c5', accent: '#607046', wash: '#efefe1', gradient: ['#e7dfcf', '#cbd7c8'], paperGradient: ['#fffdf6', '#f0f0e3'] },
    paper: { background: '#e9efed', paper: '#ffffff', ink: '#193039', muted: '#60767c', line: '#dce6e2', accent: '#167660', wash: '#f0f6f3' },
    blueprint: { background: '#e5edf8', paper: '#f9fbff', ink: '#183b63', muted: '#556f8e', line: '#cad8e9', accent: '#235fbc', wash: '#edf3fb' },
    minimal: { background: '#ffffff', paper: '#ffffff', ink: '#222222', muted: '#666666', line: '#e3e3e3', accent: '#292929', wash: '#f6f6f6' },
    ink: { background: '#07131b', paper: '#10232d', ink: '#eef6f2', muted: '#a0b7bd', line: '#304951', accent: '#8bd8bc', wash: '#192f39' },
    cyber: { background: '#050b17', paper: '#0b1426', ink: '#e9f7ff', muted: '#8ca6bf', line: '#27415e', accent: '#4de8ff', accent2: '#b26cff', wash: '#10233a', gradient: ['#071329', '#120a25'], paperGradient: ['#0d1a31', '#0a1223'], grid: true },
    aurora: { background: '#071421', paper: '#0e2030', ink: '#e6fff7', muted: '#86b8af', line: '#28574f', accent: '#63f5c7', accent2: '#8b7cff', wash: '#11382f', gradient: ['#071b2a', '#1c1030'], paperGradient: ['#102a38', '#0c1c2b'], grid: true },
    terminal: { background: '#06110b', paper: '#0a1d12', ink: '#d9ffe4', muted: '#79ad8a', line: '#245337', accent: '#8dff6a', accent2: '#e2ff58', wash: '#102b1a', gradient: ['#07180d', '#101b08'], paperGradient: ['#0d2517', '#09190f'], grid: true },
  };
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const glyphs = text => segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text);

  function wrapText(ctx, value, width, maxLines = Infinity) {
    const input = String(value || '').replace(/\s+/g, ' ').trim();
    if (!input) return [];
    const lines = [];
    let line = '';
    // Keep English words together, splitting overlong words and CJK text by grapheme.
    const tokens = input.match(/[^\s\u2e80-\u9fff]+\s*|[\u2e80-\u9fff]\s*/gu) || [input];
    for (const token of tokens) {
      if (ctx.measureText((line + token).trimEnd()).width <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trim()); line = ''; }
      if (ctx.measureText(token.trim()).width <= width) { line = token.trimStart(); continue; }
      for (const glyph of glyphs(token.trim())) {
        if (line && ctx.measureText(line + glyph).width > width) { lines.push(line); line = ''; }
        line += glyph;
      }
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length <= maxLines) return lines;
    const result = lines.slice(0, maxLines);
    const last = glyphs(result[result.length - 1]);
    while (last.length && ctx.measureText(last.join('') + '…').width > width) last.pop();
    result[result.length - 1] = last.join('').trimEnd() + '…';
    return result;
  }

  function buildLayout(ctx, model, preferences = {}) {
    const v = { title: true, journal: true, author: true, status: true, duration: true, dates: true, footer: true, ...preferences };
    const palette = THEMES[v.appearance] || THEMES.paper;
    const zh = model.language === 'zh';
    const minimal = ['minimal', 'journal', 'conference'].includes(v.appearance);
    const blueprint = ['blueprint', 'conference', 'archive'].includes(v.appearance);
    const cover = v.appearance === 'journal';
    const archive = v.appearance === 'archive';
    const tech = ['cyber', 'aurora', 'terminal'].includes(v.appearance);
    const width = 720;
    const brand = ({ compact: { scale: .84, name: 13, motto: 9.5 }, balanced: { scale: 1.06, name: 15, motto: 10.5 }, bold: { scale: 1.26, name: 17, motto: 11.5 } })[v.brandSize] || { scale: 1.06, name: 15, motto: 10.5 };
    const left = 48;
    const right = 672;
    const blocks = [];
    let masthead = true;
    if (cover) blocks.push({ kind: 'rect', x: 16, y: 16, width: 688, height: 12, color: palette.accent });
    if (v.appearance === 'conference') blocks.push({ kind: 'rect', x: 24, y: 40, width: 6, height: 190, color: palette.accent });
    if (tech) blocks.push({ kind: 'grid', color: palette.line, accent: palette.accent2 });
    const text = (role, value, x, y, maxWidth, size, weight = 400, color = palette.ink, maxLines = 1, display = false) => {
      // Reserve the masthead's right column for the brand seal, including long titles.
      if (v.footer && masthead) maxWidth = Math.min(maxWidth, 496 - x);
      const font = `${weight} ${size}px ${display ? DISPLAY : FONT}`;
      ctx.font = font;
      const lines = wrapText(ctx, value, maxWidth, maxLines);
      const lineHeight = Math.ceil(size * 1.36);
      lines.forEach((line, i) => blocks.push({ kind: 'text', role, text: line, x, y: y + i * lineHeight, width: maxWidth, height: lineHeight, font, color }));
      return lines.length * lineHeight;
    };
    const rule = y => blocks.push({ kind: 'line', x: left, y, x2: right, y2: y, color: palette.line });
    if (v.footer) {
      const center = 592;
      blocks.push({ kind: 'brand-seal', role: 'brand-seal', x: center, y: 86, scale: brand.scale, color: palette.accent, secondary: palette.accent2 || palette.muted });
      // Store actual centered bounds so drawing, wrapping and collision checks agree.
      const brandText = (role, value, top, size, weight, color) => {
        let font = `${weight} ${size}px ${BRAND_FONT}`;
        ctx.font = font;
        while (ctx.measureText(value).width > 144 && size > 7) {
          size -= .25; font = `${weight} ${size}px ${BRAND_FONT}`; ctx.font = font;
        }
        const width = ctx.measureText(value).width;
        blocks.push({kind: 'text', role, text: value, x: center - width / 2, y: top, width, height: Math.ceil(size * 1.4), font, color});
      };
      const wordmarkY = 86 + 36 * brand.scale + 10;
      brandText('brand-wordmark', 'ResearchFlow', wordmarkY, brand.name, 600, palette.ink);
      brandText('brand-motto', zh ? '探索 · 求证 · 记录' : 'Explore · Verify · Record', wordmarkY + Math.ceil(brand.name * 1.4) + 5, zh ? brand.motto : brand.motto - .5, 400, palette.muted);
    }
    const allEvents = Array.isArray(model.events) ? model.events : [];
    const events = allEvents.length > 64 ? [allEvents[0], ...allEvents.slice(-63)] : allEvents;
    const omitted = allEvents.length - events.length;
    let y = 48;
    blocks.push({ kind: 'rect', x: left, y: y + 2, width: 28, height: 4, color: palette.accent });
    text('eyebrow', zh ? '科研手记 / 投稿历程' : 'FIELD NOTES / SUBMISSION JOURNEY', left + 40, y - 5, 580, 13, 600, palette.muted);
    y += 47;
    if (minimal && v.title && model.title) {
      y += text('title', model.title, left, y, 624, cover ? 36 : 32, cover ? 400 : 600, palette.ink, 6, cover && !zh) + 24;
    }
    if (v.journal && model.journal) {
      // Choose typography from the journal text, not the workspace language.
      const latinJournal = !/[\u2e80-\u9fff]/u.test(model.journal);
      const shortJournal = glyphs(String(model.journal).trim()).length <= 18;
      const journalSize = minimal && v.title && model.title ? 28 : shortJournal ? 48 : 34;
      blocks.push({ kind: 'rect', role: 'journal-mark', x: left, y: y + 2, width: 3, height: 12, color: palette.accent });
      text('journal-label', zh ? '投稿期刊' : 'THE JOURNAL', left + 12, y, 600, 10, 600, palette.muted);
      y += 22;
      const journalHeight = text('journal', model.journal, left, y, 624, journalSize, latinJournal ? 400 : 600, palette.ink, 3, latinJournal && !tech);
      y += journalHeight + 10;
      blocks.push({ kind: 'rect', role: 'journal-underline', x: left, y, width: shortJournal ? 64 : 96, height: 2, color: palette.accent });
      y += 20;
    }
    if (!minimal && v.title && model.title) {
      y += text('title', model.title, left, y, 624, 27, 600, palette.ink, 6) + 20;
    }
    if (v.author && model.author) {
      y += text('author', `${zh ? '第一作者' : 'First author'}  /  ${model.author}`, left, y, 624, 15, 400, palette.muted, 2) + 16;
    }
    const brandBlocks = blocks.filter(b => ['brand-seal', 'brand-wordmark', 'brand-motto'].includes(b.role));
    const brandTop = 86 - 36 * brand.scale;
    const brandBottom = v.footer ? brandBlocks.at(-1).y + brandBlocks.at(-1).height : 0;
    const brandHeight = brandBottom - brandTop;
    const headerBottom = Math.max(y + 8, v.footer ? 72 + brandHeight + 24 : 0);
    if (v.footer) {
      // Balance the signature against the first headline, not the page's top edge.
      // Cap its travel on long titles and preserve clearance above the section rule.
      const headline = blocks.find(b => b.role === 'journal' || b.role === 'title');
      const target = headline ? headline.y + headline.height / 2 - 8 : 132;
      const top = Math.max(72, Math.min(target - brandHeight / 2, 112, headerBottom - 24 - brandHeight));
      brandBlocks.forEach(b => { b.y += top - brandTop; });
    }
    masthead = false;
    rule(headerBottom);
    y = headerBottom + 26;
    if (v.duration || v.status) {
      const both = v.duration && v.status;
      const columnWidth = both ? 294 : 624;
      let metricHeight = 0;
      const metricBackground = blueprint ? { kind: 'rect', x: left - 16, y: y - 12, width: 656, height: 156, color: palette.wash, radius: 8 } : null;
      if (metricBackground) blocks.push(metricBackground);
      if (v.duration) {
        text('duration-label', zh ? '历程天数' : 'DAYS IN THIS JOURNEY', left, y, columnWidth, 12, 600, palette.muted);
        const valid = Number.isFinite(model.duration) && model.duration >= 0;
        const number = valid ? String(model.duration) : '—';
        text('duration', number, left - 2, y + 22, columnWidth - 50, 60, 400, palette.accent, 1, true);
        ctx.font = `400 60px ${DISPLAY}`;
        if (valid) text('duration-unit', zh ? '天' : 'days', Math.min(left + ctx.measureText(number).width + 12, left + columnWidth - 48), y + 63, 48, 14, 500, palette.muted);
        const captionHeight = text('duration-caption', model.durationLabel || '', left, y + 108, columnWidth, 13, 400, palette.muted, 2);
        metricHeight = 108 + captionHeight;
      }
      if (v.status) {
        const x = both ? 378 : left;
        if (both) blocks.push({ kind: 'line', x: 350, y: y + 2, x2: 350, y2: y + 122, color: palette.line });
        text('status-label', zh ? '当前进展' : 'CURRENT CHAPTER', x, y, columnWidth, 12, 600, palette.muted);
        const statusHeight = text('status', model.status || '—', x, y + 37, columnWidth, 26, 600, palette.ink, 2);
        metricHeight = Math.max(metricHeight, 37 + statusHeight + 24);
      }
      if (metricBackground) metricBackground.height = metricHeight + 26;
      y += metricHeight + 26;
      rule(y);
      y += 32;
    }
    text('timeline-label', zh ? '一步一步，记录科研历程' : 'The journey, step by step.', left, y, 456, 21, 600);
    text('timeline-count', `${events.length} ${zh ? '个节点' : 'milestones'}`, 535, y + 5, 137, 13, 500, palette.muted);
    y += 52;
    const timelineStart = y;
    if (!events.length) {
      blocks.push({ kind: 'rect', x: left, y, width: 624, height: 108, color: palette.wash, radius: 12 });
      text('empty', zh ? '故事刚刚开始' : 'Every journey begins somewhere.', left + 24, y + 22, 576, 21, 600);
      text('empty-help', zh ? '添加带日期的节点后，即可生成时间线。' : 'Add a dated milestone to begin your timeline.', left + 24, y + 62, 576, 15, 400, palette.muted);
      y += 128;
    }
    const railX = v.dates ? 186 : 62;
    const contentX = railX + 30;
    const rowCenters = [];
    events.forEach((event, index) => {
      const rowBackground = archive ? { kind: 'rect', x: left - 12, y: y - 8, width: 648, height: 76, color: index % 2 === 0 ? palette.wash : palette.paper, radius: 4 } : null;
      if (rowBackground) blocks.push(rowBackground);
      if (omitted && index === 1) {
        text('omitted', zh ? `另有 ${omitted} 个节点未展示` : `${omitted} earlier milestones not shown`, contentX, y, right - contentX, 13, 500, palette.muted, 2);
        y += 48;
      }
      const nameHeight = text('event-name', event.name || (zh ? '未命名节点' : 'Untitled milestone'), contentX, y, right - contentX, minimal ? 18 : 20, 600, palette.ink, 2);
      const meta = [event.typeLabel, event.dateKindLabel].filter(Boolean).join(' · ');
      const metaHeight = text('event-meta', meta, contentX, y + nameHeight + 6, right - contentX, 12, 500, palette.muted, 2);
      const rowHeight = Math.max(minimal ? 64 : 76, nameHeight + metaHeight + (minimal ? 20 : 28));
      if (rowBackground) rowBackground.height = rowHeight - 8;
      if (v.dates) {
        text('event-date', event.dateLabel || '—', left, y + 1, 122, 17, 600, palette.ink, 2);
        text('event-year', event.yearLabel || '', left, y + 49, 122, 12, 400, palette.muted);
      }
      rowCenters.push(y + 12);
      blocks.push({ kind: 'node', x: railX, y: y + 12, completed: event.completed, square: blueprint, color: palette.accent, background: palette.paper });
      y += rowHeight;
    });
    if (rowCenters.length > 1) blocks.unshift({ kind: 'line', x: railX, y: rowCenters[0], x2: railX, y2: rowCenters[rowCenters.length - 1], color: palette.line });
    const timelineBottom = y;
    let height = Math.ceil(y + (v.footer ? 90 : 40));
    const minHeight = v.size === 'story' ? 1280 : v.size === 'auto' ? 0 : 900;
    height = Math.max(minHeight, height);
    // Very short stories use deliberate whitespace below the timeline, never stretched rows.
    if (v.footer) {
      rule(height - 84);
      text('footer-brand', 'RESEARCHFLOW', left, height - 61, 260, 13, 700, palette.ink);
      text('footer-note', zh ? '每一步，都值得记录。' : 'Every step is worth recording.', 355, height - 61, 317, 13, 400, palette.muted);
    }
    return { width, height, palette, appearance: v.appearance, blocks, headerBottom, timelineStart, timelineBottom, omitted, eventCount: events.length };
  }

  function render(model, preferences = {}) {
    const canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    const layout = buildLayout(ctx, model, preferences);
    const requestedScale = [1, 2, 3].includes(Number(preferences.resolution)) ? Number(preferences.resolution) : 2;
    // Bound the bitmap allocation for long timelines before creating the export buffer.
    const renderScale = Math.min(requestedScale, Math.sqrt(24000000 / (layout.width * layout.height)), 16384 / layout.height);
    canvas.width = Math.floor(layout.width * renderScale);
    canvas.height = Math.floor(layout.height * renderScale);
    ctx = canvas.getContext('2d');
    ctx.scale(renderScale, renderScale);
    if (layout.palette.gradient) {
      const gradient = ctx.createLinearGradient(0, 0, layout.width, layout.height);
      layout.palette.gradient.forEach((color, i, colors) => gradient.addColorStop(i / (colors.length - 1), color));
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = layout.palette.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.beginPath();
    ctx.roundRect(16, 16, layout.width - 32, layout.height - 32, layout.appearance === 'minimal' ? 0 : 16);
    if (layout.palette.paperGradient) {
      const paperGradient = ctx.createLinearGradient(0, 16, layout.width, layout.height);
      layout.palette.paperGradient.forEach((color, i, colors) => paperGradient.addColorStop(i / (colors.length - 1), color));
      ctx.fillStyle = paperGradient;
    } else ctx.fillStyle = layout.palette.paper;
    ctx.fill();
    ctx.textBaseline = 'top';
    for (const block of layout.blocks) {
      ctx.fillStyle = block.color;
      ctx.strokeStyle = block.color;
      ctx.lineWidth = 1;
      if (block.kind === 'brand-seal') {
        ctx.save(); ctx.translate(block.x, block.y);
        ctx.scale(block.scale || 1, block.scale || 1);
        ctx.strokeStyle = block.color; ctx.lineWidth = 1;
        ctx.globalAlpha = .35;
        ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6, inner = i % 3 === 0 ? 32 : 34;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); ctx.stroke();
        }
        ctx.globalAlpha = .7;
        ctx.save();
        ctx.beginPath(); ctx.rect(-52, -52, 104, 104); ctx.rect(-20, -15, 40, 30); ctx.clip('evenodd');
        ctx.beginPath(); ctx.ellipse(0, 0, 46, 17, -Math.PI / 5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = block.secondary;
        ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, Math.PI * .8); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = block.color;
        for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * .8]) {
          ctx.beginPath(); ctx.arc(Math.cos(a) * 28, Math.sin(a) * 28, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `600 23px ${BRAND_FONT}`;
        const mark = ctx.measureText('RF');
        ctx.fillText('RF', 0, (mark.actualBoundingBoxAscent - mark.actualBoundingBoxDescent) / 2);
        ctx.restore();
      }
      if (block.kind === 'grid') {
        ctx.save();
        ctx.globalAlpha = .22;
        ctx.strokeStyle = block.color;
        ctx.lineWidth = .5;
        for (let x = 48; x <= layout.width - 48; x += 32) { ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x, layout.height - 48); ctx.stroke(); }
        for (let y = 48; y <= layout.height - 48; y += 32) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(layout.width - 48, y); ctx.stroke(); }
        ctx.globalAlpha = .8;
        ctx.strokeStyle = block.accent;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(48, 48); ctx.lineTo(82, 48); ctx.moveTo(48, 48); ctx.lineTo(48, 82); ctx.stroke();
        ctx.restore();
      }
      if (block.kind === 'text') { ctx.font = block.font; ctx.fillText(block.text, block.x, block.y); }
      if (block.kind === 'line') { ctx.beginPath(); ctx.moveTo(block.x, block.y); ctx.lineTo(block.x2, block.y2); ctx.stroke(); }
      if (block.kind === 'rect') {
        ctx.beginPath(); ctx.roundRect(block.x, block.y, block.width, block.height, block.radius || 0); ctx.fill();
      }
      if (block.kind === 'node') {
        ctx.beginPath();
        if (block.square) ctx.rect(block.x - 5, block.y - 5, 10, 10);
        else ctx.arc(block.x, block.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = block.completed ? block.color : block.background;
        ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      }
    }
    return { canvas, layout, resolutionLimited: renderScale < requestedScale };
  }
  const getAppearances = () => Object.entries(THEMES).map(([id, colors]) => ({ id, ...colors }));
  const api = { wrapText, buildLayout, render, getAppearances };
  root.RFShareCard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
