/* Wikiponia: main app. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const wikiHref = (t) => '#/wiki/' + encodeURIComponent(t);

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wikiponia.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wikiponia.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settings = Object.assign({ theme: 'auto', ponify: true, motion: !reduceMotion, sparkles: true, sound: true, lang: 'en', name: '' }, store.get('settings', {}));
  Sound.setEnabled(settings.sound);
  let journal = store.get('journal', []);       // [{title, t}] newest first
  let saddlebag = store.get('saddlebag', []);   // [{title, t}]
  const mapMemory = { expanded: [] };
  let current = null;                           // title of the open article
  let pendingTravel = null;                     // title to animate travel to
  const scrollMemory = new Map();
  let currentHash = location.hash;
  let mapInstance = null;
  let map3d = null;           // the 3D table under the Cutie Map, when WebGL is available
  function teardownMap() {
    if (mapInstance) { mapInstance.destroy(); mapInstance = null; }
    if (map3d) { map3d.destroy(); map3d = null; }
  }

  function saveSettings() { store.set('settings', settings); }
  function applyTheme() {
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', settings.theme);
  }
  // Expose background/prop art to CSS as --art-<folder>-<pose> and html.art-<folder>-<pose>.
  const ART = window.ART || {};
  const artUrl = (folder, pose) => ART[folder] && ART[folder][pose] ? new URL(ART[folder][pose].src, location.href).href : null;
  for (const folder of ['bg', 'fx', 'brand']) {
    for (const pose of Object.keys(ART[folder] || {})) {
      document.documentElement.style.setProperty(`--art-${folder}-${pose}`, `url("${artUrl(folder, pose)}")`);
      document.documentElement.classList.add(`art-${folder}-${pose}`);
    }
  }
  Wiki.setLang(settings.lang);
  applyTheme();
  document.documentElement.lang = settings.lang;
  $('#brandMark').innerHTML = artUrl('brand', 'mark') ? `<img src="${artUrl('brand', 'mark')}" alt="">` : Marks.cutieMark('Wikiponia').svg;

  const ponifyOn = () => settings.ponify && Wiki.lang === 'en';
  const pt = (s) => ponifyOn() ? Ponify.text(s) : s;

  function logVisit(title) {
    if (journal[0] && journal[0].title === title) return;
    journal.unshift({ title, t: Date.now() });
    journal = journal.slice(0, 200);
    store.set('journal', journal);
  }
  const inBag = (t) => saddlebag.some(b => b.title === t);
  function toggleBag(t) {
    if (inBag(t)) saddlebag = saddlebag.filter(b => b.title !== t);
    else saddlebag.unshift({ title: t, t: Date.now() });
    store.set('saddlebag', saddlebag);
    return inBag(t);
  }

  function callNumber(title) {
    const h = Marks.hash(title);
    const aisle = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[h % 24];
    return { aisle, shelf: (h >>> 5) % 12 + 1, num: `${(h >>> 8) % 900 + 100}.${(h >>> 18) % 100} ${title.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XYZ'}` };
  }

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  /* ---------- toast ---------- */
  let toastTimer = null;
  const toastQueue = [];
  // Image tag for a pony slot. `flip` mirrors legacy art that faces left.
  function artImg(a, cls = '', flip = false) {
    return `<img class="${cls} ${a.legacy ? 'legacy' : 'art'}${a.legacy && flip ? ' flip' : ''}" src="${a.src}" alt="">`;
  }
  function toast(ponyId, html, ms = 4200, pose) {
    toastQueue.push({ ponyId, html, ms, pose });
    if (toastQueue.length === 1) runToast();
  }
  async function runToast() {
    const t = toastQueue[0];
    if (!t) return;
    const p = Ponies.BY_ID[t.ponyId] || Ponies.BY_ID.twilight;
    const el = $('#ponyToast');
    const a = Ponies.art(p.id, ...(t.pose ? [t.pose] : []), 'bust');
    const img = $('#toastPony');
    img.src = a.src;
    img.className = a.legacy ? 'legacy flip' : 'art';
    $('#toastName').textContent = p.name;
    $('#toastText').innerHTML = t.html;
    el.style.setProperty('--pony', p.color);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    Sound.play([`toast-${p.id}`, p.id === 'pinkie' && 'party-horn', p.id === 'discord' && 'discord-snap', 'pop'].filter(Boolean), { volume: 0.8 });
    el.onclick = () => { clearTimeout(toastTimer); done(); };
    const done = async () => {
      el.classList.remove('show');
      await sleep(300);
      el.hidden = true;
      toastQueue.shift();
      runToast();
    };
    toastTimer = setTimeout(done, t.ms);
  }

  /* ---------- sparkles ---------- */
  document.addEventListener('pointerdown', (ev) => {
    if (!settings.sparkles || !settings.motion) return;
    Sound.play('tap-sparkle', { volume: 0.25, vary: 0.12 });
    const box = $('#sparkles');
    const colors = ['#f26ac0', '#9b6fd1', '#f2c14e', '#5fd0f0', '#ffffff'];
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i');
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 30;
      s.style.left = ev.clientX + 'px'; s.style.top = ev.clientY + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      s.style.setProperty('--c', colors[i % colors.length]);
      box.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }, { passive: true });

  /* ---------- bottom sheet ---------- */
  const sheet = $('#sheet'), backdrop = $('#sheetBackdrop');
  function openSheet(html, cls) {
    $('#sheetBody').innerHTML = html;
    sheet.className = 'sheet ' + (cls || '');
    sheet.hidden = false; backdrop.hidden = false;
    sheet.style.transform = '';
    requestAnimationFrame(() => { sheet.classList.add('open'); backdrop.classList.add('open'); });
    $('#sheetBody').scrollTop = 0;
  }
  async function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    sheet.style.transform = '';
    await sleep(260);
    sheet.hidden = true; backdrop.hidden = true;
  }
  backdrop.addEventListener('click', closeSheet);
  (function dragToClose() {
    let y0 = null, dy = 0;
    sheet.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.sheet-handle, .peek-head, .sheet-title')) return;
      y0 = e.clientY; dy = 0; sheet.setPointerCapture(e.pointerId); sheet.style.transition = 'none';
    });
    sheet.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const up = () => {
      if (y0 == null) return;
      y0 = null; sheet.style.transition = '';
      if (dy > 90) closeSheet(); else sheet.style.transform = '';
    };
    sheet.addEventListener('pointerup', up); sheet.addEventListener('pointercancel', up);
  })();

  /* ---------- peek (cross-reference card) ---------- */
  async function peek(title, opts = {}) {
    Sound.play(['peek', 'page-turn'], { volume: 0.6, vary: 0.05 });
    const mk = Marks.cutieMark(title);
    const cn = callNumber(title);
    openSheet(`<div class="peek" style="--c1:${mk.colors[0]};--c2:${mk.colors[1]}">
      <div class="peek-head">
        <div class="peek-mark">${mk.svg}</div>
        <div><div class="callno">Aisle ${cn.aisle} · Shelf ${cn.shelf} · ${esc(cn.num)}</div><h3>${esc(pt(title))}</h3><div class="peek-desc skel-line"></div></div>
      </div>
      <div class="peek-content"><div class="skel-block"></div></div>
    </div>`, 'sheet-peek');
    let s;
    try { s = await Wiki.summary(title); } catch (e) { s = { title, extract: 'The pages of this book are stuck together. (Network trouble?)' }; }
    if (sheet.hidden) return;
    const shared = opts.fromMap && mapInstance && mapInstance.nodes.get(title) && mapInstance.isShared(mapInstance.nodes.get(title));
    const expanded = mapMemory.expanded.includes(title);
    $('.peek-desc', sheet).classList.remove('skel-line');
    $('.peek-desc', sheet).textContent = pt(s.description || '');
    $('.peek-content', sheet).innerHTML = `
      ${s.thumb ? `<img class="peek-thumb" src="${esc(s.thumb)}" alt="">` : ''}
      ${shared ? `<p class="shared-note">✦ Cross-referenced! This tome is cited by more than one book on your map.</p>` : ''}
      <p class="peek-extract">${esc(pt(s.extract || (s.missing ? 'This book hasn\'t been written yet.' : '')))}</p>
      <div class="peek-actions">
        ${s.missing ? '' : `<button class="btn primary" data-act="open">Open this tome</button>`}
        ${opts.fromMap && !s.missing && !expanded && title !== current ? `<button class="btn" data-act="expand">Cross-reference it</button>` : ''}
        ${!opts.fromMap && !s.missing ? `<button class="btn" data-act="bag">${inBag(s.title) ? 'In saddlebag ✓' : 'Add to saddlebag'}</button>` : ''}
      </div>`;
    $('.peek-actions', sheet).addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      const a = act.dataset.act;
      if (a === 'open') { await closeSheet(); travelTo(s.title); }
      if (a === 'bag') { act.textContent = toggleBag(s.title) ? 'In saddlebag ✓' : 'Add to saddlebag'; }
      if (a === 'expand') { await closeSheet(); expandOnMap(title); }
    });
  }

  /* ---------- library travel animation ---------- */
  const Travel = {
    async start(title) {
      const el = $('#travel');
      const cn = callNumber(title);
      const mk = Marks.cutieMark(title);
      $('#travelCall').innerHTML = `Call no. <b>${esc(cn.num)}</b> · Aisle ${cn.aisle}, shelf ${cn.shelf}`;
      $('#travelCover').innerHTML = `<div class="tbc-mark">${mk.svg}</div><div class="tbc-title">${esc(pt(title))}</div>`;
      const tt = $('#travelCover .tbc-title');
      tt.style.fontSize = title.length > 26 ? '.95rem' : title.length > 15 ? '1.1rem' : '';
      $('#travelCover').style.setProperty('--c1', mk.colors[0]);
      $('#travelCover').style.setProperty('--c2', mk.colors[1]);
      // Run cycle: a numbered sequence (run-000…) from the show rigs, else the old bouncing still.
      const seq = Ponies.frames('twilight', 'run');
      const runner = seq.length ? 'twilight' : ['twilight', 'twilight', 'spike', 'starlight', 'lyra'][Marks.hash(title) % 5];
      const tp = $('#travelPony');
      tp.src = seq.length ? seq[0] : Ponies.art(runner).src;
      tp.classList.toggle('framed', seq.length > 0);
      seq.forEach(src => { const im = new Image(); im.src = src; });   // preload so the cycle doesn't flicker
      let frame = 0;
      const runIv = seq.length > 1 ? setInterval(() => { tp.src = seq[++frame % seq.length]; }, 1000 / 24) : null;
      el.className = 'travel';
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('running');
      Sound.play('book-magic', { volume: 0.9 });       // the magical pad while she runs (book.wav, first 1.68 s)
      Sound.loop('whoosh-loop', { volume: 0.6 });
      const lines = [
        `Searching the stacks for “${esc(pt(title))}”…`,
        `Aisle ${cn.aisle}… shelf ${cn.shelf}…`,
        `Cross-referencing ${3 + Marks.hash(title) % 9} tomes…`,
      ];
      let i = 0;
      const status = $('#travelStatus');
      status.innerHTML = lines[0];
      const iv = setInterval(() => { i = Math.min(i + 1, lines.length - 1); status.innerHTML = lines[i]; }, 520);
      const minTime = sleep(1250);
      return {
        async finish(ok) {
          await minTime;
          clearInterval(iv);
          if (runIv) clearInterval(runIv);
          Sound.stop('whoosh-loop');
          if (ok && Ponies.has(runner, 'found-it')) tp.src = Ponies.art(runner, 'found-it').src;
          if (!ok) { el.classList.add('fade'); await sleep(250); el.hidden = true; return; }
          status.innerHTML = 'Found it!';
          el.classList.add('found');
          Sound.play(['found', 'magic-zap'], { volume: 0.8 });
          await sleep(650);
          el.classList.add('opening');
          Sound.play(['book-open', 'page-turn']);
          await sleep(550);
          el.classList.add('fade');
          await sleep(280);
          el.hidden = true;
          el.className = 'travel';
        },
      };
    },
  };

  function travelTo(title) {
    pendingTravel = settings.motion ? title : null;
    const h = wikiHref(title);
    if (location.hash === h) route(); else location.hash = h;
  }

  /* ---------- Spike's scroll (random article) ---------- */
  async function spikeScroll() {
    const fx = $('#scrollFx');
    if (!settings.motion) {
      try { const t = await Wiki.random(); pendingTravel = null; location.hash = wikiHref(t); } catch (e) { toast('spike', 'The scroll got lost in the mail. Try again?'); }
      return;
    }
    const rigged = Ponies.has('spike', 'burp');
    if (rigged) {
      $('#rigSpike').src = Ponies.art('spike', 'burp').src;
      if (artUrl('fx', 'dragonfire')) $('#rigFire').src = artUrl('fx', 'dragonfire');
      if (artUrl('fx', 'scroll-closed')) $('#scrollClosed').src = artUrl('fx', 'scroll-closed');
    }
    fx.className = 'scroll-fx' + (rigged ? ' rigged' : '');
    fx.hidden = false; void fx.offsetWidth; fx.classList.add('burn');
    Sound.play(['spike-burp', 'magic-zap']);
    // The scroll pops out on the pop inside the burp sound (cue from new_assets/sfx/splits.json).
    const popAt = settings.sound && Sound.available ? Sound.cue('spike-burp', 'pop') : null;
    $('#scrollClosed').style.animationDelay = popAt != null ? popAt + 's' : '';
    // Spike's real green fire from the show (FLA-RE: stk_c07 spike_fire_fire_ref), played frame by frame
    const fireSeq = rigged ? Ponies.frames('fx', 'spike-fire') : [];
    const fireEl = $('#rigFire');
    fireEl.classList.toggle('seq', fireSeq.length > 0);
    if (fireSeq.length) {
      fireSeq.forEach(src => { const im = new Image(); im.src = src; });
      const rig = $('.spike-rig', fx);
      // Aim the flame: its source (15%, 85% of the frame) sits at Spike's breath, its curl (80%, 15%) at the scroll.
      const mouthX = rig.offsetLeft + rig.offsetWidth * 0.9, mouthY = rig.offsetTop + rig.offsetHeight * 0.42;
      const goalX = window.innerWidth / 2, goalY = fx.clientHeight * 0.42;
      const dist = Math.hypot(goalX - mouthX, goalY - mouthY);
      const W = Math.min(dist / 0.95, window.innerWidth * 1.1), H = W * 712 / 700;
      const native = Math.atan2(-0.70 * H, 0.65 * W), want = Math.atan2(goalY - mouthY, goalX - mouthX);
      Object.assign(fireEl.style, {
        width: W + 'px', left: (mouthX - 0.15 * W) + 'px', top: (mouthY - 0.85 * H) + 'px', opacity: 0,
        transformOrigin: '15% 85%', transform: `rotate(${((want - native) * 180 / Math.PI).toFixed(1)}deg)`,
      });
      fireEl.src = fireSeq[0];
      let fi = 0;
      setTimeout(() => {
        fireEl.style.opacity = 1;
        const iv = setInterval(() => {
          if (++fi >= fireSeq.length) { clearInterval(iv); fireEl.style.opacity = 0; return; }
          fireEl.src = fireSeq[fi];
        }, 1000 / 24);
      }, 320);
    } else {
      fireEl.removeAttribute('style');
    }
    $('#scrollText').innerHTML = '';
    let title;
    try { [title] = await Promise.all([Wiki.random(), sleep(rigged ? 1300 : 700)]); }
    catch (e) { fx.hidden = true; toast('spike', 'The scroll got lost in the mail. Try again?'); return; }
    $('#scrollText').innerHTML = `<small>A scroll from Spike!</small><span>${esc(pt(title))}</span>`;
    $('#scrollText span').style.fontSize = title.length > 28 ? '1.05rem' : title.length > 16 ? '1.3rem' : '';
    fx.classList.add('unroll');
    Sound.play(['scroll-unroll', 'page-turn']);
    await sleep(rigged ? 1700 : 1500);
    fx.classList.add('fade');
    pendingTravel = null;
    location.hash = wikiHref(title);
    await sleep(300);
    fx.hidden = true;
  }
  $('#btnScroll').addEventListener('click', spikeScroll);

  /* ---------- search ---------- */
  const layer = $('#searchLayer'), input = $('#searchInput'), catalog = $('#catalog');
  let suggestTimer = null, lastSuggest = [];
  function openSearch(prefill) {
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('open'));
    input.value = prefill || '';
    renderCatalog([]);
    setTimeout(() => input.focus(), 30);
  }
  async function closeSearch() {
    layer.classList.remove('open');
    input.blur();
    await sleep(200);
    layer.hidden = true;
  }
  function renderCatalog(items) {
    const q = input.value.trim();
    if (!q) {
      const recent = [...new Set(journal.map(j => j.title))].slice(0, 6);
      const tries = ['Friendship', 'Magic (supernatural)', 'Rainbow', 'Unicorn', 'Apple', 'Library', 'Star Trek'];
      catalog.innerHTML = `
        ${recent.length ? `<div class="catalog-label">Recently borrowed</div>${recent.map(t => card({ title: t })).join('')}` : ''}
        <div class="catalog-label">Twilight suggests</div>
        <div class="chips">${tries.map(t => `<button class="chip" data-title="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
      return;
    }
    catalog.innerHTML = items.map(card).join('') +
      `<a class="index-card all" href="#/search/${encodeURIComponent(q)}"><div class="ic-mark">✦</div><div><b>Search every shelf for “${esc(q)}”</b><small>Full-text card catalog</small></div></a>`;
  }
  function card(s) {
    const mk = Marks.cutieMark(s.title);
    return `<button class="index-card" data-title="${esc(s.title)}">
      <div class="ic-mark">${s.thumb ? `<img src="${esc(s.thumb)}" alt="">` : mk.svg}</div>
      <div><b>${esc(pt(s.title))}</b>${s.description ? `<small>${esc(pt(s.description))}</small>` : ''}</div>
      <span class="ic-call">${esc(callNumber(s.title).num)}</span>
    </button>`;
  }
  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const q = input.value.trim();
    if (!q) { lastSuggest = []; renderCatalog([]); return; }
    suggestTimer = setTimeout(async () => {
      try {
        const res = await Wiki.suggest(q);
        if (input.value.trim() !== q) return;
        lastSuggest = res;
        renderCatalog(res);
      } catch (e) { /* ignore */ }
    }, 170);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = input.value.trim(); if (!q) return;
    closeSearch();
    if (lastSuggest[0]) travelTo(lastSuggest[0].title);
    else location.hash = '#/search/' + encodeURIComponent(q);
  });
  catalog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-title]');
    if (b) { closeSearch(); travelTo(b.dataset.title); return; }
    if (e.target.closest('a.all')) closeSearch();
  });
  $('#searchBack').addEventListener('click', closeSearch);
  $('#btnSearchTop').addEventListener('click', () => openSearch());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!layer.hidden) closeSearch(); else closeSheet(); }
    if (e.key === '/' && layer.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  /* ---------- theme + settings ---------- */
  $('#btnTheme').addEventListener('click', () => {
    const dark = settings.theme === 'night' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    settings.theme = dark ? 'day' : 'night';
    saveSettings(); applyTheme();
    Sound.play([dark ? 'day' : 'night', 'magic-zap'], { volume: 0.8 });
    toast(dark ? 'celestia' : 'luna', dark ? 'Good morning! I raised the sun for you.' : 'We have raised the moon. Read quietly; ponies are sleeping.', 2800, dark ? 'raise-sun' : 'raise-moon');
  });

  $('#btnSettings').addEventListener('click', () => {
    const langs = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
    openSheet(`<div class="settings">
      ${artUrl('fx', 'spellbook') ? `<img class="spellbook-art" src="${artUrl('fx', 'spellbook')}" alt="">` : ''}
      <h3 class="sheet-title">Spellbook</h3>
      <label class="row"><span><b>Ponify text</b><small>everyone → everypony, hands → hooves (English only)</small></span><input type="checkbox" data-s="ponify" ${settings.ponify ? 'checked' : ''}></label>
      <label class="row"><span><b>Library travel</b><small>Run through the stacks when you open a book</small></span><input type="checkbox" data-s="motion" ${settings.motion ? 'checked' : ''}></label>
      <label class="row"><span><b>Sound effects</b><small>${Sound.available ? 'Page turns, magic, and one very rude dragon' : 'No sounds installed yet'}</small></span><input type="checkbox" data-s="sound" ${settings.sound ? 'checked' : ''}></label>
      <label class="row"><span><b>Tap sparkles</b><small>A little magic on every touch</small></span><input type="checkbox" data-s="sparkles" ${settings.sparkles ? 'checked' : ''}></label>
      <div class="row"><span><b>Sky</b><small>Who controls the sun and moon?</small></span>
        <select data-s="theme"><option value="auto">Auto</option><option value="day">Celestia's day</option><option value="night">Luna's night</option></select></div>
      <div class="row"><span><b>Library language</b><small>Which Wikipedia to read from</small></span>
        <select data-s="lang">${Object.entries(langs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <label class="row"><span><b>Your name</b><small>For signing friendship reports</small></span><input type="text" data-s="name" value="${esc(settings.name)}" placeholder="A curious pony" maxlength="40"></label>
      <button class="btn danger" id="clearJournal">Clear journal & saddlebag</button>
      <p class="credits">Articles from Wikipedia, CC BY-SA 4.0. Pony art extracted from the original show files with FLA-RE. A fan-made joke, not affiliated with Hasbro or the Wikimedia Foundation.</p>
    </div>`, 'sheet-settings');
    $('[data-s=theme]', sheet).value = settings.theme;
    $('[data-s=lang]', sheet).value = settings.lang;
    $$('[data-s]', sheet).forEach(inp => inp.addEventListener('change', () => {
      const k = inp.dataset.s;
      settings[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
      saveSettings();
      if (k === 'theme') applyTheme();
      if (k === 'sound') Sound.setEnabled(settings.sound);
      if (k === 'lang') { Wiki.setLang(settings.lang); document.documentElement.lang = settings.lang; current = null; mapMemory.expanded = []; closeSheet(); location.hash = '#/'; route(); }
      if (k === 'ponify' && current) route();
    }));
    $('#clearJournal').addEventListener('click', () => {
      journal = []; saddlebag = []; mapMemory.expanded = [];
      store.set('journal', journal); store.set('saddlebag', saddlebag);
      closeSheet(); toast('spike', 'Journal cleared! I didn\'t even read it. Much.');
      if (location.hash.startsWith('#/journal') || location.hash.startsWith('#/map')) route();
    });
  });

  /* ---------- views ---------- */
  const view = $('#view');

  function spinesHTML(n, seed) {
    const r = Marks.rng(seed);
    const cols = ['#8e3b5a', '#3b5a8e', '#5a8e3b', '#8e6b3b', '#6b3b8e', '#3b8e7d', '#a8483b', '#2f4f6f', '#7d3b8e', '#c08a3b'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const c = cols[Math.floor(r() * cols.length)];
      h += `<i style="--h:${70 + Math.floor(r() * 30)}%;--w:${10 + Math.floor(r() * 12)}px;--c:${c}${r() > 0.85 ? ';--tilt:-8deg' : ''}"></i>`;
    }
    return h;
  }

  async function renderHome() {
    current = current; // keep last
    const greet = journal.length ? 'Welcome back! Shall we continue our research?' : 'Welcome to the Golden Oak Library! What shall we learn today?';
    view.innerHTML = `
      <section class="home">
        <div class="hero">
          <div class="hero-shelves">${[1, 2, 3, 4].map(i => `<div class="shelf-row">${spinesHTML(26, i * 977)}</div>`).join('')}</div>
          <div class="hero-window"></div>
          ${artImg(Ponies.art('twilight', journal.length ? 'hero-returning' : 'hero-welcome', 'hero-welcome'), 'hero-pony', true)}
          <div class="hero-bubble">${greet}</div>
        </div>
        <button class="ask" id="askBtn"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg><span>Ask the librarian…</span></button>

        <h2 class="sec-title"><span>Today's featured tome</span></h2>
        <div id="featured"><div class="feature-card skel"><div class="skel-block"></div></div></div>

        <h2 class="sec-title"><span>Most borrowed in Equestria</span><small>tap a spine</small></h2>
        <div class="spine-shelf" id="mostRead"><div class="skel-shelf"></div></div>

        <h2 class="sec-title"><span>Wings of the library</span><small>tap to browse</small></h2>
        <div class="wings">${Ponies.WINGS.map(w => {
          const p = Ponies.BY_ID[w.id];
          return `<div class="wing" style="--pony:${p.color}">
            <button class="wing-head">${artImg(Ponies.art(p.id, 'bust'), '', false)}<span><b>${esc(w.title)}</b><small>curated by ${esc(p.name)}</small></span><i class="chev"></i></button>
            <div class="wing-books">${w.topics.map(t => {
              const mk = Marks.cutieMark(t);
              return `<button class="mini-book" data-peek="${esc(t)}" style="--c1:${mk.colors[0]};--c2:${mk.colors[1]}">${mk.svg}<span>${esc(t)}</span></button>`;
            }).join('')}</div>
          </div>`;
        }).join('')}</div>

        <h2 class="sec-title" id="otdTitle"><span>Celestia's chronicle: on this day</span></h2>
        <div id="onThisDay"><div class="skel-block"></div></div>

        <p class="footer-note">Wikiponia reads live from Wikipedia. Every book has its own cutie mark.</p>
      </section>`;
    $('#askBtn').onclick = () => openSearch();
    $$('.wing-head', view).forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));

    let feed;
    try { feed = await Wiki.featured(); } catch (e) { feed = null; }
    if (!view.querySelector('.home')) return;
    const tfa = feed && feed.tfa;
    if (tfa) {
      const t = tfa.normalizedtitle || (tfa.titles && tfa.titles.normalized) || tfa.title.replace(/_/g, ' ');
      const mk = Marks.cutieMark(t);
      $('#featured').innerHTML = `<a class="feature-card" href="${wikiHref(t)}" data-travel="${esc(t)}" style="--c1:${mk.colors[0]};--c2:${mk.colors[1]}">
        ${tfa.thumbnail ? `<img src="${esc(tfa.thumbnail.source)}" alt="">` : `<div class="fc-mark">${mk.svg}</div>`}
        <div class="fc-body"><div class="callno">Featured · ${esc(callNumber(t).num)}</div><h3>${esc(pt(t))}</h3><p>${esc(pt((tfa.extract || '').slice(0, 260)))}…</p></div></a>`;
    } else {
      $('#featured').innerHTML = `<p class="muted">The featured shelf is empty today. Try a wing below!</p>`;
    }
    const most = feed && feed.mostread && feed.mostread.articles;
    if (most && most.length) {
      $('#mostRead').innerHTML = most.slice(0, 24).map((a, i) => {
        const t = a.normalizedtitle || (a.titles && a.titles.normalized) || a.title.replace(/_/g, ' ');
        const mk = Marks.cutieMark(t);
        const hgt = 150 + (Marks.hash(t) % 50);
        return `<button class="spine" data-peek="${esc(t)}" style="--c1:${mk.colors[0]};--c2:${mk.colors[1]};--sh:${hgt}px">
          <span class="spine-mark">${mk.svg}</span><span class="spine-title">${esc(pt(t))}</span><span class="spine-rank">${i + 1}</span></button>`;
      }).join('');
    } else {
      $('#mostRead').innerHTML = `<p class="muted">Nopony has borrowed anything yet today.</p>`;
    }
    const otd = feed && feed.onthisday;
    if (otd && otd.length) {
      $('#onThisDay').innerHTML = `<ol class="chronicle">${otd.slice(0, 6).map(ev => {
        const page = ev.pages && ev.pages[0];
        const t = page ? (page.normalizedtitle || (page.titles && page.titles.normalized) || page.title.replace(/_/g, ' ')) : null;
        return `<li><b>${esc(ev.year)}</b><span>${esc(pt(ev.text))}${t ? ` <button class="link-btn" data-peek="${esc(t)}">Look it up ›</button>` : ''}</span></li>`;
      }).join('')}</ol>`;
    } else {
      $('#otdTitle').remove(); $('#onThisDay').remove();
    }
  }

  async function renderArticle(title) {
    const travel = pendingTravel === title ? pendingTravel : null;
    pendingTravel = null;
    const anim = travel ? await Travel.start(title) : null;
    if (!anim) view.innerHTML = `<div class="loading-book"><div class="lb-book"></div><p>Fetching from the stacks…</p></div>`;
    let art, sum;
    try {
      [art, sum] = await Promise.all([Wiki.article(title), Wiki.summary(title).catch(() => ({}))]);
    } catch (e) {
      if (anim) await anim.finish(false);
      view.innerHTML = `<div class="empty">${artImg(Ponies.art('derpy', 'error'))}<h2>I just don't know what went wrong!</h2><p>We couldn't find “${esc(title)}” in the stacks.</p><button class="btn primary" id="tryAgain">Ask the librarian</button></div>`;
      $('#tryAgain').onclick = () => openSearch(title);
      return;
    }
    if (anim) await anim.finish(true);
    current = art.title;
    logVisit(art.title);
    if (art.title !== title) history.replaceState(null, '', wikiHref(art.title));

    const mk = Marks.cutieMark(art.title);
    const cn = callNumber(art.title);
    const seed = Marks.hash(art.title);
    const annot = Ponies.pickAnnotator(`${sum.description || ''} ${art.leadText.slice(0, 1500)}`, seed, art.title);
    const body = art.chapters.filter(c => c.kind !== 'back');
    const back = art.chapters.filter(c => c.kind === 'back');
    const wide = window.innerWidth > 900;

    view.innerHTML = `
      <article class="book ${anim ? 'from-travel' : 'fade-in'}" style="--c1:${mk.colors[0]};--c2:${mk.colors[1]};--pony:${annot.color}">
        <header class="cover">
          <div class="cover-mark">${mk.svg}</div>
          <div class="callno">Aisle ${cn.aisle} · Shelf ${cn.shelf} · ${esc(cn.num)}</div>
          <h1>${esc(art.displayTitle)}</h1>
          ${sum.description ? `<p class="desc">${esc(sum.description)}</p>` : ''}
          <div class="cover-actions">
            <button class="pill" data-act="bag">${inBag(art.title) ? '★ In saddlebag' : '☆ Saddlebag'}</button>
            <a class="pill" href="#/map">✦ Cutie Map</a>
            ${body.length > 1 ? `<button class="pill" data-act="toc">☰ Chapters</button>` : ''}
            <a class="pill" href="${esc(Wiki.pageUrl(art.title))}" target="_blank" rel="noopener">W ↗</a>
          </div>
        </header>
        <aside class="annot">
          ${artImg(Ponies.art(annot.id, 'bust'), '', true)}
          <div><small>Annotated by ${esc(annot.name)}</small><p>${Ponies.noteFor(annot, seed)}</p></div>
        </aside>
        ${art.infobox ? `<details class="pony-card" ${wide ? 'open' : ''}><summary><span>Trading card</span><i class="chev"></i></summary><div class="pony-card-body">${art.infobox}</div></details>` : ''}
        <div class="prose lead">${art.lead}</div>
        ${body.map((c, i) => `
          <details class="chapter ${c.kind}" id="ch-${esc(c.id)}" ${wide || i === 0 && body.length < 3 ? 'open' : ''}>
            <summary><span class="ch-num">${c.kind === 'seealso' ? 'Cross-references' : 'Chapter ' + (ROMAN[i] || i + 1)}</span><span class="ch-title">${esc(c.heading)}</span><i class="chev"></i></summary>
            <div class="prose">${c.html}</div>
          </details>`).join('')}
        ${back.length ? `<details class="chapter back" id="ch-archives"><summary><span class="ch-num">Appendix</span><span class="ch-title">Canterlot Archives <small>(citations & sources)</small></span><i class="chev"></i></summary>
          <div class="prose">${back.map(c => `<h3>${esc(c.heading)}</h3>${c.html}`).join('')}</div></details>` : ''}
        <footer class="book-end">
          <h3>Cross-references in this tome</h3>
          <div class="chips">${art.links.slice(0, 14).map(t => `<button class="chip" data-peek="${esc(t)}">${esc(pt(t))}</button>`).join('')}</div>
          <p class="license">Text from <a href="${esc(Wiki.pageUrl(art.title))}" target="_blank" rel="noopener">Wikipedia</a> under CC BY-SA 4.0${ponifyOn() ? ', lovingly ponified' : ''}.</p>
        </footer>
      </article>`;

    const bookEl = $('.book', view);
    let changed = 0;
    if (ponifyOn()) changed = Ponify.dom(bookEl);

    const restore = scrollMemory.get(location.hash);
    window.scrollTo(0, travel ? 0 : (restore || 0));

    $('.cover-actions', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'bag') {
        const on = toggleBag(art.title);
        b.textContent = on ? '★ In saddlebag' : '☆ Saddlebag';
        if (on) { Sound.play(['saddlebag', 'pop']); toast('spike', 'Tucked it into your saddlebag!', 2200, 'toast-salute'); }
      }
      if (b.dataset.act === 'toc') showToc(body);
    });

    easterEggs(art, changed);
  }

  function showToc(body) {
    openSheet(`<h3 class="sheet-title">Chapters</h3><ol class="toc">${body.map((c, i) => `<li><button data-ch="${esc(c.id)}"><span>${c.kind === 'seealso' ? '✦' : ROMAN[i] || i + 1}</span>${esc(pt(c.heading))}</button></li>`).join('')}</ol>`, 'sheet-toc');
    $('.toc', sheet).addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      await closeSheet();
      const d = document.getElementById('ch-' + b.dataset.ch);
      if (d) { d.open = true; d.scrollIntoView({ behavior: settings.motion ? 'smooth' : 'auto', block: 'start' }); }
    });
  }

  function easterEggs(art, ponified) {
    const t = `${art.title} ${art.leadText.slice(0, 600)}`;
    if (/star trek|lcars|klingon|starfleet|\bspock\b|uss enterprise|star trot/i.test(t)) {
      if (settings.motion) { const b = $('.book', view); b.classList.add('chaos'); setTimeout(() => b.classList.remove('chaos'), 2600); }
      toast('discord', 'A <i>Star Trek</i> fan, hm? How delightfully beige. Engage… the friendship drive!', 5200, 'starfleet');
      toast('twilight', 'Discord! Put the article back!', 3000, 'toast-scold');
      return;
    }
    if (/my little pony|friendship is magic|\bbron(y|ies)\b/i.test(t)) {
      toast('twilight', 'Wait… is this article about… <i>us</i>?', 3600, 'toast-meta');
      toast('pinkie', 'Fourth wall? What fourth wall? *waves at you*', 3600, 'toast-wave');
      return;
    }
    if (/^wikipedia$/i.test(art.title)) { toast('rarity', 'Ah, our rival encyclopedia. So… unadorned.', 4000, 'toast-sniff'); return; }
    if (/\b(horse|pony|equine|unicorn|pegasus)\b/i.test(art.title)) { toast('fluttershy', 'Oh my… distant cousins!', 3500, 'toast-aww'); return; }
    if (journal.length === 1) { toast('twilight', 'Tap any blue link to <b>cross-reference</b> it without losing your page!', 5000, 'toast-tip'); return; }
    if (journal.length === 4) { toast('spike', 'You\'ve read 4 books! Check the <b>Cutie Map</b> to see how they connect.', 5000, 'toast-salute'); return; }
    if (ponified > 6 && Math.random() < 0.35) toast('lyra', `I ponified ${ponified} passages in this one. You're welcome.`, 3200, 'toast-smug');
  }

  async function renderSearch(q) {
    view.innerHTML = `<section class="results"><h2 class="sec-title"><span>Card catalog: “${esc(q)}”</span></h2><div id="res"><div class="skel-block"></div></div></section>`;
    let res = [];
    try { res = await Wiki.search(q); } catch (e) { /* empty */ }
    const clean = (s) => s.replace(/<span class="searchmatch">/g, '\u0001').replace(/<\/span>/g, '\u0002').replace(/<[^>]+>/g, '');
    $('#res').innerHTML = res.length ? res.map(r => {
      const mk = Marks.cutieMark(r.title);
      const snip = esc(pt(clean(r.snippet).replace(/&quot;/g, '"').replace(/&amp;/g, '&'))).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
      return `<button class="result" data-peek="${esc(r.title)}"><div class="r-mark">${mk.svg}</div><div><b>${esc(pt(r.title))}</b><p>${snip}…</p></div></button>`;
    }).join('') : `<div class="empty">${artImg(Ponies.art('fluttershy', 'no-results'))}<p>Um… nothing on the shelves matches that. Sorry.</p></div>`;
  }

  /* ---------- Cutie Map ---------- */
  async function renderMap() {
    const center = current || (journal[0] && journal[0].title);
    teardownMap();
    if (!center) {
      view.innerHTML = `<div class="empty map-empty">${artImg(Ponies.art('twilight', 'blank-map'))}<h2>The Cutie Map is blank!</h2><p>Open a few books and it will light up with how they connect.</p><button class="btn primary" id="mapAsk">Ask the librarian</button></div>`;
      $('#mapAsk').onclick = () => openSearch();
      return;
    }
    view.innerHTML = `<section class="map-view">
      <div class="map-3d" id="map3d"></div>
      <div class="map-stage" id="mapStage"></div>
      <div class="map-hud">
        <div class="map-title"><b>The Cutie Map</b><small>Centered on ${esc(pt(center))}</small></div>
        <div class="legend"><span class="lg-center">Here</span><span class="lg-trail">Your trail</span><span class="lg-xref">Cross-ref</span><span class="lg-shared">Shared</span></div>
      </div>
      <div class="map-zoom"><button data-z="1.25">+</button><button data-z="0.8">−</button><button data-z="0">◎</button></div>
      <p class="map-hint">Tap a mark to peek. Drag to pan, pinch to zoom.</p>
    </section>`;
    const m = new CutieMap($('#mapStage'), { onTap: (t) => peek(t, { fromMap: true }) });
    mapInstance = m;
    const lift = () => -m.h * 0.12;            // the hologram floats above the table
    m.view.y = lift(); m._apply();
    $('.map-zoom', view).addEventListener('click', (e) => {
      const z = e.target.closest('[data-z]'); if (!z) return;
      const f = +z.dataset.z;
      if (f) m.zoom(f); else if (m.projector) m.projector.reset(); else { m.view = { x: 0, y: lift(), k: 1 }; m._apply(); }
    });
    mountTable(m);
    m.addNode(center, 'center');
    const trail = [];
    for (const j of journal) { if (!trail.includes(j.title)) trail.push(j.title); if (trail.length >= 8) break; }
    trail.forEach(t => m.addNode(t, t === center ? 'center' : 'trail'));
    for (let i = 0; i < trail.length - 1; i++) m.addEdge(trail[i], trail[i + 1], 'trail');
    m.render();
    try {
      const art = await Wiki.article(center);
      if (m._dead) return;
      art.links.slice(0, 18).forEach(l => { m.addNode(l, 'link', center); m.addEdge(center, l, 'xref'); });
      for (const x of mapMemory.expanded) await addExpansion(m, x);
      m.render();
    } catch (e) { /* offline: just show trail */ }
  }

  async function mountTable(m) {
    if (!window.WebGLRenderingContext || !HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) return;
    const mapView = $('.map-view', view);
    try {
      const mod = await import('./map3d.js');
      if (m._dead) return;
      const handle = await mod.mount($('#map3d'), { motion: settings.motion, onFrame: () => m._draw() });
      if (m._dead) { handle.destroy(); return; }
      map3d = handle;
      m.setProjector(handle.projector);
      mapView.classList.add('has-3d');
      $('.map-hint', mapView).textContent = 'Tap a mark to peek. Drag to turn the map, pinch to zoom.';
    } catch (e) {
      console.warn('3D Cutie Map unavailable, using the flat one.', e);
    }
  }

  async function addExpansion(m, title) {
    const art = await Wiki.article(title);
    m.addNode(title, 'expanded');
    art.links.slice(0, 14).forEach(l => { m.addNode(l, 'link', title); m.addEdge(title, l, 'xref'); });
  }

  async function expandOnMap(title) {
    if (!mapInstance) return;
    if (!mapMemory.expanded.includes(title)) mapMemory.expanded.push(title);
    const m = mapInstance;
    const before = Array.from(m.nodes.values()).filter(n => m.isShared(n)).length;
    Sound.play(['crossref', 'magic-zap']);
    try { await addExpansion(m, title); } catch (e) { toast('derpy', 'I dropped that book. Try again?', 4200, 'toast-oops'); return; }
    m.nodes.forEach(n => { if (m.isShared(n)) n.dirty = true; });
    m.render();
    const after = Array.from(m.nodes.values()).filter(n => m.isShared(n)).length;
    const gained = after - before;
    toast('twilight', gained > 0 ? `Cross-referenced! <b>${gained}</b> tome${gained > 1 ? 's are' : ' is'} cited by both books. They glow pink now.` : 'Cross-referenced! No shared citations yet. Try another book.', 4200, gained > 0 ? 'toast-gotcha' : 'toast-tip');
  }

  /* ---------- Journal ---------- */
  function fmtTime(t) {
    const d = new Date(t), now = new Date();
    const same = d.toDateString() === now.toDateString();
    return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  function renderJournal(tab) {
    tab = tab || 'trail';
    const list = tab === 'trail' ? journal : saddlebag;
    view.innerHTML = `<section class="journal">
      <div class="journal-head">
        ${artImg(Ponies.art('spike', 'journal-writing'))}
        <div><h2>Friendship Journal</h2><p>${journal.length} book${journal.length === 1 ? '' : 's'} read · ${saddlebag.length} in saddlebag</p></div>
      </div>
      <div class="seg"><a href="#/journal" class="${tab === 'trail' ? 'on' : ''}">Reading trail</a><a href="#/journal/bag" class="${tab === 'bag' ? 'on' : ''}">Saddlebag</a></div>
      ${journal.length ? `<button class="btn primary report-btn" id="report">✉ Write a friendship report</button>` : ''}
      <ul class="trail">${list.length ? list.map(j => {
        const mk = Marks.cutieMark(j.title);
        return `<li><a href="${wikiHref(j.title)}" data-travel="${esc(j.title)}"><span class="t-mark">${mk.svg}</span><b>${esc(pt(j.title))}</b><time>${fmtTime(j.t)}</time></a></li>`;
      }).join('') : `<li class="empty-li">${tab === 'trail' ? 'No books read yet. The library awaits!' : 'Your saddlebag is empty. Tap ☆ on a book to keep it here.'}</li>`}</ul>
    </section>`;
    const r = $('#report'); if (r) r.onclick = friendshipReport;
  }

  async function friendshipReport() {
    openSheet(`<div class="letter"><div class="skel-block"></div></div>`, 'sheet-letter');
    const titles = [];
    for (const j of journal) { if (!titles.includes(j.title)) titles.push(j.title); if (titles.length >= 5) break; }
    titles.reverse();
    const sums = await Promise.all(titles.map(t => Wiki.summary(t).catch(() => ({ title: t, extract: '' }))));
    const first = (s) => { const m = (s.extract || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : ''; };
    const connectors = ['Today I went to the library and read about', 'Then I cross-referenced', 'That led me to', 'After that, I found a book on', 'Finally, I read about'];
    const paras = sums.map((s, i) => `<p>${connectors[i === sums.length - 1 && i > 0 ? 4 : Math.min(i, 3)]} <b>${esc(s.title)}</b>. ${esc(first(s))}</p>`).join('');
    const name = settings.name || 'A curious pony';
    const html = `<div class="letter">
      <div class="seal">${Marks.cutieMark(name).svg}</div>
      <p class="salute">Dear Princess Celestia,</p>
      ${paras}
      <p>This week I learned that knowledge really is a kind of magic: every book is connected to another book, and you never know which shelf a friend is hiding on.</p>
      <p class="sign">Your faithful student,<br><span>${esc(name)}</span></p>
    </div>
    ${Ponies.has('celestia', 'reading-letter') ? `<img class="art letter-reader" src="${Ponies.art('celestia', 'reading-letter').src}" alt="">` : ''}
    <div class="peek-actions"><button class="btn primary" id="shareLetter">Send by dragonfire</button><button class="btn" id="copyLetter">Copy</button></div>`;
    $('#sheetBody').innerHTML = html;
    const letter = $('.letter', sheet);
    if (ponifyOn()) Ponify.dom(letter);
    const plain = letter.innerText.trim();
    $('#copyLetter').onclick = async () => { try { await navigator.clipboard.writeText(plain); $('#copyLetter').textContent = 'Copied ✓'; } catch (e) { $('#copyLetter').textContent = 'Copy failed'; } };
    $('#shareLetter').onclick = async () => {
      if (navigator.share) { try { await navigator.share({ title: 'A friendship report', text: plain }); } catch (e) { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(plain); } catch (e) { /* ignore */ } toast('spike', '*burp* Sent! (Well, copied to your clipboard.)', 3000, 'toast-burp'); }
    };
  }

  /* ---------- global link handling ---------- */
  let lastTap = 0;
  view.addEventListener('pointerdown', () => { lastTap = performance.now(); }, true);
  view.addEventListener('toggle', (e) => {
    if (performance.now() - lastTap > 700) return;   // ignore chapters that start open
    if (e.target.matches && e.target.matches('details.chapter, details.pony-card') && e.target.open) Sound.play('page-turn', { volume: 0.5, vary: 0.06 });
  }, true);
  view.addEventListener('click', (e) => {
    const xref = e.target.closest('a.xref');
    if (xref) { e.preventDefault(); peek(xref.dataset.title); return; }
    const anchor = e.target.closest('a[data-anchor]');
    if (anchor) {
      e.preventDefault();
      const id = anchor.dataset.anchor;
      const target = document.getElementById(id) || document.getElementById(decodeURIComponent(id));
      if (target) {
        let d = target.closest('details'); while (d) { d.open = true; d = d.parentElement.closest('details'); }
        target.scrollIntoView({ behavior: settings.motion ? 'smooth' : 'auto', block: 'center' });
        target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1600);
      }
      return;
    }
    const pk = e.target.closest('[data-peek]');
    if (pk) { e.preventDefault(); peek(pk.dataset.peek); return; }
    const tr = e.target.closest('[data-travel]');
    if (tr) { e.preventDefault(); travelTo(tr.dataset.travel); }
  });

  /* ---------- router ---------- */
  function setTab(name) {
    $$('.tabbar [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
  }
  async function route() {
    const h = location.hash.replace(/^#/, '') || '/';
    closeSheet();
    document.body.classList.toggle('is-map', h === '/map');
    if (h.startsWith('/wiki/')) {
      setTab('');
      const t = decodeURIComponent(h.slice(6)).replace(/_/g, ' ');
      return renderArticle(t);
    }
    if (h !== '/map') teardownMap();
    if (h === '/map') { setTab('map'); return renderMap(); }
    if (h.startsWith('/journal')) { setTab('journal'); window.scrollTo(0, 0); return renderJournal(h === '/journal/bag' ? 'bag' : 'trail'); }
    if (h.startsWith('/search/')) { setTab(''); window.scrollTo(0, 0); return renderSearch(decodeURIComponent(h.slice(8))); }
    setTab('home');
    await renderHome();
    window.scrollTo(0, scrollMemory.get(location.hash) || 0);
  }
  window.addEventListener('hashchange', () => {
    scrollMemory.set(currentHash, window.scrollY);
    currentHash = location.hash;
    route();
  });
  route();
})();
