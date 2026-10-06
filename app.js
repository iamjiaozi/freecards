'use strict';
/* ============================================================
 * 自由卡片 · 应用逻辑（vanilla JS，无依赖）
 * 需求依据：PRD v2.0（VF-01~VF-88 / NV-01~NV-34 / VX-01~VX-14）
 * ============================================================ */

/* ---------------- 工具 ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const escHTML = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IS_MAC = /mac/i.test(navigator.platform || '') || /mac/i.test(navigator.userAgent || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const modKey = e => IS_MAC ? !!e.metaKey : !!e.ctrlKey;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* 主内容折叠成一行（用于无障碍名与删除摘要） */
const fold = (s, n) => {
  let t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (n && t.length > n) t = t.slice(0, n) + '…';
  return t;
};
const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICON_LINK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.54 3.54 0 0 0-5-5l-1 1M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.54 3.54 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_TICK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_PENCIL = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M11.5 2.5l2 2L5 13l-2.6.6L3 11l8.5-8.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 5.5v-2a1.6 1.6 0 0 0-1.6-1.6H3.6A1.6 1.6 0 0 0 2 3.5v5.3a1.6 1.6 0 0 0 1.6 1.6h2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2.8 4.2h10.4M6.5 4V2.8a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V4M4.2 4.2l.7 9a1.4 1.4 0 0 0 1.4 1.3h3.4a1.4 1.4 0 0 0 1.4-1.3l.7-9M6.8 7v4M9.2 7v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CHECK_SM = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------------- 网址识别（FR-2.2 / 附录A「有效网址」） ---------------- */
function parseURL(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s || /\s/.test(s)) return null;            // 含空白 → 无效
  if (/[^\x00-\x7F]/.test(s)) return null;        // 含非 ASCII → 无效
  let str = s;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(str)) str = 'https://' + str;
  try {
    const u = new URL(str);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return u;
  } catch (e) { return null; }
}
function urlDisplayParts(card) {
  const u = parseURL(card.url);
  if (!u) return null;
  let path = '';
  try {
    const raw = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
    path = decodeURIComponent(raw);
  } catch (e) { path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash; }
  return { host: u.hostname, path, href: u.href };
}

/* ---------------- 数据层（FR-12） ---------------- */
const LS_KEY = 'freecards.v1';
const CARD_TYPES = { text: 1, url: 1, word: 1 };

function sanitizeCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = CARD_TYPES[raw.type] ? raw.type : 'text';   // D1：无法识别 → 文本
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid();
  const createdAt = Number.isFinite(+raw.createdAt) ? +raw.createdAt : Date.now(); // D5
  const updatedAt = Number.isFinite(+raw.updatedAt) ? +raw.updatedAt : createdAt;
  return {
    id, type, createdAt, updatedAt,
    text: typeof raw.text === 'string' ? raw.text : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    word: typeof raw.word === 'string' ? raw.word : '',
    explain: typeof raw.explain === 'string' ? raw.explain : '',
  };
}

function loadStore() {
  const fresh = () => ({ cards: [], sortMode: 'created', dirs: { created: 'desc', alpha: 'asc' }, theme: null });
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cards)) {
    if (raw !== null) console.warn('[自由卡片] 存储数据格式非法，以空看板启动');
    return fresh();
  }
  const seen = new Set(), cards = [];
  for (const r of raw.cards) {
    try {
      const c = sanitizeCard(r);
      if (!c || seen.has(c.id)) continue;   // D2 跳过损坏 / D4 去重
      seen.add(c.id); cards.push(c);
    } catch (e) { console.warn('[自由卡片] 跳过一张损坏的卡片', e); }
  }
  const dirs = { created: 'desc', alpha: 'asc' };
  if (raw.dirs && typeof raw.dirs === 'object') {
    if (raw.dirs.created === 'asc' || raw.dirs.created === 'desc') dirs.created = raw.dirs.created;
    if (raw.dirs.alpha === 'asc' || raw.dirs.alpha === 'desc') dirs.alpha = raw.dirs.alpha;
  }
  const themeOk = { dark: 1, light: 1, indigo: 1, paper: 1, cold: 1 };
  return {
    cards,
    sortMode: ['created', 'alpha', 'manual'].includes(raw.sortMode) ? raw.sortMode : 'created',
    dirs,
    theme: typeof raw.theme === 'string' && themeOk[raw.theme] ? raw.theme : null,
  };
}

let store = loadStore();
let dirty = false, saveTimer = 0;
function persist() {
  clearTimeout(saveTimer); saveTimer = 0;
  if (!dirty) return;
  dirty = false;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch (e) { /* FR-12.5：存储不可用时静默降级，不打扰用户 */ }
}
const scheduleSave = () => { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 600); }; // VX-08
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

/* 多窗口同步（FR-12.3） */
window.addEventListener('storage', e => {
  if (e.key !== LS_KEY) return;
  const before = new Map(store.cards.map(c => [c.id, c.updatedAt]));
  store = loadStore();
  // 正在编辑的卡：被删 → 退出编辑；被改 → 以本窗口为准（M5），不动编辑器
  if (ui.editingId && !store.cards.some(c => c.id === ui.editingId)) cancelEdit(true);
  renderAll();
  void before;
});

/* ---------------- 卡片访问 ---------------- */
const getCard = id => store.cards.find(c => c.id === id) || null;
const mainText = c => (c.type === 'text' ? c.text : c.type === 'url' ? c.url : c.word);
const isLinkCard = c => c.type === 'url' && !!parseURL(c.url);

const collator = new Intl.Collator('zh', { sensitivity: 'base', numeric: true }); // 拼音 + 数值比较
function displayCards() {
  if (store.sortMode === 'manual') return store.cards.slice();
  const arr = store.cards.slice();
  if (store.sortMode === 'created') {
    const desc = store.dirs.created === 'desc';
    arr.sort((a, b) => desc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
  } else { // alpha：方向各自记忆（FR-8.2）；相同按创建时间先后
    const desc = store.dirs.alpha === 'desc';
    arr.sort((a, b) => {
      const r = collator.compare(mainText(a).trim(), mainText(b).trim());
      if (r !== 0) return desc ? -r : r;
      return a.createdAt - b.createdAt;
    });
  }
  return arr;
}

/* ---------------- UI 状态 ---------------- */
const ui = {
  multiselect: false,
  selected: new Set(),
  editingId: null,
  editOrig: null,
  editFieldKey: null,
  menuCardId: null,
  modalOpen: false,
  dragging: null,
  toastTimer: 0,
  lastModality: 'mouse',
};
window.addEventListener('pointerdown', () => { ui.lastModality = 'mouse'; }, true);
window.addEventListener('keydown', () => { ui.lastModality = 'keyboard'; }, true);

/* ---------------- 渲染 ---------------- */
const gridEl = $('#grid'), boardEl = $('#board');

function cardInnerHTML(c) {
  if (c.type === 'text') {
    return `<div class="t-text">${escHTML(c.text)}</div>`;
  }
  if (c.type === 'url') {
    const p = urlDisplayParts(c);
    if (p) {
      return `<div class="t-url"><span class="host">${ICON_LINK}<span>${escHTML(p.host)}</span></span>` +
        (p.path ? `<span class="path">${escHTML(p.path)}</span>` : '') + `</div>`;
    }
    return `<div class="t-plain">${escHTML(c.url)}</div>`; // 识别不出：原样显示，不加图标（FR-2.2）
  }
  return `<div class="t-word"><div class="w">${escHTML(c.word)}</div>` +
    (c.explain.trim() ? `<div class="ex">${escHTML(c.explain)}</div>` : '') + `</div>`;
}

function cardAriaLabel(c) {
  const name = fold(mainText(c), 60) || '空卡片';
  if (ui.multiselect) {
    const on = ui.selected.has(c.id);
    return (on ? '取消选择「' : '选择「') + name + '」';
  }
  return name;
}

function cardClickable(c) {
  if (ui.multiselect) return true;
  return c.type === 'text' || isLinkCard(c); // 手型指针契约（FR-3.2）
}

function cardHTML(c) {
  const clickable = cardClickable(c);
  const role = ui.multiselect ? 'role="checkbox"' : 'role="button"';
  const checked = ui.multiselect ? ` aria-checked="${ui.selected.has(c.id)}"` : '';
  return `<div class="card${clickable ? ' clickable' : ''}${ui.selected.has(c.id) ? ' selected' : ''}" ` +
    `data-id="${c.id}" tabindex="0" ${role}${checked} aria-haspopup="menu" aria-expanded="false" ` +
    `aria-label="${escHTML(cardAriaLabel(c))}">` +
    `<span class="check" aria-hidden="true">${ICON_CHECK_SM}</span>` +
    `<div class="cardbody">${cardInnerHTML(c)}</div></div>`;
}

function renderGrid() {
  if (ui.dragging) return; // 拖拽中不重建 DOM
  const cards = displayCards();
  gridEl.innerHTML = cards.map(cardHTML).join('');
  gridEl.setAttribute('aria-label', `卡片墙，共 ${cards.length} 张`);
  const empty = cards.length === 0;
  $('#emptyHint').hidden = !empty;
  gridEl.style.display = empty ? 'none' : '';
}

const SORT_NAMES = { created: '创建时间', alpha: '字母', manual: '手动' };
function renderToolbar() {
  const n = store.cards.length;
  $('#countCapsule').textContent = `${n} 张`;
  $$('#sortSeg button').forEach(b => {
    const on = b.dataset.sort === store.sortMode;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = `按${SORT_NAMES[b.dataset.sort]}排序`;
  });
  // 方向按钮
  const dirBtn = $('#btnDir');
  const up = $('#dirIconUp'), down = $('#dirIconDown');
  let title = '', showUp = true, disabled = false;
  if (store.sortMode === 'manual') {
    disabled = true; title = '手动顺序下方向由拖拽决定';
  } else if (store.sortMode === 'created') {
    const desc = store.dirs.created === 'desc';
    showUp = !desc; title = desc ? '当前最新在前，点击切换为最早在前' : '当前最早在前，点击切换为最新在前';
  } else {
    const asc = store.dirs.alpha === 'asc';
    showUp = asc; title = asc ? '当前 A → Z，点击切换为 Z → A' : '当前 Z → A，点击切换为 A → Z';
  }
  dirBtn.disabled = disabled; dirBtn.title = title; dirBtn.setAttribute('aria-label', title);
  up.hidden = !showUp; down.hidden = showUp;
  // 主题按钮
  $('#themeLabel').textContent = THEMES[currentTheme()].name;
  // 多选开关
  const mb = $('#btnMulti');
  mb.setAttribute('aria-pressed', ui.multiselect ? 'true' : 'false');
  $('#multiLabel').textContent = ui.multiselect ? '取消多选' : '多选';
  $('#multiIconCheck').hidden = ui.multiselect;
  $('#multiIconX').hidden = !ui.multiselect;
  mb.title = ui.multiselect ? '退出多选（Esc）' : '多选卡片';
  document.body.classList.toggle('multiselect', ui.multiselect);
  // 批量条
  const bar = $('#batchBar');
  bar.hidden = !ui.multiselect;
  if (ui.multiselect) {
    const k = ui.selected.size;
    $('#selCount').textContent = k;
    const del = $('#btnBatchDel');
    del.disabled = k === 0;
    del.title = k === 0 ? '先选择卡片' : `删除选中的 ${k} 张卡片`;
  }
}

function renderFooter() {
  const hint = ui.multiselect
    ? '点卡片选中 / 再点取消 · 拖拽已暂停 · Esc 退出多选'
    : `文本卡点击即可编辑 · 链接卡点击即可打开 · 链接卡 / 单词卡的编辑在右键菜单 · 拖拽调整位置 · 新建卡片内 ${MOD}+回车建卡 / 回车换行`;
  $('#modeHint').textContent = hint;
  $('#emptyMod').textContent = MOD;
}

function renderAll() { renderToolbar(); renderGrid(); renderFooter(); }

/* ============================================================
 * FR-1 新建卡片弹层
 * ============================================================ */
const overlayEl = $('#modalOverlay'), modalBoxEl = $('#modalBox'),
  typeSegEl = $('#typeSeg'), fieldsEl = $('#modalFields');

const modal = {
  type: 'text',
  drafts: { text: '', url: '', word: '', explain: '' }, // 每种类型各留一份草稿（FR-1.5）
};

const FIELD_DEFS = {
  text: [{ key: 'text', label: '内容', multiline: true, placeholder: '写点什么，回车换行', cls: 'grow' }],
  url: [{ key: 'url', label: '网址', multiline: false, placeholder: 'example.com', cls: '' }],
  word: [
    { key: 'word', label: '单词', multiline: false, placeholder: '单词', cls: '' },
    { key: 'explain', label: '解释', multiline: true, placeholder: '解释 / 释义（可留空）', cls: 'grow' },
  ],
};

function renderModalFields() {
  const defs = FIELD_DEFS[modal.type];
  fieldsEl.innerHTML = defs.map(d => {
    const val = escHTML(modal.drafts[d.key] || '');
    const attrs = `data-key="${d.key}" aria-label="${d.label}" placeholder="${escHTML(d.placeholder)}"`;
    return d.multiline
      ? `<textarea class="${d.cls}" ${attrs} rows="2">${val}</textarea>`
      : `<input class="${d.cls}" ${attrs} value="${val}"${d.key === 'url' ? ' inputmode="url" autocapitalize="off" spellcheck="false"' : ''}>`;
  }).join('');
  // 同步草稿（输入即保存到草稿，P3 不丢东西）
  $$('input,textarea', fieldsEl).forEach(el => {
    el.addEventListener('input', () => { modal.drafts[el.dataset.key] = el.value; });
    // 粘贴末尾换行丢弃（FR-1.8）
    el.addEventListener('paste', e => {
      const t = (e.clipboardData || window.clipboardData || {}).getData
        ? (e.clipboardData || window.clipboardData).getData('text') : '';
      if (!t) return;
      e.preventDefault();
      const cleaned = t.replace(/[\r\n]+$/, '');
      const s = el.selectionStart || 0, en = el.selectionEnd || 0, v = el.value;
      el.value = v.slice(0, s) + cleaned + v.slice(en);
      const pos = s + cleaned.length;
      el.selectionStart = el.selectionEnd = pos;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  $('#modalKeyHint').innerHTML =
    `<b>${MOD}+回车</b> 建卡 · <b>回车</b> 换行 · <b>Esc</b> 关闭`;
}

function syncModalDraftsFromDOM() {
  $$('input,textarea', fieldsEl).forEach(el => { modal.drafts[el.dataset.key] = el.value; });
}
/* 「有内容」判定：所有类型（含切走的草稿）任一字段去空白后非空（FR-1.7） */
function modalHasContent() {
  syncModalDraftsFromDOM();
  return Object.values(modal.drafts).some(v => String(v).trim() !== '');
}

function openModal() {
  if (ui.editingId) commitEdit();       // 弹层抢占焦点，编辑自动收尾（2.3）
  closeMenu(false); closeThemePanel();
  modal.type = 'text';
  $$('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === 'text' ? 'true' : 'false'));
  renderModalFields();
  overlayEl.hidden = false;
  document.body.classList.add('locked');
  ui.modalOpen = true;
  // 打开即聚焦主字段（移动端在点击手势内唤起软键盘，FR-1.3）
  const first = $('input,textarea', fieldsEl);
  if (first) { first.focus({ preventScroll: true }); first.setSelectionRange(first.value.length, first.value.length); }
}

function closeModal() {
  if (!ui.modalOpen) return;
  ui.modalOpen = false;
  overlayEl.hidden = true;
  document.body.classList.remove('locked');
  modalBoxEl.classList.remove('nudge');
  modal.drafts = { text: '', url: '', word: '', explain: '' }; // Esc / × =「我不要了」，内容丢弃（5.6）
  $('#btnNew').focus({ preventScroll: true }); // 焦点归还（FR-1.3 / VF-08）
}

function switchModalType(t) {
  if (t === modal.type) return;
  syncModalDraftsFromDOM();
  modal.type = t;
  $$('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === t ? 'true' : 'false'));
  renderModalFields();
  const first = $('input,textarea', fieldsEl);
  if (first) first.focus({ preventScroll: true }); // 切类型后光标回到第一个字段
}

function tryCreateCard() {
  syncModalDraftsFromDOM();
  const d = modal.drafts;
  const main = modal.type === 'text' ? d.text : modal.type === 'url' ? d.url : d.word;
  if (!main.trim()) { closeModal(); return; } // 必填为空：不建卡，等同关闭（FR-1.8）
  const now = Date.now();
  const card = { id: uid(), type: modal.type, createdAt: now, updatedAt: now, text: '', url: '', word: '', explain: '' };
  if (modal.type === 'text') card.text = d.text.trim();
  else if (modal.type === 'url') card.url = d.url.trim();
  else { card.word = d.word.trim(); card.explain = d.explain.trim(); }
  store.cards.push(card); // 新建追加在手动顺序末尾（FR-8.4）
  modal.drafts = { text: '', url: '', word: '', explain: '' };
  scheduleSave();
  closeModal();
  renderAll();
}

/* 弹层内事件 */
typeSegEl.addEventListener('click', e => {
  const b = e.target.closest('button[data-type]');
  if (b) switchModalType(b.dataset.type);
});
$('#modalClose').addEventListener('click', () => closeModal()); // 点 ×：明确关闭意图，直接关（FR-1.7）
overlayEl.addEventListener('pointerdown', e => {
  if (e.target !== overlayEl) return;
  if (modalHasContent()) {
    // 有内容：不关闭，轻推一下（FR-1.7），并阻止焦点转移
    e.preventDefault();
    modalBoxEl.classList.remove('nudge');
    void modalBoxEl.offsetWidth;
    modalBoxEl.classList.add('nudge');
    const first = $('input,textarea', fieldsEl);
    if (first) first.focus({ preventScroll: true });
  } else {
    closeModal(); // 空内容：直接关闭
  }
});
// 点卡片留白 → 光标请回主字段（FR-1.3）
$('#modalCard').addEventListener('click', e => {
  if (e.target.closest('input,textarea,.x')) return;
  const first = $('input,textarea', fieldsEl);
  if (first) first.focus({ preventScroll: true });
});
/* 弹层内键位（FR-1.6） */
overlayEl.addEventListener('keydown', e => {
  const inField = e.target.closest('input,textarea');
  const composing = e.isComposing || e.keyCode === 229;
  // 焦点在 × 上时，回车/空格交给按钮自己（FR-1.6）
  if (e.target.id === 'modalClose' && (e.key === 'Enter' || e.key === ' ')) return;
  if (modKey(e) && (e.key === 'Enter' || e.keyCode === 13) && !composing) {
    e.preventDefault(); // 任何地方（含类型切换按钮上）都有效（FR-1.6）
    tryCreateCard();
    return;
  }
  if (e.key === 'Enter' && !composing && inField && e.target.tagName === 'INPUT') {
    // 单行字段回车 → 下一个字段（FR-1.6）
    e.preventDefault();
    const fields = $$('input,textarea', fieldsEl);
    const i = fields.indexOf(e.target);
    if (i >= 0 && i < fields.length - 1) fields[i + 1].focus();
    return;
  }
  if (e.key === 'Tab') {
    // 焦点在弹层内循环（FR-13.3）
    const f = $$('button, input, textarea, [tabindex]', modalBoxEl)
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('#btnNew').addEventListener('click', openModal);

/* ============================================================
 * FR-3 点一下卡片 / FR-4 编辑卡片
 * ============================================================ */
const cardElOf = id => gridEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);

/* 点一下 = 一个动作，只由类型决定（FR-3.1）。鼠标/键盘/触屏走同一条判定。 */
function activateCard(id) {
  const c = getCard(id);
  if (!c) return;
  if (ui.multiselect) { toggleSelect(id); return; } // 多选态覆盖类型分流（FR-3.1）
  if (c.type === 'text') startEdit(id);
  else if (c.type === 'url') {
    const p = urlDisplayParts(c);
    if (p) window.open(p.href, '_blank', 'noopener'); // 新标签页打开
  }
  // 单词卡 / 识别不出的网址卡：什么都不做
}

function startEdit(id) {
  const c = getCard(id);
  if (!c || ui.editingId === id) return;
  if (ui.multiselect) return;
  closeMenu(false);
  if (ui.editingId) commitEdit();
  const el = cardElOf(id);
  if (!el) return;
  ui.editingId = id;
  ui.editOrig = { text: c.text, url: c.url, word: c.word, explain: c.explain, updatedAt: c.updatedAt };
  el.classList.add('editing');
  el.classList.remove('clickable');
  const defs = FIELD_DEFS[c.type];
  const body = $('.cardbody', el);
  body.innerHTML = `<div class="editor" role="group" aria-label="编辑卡片">` + defs.map(d => {
    const val = escHTML(c[d.key] || '');
    const attrs = `data-key="${d.key}" aria-label="${d.label}" placeholder="${escHTML(d.placeholder)}"`;
    return d.multiline
      ? `<textarea ${attrs} rows="3">${val}</textarea>`
      : `<input ${attrs} value="${val}"${d.key === 'url' ? ' inputmode="url" autocapitalize="off" spellcheck="false"' : ''}>`;
  }).join('') + `</div>`;
  const editor = $('.editor', body);
  // 记录最后聚焦的字段：拖拽回来后光标要回到这里（FR-4.3）
  editor.addEventListener('focusin', e => {
    if (e.target.dataset && e.target.dataset.key) ui.editFieldKey = e.target.dataset.key;
  });
  // 自动保存：输入即同步到数据并标记未保存（pagehide 补写不丢字，FR-12.2）；
  // 实际落盘防抖约 0.6s（VX-08）。编辑中不做「清空删卡」判断（FR-4.4）。
  const markDirty = () => {
    if (ui.editingId !== id) return;
    readEditorInto(c, editor, false);
    c.updatedAt = Date.now();
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 600);
    el.setAttribute('aria-label', escHTML(cardAriaLabel(c)));
  };
  editor.addEventListener('input', markDirty);
  // 焦点移出卡片 → 完成编辑（FR-4.3）；字段间移动不算离开
  editor.addEventListener('focusout', e => {
    if (ui.editingId !== id) return;
    if (ui.dragging) return; // 拖拽中的 DOM 重排会短暂失焦，不算「离开卡片」
    if (!el.contains(e.relatedTarget)) commitEdit();
  });
  editor.addEventListener('keydown', e => {
    const composing = e.isComposing || e.keyCode === 229;
    if (composing) return; // 组字时跳过键位判定（FR-4.3）
    const inField = e.target.closest('input,textarea');
    if (modKey(e) && (e.key === 'Enter' || e.keyCode === 13)) { e.preventDefault(); commitEdit(); return; }
    if (e.key === 'Escape') return; // Esc 由页面级统一处理
    if (e.key === 'Enter' && inField && e.target.tagName === 'INPUT') {
      e.preventDefault();
      const fields = $$('input,textarea', editor);
      const i = fields.indexOf(e.target);
      if (i >= 0 && i < fields.length - 1) fields[i + 1].focus();
    }
  });
  // 光标落在主字段末尾，不是全选（FR-4.1）
  const main = $('input,textarea', editor);
  if (main) {
    main.focus({ preventScroll: true });
    const len = main.value.length;
    try { main.setSelectionRange(len, len); } catch (e) {}
  }
}

function readEditorInto(c, editor, trim) {
  $$('input,textarea', editor).forEach(el => {
    const v = trim ? el.value.trim() : el.value;
    c[el.dataset.key] = v;
  });
}

/* 完成编辑：主内容清空 = 删卡（FR-4.5） */
function commitEdit() {
  const id = ui.editingId;
  if (!id) return;
  const c = getCard(id), el = cardElOf(id);
  const orig = ui.editOrig; // 先取快照：内容没变则不做任何写入（FR-4.5）
  ui.editingId = null; ui.editOrig = null; ui.editFieldKey = null;
  if (!c) { renderAll(); return; }
  if (el) {
    const editor = $('.editor', el);
    if (editor) readEditorInto(c, editor, true); // 去首尾空白后比较与保存（FR-3.3）
  }
  const mainEmpty = !mainText(c).trim();
  const changed = el ? ['text', 'url', 'word', 'explain'].some(k =>
    String(c[k] || '').trim() !== String((orig || {})[k] || '').trim()) : true;
  if (mainEmpty) {
    deleteCards([id]); // 空卡片在任何情况下都不存在（FR-4.5）
  } else if (changed) {
    c.updatedAt = Date.now();
    scheduleSave();
    renderAll();
  } else {
    renderAll();
  }
}

/* 取消编辑：丢弃改动，选填字段一并回填（FR-4.6） */
function cancelEdit(silent) {
  const id = ui.editingId;
  if (!id) return;
  const c = getCard(id);
  ui.editingId = null; ui.editFieldKey = null;
  if (c && ui.editOrig) {
    c.text = ui.editOrig.text; c.url = ui.editOrig.url;
    c.word = ui.editOrig.word; c.explain = ui.editOrig.explain;
    c.updatedAt = ui.editOrig.updatedAt;
  }
  ui.editOrig = null;
  if (!silent) { scheduleSave(); }
  renderAll();
}

/* ============================================================
 * FR-5 卡片操作菜单 / FR-6 触屏长按
 * ============================================================ */
const menuEl = $('#ctxMenu');
let menuCloseTimer = 0;

function copyTextOf(c) {
  if (c.type === 'text') return c.text;
  if (c.type === 'url') return c.url;
  return c.explain.trim() ? c.word + '\n' + c.explain : c.word; // 单词卡复制两行（FR-5.2）
}

async function doCopy(c) {
  const text = copyTextOf(c);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    return true;
  } catch (e) { return false; } // 复制失败安静收起（FR-5.3 建议）
}

function openMenu(x, y, cardId, via) {
  const c = getCard(cardId);
  if (!c || ui.editingId) return; // 编辑态不接管右键（FR-5.1）
  clearTimeout(menuCloseTimer);
  // 同一张卡再次唤出：只更新锚点，不闪烁（FR-5.6）
  const sameCard = ui.menuCardId === cardId && !menuEl.hidden;
  ui.menuCardId = cardId;
  $$('.card.menu-open', gridEl).forEach(el => el.classList.remove('menu-open'));
  const items = [];
  if (!ui.multiselect) {
    items.push({ key: 'edit', icon: ICON_PENCIL, label: '编辑' });
  }
  items.push({ key: 'copy', icon: ICON_COPY, label: c.type === 'url' ? '复制链接' : '复制文字' });
  items.push({ key: 'delete', icon: ICON_TRASH, label: '删除卡片', danger: true });
  menuEl.innerHTML = items.map(it =>
    `<button class="mi${it.danger ? ' danger' : ''}" role="menuitem" data-act="${it.key}">${it.icon}<span>${it.label}</span></button>`
  ).join('');
  menuEl.hidden = false;
  // 定位：从指针处长出，保证完整可见（四周 ≥8px，VX-14）
  const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  const px = clamp(x, 8, window.innerWidth - mw - 8);
  const py = clamp(y, 8, window.innerHeight - mh - 8);
  menuEl.style.left = px + 'px';
  menuEl.style.top = py + 'px';
  const cardEl = cardElOf(cardId);
  if (cardEl) { cardEl.classList.add('menu-open'); cardEl.setAttribute('aria-expanded', 'true'); }
  if (via === 'keyboard' && !sameCard) {
    const first = $('.mi', menuEl); // 键盘唤出：焦点进第一项（FR-5.7）
    if (first) first.focus({ preventScroll: true });
  }
}

function closeMenu(focusCard) {
  if (menuEl.hidden) return;
  clearTimeout(menuCloseTimer);
  menuEl.hidden = true;
  const id = ui.menuCardId;
  ui.menuCardId = null;
  const cardEl = id && cardElOf(id);
  if (cardEl) {
    cardEl.classList.remove('menu-open');
    cardEl.setAttribute('aria-expanded', 'false');
    // 焦点在菜单内 → 还给卡片（FR-5.7）
    if (focusCard !== false && menuEl.contains(document.activeElement)) cardEl.focus({ preventScroll: true });
  }
}

menuEl.addEventListener('click', async e => {
  const btn = e.target.closest('.mi');
  if (!btn || menuEl.hidden) return;
  const id = ui.menuCardId, c = getCard(id);
  if (!c) { closeMenu(false); return; }
  const act = btn.dataset.act;
  if (act === 'edit') { closeMenu(false); startEdit(id); }
  else if (act === 'delete') { closeMenu(false); deleteCards([id]); }
  else if (act === 'copy') {
    const ok = await doCopy(c);
    if (!ok) { closeMenu(false); return; }
    // 复制成功反馈：变「已复制」+ 对勾约 1s，再 0.55s 收起（FR-5.3）
    btn.innerHTML = `${ICON_TICK}<span>已复制</span>`;
    btn.disabled = true;
    clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(() => closeMenu(true), 1550);
  }
});
menuEl.addEventListener('keydown', e => {
  const items = $$('.mi', menuEl);
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
});

/* 菜单关闭条件：点外部 / 滚动 / 尺寸变化（FR-5.6） */
window.addEventListener('pointerdown', e => {
  if (menuEl.hidden) return;
  if (e.button === 2) return; // 右键按下交给 contextmenu 处理（同卡重锚点不闪）
  if (!menuEl.contains(e.target)) closeMenu(false);
}, true);
window.addEventListener('scroll', () => { if (!menuEl.hidden) closeMenu(false); }, true);
window.addEventListener('resize', () => { if (!menuEl.hidden) closeMenu(false); });

/* 网格事件委托：右键 / 键盘 / 焦点 */
gridEl.addEventListener('contextmenu', e => {
  const cardEl = e.target.closest('.card');
  e.preventDefault(); // 接管右键（普通态）
  if (!cardEl || ui.editingId) return;
  const id = cardEl.dataset.id;
  const r = cardEl.getBoundingClientRect();
  if (ui.menuCardId === id && !menuEl.hidden) {
    openMenu(e.clientX, e.clientY, id, 'mouse'); // 同卡：只改锚点
  } else {
    closeMenu(false);
    openMenu(e.clientX, e.clientY, id, 'mouse');
  }
  void r;
});

gridEl.addEventListener('keydown', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;
  if (e.target.closest('input,textarea')) return; // 编辑器内按键由编辑器处理
  const id = cardEl.dataset.id;
  const composing = e.isComposing || e.keyCode === 229;
  if (composing) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    activateCard(id); // 回车/空格 = 点一下（FR-3.3）
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.editingId !== id) {
    if (ui.multiselect) return; // 多选态 Delete 故意无响应（FR-3.3）
    e.preventDefault();
    deleteCards([id]);
    focusNeighbor(id);
  } else if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
    e.preventDefault();
    const r = cardEl.getBoundingClientRect();
    closeMenu(false);
    openMenu(r.left + 14, r.top + 14, id, 'keyboard'); // 键盘唤出锚在卡片左上角内侧（FR-5.4）
  }
});

gridEl.addEventListener('focusin', e => {
  const cardEl = e.target.closest('.card');
  if (cardEl && ui.lastModality === 'keyboard') cardEl.classList.add('focused');
});
gridEl.addEventListener('focusout', e => {
  const cardEl = e.target.closest('.card');
  if (cardEl) cardEl.classList.remove('focused');
});

/* 删除后焦点落到邻居卡片 */
function focusNeighbor(deletedId) {
  const cards = $$('.card', gridEl);
  const el = cards.find(el => el.dataset.id !== deletedId);
  if (el) el.focus({ preventScroll: true });
  else $('#btnNew').focus({ preventScroll: true });
}

/* 点击（经长按抑制检查） */
let clickSuppressUntil = 0;
gridEl.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl || ui.editingId === cardEl.dataset.id) return;
  if (Date.now() < clickSuppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
  activateCard(cardEl.dataset.id);
}, true);

/* ============================================================
 * FR-7 拖拽排序
 * ============================================================ */
let gesture = null; // 当前手势：{cardId, pointerId, pointerType, startX, startY, moved, inEditor, longpressTimer, longpressFired, dragArmed}

function clearLongpress() {
  if (gesture && gesture.longpressTimer) { clearTimeout(gesture.longpressTimer); gesture.longpressTimer = 0; }
}

/* 长按：仅触摸/触控笔，500ms，位移>10px 取消（FR-6.1） */
function armLongpress(g, x, y) {
  if (g.pointerType === 'mouse') return;               // 鼠标按住不动不触发
  if (ui.editingId) return;                            // 编辑态不接管
  if (!menuEl.hidden) return;
  g.longpressTimer = setTimeout(() => {
    g.longpressTimer = 0;
    g.longpressFired = true;
    clickSuppressUntil = Date.now() + 700;             // 取消「松手算点击」+ 阻止链接跳转（时效700ms，FR-6.2）
    openMenu(x, y, g.cardId, 'touch');
  }, 500);
}

gridEl.addEventListener('pointerdown', e => {
  if (ui.dragging) endDrag(); // 上一次立刻收尾（I21）
  const cardEl = e.target.closest('.card');
  if (!cardEl || ui.modalOpen) return;
  const id = cardEl.dataset.id;
  const inField = !!e.target.closest('input,textarea');
  if (inField && ui.editingId !== id) return; // 输入区不触发拖拽（FR-7.1）
  // 编辑卡输入区上的按下：仍记录手势，用于「指针移出卡片后升级为拖拽」（FR-4.3）
  // 在编辑卡的留白处按下时阻止默认焦点转移，焦点留在正在编辑的字段里
  if (ui.editingId === id && !inField) e.preventDefault();
  if (e.pointerType === 'mouse' && e.button !== 0) return; // 只有左键能拖
  if (ui.editingId && ui.editingId !== id) commitEdit(); // 焦点移到另一张卡：前一张收尾（FR-4.7）
  clearLongpress();
  const g = gesture = {
    cardId: id, pointerId: e.pointerId, pointerType: e.pointerType,
    startX: e.clientX, startY: e.clientY, moved: false,
    inEditor: ui.editingId === id, longpressTimer: 0, longpressFired: false,
  };
  armLongpress(g, e.clientX, e.clientY);
});

window.addEventListener('pointermove', e => {
  const g = gesture;
  if (!g || e.pointerId !== g.pointerId) return;
  const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
  const dist = Math.hypot(dx, dy);
  if (!g.moved && dist > 10) clearLongpress();          // 长按作废，让位给拖拽（FR-6.2）
  if (!ui.dragging && dist > 7) {                      // 升级阈值约 7px（VX-06）
    g.moved = true;
    clearLongpress();                                  // 拖拽优先，长按作废（FR-7.1）
    if (ui.multiselect) return;                        // 多选态：拒绝升级为拖拽（FR-7.6）
    if (g.inEditor) {
      const el = cardElOf(g.cardId);
      const r = el && el.getBoundingClientRect();
      // 编辑态：指针移出卡片才升级；卡片内短距离留给选中文字（FR-4.3）
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
    }
    startDrag(g, e.clientX, e.clientY);
  }
  if (ui.dragging) moveDrag(e.clientX, e.clientY);
}, { passive: true });

function endGesture(e, cancelled) {
  const g = gesture;
  gesture = null;
  if (!g) return;
  clearLongpress();
  if (ui.dragging && (!e || e.pointerId === ui.dragging.pointerId)) endDrag();
}

window.addEventListener('pointerup', e => { endGesture(e, false); });
window.addEventListener('pointercancel', e => { endGesture(e, true); });
window.addEventListener('blur', () => { if (ui.dragging) endDrag(); }); // 窗口失焦立即收尾（FR-7.1）
document.addEventListener('mouseleave', () => { if (ui.dragging) endDrag(); });

/* ---------- 拖拽主体 ---------- */
function gridMetrics() {
  const first = $('.card', gridEl);
  if (!first) return null;
  const gap = parseFloat(getComputedStyle(gridEl).columnGap) || 16;
  const cellW = first.offsetWidth, cellH = first.offsetHeight;
  const cols = Math.max(1, Math.round((gridEl.clientWidth + gap) / (cellW + gap)));
  return { gap, cellW, cellH, cols };
}

function startDrag(g, px, py) {
  const el = cardElOf(g.cardId), c = getCard(g.cardId);
  if (!el || !c) return;
  // 正在编辑的卡被拖拽：先把编辑器当前值同步进数据（不收尾），拖完回来继续编
  let editorFieldKey = ui.editFieldKey || null;
  if (ui.editingId === g.cardId) {
    const editor = $('.editor', el);
    if (editor) {
      readEditorInto(c, editor, false);
      if (!editorFieldKey) {
        const f = $('input,textarea', editor);
        if (f) editorFieldKey = f.dataset.key;
      }
    }
  }
  const m = gridMetrics();
  if (!m) return;
  const rect = el.getBoundingClientRect();
  const grabDX = g.startX - rect.left, grabDY = g.startY - rect.top;
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.transformOrigin = `${grabDX}px ${grabDY}px`;
  ghost.innerHTML = `<div class="cardbody">${cardInnerHTML(c)}</div>`;
  document.body.appendChild(ghost);
  const ids = $$('.card', gridEl).map(el => el.dataset.id);
  ui.dragging = {
    id: g.cardId, pointerId: g.pointerId, ids, startIds: ids.slice(),
    curIdx: ids.indexOf(g.cardId), metrics: m, ghost, slotEl: el,
    grabDX, grabDY, tx: px - grabDX, ty: py - grabDY,
    editorFieldKey, raf: 0, lastY: py,
  };
  el.classList.add('slot'); // 空槽：内容隐去（FR-7.2）
  document.body.classList.add('dragging');
  positionGhost(ui.dragging);
  // 边缘自动滚动（FR-7.4）
  const loop = () => {
    const d = ui.dragging;
    if (!d) return;
    if (d.lastY < 76) window.scrollBy(0, -16);
    else if (d.lastY > window.innerHeight - 76) window.scrollBy(0, 16);
    d.raf = requestAnimationFrame(loop);
  };
  ui.dragging.raf = requestAnimationFrame(loop);
}

function positionGhost(d) {
  // 倾斜与位移写进同一套 transform，避免单独 rotate 属性导致位移被旋转（FR-7.2 禁止项）
  d.ghost.style.transform = `translate(${d.tx}px, ${d.ty}px) rotate(1.6deg)`;
}

function hitTest(d, px, py) {
  const gr = gridEl.getBoundingClientRect();
  const { gap, cellW, cellH, cols } = d.metrics;
  const lx = px - gr.left, ly = py - gr.top;
  const ex = 8; // 卡片四周外扩约 8px（FR-7.3）
  let best = -1, bestD = Infinity;
  for (let i = 0; i < d.ids.length; i++) {
    const col = i % cols, row = (i / cols) | 0;
    const x = col * (cellW + gap), y = row * (cellH + gap);
    if (lx >= x - ex && lx <= x + cellW + ex && ly >= y - ex && ly <= y + cellH + ex) {
      const cx = x + cellW / 2, cy = y + cellH / 2;
      const dd = (lx - cx) * (lx - cx) + (ly - cy) * (ly - cy);
      if (dd < bestD) { bestD = dd; best = i; }
    }
  }
  return best;
}

function moveDrag(px, py) {
  const d = ui.dragging;
  if (!d) return;
  d.lastY = py;
  d.tx = px - d.grabDX; d.ty = py - d.grabDY;
  positionGhost(d);
  const target = hitTest(d, px, py);
  // 命中用卡片静止位（metrics 固定），缝隙/自身空槽保持不变（FR-7.3）
  if (target >= 0 && target !== d.curIdx) {
    const elMap = new Map($$('.card', gridEl).map(el => [el.dataset.id, el]));
    const first = new Map();
    if (!reducedMotion()) {
      $$('.card', gridEl).forEach(el => first.set(el.dataset.id, el.getBoundingClientRect()));
    }
    const [movedId] = d.ids.splice(d.curIdx, 1);
    d.ids.splice(target, 0, movedId);
    d.curIdx = target;
    d.ids.forEach(id => gridEl.appendChild(elMap.get(id))); // 按索引先后判定插入，无死区（FR-7.3）
    if (!reducedMotion()) {
      $$('.card', gridEl).forEach(el => {
        if (el.dataset.id === d.id) return;
        const f = first.get(el.dataset.id), l = el.getBoundingClientRect();
        const dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) {
          el.animate(
            [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: 190, easing: 'cubic-bezier(.2,.7,.3,1)' } // 让位 190ms，短而起步快（6.6）
          );
        }
      });
    }
  }
}

function ghostFlyTo(d, toX, toY, duration, easing, fadeStartOffset) {
  const from = `translate(${d.tx}px,${d.ty}px) rotate(1.6deg)`;
  const to = `translate(${toX}px,${toY}px) rotate(0deg)`;
  return d.ghost.animate([
    { transform: from, opacity: 1 },
    { transform: from, opacity: 1, offset: fadeStartOffset },
    { transform: to, opacity: 0, offset: Math.min(0.97, fadeStartOffset + 0.41) },
    { transform: to, opacity: 0 },
  ], { duration, easing, fill: 'forwards' });
}

function endDrag() {
  const d = ui.dragging;
  if (!d) return;
  ui.dragging = null;
  cancelAnimationFrame(d.raf);
  document.body.classList.remove('dragging');
  clickSuppressUntil = Date.now() + 350; // 松手不算「点一下」
  const el = d.slotEl;
  const changed = d.ids.some((id, i) => id !== d.startIds[i]);
  const finish = () => {
    d.ghost.remove();
    el.style.opacity = '';
    el.style.transform = '';
    // 数据提交：顺序写入，换位则切手动（FR-7.6 / FR-8.4）
    if (changed) {
      const order = new Map(d.ids.map((id, i) => [id, i]));
      store.cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      if (store.sortMode !== 'manual') store.sortMode = 'manual';
      scheduleSave();
    }
    renderToolbar(); renderFooter();
    // 正在编辑的卡：光标回到原字段末尾（FR-4.3）
    if (ui.editingId === d.id && d.editorFieldKey) {
      const editor = $('.editor', el);
      const f = editor && $(`[data-key="${d.editorFieldKey}"]`, editor);
      if (f) {
        f.focus({ preventScroll: true });
        try { const len = f.value.length; f.setSelectionRange(len, len); } catch (e) {}
      }
    }
  };

  if (reducedMotion()) { el.classList.remove('slot'); finish(); return; }

  if (changed) {
    // 情况 A：顺序变了 → 浮层飞到新槽位并淡出（340ms），卡片淡入（FR-7.5）
    el.classList.remove('slot');
    el.style.opacity = '0';
    const r = el.getBoundingClientRect();
    const fly = ghostFlyTo(d, r.left, r.top, 340, 'cubic-bezier(.3,.7,.3,1)', 0.53); // 180ms 后开始淡出
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, delay: 180, fill: 'forwards' });
    setTimeout(finish, 340);
    void fly;
  } else {
    // 情况 B：顺序没变 → 浮层飞回原位（360ms，起步快末段缓收），卡片淡入（FR-7.5）
    el.classList.remove('slot');
    el.style.opacity = '0';
    const r = el.getBoundingClientRect();
    const fly = ghostFlyTo(d, r.left, r.top, 360, 'cubic-bezier(.25,.8,.35,1)', 0.55);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'forwards' });
    setTimeout(finish, 360);
    void fly;
  }
}

/* ============================================================
 * FR-8 排序方式与方向
 * ============================================================ */
$('#sortSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-sort]');
  if (!b || store.sortMode === b.dataset.sort) return;
  store.sortMode = b.dataset.sort;
  scheduleSave();
  renderAll();
});
$('#btnDir').addEventListener('click', () => {
  if (store.sortMode === 'manual') return;
  const k = store.sortMode;
  store.dirs[k] = store.dirs[k] === 'asc' ? 'desc' : 'asc';
  scheduleSave();
  renderAll();
});

/* ============================================================
 * FR-9 多选与批量操作
 * ============================================================ */
function enterMultiselect() {
  if (ui.editingId) commitEdit(); // 编辑与多选互斥（2.3）
  closeMenu(false);
  ui.multiselect = true;
  ui.selected.clear();
  renderAll();
}
function exitMultiselect() {
  if (!ui.multiselect) return;
  ui.multiselect = false;
  ui.selected.clear();
  renderAll();
}
function toggleSelect(id) {
  const c = getCard(id);
  if (!c) return;
  if (ui.selected.has(id)) ui.selected.delete(id);
  else ui.selected.add(id);
  const el = cardElOf(id);
  const on = ui.selected.has(id);
  if (el) {
    el.classList.toggle('selected', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    el.setAttribute('aria-label', escHTML(cardAriaLabel(c)));
  }
  renderToolbar(); // 计数同步（FR-9.3）
}
$('#btnMulti').addEventListener('click', () => {
  ui.multiselect ? exitMultiselect() : enterMultiselect();
});
$('#btnBatchDel').addEventListener('click', () => {
  if (!ui.selected.size) return; // 0 张时禁用，点了也不该发生（FR-9.4）
  // 选中集按屏幕先后顺序排列（FR-9.5）
  const order = new Map(displayCards().map((c, i) => [c.id, i]));
  const ids = [...ui.selected].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  deleteCards(ids); // 留在多选态，选择已清空
});

/* ============================================================
 * FR-10 删除与撤销
 * ============================================================ */
function deleteCards(ids) {
  const items = [];
  ids.forEach(id => {
    const idx = store.cards.findIndex(c => c.id === id);
    if (idx >= 0) items.push({ card: Object.assign({}, store.cards[idx]), index: idx });
  });
  if (!items.length) return;
  if (ui.dragging) endDrag();
  const idSet = new Set(items.map(it => it.card.id));
  store.cards = store.cards.filter(c => !idSet.has(c.id));
  items.forEach(it => ui.selected.delete(it.card.id)); // D6：计数自动跟上
  if (ui.editingId && idSet.has(ui.editingId)) { ui.editingId = null; ui.editOrig = null; }
  scheduleSave();
  const label = items.length === 1
    ? `已删除「${fold(mainText(items[0].card), 10)}」`
    : `已删除 ${items.length} 张卡片`;
  showToast(label, () => {
    // 撤销：整体原样复原，回到各自原来的位置（FR-10.3）
    items.slice().sort((a, b) => a.index - b.index)
      .forEach(it => store.cards.splice(Math.min(it.index, store.cards.length), 0, Object.assign({}, it.card)));
    ui.selected.clear(); // 撤销后不保持选中（FR-10.3）
    scheduleSave();
    renderAll();
  });
  renderAll();
}

function showToast(text, onUndo) {
  const t = $('#toast');
  clearTimeout(ui.toastTimer);
  $('#toastText').textContent = text;
  t.hidden = false;
  ui.toastTimer = setTimeout(hideToast, 6000); // 6 秒自动消失（VX-10）
  $('#toastUndo').onclick = () => { hideToast(); if (onUndo) onUndo(); };
  $('#toastX').onclick = hideToast;
}
function hideToast() { clearTimeout(ui.toastTimer); ui.toastTimer = 0; $('#toast').hidden = true; }

/* ============================================================
 * FR-11 主题
 * ============================================================ */
const THEMES = {
  dark: { name: '深色', sub: '默认' },
  light: { name: '浅色', sub: '明亮' },
  indigo: { name: '靛蓝', sub: '夜色' },
  paper: { name: '暖纸', sub: '纸上' },
  cold: { name: '冷峻', sub: '铁灰' },
};
const META_COLORS = { dark: '#11141b', light: '#f2f3f5', indigo: '#0c1230', paper: '#f3ecda', cold: '#14161a' };
function currentTheme() {
  if (store.theme) return store.theme;
  try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  catch (e) { return 'dark'; }
}
function applyTheme() {
  const t = currentTheme();
  document.documentElement.setAttribute('data-theme', t);
  const m = $('#metaTheme');
  if (m) m.setAttribute('content', META_COLORS[t]); // 地址栏配色跟随（FR-11.4）
  $('#themeLabel').textContent = THEMES[t].name;
}
function setTheme(name) {
  if (!THEMES[name] || store.theme === name) return;
  store.theme = name;
  scheduleSave();
  applyTheme();
  if (!themePanelEl.hidden) renderThemePanel();
}
// 仅从未选过主题时跟随系统深浅色变化（E5）
try {
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!store.theme) { applyTheme(); }
  });
} catch (e) {}

const themePanelEl = $('#themePanel');
function renderThemePanel() {
  const cur = currentTheme();
  // 预览色块直接套用该主题的 CSS 变量，保证与真实配色一致（FR-11.3）
  themePanelEl.innerHTML = Object.keys(THEMES).map(key => {
    const t = THEMES[key];
    return `<button class="ti" role="menuitemradio" aria-checked="${key === cur}" data-theme-key="${key}">` +
      `<span class="swatch" data-theme="${key}" aria-hidden="true"><span class="dot"></span><span class="tick">✓</span></span>` +
      `<span class="tname">${t.name}</span><span class="tsub">${t.sub}</span></button>`;
  }).join('');
}
function openThemePanel() {
  closeMenu(false);
  renderThemePanel();
  themePanelEl.hidden = false;
  $('#btnTheme').setAttribute('aria-expanded', 'true');
  const btn = $('#btnTheme').getBoundingClientRect();
  const pw = themePanelEl.offsetWidth;
  // 正下方右对齐展开（FR-11.2）
  themePanelEl.style.left = clamp(btn.right - pw, 8, window.innerWidth - pw - 8) + 'px';
  themePanelEl.style.top = (btn.bottom + 8) + 'px';
  const cur = $(`.ti[data-theme-key="${currentTheme()}"]`, themePanelEl);
  if (cur) cur.focus({ preventScroll: true }); // 焦点落在当前选中项（FR-11.5）
}
function closeThemePanel(focusBtn) {
  if (themePanelEl.hidden) return;
  themePanelEl.hidden = true;
  $('#btnTheme').setAttribute('aria-expanded', 'false');
  if (focusBtn) $('#btnTheme').focus({ preventScroll: true });
}
$('#btnTheme').addEventListener('click', () => {
  themePanelEl.hidden ? openThemePanel() : closeThemePanel(false);
});
themePanelEl.addEventListener('click', e => {
  const b = e.target.closest('.ti');
  if (!b) return;
  setTheme(b.dataset.themeKey); // 选中即生效（FR-11.4）
  closeThemePanel(true);
});
themePanelEl.addEventListener('keydown', e => {
  const items = $$('.ti', themePanelEl);
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
  else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
});
window.addEventListener('pointerdown', e => {
  if (themePanelEl.hidden) return;
  if (!themePanelEl.contains(e.target) && !$('#btnTheme').contains(e.target)) closeThemePanel(false);
}, true);
window.addEventListener('scroll', () => { if (!themePanelEl.hidden) closeThemePanel(false); }, true);
window.addEventListener('resize', () => { if (!themePanelEl.hidden) closeThemePanel(false); });

/* ============================================================
 * Esc 归属顺序（5.5）：一次只关一层；页面级监听，输入法组字时也有效
 * ============================================================ */
let escDownHandled = false;
function escTopLayer() {
  if (ui.modalOpen) return 'modal';
  if (!menuEl.hidden) return 'menu';
  if (!themePanelEl.hidden) return 'theme';
  if (ui.editingId) return 'editing';
  if (ui.multiselect) return 'multi';
  return null;
}
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' && e.keyCode !== 27) return;
  if (e.isComposing || e.keyCode === 229) return; // 组字中 keydown 被输入法接管，交给 keyup 兜底
  const layer = escTopLayer();
  if (layer === 'modal') closeModal();
  else if (layer === 'menu') closeMenu(true);
  else if (layer === 'theme') closeThemePanel(true);
  else if (layer === 'editing') cancelEdit();
  else if (layer === 'multi') exitMultiselect();
  escDownHandled = true;
  e.preventDefault();
  e.stopPropagation();
}, true);
window.addEventListener('keyup', e => {
  if (e.key !== 'Escape' && e.keyCode !== 27) return;
  if (escDownHandled) { escDownHandled = false; return; }
  // keydown 被输入法吞掉时：只关弹层（一次一层，NV-17）
  if (ui.modalOpen) { closeModal(); e.preventDefault(); }
}, true);

/* ============================================================
 * PWA / 初始化
 * ============================================================ */
function init() {
  applyTheme();
  renderAll();
  $('.batchcount').setAttribute('aria-live', 'polite'); // 计数变化播报（FR-9.4）
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}
init();
