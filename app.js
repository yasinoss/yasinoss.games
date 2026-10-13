/* =========================================================
   كتالوج الألعاب — app.js
   ========================================================= */
const PER_PAGE = 24;                       // يقبل القسمة على 3 (جوال) و4 (حاسوب)
const MAX_URL = 1900;                      // حد آمن لطول رابط واتساب
const KEY_CART = 'gameInstallCart2';       // السلة تُخزَّن كأرقام فقط
const KEY_CART_OLD = 'gameInstallCart';    // للترحيل من النسخة القديمة
const KEY_PLATFORM = 'gamePlatform';
const KEY_SORT = 'gameSort';
const KEY_FIELDS = 'gameOrderFields';
const SORTS = ['releaseYearDesc', 'releaseYearAsc', 'name', 'id'];

const state = {
  games: [],
  byId: new Map(),
  config: { siteName: 'كتالوج الألعاب', whatsappNumber: '' },
  platform: null,
  catalogFilter: 'all',
  genre: 'all',          // مفتاح التصنيف (بحروف صغيرة)
  chipsOpen: false,
  limit: PER_PAGE,
  rendered: 0,
  search: '',
  sort: 'releaseYearDesc',
  cart: [],            // قائمة أرقام الألعاب (strings)
  drawerOpen: false
};

const byId = id => document.getElementById(id);
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 286 350"><rect width="286" height="350" fill="#0e1117"/>' +
  '<text x="143" y="180" fill="#4b5568" font-size="20" text-anchor="middle" font-family="sans-serif">لا توجد صورة</text></svg>'
);

/* ---------- أدوات ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } }
};

function norm(v) {
  return String(v ?? '').trim().toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')      // التشكيل والتطويل
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function formatNumber(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function genresOf(g) { return String(g.genre || '').split(/\s*[،,]\s*/).map(t => t.trim()).filter(Boolean); }
const gkey = t => String(t).trim().toLowerCase();
/* رقم اللعبة المعروض: الآحاد والعشرات والمئات فقط (40286 ← 286) */
const displayNum = id => String(id).slice(-3).padStart(3, '0');
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function showToast(msg) {
  const t = byId('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* أي صورة تفشل تُستبدل بصورة بديلة */
document.addEventListener('error', e => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && !el.dataset.fb) { el.dataset.fb = '1'; el.src = PLACEHOLDER; }
}, true);

/* ---------- التوافق مع الأجهزة ---------- */
function compatible(g, platform) {
  if (platform === 'PS3') return g.platform === 'PS3';
  if (platform === 'PS4') return g.platform === 'PS4';
  if (platform === 'PS5') return g.platform === 'PS4' || g.platform === 'PS5';
  return false;
}
function allowedGame(g) {
  if (!compatible(g, state.platform)) return false;
  if (state.platform === 'PS5' && state.catalogFilter !== 'all') return g.platform === state.catalogFilter;
  return true;
}
function platformGames() { return state.games.filter(allowedGame); }

/* ---------- الفرز والفلترة ---------- */
function sortGames(arr) {
  const byName = (a, b) => norm(a.name).localeCompare(norm(b.name), 'ar');
  const seq = g => Number(displayNum(g.id));          // الترقيم الظاهر (286)
  const newest = (a, b) => Number(b.releaseYear) - Number(a.releaseYear) || seq(b) - seq(a) || Number(b.id) - Number(a.id);
  return [...arr].sort((a, b) => {
    if (state.sort === 'id') return Number(a.id) - Number(b.id);
    if (state.sort === 'releaseYearDesc') return newest(a, b);
    if (state.sort === 'releaseYearAsc') return -newest(a, b);
    return byName(a, b);
  });
}
function filteredGames() {
  const q = norm(state.search);
  return sortGames(platformGames().filter(g =>
    (state.genre === 'all' || genresOf(g).some(t => gkey(t) === state.genre)) &&
    (!q || norm(g.name).includes(q) || displayNum(g.id).includes(q) || String(g.id) === q || norm(g.genre).includes(q))
  ));
}

/* ---------- السلة ---------- */
function cartGames() { return state.cart.map(id => state.byId.get(id)).filter(Boolean); }
function inCart(id) { return state.cart.includes(String(id)); }
function saveCart() { store.set(KEY_CART, JSON.stringify(state.cart)); }
function loadCart() {
  try {
    let ids = JSON.parse(store.get(KEY_CART) || 'null');
    if (!Array.isArray(ids)) {                       // ترحيل من الصيغة القديمة (كائنات كاملة)
      const old = JSON.parse(store.get(KEY_CART_OLD) || '[]');
      ids = Array.isArray(old) ? old.map(x => (x && typeof x === 'object' ? x.id : x)) : [];
    }
    state.cart = [...new Set(ids.map(String))];
  } catch { state.cart = []; }
}
function pruneCart() {              // يحذف ما لم يعد موجودًا أو غير متوافق
  const before = state.cart.length;
  state.cart = state.cart.filter(id => {
    const g = state.byId.get(id);
    return g && (!state.platform || compatible(g, state.platform));
  });
  if (state.cart.length !== before) { saveCart(); return before - state.cart.length; }
  return 0;
}

function toggleCart(g) {
  const id = String(g.id);
  const i = state.cart.indexOf(id);
  if (i >= 0) { state.cart.splice(i, 1); showToast('تمت إزالة اللعبة من الطلب'); }
  else { state.cart.push(id); showToast('تمت إضافة اللعبة إلى الطلب'); }
  saveCart();
  refreshAddButtons();
  renderCart();
}

function refreshAddButtons() {
  document.querySelectorAll('#gamesGrid .game-card').forEach(card => {
    const added = inCart(card.dataset.id);
    const b = card.querySelector('.add-btn');
    b.classList.toggle('added', added);
    b.textContent = added ? '✓ تمت الإضافة' : '＋ إضافة للطلب';
  });
}

function renderCart() {
  const games = cartGames();
  const total = games.reduce((s, g) => s + Number(g.size || 0), 0);
  byId('cartCount').textContent = games.length;
  byId('cartTotalGames').textContent = games.length;
  byId('cartTotalSize').textContent = `${formatNumber(total)} GB`;
  byId('barCount').textContent = games.length;
  byId('barSize').textContent = `${formatNumber(total)} GB`;
  byId('cartEmpty').classList.toggle('hidden', games.length !== 0);
  byId('sentNote').classList.add('hidden');

  const items = byId('cartItems');
  items.innerHTML = games.map(g => `
    <div class="cart-item">
      <img class="cart-thumb" src="${escapeHtml(g.image)}" alt="${escapeHtml(g.name)}" width="64" height="78">
      <div class="cart-item-body">
        <p class="cart-item-title"><bdi>[${displayNum(g.id)}] ${escapeHtml(g.name)}</bdi></p>
        <div class="cart-item-meta">${escapeHtml(g.platform)} • <span dir="ltr">${escapeHtml(g.size)} GB</span></div>
        <button class="remove-btn" data-remove-id="${escapeHtml(g.id)}" type="button">إزالة</button>
      </div>
    </div>`).join('');
  updateBar();
}
function updateBar() {
  const show = state.cart.length > 0 && !state.drawerOpen;
  byId('cartBar').classList.toggle('hidden', !show);
  document.body.classList.toggle('has-bar', show);
}

function openCart() {
  state.drawerOpen = true;
  const d = byId('cartDrawer');
  d.inert = false;
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  openCart.opener = document.activeElement;
  updateBar();
  byId('closeCartBtn').focus();
}
function closeCart() {
  state.drawerOpen = false;
  const d = byId('cartDrawer');
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  d.inert = true;
  document.body.style.overflow = '';
  updateBar();
  if (openCart.opener && openCart.opener.focus) openCart.opener.focus();
}

/* ---------- عرض الألعاب ---------- */
function cardHtml(g) {
  const added = inCart(g.id);
  return `
    <div class="game-image-wrap">
      <img class="game-image" src="${escapeHtml(g.image)}" alt="${escapeHtml(g.name)}" width="286" height="350" loading="lazy" decoding="async">
      ${trailerBadge(g)}
    </div>
    <div class="game-body">
      <h3 class="game-title" dir="auto">${escapeHtml(g.name)}</h3>
      <div class="meta"><span dir="ltr">${escapeHtml(g.size)} GB</span><span>${escapeHtml(g.releaseYear)}</span></div>
      <p class="game-genre" dir="auto">${escapeHtml(g.genre)}</p>
      <button class="add-btn ${added ? 'added' : ''}" type="button">${added ? '✓ تمت الإضافة' : '＋ إضافة للطلب'}</button>
    </div>`;
}

function renderGames(append = false) {
  const arr = filteredGames();
  const grid = byId('gamesGrid');
  if (!append) { grid.innerHTML = ''; state.rendered = 0; }

  const end = Math.min(state.limit, arr.length);
  const frag = document.createDocumentFragment();
  for (const g of arr.slice(state.rendered, end)) {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.dataset.id = g.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `عرض تفاصيل ${g.name}`);
    card.innerHTML = cardHtml(g);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
  state.rendered = end;

  byId('emptyState').classList.toggle('hidden', arr.length !== 0);
  byId('resultSummary').textContent = `${arr.length} لعبة`;
  byId('activeFilters').textContent = [
    state.search ? `بحث: ${state.search}` : '',
    state.genre !== 'all' ? `التصنيف: ${(document.querySelector('.chip.active')?.textContent || state.genre).replace(/\s*\(\d+\)$/, '')}` : '',
    ''
  ].filter(Boolean).join(' • ');

  const pg = byId('pagination');
  pg.innerHTML = '';
  if (arr.length > end) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-btn more-btn';
    b.textContent = `عرض المزيد (${arr.length - end} متبقية)`;
    b.onclick = () => { state.limit += PER_PAGE; renderGames(true); };
    pg.appendChild(b);
  }
}
function resetAndRender() { state.limit = PER_PAGE; renderGames(false); }

const CHIP_LIMIT = 10;
function renderChips() {
  const map = new Map();                                  // مفتاح ← {n, forms}
  for (const g of platformGames()) {
    for (const k of new Set(genresOf(g).map(gkey))) {
      if (!map.has(k)) map.set(k, { n: 0, forms: new Map() });
      map.get(k).n++;
    }
    for (const t of genresOf(g)) { const f = map.get(gkey(t)).forms; f.set(t, (f.get(t) || 0) + 1); }
  }
  const tags = [...map.entries()].map(([k, v]) => ({
    key: k, n: v.n,
    label: [...v.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]   // الصيغة الأكثر استخدامًا كما كتبتها
  })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));

  if (state.genre !== 'all' && !map.has(state.genre)) state.genre = 'all';
  let shown = state.chipsOpen ? tags : tags.slice(0, CHIP_LIMIT);
  const active = tags.find(t => t.key === state.genre);
  if (active && !shown.includes(active)) shown = [...shown, active];

  const chip = (key, label) =>
    `<button type="button" class="chip ${state.genre === key ? 'active' : ''}" data-genre="${escapeHtml(key)}" aria-pressed="${state.genre === key}">${escapeHtml(label)}</button>`;
  const rest = tags.length - CHIP_LIMIT;
  const more = rest > 0
    ? `<button type="button" class="chip chip-more" data-more="1">${state.chipsOpen ? 'عرض أقل' : `+${rest} تصنيف`}</button>` : '';
  byId('genreChips').classList.toggle('open', state.chipsOpen);
  byId('genreChips').innerHTML = chip('all', 'الكل') + shown.map(t => chip(t.key, `${t.label} (${t.n})`)).join('') + more;
}

function scrollCatalog() { byId('catalogSection').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

/* ---------- العرض الدعائي (Trailer) ---------- */
function parseTrailer(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  let h; try { h = new URL(u); } catch { return null; }
  const host = h.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = h.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (h.pathname === '/watch') id = h.searchParams.get('v');
    else { const m = h.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
  }
  if (id && /^[\w-]{11}$/.test(id)) return { type: 'youtube', id, url: u };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = h.pathname.match(/(\d{6,})/);
    if (m) return { type: 'vimeo', id: m[1], url: u };
  }
  if (/\.(mp4|webm|ogv)$/i.test(h.pathname)) return { type: 'file', url: u };
  return { type: 'link', url: u };
}
function trailerBadge(g) {
  return parseTrailer(g.trailer) ? '<span class="trailer-badge" title="يتوفر عرض دعائي" aria-label="يتوفر عرض دعائي">▶</span>' : '';
}
function trailerHtml(g) {
  const t = parseTrailer(g.trailer);
  if (!t) return '';
  let body;
  if (t.type === 'file') {
    body = `<div class="trailer-box"><video controls preload="metadata" playsinline src="${escapeHtml(t.url)}"></video></div>`;
  } else if (t.type === 'link') {
    body = `<a class="trailer-link" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">▶ مشاهدة العرض الدعائي</a>`;
  } else {
    const poster = t.type === 'youtube' ? `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg` : g.image;
    body = `<div class="trailer-box" data-type="${t.type}" data-id="${escapeHtml(t.id)}">
      <button class="trailer-play" type="button" aria-label="تشغيل العرض الدعائي">
        <img src="${escapeHtml(poster)}" alt="" loading="lazy">
        <span class="play-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg></span>
      </button>
    </div>`;
  }
  return `<div class="trailer-block"><span class="trailer-label">العرض الدعائي</span>${body}</div>`;
}
function playTrailer(box, name) {
  const { type, id } = box.dataset;
  const src = type === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
    : `https://player.vimeo.com/video/${id}?autoplay=1`;
  box.innerHTML = `<iframe src="${src}" title="${escapeHtml(name)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

/* ---------- زر العودة لأعلى ---------- */
function initToTop() {
  const b = byId('toTop');
  if (!b) return;
  const ring = b.querySelector('.ring-fg');
  const C = 2 * Math.PI * 21;
  ring.style.strokeDasharray = C;
  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const show = y > 400;
    b.classList.toggle('show', show);
    b.setAttribute('aria-hidden', String(!show));
    b.tabIndex = show ? 0 : -1;
    ring.style.strokeDashoffset = C * (1 - (max > 0 ? Math.min(1, y / max) : 0));
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  b.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  update();
}

/* ---------- تفاصيل اللعبة ---------- */
function showGameDetails(g) {
  closeDetails();
  const opener = document.activeElement;
  const m = document.createElement('div');
  m.className = 'details-modal';
  m.innerHTML = `
    <div class="drawer-backdrop" style="opacity:1"></div>
    <section class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(g.name)}">
      <div class="modal-media" title="اضغط للإغلاق">
        <img class="modal-cover" src="${escapeHtml(g.image)}" alt="${escapeHtml(g.name)}" width="286" height="350">
      </div>
      <div class="modal-copy">
        <span class="section-kicker">تفاصيل اللعبة</span>
        <h2 dir="auto">${escapeHtml(g.name)}</h2>
        <div class="detail-list">
          <div><span>رقم اللعبة</span><strong dir="ltr">#${displayNum(g.id)}</strong></div>
          <div><span>المنصة</span><strong>${escapeHtml(g.platform)}</strong></div>
          <div><span>الحجم</span><strong dir="ltr">${escapeHtml(g.size)} GB</strong></div>
          <div><span>سنة الإصدار</span><strong>${escapeHtml(g.releaseYear)}</strong></div>
          <div><span>النوع</span><strong>${escapeHtml(g.genre)}</strong></div>
        </div>
        ${trailerHtml(g)}
        ${g.notes ? `<p class="detail-notes" dir="auto">${escapeHtml(g.notes)}</p>` : ''}
        <button class="solid-btn detail-add" type="button">${inCart(g.id) ? 'إزالة من الطلب' : 'إضافة للطلب'}</button>
      </div>
    </section>`;
  document.body.appendChild(m);
  document.body.style.overflow = 'hidden';
  const close = () => closeDetails(opener);
  m.querySelector('.modal-media').onclick = close;          // الضغط على الصورة يغلق النافذة
  const tp = m.querySelector('.trailer-play');
  if (tp) tp.onclick = () => { playTrailer(tp.parentElement, g.name); };
  m.querySelector('.drawer-backdrop').onclick = close;
  m.querySelector('.detail-add').onclick = () => { toggleCart(g); close(); };
  m.querySelector('.modal-card').setAttribute('tabindex', '-1');
  m.querySelector('.modal-card').focus();
}
function closeDetails(opener) {
  const old = document.querySelector('.details-modal');
  if (!old) return;
  old.remove();
  if (!state.drawerOpen) document.body.style.overflow = '';
  if (opener && opener.focus) opener.focus();
}

/* ---------- اختيار الجهاز ---------- */
/* مفتاح الرأس يظهر فقط بعد أن يغيب مفتاح الاستقبال عن الشاشة */
state.pickerVisible = true;
function updateHeaderSwitch() {
  byId('headerSwitch').classList.toggle('hidden', !(state.platform && !state.pickerVisible));
}
function watchPicker() {
  const el = byId('platformSection');
  if (!('IntersectionObserver' in window) || !el) { state.pickerVisible = false; return; }
  const header = document.querySelector('.site-header');
  const offset = (header ? header.offsetHeight : 72) + 'px';
  new IntersectionObserver(entries => {
    state.pickerVisible = entries[0].isIntersecting;
    updateHeaderSwitch();
  }, { rootMargin: `-${offset} 0px 0px 0px` }).observe(el);
}

const THEME_COLORS = { PS4: '#0c1730', PS5: '#160f33', PS3: '#12171d', none: '#0a0b12' };
const RULES = { PS4: 'لعبة PS4', PS5: 'لعبة PS4 وPS5', PS3: 'لعبة PS3' };

function updateSwitches() {
  document.querySelectorAll('.device-switch:not(.view-switch)').forEach(sw => {
    const opts = [...sw.querySelectorAll('[data-platform]')].filter(b => !b.classList.contains('hidden'));
    const i = opts.findIndex(b => b.dataset.platform === state.platform);
    sw.style.setProperty('--n', opts.length || 1);
    sw.classList.toggle('has-value', i >= 0);
    if (i >= 0) sw.style.setProperty('--i', i);
    opts.forEach(b => {
      const on = b.dataset.platform === state.platform;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  });
}

/* مفتاح العرض (PS4 / PS5 / الكل) داخل قائمة PS5 — الافتراضي PS5 */
function updateViewSwitch() {
  const sw = byId('viewSwitch');
  const opts = [...sw.querySelectorAll('[data-view]')];
  const i = opts.findIndex(b => b.dataset.view === state.catalogFilter);
  sw.style.setProperty('--n', opts.length);
  sw.classList.toggle('has-value', i >= 0);
  if (i >= 0) sw.style.setProperty('--i', i);
  opts.forEach(b => {
    const on = b.dataset.view === state.catalogFilter;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on);
  });
}

function selectPlatform(platform, { scroll = false, silent = false } = {}) {
  if (state.platform && platform === state.platform) return;
  if (state.platform) {                                  // تغيير جهاز مع وجود سلة
    const bad = cartGames().filter(g => !compatible(g, platform));
    if (bad.length) {
      const ok = confirm(`في سلتك ${bad.length} لعبة غير متوافقة مع ${platform} وسيتم حذفها من الطلب. هل تريد المتابعة؟`);
      if (!ok) return;
    }
  }
  state.platform = platform;
  store.set(KEY_PLATFORM, platform);
  state.catalogFilter = platform === 'PS5' ? 'PS5' : 'all';     // الافتراضي مع PS5: ألعاب PS5
  state.genre = 'all';

  const removed = pruneCart();
  if (removed && !silent) showToast(`تم حذف ${removed} لعبة غير متوافقة مع ${platform}`);

  /* الثيم: ألوان الموقع كلها تتبع الجهاز المختار */
  document.documentElement.dataset.platform = platform;
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = THEME_COLORS[platform] || THEME_COLORS.none;

  byId('selectedPlatformRule').textContent = `${state.games.filter(g => compatible(g, platform)).length} ${RULES[platform]}`;
  updateHeaderSwitch();
  byId('platformFilterBox').classList.toggle('hidden', platform !== 'PS5');
  byId('catalogSection').classList.remove('hidden');
  updateSwitches();
  updateViewSwitch();

  renderChips();
  resetAndRender();
  renderCart();
  if (scroll) setTimeout(scrollCatalog, 380);          // بعد انتهاء حركة المفتاح
}

/* ---------- واتساب ---------- */
function buildMessage(compact) {
  const games = cartGames();
  const total = games.reduce((s, g) => s + Number(g.size || 0), 0);
  const name = byId('customerName').value.trim();
  const note = byId('customerNote').value.trim();
  const lines = ['السلام عليكم', ''];
  if (name) lines.push(`الاسم: ${name}`);
  lines.push(`الجهاز: ${state.platform}`, '', 'أريد طلب تنصيب الألعاب التالية:', '');
  games.forEach((g, i) => lines.push(compact
    ? `${i + 1}. [${displayNum(g.id)}] ${g.name} (${g.platform})`
    : `${i + 1}. [${displayNum(g.id)}] ${g.name} — ${g.platform} — ${g.size} GB`));
  lines.push('', `عدد الألعاب: ${games.length}`, `إجمالي المساحة: ${formatNumber(total)} GB`);
  if (note) lines.push('', `ملاحظة: ${note}`);
  return lines.join('\n');
}

function sendWhatsApp() {
  if (!state.cart.length) { showToast('السلة فارغة'); return; }
  const number = String(state.config.whatsappNumber || '').replace(/\D/g, '');
  if (!number || number.includes('XXXXXXXX')) { showToast('ضع رقم واتساب الحقيقي في config.json'); return; }

  store.set(KEY_FIELDS, JSON.stringify({ name: byId('customerName').value, note: byId('customerNote').value }));
  const link = t => `https://wa.me/${number}?text=${encodeURIComponent(t)}`;

  let text = buildMessage(false);
  if (link(text).length > MAX_URL) text = buildMessage(true);

  if (link(text).length <= MAX_URL) {
    window.open(link(text), '_blank', 'noopener');
  } else {
    /* الطلب طويل جدًا: ننسخه ونفتح المحادثة برسالة قصيرة */
    const full = text;
    const games = cartGames();
    const short = `السلام عليكم\nالجهاز: ${state.platform}\nلدي طلب من ${games.length} لعبة، سأرسل القائمة في الرسالة التالية.`;
    const copying = navigator.clipboard && navigator.clipboard.writeText(full);
    window.open(link(short), '_blank', 'noopener');
    if (copying) {
      copying.then(() => showToast('الطلب طويل: تم نسخ القائمة، الصقها في المحادثة'))
             .catch(() => showToast('الطلب طويل جدًا، قسّمه إلى طلبين'));
    } else {
      showToast('الطلب طويل جدًا، قسّمه إلى طلبين');
    }
  }
  byId('sentNote').classList.remove('hidden');
}

function clearCart() { state.cart = []; saveCart(); renderCart(); refreshAddButtons(); }

/* ---------- تحميل البيانات ---------- */
async function loadJson(url) {
  const r = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
async function boot() {
  loadCart();
  if (location.protocol === 'file:') { showLocalLoader(); return; }
  try {
    const [games, config] = await Promise.all([loadJson('games.json'), loadJson('config.json')]);
    init(games, config);
  } catch (err) {
    showFatal('تعذر تحميل بيانات الموقع. تأكد من وجود games.json و config.json بجانب ملفات الموقع.');
    console.error(err);
  }
}
function showFatal(msg) {
  document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b0d12;color:#f5f7fb;font-family:system-ui"><section style="max-width:560px;background:#121620;border:1px solid #252b38;padding:28px;border-radius:20px"><h1 style="margin-top:0">تعذر تحميل الموقع</h1><p style="color:#9ba3b5;line-height:1.8">${escapeHtml(msg)}</p></section></main>`;
}
function showLocalLoader() {
  const box = document.createElement('div');
  box.className = 'local-loader';
  box.id = 'localLoader';
  box.innerHTML = `<section class="local-loader-card"><span class="section-kicker">تشغيل محلي</span><h2>تحميل ملفات الموقع</h2><p>عند فتح index.html مباشرة بالنقر المزدوج، يمنع المتصفح قراءة JSON تلقائيًا. اختر الملفين مرة واحدة ليعمل الموقع محليًا. على GitHub Pages سيتم تحميلهما تلقائيًا.</p><div class="local-loader-grid"><div class="file-pick"><label for="localGames">games.json</label><input id="localGames" type="file" accept="application/json,.json"></div><div class="file-pick"><label for="localConfig">config.json</label><input id="localConfig" type="file" accept="application/json,.json"></div></div><button class="solid-btn" id="localStart" type="button" disabled>تشغيل الموقع</button></section>`;
  document.body.appendChild(box);
  let gf = null, cf = null;
  const check = () => { byId('localStart').disabled = !(gf && cf); };
  byId('localGames').onchange = e => { gf = e.target.files[0] || null; check(); };
  byId('localConfig').onchange = e => { cf = e.target.files[0] || null; check(); };
  byId('localStart').onclick = async () => {
    try {
      const games = JSON.parse(await gf.text()), config = JSON.parse(await cf.text());
      box.remove();
      init(games, config);
    } catch { showToast('تأكد من صحة ملفي JSON'); }
  };
}

/* ---------- التهيئة ---------- */
function init(games, config) {
  if (!Array.isArray(games)) throw new Error('games.json يجب أن يكون Array');
  state.games = games;
  state.byId = new Map(games.map(g => [String(g.id), g]));
  state.config = { ...state.config, ...(config || {}) };
  const siteName = String(state.config.siteName || 'كتالوج الألعاب').trim();
  document.title = siteName;
  const [brandMain, ...brandRest] = siteName.split(/\s+/);
  document.querySelectorAll('[data-brand-main]').forEach(el => { el.textContent = brandMain; });
  document.querySelectorAll('[data-brand-sub]').forEach(el => { el.textContent = brandRest.join(' '); el.classList.toggle('hidden', !brandRest.length); });

  if (state.config.tagline) byId('heroLead').textContent = state.config.tagline;
  byId('heroSub').textContent = (state.config.subtitle ||
    'اختر جهازك، تصفّح {count} لعبة، وأرسل طلب التنصيب كاملًا عبر واتساب في رسالة واحدة.').replace(/\{count\}/g, String(games.length));

  const hasPS3 = games.some(g => g.platform === 'PS3');
  document.querySelectorAll('.ps3-opt').forEach(b => b.classList.toggle('hidden', !hasPS3));
  updateSwitches();
  watchPicker();

  const savedSort = store.get(KEY_SORT);
  if (SORTS.includes(savedSort)) state.sort = savedSort;
  byId('sortSelect').value = state.sort;

  try {
    const f = JSON.parse(store.get(KEY_FIELDS) || '{}');
    byId('customerName').value = f.name || '';
    byId('customerNote').value = f.note || '';
  } catch { /* تجاهل */ }

  /* الجهاز */
  document.querySelectorAll('.device-switch [data-platform]').forEach(b => {
    b.onclick = () => {
      const first = byId('catalogSection').classList.contains('hidden');
      selectPlatform(b.dataset.platform, { scroll: first });
    };
  });

  /* الفلاتر */
  const searchInput = byId('searchInput');
  const applySearch = debounce(() => { state.search = searchInput.value; resetAndRender(); }, 200);
  searchInput.oninput = () => { byId('clearSearch').classList.toggle('hidden', !searchInput.value); applySearch(); };
  byId('clearSearch').onclick = () => {
    searchInput.value = ''; state.search = ''; byId('clearSearch').classList.add('hidden');
    resetAndRender(); searchInput.focus();
  };
  byId('sortSelect').onchange = e => { state.sort = e.target.value; store.set(KEY_SORT, state.sort); resetAndRender(); };
  byId('viewSwitch').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === state.catalogFilter) return;
    state.catalogFilter = b.dataset.view;
    state.genre = 'all';
    updateViewSwitch(); renderChips(); resetAndRender();
  });
  byId('genreChips').onclick = e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    if (c.dataset.more) { state.chipsOpen = !state.chipsOpen; renderChips(); return; }
    state.genre = c.dataset.genre;
    renderChips();
    resetAndRender();
  };
  byId('resetFilters').onclick = () => {
    searchInput.value = ''; state.search = ''; state.genre = 'all';
    state.catalogFilter = state.platform === 'PS5' ? 'PS5' : 'all';
    byId('clearSearch').classList.add('hidden');
    updateViewSwitch(); renderChips(); resetAndRender();
  };

  /* الشبكة (تفويض الأحداث) */
  const grid = byId('gamesGrid');
  grid.addEventListener('click', e => {
    const card = e.target.closest('.game-card');
    if (!card) return;
    const g = state.byId.get(card.dataset.id);
    if (!g) return;
    if (e.target.closest('.add-btn')) toggleCart(g); else showGameDetails(g);
  });
  grid.addEventListener('keydown', e => {
    const card = e.target.closest('.game-card');
    if (!card || e.target.closest('.add-btn')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showGameDetails(state.byId.get(card.dataset.id)); }
  });

  /* السلة */
  const drawer = byId('cartDrawer');
  drawer.inert = true;
  byId('cartBtn').onclick = openCart;
  byId('cartBar').onclick = openCart;
  byId('closeCartBtn').onclick = closeCart;
  byId('drawerBackdrop').onclick = closeCart;
  byId('cartItems').addEventListener('click', e => {
    const b = e.target.closest('[data-remove-id]');
    if (b) { const g = state.byId.get(b.dataset.removeId); if (g) toggleCart(g); }
  });
  byId('clearCartBtn').onclick = () => {
    if (!state.cart.length) return;
    if (confirm('إفراغ سلة الطلب؟')) clearCart();
  };
  byId('sentClearBtn').onclick = () => { clearCart(); showToast('تم إفراغ السلة'); };
  byId('sendWhatsAppBtn').onclick = sendWhatsApp;
  ['customerName', 'customerNote'].forEach(id => {
    byId(id).oninput = () => store.set(KEY_FIELDS, JSON.stringify({ name: byId('customerName').value, note: byId('customerNote').value }));
  });

  /* لوحة المفاتيح: Esc + حصر التنقل داخل النوافذ */
  document.addEventListener('keydown', e => {
    const modal = document.querySelector('.details-modal .modal-card');
    if (e.key === 'Escape') {
      if (modal) closeDetails(); else if (state.drawerOpen) closeCart();
      return;
    }
    if (modal) trapTab(e, modal);
    else if (state.drawerOpen) trapTab(e, document.querySelector('.drawer-panel'));
  });

  renderCart();
  initToTop();

  /* استرجاع الجهاز المحفوظ */
  const saved = store.get(KEY_PLATFORM);
  if (saved && ['PS4', 'PS5', 'PS3'].includes(saved) && (saved !== 'PS3' || hasPS3)) {
    const removed = (() => { state.platform = saved; const n = pruneCart(); state.platform = null; return n; })();
    selectPlatform(saved, { silent: true });
    if (removed) showToast(`تم حذف ${removed} لعبة غير متوافقة من طلبك السابق`);
  } else {
    pruneCart();
    renderCart();
  }
}

function trapTab(e, root) {
  if (e.key !== 'Tab' || !root) return;
  const f = [...root.querySelectorAll('button,input,select,a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

boot();
