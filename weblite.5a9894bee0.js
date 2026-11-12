/* LITE-REMOTE: 빠른 모드 — lite's Browser drawn on the server (docs/contracts/LITE-REMOTE.md). MIT, ours.
 * The server (tools/weblite/remote/remote.py) runs ZeusOs's engine natively — fetch, scripts, layout, paint — and sends
 * the page as WebP tiles plus its link rectangles. This file shows them in a native scrolling layer over the Browser's page
 * area: scrolling is the phone's own (instant, over the tiles it has; the next screens are fetched ahead), taps and typing
 * go to the server, a tapped link lights up at once. The Browser app (tools/weblite/browser.c: address bar, history, Back,
 * reload) is unchanged: this replaces the br_* calls weblite.js gives it, and falls back to them (prog/web.wasm in the
 * phone) when the setting is off or the server does not answer. Built in front of weblite.js (tools/weblite/build.sh).
 * Setting: localStorage 'lite-browser-fast' = '1' on / '0' off; unset = on when /remote/ping answers. */
(function () {
  'use strict';
// TRY-SELF: the server-free try build (it lives under /try on the site; tests: ?try=1). Decided here, first, because the bundle's other files ask it.
window.__try = new URLSearchParams(location.search).get('try') === '1' || /^\/try(\/|$)/.test(location.pathname);   // https://nanumos.com/try and /try/<app> (tools/weblite/try_pack.py makes the folder)
  const APP_WEB = 5, KEY = 'lite-browser-fast', MODE = 'lite-browser-mode', MARK = [10, 20, 30, 40];
  const R = window.LiteRemote = { state: null };
  R.install = function (env, c) {
    const orig = { open: env.br_open, paint: env.br_paint, link: env.br_link, click: env.br_click, tick: env.br_tick, info: env.br_info };
    const log = (s) => c.log.push(s);
    const tab = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    let ping = null, backends = [];   // ping: null not known yet, true/false; backends the server has ('chrome', 'zeus')
    const pong = (j) => { ping = !!(j && j.ok); backends = (j && j.backends) || ['zeus']; };
    const pinged = window.__try ? Promise.resolve(pong(null)) : fetch('remote/ping', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { pong(j); log('WEB remote ping ' + ping + ' ' + backends.join(',')); }).catch(() => { ping = false; log('WEB remote ping false'); });
    const setting = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
    // the Browser's engine (owner 11-02: Chromium for now, ours long-term): 'chrome' = headless Chromium on the server,
    // 'zeus' = our engine on the server, 'phone' = our engine in this phone (prog/web.wasm). Unset: chrome when the server has it.
    const chosen = () => { let m = null; try { m = localStorage.getItem(MODE); } catch (e) { /* private mode */ } return m || (setting() === '0' ? 'phone' : null); };
    const mode = () => { const m = chosen(); if (m === 'phone' || ping !== true) return 'phone'; if (m && backends.includes(m)) return m; return backends.includes('chrome') ? 'chrome' : 'zeus'; };
    const wanted = () => mode() !== 'phone';
    // ---- the layer ----
    const css = (el, s) => { el.style.cssText = s; return el; };
    const root = css(document.createElement('div'), 'position:fixed;display:none;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fff;z-index:5;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent');
    root.id = 'lite-remote';
    const inner = css(document.createElement('div'), 'position:relative;width:100%;height:0');
    const hl = css(document.createElement('div'), 'position:absolute;display:none;background:rgba(0,122,255,.22);border-radius:6px;pointer-events:none;z-index:2');
    const bar = css(document.createElement('div'), 'position:fixed;height:3px;background:#0a84ff;z-index:7;display:none;transition:width .3s');
    const field = css(document.createElement('input'), 'position:fixed;display:none;z-index:8;font:16px -apple-system,system-ui,sans-serif;padding:6px 10px;border:2px solid #0a84ff;border-radius:8px;background:#fff;color:#000;box-sizing:border-box');
    field.setAttribute('autocapitalize', 'off'); field.setAttribute('autocomplete', 'off'); field.setAttribute('enterkeyhint', 'go');
    const gear = css(document.createElement('button'), 'position:fixed;display:none;z-index:6;width:30px;height:30px;border-radius:15px;border:0;background:rgba(242,242,247,.8);color:#3c3c43;font:18px/30px system-ui;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.18)');
    gear.id = 'lite-remote-gear'; gear.textContent = '⋯'; gear.setAttribute('aria-label', '브라우저 설정');   // 브라우저 설정
    const sheet = css(document.createElement('div'), 'position:fixed;display:none;z-index:9;left:0;right:0;bottom:0;background:#fff;border-radius:14px 14px 0 0;box-shadow:0 -2px 16px rgba(0,0,0,.2);padding:18px 20px 28px;font:16px -apple-system,system-ui,sans-serif;color:#1c1c1e');
    inner.appendChild(hl); root.appendChild(inner); document.body.append(root, bar, field, gear, sheet);
    const ko = () => (navigator.language || 'ko').startsWith('ko') || document.documentElement.lang === 'ko';
    function drawSheet() {
      sheet.innerHTML = '';
      const h = css(document.createElement('div'), 'font-weight:600;font-size:17px;margin-bottom:14px'); h.textContent = ko() ? '브라우저 엔진' : 'Browser engine';
      const rows = [];
      for (const [m, k, e] of [['chrome', '크롬 (서버에서 그리기, 기본)', 'Chrome (drawn on the server, default)'], ['zeus', '나눔OS 엔진 (서버에서 그리기)', 'NanumOS engine (drawn on the server)'],
                               ['phone', '나눔OS 엔진 (이 휴대폰에서 그리기)', 'NanumOS engine (drawn on this phone)']]) {
        if (m !== 'phone' && !backends.includes(m)) continue;
        const row = css(document.createElement('label'), 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0');
        const t = document.createElement('span'); t.textContent = ko() ? k : e;
        const r = document.createElement('input'); r.type = 'radio'; r.name = 'lite-mode'; r.id = 'lite-mode-' + m; r.checked = mode() === m; css(r, 'width:22px;height:22px');
        r.onchange = () => { try { localStorage.setItem(MODE, m); localStorage.removeItem(KEY); } catch (x) { /* private mode */ } log('WEB remote setting ' + m); sheet.style.display = 'none'; if (cur.url) navigate(cur.url, 'setting'); };
        row.append(t, r); rows.push(row);
      }
      const row = document.createElement('div'); row.append(...rows);
      const note = css(document.createElement('div'), 'color:#6b6b70;font-size:13px;margin-top:6px');
      note.textContent = ping === false ? (ko() ? '지금 서버가 답하지 않아 휴대폰에서 그립니다' : 'The server does not answer now: drawn on this phone')
        : (ko() ? '서버에서 그리면 페이지를 서버가 그려 그림으로 보냅니다 (빠름). 휴대폰에서 그리면 이 휴대폰이 직접 그립니다' : 'Server: the server draws the page and sends pictures (fast). Phone: this phone draws it');
      const close = css(document.createElement('button'), 'margin-top:16px;width:100%;padding:12px;border:0;border-radius:10px;background:#f2f2f7;font:inherit'); close.textContent = ko() ? '닫기' : 'Close';
      close.onclick = () => { sheet.style.display = 'none'; };
      sheet.append(h, row, note, close);
    }
    gear.onclick = (e) => { e.stopPropagation(); drawSheet(); sheet.style.display = 'block'; };
    // ---- where the Browser's page area is (from its br_paint call): device px of the app's frame ----
    let rect = null, shownMode = null;   // {x, y, w, h} canvas device px
    function locate(dst, stride, w, h) {
      const [rgba, cw, ch] = c.fb(); const base = rgba - cw * ch * 4;   // gui_bb is allocated right before the RGBA copy
      const off = (dst - base) >> 2; let y, x;
      if (w === stride) { y = Math.round(off / stride); x = 0; } else { y = Math.floor(off / stride); x = off - y * stride; }
      if (y < 0 || y + h > ch + 2 || x < 0) return null;
      return { x, y, w, h };
    }
    function cssRect() {   // the page area in CSS px of the window
      const b = c.canvas.getBoundingClientRect(), [, cw] = c.fb(), k = b.width / cw;
      return { left: b.left + rect.x * k, top: b.top + rect.y * k, width: rect.w * k, height: rect.h * k };
    }
    function markersOn() {   // our four grey pixels still on the screen = nothing else drew over the page area
      if (!rect) return false;
      const [rgba, cw] = c.fb(), m = c.view();
      for (let i = 0; i < 4; i++) { const p = rgba + ((rect.y + 1) * cw + rect.x + 1 + i * 2) * 4; if (m[p] !== MARK[i] || m[p + 1] !== MARK[i] || m[p + 2] !== MARK[i]) return false; }
      return true;
    }
    // ---- the page ----
    const cur = { url: '', title: '', status: '', h: 0, tile: 512, dpr: 3, links: [], gen: 0, mode: null, t0: 0, first: false, done: false, ticks: 0, lastAct: 0 };
    let tiles = new Map();   // i -> {img, h, url}
    let pendingNav = null, forceWasm = false;
    const dprWant = () => Math.max(1, Math.min(3, c.dpr));
    // two lanes (LITE-FAST): what the person does (open, tap, key) in order, one at a time, never behind the page's own
    // updates (tick) or tiles fetched ahead — those wait while the person's lane has work, one at a time
    const lane = { fg: { q: [], busy: false }, bg: { q: [], busy: false } };
    const SPECIAL = /^(Enter|Backspace|Tab|Escape|Arrow(Left|Right|Up|Down)|Home|End)$/;
    function post(op, body) {
      return new Promise((ok, bad) => {
        const it = { op, body, ok, bad };
        if (op === 'open') { for (const l of [lane.fg, lane.bg]) for (const q of l.q.splice(0)) q.bad(new Error('superseded')); lane.fg.q.push(it); }   // a new page: the old page's queued work is dropped
        else if (op === 'tap' || op === 'key') {
          for (const q of lane.bg.q.splice(0).filter(q => { if (q.op !== 'tick') return true; q.bad(new Error('superseded')); return false; })) lane.bg.q.push(q);   // its answer brings the screen
          const last = lane.fg.q[lane.fg.q.length - 1];
          if (op === 'key' && last && last.op === 'key' && !SPECIAL.test(body.key) && !SPECIAL.test(last.body.key)) {   // letters typed while one is on its way: one request
            last.body = Object.assign({}, body, { key: last.body.key + body.key }); const o1 = last.ok, b1 = last.bad;
            last.ok = (r) => { o1(r); ok(r); }; last.bad = (e) => { b1(e); bad(e); }; return;
          }
          lane.fg.q.push(it);
        } else {
          if (op === 'tick') for (const q of lane.bg.q.filter(q => q.op === 'tick')) { lane.bg.q.splice(lane.bg.q.indexOf(q), 1); q.bad(new Error('superseded')); }
          lane.bg.q.push(it);
        }
        pump(); });
    }
    function pump() {
      for (const name of ['fg', 'bg']) {
        const l = lane[name];
        if (l.busy || !l.q.length) continue;
        if (name === 'bg' && (lane.fg.busy || lane.fg.q.length)) continue;
        l.busy = true; send(l.q.shift()).then(() => { l.busy = false; pump(); });
      }
    }
    async function send(q) {
      try {
        const r = await fetch('remote/' + q.op, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ tab }, q.body)), cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const b = new Uint8Array(await r.arrayBuffer());
        if (b[0] !== 0x5a || b[1] !== 0x52 || b[2] !== 0x54 || b[3] !== 0x31) throw new Error('bad answer');
        const jl = b[4] | b[5] << 8 | b[6] << 16 | b[7] << 24, j = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + jl)));
        q.ok({ j, blob: b.subarray(8 + jl), bytes: b.length });
      } catch (e) { q.bad(e); }
    }
    function viewH() { return rect ? cssRect().height : innerHeight - 100; }
    function want() {   // tiles from one screen above to three below what is shown
      const T = cur.tile / cur.dpr, top = root.scrollTop, vh = viewH();
      const n = Math.ceil(cur.h / T);
      return [Math.max(0, Math.floor((top - vh) / T)), Math.min(n - 1, Math.floor((top + vh * 4) / T))];
    }
    function seen() {   // the tiles on screen now: what the page's own updates (tick), taps and keys bring back
      const T = cur.tile / cur.dpr, top = root.scrollTop, vh = viewH(), n = Math.max(1, Math.ceil(cur.h / T));
      return [Math.min(n - 1, Math.max(0, Math.floor(top / T))), Math.min(n - 1, Math.max(0, Math.floor((top + vh - 1) / T)))];
    }
    function clearTiles() { for (const t of tiles.values()) { URL.revokeObjectURL(t.url); t.img.remove(); } tiles = new Map(); }
    function apply(res, gen, op) { try { apply1(res, gen); if (op && res.j.tiles && res.j.tiles.length && gen === cur.gen) log('WEB remote paint ' + op + ' ' + res.j.tiles.length + ' at=' + Math.round(performance.now())); } catch (e) { log('WEB remote apply failed ' + e + ' ' + String(e && e.stack || '').split('\n').slice(0, 3).join(' < ')); } }
    function apply1(res, gen) {
      if (gen !== cur.gen) return;
      const { j, blob } = res;
      if (j.nav) { navigate(j.nav, 'page'); return; }
      if (j.anchor >= 0) root.scrollTop = j.anchor;   // a link to a place on this page
      cur.tile = j.tile; cur.dpr = j.dpr; cur.title = j.title || ''; cur.url = j.url || cur.url; cur.status = j.status || '';
      if (j.h !== cur.h) { cur.h = j.h; inner.style.height = j.h + 'px'; for (const [i, t] of tiles) if (i * j.tile / j.dpr >= j.h) { URL.revokeObjectURL(t.url); t.img.remove(); tiles.delete(i); } }
      if (j.links) cur.links = j.links;
      if (j.tiles && j.tiles.length && res.op !== 'tiles') cur.chg = performance.now();   // the page changed: tiles fetched before may be old
      const T = j.tile / j.dpr, decs = [];
      for (const [i, h, o, n] of j.tiles || []) {
        const u = URL.createObjectURL(new Blob([blob.subarray(o, o + n)], { type: 'image/webp' }));
        let t = tiles.get(i);
        if (!t) { const img = css(new Image(), `position:absolute;left:0;top:${i * T}px;width:100%;height:${h / j.dpr}px;display:block`); img.draggable = false; inner.insertBefore(img, hl); t = { img, url: null, h }; tiles.set(i, t); }
        const old = t.url; t.url = u; t.h = h; t.at = performance.now(); t.whole = res.op === 'tiles'; t.img.style.height = h / j.dpr + 'px';
        t.img.src = u; decs.push(t.img.decode().catch(() => {}).then(() => { if (old) URL.revokeObjectURL(old); }));
      }
      if (!cur.first && j.tiles && j.tiles.length) Promise.all(decs).then(() => { if (gen !== cur.gen || cur.first) return; cur.first = true; showBar(false);
        log('WEB remote first ' + Math.round(performance.now() - cur.t0) + ' ms at=' + Math.round(performance.now()) + ' ' + cur.url.slice(0, 80)); });
      if (j.field) showField();
      schedule(j);
      fill();
    }
    let tickTimer = 0;
    function schedule(j) {   // the page's own timers and late pictures: ask again while it has work (30 s after the last touch at most)
      clearTimeout(tickTimer);
      const active = performance.now() - cur.lastAct < 30000;
      if (!active || (j.pending === 0 && j.next < 0)) { if (!cur.done) { cur.done = true; log('WEB remote done ' + Math.round(performance.now() - cur.t0) + ' ms at=' + Math.round(performance.now())); fill(true); } return; }
      const d = j.pending ? 250 : Math.max(120, Math.min(j.next, 2000));   // (a tick is the screen in view only: cheap; LITE-FAST)
      const gen = cur.gen;
      tickTimer = setTimeout(() => { if (gen !== cur.gen || !visible) { if (gen === cur.gen) tickTimer = 0; return; } const [a, b] = seen(); cur.ticks++; post('tick', { a, b }).then(r => apply(r, gen, 'tick'), e => log('WEB remote tick ' + e)); }, d);
    }
    let filling = false;
    function fill(old) {   // prefetch: the screens below (and one above) the phone does not have yet — a short tile that is not the
      // page's last came from the viewport only (the server's quick capture); old: also refresh tiles near the screen that came
      // before the page last changed (ticks bring only what is on screen)
      if (filling || !cur.h || pendingNav) return;
      const T = cur.tile / cur.dpr, [a, b] = want(), top = root.scrollTop, vh = viewH(); let lo = -1, hi = -1;
      const lack = (i) => { const t = tiles.get(i); if (!t) return true; if (!t.whole && t.h < cur.tile && i * T + t.h / cur.dpr < cur.h - 2) return true;
        return old && cur.chg && t.at < cur.chg && i * T < top + vh * 2 && (i + 1) * T > top - vh / 2; };
      for (let i = a; i <= b; i++) if (lack(i)) { if (lo < 0) lo = i; hi = i; }
      if (lo < 0) return;
      filling = true; const gen = cur.gen, asked = performance.now();
      post('tiles', { a: lo, b: hi }).then(r => { filling = false; r.op = 'tiles';
        if (gen === cur.gen) for (let i = lo; i <= hi; i++) { const t = tiles.get(i); if (t) { t.whole = true; if (t.at < asked) t.at = asked; } }   // unchanged ones are as new (and as whole) as this answer
        apply(r, gen); }, e => { filling = false; log('WEB remote tiles ' + e); expired(e); });
    }
    function expired(e) { if (/HTTP 410/.test(String(e)) && cur.url) navigate(cur.url, 'expired'); }   // the server closed an idle tab: load it again
    function showBar(on) {
      if (!on || !rect) { bar.style.display = 'none'; bar.style.width = '0'; return; }
      const r = cssRect(); Object.assign(bar.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: '0' });
      requestAnimationFrame(() => { bar.style.width = (r.width * 0.7) + 'px'; });
    }
    // the Browser app records history and the address bar when it opens a link itself: a tap on its page area with a
    // link waiting here (br_click answers it) makes it do that
    function navigate(url, why) {
      pendingNav = url; log('WEB remote nav ' + why + ' ' + url.slice(0, 80));
      if (!rect) return;
      const x = rect.x + Math.floor(rect.w / 2), y = rect.y + Math.floor(rect.h / 2);
      c.tap(x, y);
    }
    function open(url, width) {
      cur.gen++; const gen = cur.gen;
      Object.assign(cur, { url, title: '', status: '', h: 0, links: [], mode: 'remote', t0: performance.now(), first: false, done: false, lastAct: performance.now(), chg: 0 });
      clearTiles(); inner.style.height = '0'; root.scrollTop = 0; hl.style.display = 'none'; hideField(); clearTimeout(tickTimer);
      showBar(true);
      log('WEB remote open ' + url.slice(0, 80) + ' at=' + Math.round(performance.now()));
      cur.w = width; cur.vh = Math.round(viewH());
      cur.backend = mode();
      post('open', { url, w: width, dpr: dprWant(), vh: cur.vh, backend: cur.backend }).then(r => {
        if (gen !== cur.gen) return;
        log('WEB remote opened ' + (r.j.backend || '') + ' ' + r.bytes + ' bytes engine ' + r.j.ms + ' ms rss ' + r.j.rss + 'K tiles ' + (r.j.tiles || []).length + ' at=' + Math.round(performance.now()));
        apply(r, gen);
      }, e => {
        if (gen !== cur.gen) return;
        log('WEB remote failed ' + e + ': drawing on the phone'); showBar(false); ping = false; forceWasm = true; navigate(url, 'fallback');
      });
    }
    // ---- touch: native scrolling; a short tap goes to the page ----
    let down = null;
    root.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp, top: root.scrollTop }; cur.lastAct = performance.now(); });
    root.addEventListener('pointercancel', () => { down = null; });
    let tappedAt = -1e9;
    root.addEventListener('pointerup', (e) => {
      if (!down) return; const d = down; down = null;
      if (Math.abs(e.clientX - d.x) > 10 || Math.abs(e.clientY - d.y) > 10 || Math.abs(root.scrollTop - d.top) > 4 || e.timeStamp - d.t > 700) return;
      tappedAt = performance.now(); tapAt(e.clientX, e.clientY);
    });
    root.addEventListener('click', (e) => { if (performance.now() - tappedAt > 700) { tappedAt = performance.now(); tapAt(e.clientX, e.clientY); } });   // a browser that gave no pointer events for the tap
    function tapAt(cx, cy) {
      const b = root.getBoundingClientRect(), x = Math.round(cx - b.left), y = Math.round(cy - b.top + root.scrollTop);
      let best = null;
      for (const L of cur.links) if (x >= L[0] && x < L[0] + L[2] && y >= L[1] && y < L[1] + L[3] && (!best || L[2] * L[3] < best[2] * best[3])) best = L;
      const f = best || [x - 16, y - 16, 32, 32];
      Object.assign(hl.style, { display: 'block', left: f[0] + 'px', top: f[1] + 'px', width: f[2] + 'px', height: f[3] + 'px' });
      const t0 = performance.now(), gen = cur.gen, [a, bb] = seen();
      log('WEB remote tap ' + x + ',' + y + (best ? ' link' : ''));
      post('tap', { x, y, a, b: bb, w: cur.w, dpr: dprWant(), vh: cur.vh }).then(r => {
        setTimeout(() => { if (gen === cur.gen) hl.style.display = 'none'; }, Math.max(0, 160 - (performance.now() - t0)));
        log('WEB remote tapped ' + Math.round(performance.now() - t0) + ' ms' + (r.j.nav ? ' nav' : '') + (r.j.field ? ' field' : ''));
        cur.lastAct = performance.now(); apply(r, gen, 'tap');
      }, err => { hl.style.display = 'none'; log('WEB remote tap ' + err); expired(err); });
    }
    let raf = 0;
    root.addEventListener('scroll', () => { cur.lastAct = performance.now(); if (!raf) raf = requestAnimationFrame(() => { raf = 0; fill(true); }); }, { passive: true });
    // ---- typing into a page field: a real input over it (the phone's IME composes there), text and keys to the server ----
    let sentVal = '', composing = false, fieldAt = 0;
    function showField() {
      if (!rect) return; const r = cssRect();
      const top = Math.max(r.top, Math.min(r.top + r.height - 44, (fieldAt || r.top + 60) - 22));
      Object.assign(field.style, { display: 'block', left: (r.left + 8) + 'px', width: (r.width - 16) + 'px', top: top + 'px', height: '44px' });
      field.value = ''; sentVal = ''; field.focus({ preventScroll: true });
    }
    function hideField() { field.style.display = 'none'; if (document.activeElement === field) field.blur(); }
    root.addEventListener('pointerup', (e) => { fieldAt = e.clientY; }, true); root.addEventListener('click', (e) => { fieldAt = e.clientY; }, true);
    function key(k) { const gen = cur.gen, [a, b] = seen(); cur.lastAct = performance.now(); return post('key', { key: k, a, b, w: cur.w, dpr: dprWant(), vh: cur.vh }).then(r => apply(r, gen, 'key'), e => log('WEB remote key ' + e)); }
    function sync() {   // what the input holds now vs what the page got: appended text in one go, else delete and retype
      if (composing) return; const v = field.value;
      if (v === sentVal) return;
      if (v.startsWith(sentVal)) key(v.slice(sentVal.length));
      else { let k = 0; while (k < v.length && k < sentVal.length && v[k] === sentVal[k]) k++; for (let i = [...sentVal.slice(k)].length; i > 0; i--) key('Backspace'); if (v.length > k) key(v.slice(k)); }
      sentVal = v;
    }
    field.addEventListener('compositionstart', () => { composing = true; });
    field.addEventListener('compositionend', () => { composing = false; sync(); });
    field.addEventListener('input', (e) => { if (!e.isComposing) sync(); });
    field.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); sync(); key('Enter'); hideField(); }
      else if (e.key === 'Backspace' && !field.value) { e.preventDefault(); key('Backspace'); }
      else if (e.key === 'Escape') hideField();
    });
    field.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement !== field) field.style.display = 'none'; }, 200); });
    // ---- shown only while the Browser's page area is on screen ----
    let visible = false;
    setInterval(() => {
      let W; try { W = c.W(); } catch (e) { return; }
      const front = W && W.web_app && W.web_app() === APP_WEB && rect;
      const on = !!(front && cur.mode === 'remote' && markersOn());
      if (on !== visible) {
        visible = on; root.style.display = on ? 'block' : 'none';
        if (!on) { hideField(); bar.style.display = 'none'; sheet.style.display = 'none'; }
        else if (cur.h && !tickTimer) schedule({ pending: 1, next: 0 });
      }
      if (on) { const r = cssRect(); Object.assign(root.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
      const g = front && (cur.mode !== 'remote' || on);
      gear.style.display = g ? 'block' : 'none';
      if (g) { const r = cssRect(); Object.assign(gear.style, { left: (r.left + r.width - 40) + 'px', top: (r.top + r.height - 44) + 'px' }); }   // bottom right: out of the way of a page's own top bar
    }, 100);
    // ---- the Browser's calls ----
    env.br_open = (p, n, width) => {
      const url = c.str(p, n);
      if (ping === null && chosen() !== 'phone' && !window.__try) {   // the first page can come before the ping's answer: ask once, here
        try { const x = new XMLHttpRequest(); x.open('GET', 'remote/ping', false); x.send(); let j = null; try { j = x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e2) { /* not ours */ } pong(j); } catch (e) { ping = false; }
        log('WEB remote ping ' + ping + ' (sync)');
      }
      const remote = !forceWasm && wanted();
      forceWasm = false;
      if (!remote) { cur.mode = 'wasm'; cur.gen++; clearTiles(); root.style.display = 'none'; visible = false; return orig.open(p, n, width); }
      open(url, width); return 1;
    };
    env.br_paint = (dst, stride, w, h, scroll, k) => {
      const r = locate(dst, stride, w, h); if (r) rect = r;
      if (cur.mode !== 'remote') return orig.paint(dst, stride, w, h, scroll, k);
      const m32 = new Uint32Array(c.W().memory.buffer), o = dst >> 2;
      for (let y = 0; y < h; y++) m32.fill(0xffffff, o + y * stride, o + y * stride + w);
      for (let i = 0; i < 4; i++) m32[o + stride + 1 + i * 2] = MARK[i] * 0x10101;
    };
    env.br_link = (x, y, out, cap) => cur.mode === 'remote' ? 0 : orig.link(x, y, out, cap);
    env.br_click = (x, y, out, cap) => {
      if (pendingNav) { const u = pendingNav; pendingNav = null; return c.brPut(u, out, cap) > 0 ? 1 : 0; }
      return cur.mode === 'remote' ? 0 : orig.click(x, y, out, cap);
    };
    env.br_tick = () => cur.mode === 'remote' ? 0 : orig.tick();
    env.br_info = (what, out, cap) => cur.mode === 'remote' ? c.brPut(what === 0 ? cur.title : what === 1 ? cur.url : cur.status, out, cap) : orig.info(what, out, cap);
    R.state = cur; R.ping = () => ping; R.pinged = pinged;
    window.addEventListener('pagehide', () => { try { navigator.sendBeacon && navigator.sendBeacon('remote/close', new Blob([JSON.stringify({ tab })], { type: 'application/json' })); } catch (e) { /* gone */ } });
  };
})();
// VOICE-01 — the Assistant's ears and mouth in the browser (docs/contracts/VOICE.md). Written for ZeusOs, MIT.
// build.sh puts this file in front of weblite.js; weblite.js's imports voice_* call window.ZVoice. tests/voice_barge.js runs ZVad in node.
//
// Ears: getUserMedia with echoCancellation / noiseSuppression / autoGainControl, 20 ms frames at 16 kHz, our own small VAD (ZVad):
//   speech starts after 3 loud frames (60 ms, 300 ms kept before it); it ends after ENDPOINT_MS of quiet (kimbox box/server.py ENDPOINT_MS
//   500 / Mac 김비서 650 — 650 here: no partial transcript to tell a finished sentence); then the question goes to /relay/voice/stt as a 16-bit
//   WAV and only the text comes back. Nothing is kept: the samples are dropped when the request is sent.
// Mouth: each sentence from the app -> /relay/voice/tts (Hera) -> one AudioContext; two fetched ahead.
// Barge-in (full duplex): while the mouth plays, the ears stay open; talking over it for BARGE_MS (kimbox KIMBOX_BARGE_SHORT_MS 240) of frames
//   louder than the room AND than the echo the playback predicts (playback level x the measured coupling + margin) stops the playback at
//   once and that speech becomes the next question. False stops on our own voice are the thing to keep at zero (tests/voice_barge.js).
// LITE-VOICE-GHOST (owner 11-03 「내가 하지 않은 이야기가 내가 한 이야기로」): measured with tests/weblite_voice_ghost.py — our own voice
//   coming back 150-250 ms late (Android's round trip is longer than refDb's old fixed 120 ms) and at the start of each sentence (no
//   reference yet) passed as a barge-in, was written down and asked as the user's turn (6/6 ghosts with bigram overlap 1.0 with what the
//   비서 had just said); a held-and-let-go talk button sent 0.3 s of room noise, which Whisper wrote as 「자막 제공 및 …」. Now:
//   - the reference is the loudest level we played in the last ECHO_LAG s (any delay up to it), also for ECHO_LAG s after the end
//   - a clip with under VOICED_MS of frames 10 dB over the room is not sent (no speech); the server gates too (voice_worker.py)
//   - a transcript whose letters are mostly (ECHO_OVERLAP) what we were saying while it was heard is our echo: dropped, and the ears
//     go on listening (code compares with our own sentences — the user's words are never matched against a list)
(function (root) {
  'use strict';
  const FRAME = 320, RATE = 16000;
  const P = { START_FR: 3, ENDPOINT_MS: 650, BARGE_MS: 240, PRE_MS: 300, MAX_MS: 20000, NOSPEECH_MS: 8000, FLOOR_DB: -60, SPEECH_OVER_FLOOR: 12,
              SPEECH_MIN_DB: -50, BARGE_OVER_FLOOR: 18, BARGE_MIN_DB: -42, ECHO_MARGIN: 6, WARM_FR: 25,
              PRE_PLAY_MS: 2000, BARGE_PRE_MS: 1500, LEARN_FR: 15, ECHO_LAG: 0.4, VOICED_MS: 150, VOICED_OVER_FLOOR: 10, ECHO_OVERLAP: 0.6 };

  function dbOf(f) { let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i]; return 10 * Math.log10(s / f.length + 1e-12); }

  // One decision per 20 ms frame. db: the mic frame's level (dBFS); ref: the level of what we were playing ~120 ms earlier (dBFS, or null
  // when silent). Returns 'start' | 'end' | 'barge' | 'timeout' | null.
  class ZVad {
    constructor(o) { this.p = Object.assign({}, P, o || {}); this.floor = this.p.FLOOR_DB; this.on = false; this.run = 0; this.quiet = 0; this.len = 0;
      this.coupling = -30; this.cn = 0; this.waited = 0; this.bargeRun = 0; }
    relearn() { this.seen = 0; }   // a new listening: the first LEARN_FR frames only measure the room
    frame(db, ref) {
      const p = this.p, playing = ref != null && ref > -70;
      // LITE-VOICE-GHOST (quiet room): the floor started at -60 dBFS, so a room at -43 (the owner's Mac mic, measured) or one raised by
      // the browser's AGC counted as speech from the first frame — 20 s of room went to Whisper, which wrote 「감사합니다.」 (10 of 16 quiet
      // clips). Each listening now starts by measuring the room: the quietest frame of the first 300 ms.
      if ((this.seen = (this.seen || 0) + 1) <= p.LEARN_FR && !this.on && !playing) { this.floor = this.seen === 1 ? db : Math.min(this.floor, db); return null; }
      const echo = playing ? ref + this.coupling : -120;
      let loud;
      if (playing) loud = db > Math.max(this.floor + p.BARGE_OVER_FLOOR, p.BARGE_MIN_DB, echo + p.ECHO_MARGIN);
      else loud = db > Math.max(this.floor + p.SPEECH_OVER_FLOOR, p.SPEECH_MIN_DB);
      const warm = playing && this.cn < p.WARM_FR;   // the first 0.5 s of our own voice: learn how loud it comes back, no barge-in yet
      if (playing && !this.on && ref > -50 && (warm || (!loud && this.bargeRun === 0))) {   // learn only from frames that look like echo
        // LITE-VOICE-GHOST: the coupling is the upper edge of (mic - what we played), not its mean — quiet moments inside an answer
        // (ref is the loudest level of the last ECHO_LAG s) pulled the mean 15-20 dB under the echo's peaks, so the peaks passed as barge-ins
        // (after the first 0.5 s it moves slowly: a user talking under the barge threshold must not teach it that their voice is echo)
        const c = Math.min(6, db - ref);
        if (c > this.coupling) this.coupling += (warm ? 0.5 : 0.01) * (c - this.coupling); else this.coupling -= warm ? 0 : 0.01;
        this.cn++;
      }
      if (warm) loud = false;
      if (!loud && !this.on && !playing) this.floor = db < this.floor ? db : this.floor + 0.03 * (db - this.floor);   // the room: down at once, up slowly
      else if (playing && db < this.floor) this.floor = db;   // (not up from our own echo: it raised floor + 18 over the user, LITE-VOICE-GHOST)
      if (!this.on) {
        this.waited += 20;
        if (playing) {
          this.bargeRun = loud ? this.bargeRun + 1 : Math.max(0, this.bargeRun - 2);
          this.span = this.bargeRun > 0 ? (this.span || 0) + 1 : 0;   // frames since this run of loud frames began (its words are kept)
          if (this.bargeRun * 20 >= p.BARGE_MS) { this.on = true; this.len = this.bargeRun * 20; this.quiet = 0; this.bargeRun = 0; this.bargeSpan = this.span; this.span = 0; return 'barge'; }
          return null;
        }
        this.bargeRun = 0;
        this.run = loud ? this.run + 1 : 0;
        if (this.run >= p.START_FR) { this.on = true; this.len = this.run * 20; this.quiet = 0; return 'start'; }
        if (this.waited >= p.NOSPEECH_MS) { this.waited = 0; return 'timeout'; }
        return null;
      }
      this.len += 20; this.quiet = loud ? 0 : this.quiet + 20;
      if (this.quiet >= p.ENDPOINT_MS || this.len >= p.MAX_MS) { this.on = false; this.run = 0; this.waited = 0; return 'end'; }
      return null;
    }
    reset() { this.span = 0; this.on = false; this.run = 0; this.quiet = 0; this.len = 0; this.waited = 0; this.bargeRun = 0; }
  }

  function wav16(samples) {   // Float32 at 16 kHz -> 16-bit PCM WAV bytes
    const n = samples.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), true);
    return new Uint8Array(b);
  }

  // LITE-VOICE-GHOST: how much of a transcript is what we were saying — the share of its letter pairs (letters and digits only) found in
  // the sentences we played while it was heard. Our own echo comes back near 1; a user's new sentence is low.
  function letters(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
  function echoOverlap(text, said) {
    const t = letters(text), s = said.map(letters).join('|'); if (!t || !s) return 0;
    if (t.length < 2) return s.indexOf(t) >= 0 ? 1 : 0;
    let n = 0; for (let i = 0; i + 1 < t.length; i++) if (s.indexOf(t.substr(i, 2)) >= 0) n++;
    return n / (t.length - 1);
  }
  // frames (dB) of a clip that stand VOICED_OVER_FLOOR over the room and over SPEECH_MIN_DB, in ms
  // (the room is also measured in the clip itself — its quietest tenth — so a clip that is room from end to end has none)
  function p10(dbs) { const a = dbs.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 10)] : -120; }
  function voicedMs(dbs, floor) { const th = Math.max(Math.max(floor, p10(dbs)) + P.VOICED_OVER_FLOOR, P.SPEECH_MIN_DB); let n = 0; for (const d of dbs) if (d >= th) n++; return n * 20; }

  // ---- ZEUS-RTC-1: the host's voice inside the ZEUS app (docs/contracts/VOICE.md 「Host voice」) ----
  // In the iPhone app's WKWebView the PHONE hears (SFSpeechRecognizer, on-device only) and reads (AVSpeechSynthesizer): the page only
  // exchanges the same messages ZeusOs.app's drop port carries (src/gui/listen.c hv_*), as the app's bridge ops and `zeushost` events:
  //   vlisten 1 auto|hold|duplex <lang> = {op:'listen',mode,lang} · vlisten 0 = {op:'listen_end'} · vlisten cancel = {op:'listen_cancel'}
  //   vsay <sentence> = {op:'say',text} · vstop = {op:'stop'}
  //   vheard partial|end|final <ms>|none|err <why> = {ev:'heard',kind,text,ms,reason} · vsaid start <ms>|end|stop [barge] = {ev:'said',kind,ms,barge}
  // No sound and no server: the words come back as text. Without the bridge (a browser, or caps without hostvoice) the relay path below stays.
  function makeHostVoice(win, LS, log) {
    const H = { on: false, open: false, hear: false, speaking: false, pending: 0, flags: 0, part: '', q: [], lastStt: -1, lastFirst: -1, sayT: 0, np: 0 };
    const br = () => win.webkit && win.webkit.messageHandlers && win.webkit.messageHandlers.zeus;
    const post = (m) => { try { const r = br().postMessage(m); if (r && r.catch) r.catch(() => {}); return r; } catch (e) { return null; } };
    H.probe = () => {
      if (!br()) return Promise.resolve(false);
      return Promise.resolve(post({ op: 'caps' })).then((c) => { H.on = !!(c && c.hostvoice && c.voice); log('host voice ' + (H.on ? 'on' : 'off')); return H.on; }, () => false);
    };
    H.event = (d) => { if (d && (d.ev === 'heard' || d.ev === 'said')) H.q.push(d); };
    const now = () => (win.performance ? win.performance.now() : Date.now());
    H.listen = (flags, lang) => {
      const mode = flags & 2 ? 'duplex' : flags & 1 ? 'auto' : 'hold';
      if (!post({ op: 'listen', mode, lang: lang === 'en' ? 'en' : 'ko' })) return LS.NOMIC;
      H.open = true; H.hear = false; H.flags = flags; H.part = ''; H.np = 0; log('host listen ' + mode); return 0;
    };
    H.end = () => { if (H.open) { post({ op: 'listen_end' }); H.open = false; H.hear = true; } };
    H.cancel = () => { if (H.open || H.hear) post({ op: 'listen_cancel' }); H.open = H.hear = false; H.part = ''; };
    H.poll = () => {   // [state, text] — the same steps as listen.c hv_poll
      while (H.q.length) {
        const d = H.q.shift();
        if (d.ev === 'heard') {
          if (d.kind === 'partial') { H.np++; H.part = String(d.text || '').slice(0, 255); }
          else if (d.kind === 'end') { H.hear = true; if (!(H.flags & 2)) H.open = false; }
          else if (d.kind === 'final') { if (!(H.flags & 2)) H.open = false; H.hear = false; H.part = ''; H.lastStt = d.ms | 0; log('heard ms=' + H.lastStt); return [LS.TEXT, String(d.text || '')]; }
          else if (d.kind === 'none') { H.part = ''; H.open = H.hear = false; log('no speech'); return [LS.IDLE, '']; }
          else if (d.kind === 'err') { H.part = ''; H.open = H.hear = false; log('host ears: ' + d.reason); return [d.reason === 'denied' ? LS.DENIED : LS.NOMIC, '']; }
        } else if (d.kind === 'start') { H.speaking = true; if (H.sayT) { H.lastFirst = Math.round(now() - H.sayT); log('first sound ms=' + H.lastFirst); H.sayT = 0; } }
        else if (d.kind === 'end') { H.pending = 0; H.speaking = false; }   // the ZEUS app says `end` once its queue is empty (not per sentence)
        else if (d.kind === 'stop') { H.pending = 0; H.speaking = false; H.sayT = 0; if (d.barge) log('barge'); }
      }
      return [H.open ? LS.LISTEN : H.hear ? LS.HEAR : LS.IDLE, ''];
    };
    H.level = () => (H.open ? 30 + (H.np * 17) % 50 : 0);
    H.say = (text) => { if (!post({ op: 'say', text: String(text).slice(0, 2000) })) return -1; if (!H.sayT && !H.pending && !H.speaking) H.sayT = now(); H.pending++; return 0; };
    H.sayStop = () => { if (H.pending || H.speaking) post({ op: 'stop' }); H.pending = 0; H.speaking = false; H.sayT = 0; };
    H.sayBusy = () => (H.pending || H.speaking ? 1 : 0);
    H.info = () => 'mic=host stt=host-on-device voice=host last_stt_ms=' + H.lastStt + ' first_sound_ms=' + H.lastFirst;
    return H;
  }

  root.ZVad = ZVad; root.ZVoiceParams = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ZVad, dbOf, wav16, P, echoOverlap, voicedMs, p10, makeHostVoice };
  if (typeof window === 'undefined') return;

  // ---- the browser ----
  const log = (s) => { try { (window.__weblog || []).push('WEB voice ' + s); } catch (e) { /* */ } };
  const V = { state: 0, level: 0, text: null, flags: 0, ctx: null, stream: null, proc: null, src: null, vad: null, pre: [], utt: [], open: false,
              queue: [], playing: [], said: [], fetching: 0, playEnd: 0, refHist: [], endAt: 0, lastStt: 0, lastFirst: 0, sayT: 0, wake: null, err: 0, gen: 0 };
  root.ZVoice = V;
  const LS = { IDLE: 0, LISTEN: 1, HEAR: 2, TEXT: 3, NOMIC: -19, DENIED: -13, NET: -5 };

  function ctxOf() {
    if (!V.ctx) { const C = window.AudioContext || window.webkitAudioContext; V.ctx = new C(); }
    if (V.ctx.state === 'suspended') V.ctx.resume().catch(() => {});   // iOS: inside the tap that opened the Assistant
    return V.ctx;
  }
  async function wakeOn() { try { if (navigator.wakeLock && !V.wake) { V.wake = await navigator.wakeLock.request('screen'); V.wake.addEventListener('release', () => { V.wake = null; }); } } catch (e) { /* not allowed */ } }
  function wakeOff() { try { if (V.wake) V.wake.release(); } catch (e) { /* */ } V.wake = null; }

  async function micOpen() {
    if (V.stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { V.err = LS.NOMIC; return false; }
    try {
      V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) { V.err = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? LS.DENIED : LS.NOMIC; log('mic ' + (e && e.name)); return false; }
    const ctx = ctxOf(); V.src = ctx.createMediaStreamSource(V.stream);
    V.proc = ctx.createScriptProcessor(2048, 1, 1);
    const step = ctx.sampleRate / RATE; let acc = new Float32Array(0), pos = 0;
    V.proc.onaudioprocess = (ev) => {
      const x = ev.inputBuffer.getChannelData(0);
      const out = []; for (; pos < x.length; pos += step) { const i = Math.floor(pos); out.push(x[i]); } pos -= x.length;   // to 16 kHz (the browser's AGC/NS ran first)
      const a = new Float32Array(acc.length + out.length); a.set(acc); a.set(out, acc.length); acc = a;
      while (acc.length >= FRAME) { const f = acc.subarray(0, FRAME); acc = acc.slice(FRAME); onFrame(f); }
    };
    V.src.connect(V.proc); V.proc.connect(ctx.destination);   // a ScriptProcessor runs only when connected (it outputs silence)
    log('mic open rate=' + ctx.sampleRate + ' ec=' + (V.stream.getAudioTracks()[0].getSettings().echoCancellation));
    return true;
  }
  function micClose() {
    try { if (V.proc) { V.proc.disconnect(); V.proc.onaudioprocess = null; } if (V.src) V.src.disconnect(); } catch (e) { /* */ }
    if (V.stream) V.stream.getTracks().forEach((t) => t.stop());
    V.stream = V.proc = V.src = null;
  }
  function refDb() {   // the loudest level we played in the last ECHO_LAG s: the echo comes back 50-300 ms late, more on some phones
    if (!V.ctx || !V.playing.length) return null;   // (the old single point 120 ms back let a later echo and each sentence's start through)
    const t1 = V.ctx.currentTime, t0 = t1 - P.ECHO_LAG; let db = null;
    for (const p of V.playing) {
      const a = Math.max(t0, p.t0), b = Math.min(t1, p.t0 + p.dur); if (a >= b) continue;
      for (let i = Math.floor((a - p.t0) / 0.02), e = Math.ceil((b - p.t0) / 0.02); i < e && i < p.env.length; i++) if (db === null || p.env[i] > db) db = p.env[i];
      if (db === null) db = -90;
    }
    return db;
  }
  function onFrame(f) {
    if (!V.open) return;
    const db = dbOf(f); V.level = Math.max(0, Math.min(100, Math.round((db + 60) * 100 / 50)));
    // while we speak 2 s are kept: over a loud echo a barge-in can take a while to be sure, and the words before it are the user's
    // (BARGE_PRE_MS before the run that decided it: 「잠깐,」 + its pause fell out of a 300 ms lead — measured, weblite_voice_ghost barge)
    if (V.vad.on || V.state === LS.LISTEN) { V.pre.push(new Float32Array(f)); if (!V.vad.on && V.pre.length > (V.playing.length ? P.PRE_PLAY_MS : P.PRE_MS) / 20) V.pre.shift(); }
    const r = V.vad.frame(db, refDb());   // also just after the last sentence ended: its echo is still on the way
    if (r === 'barge') { const t = performance.now(); sayStop(); V.bargeMs = Math.round(performance.now() - t); log('barge stop ms=' + V.bargeMs + ' span=' + V.vad.bargeSpan * 20); V.utt = V.pre.slice(-(V.vad.bargeSpan + P.BARGE_PRE_MS / 20)); V.pre = []; V.state = LS.LISTEN; }
    else if (r === 'start') { V.utt = V.pre.slice(-(V.vad.len / 20 + P.PRE_MS / 20)); V.pre = []; log('speech start'); }
    else if (V.vad.on) V.utt.push(new Float32Array(f));
    if (r === 'end') finish(false);
    else if (r === 'timeout' && !(V.flags & 2)) { log('no speech'); stop(); V.state = LS.IDLE; }
  }
  // nothing to hand over (no speech, or our own echo): a question that was not ended by the user goes on listening; one ended by the user
  // (talk button let go) ends with nothing heard, as before
  function nothing(why, ended) { log(why); V.vad.reset(); if (ended) { V.text = ''; V.state = LS.TEXT; } else { V.open = true; V.state = LS.LISTEN; } }
  function finish(ended) {
    const parts = V.utt; V.utt = []; V.pre = [];
    const n = parts.reduce((a, p) => a + p.length, 0); if (n < RATE * 0.25) { V.vad.reset(); return; }
    const dbs = parts.map(dbOf), vm = voicedMs(dbs, V.vad.floor);
    if (vm < P.VOICED_MS) { V.vad.floor = Math.max(V.vad.floor, p10(dbs)); nothing('no speech voiced_ms=' + vm, ended); return; }   // room noise: Whisper would invent words
    const all = new Float32Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    const t1 = V.ctx ? V.ctx.currentTime : 0, w0 = t1 - n / RATE - P.ECHO_LAG, w1 = t1;   // when it was heard (ctx time), widened by the echo's lag
    const said = (V.said || []).filter((x) => x.t0 < w1 && x.t0 + x.dur > w0).map((x) => x.text);
    const body = wav16(all); V.endAt = performance.now(); V.state = LS.HEAR; V.vad.reset();
    if (!(V.flags & 2)) { V.open = false; }   // one question; duplex keeps listening (the next one, or a barge-in)
    const gen = ++V.gen;
    fetchRetry('relay/voice/stt?lang=' + (navigator.language || 'ko').slice(0, 2), { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body }, 'stt', () => gen === V.gen)
      .then((r) => r.json())
      .then((j) => { if (gen !== V.gen) return; V.lastStt = Math.round(performance.now() - V.endAt); log('stt ms=' + V.lastStt + ' server=' + j.ms + ' dev=' + j.dev + ' chars=' + (j.text || '').length);
        const ov = said.length && j.text ? echoOverlap(j.text, said) : 0;
        if (j.text && ov >= P.ECHO_OVERLAP) { V.echoDropped = (V.echoDropped || 0) + 1; nothing('echo dropped chars=' + j.text.length + ' overlap=' + ov.toFixed(2), ended); return; }
        if (!j.text && !ended) { nothing('no words', false); return; }   // the server heard no speech (its gates): keep listening
        V.text = (j.text || '') + (j.text && j.unsure && j.unsure.length ? '\u001f' + j.unsure.join(', ') : ''); V.state = LS.TEXT; })   // the words heard unsure go to the model with it
      .catch((e) => { if (gen !== V.gen) return; log('stt failed ' + e.message); V.err = LS.NET; V.state = LS.NET; });
  }
  // VOICE-TOOLCALL: a failed request is tried again with a growing pause (0.8 s, 2.5 s, 5 s) before the screen says the server could not be reached; 4xx is not retried.
  const WAITS = [800, 2500, 5000];
  function fetchRetry(url, opts, what, gen) {
    let n = 0;
    const once = () => {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ac ? setTimeout(() => ac.abort(), 20000) : 0;
      return fetch(url, Object.assign({}, opts, ac ? { signal: ac.signal } : {}))
        .then((r) => { if (t) clearTimeout(t); if (r.ok) return r; const e = new Error(String(r.status)); e.code = r.status; throw e; })
        .catch((e) => {
          if (t) clearTimeout(t);
          const again = n < WAITS.length && !(e.code >= 400 && e.code < 500 && e.code !== 408 && e.code !== 429) && (gen == null || gen());
          log(what + ' try ' + (n + 1) + ' failed ' + (e.name === 'AbortError' ? 'timeout' : e.message) + (again ? ' — again in ' + WAITS[n] + ' ms' : ''));
          if (!again) throw e;
          return new Promise((ok) => setTimeout(ok, WAITS[n++])).then(once);
        });
    };
    return once();
  }
  function stop() { V.open = false; V.utt = []; V.pre = []; if (!sayBusy()) { micClose(); wakeOff(); } }

  // ---- the mouth ----
  function sayBusy() { return V.queue.length > 0 || V.fetching > 0 || (V.ctx && V.playing.some((p) => p.t0 + p.dur > V.ctx.currentTime)); }
  function sayStop() {
    V.queue = []; V.sgen = (V.sgen || 0) + 1;
    if (V.ctx) { const now = V.ctx.currentTime; for (const x of V.said) if (x.t0 + x.dur > now) x.dur = Math.max(0, now - x.t0); }   // what was cut was not heard
    for (const p of V.playing) { try { p.node.stop(); } catch (e) { /* */ } }
    V.playing = []; V.playEnd = 0;
  }
  function envOf(buf) { const x = buf.getChannelData(0), k = Math.round(buf.sampleRate * 0.02), env = []; for (let i = 0; i + k <= x.length; i += k) env.push(dbOf(x.subarray(i, i + k))); return env; }
  function pump() {
    while (V.queue.length && V.fetching < 2) {
      const it = V.queue.shift(); V.fetching++; const g = V.sgen;
      it.p = fetchRetry('relay/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: it.text }) }, 'tts', () => g === V.sgen)
        .then((r) => r.arrayBuffer())
        .then((b) => ctxOf().decodeAudioData(b))
        .catch((e) => { log('tts failed ' + e.message); return null; });
      V.chain = (V.chain || Promise.resolve()).then(() => it.p.then((buf) => {
        V.fetching--; if (!buf || g !== V.sgen) { pump(); return; }
        const ctx = ctxOf(), n = ctx.createBufferSource(); n.buffer = buf; n.connect(ctx.destination);
        const t0 = Math.max(ctx.currentTime + 0.02, V.playEnd); n.start(t0); V.playEnd = t0 + buf.duration;
        if (V.sayT) { V.lastFirst = Math.round(performance.now() - V.sayT + (t0 - ctx.currentTime) * 1000); log('first sound ms=' + V.lastFirst); V.sayT = 0; }
        V.playing.push({ node: n, t0, dur: buf.duration, env: envOf(buf) }); V.playing = V.playing.filter((p) => p.t0 + p.dur > ctx.currentTime - 1);
        V.said.push({ text: it.text, t0, dur: buf.duration }); V.said = V.said.filter((x) => x.t0 + x.dur > ctx.currentTime - 30);   // LITE-VOICE-GHOST: what our echo can be
        pump();
      }));
    }
  }

  // ---- what the C side calls (weblite.js imports voice_*) ----
  V.listen = (flags) => {
    if (!V.warmed) { V.warmed = true; fetch('relay/voice/status').catch(() => {}); }   // the ears' model loads while the user starts to talk (cold: ~6 s once)
    V.flags = flags; V.err = 0; V.text = null; ctxOf(); wakeOn();
    if (!V.vad) V.vad = new ZVad(); V.vad.reset(); V.vad.relearn(); V.pre = []; V.utt = []; V.open = true; V.state = LS.LISTEN;
    micOpen().then((ok) => { if (!ok) { V.open = false; V.state = V.err; } });
    return 0;
  };
  V.end = () => { if (!V.open) return; if (V.utt.length || V.pre.length) { if (!V.vad.on) V.utt = V.pre.slice(); finish(true); } V.open = false; };
  V.cancel = () => { V.gen++; V.open = false; V.state = LS.IDLE; V.utt = []; V.pre = []; micClose(); wakeOff(); };
  V.poll = () => { const s = V.state; if (s === LS.TEXT) { V.state = V.open ? LS.LISTEN : LS.IDLE; return [s, V.text || '']; }
    if (s === LS.NET || s < 0) { V.state = V.open ? LS.LISTEN : LS.IDLE; return [s, '']; }
    if (s === LS.LISTEN && !V.open) V.state = LS.IDLE;
    return [V.open && s !== LS.HEAR ? LS.LISTEN : s, '']; };
  V.say = (text) => { if (!V.queue.length && !sayBusy()) V.sayT = performance.now(); V.queue.push({ text }); ctxOf(); pump(); return 0; };
  V.sayStop = sayStop; V.sayBusy = () => sayBusy() ? 1 : 0;
  V.partial = () => '';
  // ZEUS-RTC-1: inside the ZEUS app the phone's own voice takes these calls (makeHostVoice above); the relay path is the fallback
  const HV = makeHostVoice(window, LS, log); root.ZHostVoice = HV;
  window.addEventListener('zeushost', (e) => HV.event(e.detail));
  HV.probe().then((on) => {
    if (!on) return;
    const lang = () => ((document.documentElement.lang || navigator.language || 'ko').slice(0, 2) === 'en' ? 'en' : 'ko');
    V.listen = (f) => HV.listen(f, lang()); V.end = HV.end; V.cancel = HV.cancel;
    V.poll = () => { const r = HV.poll(); V.level = HV.level(); return r; };
    V.partial = () => HV.part; V.say = HV.say; V.sayStop = HV.sayStop; V.sayBusy = HV.sayBusy; V.info = HV.info;
  });
  V.info = () => 'mic=' + (V.stream ? 'browser' : navigator.mediaDevices ? 'browser (closed)' : 'none') + ' stt=relay last_stt_ms=' + V.lastStt + ' first_sound_ms=' + V.lastFirst + (V.bargeMs != null ? ' barge_ms=' + V.bargeMs : '');
})(typeof window !== 'undefined' ? window : globalThis);
// WEB-DESKTOP (docs/WEB-LITE.md "The desktop in a PC browser"): on a PC-size screen the page runs the ZeusOs desktop
// itself (desk.wasm: src/gui/gui.c + tools/weblite/desk_web.c) instead of the phone shell. This file turns the page's
// keyboard and mouse into what gui.c reads on a PC: PS/2 set-1 bytes (from KeyboardEvent.code, so the layout and the
// Hangul IME are ZeusOs's own) and an absolute pointer (QEMU's USB tablet). weblite.js (after this file) does the rest:
// the canvas, IndexedDB, the programs and relays, sound — the same as on a phone.
// Test hooks: window.__deskstats (frame and input times), ZDesk.mode.
'use strict';
window.ZDesk = (() => {
  const q = new URLSearchParams(location.search);
  // A PC: a mouse or trackpad (fine pointer) and room for windows. ?mode=desktop forces it, ?mode=phone the phone.
  function wanted() {
    if (q.get('mode') === 'desktop') return true;
    if (q.get('mode') === 'phone' || q.get('mode') === 'pane' || q.get('app') || (window.__tryapp && !window.__trywide)) return false;   // TRY-SELF: /try/<app> is that one app full screen (TRY-BIGAPPS: the big editors, on a PC, are the desktop with that app filling it: docs/TRY-WIDE.tsv)
    if (navigator.webdriver && q.get('auto') !== '1') return false;   // automated pages keep the phone unless they ask (the phone tests' bare viewports)
    const fine = matchMedia('(pointer: fine)').matches, mobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    return fine && !mobile && Math.min(innerWidth, screen.width) >= 1024 && Math.min(innerHeight, screen.height) >= 600;
  }
  const mac = /Mac/.test(navigator.platform || navigator.userAgent);
  // KeyboardEvent.code -> set-1 make code (0x100 = the E0 prefix)
  const SC = { Escape: 0x01, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04, Digit4: 0x05, Digit5: 0x06, Digit6: 0x07, Digit7: 0x08, Digit8: 0x09, Digit9: 0x0a, Digit0: 0x0b,
    Minus: 0x0c, Equal: 0x0d, Backspace: 0x0e, Tab: 0x0f, KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13, KeyT: 0x14, KeyY: 0x15, KeyU: 0x16, KeyI: 0x17, KeyO: 0x18, KeyP: 0x19,
    BracketLeft: 0x1a, BracketRight: 0x1b, Enter: 0x1c, ControlLeft: 0x1d, KeyA: 0x1e, KeyS: 0x1f, KeyD: 0x20, KeyF: 0x21, KeyG: 0x22, KeyH: 0x23, KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26,
    Semicolon: 0x27, Quote: 0x28, Backquote: 0x29, ShiftLeft: 0x2a, Backslash: 0x2b, KeyZ: 0x2c, KeyX: 0x2d, KeyC: 0x2e, KeyV: 0x2f, KeyB: 0x30, KeyN: 0x31, KeyM: 0x32,
    Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36, NumpadMultiply: 0x37, AltLeft: 0x38, Space: 0x39, F1: 0x3b, F2: 0x3c, F3: 0x3d, F4: 0x3e, F5: 0x3f, F6: 0x40,
    F7: 0x41, F8: 0x42, F9: 0x43, F10: 0x44, Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4a, Numpad4: 0x4b, Numpad5: 0x4c, Numpad6: 0x4d, NumpadAdd: 0x4e,
    Numpad1: 0x4f, Numpad2: 0x50, Numpad3: 0x51, Numpad0: 0x52, NumpadDecimal: 0x53, IntlBackslash: 0x56, F11: 0x57, F12: 0x58,
    NumpadEnter: 0x11c, ControlRight: 0x11d, NumpadDivide: 0x135, PrintScreen: 0x137, AltRight: 0x138, Home: 0x147, ArrowUp: 0x148, PageUp: 0x149, ArrowLeft: 0x14b,
    ArrowRight: 0x14d, End: 0x14f, ArrowDown: 0x150, PageDown: 0x151, Insert: 0x152, Delete: 0x153, MetaLeft: 0x15b, MetaRight: 0x15c, OSLeft: 0x15b, OSRight: 0x15c, ContextMenu: 0x15d };
  // what the browser keeps for itself (reload, its developer tools) — everything else is ZeusOs's
  const browserKey = (e) => e.code === 'F5' || e.code === 'F12' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyR') ||
    ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.code === 'KeyI' || e.code === 'KeyJ'));
  const stats = window.__deskstats = { inputs: [], frames: [] };

  function attach(ctx) {   // ctx: { W, canvas, dpr, input(kind, fn), log }
    const { W, canvas, dpr, log } = ctx; const held = new Map();   // code -> set-1 code, so a lost focus lets go of all
    const send = (c, up) => { if (c > 0xff) W.web_scancode(0xe0); W.web_scancode((c & 0xff) | (up ? 0x80 : 0)); };
    const tap = (c) => { send(c, false); send(c, true); };
    canvas.tabIndex = 0; canvas.style.outline = 'none'; canvas.style.cursor = 'default';
    canvas.focus({ preventScroll: true });
    let pasteWait = 0; const pasteKey = () => { clearTimeout(pasteWait); pasteWait = 0; held.set('KeyV', 0x2f); ctx.input('key', () => send(0x2f, false)); if (mac) { held.delete('KeyV'); ctx.input('key', () => send(0x2f, true)); } };
    const key = (e, up) => {
      if (browserKey(e)) return;
      e.stopImmediatePropagation();
      // Ctrl/Cmd+V: the browser's paste event brings the system clipboard first (a prevented key would not fire it)
      if (!up && (e.ctrlKey || e.metaKey) && e.code === 'KeyV' && !e.repeat) { clearTimeout(pasteWait); pasteWait = setTimeout(pasteKey, 150); return; }
      e.preventDefault();
      if (!up && (e.ctrlKey || e.metaKey) && e.code === 'Tab') { ctx.input('key', () => { send(0x38, false); tap(0x0f); send(0x38, true); }); return; }   // Ctrl/Cmd+Tab: ZeusOs's Alt+Tab (the next window)
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Space') { if (!up) ctx.input('key', () => { send(0x15b, false); tap(0x39); send(0x15b, true); }); return; }   // Ctrl+Space: Spotlight (Super+Space; the Windows key belongs to Windows, Cmd+Space to macOS)
      if (e.code === 'Lang1' || e.code === 'HangulMode' || e.code === 'KanaMode' || (mac && e.code === 'CapsLock')) { if (!up) ctx.input('key', () => W.web_scancode(0xf2)); return; }   // 한/영 (a Mac's Caps Lock switches input as in macOS)
      const c = SC[e.code]; if (c === undefined) return;
      if (up) { if (!held.has(e.code)) return; held.delete(e.code); ctx.input('key', () => send(c, true)); return; }
      held.set(e.code, c);
      ctx.input('key', () => send(c, false));
      if (mac && e.metaKey && !/^Meta|^OS/.test(e.code)) { held.delete(e.code); ctx.input('key', () => send(c, true)); }   // macOS sends no keyup for a key pressed with Cmd held
    };
    window.addEventListener('keydown', (e) => key(e, false), true);
    window.addEventListener('keyup', (e) => key(e, true), true);
    const letGo = () => { for (const c of held.values()) send(c, true); held.clear(); if (lastBtn) { W.web_mouse(lastX, lastY, 0, 0, 0); lastBtn = 0; } };
    window.addEventListener('blur', () => { letGo(); W.web_frame(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
    // the pointer: absolute device pixels, the buttons as a USB mouse's (1 left, 2 right, 4 middle)
    let lastX = 0, lastY = 0, lastBtn = 0, accY = 0, accX = 0;
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * dpr), Math.round((e.clientY - r.top) * dpr)]; };
    const stage = canvas.parentElement;
    const ptr = (e) => {
      e.stopImmediatePropagation(); if (e.type !== 'pointermove') e.preventDefault();
      const [x, y] = at(e); lastX = x; lastY = y; const b = e.buttons & 7;
      if (e.type === 'pointerdown') { canvas.focus({ preventScroll: true }); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } }
      const kind = e.type === 'pointermove' ? (b ? 'drag' : 'move') : e.type === 'pointerdown' ? 'down' : 'up';
      lastBtn = b; ctx.input(kind, () => W.web_mouse(x, y, b, 0, 0));
    };
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) stage.addEventListener(t, ptr, true);
    stage.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    stage.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }, true);   // no auto-scroll on a middle press
    stage.addEventListener('wheel', (e) => {
      e.preventDefault(); e.stopImmediatePropagation(); const [x, y] = at(e);
      const k = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;   // lines, pages -> pixels
      accY += e.deltaY * k; accX += e.deltaX * k;
      let n = 0, h = 0; const step = 50;   // a mouse notch is ~100 px, a trackpad sends small steps: one notch per 50 px
      while (accY >= step) { accY -= step; n--; } while (accY <= -step) { accY += step; n++; }
      while (accX >= step) { accX -= step; h++; } while (accX <= -step) { accX += step; h--; }
      if (n || h) ctx.input('wheel', () => W.web_mouse(x, y, e.buttons & 7, n, h));
    }, { capture: true, passive: false });
    // the system clipboard -> ZeusOs's (a paste with Ctrl/Cmd+V reads it first; the browser asks once)
    document.addEventListener('paste', (e) => {
      const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; e.preventDefault(); e.stopImmediatePropagation();
      ctx.clip(t); if (pasteWait) pasteKey();
    }, true);
    // DESK-RESIZE (owner 11-12 「양방향」): files dragged in from the computer's Finder / Explorer. The listeners sit on the WINDOW (capture), not on
    // the stage: a drop over anything else on the page (the first-run note, a banner, the edge strips) must not fall through to the browser, which
    // would open the file in the tab. The drop point goes to ZeusOs (web_drop): onto Files = into the folder it shows, onto Retouch / Video Editor /
    // Paint = opened there, else the desktop.
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].some((t) => t === 'Files' || t === 'application/x-moz-file');
    const over = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); try { e.dataTransfer.dropEffect = 'copy'; } catch (x) { /* read-only in some engines */ } };
    window.addEventListener('dragenter', over, true); window.addEventListener('dragover', over, true);
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return; e.preventDefault(); e.stopImmediatePropagation();
      const files = Array.from(e.dataTransfer.files || []);   // read NOW: Safari and Chrome empty the DataTransfer when the handler returns
      if (!files.length) return; const [x, y] = at(e);
      bringIn(files, x, y);
    }, true);
    async function bringIn(files, x, y) {
      // the Video Editor in front: a video file is turned into an edit copy by the browser's own decoder (MP4 / MOV / WebM -> the editor's MJPEG AVI) and lands on the timeline
      const front = (() => { if (!ctx.W.web_front_key) return ''; const p = ctx.W.web_front_key(), m = new Uint8Array(ctx.W.memory.buffer); let k = ''; for (let i = p; m[i]; i++) k += String.fromCharCode(m[i]); return k; })();
      if (front === 'videoedit' && x >= 0 && ctx.takeVideos) { const vids = files.filter((f) => ctx.isVideo(f)); if (vids.length) { toast(T.bringing(vids[0].name, 0), 60000); await ctx.takeVideos(vids); toast(T.brought(vids.length), 2500); log.push('WEB desk drop ' + vids.length + ' videos'); files = files.filter((f) => !ctx.isVideo(f)); if (!files.length) { W.web_frame(); return; } } }
      let n = 0, done = 0; const total = files.reduce((a, f) => a + f.size, 0) || 1;
      for (const f of files.slice(0, 16)) {
        if (f.size > MAXIN) { log.push('WEB desk drop too big ' + f.name); toast(T.toobig(f.name, MAXIN >> 20), 5000); continue; }
        const name = safeName(f.name); let b;
        try { b = await readAll(f, (got) => toast(T.bringing(name, Math.round((done + got) * 100 / total)))); } catch (err) { log.push('WEB desk drop unreadable ' + f.name); toast(T.unread(f.name), 5000); continue; }
        done += f.size; if (ctx.writeMain('/tmp/drop/' + name, b) === 0) n++;
      }
      if (n) { const r = W.web_drop(x, y); log.push('WEB desk drop ' + n + ' files' + (r ? '' : ' (not placed)')); toast(T.brought(n), 2500); } else log.push('WEB desk drop 0 files');
      W.web_files_reload(); W.web_frame();
    }
    ctx.bringIn = bringIn;
    // full screen: the browser's own shortcuts (Ctrl+W, Ctrl+Tab, Cmd+Q…) go to ZeusOs too (Keyboard Lock, Chromium)
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().then(() => log.push('WEB desk keyboard locked'), () => {});
    });
    log.push('WEB desk attached dpr=' + dpr + ' mac=' + (mac ? 1 : 0));
    me = ctx; watchFront();
    setTimeout(() => ctx.run('weblite pack manual'), 4000);   // Help's pages (the phone fetches them when Help opens; a desktop opens Help from any app's menu)
    if (!localStorage.getItem('zeus-desk-note') && q.get('note') !== '0' && !window.__try) note(true);   // TRY-SELF: the try build has its own first screen (「지금 해 볼 것」) and a 「저장」 note
  }

  // ---- where the files live: a note in plain words, the first time and from the ZeusOs menu (⚡ › 이 브라우저의 내 파일) ----
  let me = null;
  const MAXIN = 200 << 20;   // one file in: the tab's memory (512 MB for the whole desktop) is the limit
  function safeName(raw) {   // ZeusOs names: no / or control or punctuation it refuses, 31 bytes — the extension is kept
    let n = String(raw).replace(/[\/\\\x00-\x1f:*?"<>|]/g, '_').replace(/^\.+/, '_'); const enc = new TextEncoder(); if (!n) n = '_';
    if (enc.encode(n).length <= 31) return n;
    const dot = n.lastIndexOf('.'), ext = dot > 0 && n.length - dot <= 8 ? n.slice(dot) : '', stem = dot > 0 && ext ? n.slice(0, dot) : n;
    let out = ''; for (const ch of stem) { if (enc.encode(out + ch + ext).length > 31) break; out += ch; } return out + ext;
  }
  async function readAll(f, onProgress) {   // a File's bytes, reporting how far it got (a PSD is 100 MB+)
    if (!f.stream) return new Uint8Array(await f.arrayBuffer());
    const r = f.stream().getReader(), out = new Uint8Array(f.size); let got = 0;
    for (;;) { const { done, value } = await r.read(); if (done) break; out.set(value, got); got += value.length; onProgress(got); }
    return got === f.size ? out : out.subarray(0, got);
  }
  let toastEl = null, toastT = 0;
  function toast(text, ms) {   // one small line at the bottom: progress of a big file, what happened
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'desk-toast'; toastEl.setAttribute('role', 'status'); toastEl.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:19;background:rgba(30,30,32,.92);color:#fff;font:14px/1.4 -apple-system,system-ui,"Noto Sans KR",sans-serif;padding:9px 16px;border-radius:12px;pointer-events:none;max-width:80vw'; document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.display = 'none'; }, ms || 1500);
  }
  const ko = !/^en/i.test(navigator.language || 'ko') || /^ko/i.test(navigator.language || '');
  const T = ko ? {
    title: '이 나눔OS 는 지금 이 브라우저 안에서 돌아요',
    body: '서버에 있는 컴퓨터를 빌려 쓰는 게 아니라, 이 컴퓨터의 브라우저가 나눔OS 를 직접 돌려요. 그래서 만든 파일도 <b>이 컴퓨터의 이 브라우저 안에만</b> 보관돼요 — 공책을 내 책상 서랍에 넣어 두는 것과 같아요. 브라우저의 「사이트 데이터 삭제」를 하면 함께 지워지니, 중요한 파일은 가끔 내려받아 두세요.',
    now: '<b>지금 할 일:</b> 그냥 쓰시면 돼요. 나중에는 왼쪽 위 번개(⚡) 메뉴 → 「이 브라우저의 내 파일」에서 이 창을 다시 열 수 있어요.',
    down: '내 파일 내려받기', up: '파일 불러오기', ok: '시작하기', more: '기술 자세히',
    tech: '저장 위치: 이 사이트의 IndexedDB(브라우저 저장소) · 내려받기는 /home/zeus 아래 모든 파일을 ZIP 하나로 · 불러오기는 그 ZIP 을 다시 넣고 새로 고침 · 프로그램은 WebAssembly(desk.wasm)로 이 탭에서 실행 · 서버는 파일을 받지도 보관하지도 않음(뉴스·라디오 등 바깥 주소만 중계). 단축키: Ctrl+Space(맥은 ⌘+Space 대신 Ctrl+Space) 찾기 · Ctrl/⌘+Tab 창 바꾸기 · Ctrl/⌘+Q 끝내기 · 한/영: 한/영 키·오른쪽 Alt·Shift+Space(맥은 Caps Lock). 브라우저가 쥔 단축키(Ctrl+W 등)는 전체 화면(F11)에서 나눔OS 로 갑니다.',
    openHost: '내 컴퓨터에서 열기…', saveHost: '내 컴퓨터에 저장', saveFirst: '먼저 편집기에서 저장하거나 내보내 주세요', dragout: '끌어서 컴퓨터 폴더에 놓으면 저장돼요', nodrag: '이 브라우저는 끌어 내기를 못 해요 — 「내 컴퓨터에 저장」을 눌러 주세요',
    bringing: (n, p) => n + ' 넣는 중… ' + p + '%', brought: (n) => '파일 ' + n + '개를 넣었어요', toobig: (n, mb) => n + ' — 이 브라우저에는 ' + mb + 'MB 넘는 파일을 넣을 수 없어요', unread: (n) => n + ' 을(를) 읽지 못했어요', savedOne: (n) => n + ' 을(를) 내 컴퓨터에 저장했어요', nothing: '저장할 파일이 없어요',
    saved: (n) => '파일 ' + n + '개를 내려받았어요', none: '아직 저장된 파일이 없어요', loaded: (n) => '파일 ' + n + '개를 넣었어요 — 다시 열어요', bad: '이 파일은 나눔OS 내려받기 ZIP 이 아니에요',
  } : {
    title: 'This NanumOS runs right here, in your browser',
    body: 'Nothing is borrowed from a server: this computer\'s browser runs NanumOS itself. So the files you make stay <b>only in this browser on this computer</b> — like a notebook kept in your own desk drawer. Clearing the browser\'s site data clears them too, so download the important ones now and then.',
    now: '<b>What to do now:</b> just use it. Later, the bolt (⚡) menu at the top left → "Your Files in This Browser" opens this again.',
    down: 'Download my files', up: 'Bring files back', ok: 'Start', more: 'Technical details',
    tech: 'Kept in: this site\'s IndexedDB (browser storage) · Download = every file under /home/zeus in one ZIP · Bring back = that ZIP again, then a reload · Programs run as WebAssembly (desk.wasm) in this tab · The server neither receives nor keeps your files (it only relays outside addresses such as news and radio). Keys: Ctrl+Space Spotlight · Ctrl/Cmd+Tab next window · Ctrl/Cmd+Q quit · Hangul: the Han/Eng key, right Alt, Shift+Space (Caps Lock on a Mac). Keys the browser keeps (Ctrl+W…) reach NanumOS in full screen (F11).',
    openHost: 'Open from My Computer…', saveHost: 'Save to My Computer', saveFirst: 'Save or export in the editor first', dragout: 'Drag this to a folder on your computer to save it', nodrag: 'This browser cannot drag files out — press "Save to My Computer"',
    bringing: (n, p) => 'Bringing in ' + n + '… ' + p + '%', brought: (n) => n + ' file(s) brought in', toobig: (n, mb) => n + ' — this browser cannot take a file over ' + mb + ' MB', unread: (n) => 'Could not read ' + n, savedOne: (n) => 'Saved ' + n + ' to your computer', nothing: 'Nothing to save',
    saved: (n) => n + ' files downloaded', none: 'No files saved yet', loaded: (n) => n + ' files put back — reopening', bad: 'This is not a NanumOS download ZIP',
  };
  function note(first) {
    let d = document.getElementById('desk-note'); if (d) { d.hidden = false; d.style.display = 'grid'; return; }
    d = document.createElement('div'); d.id = 'desk-note'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', T.title);
    d.style.cssText = 'position:fixed;inset:0;z-index:20;display:grid;place-items:center;background:rgba(0,0,0,.28);font:15px/1.55 -apple-system,system-ui,"Noto Sans KR",sans-serif';
    d.innerHTML = '<div style="background:#fbfbfd;color:#1d1d1f;border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.35);padding:24px 26px;max-width:520px;width:calc(100vw - 48px)">' +
      '<div style="font-weight:650;font-size:18px;margin:0 0 10px">' + T.title + '</div><p style="margin:0 0 10px">' + T.body + '</p><p style="margin:0 0 14px">' + T.now + '</p>' +
      '<details style="margin:0 0 16px;color:#6e6e73;font-size:13px"><summary style="cursor:pointer">' + T.more + '</summary><p style="margin:8px 0 0">' + T.tech + '</p></details>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button data-a="down">' + T.down + '</button><button data-a="up">' + T.up + '</button><button data-a="ok" style="background:#0071e3;color:#fff">' + T.ok + '</button></div>' +
      '<div data-a="msg" style="margin-top:10px;color:#6e6e73;font-size:13px;min-height:1em"></div></div>';
    for (const b of d.querySelectorAll('button')) b.style.cssText += ';font:inherit;border:0;border-radius:9px;padding:9px 14px;cursor:pointer;' + (b.dataset.a === 'ok' ? '' : 'background:#e8e8ed;color:#1d1d1f');
    const msg = d.querySelector('[data-a=msg]');
    d.addEventListener('keydown', (e) => e.stopPropagation(), true);
    d.querySelector('[data-a=ok]').onclick = () => { d.hidden = true; d.style.display = 'none'; localStorage.setItem('zeus-desk-note', '1'); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((p) => me && me.log.push('WEB desk storage persist ' + p)); me && me.canvas.focus(); };
    d.querySelector('[data-a=down]').onclick = async () => { const n = await download(); msg.textContent = n ? T.saved(n) : T.none; };
    d.querySelector('[data-a=up]').onclick = () => bringBack(msg);
    document.body.appendChild(d); d.querySelector('[data-a=ok]').focus();
    if (me) me.log.push('WEB desk note ' + (first ? 'first' : 'menu'));
  }
  // ---- ZIP (stored; read back: stored or deflate) — the files under /home/zeus as they are in IndexedDB ----
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(entries) {   // [[name, Uint8Array]]
    const enc = new TextEncoder(), parts = [], cent = []; let off = 0;
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    for (const [name, data] of entries) {
      const nb = enc.encode(name), c = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x800, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(h.buffer), nb, data); cent.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + data.length;
    }
    const csz = cent.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cent, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  async function unzip(buf) {   // -> [[name, Uint8Array]] (stored or deflated entries)
    const v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), out = []; let e = buf.byteLength - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('no zip');
    let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
    for (let i = 0; i < n; i++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip');
      const meth = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + csz);
      if (name.endsWith('/')) continue;
      if (meth === 0) out.push([name, raw.slice()]);
      else if (meth === 8 && window.DecompressionStream) out.push([name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())]);
    }
    return out;
  }
  async function download() {
    if (!me) return 0;
    const all = (await me.files()).filter(([k]) => k.startsWith('/home/zeus/')).map(([k, b]) => ['zeus/' + k.slice('/home/zeus/'.length), new Uint8Array(b)]);
    if (!all.length) return 0;
    const a = document.createElement('a'), d = new Date(), pad = (x) => String(x).padStart(2, '0');
    a.href = URL.createObjectURL(zip(all)); a.download = 'ZeusOs-files-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.zip';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    me.log.push('WEB desk download ' + all.length + ' files'); return all.length;
  }
  function bringBack(msg) {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.zip,application/zip';
    f.onchange = async () => {
      const file = f.files && f.files[0]; if (!file) return;
      let ents; try { ents = await unzip(await file.arrayBuffer()); } catch (e) { msg.textContent = T.bad; return; }
      ents = ents.filter(([n]) => n.startsWith('zeus/') && !n.includes('..'));
      if (!ents.length) { msg.textContent = T.bad; return; }
      for (const [n, b] of ents) me.saveFile('/home/zeus/' + n.slice(5), b);
      me.log.push('WEB desk import ' + ents.length + ' files'); msg.textContent = T.loaded(ents.length);
      setTimeout(() => location.reload(), 900);
    };
    f.click();
  }
  // 「내 컴퓨터에 저장」: the selected paths (Files' menu) as one download — a file is itself, several or a folder one zip
  async function saveToHost(paths) {
    if (!me) return 0; const ents = []; let single = null;
    let idb = null;
    for (const p of paths) {
      const b = me.isFile(p) ? me.readMain(p) : null;
      if (b) { ents.push([p.split('/').pop(), b]); single = ents.length === 1 ? [p.split('/').pop(), b] : null; continue; }
      idb = idb || await me.files(); const pre = p.endsWith('/') ? p : p + '/', base = p.split('/').pop() + '/';
      for (const [k, v] of idb) if (k.startsWith(pre)) ents.push([base + k.slice(pre.length), new Uint8Array(v)]);
      single = null;
    }
    if (!ents.length) { toast(T.nothing, 3000); return 0; }
    const d = new Date(), pad = (x) => String(x).padStart(2, '0'); let blob, name;
    if (single && ents.length === 1) { blob = new Blob([single[1]], { type: mime(single[0]) }); name = single[0]; }
    else { blob = zip(ents); name = 'NanumOS-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.zip'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    me.log.push('WEB desk save ' + name + ' ' + blob.size); toast(T.savedOne(name), 3000); return ents.length;
  }
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', mp4: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', psd: 'image/vnd.adobe.photoshop', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const mime = (n) => MIME[(n.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  function pickFromHost(inApp) {   // the browser's own file picker (every browser, phones too): the chosen files land where Files is
    const f = document.createElement('input'); f.type = 'file'; f.multiple = true; f.style.display = 'none'; document.body.appendChild(f);
    f.onchange = () => { const fl = Array.from(f.files || []); f.remove(); if (fl.length && me) { const cv = me.canvas; me.bringIn(fl, inApp ? Math.round(cv.width / 2) : -1, inApp ? Math.round(cv.height / 2) : -1); } };
    f.click();
  }
  // ---- Photo Retouch / Video Editor (separate programs inside the page): the host bridge the owner asked for (11-12 「양방향」) ----
  // 「내 컴퓨터에서 열기」 = the browser's picker, the chosen file opened IN the front editor (the same road as a drop on its window);
  // 「내 컴퓨터에 저장」 = the last file the editor saved or exported, downloaded. The name in the offer bar can be dragged out to Finder / Explorer
  // where the browser allows it (Chromium: DownloadURL); Safari and Firefox get a one-line hint instead.
  let last = null;   // {name, bytes}
  function remember(bar, name, bytes) {
    last = { name, bytes };
    const t = bar && bar.querySelector('#try-offer-text'); if (!t) return;
    t.draggable = true; t.title = DRAGOK ? T.dragout : T.nodrag; t.style.cursor = 'grab';
    t.addEventListener('dragstart', (e) => {
      if (!DRAGOK) { toast(T.nodrag, 4000); e.preventDefault(); return; }
      const url = URL.createObjectURL(new Blob([bytes], { type: mime(name) })); e.dataTransfer.setData('DownloadURL', mime(name) + ':' + name + ':' + url); e.dataTransfer.effectAllowed = 'copy';
      setTimeout(() => URL.revokeObjectURL(url), 120000); if (me) me.log.push('WEB desk dragout ' + name);
    });
  }
  const DRAGOK = /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);   // DownloadURL: Chromium family only
  let pills = null;
  function pillsFor(key) {
    const want = key === 'retouch' || key === 'videoedit';
    if (!want) { if (pills) pills.style.display = 'none'; return; }
    if (!pills) {
      pills = document.createElement('div'); pills.id = 'desk-host-pills'; pills.style.cssText = 'position:fixed;right:16px;bottom:84px;z-index:18;display:flex;gap:8px;font:600 13px/1 -apple-system,system-ui,"Noto Sans KR",sans-serif';
      for (const [id, label, fn] of [['open', T.openHost, () => pickFromHost(true)], ['save', T.saveHost, saveLast]]) {
        const b = document.createElement('button'); b.id = 'desk-host-' + id; b.textContent = label; b.style.cssText = 'border:0;border-radius:10px;padding:9px 13px;background:rgba(30,30,32,.9);color:#fff;cursor:pointer'; b.onclick = fn; pills.append(b);
      }
      document.body.appendChild(pills);
    }
    pills.style.display = 'flex';
  }
  function saveLast() {
    if (!last) { toast(T.saveFirst, 4000); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([last.bytes], { type: mime(last.name) })); a.download = last.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); me.log.push('WEB desk save ' + last.name + ' ' + last.bytes.length); toast(T.savedOne(last.name), 3000);
  }
  function watchFront() { setInterval(() => { if (me && me.W.web_front_key) { const p = me.W.web_front_key(), n = new Uint8Array(me.W.memory.buffer); let k = ''; for (let i = p; n[i]; i++) k += String.fromCharCode(n[i]); pillsFor(k); } }, 700); }
  function job(what, args) {
    if (what === 'desk-save') { saveToHost((args || []).map((a) => decodeURIComponent(a))); return; }
    if (what === 'desk-pick') { pickFromHost(); return; }
    if (what === 'desk-reload') { if (me) me.W.web_save_now(); location.reload(); return; }
    if (what === 'desk-files') note(false);
  }
  return { wanted, attach, job, download, remember, mode: wanted() ? 'desktop' : 'phone' };
})();
// LITE-PERSIST (docs/WEB-LITE.md "Keeping the phone's files"; owner 11-03 「지금 브라우저에 저장하는 방식은 날아갈 수 있으니」).
// The person's files live in this browser (IndexedDB 'zeusos-weblite') and nowhere on our server. This file keeps them safe
// without moving them to us:
//   1. asks the browser to keep them (navigator.storage.persist) the first time the person saves something, and says the
//      answer in Settings › 저장 공간·백업 together with navigator.storage.estimate (used / available);
//   2. on an iPhone Safari tab (not on the home screen) says once that Safari clears a site left unused for 7 days;
//   3. makes one backup file (.zip: every file + the page's settings + manifest.json with each file's SHA-256) that the
//      person saves where they like (share sheet, else a download), and restores one (merge or replace — asked first);
//   4. copies the files to the person's own zcloud (standard WebDAV, docs/ZCLOUD.md §4: PUT to a hidden name, then MOVE);
//      the address, the name and the password stay in this browser's localStorage, never on our server;
//   4b. (owner 11:15) the backup place is the person's choice, changeable any time: 내 파일 (share sheet / download),
//      iCloud Drive (the share sheet's 「파일에 저장」 — no Apple key), Google Drive (browser-only OAuth token, drive.file scope,
//      the token only in this tab's memory; without a registered client id: the share sheet into the Drive app), 내 zcloud;
//   5. warns before loss: when the browser may clear the site (persist denied, space low, a Safari tab) and some file has
//      not been backed up for 7 days, a plain banner with a one-tap backup; otherwise a gentle weekly reminder.
// weblite.js calls ZKeep.start(api) after boot, ZKeep.saved(path) / ZKeep.removed(path) as files are written, ZKeep.open()
// for the Settings row (`weblite storage`). While a restore is being written, ZKeep.frozen stops weblite.js from saving.
'use strict';
window.ZKeep = (() => {
  const DAY = 864e5, WEEK = 7 * DAY, HOME = '/home/zeus/';
  const K = { state: 'zeus-keep', dav: 'zeus-keep-dav', sums: 'zeus-keep-davsum', place: 'zeus-keep-place', gfile: 'zeus-keep-gfile' };   // localStorage keys (this browser only)
  let api = null, ko = true, persisted = null, usage = -1, quota = -1, asked = false, built = null, builtAt = 0, dirtyAt = 0;
  const q = new URLSearchParams(location.search), auto = !(navigator.webdriver && q.get('keep') !== '1') && q.get('banner') !== '0';   // tests: banners only with ?keep=1
  const now = () => Date.now() + (+q.get('keepnow') || 0) * DAY;   // ?keepnow=8: tests stand 8 days later
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  const st = () => Object.assign({ lastBackup: 0, unbackedSince: 0, remindAt: 0, iosHint: 0, files: 0, chosen: 0 }, ls.get(K.state, {}));
  const put = (o) => ls.set(K.state, Object.assign(st(), o));
  const log = (m) => api && api.log.push('WEB keep ' + m);
  const L = (k, e) => ko ? k : e;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const iosTab = () => ios() && !standalone();
  const userFile = (p) => p.startsWith('/') && !p.startsWith('/tmp/') && !/\/\.cache(\/|$)/.test(p);
  const ownFile = (p) => p.startsWith(HOME) && !p.slice(HOME.length).split('/').some((x) => x.startsWith('.'));   // something the person made (Notes, Documents, photos), not an app's own dot-file
  const mb = (n) => n < 0 ? '?' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(1) + ' GB';
  const ago = (t) => { if (!t) return L('아직 없음', 'never'); const d = Math.floor((now() - t) / DAY), h = Math.floor((now() - t) / 36e5);
    return d >= 1 ? L(d + '일 전', d + (d > 1 ? ' days ago' : ' day ago')) : h >= 1 ? L(h + '시간 전', h + ' h ago') : L('방금', 'just now'); };

  // ---- 1. ask the browser to keep the files; measure the room ----
  async function measure() {
    try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch (e) { /* not here */ }
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usage = e.usage || 0; quota = e.quota || 0; } } catch (e) { /* not here */ }
    line();
  }
  async function askPersist(why) {
    if (asked || persisted === true) return; asked = true;
    if (!(navigator.storage && navigator.storage.persist)) { persisted = null; log('persist unsupported'); line(); return; }
    try { persisted = await navigator.storage.persist(); } catch (e) { persisted = false; }
    log('persist asked (' + why + ') -> ' + persisted); measure();
  }
  const pressure = () => quota > 0 && usage / quota > 0.8;
  const atRisk = () => persisted !== true || pressure() || iosTab();
  function guardText() {
    if (iosTab()) return L('Safari 탭에서는 7일 동안 열지 않으면 자료가 지워질 수 있어요. 홈 화면에 추가한 앱은 빈 상태로 따로 시작해요 — 먼저 여기서 백업 파일을 만들고, 그 앱에서 되살리세요.',
      'In a Safari tab, files can be cleared after 7 days unused. An app added to the Home Screen starts empty, on its own — make a backup file here first, then restore it in that app.');   // LITE-CHATLOSS: iOS keeps a Home Screen app's storage apart from Safari's
    if (persisted === true) return L('이 브라우저가 자료를 지우지 않도록 지켜 두었어요.', 'This browser keeps your files: it will not clear them by itself.');
    if (persisted === false) return L('브라우저가 공간이 모자라면 지울 수 있어요 — 홈 화면에 추가하거나 백업을 켜 두세요.',
      'The browser may clear them when space runs low — add this to your home screen or turn on a backup.');
    return L('이 브라우저는 「지켜 달라」는 요청을 받지 않아요 — 백업 파일을 만들어 두세요.', 'This browser cannot be asked to keep files — make a backup file.');
  }
  function line() {   // Settings' row (web.c web_keep_line): "ko<TAB>en"
    if (!api || !api.W.web_keep_line) return;
    const s = st(), d = dav(), synced = d && d.ok;
    const k = (persisted === true && !iosTab() ? '지켜 둠' : '브라우저가 지울 수 있음') + ' · ' + (synced ? 'zcloud 에 맞춤' : '마지막 백업 ' + (s.lastBackup ? agoKo(s.lastBackup) : '없음'));
    const e = (persisted === true && !iosTab() ? 'Kept' : 'The browser may clear it') + ' · ' + (synced ? 'copied to zcloud' : 'last backup ' + (s.lastBackup ? agoEn(s.lastBackup) : 'never'));
    const b = new TextEncoder().encode(k + '\t' + e), p = api.W.web_buf(b.length + 1), v = new Uint8Array(api.W.memory.buffer); v.set(b, p); v[p + b.length] = 0;
    api.W.web_keep_line(p); api.frame();
    if (shown(sheet)) render();
  }
  const agoKo = (t) => { const o = ko; ko = true; const r = ago(t); ko = o; return r; }, agoEn = (t) => { const o = ko; ko = false; const r = ago(t); ko = o; return r; };

  // ---- 3. the backup file: a plain .zip (stored), files/<path>, settings.json, manifest.json ----
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const sha = async (b) => hex(await crypto.subtle.digest('SHA-256', b));
  const enc = new TextEncoder(), dec = new TextDecoder();
  function zip(entries) {   // [[name, Uint8Array]] -> Uint8Array; UTF-8 names (flag 0x800), method 0
    const parts = [], cen = []; let off = 0; const d = new Date(), dt = ((d.getFullYear() - 1980) << 25 | (d.getMonth() + 1) << 21 | d.getDate() << 16 | d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1) >>> 0;
    for (const [name, data] of entries) {
      const nb = enc.encode(name), c = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, 0, true); h.setUint32(10, dt, true);
      h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x800, true);
      ch.setUint16(10, 0, true); ch.setUint32(12, dt, true); ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true); cen.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const cs = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    const all = [...parts, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0;
    for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }
  async function unzip(b) {   // our own files (stored); deflated entries too where the browser can inflate (DecompressionStream)
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('not a zip');
    const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = new Map();
    for (let k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('broken zip');
      const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
      const ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true); let data = b.slice(ds, ds + csize);
      if (method === 8) { if (typeof DecompressionStream === 'undefined') throw new Error('deflate'); data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
      else if (method !== 0) throw new Error('method ' + method);
      if (crc32(data) !== crc) throw new Error('crc ' + name);
      if (!name.endsWith('/')) out.set(name, data);
    }
    return out;
  }
  function settingsNow() {   // the page's own settings (localStorage zeus-*), never the zcloud password
    const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^zeus-/.test(k) && k !== K.dav && k !== K.sums && k !== K.gfile) o[k] = localStorage.getItem(k); } } catch (e) { /* private */ }
    return o;
  }
  async function build() {
    if (api.W.web_save_now) api.W.web_save_now();   // what is typed now is in it
    const files = await api.files(), entries = [], list = [];
    for (const [path, bytes] of files) { const b = new Uint8Array(bytes); entries.push(['files' + path, b]); list.push({ path, size: b.length, sha256: await sha(b) }); }
    const set = settingsNow(), made = new Date(now()).toISOString();
    entries.unshift(['manifest.json', enc.encode(JSON.stringify({ format: 'zeusos-lite-backup', version: 1, made, files: list }, null, 1))], ['settings.json', enc.encode(JSON.stringify(set, null, 1))]);
    const z = zip(entries); built = z; builtAt = Date.now();
    log('backup built files=' + list.length + ' bytes=' + z.length);
    return { zip: z, n: list.length, name: '나눔OS 백업 ' + made.slice(0, 10) + '.zip' };
  }
  async function backup(from) {   // the button: to the chosen place (place()); the share sheet (iPhone: 「파일에 저장」), else a download
    const where = place(), pop = where === 'gdrive' && cfg.google_client_id && !gtoken() ? window.open('', 'zeus-google', 'width=480,height=640') : null;   // inside the tap
    let r; try { r = await build(); } catch (e) { if (pop) pop.close(); log('backup failed ' + e); say(L('백업 파일을 만들지 못했어요.', 'Could not make the backup file.')); return false; }
    if (where === 'gdrive' && cfg.google_client_id) {
      try { const id = await gdriveUpload(r, pop); done(r, 'gdrive id=' + id, from, L('Google Drive 에 백업했어요: 파일 ' + r.n + '개', 'Backed up to Google Drive: ' + r.n + ' files')); return true; }
      catch (e) { log('backup gdrive failed ' + e.message); msg = L('Google Drive 에 올리지 못했어요: ', 'Could not upload to Google Drive: ') + gwhy(e); if (shown(sheet)) render(); say(msg); return false; }
    }
    if (where === 'zcloud' && dav()) {
      try { await davPut(dav(), HOME + '.backup/' + r.name, r.zip); done(r, 'zcloud', from, L('zcloud 에 백업했어요: 파일 ' + r.n + '개', 'Backed up to zcloud: ' + r.n + ' files')); return true; }
      catch (e) { log('backup zcloud failed ' + e.message); say(L('zcloud 에 올리지 못했어요 — 백업 파일로 저장해요.', 'Could not upload to zcloud — saving a backup file instead.')); }
    }
    const file = new File([r.zip], r.name, { type: 'application/zip' }); let how = 'download';
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { how = 'share'; await navigator.share({ files: [file], title: r.name }); }
    } catch (e) { if (e && e.name === 'AbortError') { log('backup share cancelled'); return false; } how = 'download'; }
    if (how === 'download') { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = r.name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000); }
    done(r, how + ' ' + r.name, from, L('백업 파일을 만들었어요: 파일 ' + r.n + '개', 'Backup file made: ' + r.n + ' files'));
    return true;
  }
  function done(r, how, from, text) {
    put({ lastBackup: now(), unbackedSince: 0, remindAt: 0, files: r.n }); log('backup ' + how + ' files=' + r.n + ' bytes=' + r.zip.length + ' place=' + place() + ' from=' + from);
    hideBar(); line(); say(text);
  }

  // ---- 4b. where backups go: the person's choice ----
  const PLACES = ['file', 'icloud', 'gdrive', 'zcloud'];
  const place = () => { try { const v = localStorage.getItem(K.place); return PLACES.includes(v) ? v : ios() ? 'icloud' : 'file'; } catch (e) { return 'file'; } };
  const placeName = (p) => ({ file: L('내 파일', 'My files'), icloud: 'iCloud Drive', gdrive: 'Google Drive', zcloud: L('내 zcloud', 'My zcloud') })[p];
  function placeHelp(p) {
    if (p === 'icloud') return L('웹에서는 iCloud 에 저절로 올릴 수 없어요. 「iCloud Drive 에 저장」을 누르면 공유 창이 떠요 — 「파일에 저장」 → iCloud Drive 를 고르세요. 7일마다 알림으로 챙겨 드려요. Apple 계정은 휴대폰이 쓰고, 우리는 보지 않아요.',
      'A web page cannot upload to iCloud by itself. Save to iCloud Drive opens the share sheet — choose Save to Files → iCloud Drive. A reminder comes every 7 days. Your phone uses your Apple account; we never see it.');
    if (p === 'gdrive') return cfg.google_client_id
      ? L('내 Google 계정으로 로그인하면, 파일을 저장할 때마다 백업 파일이 내 Google Drive 에 저절로 올라가요. 열쇠(토큰)는 이 탭에만 있고 우리 서버는 거치지 않아요. 로그인은 한 시간쯤 가요 — 끝나면 한 번 눌러 이어가요.', 'Sign in with your Google account and the backup file goes to your Google Drive by itself whenever you save. The key (token) stays in this tab and never passes our server. A sign-in lasts about an hour — then one tap carries on.')
      : L('곧 돼요 — 그때까지는 공유 창에서 Google Drive 앱을 고르면 돼요(앱이 깔려 있어야 해요).', 'Coming soon — until then, choose the Google Drive app in the share sheet (it must be installed).');
    if (p === 'zcloud') return L('집 NAS(zcloud)에 백업 파일을 올리고, 저장하는 파일도 계속 복사해 둬요.', 'The backup file goes to your home NAS (zcloud), and every saved file is copied there too.');
    return L('공유 창이나 내려받기로 휴대폰에 저장해요. 어디에 둘지는 내가 정해요.', 'Saved on the phone through the share sheet or a download — you choose where.');
  }
  // Google Drive without our server: OAuth 2.0 token flow for browser apps (no client secret), scope drive.file (only files this
  // app made), the redirect page oauth.html hands the token to this tab (postMessage, same origin), kept in memory only.
  let cfg = { google_client_id: '', google_auth: 'https://accounts.google.com/o/oauth2/v2/auth', google_api: 'https://www.googleapis.com' }, gtok = null;
  const gtoken = () => {   // this tab only (sessionStorage: a reload keeps it, closing the tab drops it); never localStorage, never a backup
    if (!gtok) try { gtok = JSON.parse(sessionStorage.getItem('zeus-keep-gtok') || 'null'); } catch (e) { gtok = null; }
    return gtok && gtok.exp > Date.now() + 60e3 ? gtok.t : null; };
  const gwhy = (e) => e.message === 'closed' ? L('로그인 창이 닫혔어요', 'the sign-in window closed') : e.message === 'denied' ? L('허락하지 않았어요', 'not allowed') : e.message;
  function gauth(pop) {
    return new Promise((ok, bad) => {
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
      const redirect = new URL('oauth.html', location.href).href.split('?')[0];
      const u = cfg.google_auth + '?' + new URLSearchParams({ client_id: cfg.google_client_id, redirect_uri: redirect, response_type: 'token', scope: 'https://www.googleapis.com/auth/drive.file', state, include_granted_scopes: 'true', prompt: 'select_account' });
      const w = pop || window.open('', 'zeus-google', 'width=480,height=640'); if (!w) { bad(new Error('popup')); return; }
      w.location.href = u; log('gdrive sign-in opened');
      const t = setInterval(() => { if (w.closed) { clearInterval(t); removeEventListener('message', on); bad(new Error('closed')); } }, 500);
      function on(ev) {
        if (ev.origin !== location.origin || !ev.data || ev.data.zeusOauth !== 1) return;
        clearInterval(t); removeEventListener('message', on); try { w.close(); } catch (e) { /* gone */ }
        const h = new URLSearchParams(ev.data.hash || '');
        if (h.get('state') !== state) { bad(new Error('state')); return; }
        if (!h.get('access_token')) { bad(new Error(h.get('error') === 'access_denied' ? 'denied' : (h.get('error') || 'no token'))); return; }
        gtok = { t: h.get('access_token'), exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 }; try { sessionStorage.setItem('zeus-keep-gtok', JSON.stringify(gtok)); } catch (e) { /* private */ } log('gdrive signed in'); ok(gtok.t);
      }
      addEventListener('message', on);
    });
  }
  async function gdriveUpload(r, pop) {
    const tok = gtoken() || await gauth(pop), b = 'zeus' + Date.now().toString(36);
    const meta = JSON.stringify({ name: r.name, mimeType: 'application/zip', description: 'NanumOS lite backup (' + r.n + ' files)' });
    const body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: application/zip\r\n\r\n', r.zip, '\r\n--' + b + '--']);
    const send = (id) => fetch(cfg.google_api + '/upload/drive/v3/files' + (id ? '/' + encodeURIComponent(id) : '') + '?uploadType=multipart&fields=id,name,size',
      { method: id ? 'PATCH' : 'POST', body, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + b }, credentials: 'omit' });
    const had = ls.get(K.gfile, null); let res = await send(had);   // one backup file in Drive, made new each time (Drive keeps its own versions)
    if (had && res.status === 404) { log('gdrive file gone, a new one'); res = await send(null); }
    if (res.status === 401) { gtok = null; try { sessionStorage.removeItem('zeus-keep-gtok'); } catch (e) { /* private */ } throw new Error(L('로그인이 끝났어요 — 다시 눌러 주세요', 'signed out — tap again')); }
    if (!res.ok) throw new Error('drive ' + res.status);
    const j = await res.json(); if (+j.size !== r.zip.length) throw new Error('size ' + j.size); ls.set(K.gfile, j.id); return j.id;
  }
  function setPlace(p) { try { localStorage.setItem(K.place, p); } catch (e) { /* private */ } msg = ''; log('place ' + p); line(); if (shown(sheet)) render(); }
  async function readBackup(bytes) {   // -> {files: Map(path -> bytes), settings, made} after every SHA-256 is checked
    const z = await unzip(bytes), m = z.get('manifest.json'); if (!m) throw new Error('manifest');
    const man = JSON.parse(dec.decode(m)); if (man.format !== 'zeusos-lite-backup') throw new Error('format');
    const files = new Map();
    for (const f of man.files) { const b = z.get('files' + f.path); if (!b || b.length !== f.size || await sha(b) !== f.sha256) throw new Error('hash ' + f.path); files.set(f.path, b); }
    const s = z.get('settings.json'); return { files, settings: s ? JSON.parse(dec.decode(s)) : {}, made: man.made };
  }
  async function restore(bytes, mode) {   // mode 'merge' | 'replace'; the page reloads on the restored files
    const r = await readBackup(bytes);
    api.frozen(true); if (api.W.web_autosave) api.W.web_autosave(0);
    await api.writeAll(r.files, mode === 'replace');
    for (const [k, v] of Object.entries(r.settings)) if (/^zeus-/.test(k) && k !== K.dav && k !== K.sums && k !== K.gfile && k !== K.state) try { localStorage.setItem(k, v); } catch (e) { /* full */ }
    put({ lastBackup: now(), unbackedSince: 0 }); localStorage.removeItem(K.sums);   // zcloud: every file is looked at again
    log('restore ' + mode + ' files=' + r.files.size + ' made=' + r.made);
    setTimeout(() => location.reload(), 150);
    return r.files.size;
  }

  // ---- 4. the person's own zcloud (WebDAV) ----
  const dav = () => ls.get(K.dav, null);
  let davBusy = false, davQueue = new Set(), davGone = new Set(), davT = 0, davMade = new Set();
  const davAuth = (d) => ({ Authorization: 'Basic ' + btoa(unescape(encodeURIComponent(d.user + ':' + d.pass))) });
  const davBase = (d) => d.url.replace(/\/+$/, '') + '/' + encodeURIComponent(d.folder || 'NanumOS') + '/';
  const davRel = (path) => (path.startsWith(HOME) ? path.slice(HOME.length) : '_system' + path).split('/').map(encodeURIComponent).join('/');
  function davCheckUrl(u) {
    if (!/^https?:\/\/[^/]+/.test(u)) return L('주소는 https:// 로 시작해야 해요.', 'The address must start with https://.');
    if (location.protocol === 'https:' && /^http:/.test(u)) return L('주소가 https:// 로 시작해야 해요 — 휴대폰 브라우저는 안전한 페이지에서 http 주소로 보내는 것을 막아요.', 'The address must be https:// — a phone browser blocks sending from a secure page to an http address.');
    return '';
  }
  async function davReq(d, method, url, body, headers) {
    const r = await fetch(url, { method, body, headers: Object.assign(davAuth(d), headers || {}), credentials: 'omit', cache: 'no-store' });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('auth'), { status: r.status });
    return r;
  }
  async function davMkdirs(d, rel) {   // MKCOL each parent of rel (405 = already there)
    const segs = rel.split('/'); segs.pop(); let at = davBase(d);
    if (!davMade.has(at)) { const r = await davReq(d, 'MKCOL', at); if (!(r.ok || r.status === 405)) throw new Error('mkcol ' + r.status); davMade.add(at); }
    for (const s of segs) { at += s + '/'; if (davMade.has(at)) continue; const r = await davReq(d, 'MKCOL', at); if (!(r.ok || r.status === 405)) throw new Error('mkcol ' + r.status); davMade.add(at); }
  }
  async function davPut(d, path, bytes) {   // docs/ZCLOUD.md §4: PUT to .name.zcloud-up, then MOVE over the name
    const rel = davRel(path); await davMkdirs(d, rel);
    const i = rel.lastIndexOf('/'), dir = davBase(d) + rel.slice(0, i + 1), name = rel.slice(i + 1), tmp = dir + '.' + name + '.zcloud-up';
    let r = await davReq(d, 'PUT', tmp, bytes, { 'Content-Type': 'application/octet-stream' }); if (!r.ok) throw new Error('put ' + r.status);
    r = await davReq(d, 'MOVE', tmp, null, { Destination: new URL(dir + name, location.href).href, Overwrite: 'T' }); if (!r.ok) throw new Error('move ' + r.status);
  }
  async function davConnect(url, user, pass) {
    url = url.trim(); const bad = davCheckUrl(url); if (bad) return bad;
    const d = { url, user: user.trim(), pass, folder: 'NanumOS', ok: 0 };
    try { const r = await davReq(d, 'PROPFIND', url.replace(/\/*$/, '/'), null, { Depth: '0' }); if (r.status !== 207 && !r.ok) return L('zcloud 가 답하지 않아요 (' + r.status + ').', 'zcloud did not answer (' + r.status + ').'); }
    catch (e) { return e.message === 'auth' ? L('아이디나 암호가 맞지 않아요.', 'The name or the password is wrong.') : L('zcloud 에 닿지 못했어요 — 주소, 그리고 zcloud 가 이 페이지를 받아 주는지(CORS) 확인하세요.', 'Could not reach zcloud — check the address and that zcloud accepts this page (CORS).'); }
    ls.set(K.dav, d); localStorage.removeItem(K.sums); davMade = new Set(); log('zcloud connected ' + new URL(url).host);
    davAll(); return '';
  }
  function davForget() { localStorage.removeItem(K.dav); localStorage.removeItem(K.sums); davQueue.clear(); davGone.clear(); log('zcloud forgotten'); line(); }
  async function davAll() {   // every file whose SHA-256 differs from what zcloud has last got
    const d = dav(); if (!d) return; const sums = ls.get(K.sums, {});
    for (const [path, bytes] of await api.files()) if (userFile(path) && sums[path] !== await sha(new Uint8Array(bytes))) davQueue.add(path);
    for (const p of Object.keys(sums)) if (!(await api.has(p))) davGone.add(p);
    davRun();
  }
  function davSoon() { clearTimeout(davT); davT = setTimeout(davRun, +q.get('davdelay') || 2500); }
  async function davRun() {
    const d = dav(); if (!d || davBusy || (!davQueue.size && !davGone.size)) return; davBusy = true;
    const sums = ls.get(K.sums, {}); let n = 0, err = '';
    try {
      for (const path of Array.from(davQueue)) {
        const b = await api.read(path); davQueue.delete(path);
        if (!b) { davGone.add(path); continue; }
        const h = await sha(b); if (sums[path] === h) continue;
        await davPut(d, path, b); sums[path] = h; ls.set(K.sums, sums); n++;
      }
      for (const path of Array.from(davGone)) {
        if (await api.has(path)) { davGone.delete(path); continue; }
        const r = await davReq(d, 'DELETE', davBase(d) + davRel(path)); if (!(r.ok || r.status === 404)) throw new Error('delete ' + r.status);
        davGone.delete(path); for (const k of Object.keys(sums)) if (k === path || k.startsWith(path + '/')) delete sums[k]; ls.set(K.sums, sums); n++;
      }
    } catch (e) { err = e.message === 'auth' ? 'auth' : String(e.message || e); }
    const dvs = dav(); if (dvs) { dvs.ok = err ? 0 : now(); dvs.err = err; ls.set(K.dav, dvs); }
    log('zcloud sync ' + (err ? 'failed ' + err : 'ok') + ' sent=' + n + ' files=' + Object.keys(sums).length);
    if (!err) put({ unbackedSince: 0 });
    davBusy = false; line();
    if (err) { clearTimeout(davT); davT = setTimeout(davRun, 60e3); } else if (davQueue.size || davGone.size) davSoon();
  }

  // ---- 2 and 5. the banner: a Safari tab hint, the warning before loss, the weekly reminder ----
  let bar = null, sheet = null, toastFn = null;
  const say = (m) => m && toastFn && toastFn(m);
  const vis = (e, on) => { if (!e) return; e.hidden = !on; e.style.display = on ? 'flex' : 'none'; };   // the inline display:flex would beat [hidden]
  const shown = (e) => !!e && e.style.display !== 'none' && !e.hidden;
  function showBar(kind, text, withBackup) {
    if (!auto && q.get('keep') !== '1') return;
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'keepbar'; bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;background:rgba(29,29,31,.94);color:#fff;font:15px -apple-system,system-ui,"Noto Sans KR",sans-serif';
      document.body.appendChild(bar);
    }
    bar.dataset.kind = kind; bar.innerHTML = '';
    const t = document.createElement('span'); t.style.cssText = 'flex:1 1 200px'; t.textContent = text; bar.append(t);
    if (withBackup) { const b = document.createElement('button'); b.id = 'keepbar-backup'; b.textContent = L('백업하기', 'Back up'); b.style.cssText = 'font:inherit;font-weight:600;border:0;border-radius:9px;padding:8px 12px;background:#34c759;color:#fff'; b.onclick = () => backup('banner'); bar.append(b); }
    const x = document.createElement('button'); x.id = 'keepbar-x'; x.textContent = L('나중에', 'Later'); x.style.cssText = 'font:inherit;border:0;background:none;color:#ddd;padding:8px 6px';
    x.onclick = () => { if (kind === 'ios') put({ iosHint: now() }); else put({ remindAt: now() + (kind === 'warn' ? DAY : WEEK) }); log('banner ' + kind + ' dismissed'); hideBar(); };
    bar.append(x); vis(bar, true); log('banner ' + kind);
  }
  function hideBar() { vis(bar, false); }
  function nudge() {   // called after start and after each save: at most one banner
    const s = st(); if (!s.unbackedSince || shown(bar) || first) return;
    const d = dav(); if (d && d.ok && now() - d.ok < WEEK) return;   // zcloud has it
    const old = now() - s.unbackedSince >= WEEK, due = now() >= (s.remindAt || 0);
    if (old && due) {
      if (atRisk()) showBar('warn', L('브라우저가 공간이 모자라면 이 자료를 지울 수 있어요. 7일 넘게 백업하지 않은 자료가 있어요 — 한 번 눌러 백업 파일을 만들어 두세요.',
        'The browser may clear these files when space runs low, and some have not been backed up for 7 days — one tap makes a backup file.'), true);
      else showBar('remind', L('마지막 백업이 7일 넘었어요. 백업 파일을 하나 만들어 둘까요?', 'Your last backup is more than 7 days old. Make a backup file?'), true);
      return;
    }
    if (iosTab() && !s.iosHint) showBar('ios', L('Safari 탭에 둔 자료는 7일 동안 열지 않으면 지워질 수 있어요. 홈 화면에 추가한 앱은 빈 상태로 따로 시작하니, 옮기려면 먼저 백업 파일을 만들어 그 앱에서 되살리세요.',
      'Files in a Safari tab can be cleared after 7 days unused. An app added to the Home Screen starts empty, on its own: to move, make a backup file first and restore it there.'), true);   // LITE-CHATLOSS: with the one-tap backup
  }

  // ---- the sheet: Settings › 저장 공간·백업 ----
  function el(tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  const BTN = 'font:inherit;padding:10px 12px;border-radius:10px;border:0;background:#efeff4;color:#1c1c1e', OK = 'font:inherit;font-weight:600;padding:10px 12px;border-radius:10px;border:0;background:#007aff;color:#fff';
  let pick = null, pending = null, msg = '', openedAt = 0;
  function render() {
    const s = st(), d = dav(), box = sheet.firstChild; box.innerHTML = '';
    const head = el('div', 'display:flex;align-items:center'); head.append(el('strong', 'flex:1;font-size:18px', L('저장 공간·백업', 'Storage & Backup')));
    const close = el('button', 'font:inherit;border:0;background:none;color:#007aff;padding:6px', L('닫기', 'Close')); close.id = 'keep-close'; close.onclick = () => { vis(sheet, false); log('sheet closed'); }; head.append(close); box.append(head);
    // where the files are, kept or not
    const g = el('div', 'background:#f2f2f7;border-radius:12px;padding:12px;display:grid;gap:6px');
    const gt = el('div', 'font-weight:600', guardText()); gt.id = 'keep-guard'; gt.dataset.persisted = String(persisted); g.append(gt);
    g.append(el('div', 'color:#3c3c43', L('내 파일은 이 휴대폰의 브라우저 안에만 있어요. 우리 서버에는 올리지 않아요.', 'Your files are only in this phone\'s browser. We never upload them to our server.')));
    const u = el('div', 'color:#3c3c43', usage < 0 ? L('이 브라우저는 쓰는 공간을 알려 주지 않아요.', 'This browser does not say how much space is used.')
      : L('쓰는 공간 ' + mb(usage) + ' · 쓸 수 있는 공간 약 ' + mb(quota), 'Used ' + mb(usage) + ' · available about ' + mb(quota))); u.id = 'keep-usage'; g.append(u);
    if (quota > 0) { const bar2 = el('div', 'height:6px;border-radius:3px;background:#d1d1d6;overflow:hidden'); bar2.append(el('div', 'height:100%;width:' + Math.max(1, Math.min(100, Math.round(usage / quota * 100))) + '%;background:' + (pressure() ? '#ff3b30' : '#34c759'))); g.append(bar2); }
    box.append(g);
    // the backup file
    const b = el('div', 'display:grid;gap:8px'); b.append(el('div', 'font-weight:600', L('백업 파일', 'Backup file')));
    b.append(el('div', 'color:#3c3c43', L('모든 파일과 설정을 파일 하나(.zip)로 만들어요. 휴대폰의 「파일」이나 원하는 곳에 저장해 두면, 브라우저가 지워도 되살릴 수 있어요.', 'All files and settings in one file (.zip). Keep it in Files or anywhere you like; if the browser clears the site, you can bring everything back.')));
    const pl = el('div', 'display:flex;gap:6px;flex-wrap:wrap'); pl.id = 'keep-places'; pl.setAttribute('role', 'radiogroup');
    for (const p of PLACES) { const on = place() === p, c = el('button', on ? OK : BTN, placeName(p) + (p === 'gdrive' && !cfg.google_client_id ? ' · ' + L('곧 돼요', 'soon') : ''));
      if (p === 'gdrive' && !cfg.google_client_id) { c.disabled = true; c.style.opacity = '.55'; } c.id = 'keep-place-' + p; c.setAttribute('role', 'radio'); c.setAttribute('aria-checked', String(on)); c.onclick = () => setPlace(p); pl.append(c); }
    b.append(el('div', 'color:#6b6b70;font-size:13px', L('백업할 곳 (언제든 바꿀 수 있어요)', 'Where backups go (change any time)')), pl);
    const ph = el('div', 'color:#3c3c43', placeHelp(place())); ph.id = 'keep-place-help'; b.append(ph);
    const last = el('div', 'color:#6b6b70', L('마지막 백업: ', 'Last backup: ') + ago(s.lastBackup)); last.id = 'keep-last'; b.append(last);
    const row = el('div', 'display:flex;gap:8px;flex-wrap:wrap');
    const mk = el('button', OK, ({ icloud: L('iCloud Drive 에 저장', 'Save to iCloud Drive'), gdrive: L('Google Drive 에 백업', 'Back up to Google Drive'), zcloud: dav() ? L('zcloud 에 백업', 'Back up to zcloud') : L('백업 파일 만들기', 'Make a backup file') })[place()] || L('백업 파일 만들기', 'Make a backup file')); mk.id = 'keep-backup'; mk.onclick = () => backup('sheet');
    const rs = el('button', BTN, L('백업에서 되살리기', 'Restore from a backup')); rs.id = 'keep-restore'; rs.onclick = () => pick.click();
    row.append(mk, rs); b.append(row);
    if (pending) {   // asks first: merge or replace
      const a = el('div', 'background:#fff4e5;border-radius:12px;padding:12px;display:grid;gap:8px'); a.id = 'keep-ask';
      a.append(el('div', '', L('백업(' + (pending.made || '').slice(0, 10) + ')에 파일 ' + pending.files.size + '개가 있어요. 어떻게 할까요?', 'The backup (' + (pending.made || '').slice(0, 10) + ') has ' + pending.files.size + ' files. What should happen?')));
      const r2 = el('div', 'display:flex;gap:8px;flex-wrap:wrap');
      const mg = el('button', OK, L('합치기', 'Merge')); mg.id = 'keep-merge'; const rp = el('button', BTN + ';color:#d0302f', L('모두 바꾸기', 'Replace all')); rp.id = 'keep-replace';
      const cn = el('button', BTN, L('취소', 'Cancel')); cn.id = 'keep-cancel';
      const go = (mode) => { const by = pending.bytes; pending = null; msg = L('되살리는 중…', 'Restoring…'); render(); restore(by, mode).catch((e) => { api.frozen(false); msg = L('되살리지 못했어요: ', 'Could not restore: ') + e.message; log('restore failed ' + e.message); render(); }); };
      mg.onclick = () => go('merge'); rp.onclick = () => go('replace'); cn.onclick = () => { pending = null; render(); };
      r2.append(mg, rp, cn); a.append(r2);
      a.append(el('small', 'color:#6b6b70', L('합치기: 지금 파일은 그대로 두고 백업의 파일을 더해요(같은 이름은 백업 것으로). 모두 바꾸기: 지금 파일을 지우고 백업으로 바꿔요.', 'Merge keeps the files here and adds the backup\'s (same name: the backup\'s). Replace all removes the files here first.')));
      b.append(a);
    }
    if (msg) { const m = el('div', 'color:#d0302f', msg); m.id = 'keep-msg'; b.append(m); }
    box.append(b);
    // zcloud
    const z = el('div', 'display:grid;gap:8px'); z.append(el('div', 'font-weight:600', L('zcloud 에 자동 복사', 'Copy to zcloud automatically')));
    if (d) {
      const zs = el('div', 'color:#3c3c43', (d.err ? L('맞추지 못했어요 — 잠시 뒤 다시 해요. ', 'Could not copy — trying again soon. ') : '') + L('주소 ', 'Address ') + d.url + ' · ' + L('마지막 맞춤 ', 'last copy ') + ago(d.ok)); zs.id = 'keep-dav-state'; z.append(zs);
      const r3 = el('div', 'display:flex;gap:8px'); const now2 = el('button', BTN, L('지금 맞추기', 'Copy now')); now2.id = 'keep-dav-now'; now2.onclick = () => davAll();
      const off = el('button', BTN + ';color:#d0302f', L('연결 끊기', 'Disconnect')); off.id = 'keep-dav-off'; off.onclick = () => { davForget(); render(); };
      r3.append(now2, off); z.append(r3);
    } else {
      z.append(el('div', 'color:#3c3c43', L('집 NAS(zcloud)가 있으면, 파일을 저장할 때마다 그곳에 복사해 둬요. 주소·아이디·암호는 이 브라우저에만 남아요.', 'With a home NAS (zcloud), every saved file is copied there. The address, name and password stay only in this browser.')));
      const f = el('form', 'display:grid;gap:6px'); f.id = 'keep-dav';
      const IN = 'font:inherit;padding:10px;border:1px solid #d5d5d9;border-radius:9px';
      const iu = el('input', IN); iu.name = 'url'; iu.placeholder = 'https://…'; iu.autocapitalize = 'off'; iu.type = 'url';
      const iw = el('input', IN); iw.name = 'user'; iw.placeholder = L('아이디', 'Name'); iw.autocapitalize = 'off'; iw.autocomplete = 'username';
      const ip = el('input', IN); ip.name = 'pass'; ip.type = 'password'; ip.placeholder = L('암호', 'Password'); ip.autocomplete = 'current-password';
      const ib = el('button', OK, L('연결', 'Connect')); ib.type = 'submit'; ib.id = 'keep-dav-connect';
      const ie = el('small', 'color:#d0302f'); ie.id = 'keep-dav-err';
      f.append(iu, iw, ip, ib, ie);
      f.onsubmit = async (e) => { e.preventDefault(); ie.textContent = L('확인하는 중…', 'Checking…'); const err = await davConnect(iu.value, iw.value, ip.value); if (err) { ie.textContent = err; log('zcloud connect refused ' + err); } else render(); };
      z.append(f);
    }
    box.append(z);
    // what a technician would want to see — folded
    const det = el('details', 'color:#6b6b70;font-size:13px'); det.append(el('summary', '', L('기술 자세히', 'Technical details')));
    det.append(el('pre', 'white-space:pre-wrap;margin:6px 0 0;font:12px ui-monospace,monospace',
      'navigator.storage.persisted() = ' + persisted + '\nestimate: usage ' + usage + ' B, quota ' + quota + ' B\nstandalone = ' + standalone() + ', iOS = ' + ios() +
      '\nIndexedDB: zeusos-weblite/files (' + (s.files || '?') + ' files at the last backup)\nbackup: .zip (stored) + manifest.json (SHA-256 per file)\nzcloud: WebDAV PUT .name.zcloud-up → MOVE (docs/ZCLOUD.md §4)'));
    box.append(det);
  }
  function open() {
    if (!sheet) {
      sheet = el('div', 'position:fixed;inset:0;z-index:6;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.35);font:15px -apple-system,system-ui,"Noto Sans KR",sans-serif;color:#1c1c1e');
      sheet.id = 'keep'; const box = el('div', 'background:#fff;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));width:min(560px,100%);max-height:88vh;overflow:auto;display:grid;gap:14px;box-sizing:border-box');
      sheet.append(box); sheet.addEventListener('click', (e) => { if (e.target === sheet && performance.now() - openedAt > 600) vis(sheet, false); });   // not the click of the very tap that opened it
      pick = el('input'); pick.type = 'file'; pick.accept = '.zip,application/zip'; pick.hidden = true; pick.id = 'keep-pick'; document.body.append(pick, sheet);
      pick.addEventListener('change', async () => {
        const f = pick.files && pick.files[0]; pick.value = ''; if (!f) return; msg = '';
        try { const bytes = new Uint8Array(await f.arrayBuffer()), r = await readBackup(bytes); pending = { bytes, files: r.files, made: r.made }; log('restore picked ' + f.name + ' files=' + r.files.size); }
        catch (e) { msg = L('이 파일은 나눔OS 백업이 아니거나 망가졌어요.', 'This is not a NanumOS backup, or it is damaged.'); log('restore refused ' + e.message); }
        render();
      });
    }
    ko = !api.W.web_is_ko || api.W.web_is_ko() !== 0;
    msg = ''; openedAt = performance.now(); vis(sheet, true); render(); measure(); log('sheet open persisted=' + persisted + ' usage=' + usage + ' quota=' + quota);
  }

  function start(a) {   // a: {W, log, frame, files(), read(path), has(path), writeAll(map, clear), frozen(on), toast}
    api = a; toastFn = a.toast; ko = !a.W.web_is_ko || a.W.web_is_ko() !== 0;
    fetch('keep-config.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : {}).then((c) => { for (const k of Object.keys(cfg)) if (typeof c[k] === 'string' && (k === 'google_client_id' || /^https:\/\/|^http:\/\/127\.0\.0\.1[:/]/.test(c[k]))) cfg[k] = c[k]; log('config google=' + (cfg.google_client_id ? 'yes' : 'no')); }).catch(() => {});
    measure().then(() => { nudge(); if (dav()) davAll(); });
    setInterval(measure, 60e3);
  }
  function saved(path) {
    if (!api || !userFile(path)) return;
    const s = st(), own = ownFile(path);
    if (own && !s.unbackedSince) put({ unbackedSince: now() });
    if (own) askPersist('saved ' + path.split('/').pop());
    if (dav()) { davQueue.add(path); davSoon(); }
    if (place() === 'gdrive' && cfg.google_client_id && gtoken()) { clearTimeout(gAutoT); gAutoT = setTimeout(gAuto, +q.get('gdelay') || 20e3); }
    if (own && !s.chosen) firstRun();
    dirtyAt = Date.now(); if (Date.now() - builtAt > 0) built = null;
    nudge();
  }
  let gAutoT = 0;
  async function gAuto() {   // 「저절로」: while the sign-in lasts, the newest backup replaces the one in Drive
    if (!gtoken()) return; let r;
    try { r = await build(); await gdriveUpload(r, null); done(r, 'gdrive auto', 'auto', ''); } catch (e) { log('backup gdrive auto failed ' + e.message); }
  }
  // the first save: ask once where backups go (owner 11:22 — honest labels: iCloud from the web is by hand, with a reminder)
  let first = null;
  function firstRun() {
    if (first || !auto && q.get('keep') !== '1') return; put({ chosen: 1 });
    first = el('div', 'position:fixed;inset:0;z-index:7;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.35);font:15px -apple-system,system-ui,"Noto Sans KR",sans-serif;color:#1c1c1e');
    first.id = 'keep-first'; const box = el('div', 'background:#fff;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));width:min(520px,100%);display:grid;gap:10px;box-sizing:border-box');
    box.append(el('strong', 'font-size:18px', L('백업할 곳을 골라 주세요', 'Choose where backups go')),
      el('div', 'color:#3c3c43', L('파일은 지금 이 브라우저에만 있어요. 브라우저가 지우는 일이 생겨도 되살릴 수 있게 내 공간에 백업해 둬요. 우리 서버로는 보내지 않아요. 설정 › 저장 공간·백업에서 언제든 바꿀 수 있어요.',
        'Your files are only in this browser now. Keep a backup in your own space so they come back even if the browser clears them. Nothing goes to our server. Change it any time in Settings › Storage & Backup.')));
    const opt = (id, text, sub, fn, off) => { const b = el('button', 'font:inherit;text-align:left;padding:12px;border-radius:12px;border:1px solid #d5d5d9;background:#fff;color:#1c1c1e;display:grid;gap:2px' + (off ? ';opacity:.55' : ''));
      b.id = 'keep-first-' + id; b.disabled = !!off; b.append(el('span', 'font-weight:600', text)); if (sub) b.append(el('small', 'color:#6b6b70', sub)); b.onclick = () => { first.remove(); first = null; log('first choice ' + id); fn(); }; box.append(b); };
    const gOn = !!cfg.google_client_id;
    if (!window.__try) opt('gdrive', L('구글 드라이브 (저절로 백업)', 'Google Drive (backs up by itself)'), gOn ? L('내 Google 계정으로 로그인', 'Sign in with your Google account') : L('곧 돼요', 'Coming soon'), () => { setPlace('gdrive'); backup('first'); }, !gOn);
    opt('icloud', L('iCloud Drive (가끔 눌러서 백업 — 알림으로 챙겨 드려요)', 'iCloud Drive (tap to back up now and then — a reminder helps)'), '', () => { setPlace('icloud'); backup('first'); });
    if (!window.__try) opt('zcloud', L('내 zcloud (저절로 백업)', 'My zcloud (backs up by itself)'), L('집 NAS 주소와 암호를 넣어요', 'Enter your home NAS address and password'), () => { setPlace('zcloud'); open(); });
    opt('file', L('파일로 저장', 'Save as a file'), '', () => { setPlace('file'); backup('first'); });
    opt('later', L('나중에', 'Later'), '', () => {});
    first.append(box); document.body.append(first); log('first chooser shown google=' + (gOn ? 'yes' : 'no'));
  }
  function removed(path) { if (!api || !userFile(path)) return; if (dav()) { davGone.add(path); davSoon(); } }
  return { start, saved, removed, open, backup, build, readBackup, restore, frozen: false, setPlace, state: () => ({ persisted, usage, quota, keep: st(), dav: !!dav(), place: place() }) };
})();
// TRY-SELF (owner 11-12): the server-free try build (under /try on the site, or ?try=1) — two small buttons on the page:
//   「해 볼 것」  opens the sheet of five things (whatsnew.c, mode 2; also Help › Go › Things to Try)
//   「의견 보내기」 opens the visitor's own mail app: mailto:zeus@zeus.kim, the subject carries the app that was in front and the build number,
//                 the body is one hint line. NOTHING is sent by this page (no server call, no endpoint); the address is shown with [복사]
//                 for computers without a mail app.
// weblite.js calls ZTry.start({W, log, str}) after the first frame, in a try build only.
'use strict';
window.ZTry = (() => {
  const ADDR = 'zeus@zeus.kim';
  const NAMES = { notepad: ['메모장', 'Notepad'], radio: ['라디오', 'Radio'], vault: ['금고', 'Vault'], photobooth: ['포토 부스', 'Photo Booth'], terminal: ['터미널', 'Terminal'],
    calendar: ['캘린더', 'Calendar'], calculator: ['계산기', 'Calculator'], settings: ['설정', 'Settings'], tasks: ['작업', 'Tasks'], viewer: ['뷰어', 'Viewer'], contacts: ['연락처', 'Contacts'],
    reminders: ['미리 알림', 'Reminders'], console: ['콘솔', 'Console'], help: ['도움말', 'Help'], dict: ['사전', 'Dictionary'], sheet: ['표', 'Sheet'], unit: ['단위 변환', 'Unit Converter'],
    documents: ['문서', 'Documents'], files: ['파일', 'Files'], system: ['시스템', 'System'], clock: ['시계', 'Clock'], security: ['보안', 'Security'], import: ['가져오기', 'Import'], photos: ['사진', 'Photos'] };
  let api = null, ver = '';
  const ko = () => api && api.ko ? api.ko() : !/^en/i.test(navigator.language || 'ko');
  const L = (k, e) => ko() ? k : e;
  const front = () => { try { const p = api.W.web_front_key(); const m = new Uint8Array(api.W.memory.buffer); let s = ''; for (let i = p; m[i]; i++) s += String.fromCharCode(m[i]); return s; } catch (e) { return ''; } };
  const appName = () => { const n = NAMES[front()]; return n ? (ko() ? n[0] : n[1]) : L('홈 화면', 'Home screen'); };
  // exactly this URL (the test builds the same one on its own)
  const mailto = () => {
    const subject = L('NanumOS 체험판 의견', 'NanumOS try build feedback') + ' — ' + appName() + ' · ' + (ver || '?');
    const body = L('한 줄만 적어 주세요. 파일 내용이나 이름은 쓰지 마세요.', 'One line is enough. Please leave out file contents and names.');
    return 'mailto:' + ADDR + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };
  const css = (el, s) => { el.style.cssText = s; return el; };
  const btn = 'font:600 13px -apple-system,system-ui,"Noto Sans KR",sans-serif;padding:8px 12px;border-radius:999px;border:1px solid rgba(0,0,0,.18);background:rgba(255,255,255,.92);color:#1c1c1e;text-decoration:none;cursor:pointer;line-height:1;display:inline-block';
  function sheet() {
    let d = document.getElementById('try-mail'); if (d) { d.remove(); return; }
    d = css(document.createElement('div'), 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:20px');
    d.id = 'try-mail';
    const c = css(document.createElement('div'), 'background:#fff;color:#1c1c1e;border-radius:16px;padding:20px;max-width:340px;width:100%;font:15px -apple-system,system-ui,"Noto Sans KR",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)');
    const p = css(document.createElement('p'), 'margin:0 0 6px;font-weight:700;font-size:17px'); p.textContent = L('의견 보내기', 'Send feedback');
    const t = css(document.createElement('p'), 'margin:0 0 14px;color:#555;font-size:14px;line-height:1.5');
    t.textContent = L('내 메일 앱이 열려요. 한 줄 쓰고 보내 주세요. 이 화면은 아무것도 대신 보내지 않아요.', 'Your own mail app opens. Write one line and send it. This page sends nothing for you.');
    const a = css(document.createElement('a'), btn + ';background:#1c1c1e;color:#fff;border-color:#1c1c1e;display:block;text-align:center;padding:13px'); a.id = 'try-mail-open'; a.href = mailto(); a.textContent = L('메일 앱으로 쓰기', 'Write in my mail app');
    const row = css(document.createElement('div'), 'display:flex;gap:8px;align-items:center;margin:12px 0 0;justify-content:space-between');
    const ad = css(document.createElement('span'), 'font:13px ui-monospace,Menlo,monospace;color:#333;user-select:all;overflow-wrap:anywhere'); ad.id = 'try-mail-addr'; ad.textContent = ADDR;
    const cp = css(document.createElement('button'), btn); cp.id = 'try-mail-copy'; cp.textContent = L('복사', 'Copy');
    cp.onclick = () => { const done = () => { cp.textContent = L('복사했어요', 'Copied'); api.log.push('WEB try copied address'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ADDR).then(done, () => { const r = document.createRange(); r.selectNodeContents(ad); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
      else { const r = document.createRange(); r.selectNodeContents(ad); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } };
    const x = css(document.createElement('button'), btn + ';margin:14px 0 0;width:100%;background:#f0f0f2'); x.id = 'try-mail-close'; x.textContent = L('닫기', 'Close'); x.onclick = () => d.remove();
    row.append(ad, cp); c.append(p, t, a, row, x); d.append(c); d.onclick = (e) => { if (e.target === d) d.remove(); }; document.body.append(d);
    a.onclick = () => api.log.push('WEB try mailto ' + front());
  }
  // 저장 안내: where the files are, how to keep them (홈 화면에 추가, 파일로 내려받기, 파일에서 되살리기). Plain words first, no technical terms.
  function storage() {
    let d = document.getElementById('try-store'); if (d) { d.remove(); return; }
    d = css(document.createElement('div'), 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:20px;overflow:auto'); d.id = 'try-store';
    const c = css(document.createElement('div'), 'background:#fff;color:#1c1c1e;border-radius:16px;padding:20px;max-width:360px;width:100%;font:15px -apple-system,system-ui,"Noto Sans KR",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)');
    const h = (s, st) => { const p = css(document.createElement('p'), st); p.textContent = s; return p; };
    c.append(h(L('내 파일은 이 브라우저 안에만 있어요', 'Your files stay in this browser'), 'margin:0 0 6px;font-weight:700;font-size:17px'),
      h(L('서버에는 아무것도 올라가지 않아요. 그래서 이 브라우저를 오래 안 쓰거나 사이트 데이터를 지우면 파일이 사라질 수 있어요. 가끔 파일로 내려받아 두세요.', 'Nothing is uploaded to a server. If you do not use this browser for a long time, or clear site data, the files can disappear. Download them now and then.'), 'margin:0 0 14px;color:#555;font-size:14px;line-height:1.5'));
    const b = (id, s, f, dark) => { const e = css(document.createElement('button'), btn + ';display:block;width:100%;margin:0 0 8px;padding:13px;text-align:center' + (dark ? ';background:#1c1c1e;color:#fff;border-color:#1c1c1e' : '')); e.id = id; e.textContent = s; e.onclick = f; return e; };
    const inp = css(document.createElement('input'), 'display:none'); inp.type = 'file'; inp.accept = '.zip,application/zip'; inp.id = 'try-store-file';
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const bytes = new Uint8Array(await f.arrayBuffer()); api.log.push('WEB try restore ' + f.name.slice(0, 40)); await window.ZKeep.restore(bytes, 'merge'); } catch (e) { api.log.push('WEB try restore failed ' + e); } };
    const how = css(document.createElement('div'), 'display:none;margin:0 0 10px;padding:12px;border-radius:10px;background:#f4f4f6;font-size:13.5px;line-height:1.55;color:#333'); how.id = 'try-store-how';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    how.textContent = (ios ? L('사파리 아래쪽 공유 단추 → 「홈 화면에 추가」. ', 'In Safari, the share button → "Add to Home Screen". ') : L('브라우저 메뉴 → 「홈 화면에 추가」 또는 「앱 설치」. ', 'Browser menu → "Add to Home screen" or "Install app". '))
      + L('홈 화면 앱은 사파리와 저장소가 따로예요. 사파리에서 파일로 내려받은 뒤, 홈 화면 앱에서 「파일에서 되살리기」를 하세요.', 'The home screen app keeps its own storage, separate from Safari. Download a file in Safari first, then use "Restore from a file" in the home screen app.');
    c.append(b('try-store-a2hs', L('홈 화면에 추가 방법', 'How to add to the Home Screen'), () => { how.style.display = how.style.display === 'none' ? 'block' : 'none'; }), how,
      b('try-store-download', L('파일로 내려받기', 'Download my files'), () => { if (window.ZKeep) window.ZKeep.backup('try'); }, true),
      b('try-store-restore', L('파일에서 되살리기', 'Restore from a file'), () => inp.click()), inp,
      b('try-store-close', L('닫기', 'Close'), () => d.remove()));
    d.append(c); d.onclick = (e) => { if (e.target === d) d.remove(); }; document.body.append(d);
  }
  // TRY-BIGAPPS: the landing card of the two big editors' doors (/try/retouch, /try/videoedit): what it is, three things to try, what opens and saves in a browser.
  // Plain words, one 「시험 중」 badge (both are lab apps), no other caveat. Shown once per door and browser (a flag in this browser only); 「해 볼 것」 in the menu shows it again.
  const LAND = {
    retouch: { h: ['설치 없이 브라우저에서 사진 보정', 'Photo retouching in your browser, no install'], sub: ['사진은 이 브라우저 안에서만 처리돼요. 서버로 보내지 않아요.', 'Photos are handled only in this browser. Nothing is sent to a server.'],
      things: [['샘플 사진 열기', '「파일 › 열기」(Ctrl/⌘+O)에서 「샘플」 폴더의 사진을 열어요.', 'Open a sample photo', 'File › Open (Ctrl/⌘+O), then the “샘플” folder.'],
               ['밝기 올려 보기', '「이미지 › 조정 › 밝기/대비」에서 명도 칸에 숫자(예: 60)를 넣고 [확인]을 눌러요.', 'Make it brighter', 'Image › Adjustments › Brightness/Contrast: type a number (e.g. 60) in the brightness box, then OK.'],
               ['브러시로 칠하고 저장하기', 'B 키로 브러시를 고르고 사진 위를 칠한 뒤, 「파일 › 내보내기 › PNG으로 빠른 내보내기」 다음 [내려받기]를 눌러요.', 'Paint with the brush and save', 'Press B for the brush and paint on the photo, then File › Export › Quick Export as PNG, then Download.']],
      formats: ['열 수 있는 사진: JPG·PNG·WebP·GIF. 저장: PNG·JPEG·WebP. 내 사진은 [내 사진 가져오기]로 넣어요(HEIC 는 이 브라우저가 풀 수 있을 때만).', 'Opens: JPG, PNG, WebP, GIF. Saves: PNG, JPEG, WebP. Bring your own with “Add my photo” (HEIC only where this browser can decode it).'],
      pick: ['내 사진 가져오기', 'Add my photo'] },
    videoedit: { h: ['설치 없이 브라우저에서 동영상 편집', 'Video editing in your browser, no install'], sub: ['영상은 이 브라우저 안에서만 처리돼요. 서버로 보내지 않아요.', 'Videos are handled only in this browser. Nothing is sent to a server.'],
      things: [['샘플 영상 열기', '「나눔OS 파일에서」를 누르고 「사계 샘플」을 열어요.', 'Open the sample clip', 'Press “NanumOS files” and open “사계 샘플”.'],
               ['자르고 글자 넣기', '재생 위치를 정하고 Ctrl/⌘+B로 나눈 뒤 앞 조각을 지워요. 「글자」 탭에서 「제목」을 눌러 제목을 넣어요.', 'Trim it and add a title', 'Set the playhead, split with Ctrl/⌘+B and delete the first piece. In the Text tab, press “제목” to add a title.'],
               ['내보내고 내려받기', '「내보내기」를 누르고, 끝나면 [WebM 으로 내려받기]를 눌러요. 브라우저가 직접 만들어요.', 'Export and download', 'Press Export, and when it ends press “Download as WebM”. Your browser makes it.']],
      formats: ['열 수 있는 영상: AVI, 그리고 이 브라우저가 풀 수 있는 MP4·MOV·WebM(브라우저마다 달라요). 사진·음악(MP3·WAV·OGG·FLAC)도 넣어요. 저장: WebM(사파리는 MP4) 또는 AVI.', 'Opens: AVI, plus the MP4, MOV and WebM this browser can decode (it varies). Photos and music (MP3, WAV, OGG, FLAC) too. Saves: WebM (MP4 in Safari) or AVI.'],
      pick: null } };
  function landing(force) {
    const key = window.__tryapp, d0 = LAND[key]; if (!d0 || !api) return;
    const flag = 'zeus-try-landing-' + key; let seen = false; try { seen = !!localStorage.getItem(flag); } catch (e) { /* private mode */ }
    if (seen && !force) return; const old = document.getElementById('try-landing'); if (old) { old.remove(); if (!force) return; }
    const i = ko() ? 0 : 2, j = ko() ? 0 : 1;
    const d = css(document.createElement('div'), 'position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,.4);display:grid;place-items:center;padding:16px;overflow:auto'); d.id = 'try-landing';
    const c = css(document.createElement('div'), 'background:#fff;color:#1c1c1e;border-radius:18px;padding:22px;max-width:480px;width:100%;font:15px/1.5 -apple-system,system-ui,"Noto Sans KR",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)');
    const t = css(document.createElement('h1'), 'margin:0 0 6px;font-size:20px;line-height:1.3'); t.id = 'try-landing-title'; t.textContent = d0.h[j] + ' ';
    const bd = css(document.createElement('span'), 'font:700 12px system-ui;background:#fff3cd;color:#7a5b00;border-radius:999px;padding:3px 8px;vertical-align:middle;white-space:nowrap'); bd.id = 'try-landing-badge'; bd.textContent = L('시험 중', 'Testing'); t.append(bd);
    const sub = css(document.createElement('p'), 'margin:0 0 12px;color:#555;font-size:14px'); sub.textContent = d0.sub[j];
    const ol = css(document.createElement('ol'), 'margin:0 0 12px;padding-left:20px'); ol.id = 'try-landing-things';
    for (const th of d0.things) { const li = css(document.createElement('li'), 'margin:0 0 8px'); const b = document.createElement('b'); b.textContent = th[i] + ' '; li.append(b, document.createTextNode(th[i + 1])); ol.append(li); }
    const f = css(document.createElement('p'), 'margin:0 0 14px;color:#555;font-size:13.5px'); f.id = 'try-landing-formats'; f.textContent = d0.formats[j];
    const row = css(document.createElement('div'), 'display:flex;gap:8px;flex-wrap:wrap');
    const go = css(document.createElement('button'), btn + ';background:#1c1c1e;color:#fff;border-color:#1c1c1e;padding:12px 18px;flex:1'); go.id = 'try-landing-start'; go.textContent = L('시작하기', 'Start');
    go.onclick = () => { try { localStorage.setItem(flag, '1'); } catch (e) { /* private mode */ } d.remove(); api.log.push('WEB try landing start ' + key); };
    if (d0.pick && window.__tryPick) { const p = css(document.createElement('button'), btn + ';padding:12px 18px'); p.id = 'try-landing-pick'; p.textContent = d0.pick[j]; p.onclick = () => window.__tryPick('photo'); row.append(p); }
    row.append(go); c.append(t, sub, ol, f, row); d.append(c); document.body.append(d); api.log.push('WEB try landing ' + key);
  }
  function start(a) {
    api = a; fetch('version.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : {}).then((j) => { ver = String(j.version || ''); }).catch(() => {});
    const bar = css(document.createElement('div'), 'position:fixed;z-index:99990;display:flex;gap:6px;align-items:center;right:6px;top:42%;flex-direction:column-reverse;align-items:flex-end');
    bar.id = 'try-pill';
    if (window.__trywide) Object.assign(bar.style, { right: 'auto', left: '6px', top: 'auto', bottom: '96px', alignItems: 'flex-start' });   // TRY-BIGAPPS: the editors fill the screen: the pill sits clear of their panels
    const row = css(document.createElement('div'), 'display:none;gap:6px;align-items:' + (window.__trywide ? 'flex-start' : 'flex-end') + ';flex-direction:column'); row.id = 'try-row';
    const more = css(document.createElement('button'), btn + ';padding:7px 11px;font-size:15px;letter-spacing:1px'); more.id = 'try-more'; more.textContent = '\u22ef'; more.setAttribute('aria-label', L('체험 메뉴', 'Try menu'));
    more.onclick = () => { const on = row.style.display === 'none'; row.style.display = on ? 'flex' : 'none'; };
    const g = css(document.createElement('button'), btn); g.id = 'try-guide'; g.textContent = L('해 볼 것', 'Try'); g.onclick = () => { row.style.display = 'none'; if (LAND[window.__tryapp]) { landing(true); return; } api.W.web_try_guide(); api.W.web_frame(); };
    const f = css(document.createElement('button'), btn); f.id = 'try-feedback'; f.textContent = L('의견 보내기', 'Feedback'); f.onclick = () => { row.style.display = 'none'; sheet(); };
    const s = css(document.createElement('button'), btn); s.id = 'try-storage'; s.textContent = L('저장', 'Save'); s.onclick = () => { row.style.display = 'none'; storage(); };
    row.append(g, s, f); bar.append(row, more); document.body.append(bar);
    // one anonymous count a visit: a single local flag says first or again; the request is a bare GET of a tiny static path (nothing in it, nothing stored by us but the day and the country)
    try { const seen = localStorage.getItem('zeus-try-seen'); localStorage.setItem('zeus-try-seen', '1');
      fetch('hit/' + (seen ? 'again' : 'first'), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {}); } catch (e) { /* private mode: no count */ }
    if (window.__tryapp) {   // /try/<app>: a small link to the whole thing
      const l = css(document.createElement('a'), btn + ';background:#1c1c1e;color:#fff;border-color:#1c1c1e'); l.id = 'try-all'; l.href = new URL('./', document.baseURI).href; l.textContent = L('나눔OS 전체 써 보기', 'Try all of NanumOS'); bar.prepend(l);   // beside the menu button, always there on a per-app page
    }
    api.log.push('WEB try build');
    landing(false);
  }
  return { start, mailto, ADDR, landing };
})();
// TRY-BIGAPPS: what the Video Editor's export (an MJPEG AVI with PCM sound: the file ZeusOs's editor writes without the Mac's encoder) becomes in a browser:
// the browser's OWN encoder (MediaRecorder) turns it into WebM (Chrome, Edge, Firefox) or MP4 (Safari) that plays everywhere — no codec downloaded, nothing sent.
// It runs the clip through a canvas and an audio buffer in real time (a 10 s clip takes about 10 s) and says how far it is.
// window.ZEnc.parse(bytes) -> { w, h, fps, rate, frames: [Uint8Array jpeg], pcm: Int16Array|null }   window.ZEnc.encode(info, onProgress) -> Promise<{ blob, ext, mime }>
'use strict';
window.ZEnc = (() => {
  const u32 = (b, o) => b[o] | b[o + 1] << 8 | b[o + 2] << 16 | (b[o + 3] << 24 >>> 0);
  const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  function parse(b) {
    if (b.length < 12 || tag(b, 0) !== 'RIFF' || tag(b, 8) !== 'AVI ') throw new Error('not an AVI');
    let w = 0, h = 0, usec = 0, rate = 0, chans = 1; const frames = [], pcm = [];
    const walk = (o, end) => {
      while (o + 8 <= end) {
        const id = tag(b, o), sz = u32(b, o + 4), body = o + 8;
        if (id === 'RIFF' || id === 'LIST') { const kind = tag(b, body); if (kind === 'movi') walk(body + 4, Math.min(end, body + sz)); else if (kind === 'hdrl' || kind === 'strl') walk(body + 4, Math.min(end, body + sz)); }
        else if (id === 'avih') { usec = u32(b, body); w = u32(b, body + 32); h = u32(b, body + 36); }
        else if (id === 'strf' && sz >= 16 && sz <= 18 && b[body] === 1 && b[body + 1] === 0 && rate === 0) { chans = b[body + 2] | b[body + 3] << 8; rate = u32(b, body + 4); }   // WAVEFORMATEX (PCM)
        else if (/^\d\ddc$/.test(id)) frames.push(b.subarray(body, body + sz));
        else if (/^\d\dwb$/.test(id)) pcm.push(b.subarray(body, body + sz));
        o = body + sz + (sz & 1);
      }
    };
    walk(12, b.length);
    if (!frames.length || !w || !h) throw new Error('no picture in the AVI');
    let audio = null;
    if (pcm.length && rate) { const n = pcm.reduce((a, c) => a + c.length, 0), all = new Uint8Array(n); let o = 0; for (const c of pcm) { all.set(c, o); o += c.length; } audio = new Int16Array(all.buffer, 0, n >> 1); }
    return { w, h, fps: usec ? 1e6 / usec : 12, rate, chans, frames, pcm: audio };
  }
  async function encode(info, onProgress) {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    const mime = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error('this browser has no video recorder');
    const cv = Object.assign(document.createElement('canvas'), { width: info.w, height: info.h }), g = cv.getContext('2d');
    const stream = cv.captureStream(info.fps), dur = info.frames.length / info.fps;
    let ac = null, src = null;
    if (info.pcm && info.pcm.length) {
      const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); const dest = ac.createMediaStreamDestination();
      const buf = ac.createBuffer(1, info.pcm.length, info.rate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = info.pcm[i] / 32768;
      src = ac.createBufferSource(); src.buffer = buf; src.connect(dest); for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 }), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((ok, no) => { rec.onstop = ok; rec.onerror = (e) => no(e.error || new Error('recorder')); });
    const bmp = (jpg) => createImageBitmap(new Blob([jpg], { type: 'image/jpeg' }));
    g.drawImage(await bmp(info.frames[0]), 0, 0); rec.start(250); if (src) src.start();
    const t0 = performance.now();
    for (let i = 0; i < info.frames.length; i++) {
      const at = t0 + i * 1000 / info.fps, wait = at - performance.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      g.drawImage(await bmp(info.frames[i]), 0, 0); if (onProgress && i % 6 === 0) onProgress(i / info.frames.length);
    }
    await new Promise((r) => setTimeout(r, 300)); rec.stop(); await done; if (ac) ac.close();
    const type = mime.split(';')[0]; return { blob: new Blob(chunks, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm', mime, seconds: dur };
  }
  return { parse, encode };
})();
// WEB-LITE step 2 (docs/WEB-LITE.md): ZeusOs Notepad as WebAssembly in the browser.
// The page owns the canvas, touch/pointer/keyboard events (a hidden textarea for the iOS keyboard and Hangul
// composition) and IndexedDB; zeusui.wasm (tools/weblite/web.c + the GUI's own draw/kit/text/FreeType/edit) draws.
// Test hooks: window.__weblog (the GUI log lines), window.__webstats (timings), window.__webready (a promise).
'use strict';
(() => {
  const ME = document.currentScript && document.currentScript.src;   // this build's JS name (checkBuild)
  const BUILT = '2026-11-12T03:34:08Z';   // LITE-SW-UPDATE: stamp.py writes when this build was made (UTC)
  const q = new URLSearchParams(location.search);
  // TRY-SELF: the server-free try build (it lives under /try on the site; tests: ?try=1). It asks our server for NOTHING:
  // every relay/remote request is refused here, before the network (the count is in __weblog as 'WEB try refused …'), and the apps that need one are not offered.
  const TRY = !!window.__try;   // set by remote.js, the first file of the bundle (under /try, or ?try=1)
  const log = window.__weblog = [];
  // MOBILE-PARITY B: the page's own lines (log.push from here, not gui_log's) also go to the Console app's 「앱」 source
  const conQ = []; let fromWasm = false;
  { const push0 = log.push.bind(log); log.push = (...a) => { if (!fromWasm) for (const l of a) if (conQ.length < 200) conQ.push(String(l)); return push0(...a); }; }
  const stats = window.__webstats = { frames: 0, inputs: [], boot: {} };
  // LITE-OPEN: the open part of lite.zeus.kim has no login; whatever needs the server (relays, remote browser) answers 401 there.
  // Then show one fixed notice + the password field (same /login as the login page). Harmless on a signed-in or local server (never 401).
  const needLogin = () => {
    if (document.getElementById('lite-login')) return;
    const ko = /^ko/i.test(navigator.language || ''), d = document.createElement('div'); d.id = 'lite-login';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:24px;font:16px -apple-system,system-ui,"Noto Sans KR",sans-serif';
    d.innerHTML = '<form method=post action=/login style="background:#fff;color:#1c1c1e;border-radius:16px;padding:22px;max-width:320px;width:100%;text-align:center">' +
      '<p style="margin:0 0 4px;font-weight:600">' + (ko ? '로그인하면 쓸 수 있어요' : 'Log in to use this') + '</p><p style="margin:0 0 14px;color:#6b6b70;font-size:13px">' + (ko ? 'Log in to use this' : '로그인하면 쓸 수 있어요') + '</p>' +
      '<input type=password name=password autocomplete=current-password required placeholder="비밀번호 / Password" style="width:100%;font:inherit;padding:12px;border-radius:10px;border:1px solid #d0d0d6;margin:0 0 10px;box-sizing:border-box">' +
      '<button style="width:100%;font:inherit;padding:12px;border-radius:10px;border:0;background:#1c1c1e;color:#fff;font-weight:600;margin:0 0 8px">들어가기 / Enter</button>' +
      '<button type=button id=lite-login-x style="width:100%;font:inherit;padding:10px;border:0;background:none;color:#6b6b70">닫기 / Close</button></form>';
    document.body.appendChild(d); d.querySelector('#lite-login-x').onclick = () => d.remove();
  };
  const gatedUrl = (u) => /(^|\/)(relay|remote)\//.test(String(u).replace(/^https?:\/\/[^/]+/, '')) && !/(^|\/)remote\/ping(\?|$)/.test(String(u));   // the startup probe is not the user asking
  { const f = window.fetch; window.fetch = function (a, o) { const u = typeof a === 'string' ? a : (a && a.url) || '';
      if (TRY && gatedUrl(u)) { log.push('WEB try refused ' + String(u).slice(0, 80)); return Promise.resolve(new Response('', { status: 403 })); } return f.call(this, a, o).then((r) => { if (r.status === 401 && gatedUrl(u)) needLogin(); return r; }); };
    const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__lu = u; if (TRY && gatedUrl(u)) { log.push('WEB try refused ' + String(u).slice(0, 80)); arguments[1] = 'data:text/plain,refused'; arguments[0] = 'GET'; } return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { this.addEventListener('loadend', () => { if (this.status === 401 && gatedUrl(this.__lu || '')) needLogin(); }); const r = xs.apply(this, arguments); if (this.status === 401 && gatedUrl(this.__lu || '')) needLogin(); return r; };
  }
  const t0 = performance.now();
  let pending = '', imeFocus = false, imeMoved = false, imeLost = false, imeCaret = null, caretMoved = false, pickDir = '/home/zeus', pickAccept = '';
  const picker = Object.assign(document.createElement('input'), { type: 'file', multiple: true, id: 'zeus-picker' });   // Files' Add: photos, any file
  // VEDIT-CAPCUT (owner 11-09 05:17): iOS opens its 사진 보관함 / 파일 선택 menu at the input's place, so the input is not display:none (no place: the
  // menu popped at the top-left over the header) but an invisible 44 pt square under the finger that tapped 「가져오기」 / 「휴대폰에서 고르기」.
  Object.assign(picker.style, { position: 'fixed', left: '0px', top: '0px', width: '44px', height: '44px', opacity: '0', pointerEvents: 'none', zIndex: '-1', margin: '0', padding: '0', border: '0' });
  document.body.appendChild(picker);
  let pickTap = [0, 0];
  document.addEventListener('pointerdown', (e) => { pickTap = [e.clientX, e.clientY]; }, true);
  document.addEventListener('pointerup', (e) => { pickTap = [e.clientX, e.clientY]; }, true);
  const pickerAt = () => { picker.style.left = Math.max(0, Math.round(pickTap[0] - 22)) + 'px'; picker.style.top = Math.max(0, Math.round(pickTap[1] - 22)) + 'px'; };
  // A message the person sees (files that could not be added, storage full): never only in the log.
  let toastT = 0;
  // LITE-WHITE (owner 11-04 21:20 「타입에러」 「하얀 화면」): the public line gave 26 KB/s and a fetch that died left a white page or
  // 「ZeusOs could not start: TypeError」. Now: index.html's #boot says 「불러오는 중…」 with the megabytes so far, a stalled or cut
  // download is tried once more by itself, and then the screen says so in words with 「다시 시도」 (a reload: the finished parts
  // come from the cache). A stored record the loader cannot take (null, not bytes) or a home too big for memory never stops the
  // start: the desktop opens with 「저장된 자료 일부를 못 불러왔어요 — 자료는 그대로 있어요」, and the records stay as they are.
  window.__webloading = true;
  const KOPREF = /^ko/i.test(navigator.language || '') || (navigator.languages || []).some((l) => /^ko/i.test(l));   // a Korean anywhere in the browser's language list (a Korean's browser often lists en-US first)
  const bootKo = q.get('lang') === 'en' ? false : q.get('lang') === 'ko' || !!navigator.webdriver || KOPREF;
  const KEPT_MSG = bootKo ? '저장된 자료 일부를 못 불러왔어요 — 자료는 그대로 있어요' : 'Some saved files could not be opened — they are still kept';   // 저장된 자료 일부를 못 불러왔어요 — 자료는 그대로 있어요
  const STALL_MS = +q.get('stall') || 20000;   // no byte for this long = the line is gone (tests: ?stall=)
  const bootUI = { got: 0, total: 0,
    el: (id) => document.getElementById(id),
    progress() { const m = this.el('boot-msg'); if (!m) return; const mb = (n) => (n / 1048576).toFixed(1);
      m.textContent = bootKo ? '불러오는 중… (' + (this.total > this.got ? mb(this.total) + ' MB 중 ' : '') + mb(this.got) + ' MB)' : 'Loading… (' + mb(this.got) + (this.total > this.got ? ' of ' + mb(this.total) : '') + ' MB)'; },   // 불러오는 중… (n MB 중 m MB)
    fail(e) { const b = this.el('boot'); log.push('WEB boot failed ' + e); if (!b) { document.body.textContent = 'NanumOS could not start: ' + e; return; }
      const net = netFault(e); b.className = 'now'; b.hidden = false;
      this.el('boot-msg').textContent = net ? (bootKo ? '연결이 느려 다 못 받았어요 — 다시 시도해 주세요' : 'The connection is slow and not everything arrived — try again')   // 연결이 느려 다 못 받았어요 — 다시 시도해 주세요
        : (bootKo ? '나눔OS 를 시작하지 못했어요 — 저장된 자료는 그대로 있어요' : 'NanumOS could not start — your saved files are kept');   // ZeusOs 를 시작하지 못했어요 — 저장된 자료는 그대로 있어요
      const r = this.el('boot-retry'); r.hidden = false; r.textContent = bootKo ? '다시 시도' : 'Try again'; this.el('boot-why').textContent = String(e).slice(0, 160); },
    done() { const b = this.el('boot'); if (b) b.remove(); window.__webstarted = true; } };
  const netFault = (e) => /TypeError|Load failed|Failed to fetch|NetworkError|network|AbortError|aborted|HTTP \d|short read|stalled/i.test(String(e && (e.name + ' ' + e.message) || e));
  async function fetchBytes(url) {   // the bytes of one boot file, counted on the boot screen; a stall or a cut is tried once more
    for (let attempt = 0; ; attempt++) {
      const ac = window.AbortController ? new AbortController() : null; let got = 0, counted = 0, stall = 0, last = performance.now(), stalled = false;
      try {
        const r = await fetch(url, ac ? { signal: ac.signal } : undefined);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        const len = +r.headers.get('Content-Length') || 0, plain = !r.headers.get('Content-Encoding');
        if (len && plain) { counted = len; bootUI.total += len; }
        if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); got = b.byteLength; bootUI.got += got; bootUI.progress(); return b; }
        if (ac) stall = setInterval(() => { if (performance.now() - last > STALL_MS) { stalled = true; ac.abort(); } }, 500);
        const rd = r.body.getReader(), parts = [];
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; bootUI.got += value.length; last = performance.now(); bootUI.progress(); }
        clearInterval(stall);
        if (counted && got !== counted) throw new Error('short read ' + got + '/' + counted + ' ' + url);
        const out = new Uint8Array(got); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; } return out.buffer;
      } catch (e0) {
        clearInterval(stall); bootUI.got -= got; bootUI.total -= counted;
        const e = stalled ? new Error('stalled ' + url) : e0; log.push('WEB boot fetch ' + url + ' failed (' + (attempt + 1) + ') ' + e);
        if (attempt >= 1 || !netFault(e)) throw e;
      }
    }
  }
  function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 6000); log.push('WEB toast ' + msg.replace(/\n/g, ' | ')); }
  const FILE_MAX = 16 << 20, IMG_SHRINK = 8 << 20;   // the ramfs keeps 16 MiB a file; photos over 8 MB are re-encoded (<= 4096 px, JPEG)
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
  picker.addEventListener('change', async () => {   // into Files' folder, kept in IndexedDB; " 2" before the extension if the name is taken
    const files = Array.from(picker.files || []); picker.value = ''; try { sessionStorage.removeItem('zeus-picking'); } catch (e) { /* private mode */ }
    await takePicked(files, !!(W && W.web_pick_for_vedit && W.web_pick_for_vedit()));
  });
  window.__tryPick = (kind) => {   // TRY-BIGAPPS: 「내 사진 가져오기」 on the Photo Retouch door: the same picker path as Files' 가져오기, into Pictures
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.id = 'try-pick-input'; i.style.display = 'none'; document.body.append(i);
    i.onchange = async () => { const fs = Array.from(i.files || []); i.remove(); const old = pickDir; pickDir = '/home/zeus/Pictures'; try { await takePicked(fs, false); } finally { pickDir = old; } };
    i.click();
  };
  async function takePicked(files, forEditor) {   // VEDIT-CAPCUT-2: the picker's files (or ?benchimport's) - the same path either way
    const bad = [];
    log.push('WEB pick ' + files.length + ' ' + files.map(f => f.name + ':' + f.size + ':' + (f.type || '?')).join(' '));
    if (!files.length) { toast('\uace0\ub978 \ud30c\uc77c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4'); return; }   // 고른 파일이 없습니다
    let added = 0;
    for (const f of files) {
      if (forEditor && isVideo(f)) {   // VEDIT-CAPCUT: the editor gets edit copies made with the phone's own decoder (any size, MOV / HEVC / MP4)
        try { const r = await videoToEdit(f); if (r.parts.length) { added++; r.parts.forEach(p => { const b = enc.encode(p + '\0'), bp = W.web_buf(b.length); view().set(b, bp); const rc = W.web_vedit_take(bp); log.push('WEB vedit take ' + p + ' rc=' + rc); }); if (r.note) bad.push(r.note); } else bad.push(r.note); }
        catch (e) { bad.push((f.name || '?') + ' \u2014 ' + L('\uc774 \ub3d9\uc601\uc0c1\uc744 \uc77d\uc9c0 \ubabb\ud588\uc5b4\uc694', 'this video could not be read')); log.push('WEB vedit error ' + f.name + ' ' + e); }   // 이 동영상을 읽지 못했어요
        continue;
      }
      try {
        let bytes = null, fname = (f.name || ('photo-' + Date.now())).normalize('NFC');   // UPLOAD-CHECK: a name made on a Mac may be decomposed (NFD): it failed to store (rc=-36) and would not match the same name typed anywhere else
        const sig = await sniff(f);   // the bytes say what it is (Samsung Internet may give no type, a camera file no extension)
        if (sig && !/\.[a-z0-9]{2,5}$/i.test(fname)) fname += '.' + sig;
        const heic = sig === 'heic' || /\.(heic|heif)$/i.test(fname) || /^image\/hei[cf]/.test(f.type), img = heic || !!sig || /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif)$/i.test(fname);
        if (heic || (img && f.size > IMG_SHRINK)) {   // HEIC (our decoder cannot read it) or a big photo: the browser's own decoder -> JPEG
          const jpg = await heicToJpeg(f);
          if (jpg) { bytes = jpg; fname = fname.replace(/\.[^.]*$/, '') + '.jpg'; log.push('WEB ' + (heic ? 'heic' : 'photo') + ' -> jpeg ' + f.name + ' ' + f.size + ' -> ' + jpg.length); }
          else { log.push('WEB ' + (heic ? 'heic kept (no decoder in this browser) ' : 'photo kept ') + f.name); if (heic) bad.push(fname + ' \u2014 HEIC \uadf8\ub300\ub85c \ub123\uc74c (\uc774 \ube0c\ub77c\uc6b0\uc800\ub294 HEIC \ub97c \ubabb \uc5f4\uc5b4 \ubcf4\uae30 \uc548 \ub428)'); }
        }
        if (!bytes) {
          if (f.size > FILE_MAX) { bad.push(fname + ' \u2014 ' + mb(f.size) + ', 16 MB\uae4c\uc9c0\ub9cc \ub123\uc744 \uc218 \uc788\uc5b4\uc694'); log.push('WEB add too big ' + fname + ' ' + f.size); continue; }   // 16 MB까지만 넣을 수 있어요
          bytes = new Uint8Array(await f.arrayBuffer());
        }
        const dot = fname.lastIndexOf('.'), base = dot > 0 ? fname.slice(0, dot) : fname, ext = dot > 0 ? fname.slice(dot) : '';
        let name = fname.replace(/\//g, '_'), k = 2; while (window.__webfile(pickDir + '/' + name) >= 0) name = base + ' ' + (k++) + ext;
        const rc = writeMain(pickDir + '/' + name, bytes);
        if (rc) { bad.push(name + ' \u2014 \uc800\uc7a5\ud558\uc9c0 \ubabb\ud588\uc5b4\uc694 (' + rc + ')'); log.push('WEB add failed ' + name + ' rc=' + rc); continue; }   // 저장하지 못했어요
        added++; log.push('WEB added ' + pickDir + '/' + name + ' ' + bytes.length);
      } catch (e) { bad.push((f.name || '?') + ' \u2014 \uc77d\uc9c0 \ubabb\ud588\uc5b4\uc694'); log.push('WEB add error ' + f.name + ' ' + e); }   // 읽지 못했어요
    }
    if (bad.length) toast((added ? added + '\uac1c\ub97c \ub123\uc5c8\uc2b5\ub2c8\ub2e4.\n' : '\ud30c\uc77c\uc744 \ub123\uc9c0 \ubabb\ud588\uc5b4\uc694:\n') + bad.join('\n'));   // N개를 넣었고, 넣지 못한 파일:
    W.web_files_reload(); W.web_frame();
  }
  const isVideo = (f) => !/\.avi$/i.test(f.name || '') && f.type !== 'video/x-msvideo' && f.type !== 'video/avi' && (/^video\//.test(f.type || '') || /\.(mov|mp4|m4v|webm|3gp|mkv)$/i.test(f.name || ''));   // an AVI is the editor's own kind: as it is
  const L = (ko, en) => KOPREF || document.documentElement.lang === 'ko' ? ko : en;
  // VEDIT-CAPCUT: a picked video -> the Video Editor's edit copies (MJPEG AVI, 960 on the long side, 15 fps, mono 24 kHz sound), each part under a file's
  // 16 MiB; the browser decodes (a <video> seeked frame by frame, drawn to a canvas, JPEG 0.75; the sound by decodeAudioData). Progress is shown; the
  // desktop never waits (all of it is async). Returns { parts: [paths], note }.
  async function videoToEdit(f) {
    const t0 = performance.now(), url = URL.createObjectURL(f), v = document.createElement('video');
    Object.assign(v, { muted: true, playsInline: true, preload: 'auto', src: url }); v.setAttribute('playsinline', '');
    const name = (f.name || 'video').normalize('NFC').replace(/\.[^.]*$/, '').replace(/[\/()]/g, '_') || 'video';
    log.push('WEB vedit start ' + f.name + ' ' + f.size + ' ' + (f.type || '?'));
    try {
      await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('no decoder for this video in this browser')); setTimeout(() => no(new Error('timeout')), 20000); });
      const dur = v.duration, vw = v.videoWidth, vh = v.videoHeight;
      if (!(dur > 0) || !vw || !vh) throw new Error('no picture');
      const k = Math.min(1, 960 / Math.max(vw, vh)), w = Math.max(2, Math.round(vw * k) & ~1), h = Math.max(2, Math.round(vh * k) & ~1), FPS = 15, RATE = 24000, PER = RATE / FPS;
      let pcm = null;
      try {
        const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), ab = await f.arrayBuffer();
        const buf = await new Promise((ok, no) => { const p = ac.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); });
        const n = Math.floor(buf.duration * RATE), out = new Int16Array(n), chs = []; for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
        const step = buf.sampleRate / RATE;
        for (let i = 0; i < n; i++) { const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step)); let acc = 0, m = 0; for (const ch of chs) for (let j = a; j < b && j < ch.length; j++) { acc += ch[j]; m++; } const x = m ? acc / m : 0; out[i] = Math.max(-32768, Math.min(32767, Math.round(x * 32767))); }
        pcm = out; ac.close && ac.close();
      } catch (e) { log.push('WEB vedit no sound ' + e); }
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
      const seek = (t) => new Promise((ok) => { const done = () => { v.removeEventListener('seeked', done); ok(); }; v.addEventListener('seeked', done); v.currentTime = t; setTimeout(done, 3000); });
      const total = Math.max(1, Math.floor(dur * FPS)), parts = []; let fi = 0, part = 0, open = false, room = 0, lastPct = -1;
      const begin = () => { part++; const dir = pickDir || '/home/zeus/Movies'; let p = dir + '/' + name + (part > 1 ? ' ' + part : '') + '.avi'; for (let q = 2; window.__webfile(p) >= 0; q++) p = dir + '/' + name + (part > 1 ? ' ' + part : '') + ' ' + q + '.avi';   /* never over a file that is there */ const pp = W.web_buf(4 * p.length + 1); const b = enc.encode(p + '\0'); view().set(b, pp);
        const rc = W.web_avi_begin(pp, w, h, FPS, pcm ? RATE : 0); if (rc) throw new Error('avi_begin ' + rc); open = p; };
      const end = () => { const n = W.web_avi_end(); if (n > 0) parts.push(open); open = false; };
      while (fi < total) {
        await seek(Math.min(dur - 0.001, (fi + 0.5) / FPS)); g.drawImage(v, 0, 0, w, h);
        const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.75)); const jpg = new Uint8Array(await blob.arrayBuffer());
        const a = pcm ? pcm.subarray(fi * PER, (fi + 1) * PER) : null, an = a ? a.length : 0;
        if (!open) begin();
        room = W.web_avi_room(); if (room < jpg.length + an * 2 + 65536) { end(); begin(); }
        const bp = W.web_buf(jpg.length + an * 2 + 16); const m8 = view(); m8.set(jpg, bp); const ap = (bp + jpg.length + 1) & ~1; if (an) new Int16Array(m8.buffer, ap, an).set(a);
        const rc = W.web_avi_frame(bp, jpg.length, ap, an); if (rc) throw new Error('avi_frame ' + rc);
        fi++; const pct = Math.floor(fi * 100 / total); if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; toast(L('편집용으로 준비하는 중… ', 'Preparing for editing… ') + pct + '%'); }   // 편집용으로 준비하는 중…
      }
      if (open) end();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      log.push('WEB vedit done ' + f.name + ' ' + w + 'x' + h + ' frames=' + total + ' parts=' + parts.length + ' sound=' + (pcm ? 1 : 0) + ' ' + secs + ' s');
      toast(L('편집기에 넣었어요', 'In the editor') + (parts.length > 1 ? ' (' + parts.length + L('개로 나눠서)', ' parts)') : ''));   // 편집기에 넣었어요 (N개로 나눠서)
      return { parts, note: pcm ? '' : (f.name + ' — ' + L('소리는 읽지 못해 소리 없이 넣었어요', 'its sound could not be read: added without sound')) };   // 소리는 읽지 못해 소리 없이 넣었어요
    } catch (e) {
      try { W.web_avi_abort(); } catch (x) { /* none open */ }
      log.push('WEB vedit failed ' + f.name + ' ' + e);
      return { parts: [], note: (f.name || '?') + ' — ' + L('이 휴대폰의 브라우저가 이 동영상을 풀지 못했어요', 'this phone\'s browser could not decode this video') + ' (' + e.message + ')' };   // 이 휴대폰의 브라우저가 이 동영상을 풀지 못했어요
    } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); }
  }
  async function sniff(f) {   // jpg / png / gif / webp / heic from the first bytes, '' when none of them
    try { const b = new Uint8Array(await f.slice(0, 16).arrayBuffer()), t = String.fromCharCode(...b.slice(4, 12));
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
      if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
      if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp';
      if (/^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(t)) return 'heic';
    } catch (e) { /* unreadable: the caller reports it */ }
    return '';
  }
  async function heicToJpeg(f) {   // decoded off the main path (createImageBitmap is async), at most 4096 px a side, JPEG 0.9
    try {
      const bm = await createImageBitmap(f), k = Math.min(1, 4096 / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
      c.getContext('2d').drawImage(bm, 0, 0, w, h); bm.close && bm.close();
      const b = c.convertToBlob ? await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }) : await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
      return b ? new Uint8Array(await b.arrayBuffer()) : null;
    } catch (e) { return null; }
  }
  let W, mem8, img, rgbaPtr, cw = 0, ch = 0, db, fontPack = null;
  const canvas = document.getElementById('screen'), ctx = canvas.getContext('2d');
  const ta = document.getElementById('keys');
  const enc = new TextEncoder(), dec = new TextDecoder();
  const view = () => { if (!mem8 || mem8.buffer !== W.memory.buffer) { mem8 = new Uint8Array(W.memory.buffer); img = null; } return mem8; };
  const str = (p, n) => dec.decode(view().subarray(p, p + n));
  const put = (bytes) => { const p = W.web_alloc(bytes.length + 1); view().set(bytes, p); view()[p + bytes.length] = 0; return p; };
  let scratch = 0, scratchN = 0;   // one reusable buffer for event text (web_alloc never frees)
  const temp = (bytes) => { if (bytes.length + 1 > scratchN) { scratchN = Math.max(4096, bytes.length + 1); scratch = W.web_alloc(scratchN); } view().set(bytes, scratch); view()[scratch + bytes.length] = 0; return scratch; };

  // ---- IndexedDB: one record per file path ----
  const idb = () => new Promise((ok, bad) => {
    const r = indexedDB.open('zeusos-weblite', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => { if (late) { r.result.close(); return; } clearTimeout(t); ok(r.result); }; r.onerror = () => { clearTimeout(t); bad(r.error); };
    let late = false; const t = setTimeout(() => { late = true; bad(new Error('IndexedDB did not open')); }, +q.get('idbwait') || 8000);   // LITE-WHITE: then the files are kept, not written
  });
  const allFiles = (d) => new Promise((ok) => {
    const out = [], c = d.transaction('files').objectStore('files').openCursor();
    c.onsuccess = () => { const k = c.result; if (!k) return ok(out); out.push([k.key, k.value]); k.continue(); };
    c.onerror = () => ok(out);
  });
  const removeFiles = (path) => { if (!db || (window.ZKeep && ZKeep.frozen)) return; if (window.ZKeep) ZKeep.removed(path); const st = db.transaction('files', 'readwrite').objectStore('files');
    if ([...kept].some(k => k === path || String(k).startsWith(path + '/'))) {   // LITE-WHITE: under it lies a record the start did not load: delete only what was loaded
      if (!kept.has(path)) st.delete(path); const c = st.openCursor(IDBKeyRange.bound(path + '/', path + '/\uffff'));
      c.onsuccess = () => { const k = c.result; if (!k) return; if (!kept.has(k.key)) k.delete(); k.continue(); }; log.push('WEB removed ' + path + ' (kept ones left)'); return; }
    st.delete(path); st.delete(IDBKeyRange.bound(path + '/', path + '/\uffff')); log.push('WEB removed ' + path); };
  const kept = new Set();   // LITE-WHITE: paths left in IndexedDB at the start (not bytes, too big for the memory, or refused)
  const saveFile = (path, bytes) => { if (!db || (window.ZKeep && ZKeep.frozen)) return; if (kept.has(path)) { log.push('WEB kept, not saved ' + path); return; }   /* LITE-WHITE: a record not loaded is never written over */ /* LITE-PERSIST: not while a backup is being restored */ let t; try { t = db.transaction('files', 'readwrite'); t.objectStore('files').put(bytes, path); } catch (e) { saveFailed(path, e); return; }
    idbOpen++; const done = () => { if (--idbOpen === 0) { const w = idbWait.splice(0); w.forEach(f => f()); } };   // LITE-SW-UPDATE: the switch waits for these
    t.oncomplete = () => { log.push('WEB saved ' + path + ' ' + bytes.length); if (window.ZKeep) ZKeep.saved(path); done(); }; t.onabort = t.onerror = () => { saveFailed(path, t.error); done(); }; };
  let idbOpen = 0, typedAt = 0; const idbWait = [];
  const idbIdle = () => idbOpen ? new Promise(ok => idbWait.push(ok)) : Promise.resolve();
  const saveFailed = (path, e) => { log.push('WEB save failed ' + path + ' ' + (e && e.name)); toast('\uc774 \ud734\ub300\ud3f0\uc5d0 \uc800\uc7a5\ud558\uc9c0 \ubabb\ud588\uc5b4\uc694: ' + path.split('/').pop() + (e && e.name === 'QuotaExceededError' ? '\n\uc800\uc7a5 \uacf5\uac04\uc774 \ubd80\uc871\ud574\uc694' : '')); };   // 이 휴대폰에 저장하지 못했어요 / 저장 공간이 부족해요

  const imports = { env: {
    m_sin: Math.sin, m_cos: Math.cos, m_tan: Math.tan, m_log: Math.log, m_log10: Math.log10, m_pow: Math.pow, m_asin: Math.asin, m_acos: Math.acos, m_atan: Math.atan, m_sinh: Math.sinh, m_cosh: Math.cosh, m_tanh: Math.tanh, m_asinh: Math.asinh, m_acosh: Math.acosh, m_atanh: Math.atanh, m_log2: Math.log2, m_cbrt: Math.cbrt, m_exp: Math.exp,   // CALC-2: u calc's Scientific keys (tools/weblite/libc/math.h)
    present(x, y, w, h) {
      if (!rgbaPtr) { rgbaPtr = W.web_rgba(); img = null; }   // WEB-DESKTOP: gui.c's first frame comes inside web_start
      view();
      if (!img) img = new ImageData(new Uint8ClampedArray(W.memory.buffer, rgbaPtr, cw * ch * 4), cw, ch);
      ctx.putImageData(img, 0, 0, x, y, w, h); stats.frames++;
    },
    log(p, n) {   // gui_log writes a line in pieces: lines end at '\n'
      const parts = (pending + str(p, n)).split('\n'); pending = parts.pop();
      for (const l of parts) { if (l.startsWith('GUI ime focus ')) { const on = l.startsWith('GUI ime focus on'); if (imeFocus && !on) imeLost = true; imeFocus = on; imeMoved = true;
          if (on) { const r = l.split(' ').slice(4).map(Number); imeCaret = [r[0] + 8, r[1], r[3]]; caretMoved = true; } }   // the field until its caret is said
        else if (l.startsWith('GUI ime caret ')) { imeCaret = l.split(' ').slice(3).map(Number); caretMoved = true; }
        fromWasm = true; log.push(l); fromWasm = false; if (log.length > 20000) log.splice(0, 5000); }
    },
    now_us() { return performance.now() * 1000; },
    epoch_us() { return (performance.timeOrigin + performance.now()) * 1000; },
    open_url(p, n) { const u = str(p, n); if (/^https?:\/\//.test(u)) window.open(u, '_blank', 'noopener'); },   // inside the tap
    pick_accept(p, n) { pickAccept = str(p, n); },   // FILE-IMPORT-ALL: the next pick's accept= (the app's own kinds)
    pick(p, n) { picker.accept = pickAccept; pickAccept = ''; pickDir = str(p, n); try { sessionStorage.setItem('zeus-picking', String(Date.now())); } catch (e) { /* private mode */ } pickerAt(); picker.click(); },   // Files' Add, inside the tap (iOS needs the gesture)
    save(p, pn, d, n) { saveFile(str(p, pn), view().slice(d, d + n)); },
    remove(p, n) { removeFiles(str(p, n)); },
    audio(play, p, n) { radio.cmd(play, str(p, n)); },
    audio_state() { return radio.state; },
    audio_pos() { return radio.el ? radio.el.currentTime * 1000 : 0; },
    audio_volume(v) { if (!radio.el) return 100; if (v >= 0) radio.el.volume = Math.min(1, v / 100); return Math.round(radio.el.volume * 100); },
    media(play, p, n, skip) { return media.cmd(play, str(p, n), skip); },   // MEDIA-SEED: Music / Voice Memos
    media_state() { return media.state; },
    video(p, n) { return showVideo(str(p, n)); },
    // BOOTSND-01: the start sound — sounds/start-X.mp3 straight from this page's server, its own <audio>. A browser plays
    // sound only after the person touched the page (autoplay rule): before that, nothing plays and nothing waits to play.
    start_sound(p, n) { const k = str(p, n); if (!/^[abcd]$/.test(k)) return -1;
      const active = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
      if (!active) { log.push('WEB startsound blocked no-gesture ' + k); return -1; }
      try { const a = new Audio('sounds/start-' + k + '.mp3'); a.volume = media.el ? media.el.volume : 1;
        a.addEventListener('playing', () => log.push('WEB startsound playing ' + k), { once: true });
        const pr = a.play(); if (pr && pr.catch) pr.catch((e) => log.push('WEB startsound refused ' + e.name)); } catch (e) { return -1; }
      log.push('WEB startsound play ' + k); return 0; },
    intro_first() { if (navigator.webdriver && q.get('intro') !== '1') return 0;   // automated pages (tests) only with ?intro=1
      try { if (localStorage.getItem('zeus-intro')) return 0; localStorage.setItem('zeus-intro', '1'); return 1; } catch (e) { return 0; } },   // the device's first visit only
    run_sync(p, n, out, cap) {   // Reader's foreground programs: a blocking request (the app waits, as on ZeusOs)
      let o = ''; try { o = runSync(str(p, n)); } catch (e) { o = 'error: ' + e.message + '\n'; }
      const b = enc.encode(o).slice(0, cap); view().set(b, out); return b.length;
    },
    run(p, n) { const line = str(p, n); if (!/^vmm (list|keys)/.test(line)) log.push('WEB run ' + line);   // the VM console's keys (a typed password) never in the log
      jobs(line).catch((e) => log.push('WEB job failed ' + e)); },
    // VOICE-01: the Assistant's ears and mouth (voice.js, in front of this file)
    voice_listen(f) { return window.ZVoice ? window.ZVoice.listen(f) : -19; },
    voice_end() { if (window.ZVoice) window.ZVoice.end(); },
    voice_cancel() { if (window.ZVoice) window.ZVoice.cancel(); },
    voice_poll(out, cap, lv) { if (!window.ZVoice) return 0; const [st, t] = window.ZVoice.poll(); new Int32Array(W.memory.buffer, lv, 1)[0] = window.ZVoice.level | 0;
      if (t) { const b = enc.encode(t).slice(0, cap - 1); view().set(b, out); view()[out + b.length] = 0; } else view()[out] = 0; return st; },
    voice_say(p, n) { return window.ZVoice ? window.ZVoice.say(str(p, n)) : -19; },
    voice_say_stop() { if (window.ZVoice) window.ZVoice.sayStop(); },
    voice_say_busy() { return window.ZVoice ? window.ZVoice.sayBusy() : 0; },
    voice_partial(out, cap) { const t = window.ZVoice && window.ZVoice.partial ? window.ZVoice.partial() : ''; const b = enc.encode(t).slice(0, cap - 1); view().set(b, out); view()[out + b.length] = 0; return b.length; },   // ZEUS-RTC-1
    voice_info(out, cap) { const b = enc.encode(window.ZVoice ? window.ZVoice.info() : 'mic=none').slice(0, cap - 1); view().set(b, out); view()[out + b.length] = 0; return b.length; },
    clip(p, n) { try { navigator.clipboard && navigator.clipboard.writeText(str(p, n)).catch(() => {}); } catch (e) { /* not allowed */ } },
  } };
  imports.wasi_snapshot_preview1 = { fd_write: () => 52 };   // MESSENGER-1: zmls (mls-rs on wasm32-wasip1) links std, whose panic text would go to fd_write; nothing is written (52 = ENOSYS)

  // ---- the picture: canvas device pixels = CSS size x devicePixelRatio (phone), or 1:1 for the pixel check ----
  // WEB-DESKTOP: on a PC (desk.js ZDesk.wanted) the module is desk.wasm — the ZeusOs desktop itself, its windows, top
  // bar and Dock; `desktop` below is the older one-app pane at a fixed size (?mode=pane, the QEMU pixel check).
  const desk = !!(window.ZDesk && ZDesk.wanted());
  const desktop = q.get('mode') === 'pane';
  const dpr = desktop ? 1 : desk ? (+q.get('dpr') || ((window.devicePixelRatio || 1) >= 1.5 ? 2 : 1)) : Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));
  // Safe-area insets in device pixels (an installed app runs under the status bar and above the home indicator).
  // ?insets=TOP,BOTTOM (CSS px) stands in for a real iPhone in tests.
  const probe = document.getElementById('safe');
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  function safeCss() {   // [top, bottom] CSS px
    if (q.get('insets')) return q.get('insets').split(',').map(Number);
    const cs = getComputedStyle(probe); return [parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0];
  }
  function insets() {
    if (desktop || desk || !standalone()) return [0, 0];   // a Safari tab: Safari's own bars keep their room
    return safeCss().map(v => Math.round(v * dpr));
  }
  function size() {
    if (desktop) return [+q.get('w') || 1920, +q.get('h') || 1200];
    if (desk) return [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)];
    const box = document.getElementById('stage').getBoundingClientRect(), vv = window.visualViewport;
    const w = box.width || innerWidth, h = Math.min(box.height || innerHeight, vv ? vv.offsetTop + vv.height : innerHeight);   // 100dvh, never under Safari's bar or the keyboard
    return [Math.round(w * dpr), Math.round(h * dpr)];
  }
  // DOC-PHONE-VIEW: the phone's own text size (iOS: Settings > Accessibility > Larger Text — Safari's -apple-system-body font
  // follows it, 17 px at the default; elsewhere the root font size the browser gives, 16 px at the default), as a percent.
  // ?a11y=PCT stands in for it in tests.
  function a11yPct() {
    if (q.get('a11y')) return +q.get('a11y') || 100;
    try {
      const s = document.createElement('span'); s.style.font = '-apple-system-body'; let apple = 0;
      if (s.style.font) { s.style.position = 'absolute'; s.style.visibility = 'hidden'; s.textContent = 'x'; document.body.appendChild(s); apple = parseFloat(getComputedStyle(s).fontSize) || 0; s.remove(); }
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const p = apple ? apple / 17 : root / 16;
      return Math.round(Math.max(0.8, Math.min(2.4, p)) * 100);
    } catch (e) { return 100; }
  }
  function fit(w, h) {
    cw = w; ch = h; canvas.width = w; canvas.height = h;
    canvas.style.width = (w / dpr) + 'px'; canvas.style.height = (h / dpr) + 'px'; img = null;
  }

  async function boot() {
    const mod = desk ? 'desk.2699b41491.js' : 'app.c98ea12779.js';
    if (desk) { document.documentElement.classList.add('desk'); log.push('WEB mode desktop'); }
    // LITE-WHITE: a wasm already in this build's cache compiles while streaming (the browser's code cache too); else it is
    // counted on the boot screen, a stall or a cut is tried again, and a failure is said in words (bootUI.fail)
    const inCache = window.caches && navigator.serviceWorker && navigator.serviceWorker.controller ? caches.match(mod).then(r => !!r, () => false) : Promise.resolve(false);
    const wasm = inCache.then(hit => hit && WebAssembly.instantiateStreaming ? WebAssembly.instantiateStreaming(fetch(mod), imports).catch(() => fetchBytes(mod).then(b => WebAssembly.instantiate(b, imports)))   // a .bin name (TRY-FAST) is not application/wasm: the bytes path
      : fetchBytes(mod).then(b => WebAssembly.instantiate(b, imports)));
    const pack = fetchBytes('uisans.24c57cc6f2.js');
    let idbLost = false; const dbp = idb().catch((e) => { log.push('WEB idb failed ' + e); idbLost = true; return null; });
    const [inst, fonts, d] = await Promise.all([wasm, pack, dbp]);
    stats.boot.fetched_ms = performance.now() - t0;
    W = window.__W = inst.instance.exports; db = d;   // __W, __webfile: test hooks
    await stocksProbe();   // STOCKS-LITE: is this the owner's session on a server that turned the stocks relay on? (before the Stocks app builds its first list)
    window.__webput = (path, bytes) => fileOut(path, new Uint8Array(bytes));
    window.__websamples = (kind) => samples(kind);   // tests: 샘플 받기 again once the library is there (its button only shows on an empty list)
    window.__webfile = (path) => { const np = W.web_alloc(4), dp = W.web_file_get(temp(enc.encode(path)), np); return dp ? new Int32Array(W.memory.buffer, np, 1)[0] : -1; };
    fontPack = fonts; const fp = W.web_alloc(fonts.byteLength); view().set(new Uint8Array(fonts), fp); W.web_pack(fp, fonts.byteLength);
    let lost = 0; const small = safeMode();
    if (db) { let all = []; try { all = await allFiles(db); } catch (e) { log.push('WEB load failed (list) ' + e); lost++; }
      // LITE-CHATLOSS + LITE-WHITE: a file the app could not take stays in IndexedDB (kept: never saved over), and says so.
      // Each file costs its size once in memory (the bytes go through one reused buffer); over the budget the small files go
      // first (settings, chats, documents) and the biggest stay kept. After a start that did not fit (safeMode) the budget is small.
      const bytesOf = (v) => v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : null;
      const budget = small ? 48 << 20 : 150 << 20; let sum = 0; for (const [, v] of all) { const b = bytesOf(v); sum += b ? b.length : 0; }
      if (sum > budget) all.sort((x, y) => { const a = bytesOf(x[1]), b = bytesOf(y[1]); return (a ? a.length : 0) - (b ? b.length : 0); });
      let used = 0;
      for (const [path, v] of all) { const bytes = bytesOf(v);
        if (typeof path !== 'string' || !bytes || used + bytes.length > budget) { lost++; kept.add(path); log.push('WEB load failed ' + path + ' ' + (bytes ? 'over budget ' + bytes.length : 'not bytes ' + (v === null ? 'null' : typeof v))); continue; }
        let rc; try { const p = put(enc.encode(path)); rc = W.web_file_put(p, temp(bytes), bytes.length); } catch (e) { rc = String(e); }
        if (rc) { lost++; kept.add(path); log.push('WEB load failed ' + path + ' ' + rc); } else used += bytes.length; }
      stats.boot.files_loaded_kb = used >> 10; }
    stats.boot.files_unloaded = lost; if (lost || idbLost) setTimeout(() => toast(KEPT_MSG), 1500);
    const [w, h] = size(); fit(w, h);
    const body = (q.get('body') || '0,0,0,0').split(',').map(Number);
    const appq = q.get('app') ?? (window.__tryapp || null);   // TRY-SELF: /try/<app> opens that app at once
    const app = { notes: 0, news: 1, zeus: 2, radio: 3, calc: 4, clock: 5, files: 6, settings: 7, reader: 8, viewer: 9, tasks: 10, weather: 11, mail: 12, calendar: 13, terminal: 14, vault: 15, browser: 16, vmm: 17, music: 18, photos: 19, video: 20, voice: 21, rdesk: 22, mkusb: 23, documents: 24, shop: 25, photobooth: 26, zcloud: 27, system: 28, sheet: 29, import: 30, security: 31 }[appq] ?? (appq && W.web_app_tag && W.web_app_tag(temp(enc.encode('phone.app.' + appq))) >= 0 ? W.web_app_tag(temp(enc.encode('phone.app.' + appq))) : appq && W.web_app_by_key ? (W.web_app_by_key(temp(enc.encode(appq)), appq.length) | 0) : undefined), start = desktop ? (app === undefined ? 0 : app) : app === undefined ? -1 : app;
    if (desk && q.get('windows') === '1') W.web_desk_windows(1);
    if (desk && q.get('lat') === '1') W.web_desk_lattrace(1);   // gui.c's GUI lat lines (perf tests)   // tests: the three first windows of a QEMU desktop
    if (desk) W.web_desk_max(Math.max(w, Math.min(3840, Math.round(screen.width * dpr))), Math.max(h, Math.min(2400, Math.round(screen.height * dpr))));   // the window may grow to the screen
    { const lp = q.get('lang'), auto = !navigator.webdriver || lp === 'auto';   // LANG-PANE: the browser's language is the first default; ~/.config/region wins once Settings picks one.
      if (W.web_lang) W.web_lang(lp === 'ko' ? 1 : lp === 'en' ? 0 : auto ? (KOPREF ? 1 : 0) : 1); }   // automated test browsers keep the old Korean phone unless ?lang=auto|ko|en
    if (W.web_a11y) W.web_a11y(a11yPct());   // DOC-PHONE-VIEW: before the first frame (the writing apps size their body text by it)
    // LITE-SW-UPDATE: the page was reloaded onto a new build — open the app (and the note) that was open
    let resume = null; try { resume = JSON.parse(sessionStorage.getItem('zeus-resume') || 'null'); sessionStorage.removeItem('zeus-resume'); } catch (e) { /* private mode */ }
    if (resume && Date.now() - resume.t > 120e3) resume = null;
    const first = resume && appq === null && resume.app >= 0 ? resume.app : start;
    if (TRY && W.web_try) W.web_try(1);   // TRY-SELF: before the places are made: only the apps that run in this browser
    const rc = W.web_start(w, h, desktop ? (+q.get('scale') || 1) : dpr, desktop || desk ? 0 : 1, ...insets(), first, Math.round(-new Date().getTimezoneOffset() / 60), ...body);
    if (rc) { log.push('WEB start refused ' + rc);
      if (!small && db) { try { sessionStorage.setItem('zeus-safe', '1'); } catch (e) { /* private */ } location.reload(); return new Promise(() => {}); }   // LITE-WHITE: the home did not fit: start again with the small budget
      throw new Error('start ' + rc); }
    bootUI.done();
    if (resume) { if (resume.doc && W.web_open_doc) W.web_open_doc(temp(enc.encode(resume.doc))); log.push('WEB resumed app=' + resume.app + ' doc=' + (resume.doc || '-')); }
    rgbaPtr = W.web_rgba();
    if (desk && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.ready.then(() => {   // WEB-DESKTOP: desk.wasm into this build's cache (not in the install list: phones never load it)
      const keep = () => fetch(mod).then((r) => log.push('WEB desk cached ' + r.status), () => {});
      if (navigator.serviceWorker.controller) keep(); else navigator.serviceWorker.addEventListener('controllerchange', keep, { once: true });
    });
    if (desk) ZDesk.attach({ W, canvas, dpr, log, input, files: () => (db ? allFiles(db) : Promise.resolve([])), saveFile, writeMain, readMain, takeVideos: (fs) => takePicked(fs, true), isVideo, isFile: (p) => W.web_stat(mainPath(p), W.web_alloc(4)) === 1, run: (line) => jobs(line).catch(() => {}), clip: (t) => { const b = enc.encode(t.replace(/\r/g, '')), p = W.web_clip_put(b.length); view().set(b.subarray(0, 4096), p); } });
    if (q.get('autosave') === '0') W.web_autosave(0);
    if (desk && TRY && window.__tryapp && window.__trywide && W.web_desk_open) { const k = enc.encode(window.__tryapp); W.web_desk_open(temp(k), k.length); }   // TRY-BIGAPPS: /try/retouch on a PC: the desktop, that app filling it
    if (TRY) setTimeout(() => trySeedRun('small'), 1500);   // TRY-SAMPLES
    if (TRY && window.__tryapp === 'videoedit') trySamples('video'); else if (TRY && window.__tryapp === 'retouch') trySamples('photo');   // TRY-BIGAPPS: the sample is in the folder before the person looks for it
    W.web_frame();
    stats.boot.first_frame_ms = performance.now() - t0;
    log.push('WEB first frame ' + stats.boot.first_frame_ms.toFixed(1) + ' ms');
    requestAnimationFrame(loop);
    const usage = () => navigator.storage && navigator.storage.estimate && navigator.storage.estimate().then(e => W.web_storage(Math.round((e.usage || 0) / 1024))).catch(() => {});
    usage(); setInterval(usage, 30000);
    const device = () => {   // SYSAPP-02: the System app's facts — cores, memory (GiB, rounded by the browser), the kind of device, online, storage
      const ua = navigator.userAgent, kind = /iPhone|iPad|iPod/.test(ua) ? 1 : /Android/.test(ua) ? 2 : /Macintosh/.test(ua) ? 3 : /Windows/.test(ua) ? 4 : /Linux/.test(ua) ? 5 : 0;
      const put = (u, q) => W.web_device && W.web_device(navigator.hardwareConcurrency || 0, Math.round((navigator.deviceMemory || 0) * 1024), kind, navigator.onLine ? 1 : 0, u, q);
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => put(Math.round((e.usage || 0) / 1024), Math.round((e.quota || 0) / 1024))).catch(() => put(-1, -1)); else put(-1, -1);
    };
    device(); addEventListener('online', device); addEventListener('offline', device);
    stats.boot.standalone = standalone(); stats.boot.insets = insets();
    // every Hangul syllable: the full font pack after the first frame (the first one has KS X 1001's 2,350)
    fetch('uisans-full.929e9c5e12.js').then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then((b) => {
      fontPack = b; const p = W.web_alloc(b.byteLength); view().set(new Uint8Array(b), p);
      const rc = W.web_fonts(p, b.byteLength); stats.boot.full_fonts_ms = performance.now() - t0; log.push('WEB full fonts ' + rc + ' ' + stats.boot.full_fonts_ms.toFixed(0) + ' ms');
    }).catch((e) => log.push('WEB full fonts later (' + e + ')'));
    banner();
    if (TRY && window.ZTry) ZTry.start({ W, log, ko: () => W.web_is_ko ? !!W.web_is_ko() : true });
    if (window.ZKeep) {   // LITE-PERSIST (keep.js): the files in IndexedDB, as keep.js needs them
      const idbGet = (path) => new Promise((ok) => { if (!db) return ok(null); const g = db.transaction('files').objectStore('files').get(path); g.onsuccess = () => ok(g.result == null ? null : new Uint8Array(g.result)); g.onerror = () => ok(null); });
      ZKeep.start({ W, log, toast, frame: () => W.web_frame(),
        files: () => db ? allFiles(db) : Promise.resolve([]), read: idbGet, has: (path) => idbGet(path).then((b) => b !== null),
        frozen: (on) => { ZKeep.frozen = !!on; },
        writeAll: (files, clear) => new Promise((ok, bad) => { const t = db.transaction('files', 'readwrite'), os = t.objectStore('files');
          if (clear) os.clear(); for (const [path, bytes] of files) os.put(bytes, path);
          t.oncomplete = () => ok(); t.onabort = t.onerror = () => bad(t.error || new Error('write')); }) });
    }
    if (!TRY) setTimeout(() => { mediaSync().catch((e) => log.push('WEB media sync failed ' + e)); }, 1500);   // SAMPLE-VIDEO: stale sample heads leave the phone
    // RD-04 radio flags (the ZeusOs pack entry, 48x36 on a HiDPI screen): fetched once, handed in before Radio needs them
    fetch(dpr >= 2 ? 'flags2.79c4cb7896.js' : 'flags.84945cec3e.js').then(r => r.ok ? r.arrayBuffer() : null).then((b) => { if (!b) return; const p = W.web_alloc(b.byteLength); view().set(new Uint8Array(b), p);
      W.web_pack_entry(mainPath(dpr >= 2 ? 'flags2' : 'flags'), p, b.byteLength); }).catch(() => log.push('WEB flags not loaded'));
    // INTRO-DESK: a person's page (tests only with ?intro=1, as the start text): the 「ZeusOs 소개」 folder once, then What's New once per lite release
    const people = !navigator.webdriver || q.get('intro') === '1'; if (people && !TRY && W.web_introdesk) W.web_introdesk();   // the desktop module (desk.wasm) has no INTRO-DESK: calling it stopped the PC start (11-07 owner)
    // INTRO-DESK: the What's New words (pack entry `whatsnew`; shown once per lite release) and the manual for Help (`manual`)
    fetch('whatsnew.dfe4dee8ad.js').then(r => r.ok ? r.arrayBuffer() : null).then((b) => { if (!b) return; const p = W.web_alloc(b.byteLength); view().set(new Uint8Array(b), p);
      W.web_pack_entry(mainPath('whatsnew'), p, b.byteLength); if (people && !(TRY && window.__tryapp)) { if (W.web_whatsnew) W.web_whatsnew(); else if (TRY && W.web_try_boot) W.web_try_boot(); } }).catch(() => log.push('WEB whatsnew not loaded'));
    fetch('manual.d1973f1e82.js').then(r => r.ok ? r.arrayBuffer() : null).then((b) => { if (!b) return; const p = W.web_alloc(b.byteLength); view().set(new Uint8Array(b), p);
      W.web_pack_entry(mainPath('manual'), p, b.byteLength); }).catch(() => log.push('WEB manual not loaded'));
    // FONT-01: the fallback faces (Cyrillic, Greek, Arabic, Hebrew, Thai, Indic, kana + Han, wide emoji) — the ZeusOs pack entry `intlfont`
    fetch('intlfont.244c08f51f.js').then(r => r.ok ? r.arrayBuffer() : null).then((b) => { if (!b) return; const p = W.web_alloc(b.byteLength); view().set(new Uint8Array(b), p);
      W.web_pack_entry(mainPath('intlfont'), p, b.byteLength); }).catch(() => log.push('WEB intlfont not loaded'));
    { const at = +(sessionStorage.getItem('zeus-picking') || 0); sessionStorage.removeItem('zeus-picking');   // the page was reloaded while the camera / picker was open
      if (at && Date.now() - at < 10 * 60e3) toast('\uc0ac\uc9c4\uc744 \uac00\uc838\uc624\uc9c0 \ubabb\ud588\uc5b4\uc694: \uce74\uba54\ub77c\ub97c \uc5ec\ub294 \ub3d9\uc548 \ube0c\ub77c\uc6b0\uc800\uac00 \uc774 \ud398\uc774\uc9c0\ub97c \ub2e4\uc2dc \uc5f4\uc5c8\uc5b4\uc694.\n\uc0ac\uc9c4\uc744 \uba3c\uc800 \ucc0d\uace0 \uac24\ub7ec\ub9ac\uc5d0\uc11c \uace0\ub974\uba74 \ub429\ub2c8\ub2e4.'); }   // 사진을 가져오지 못했어요: 카메라를 여는 동안 브라우저가 이 페이지를 다시 열었어요. 사진을 먼저 찍고 갤러리에서 고르면 됩니다.
    if (!nativeHls) { const sc = document.createElement('script'); sc.src = 'hls.4a582e5e99.js'; sc.onload = () => log.push('WEB hls.js ready'); document.head.appendChild(sc); }
  }
  // Safari, not installed: say once how to make it an app
  function banner() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!ios || standalone() || localStorage.getItem('zeus-a2hs') || q.get('banner') === '0') return;
    const b = document.getElementById('a2hs'); b.hidden = false; log.push('WEB banner shown');
    b.querySelector('button').onclick = () => { b.hidden = true; localStorage.setItem('zeus-a2hs', '1'); };
    localStorage.setItem('zeus-a2hs', '1');
  }
  // ---- LITE-SW-UPDATE: a phone moves to a new build by itself, like a well-behaved installed app ----
  // version.json (never cached) names the live build's JS. It is asked when the page opens, every EVERY ms while it is in
  // front, and whenever it comes back (visibilitychange, pageshow). A new build: the browser installs its worker (sw.js
  // fills the new cache and waits); then, if nothing is being typed or edited (busyWhy), the page saves, tells the worker
  // to take over and reloads into the same app and note. Otherwise a small banner 「새 판이 있어요 · 지금 바꾸기」 waits,
  // and the switch happens when the user taps it, leaves the app, or opens it next time. Unsaved text is saved first.
  const myJs = (ME || '').split('/').pop().split('?')[0], stamped = /^weblite\.[0-9a-f]{10}\.js$/.test(myJs);
  const EVERY = Math.max(1000, +q.get('upd') || 5 * 60e3);   // ?upd=ms: the tests' short interval
  const swOk = 'serviceWorker' in navigator && location.protocol !== 'file:';
  const sleep = (ms) => new Promise(ok => setTimeout(ok, ms));
  const upd = window.__webupdate = { state: '?', checked: 0, live: null, next: null, every: EVERY };
  const swReg = swOk ? navigator.serviceWorker.register('sw.js').then((r) => { log.push('WEB sw registered'); return r; }, (e) => { log.push('WEB sw failed ' + e); return null; }) : Promise.resolve(null);
  const askWorker = (w) => new Promise((ok) => {
    const ch = new MessageChannel(), t = setTimeout(() => ok(null), 3000);
    ch.port1.onmessage = (e) => { clearTimeout(t); ok(e.data); };
    try { w.postMessage({ do: 'ask' }, [ch.port2]); } catch (e) { clearTimeout(t); ok(null); }
  });
  async function workerFor(js, ms) {   // the worker of that build: 'active' (already in charge), a waiting one, or null
    const reg = await swReg; if (!reg) return null;
    const end = Date.now() + ms; let asked = 0;
    while (Date.now() < end) {
      if (reg.active) { const a = await askWorker(reg.active); if (a && a.js === js) return 'active'; }
      if (reg.waiting) { const a = await askWorker(reg.waiting); if (a && a.js === js) return reg.waiting; }
      const inst = reg.installing;
      if (inst) { await new Promise((ok) => { const f = () => { if (inst.state !== 'installing') { inst.removeEventListener('statechange', f); ok(); } }; inst.addEventListener('statechange', f); setTimeout(ok, 5000); }); continue; }
      if (Date.now() - asked > 4000) { asked = Date.now(); try { await reg.update(); } catch (e) { /* offline or the same script */ } continue; }
      await sleep(400);
    }
    return null;
  }
  function busyWhy() {   // why switching now would get in the way ('' = it would not)
    if (!W) return '';
    if (composing) return 'composing';
    const b = W.web_busy ? W.web_busy() : 0;
    if (b & 1) return 'unsaved';
    if (b & 2) return 'sheet';
    const acct = document.getElementById('acct'); if ((acct && !acct.hidden) || document.getElementById('lite-login')) return 'sheet';
    try { if (sessionStorage.getItem('zeus-picking')) return 'picking'; } catch (e) { /* private mode */ }
    if (document.activeElement === ta && ta.inputMode !== 'none' && (imeFocus || textApp())) return 'keyboard';
    if (Date.now() - typedAt < 30e3) return 'typing';
    return '';
  }
  const when = (iso, lang) => { const d = new Date(iso); return isNaN(d) ? '?' : d.toLocaleString(lang, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  function tell() {   // Settings › 정보 and System › 업데이트: this build and the update state in plain words (shim_system.c)
    if (!W || !W.web_build_set) return;
    const id = stamped ? myJs.slice(8, 18) : 'dev', mine = BUILT.startsWith('__') ? '?' : BUILT, nx = upd.next || (upd.live && upd.live.js !== myJs ? upd.live : null);
    const st = { latest: ['최신이에요.', 'It is the latest.'], fetching: ['새 판을 받는 중이에요.', 'A newer build is downloading.'],
      ready: ['새 판(' + (nx ? when(nx.built, 'ko-KR') : '?') + ')이 준비됐어요. 쓰던 것을 마치면, 또는 다음에 열 때 저절로 바뀌어요.', 'A newer build (' + (nx ? when(nx.built, 'en-US') : '?') + ') is ready. It switches by itself when you finish what you are typing, or the next time you open the app.'],
      offline: ['지금은 새 판이 있는지 확인하지 못했어요 (인터넷 연결 없음).', 'Could not check for a newer build just now (no internet).'],
      '?': ['새 판이 있는지 아직 확인하기 전이에요.', 'Not checked for a newer build yet.'] }[upd.state] || ['?', '?'];
    const min = Math.round(EVERY / 60e3), tick = upd.checked ? new Date(upd.checked).toTimeString().slice(0, 5) : '?';
    const k = '이 앱은 ' + when(mine, 'ko-KR') + '에 만든 판이에요. ' + st[0] + '\n새 판이 나오면 저절로 바뀌어요. 쓰던 글은 바꾸기 전에 먼저 저장해요.\n\n기술 자세히: 판 ' + id + ' · 만든 때 ' + mine + ' · 마지막 확인 ' + tick + ' · ' + (min >= 1 ? min + '분' : Math.round(EVERY / 1000) + '초') + '마다 확인' + (nx ? ' · 새 판 ' + nx.js.slice(8, 18) : '');
    const e = 'This app is the build made on ' + when(mine, 'en-US') + '. ' + st[1] + '\nNew builds arrive by themselves; what you are typing is saved first.\n\nTechnical details: build ' + id + ' · made ' + mine + ' · last checked ' + tick + ' · checks every ' + (min >= 1 ? min + ' min' : Math.round(EVERY / 1000) + ' s') + (nx ? ' · new ' + nx.js.slice(8, 18) : '');
    W.web_build_set(temp(enc.encode(k + '\t' + e)));
  }
  function banner2(on) {
    const b = document.getElementById('upd'); if (!b) return;
    if (on && b.hidden) { b.querySelector('button').onclick = () => apply('button'); log.push('WEB update banner'); }
    b.hidden = !on;
  }
  let applying = false, checking = false;
  async function apply(how) {
    if (applying || !upd.next) return; applying = true;
    log.push('WEB update apply ' + how + ' ' + upd.next.js + ' (running ' + myJs + ')');
    try { if (W) { if (composing) reset(); W.web_save_now(); } } catch (e) { /* keep going: the reload must still happen */ }
    await Promise.race([idbIdle(), sleep(3000)]);   // the IndexedDB writes of that save are done
    try {
      let doc = ''; if (W && W.web_doc) { const p = W.web_doc(), v = view(); let e = p; while (p && v[e]) e++; doc = p ? str(p, e - p) : ''; }
      sessionStorage.setItem('zeus-resume', JSON.stringify({ app: W && W.web_cur ? W.web_cur() : -1, doc, t: Date.now() }));
      sessionStorage.setItem('zeus-reloaded', JSON.stringify({ js: upd.next.js, t: Date.now() }));
    } catch (e) { /* private mode: the home screen after the reload */ }
    const w = upd.next.worker;
    if (w && w !== 'active') { const moved = new Promise((ok) => { navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }); setTimeout(ok, 4000); }); w.postMessage({ do: 'skip' }); await moved; }
    location.reload();
  }
  function tryApply(why) {
    if (!upd.next || applying) return;
    let tried = null; try { tried = JSON.parse(sessionStorage.getItem('zeus-reloaded') || 'null'); } catch (e) { /* private mode */ }
    const looped = tried && tried.js === upd.next.js && Date.now() - tried.t < 60e3;   // reloaded for it a moment ago and still old: never a reload loop
    const b = busyWhy();
    if (why === 'hidden' ? (b === 'sheet' || b === 'picking' || b === 'composing') : b) { log.push('WEB update waits ' + b); banner2(true); return; }
    if (looped) { log.push('WEB update waits loop'); banner2(true); return; }
    apply(why);
  }
  async function checkBuild(why) {
    if (!stamped || checking || applying) return; checking = true;
    try {
      let v = null;
      try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) v = await r.json(); } catch (e) { /* offline */ }
      if (!v || !v.js) { if (upd.state !== 'ready') upd.state = 'offline'; tell(); return; }
      upd.checked = Date.now(); upd.live = v;
      if (v.js === myJs) { upd.state = 'latest'; upd.next = null; banner2(false); tell(); adopt(); return; }
      if (!upd.next || upd.next.js !== v.js) {
        log.push('WEB new build ' + v.js + ' (running ' + myJs + ', ' + why + ')'); upd.state = 'fetching'; upd.next = null; tell();
        const t = performance.now(), w = (await swReg) ? await workerFor(v.js, 90e3) : 'none';   // no worker here (refused, private mode): a plain reload
        if (!w) { log.push('WEB new build not installed yet'); tell(); return; }   // the next check tries again
        upd.next = { js: v.js, built: v.built, worker: w }; upd.state = 'ready';
        log.push('WEB new build ready ' + v.js + ' in ' + Math.round(performance.now() - t) + ' ms'); tell();
      }
      tryApply(why);
    } finally { checking = false; }
  }
  window.__webcheck = checkBuild;   // tests
  // at open: a worker of exactly this page's build waiting (this page came from the network under the older worker) takes over
  // now — nothing typed yet, and this page already runs the new files, so no reload
  let adopting = false;
  async function adopt() {   // also when the worker of this build is still installing (the page came first): wait for it
    if (adopting || !stamped || !(await swReg)) return; adopting = true;
    try { const w = await workerFor(myJs, 60e3); if (w && w !== 'active') { w.postMessage({ do: 'skip' }); log.push('WEB update took over at open ' + myJs); } } finally { adopting = false; }
  }
  adopt();
  const first = setInterval(() => { if (W) { clearInterval(first); tell(); setTimeout(() => checkBuild('open'), Math.min(EVERY, 4000)); } }, 200);
  setInterval(() => { if (document.visibilityState === 'visible') checkBuild('timer'); }, EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { checkBuild('return'); return; }
    if (upd.next && !applying) tryApply('hidden');   // left the app with a new build waiting: switch now (saved first), it opens new next time
  });
  addEventListener('pageshow', (e) => { if (e.persisted) checkBuild('return'); });
  addEventListener('online', () => checkBuild('online'));
  if (swOk) navigator.serviceWorker.addEventListener('controllerchange', () => { if (!applying) { log.push('WEB worker changed'); checkBuild('worker'); } });
  function loop() { if (rt.on) rtPump(); if (TRY && W.web_front_key && ++frameNo % 30 === 0) { const k = W.web_front_key(); const key = k ? str(k, 20).split('\0')[0] : ''; if (key === 'videoedit' && !trySampled.video) trySamples('video'); if (SEED_APP[key]) for (const g of [].concat(SEED_APP[key])) trySeedRun(g); } while (conQ.length && W.web_con_line) { const b = enc.encode(conQ.shift()); W.web_con_line(temp(b), b.length); } W.web_frame(); requestAnimationFrame(loop); }

  // One input, then the frame it causes; the time from the event to the picture on the canvas is the input latency.
  function input(ev, fn) {
    const a = performance.now(); fn(); const drew = W.web_frame(); const b = performance.now();
    if (ev === 'text' || ev === 'key' || ev === 'paste') typedAt = Date.now();   // LITE-SW-UPDATE: a new build waits while this is recent
    if (imeMoved) { imeMoved = false; if (!composing && ev !== 'text') reset(); }   // IME-01: another field took the keys
    if (imeLost) { imeLost = false; if (!textApp()) keyboardAway(); }   // KB-01: Enter/Done ended a single-line field
    if (caretMoved) { caretMoved = false; placeKeys(); }
    stats.inputs.push({ kind: ev, ms: b - a, since_event_ms: b - (stats.lastEventAt || a), drew });
    if (stats.inputs.length > 500) stats.inputs.splice(0, 100);
  }

  // ---- keyboard: the hidden textarea mirrors what the system keyboard did; differences become keys ----
  // IME-01: the textarea keeps what was typed since the last commit point (Enter, a tap, an arrow, Tab, a shortcut, a
  // focus change), not just the syllable: a phone keyboard that composes by replacing (iOS Korean: delete + insert) reads
  // the text before the caret to join the next jamo — wiped after every key, 안녕 + ㅏ came out 안녕ㅏ, not 안녀아.
  // A commit point ends the composition first (reset() with mirror set before the value, so a compositionend the value
  // change fires erases nothing at the caret's new place) — then the app gets the tap or the key.
  const SENT = '​';   // something to delete, so Backspace on an empty field still fires input
  const KEEP = 32;         // code points kept for the keyboard's context
  let mirror = SENT, composing = false;
  const cps = (s) => Array.from(s);
  function reset() { composing = false; mirror = SENT; if (ta.value !== SENT) ta.value = SENT; mirror = ta.value; try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* hidden */ } }
  function commit(why) { if (composing || mirror !== SENT) { if (ta.value !== mirror) sync(); log.push('WEB ime commit ' + why); } reset(); }
  // IME-01 (Android Backspace): the sentinel is not text. The diff is taken without it, and losing it with nothing else
  // changed is one Backspace. Android keyboards (Samsung Keyboard, Gboard) make the text before the caret their
  // composition and can swallow the sentinel into it: before, a syllable composed over it erased an app character
  // (the sentinel's loss counted as a Backspace), and once the textarea was empty the next Backspace came only as
  // keydown 229 with no input event — lost (owner 11-01: one character of earlier text would not delete).
  let nInput = 0, k229 = null;
  function sync() {
    const a0 = cps(mirror), b0 = cps(ta.value), sa = a0[0] === SENT, sb = b0[0] === SENT;
    const a = sa ? a0.slice(1) : a0, b = sb ? b0.slice(1) : b0; let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let del = a.length - i; const ins = b.slice(i).join('').replace(/\r/g, '');
    if (sa && !sb && !del && !ins && b.length === a.length) del = 1;   // only the sentinel went: Backspace before the caret
    if (del || ins) input('text', () => {
      if (del) W.web_erase(del);
      if (ins) { const t = enc.encode(ins); W.web_text(temp(t), t.length); }
    });
    mirror = ta.value;
    if (composing && !ta.value) reset();   // an empty composition: end it, so the next Backspace has the sentinel to delete
    else if (!composing && (!sb || b.length > KEEP || /[\n\t]/.test(ins))) reset();   // the sentinel went, too long, or a line ended
  }
  function lostBackspace(why) {   // a Backspace the textarea could not show: nothing before its caret
    if (ta.value && ta.selectionStart > 0) return false;
    log.push('WEB ime backspace ' + why); input('text', () => W.web_erase(1)); reset(); return true;
  }
  ta.addEventListener('keyup', (e) => {   // keydown 229 (an IME key) with no input event in between, on an empty textarea: Backspace
    if (k229 && (e.keyCode === 229 || e.key === 'Unidentified' || e.key === 'Backspace') && nInput === k229.n) lostBackspace('229');
    k229 = null;
  });
  ta.addEventListener('compositionstart', () => { composing = true; });
  ta.addEventListener('compositionend', () => { composing = false; sync(); });
  ta.addEventListener('input', (e) => { nInput++; stats.lastEventAt = e.timeStamp || performance.now(); sync(); });
  const KEYS = { ArrowLeft: 0x104, ArrowRight: 0x105, ArrowUp: 0x102, ArrowDown: 0x103, PageUp: 0x100, PageDown: 0x101, Home: 0x106, End: 0x107, Delete: 0x109, Escape: 0x1b, Tab: 9 };
  ta.addEventListener('keydown', (e) => {
    const mods = (e.ctrlKey || e.metaKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0);
    if (e.keyCode === 229 || e.key === 'Unidentified') k229 = { n: nInput };
    if (e.key === 'Backspace' && !mods && !(e.isComposing || composing) && lostBackspace('key')) { e.preventDefault(); return; }   // a real Backspace key with nothing before the caret
    const act = KEYS[e.key] !== undefined || (e.key === 'Enter' && (mods & 3)) || ((mods & 1) && /^[a-zA-Z=+\-0]$/.test(e.key) && e.key.toLowerCase() !== 'v');
    if (e.isComposing || composing) { if (!act) return; commit('key'); }   // an arrow or Ctrl+S mid-syllable: the syllable stays, then the key
    else if (act) reset();   // the caret moves or the app acts: what the keyboard saw before is no longer before the caret
    stats.lastEventAt = e.timeStamp || performance.now();
    if (KEYS[e.key] !== undefined) { e.preventDefault(); input('key', () => W.web_key(KEYS[e.key], mods)); return; }
    if (e.key === 'Enter' && (mods & 3)) { e.preventDefault(); input('key', () => W.web_key(10, mods)); return; }   // KIM-UX-2: Shift+Enter (a new line) and Ctrl/Cmd+Enter (send) keep their modifier
    if ((mods & 1) && /^[=+\-0]$/.test(e.key) && W && W.web_app() === 0) { e.preventDefault(); input('key', () => W.web_key(e.key.charCodeAt(0), mods)); return; }   // the Terminal's text size (TERM-ZOOM), not the page's zoom
    if ((mods & 1) && /^[a-zA-Z]$/.test(e.key) && e.key.toLowerCase() !== 'v') { e.preventDefault(); input('key', () => W.web_key(e.key.toLowerCase().charCodeAt(0), mods)); }
  });
  ta.addEventListener('paste', (e) => {
    const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; e.preventDefault(); commit('paste');
    const b = enc.encode(t.replace(/\r/g, '')); input('paste', () => W.web_text(temp(b), b.length));
  });

  // ---- programs: what news.c / readpage ask for with gui_run, done through the relays (tools/weblite/relay.py) ----
  // The same files the ZeusOs programs write (news list TSV, ZRD1 reader documents, ZIMG images); /tmp is never kept.
  const fileOutAll = (path, bytes) => {   // path in the text scratch, bytes in wasm's reusable staging buffer
    const bp = W.web_buf(bytes.length + 1); view().set(bytes, bp); const pp = temp(enc.encode(path)); W.web_file_put(pp, bp, bytes.length); };
  const fileOut = fileOutAll;
  function words(line) {   // shell words: "quoted \"x\"" and bare
    const out = []; let i = 0;
    while (i < line.length) {
      while (line[i] === ' ') i++; if (i >= line.length) break;
      let w = '';
      if (line[i] === '"') { i++; while (i < line.length && line[i] !== '"') { if (line[i] === '\\') i++; w += line[i++]; } i++; }
      else while (i < line.length && line[i] !== ' ') w += line[i++];
      out.push(w);
    }
    return out;
  }
  const docImages = new Map(), readSeq = {};   // reader document path -> its image table (id -> URL)
  async function zimg(url, fit) {   // fit: [maxW, maxH] keep aspect, or a number = square centre crop
    try {
      const r = await fetch('relay/img?url=' + encodeURIComponent(url)); if (!r.ok) throw new Error(r.status);
      const bm = await createImageBitmap(await r.blob());
      let w = bm.width, h = bm.height, sx = 0, sy = 0, sw = w, sh = h;
      if (typeof fit === 'number') { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = fit; }
      else { const k = Math.min(1, fit[0] / w, fit[1] / h); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); }
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bm, sx, sy, sw, sh, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data, out = new Uint8Array(12 + w * h * 4), dv = new DataView(out.buffer);
      dv.setUint32(0, 0x474d495a, true); dv.setUint32(4, w, true); dv.setUint32(8, h, true);
      for (let i = 0, o = 12; i < w * h * 4; i += 4, o += 4) { out[o] = px[i + 2]; out[o + 1] = px[i + 1]; out[o + 2] = px[i]; }
      return out;
    } catch (e) { const out = new Uint8Array(12); new DataView(out.buffer).setUint32(0, 0x474d495a, true); return out; }   // width 0 = could not decode
  }
  // ---- Zeus Radio's player: one <audio> (unlocked by the first tap, so reconnects may play too), titles via the relay ----
  // HLS in <audio>: Safari yes; Chrome only in new versions. Elsewhere hls.js (third_party/hlsjs, Apache-2.0) is loaded once
  // after the first frame, so a tap can start it inside the gesture (autoplay rule). ?nohls=1 tests that path.
  const nativeHls = q.get('nohls') !== '1' && !!document.createElement('audio').canPlayType('application/vnd.apple.mpegurl');
  const radio = { el: null, hls: null, state: 0, url: '', titleT: 0,
    cmd(play, url) {
      if (!this.el) {
        const a = this.el = new Audio(); a.preload = 'none';
        a.addEventListener('playing', () => { this.state = 2; });
        a.addEventListener('waiting', () => { if (this.state) this.state = 1; });
        a.addEventListener('stalled', () => { if (this.state) this.state = 1; });
        const fail = (why) => { if (!this.state) return; this.state = 3; log.push('WEB radio ' + why);
          fileOut('/home/zeus/.radio/title', enc.encode('error: \uc18c\ub9ac \uc548 \ub0a8: ' + why + '\n')); };
        a.addEventListener('error', () => fail('the stream did not play (' + (a.error ? a.error.code : '?') + ')'));
        a.addEventListener('ended', () => fail('the stream ended'));
      }
      clearInterval(this.titleT);
      if (this.hls) { this.hls.destroy(); this.hls = null; }
      if (!play) { this.state = 0; this.el.pause(); this.el.removeAttribute('src'); this.el.load(); log.push('WEB radio stop'); this.session(null); return; }
      this.url = url; this.state = 1;
      // straight from the broadcaster; the server never carries broadcast audio. HLS: Safari (and newer Chrome) play it
      // in <audio> itself; elsewhere (Android Chrome) hls.js feeds the same element through Media Source, still direct
      if (/\.m3u8(\?|$)/i.test(url) && !nativeHls) {
        if (!(window.Hls && window.Hls.isSupported())) { this.state = 3; fileOut('/home/zeus/.radio/title', enc.encode('error: 이 방송은 이 브라우저에서 열 수 없어요\n')); log.push('WEB radio no HLS player'); return; }
        this.hls = new window.Hls({ enableWorker: false, lowLatencyMode: false }); this.hls.loadSource(url); this.hls.attachMedia(this.el);
        this.hls.on(window.Hls.Events.ERROR, (ev, d) => { if (d.fatal) { this.state = 3; log.push('WEB radio hls ' + d.details); fileOut('/home/zeus/.radio/title', enc.encode('error: \uc18c\ub9ac \uc548 \ub0a8: ' + d.details + '\n')); } });
        log.push('WEB radio hls.js');
      } else this.el.src = url;
      const p = this.el.play(); if (p && p.catch) p.catch((e) => { this.state = 3; log.push('WEB radio play refused ' + e.name);
        fileOut('/home/zeus/.radio/title', enc.encode(e.name === 'NotAllowedError' ? 'error: \uc18c\ub9ac \uc548 \ub0a8: 눌러서 재생하세요\n' : 'error: \uc18c\ub9ac \uc548 \ub0a8: ' + e.name + ' ' + e.message + '\n')); });
      log.push('WEB radio play ' + url.slice(0, 80));
      const pl = readMain('/home/zeus/.radio/player'); this.name = pl ? dec.decode(pl).split('\n')[2] || '' : ''; this.session('');
      const peek = () => TRY ? Promise.resolve() : fetch('relay/radio/title?url=' + encodeURIComponent(url)).then(r => r.ok ? r.text() : '').then((t) => {
        if (t && this.url === url && this.state !== 3) { fileOut('/home/zeus/.radio/title', enc.encode(t + '\n')); this.session(t); } }).catch(() => {});
      setTimeout(peek, 1500); this.titleT = setInterval(peek, 30000);
    },
    // the phone's media controls (lock screen, notification): the station and its song, not the page title; play/pause/stop
    session(song) {
      const ms = navigator.mediaSession; if (!ms || typeof MediaMetadata === 'undefined') return;
      if (song === null) { ms.metadata = null; ms.playbackState = 'none'; return; }
      const st = this.name || 'Zeus Radio', i = song ? song.indexOf(' - ') : -1;
      ms.metadata = new MediaMetadata({ title: song ? (i > 0 ? song.slice(i + 3) : song) : st, artist: song ? (i > 0 ? song.slice(0, i) + ' \u00b7 ' + st : st) : 'Zeus Radio',
        album: 'Zeus Radio', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      ms.playbackState = 'playing'; log.push('WEB radio session ' + (song ? song.slice(0, 60) : st));
      if (!this.hooked) { this.hooked = true;
        const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
        set('pause', () => { if (this.el) this.el.pause(); ms.playbackState = 'paused'; });
        set('play', () => { if (this.el && this.url) { this.el.play().catch(() => {}); ms.playbackState = 'playing'; } });
        set('stop', () => { this.cmd(false, ''); }); }
    } };

  function getSync(url, body) {   // bytes of a same-origin request, blocking (Reader's loader is a foreground program)
    const x = new XMLHttpRequest(); x.open(body ? 'POST' : 'GET', url, false); x.overrideMimeType('text/plain; charset=x-user-defined');
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.send(body || null); const t = x.responseText, b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 0xff;
    return { status: x.status, bytes: b };
  }
  // the page text for Ask, numbered by block as readpage's OUT.txt ("[n] text"; the answer's [n] scroll the page there)
  const docText = (doc) => { const i = doc.indexOf('\nb\n'); if (i < 0) return ''; const B = doc.slice(i + 3).split('\n');
    return B.map((l, k) => { const f = l.split('\t'), c = l[0], t = (c === 'H' || c === 'L' ? f.slice(2) : c === 'I' ? f.slice(5) : c === 'R' || c === 'A' ? f.slice(2) : f.slice(1)).join(' ');
      return t.replace(/\x01\d+\x02|[\x01-\x03]/g, '').replace(/\x1f/g, ' ').trim() ? '[' + (k + 1) + '] ' + t.replace(/\x01\d+\x02|[\x01-\x03]/g, '').replace(/\x1f/g, ' ').trim() : ''; }).filter(Boolean).join('\n'); };
  // ---- ZeusOs programs as WASI modules (tools/weblite/build-wasi.sh): one instance per run, like a process; files are
  // the page's (the main module's ramfs), TCP is a ciphertext pipe (relay /relay/pipe), all blocking like on ZeusOs ----
  const progs = {}, PROG = {"rtui": "rtui.ccd167eaf2.js"};   // PROG: the build's hashed program names (stamp.py fills it), so the service worker caches them
  function progModule(name) {
    if (progs[name]) return progs[name];
    const r = getSync('prog/' + (PROG[name] || name + '.wasm')); if (r.status !== 200) throw new Error(name + ' is not here');
    return (progs[name] = new WebAssembly.Module(r.bytes));
  }
  const pstr = (p) => { const q = temp(enc.encode(p)); return q; };
  function mainPath(p) { const b = enc.encode(p), q = W.web_alloc(b.length + 1); view().set(b, q); view()[q + b.length] = 0; return q; }
  function readMain(path) { const np = W.web_alloc(4), dp = W.web_file_get(mainPath(path), np); return dp ? view().slice(dp, dp + new Int32Array(W.memory.buffer, np, 1)[0]) : null; }
  function writeMain(path, bytes) { const bp = W.web_buf(bytes.length + 1); view().set(bytes, bp); return W.web_save_file(mainPath(path), bp, bytes.length); }
  // opts: env {NAME: value} (environ_get), onOut(bytes, fd) streams stdout/stderr instead of collecting them,
  // reactor (no _start: the caller drives the exports; spawn returns { inst, finish }).
  function runProgram(name, argv, stdin, opts) {
    const o = opts || {}, mod = progModule(name); let mem, out = [], err = [], exit = 0;
    const envv = Object.entries(o.env || {}).map(([k, v]) => enc.encode(k + '=' + v + '\0'));
    const M = () => new DataView(mem.buffer), B = () => new Uint8Array(mem.buffer), S = (p, n) => dec.decode(new Uint8Array(mem.buffer, p, n));
    const fds = { 0: { data: stdin || new Uint8Array(0), pos: 0 }, 1: { out: true }, 2: { out: true }, 3: { dir: '/' } }; let nextFd = 4;
    const abs = (dirfd, p) => { const base = (fds[dirfd] && fds[dirfd].dir) || '/'; const parts = []; for (const x of ((p.startsWith('/') ? '' : base + '/') + p).split('/')) { if (!x || x === '.') continue; if (x === '..') parts.pop(); else parts.push(x); } return '/' + parts.join('/'); };
    const stat = (path) => { const np = W.web_alloc(4); const t = W.web_stat(mainPath(path), np); return { type: t, size: new Int32Array(W.memory.buffer, np, 1)[0] }; };
    const flush = (f) => { if (f.path && f.dirty) { writeMain(f.path, f.data.subarray(0, f.len)); f.dirty = false; } };
    const grow = (f, n) => { if (n > f.data.length) { const d = new Uint8Array(Math.max(n, f.data.length * 2, 4096)); d.set(f.data.subarray(0, f.len)); f.data = d; } };
    const pipes = {};
    const wasi = {
      args_sizes_get(c, sz) { const a = argv.map(x => enc.encode(x + '\0')); M().setUint32(c, a.length, true); M().setUint32(sz, a.reduce((n, x) => n + x.length, 0), true); return 0; },
      args_get(pv, buf) { let o = buf; argv.forEach((x, i) => { const b = enc.encode(x + '\0'); B().set(b, o); M().setUint32(pv + 4 * i, o, true); o += b.length; }); return 0; },
      environ_sizes_get(c, sz) { M().setUint32(c, envv.length, true); M().setUint32(sz, envv.reduce((n, x) => n + x.length, 0), true); return 0; },
      environ_get(pv, buf) { let p = buf; envv.forEach((b, i) => { B().set(b, p); M().setUint32(pv + 4 * i, p, true); p += b.length; }); return 0; },
      fd_renumber(a, b) { if (!fds[a]) return 8; fds[b] = fds[a]; delete fds[a]; return 0; },
      path_remove_directory(dirfd, p, pl) { return W.web_unlink(mainPath(abs(dirfd, S(p, pl))), 1) ? 55 : 0; },
      clock_time_get(id, prec, tp) { M().setBigUint64(tp, BigInt(Math.round((id === 0 ? Date.now() : performance.now()) * 1e6)), true); return 0; },
      random_get(p, n) { crypto.getRandomValues(new Uint8Array(mem.buffer, p, n)); return 0; },
      proc_exit(c) { exit = c; throw { exit: c }; },
      fd_prestat_get(fd, p) { if (fd !== 3) return 8; M().setUint8(p, 0); M().setUint32(p + 4, 1, true); return 0; },
      fd_prestat_dir_name(fd, p, n) { if (fd !== 3) return 8; B()[p] = 47; return 0; },
      fd_fdstat_get(fd, p) { const f = fds[fd]; if (!f) return 8; M().setUint8(p, f.out ? 2 : f.dir ? 3 : 4); M().setUint16(p + 2, 0, true); M().setBigUint64(p + 8, 0xffffffffn, true); M().setBigUint64(p + 16, 0xffffffffn, true); return 0; },
      fd_fdstat_set_flags() { return 0; },
      fd_write(fd, iov, n, nw) { const f = fds[fd]; if (!f) return 8; let t = 0;
        for (let i = 0; i < n; i++) { const p = M().getUint32(iov + 8 * i, true), l = M().getUint32(iov + 8 * i + 4, true), b = new Uint8Array(mem.buffer, p, l);
          if (f.out) { if (o.onOut) o.onOut(b.slice(), fd); else (fd === 2 ? err : out).push(b.slice()); } else { if (f.append) f.pos = f.len; grow(f, f.pos + l); f.data.set(b, f.pos); f.pos += l; f.len = Math.max(f.len, f.pos); f.dirty = true; } t += l; }
        M().setUint32(nw, t, true); return 0; },
      fd_read(fd, iov, n, nr) { const f = fds[fd]; if (!f || f.out) return 8; const len = f.len !== undefined ? f.len : f.data.length; let t = 0;
        for (let i = 0; i < n; i++) { const p = M().getUint32(iov + 8 * i, true), l = M().getUint32(iov + 8 * i + 4, true), k = Math.min(l, len - f.pos); if (k <= 0) break; B().set(f.data.subarray(f.pos, f.pos + k), p); f.pos += k; t += k; if (k < l) break; }
        M().setUint32(nr, t, true); return 0; },
      fd_filestat_get(fd, out) { const f = fds[fd]; if (!f) return 8; new Uint8Array(mem.buffer, out, 64).fill(0);
        M().setUint8(out + 16, f.out ? 2 : f.dir ? 3 : 4); M().setBigUint64(out + 24, 1n, true); M().setBigUint64(out + 32, BigInt(f.len || 0), true); return 0; },
      fd_seek(fd, off, wh, np) { const f = fds[fd]; if (!f || f.out) return 70; const len = f.len !== undefined ? f.len : f.data.length; const o = Number(off);
        f.pos = wh === 0 ? o : wh === 1 ? f.pos + o : len + o; M().setBigUint64(np, BigInt(f.pos), true); return 0; },
      fd_close(fd) { const f = fds[fd]; if (!f) return 8; const was = f.dirty; flush(f); if (was && o.onSave && f.path && f.len) o.onSave(f.path, f.data.slice(0, f.len)); delete fds[fd]; return 0; },
      fd_sync(fd) { const f = fds[fd]; if (!f) return 8; flush(f); return 0; },   // VAULT-MOBILE: zcloud.c writes the merged vault next to the old one (fsync, then rename)
      path_open(dirfd, df, p, pl, of, rb, ri, ff, fdp) { const path = abs(dirfd, S(p, pl)), st = stat(path);
        if (of & 2) { if (st.type !== 2) return 54; fds[nextFd] = { dir: path }; M().setUint32(fdp, nextFd++, true); return 0; }
        if (!st.type && !(of & 1)) return 44; if (st.type && (of & 4)) return 20; if (st.type === 2) return 31;
        const data = (of & 8) || !st.type ? new Uint8Array(0) : readMain(path) || new Uint8Array(0);
        const f = { path, data, len: data.length, pos: 0, dirty: !st.type || !!(of & 8), append: !!(ff & 1) }; fds[nextFd] = f; flush(f);
        M().setUint32(fdp, nextFd++, true); return 0; },
      path_filestat_get(dirfd, fl, p, pl, out) { const st = stat(abs(dirfd, S(p, pl))); if (!st.type) return 44;
        new Uint8Array(mem.buffer, out, 64).fill(0); M().setUint8(out + 16, st.type === 2 ? 3 : 4); M().setBigUint64(out + 24, 1n, true); M().setBigUint64(out + 32, BigInt(st.size), true); return 0; },
      fd_readdir(fd, buf, buflen, cookie, nused) { const f = fds[fd]; if (!f || !f.dir) return 8; let used = 0, after = Number(cookie); const nb = W.web_alloc(300), tp = W.web_alloc(4), pb = mainPath(f.dir);   // TRY-BIGAPPS: the page's folder, entry by entry (the cookie is the entry's id)
        for (;;) { const id = W.web_dir_next(pb, after, nb, 300, tp); if (!id) break; const name = enc.encode(dec.decode(new Uint8Array(W.memory.buffer, nb, 300).subarray(0, new Uint8Array(W.memory.buffer, nb, 300).indexOf(0)))), ty = new Int32Array(W.memory.buffer, tp, 1)[0];
          const rec = new Uint8Array(24 + name.length), dv = new DataView(rec.buffer); dv.setBigUint64(0, BigInt(id), true); dv.setBigUint64(8, BigInt(id), true); dv.setUint32(16, name.length, true); dv.setUint8(20, ty); rec.set(name, 24);
          const room = buflen - used; if (room <= 0) break; B().set(rec.subarray(0, Math.min(room, rec.length)), buf + used); used += Math.min(room, rec.length); if (rec.length > room) break; after = id; }
        M().setUint32(nused, used, true); return 0; },
      path_create_directory(dirfd, p, pl) { W.web_mkdir(mainPath(abs(dirfd, S(p, pl)))); return 0; },
      path_unlink_file(dirfd, p, pl) { return W.web_unlink(mainPath(abs(dirfd, S(p, pl))), 0) ? 44 : 0; },
      path_rename(fd1, p1, l1, fd2, p2, l2) { const to = abs(fd2, S(p2, l2)), a = mainPath(abs(fd1, S(p1, l1))), b = mainPath(to); const bad = W.web_rename(a, b); if (!bad && o.onSave) { const bytes = readMain(to); if (bytes) o.onSave(to, bytes); } return bad ? 44 : 0; },
    };
    let httpBody = null, codeBody = null;
    const zeus = {   // TCP for zeus_tls (tools/weblite/wasi/zt_web.h): blocking requests to the pipe relay
      // Browser on lite (web.wasm): one GET through the stateless fetch relay (public addresses only); meta = "status\ttype\tfinal url"
      http(up, un, mp, mcap) { if (name !== 'web') return -13; const u = S(up, un); brSeen.add(u);
        let r = brCache.take(u), how = 'cache';
        if (!r) { how = 'net'; const t0 = performance.now(), x = new XMLHttpRequest(); x.open('GET', 'relay/fetch?url=' + encodeURIComponent(u), false); x.overrideMimeType('text/plain; charset=x-user-defined');
          try { x.send(); } catch (e) { return -5; }
          r = { st: x.status === 200 ? +(x.getResponseHeader('X-Status') || 0) : x.status, ct: x.getResponseHeader('X-Type') || '', fin: x.getResponseHeader('X-Final-Url') || u, body: bytesOf(x.responseText), ok: x.status === 200 };
          brNet.n++; brNet.ms += performance.now() - t0; brDisk.put(u, r); }
        httpBody = r.body;
        const meta = enc.encode(r.st + '\t' + r.ct + '\t' + r.fin + '\0');
        new Uint8Array(mem.buffer, mp, Math.min(mcap, meta.length)).set(meta.subarray(0, mcap)); if (meta.length > mcap) new Uint8Array(mem.buffer)[mp + mcap - 1] = 0;
        log.push('WEB browse ' + u.slice(0, 80) + ' ' + (r.ok ? 200 : r.st) + ' ' + httpBody.length + ' ' + how);
        return r.ok ? httpBody.length : -5; },
      // LITE-BR-SPEED: the URLs the engine will ask for (NUL-separated), fetched side by side by the relay into brCache
      batch(lp, ln) { if (name !== 'web') return 0; return brBatch(S(lp, ln).split('\0').filter(Boolean)); },
      batch_start(lp, ln) { if (name !== 'web') return 0; return brBatchAsync(S(lp, ln).split('\0').filter(Boolean)); },
      batch_ready() { return brAsync ? 0 : 1; },
      log(lp, ln) { if (name === 'web') log.push('WEB page ' + S(lp, ln).slice(0, 200)); },
      cached(up, un) { return name === 'web' && brCache.has(S(up, un)) ? 1 : 0; },
      // LITE-SPEED: the engine's compiled page scripts (QuickJS bytecode), kept in memory and in IndexedDB between visits
      code_get(kp, kn) { if (name !== 'web') return -1; const b = brCode.get(S(kp, kn)); codeBody = b || null; return b ? b.length : -1; },
      code_take(dst) { if (codeBody) new Uint8Array(mem.buffer, dst, codeBody.length).set(codeBody); codeBody = null; },
      code_put(kp, kn, dp, dn) { if (name === 'web') brCode.put(S(kp, kn), new Uint8Array(mem.buffer, dp, dn).slice()); },
      http_take(dst) { if (httpBody) new Uint8Array(mem.buffer, dst, httpBody.length).set(httpBody); httpBody = null; },
      // the keyring (call 0x1A0, tools/weblite/shim_vault.c): only the vault program; its pointers are in its memory
      vault(op, a, b, c) { if (name !== 'vault') return -38n; progMem = mem; try { return W.web_vault_call(op, a >>> 0, b >>> 0, c >>> 0); } finally { progMem = null; } },
      // VAULT-MOBILE (docs/contracts/VAULT-FILE.md): the vault program's only network — its one file on the owner's zcloud, through
      // the page's server (relay /relay/zcloud adds the phone's device account; the bytes are the KDBX ciphertext both ways)
      zc(mp, ml, wp, wl, ep, el, bp, bl, dp, dcap) { if (name !== 'vault') return -13; zcBody = null;
        const x = new XMLHttpRequest(); x.open('POST', 'relay/zcloud?m=' + encodeURIComponent(S(mp, ml)) + '&f=' + encodeURIComponent(S(wp, wl)), false);
        x.overrideMimeType('text/plain; charset=x-user-defined'); if (el) x.setRequestHeader('X-Zc-Extra', btoa(S(ep, el)));
        try { x.send(bl ? new Uint8Array(mem.buffer, bp, bl).slice() : null); } catch (e) { log.push('WEB zcloud ' + S(mp, ml) + ' no answer'); return -5; }
        const st = +(x.getResponseHeader('X-Zc-Status') || 0); if (!st) { log.push('WEB zcloud ' + S(mp, ml) + ' relay ' + x.status); return -5; }
        zcBody = bytesOf(x.responseText); const d = enc.encode((x.getResponseHeader('X-Zc-Date') || '') + '\0');
        new Uint8Array(mem.buffer, dp, Math.min(dcap, d.length)).set(d.subarray(0, dcap));
        log.push('WEB zcloud ' + S(mp, ml) + ' ' + S(wp, wl) + ' ' + st + ' ' + zcBody.length); return st; },   // method, status, byte count — never the bytes
      zc_len() { return zcBody ? zcBody.length : 0; },
      zc_take(dst) { if (zcBody) new Uint8Array(mem.buffer, dst, zcBody.length).set(zcBody); zcBody = null; },
      zc_ready() { if (name !== 'vault') return 0; if (zcReady === null) { const x = new XMLHttpRequest(); x.open('GET', 'relay/zcloud/state', false);
        try { x.send(); zcReady = x.status === 200 && /"on":\s*true/.test(x.responseText) ? 1 : 0; } catch (e) { zcReady = 0; } log.push('WEB zcloud door ' + (zcReady ? 'on' : 'off')); } return zcReady; },
      // the vault program gets no other network on a phone
      pipe_open(h, hl, port) { if (name === 'vault') { log.push('WEB pipe refused for vault'); return -13; } const r = getSync('relay/pipe/open', JSON.stringify({ host: S(h, hl), port })); let j = {}; try { j = JSON.parse(dec.decode(r.bytes)); } catch (e) { /* */ }
        if (!j.id) { log.push('WEB pipe refused ' + (j.error || r.status)); return r.status === 403 ? -13 : -111; } const k = Object.keys(pipes).length + 5; pipes[k] = j.id; return k; },
      pipe_send(k, p, n) { const id = pipes[k]; if (!id) return -9; const x = new XMLHttpRequest(); x.open('POST', 'relay/pipe/send?id=' + id, false); x.send(new Uint8Array(mem.buffer, p, n).slice()); return x.status === 200 ? n : -32; },
      pipe_recv(k, p, n, wait) { const id = pipes[k]; if (!id) return -9;
        const x = new XMLHttpRequest(); x.open('POST', 'relay/pipe/recv?id=' + id + '&max=' + n + '&wait=' + wait, false); x.overrideMimeType('text/plain; charset=x-user-defined'); x.send();
        if (x.status !== 200) return -104; const t = x.responseText; if (!t.length) return x.getResponseHeader('X-Pipe-End') ? 0 : -110;
        const b = new Uint8Array(mem.buffer, p, t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 0xff; return t.length; },
      pipe_close(k) { const id = pipes[k]; if (!id) return; delete pipes[k]; const x = new XMLHttpRequest(); x.open('POST', 'relay/pipe/close?id=' + id, false); x.send(); },
    };
    const inst = new WebAssembly.Instance(mod, { wasi_snapshot_preview1: wasi, zeus }); mem = inst.exports.memory;
    const finish = () => { for (const f of Object.values(fds)) flush(f); for (const k of Object.keys(pipes)) zeus.pipe_close(+k); };
    if (o.reactor) { if (inst.exports._initialize) inst.exports._initialize(); return { inst, finish }; }
    try { inst.exports._start(); } catch (e) { if (!(e && e.exit !== undefined)) { out.push(enc.encode(name + ': ' + e + '\n')); exit = 70; } }
    finish();
    const join = (l) => { const a = new Uint8Array(l.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of l) { a.set(b, o); o += b.length; } return a; };
    return { exit, out: join(out), err: dec.decode(join(err)) };
  }

  // ---- the Terminal's programs (tools/weblite/shim_term.c): WASI reactors, output straight to the screen ----
  // `lua FILE` / `lua -e CODE` run to the end (cmd); `lua` alone keeps its instance and gets the keys (repl_feed).
  let session = null;
  const termEnv = (cwd) => ({ PWD: cwd, HOME: '/home/zeus', USER: 'zeus', TERM: 'xterm-256color', LANG: 'ko_KR.UTF-8' });
  let tob = 0, tobN = 0;   // its own buffer: the key text that caused the output may still be in temp()'s scratch
  const termOut = (b) => { if (b.length > tobN) { tobN = Math.max(4096, b.length); tob = W.web_alloc(tobN); } view().set(b, tob); W.web_term_out(tob, b.length); };
  function termSpawn(line, cwd) {
    const w = words(line), t = performance.now(), fresh = !progs[w[0]];
    try { const p = runProgram(w[0], w, null, { env: termEnv(cwd), onOut: termOut, reactor: true });
      if (fresh) log.push('WEB term loaded ' + w[0] + ' ' + Math.round(performance.now() - t) + ' ms');
      return p; }
    catch (e) { termOut(enc.encode(w[0] + ': ' + (e.message || e) + '\n')); log.push('WEB term failed ' + w[0] + ' ' + e); return null; }
  }
  const trap = (e) => { if (e && e.exit !== undefined) return e.exit; termOut(enc.encode('\n' + e + '\n')); return 70; };
  // ---- the Browser on lite (tools/weblite/browser.c): ZeusOs's engine as prog/web.wasm, one instance kept ----
  // ---- LITE-BR-SPEED: files for the engine, many per request. brCache: what /relay/batch brought (and pages' files of
  // this visit, 10 minutes), taken by zeus.http instead of a request; brMem: per page, the files its last load asked for
  // (localStorage), so a page seen before comes back with its scripts' files in the first batch ----
  const bytesOf = (t) => { const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 0xff; return b; };
  const brCache = { m: new Map(), bytes: 0, max: 32 << 20,
    put(u, r) { this.drop(u); r.at = performance.now(); this.m.set(u, r); this.bytes += r.body.length; while (this.bytes > this.max && this.m.size) this.drop(this.m.keys().next().value); },
    drop(u) { const r = this.m.get(u); if (r) { this.bytes -= r.body.length; this.m.delete(u); } },
    has(u) { const r = this.m.get(u); if (r && performance.now() - r.at > 600000) { this.drop(u); r.at = 0; } return !!(r && r.at) || brDisk.m.has(u); },
    take(u) { return this.has(u) ? (this.m.get(u) || brDisk.get(u)) : null; } };
  // LITE-SPEED: files whose address names their content (a hash in the name: main.c26be2ec.js, ?v=1a2b3c4d…) never change under
  // that address — kept in IndexedDB between visits, as a browser's cache keeps them, so a page seen before does not download its
  // scripts and style sheets again (m.naver: 2-4 MB). Read into memory at start (the engine asks synchronously); ≤ 40 MB.
  const brImmutable = (u) => /\.(m?js|css|woff2?|ttf)([?#]|$)/i.test(u) && /[./_\-=~][0-9a-f]{8,}([./_\-&]|$)|[./_\-][0-9a-z]*\d[0-9a-z]*[a-z][0-9a-z]*\.(m?js|css)|[?&]v(er|ersion)?=[\w.\-]{4,}/i.test(u.split('#')[0]);
  const brDisk = { m: new Map(), bytes: 0, max: 40 << 20, db: null, hits: 0,
    get(u) { const r = this.m.get(u); if (r) { this.hits++; this.m.delete(u); this.m.set(u, r); } return r || null; },
    put(u, r) { if (!r.ok || r.st !== 200 || this.m.has(u) || r.body.length > (6 << 20) || !brImmutable(u)) return;
      const v = { st: r.st, ct: r.ct, fin: r.fin, body: r.body, ok: true }; this.m.set(u, v); this.bytes += v.body.length;
      while (this.bytes > this.max && this.m.size) { const k = this.m.keys().next().value; this.bytes -= this.m.get(k).body.length; this.m.delete(k); if (this.db) try { this.db.transaction('f', 'readwrite').objectStore('f').delete(k); } catch (e) { /* */ } }
      if (this.db) try { this.db.transaction('f', 'readwrite').objectStore('f').put(v, u); } catch (e) { /* quota: memory only */ } } };
  try { const rq = indexedDB.open('zeus-web-files', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('f');
    rq.onsuccess = () => { const db = rq.result, t0 = performance.now(), c = db.transaction('f').objectStore('f').openCursor();
      c.onsuccess = () => { const r = c.result; if (r) { if (!brDisk.m.has(r.key) && r.value && r.value.body) { brDisk.m.set(r.key, r.value); brDisk.bytes += r.value.body.length; } r.continue(); }
        else { brDisk.db = db; log.push('WEB browser file cache ' + brDisk.m.size + ' files ' + brDisk.bytes + ' bytes ' + Math.round(performance.now() - t0) + ' ms'); } }; }; }
  catch (e) { log.push('WEB browser file cache off ' + e); }
  const brSeen = new Set(), brNet = { n: 0, ms: 0, batches: 0, batch_ms: 0 };
  // LITE-SPEED: compiled scripts (the engine's key names the source, its address and the engine build, so another build
  // reads none). Read from IndexedDB once at start (async; the first page may come before it), written behind; ≤ 48 MB.
  const brCode = { m: new Map(), bytes: 0, max: 48 << 20, hits: 0, saves: 0, db: null,
    get(k) { const b = this.m.get(k); if (b) { this.hits++; this.m.delete(k); this.m.set(k, b); } return b; },
    put(k, b) { if (this.m.has(k)) return; this.m.set(k, b); this.bytes += b.length; this.saves++; this.trim();
      if (this.db) try { this.db.transaction('code', 'readwrite').objectStore('code').put(b, k); } catch (e) { /* quota: memory only */ } },
    trim() { while (this.bytes > this.max && this.m.size) { const k = this.m.keys().next().value; this.bytes -= this.m.get(k).length; this.m.delete(k);
      if (this.db) try { this.db.transaction('code', 'readwrite').objectStore('code').delete(k); } catch (e) { /* */ } } } };
  try { const rq = indexedDB.open('zeus-web-code', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('code');
    rq.onsuccess = () => { const db = rq.result, t0 = performance.now(), c = db.transaction('code').objectStore('code').openCursor();
      c.onsuccess = () => { const r = c.result; if (r) { if (!brCode.m.has(r.key)) { brCode.m.set(r.key, r.value); brCode.bytes += r.value.length; } r.continue(); }
        else { brCode.db = db; brCode.trim(); log.push('WEB browser bytecode cache ' + brCode.m.size + ' scripts ' + brCode.bytes + ' bytes ' + Math.round(performance.now() - t0) + ' ms'); } }; }; }
  catch (e) { log.push('WEB browser bytecode cache off ' + e); }
  // A/B for measuring (localStorage brcfg = {"slice":16,"bc":1,"dry":1}); the defaults are the fast path
  const brCfg = (() => { try { return JSON.parse(localStorage.getItem('brcfg') || '{}'); } catch (e) { return {}; } })();
  function brTake(urls, b, t0, relayMs, how) {   // one /relay/batch answer: per URL "status TAB type TAB final TAB len LF" + bytes
    let o = 0, got = 0;
    for (const u of urls) {
      let e = o; while (e < b.length && b[e] !== 10) e++; if (e >= b.length) break;
      const [st, ct, fin, n] = dec.decode(b.subarray(o, e)).split('\t'), len = +n; o = e + 1;
      const body = b.slice(o, o + len); o += len;
      const rr = { st: +st, ct, fin, body: +st ? body : new Uint8Array(0), ok: !!+st }; brCache.put(u, rr); brDisk.put(u, rr); if (+st) got++;   // a failure is kept too (not asked again every tick)
    }
    brNet.batches++; brNet.batch_ms += performance.now() - t0;
    log.push('WEB batch ' + got + '/' + urls.length + ' ' + b.length + ' bytes ' + Math.round(performance.now() - t0) + ' ms (relay ' + (relayMs || '?') + ' ms)' + how);
    return got;
  }
  function brBatch(urls) {
    urls = [...new Set(urls)].filter(u => !brCache.has(u)).slice(0, 128); if (!urls.length) return 0;
    const t0 = performance.now(), x = new XMLHttpRequest(); x.open('POST', 'relay/batch', false); x.overrideMimeType('text/plain; charset=x-user-defined');
    x.setRequestHeader('Content-Type', 'application/json');
    try { x.send(JSON.stringify({ urls })); } catch (e) { log.push('WEB batch failed ' + e); return 0; }
    if (x.status !== 200) { log.push('WEB batch ' + x.status); return 0; }
    return brTake(urls, bytesOf(x.responseText), t0, x.getResponseHeader('X-Batch-Ms'), '');
  }
  // LITE-SPEED: the same without holding the page (the engine polls brFlying.size through zeus.batch_ready)
  const brFlying = new Set(); let brAsync = 0;
  window.__brbusy = () => brAsync;   // tests: a batch still coming (tests/weblite_litespeed.py waits for it)
  function brBatchAsync(urls) {
    urls = [...new Set(urls)].filter(u => !brCache.has(u) && !brFlying.has(u)).slice(0, 128); if (!urls.length) return 0;
    const t0 = performance.now(), x = new XMLHttpRequest(); x.open('POST', 'relay/batch'); x.responseType = 'arraybuffer';
    x.setRequestHeader('Content-Type', 'application/json'); for (const u of urls) brFlying.add(u); brAsync++;
    const end = () => { for (const u of urls) brFlying.delete(u); brAsync--; };
    x.onload = () => { if (x.status === 200) brTake(urls, new Uint8Array(x.response), t0, x.getResponseHeader('X-Batch-Ms'), ' async'); else log.push('WEB batch ' + x.status); end(); };
    x.onerror = x.onabort = x.ontimeout = () => { log.push('WEB batch failed (async)'); end(); };
    try { x.send(JSON.stringify({ urls })); } catch (e) { log.push('WEB batch failed ' + e); end(); return 0; }
    return urls.length;
  }
  const brMem = { key: (u) => 'brmem:' + u.split('#')[0],
    get(u) { try { return JSON.parse(localStorage.getItem(this.key(u)) || '[]'); } catch (e) { return []; } },
    set(u, list) { try { localStorage.setItem(this.key(u), JSON.stringify(list.slice(0, 127)));
      const ks = Object.keys(localStorage).filter(k => k.startsWith('brmem:')); if (ks.length > 40) localStorage.removeItem(ks[0]); } catch (e) { /* full: no memory */ } } };
  let brOpened = '', brLater = [];
  const brPic = (u) => /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)([?#]|$)/i.test(u) || /pstatic\.net\/common\/|phinf|thumb/.test(u);
  const brJs = (u) => /\.m?js([?#]|$)/i.test(u) || !/\.(css|json|woff2?|ttf)([?#]|$)/i.test(u);   // what is not a style sheet / data / font: script-like
  function brRemember(e) {   // the files this page asked for, for the next visit (the address typed and where it ended)
    const fin = brStr(e, e.br_url()), list = [...brSeen].filter(x => x !== brOpened && x !== fin);
    brMem.set(brOpened, list); if (fin && fin !== brOpened) brMem.set(fin, list);
  }
  let brp = null;
  const br = () => { if (!brp) { const t = performance.now(); brp = runProgram('web', ['web'], null, { reactor: true }); let ft = 0;
      if (fontPack) { writeMain('/tmp/.web-uisans', new Uint8Array(fontPack)); const e = brp.inst.exports, u = enc.encode('/tmp/.web-uisans'), q = e.br_buf(u.length + 1);
        new Uint8Array(e.memory.buffer).set(u, q); new Uint8Array(e.memory.buffer)[q + u.length] = 0; ft = e.br_font(q); }   // the desktop's faces: crisp text at the phone's density
      log.push('WEB browser engine ' + Math.round(performance.now() - t) + ' ms fonts=' + ft); } return brp.inst.exports; };
  const brStr = (e, p) => { if (!p) return ''; const m = new Uint8Array(e.memory.buffer); let k = p; while (m[k]) k++; return dec.decode(m.slice(p, k)); };
  const brPut = (s, out, cap) => { const b = enc.encode(s).subarray(0, cap - 1); view().set(b, out); view()[out + b.length] = 0; return b.length; };
  imports.env.br_open = (p, n, width) => { try { const e = br(), url = str(p, n), u = enc.encode(url), q = e.br_buf(u.length + 1); new Uint8Array(e.memory.buffer).set(u, q); new Uint8Array(e.memory.buffer)[q + u.length] = 0;
    const t = performance.now(); brCache.drop(url); brSeen.clear(); Object.assign(brNet, { n: 0, ms: 0, batches: 0, batch_ms: 0 });
    // a page seen before: it and its style sheets in one request; its scripts on the first tick (the first screen needs none),
    // its pictures as the engine asks (LITE-SPEED: the 75-file batch with pictures held m.naver's first screen 4.8 s)
    const mem0 = brMem.get(url), first = mem0.filter(u => !brPic(u) && !brJs(u)); brLater = mem0.filter(u => !brPic(u) && brJs(u));
    let warm = 0; if (mem0.length) { brBatch([url, ...first]); warm = first.filter(u => brCache.has(u)).length + 1; }
    if (e.br_option) { e.br_option(0, brCfg.slice ?? 16); e.br_option(1, brCfg.bc ?? 1); e.br_option(2, brCfg.dry !== 0 && warm >= 2 ? 1 : 0); }   // LITE-SPEED
    if (e.br_viewport) e.br_viewport(Math.round(innerHeight));
    const h = e.br_open(q, width), ms = Math.round(performance.now() - t);
    brOpened = url; brRemember(e);
    log.push('WEB browser open ' + url.slice(0, 80) + ' h=' + h + ' ' + ms + ' ms at=' + Math.round(performance.now()));
    log.push('WEB browser net single=' + brNet.n + ' ' + Math.round(brNet.ms) + ' ms, batches=' + brNet.batches + ' ' + Math.round(brNet.batch_ms) + ' ms, cpu ' + Math.round(ms - brNet.ms - brNet.batch_ms) + ' ms' + (e.br_note ? '; ' + brStr(e, e.br_note()) : ''));
    return h; }
    catch (x) { log.push('WEB browser failed ' + x); return -3; } };
  imports.env.br_paint = (dst, stride, w, h, scroll, k) => { try { const e = br(), fp = e.br_paint(w, h, scroll, k); if (!fp) return;   // device pixels, laid out at w / k CSS px
    const src = new Uint32Array(e.memory.buffer, fp, w * h), mem32 = new Uint32Array(W.memory.buffer);
    for (let y = 0; y < h; y++) mem32.set(src.subarray(y * w, y * w + w), (dst >> 2) + y * stride); } catch (x) { log.push('WEB browser paint ' + x); } };
  imports.env.br_link = (x, y, out, cap) => { if (!brp) return 0; const e = br(); return brPut(brStr(e, e.br_link(x, y)), out, cap); };
  imports.env.br_click = (x, y, out, cap) => { if (!brp) return 0; const e = br(), q = e.br_buf(2048); const k = e.br_click(x, y, q, 2048); if (k === 1) brPut(brStr(e, q), out, cap); return k; };
  imports.env.br_tick = () => { if (!brp) return 0; const e = br(), pend = e.br_pending ? e.br_pending() : 0; if (e.br_next() < 0 && !pend) return 0;
    if (e.br_phase && e.br_phase() === 1 && brLater.length) { brBatchAsync(brLater); brLater = []; }   // LITE-SPEED: a page seen before: its scripts in one request, beside the engine's own
    const t = performance.now(), n = brSeen.size; let r = 0; try { r = e.br_tick(); } catch (x) { log.push('WEB browser tick failed ' + x + ' ' + String(x && x.stack || '').split('\n').slice(1, 6).map(s => s.trim()).join(' < ')); brp = null; return 1; }   // a trap must not stop the screen's loop
    const note = e.br_tick_note ? brStr(e, e.br_tick_note()) : ''; if (note) log.push('WEB browser ' + note + ' (' + Math.round(performance.now() - t) + ' ms) at=' + Math.round(performance.now()));
    if (brSeen.size !== n) brRemember(e);
    return r | (e.br_next() === 0 || (e.br_pending && e.br_pending()) ? 2 : 0) | (e.br_navigate && e.br_navigate() ? 4 : 0); };   // 4: the page moves itself (br_info 3)   // LITE-SPEED: 2 = more work now (the next frame, not 100 ms later)
  imports.env.br_height = () => brp ? br().br_height() : 0;   // LITE-SPEED: the page grows as its scripts and pictures come
  imports.env.br_info = (what, out, cap) => { if (!brp) return brPut('', out, cap); const e = br(); return brPut(brStr(e, what === 0 ? e.br_title() : what === 1 ? e.br_url() : what === 3 ? (e.br_navigate ? e.br_navigate() : 0) : e.br_status()), out, cap); };
  // LITE-REMOTE (tools/weblite/remote.js, built in front of this file): 빠른 모드 — the same br_* calls answered by the server's engine
  if (window.LiteRemote) window.LiteRemote.install(imports.env, { log, view, str, brPut, dpr, canvas, W: () => W, fb: () => [rgbaPtr, cw, ch], tap: (x, y) => input('tap', () => { W.web_pointer(x, y, 0, 0); W.web_pointer(x, y, 2, 0); }) });
  imports.env.term_run = (p, n, c, cn) => {
    const pr = termSpawn(str(p, n), str(c, cn)); if (!pr) return 127;
    let rc; try { rc = pr.inst.exports.cmd ? pr.inst.exports.cmd() : (pr.inst.exports._start(), 0); } catch (e) { rc = trap(e); } pr.finish(); return rc;   // a reactor (lua) or a command (vault)
  };
  imports.env.term_start = (p, n, c, cn) => {
    const pr = termSpawn(str(p, n), str(c, cn)); if (!pr) return 127;
    try { if (pr.inst.exports.repl_start()) { pr.finish(); return 1; } } catch (e) { trap(e); pr.finish(); return 1; }
    session = pr; return 0;
  };
  imports.env.term_input = (p, n) => {
    if (!session) return; const s = session, b = view().slice(p, p + n); let done, rc = 0;
    try { const q = s.inst.exports.repl_buf(b.length); new Uint8Array(s.inst.exports.memory.buffer, q, b.length).set(b); done = s.inst.exports.repl_feed(q, b.length); }
    catch (e) { rc = trap(e); done = 1; }
    if (done) { session = null; s.finish(); W.web_term_end(rc); }
  };

  let progMem = null;   // the vault program's memory while its keyring call runs (prog_in / prog_out)
  let zcBody = null, zcReady = null;   // VAULT-MOBILE: the last zcloud answer's bytes (the KDBX ciphertext), and whether this server has the door
  imports.env.prog_in = (to, from, n) => { if (!progMem || from + n > progMem.buffer.byteLength) return -1; view().set(new Uint8Array(progMem.buffer, from, n), to); return 0; };
  imports.env.prog_out = (to, from, n) => { if (!progMem || to + n > progMem.buffer.byteLength) return -1; new Uint8Array(progMem.buffer, to, n).set(view().subarray(from, from + n)); return 0; };
  // ---- CAM-01 camera (docs/contracts/CAMERA.md): getUserMedia -> a hidden <video> -> a canvas at the app's size -> 0xAARRGGBB ----
  // Phones: a front and a back camera (facingMode user / environment, `ideal` so a phone with one camera still opens);
  // iOS: playsinline + muted (no full-screen player), works in the home-screen app too; the stream stops when the page is
  // hidden and comes back when it is shown (privacy, and iOS stops it anyway). Logs: sizes and counts only.
  const cam = { video: null, stream: null, state: 0, want: null, last: -1, ts: 0, t0: 0, cv: null, cx: null, list: null };
  const camMobile = () => /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const camOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
  function camList() {
    if (!camOk()) return [];
    if (camMobile()) return [['\uc804\uba74 \uce74\uba54\ub77c', 1], ['\ud6c4\uba74 \uce74\uba54\ub77c', 2]];   // 전면 카메라, 후면 카메라
    if (cam.list && cam.list.length) return cam.list.map((d, i) => [d.label || '\uce74\uba54\ub77c ' + (i + 1), 0]);
    return [['\uce74\uba54\ub77c', 0]];   // 카메라
  }
  function camStop() {
    if (cam.stream) cam.stream.getTracks().forEach(t => t.stop());
    cam.stream = null; if (cam.video) { cam.video.srcObject = null; }
  }
  function camStart() {
    const o = cam.want, ls = camList(), facing = camMobile() ? (ls[o.dev] && ls[o.dev][1] === 2 ? 'environment' : 'user') : null;
    const v = { width: { ideal: o.w }, height: { ideal: o.h }, frameRate: { ideal: o.fps } };
    if (facing) v.facingMode = { ideal: facing }; else if (cam.list && cam.list[o.dev] && cam.list[o.dev].deviceId) v.deviceId = { exact: cam.list[o.dev].deviceId };
    cam.state = 1; cam.last = -1; cam.t0 = performance.now();
    log.push('WEB camera open ' + (facing || 'device ' + o.dev) + ' ' + o.w + 'x' + o.h + '@' + o.fps);
    navigator.mediaDevices.getUserMedia({ video: v, audio: false }).then((s) => {
      if (cam.want !== o) { s.getTracks().forEach(t => t.stop()); return; }
      cam.stream = s;
      const el = cam.video || (cam.video = document.createElement('video'));
      el.setAttribute('playsinline', ''); el.setAttribute('muted', ''); el.playsInline = true; el.muted = true; el.autoplay = true;
      el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
      if (!el.parentNode) document.body.append(el);
      el.onloadedmetadata = () => { if (cam.want === o) { cam.state = 2; log.push('WEB camera on ' + el.videoWidth + 'x' + el.videoHeight); } };
      el.srcObject = s; const pl = el.play(); if (pl && pl.catch) pl.catch(() => {});
      if (!camMobile() && !cam.list) navigator.mediaDevices.enumerateDevices().then((d) => { cam.list = d.filter(x => x.kind === 'videoinput'); }).catch(() => {});
    }).catch((e) => { if (cam.want !== o) return; cam.state = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 3 : 4; log.push('WEB camera refused ' + (e && e.name)); });
  }
  document.addEventListener('visibilitychange', () => {
    if (!cam.want) return;
    if (document.hidden) { camStop(); cam.state = 1; log.push('WEB camera paused (page hidden)'); }
    else camStart();
  });
  // PHONE-APP-ZEUSOS (gui_platform.h gui_phone_*): the Phone app's call path on lite.
  // ① Inside the ZEUS iPhone app its bridge dials (zeus-phone docs/ZEUSOS-APP.md: {op:'dial', number} / hangup / answer — CallKit +
  //   zeuspbx) and its `zeushost` {ev:'call'} events say how the call goes.
  // ② Elsewhere this page is the phone: zeuspbx's own signalling (pbx/src/zeuspbx.c: wss <exchange>/ws — reg, call, answer, ice, bye,
  //   busy, offline) and the browser's WebRTC carry the call; the sound goes device to device (DTLS-SRTP), the exchange sees text only.
  //   The key is asked here in a box of the page (never in the wasm, never logged, kept in this page's memory only).
  // Nothing is pretended: no bridge and no exchange address = 0, the app says why. State: 0 none 1 calling 2 ringing 3 incoming 4 connected 5 held 6 ended.
  const phone = { state: 0, peer: '', why: '', call: null, key: '', acct: '', base: '', ws: null, pc: null, local: null, offer: null, pend: [], audio: null };
  const phoneLog = (s) => log.push('WEB phone ' + s);
  const phoneBr = () => window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zeus;
  const phonePost = (m) => { try { const r = phoneBr().postMessage(m); if (r && r.then) r.then((a) => { if (a && a.ok === false) { phone.state = 6; phone.why = 'refused'; phoneLog('bridge refused ' + m.op); } }, () => { phone.state = 6; phone.why = 'refused'; phoneLog('bridge failed ' + m.op); }); return true; } catch (e) { return false; } };
  if (phoneBr()) { try { Promise.resolve(phoneBr().postMessage({ op: 'caps' })).then((c) => { phone.call = !!(c && c.call); phoneLog('caps call=' + (phone.call ? 1 : 0)); }, () => { phone.call = false; }); } catch (e) { phone.call = false; } }
  const bridgeOn = () => phoneBr() && phone.call !== false;
  window.addEventListener('zeushost', (e) => { const d = e.detail || {}; if (d.ev !== 'call' || !bridgeOn()) return;
    phone.state = ({ incoming: 3, ringing: 2, connected: 4, held: 5, ended: 6 })[d.state] || phone.state; phone.peer = String(d.peer || '').slice(0, 32); phone.why = ''; phoneLog('event ' + d.state); });
  const pSend = (o) => { if (phone.ws && phone.ws.readyState === 1) phone.ws.send(JSON.stringify(o)); };
  const pEnd = (why, tell) => {   // the call ends here: the peer is told (bye) when we end it, tracks stop, the line stays registered
    if (tell && phone.peer) pSend({ t: 'bye', to: phone.peer });
    if (phone.pc) { try { phone.pc.close(); } catch (e) { /* closed */ } } phone.pc = null; phone.offer = null; phone.pend = [];
    if (phone.local) { for (const t of phone.local.getTracks()) t.stop(); } phone.local = null;
    if (phone.state && phone.state !== 6) { phone.state = 6; phone.why = why; phoneLog('ended ' + why); }
  };
  const pNewPC = async () => {
    const pc = phone.pc = new RTCPeerConnection({ iceServers: [] });
    pc.onicecandidate = (e) => { if (e.candidate) pSend({ t: 'ice', to: phone.peer, c: e.candidate }); };
    pc.ontrack = (e) => { if (!phone.audio) { phone.audio = document.createElement('audio'); phone.audio.autoplay = true; phone.audio.setAttribute('playsinline', ''); document.body.append(phone.audio); }
      phone.audio.srcObject = e.streams[0]; phone.audio.play().catch(() => {}); phoneLog('track'); };
    pc.onconnectionstatechange = () => { phoneLog('pc ' + pc.connectionState); if (pc === phone.pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) pEnd('net', true); };
    try { phone.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { pEnd('nomic', false); throw e; }
    for (const t of phone.local.getTracks()) pc.addTrack(t, phone.local);
  };
  const pFlush = () => { for (const c of phone.pend) phone.pc.addIceCandidate(c).catch(() => {}); phone.pend = []; };
  const pMsg = async (m) => {
    if (m.t === 'reg') { if (!m.ok) { phone.key = ''; pEnd('key', false); phone.state = 6; phone.why = 'key'; phoneLog('reg refused'); return; } phoneLog('reg ok ' + m.acct); if (phone.next) { const n = phone.next; phone.next = null; n(); } return; }
    if (m.t === 'replaced') { phone.key = ''; pEnd('replaced', false); return; }
    if (m.t === 'offline' && m.to === phone.peer) { pEnd('offline', false); return; }
    if (m.t === 'busy' && m.from === phone.peer) { pEnd('busy', false); return; }
    if (m.t === 'bye' && m.from === phone.peer) { pEnd('bye', false); return; }
    if (m.t === 'answer' && phone.pc && m.from === phone.peer) { await phone.pc.setRemoteDescription(m.sdp); pFlush(); phone.state = 4; phoneLog('connected ' + m.from); return; }
    if (m.t === 'ice' && m.from === phone.peer) { if (phone.pc && phone.pc.remoteDescription) phone.pc.addIceCandidate(m.c).catch(() => {}); else phone.pend.push(m.c); return; }
    if (m.t === 'call') { if (phone.pc || phone.offer) { pSend({ t: 'busy', to: m.from }); return; } phone.peer = String(m.from).slice(0, 32); phone.offer = m.sdp; phone.state = 3; phone.why = ''; phoneLog('incoming ' + m.from); }
  };
  const pConnect = (then) => {   // one registered line per page; a dropped line comes back on the next call
    if (phone.ws && phone.ws.readyState === 1) { then(); return; }
    phone.next = then;
    let ws; try { ws = phone.ws = new WebSocket(phone.base.replace(/^http/, 'ws') + '/ws'); } catch (e) { pEnd('net', false); phone.state = 6; phone.why = 'net'; return; }
    ws.onopen = () => ws.send(JSON.stringify({ t: 'reg', acct: phone.acct, key: phone.key }));
    ws.onclose = () => { if (ws === phone.ws) { phone.ws = null; if (phone.next || (phone.state && phone.state < 6)) { phone.next = null; pEnd('net', false); phone.state = 6; phone.why = 'net'; } } };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } pMsg(m); };
  };
  const pDial = (to) => pConnect(async () => {
    try { await pNewPC(); const o = await phone.pc.createOffer(); await phone.pc.setLocalDescription(o); pSend({ t: 'call', to, sdp: phone.pc.localDescription }); phone.state = 2; phoneLog('ringing ' + to); }
    catch (e) { phoneLog('dial failed ' + e.name); }
  });
  const pKeyBox = (acct, then) => {   // the exchange's key: typed by the person into this box, kept in memory, never in the wasm or a log
    const d = document.createElement('div'); d.id = 'zphone-key';
    d.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);font:15px -apple-system,system-ui,sans-serif';
    const ko = (document.documentElement.lang || 'ko').startsWith('ko');
    d.innerHTML = '<form style="background:#fff;border-radius:14px;padding:18px;width:min(320px,86vw);box-shadow:0 8px 30px rgba(0,0,0,.25)"><div style="font-weight:600;margin-bottom:6px"></div><div style="color:#666;font-size:13px;margin-bottom:10px"></div><input type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;font-size:16px;padding:8px;border:1px solid #ccc;border-radius:8px"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button"></button><button type="submit" style="font-weight:600"></button></div></form>';
    const f = d.querySelector('form'), [t1, t2] = f.querySelectorAll('div'), inp = f.querySelector('input'), [no, ok] = f.querySelectorAll('button');
    t1.textContent = ko ? '교환기 열쇠' : 'Exchange key'; t2.textContent = (ko ? '내 번호 ' : 'My number ') + acct + (ko ? ' — 열쇠는 이 페이지 메모리에만 둡니다.' : ' — the key stays in this page’s memory only.');
    no.textContent = ko ? '취소' : 'Cancel'; ok.textContent = ko ? '걸기' : 'Call';
    no.onclick = () => { d.remove(); pEnd('cancel', false); phone.state = 6; phone.why = 'cancel'; phoneLog('key cancelled'); };
    f.onsubmit = (e) => { e.preventDefault(); const k = inp.value; d.remove(); if (!k) { phone.state = 6; phone.why = 'cancel'; return; } phone.key = k; phoneLog('key given'); then(); };
    document.body.append(d); setTimeout(() => inp.focus(), 0);
  };
  imports.env.phone_can = (kind) => kind === 2 ? (bridgeOn() ? 1 : 0) : kind === 3 ? (window.RTCPeerConnection && window.WebSocket && navigator.mediaDevices ? 1 : 0) : 0;
  imports.env.phone_call = (np, nn, up, un) => { const num = str(np, nn), url = str(up, un);
    if (bridgeOn() && phonePost({ op: 'dial', number: num })) { phone.state = 1; phone.peer = num; phone.why = ''; phoneLog('dial bridge'); return 2; }
    let u; try { u = new URL(url); } catch (e) { return 0; }
    const acct = u.searchParams.get('acct') || '', to = u.searchParams.get('to') || '';
    if (!/^https?:$/.test(u.protocol) || !/^[A-Za-z0-9_-]{1,32}$/.test(acct) || !/^[A-Za-z0-9_-]{1,32}$/.test(to) || phone.pc) return 0;
    const base = (u.origin + u.pathname).replace(/\/+$/, '');
    if (base !== phone.base || acct !== phone.acct) { if (phone.ws) { try { phone.ws.close(); } catch (e) { /* gone */ } } phone.ws = null; phone.key = phone.base === base && acct === phone.acct ? phone.key : ''; }
    phone.base = base; phone.acct = acct; phone.peer = to; phone.state = 1; phone.why = '';
    phoneLog('dial page ' + base.replace(/^https?:\/\//, '') + ' to ' + to);
    if (phone.key) pDial(to); else pKeyBox(acct, () => pDial(to));
    return 3; };
  imports.env.phone_hangup = () => { if (bridgeOn() && phone.state && phone.state < 6) return phonePost({ op: 'hangup' }) ? (phone.state = 6, phone.why = 'hangup', 1) : 0;
    if (phone.pc || phone.offer || (phone.state && phone.state < 6)) { if (phone.offer && !phone.pc) pSend({ t: 'busy', to: phone.peer }); pEnd('hangup', !!phone.pc); return 1; } return 0; };
  imports.env.phone_answer = () => { if (phone.state !== 3) return 0;
    if (bridgeOn()) return phonePost({ op: 'answer' }) ? 1 : 0;
    if (!phone.offer) return 0;
    (async () => { try { await pNewPC(); await phone.pc.setRemoteDescription(phone.offer); pFlush(); const a = await phone.pc.createAnswer(); await phone.pc.setLocalDescription(a);
      pSend({ t: 'answer', to: phone.peer, sdp: phone.pc.localDescription }); phone.offer = null; phone.state = 4; phoneLog('answered ' + phone.peer); } catch (e) { phoneLog('answer failed ' + e.name); } })();
    return 1; };
  imports.env.phone_state = (out, cap) => { const b = enc.encode(phone.peer + (phone.why ? '\t' + phone.why : '')).slice(0, cap - 1); view().set(b, out); view()[out + b.length] = 0; return phone.state; };
  window.__zphoneRx = async () => { if (!phone.pc) return -1; let n = 0; (await phone.pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') n += r.bytesReceived || 0; }); return n; };   // tests: sound bytes that came in
  window.__zphone = () => ({ state: phone.state, peer: phone.peer, why: phone.why, reg: !!(phone.ws && phone.ws.readyState === 1), audio: !!(phone.audio && phone.audio.srcObject) });   // tests: the state only, never the key
  imports.env.cam_list = (out, cap) => { const b = enc.encode(camList().map(([n, f]) => n.replace(/[\t\n]/g, ' ') + '\t' + f + '\n').join('')).slice(0, cap); view().set(b, out); return b.length; };
  imports.env.cam_open = (dev, w, h, fps) => { if (!camOk()) return -19; camStop(); cam.want = { dev, w, h, fps }; camStart(); return 0; };
  imports.env.cam_close = () => { cam.want = null; camStop(); cam.state = 0; log.push('WEB camera off'); };
  imports.env.cam_info = (what) => what === 0 ? (cam.video ? cam.video.videoWidth : 0) : what === 1 ? (cam.video ? cam.video.videoHeight : 0) : cam.ts;
  imports.env.cam_frame = (ptr, w, h) => {
    if (cam.state === 3) return -13; if (cam.state === 4) return -19; if (cam.state !== 2) return 0;
    const el = cam.video; if (!el || el.readyState < 2 || !el.videoWidth) return 0;
    if (el.currentTime === cam.last) return 0;   // the same frame as last time
    cam.last = el.currentTime;
    if (!cam.cv) { cam.cv = document.createElement('canvas'); cam.cx = cam.cv.getContext('2d', { willReadFrequently: true }); }
    if (cam.cv.width !== w || cam.cv.height !== h) { cam.cv.width = w; cam.cv.height = h; }
    const vw = el.videoWidth, vh = el.videoHeight; let sw = vw, sh = vh, sx = 0, sy = 0;   // centre crop to w:h (a phone held upright gives a tall stream)
    if (vw * h > w * vh) { sw = Math.round(vh * w / h); sx = (vw - sw) >> 1; } else { sh = Math.round(vw * h / w); sy = (vh - sh) >> 1; }
    cam.cx.drawImage(el, sx, sy, sw, sh, 0, 0, w, h);
    const src = new Uint32Array(cam.cx.getImageData(0, 0, w, h).data.buffer), dst = new Uint32Array(W.memory.buffer, ptr, w * h);
    for (let i = 0; i < src.length; i++) { const v = src[i]; dst[i] = (v & 0xff00ff00) | ((v & 0xff) << 16) | ((v >>> 16) & 0xff); }   // RGBA bytes -> 0xAARRGGBB
    cam.ts = (performance.now() - cam.t0) * 1000; return 1;
  };
  imports.env.share = (np, nn, d, n) => {   // 「휴대폰 사진첩에 저장」: the share sheet (iOS: 이미지 저장), else a download
    const name = str(np, nn), ext = (name.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',   // LITE-OFFICE-MENU: documents too
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', hwpx: 'application/hwp+zip', hwp: 'application/x-hwp' };
    const file = new File([view().slice(d, d + n)], name, { type: MIME[ext] || 'application/octet-stream' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { log.push('WEB share sheet ' + name + ' ' + n); navigator.share({ files: [file] }).then(() => log.push('WEB share done'), (e) => log.push('WEB share ' + (e && e.name))); return 1; }
    } catch (e) { /* not in a tap */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); log.push('WEB share download ' + name + ' ' + n); return 2;
  };
  imports.env.random = (p, n) => { crypto.getRandomValues(new Uint8Array(W.memory.buffer, p, n)); };

  // Kim's head on the phone: the relay's model list as zeus's models.tsv (Settings > Models), a pick in ~/.zeus/head
  // ZEUS-DOTDIR: the folder was ~/.murmuro; models.c (gui_dotdir_migrate, in the wasm) moves it on first use, and until then this reads the old head
  const ZDIR = '/home/zeus/.zeus', OLD_ZDIR = '/home/zeus/.murmuro', KIM_API = 'relay/kim';
  // LITE-ZEUS-2 (owner 11-03 「직접 체크해서 구조를 알려 줄 수도」): what this browser honestly reports, for the lite Zeus's check — cores,
  // a memory hint, this site's storage use, the screen. Anything the browser does not say stays out (the head says 「?」).
  async function browserFacts() {
    const f = [];
    try { if (navigator.hardwareConcurrency) f.push('CPU 코어 ' + navigator.hardwareConcurrency); } catch (e) { /* not given */ }
    try { if (navigator.deviceMemory) f.push('메모리 약 ' + navigator.deviceMemory + 'GB(브라우저가 알려 준 대략값)'); } catch (e) { /* not given */ }
    try { const e = await navigator.storage.estimate(); if (e && e.quota) f.push('이 사이트 저장 공간 ' + Math.round(e.usage / 1048576) + 'MB 씀 / 쓸 수 있는 ' + Math.round(e.quota / 1048576) + 'MB'); } catch (e) { /* not given */ }
    try { f.push('화면 ' + screen.width + 'x' + screen.height + ' · 배율 ' + (window.devicePixelRatio || 1)); } catch (e) { /* not given */ }
    try { f.push('브라우저 ' + (/iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC') + ' · 언어 ' + navigator.language); } catch (e) { /* not given */ }
    return f.length ? '\n브라우저가 알려 준 것(휴대폰판): ' + f.join(' · ') : '';
  }
  let kimAbort = null, kimSeq = 0;   // KIM-UX-2: the chat's answer in flight (its stop button aborts it)
  function kimModel() {   // the picked id when the pick is one of the relay's (the head file: api TAB model TAB kind)
    const h = readMain(ZDIR + '/head') || readMain(OLD_ZDIR + '/head'); if (!h) return '';
    const f = dec.decode(h).split('\n')[0].split('\t'); return f[0] === KIM_API && f[1] ? f[1] : '';
  }
  function runSync(line) {
    const w = words(line);
    if (line.includes('zeus.py --list-models')) {   // the relay's order; every row free and usable (no keys on the phone)
      const r = getSync('relay/kim/models'); let ids = [], heads = []; try { const j = JSON.parse(dec.decode(r.bytes)); ids = j.models || []; heads = j.heads || []; } catch (e) { /* not JSON */ }
      if (!ids.length) return 'zeus: the model list did not come (' + r.status + ')\n';
      W.web_mkdir(mainPath(ZDIR));
      // LITE-HEADS-2: kind TAB id TAB api TAB plain words TAB ok TAB name TAB measured numbers TAB plain words in English TAB m (ZEUS-APP-2: a main row)
      // (models.c shows the name and the plain words in the OS language, the numbers only under 「기술 자세히」)
      const cl = (x) => String(x || '').replace(/[\t\n]/g, ' ');
      const row = (m, i) => { const h = heads.find(x => x.id === m) || {}; return ['kilo', m, KIM_API, cl(h.say || (i ? '\ubb34\ub8cc' : '\uae30\ubcf8')), '1', cl(h.name || m), cl(h.tech), cl(h.say_en || (i ? 'Free' : 'Default')), h.main || (!heads.length && !i) ? 'm' : ''].join('\t'); };   // 무료 / 기본; ZEUS-APP-2: field 8 m = shown before 「더 보기」
      writeMain(ZDIR + '/models.tsv', enc.encode(ids.map(row).join('\n') + '\n'));
      log.push('WEB models ' + ids.length); return '';
    }
    if (w[0] === 'readpage' && w[1] === '--img') {   // fetched and decoded at once (stb_image in the wasm), as readpage does
      const out = w[2], table = docImages.get(out) || {}; let ok = 0;
      for (const id of w.slice(3)) {
        if (!table[id]) continue;
        const r = getSync('relay/img?url=' + encodeURIComponent(table[id]));
        const none = new Uint8Array(12); new DataView(none.buffer).setUint32(0, 0x474d495a, true);   // NEWS-IMG: width 0 = could not be had (the app says so; never a grey box)
        if (r.status !== 200) { fileOut(out + '.img' + id, none); log.push('WEB img ' + id + ' failed ' + r.status); continue; }
        fileOut('/tmp/.web-in', r.bytes);
        if (W.web_decode(put(enc.encode('/tmp/.web-in')), put(enc.encode(out + '.img' + id)), 720, 960) === 0) ok++;
        else { fileOut(out + '.img' + id, none); log.push('WEB img ' + id + ' undecodable ' + r.bytes.length + ' bytes'); }
      }
      return 'readpage: images=' + ok + '\n';
    }
    if (w[0] === 'readpage') {
      const url = w[w.length - 2], out = w[w.length - 1], t = performance.now();
      const r = getSync('relay/news/read?url=' + encodeURIComponent(url)); const doc = dec.decode(r.bytes);
      const table = {}; for (const l of doc.split('\n')) if (l.startsWith('i\t')) { const [, n, u] = l.split('\t'); table[n] = u; }
      docImages.set(out, table);
      fileOut(out, r.bytes); fileOut(out + '.txt', enc.encode(docText(doc)));
      log.push('WEB read ' + url.slice(0, 80) + ' ' + r.bytes.length + ' bytes ' + Math.round(performance.now() - t) + ' ms');
      return 'readpage: status=' + r.status + ' bytes=' + r.bytes.length + '\n';
    }
    if (w[0] === 'zeus' && w[1] === '--ask-page') {   // Ask about this page: Kim's relay with the page's text
      const np = W.web_alloc(4), dp = W.web_file_get(temp(enc.encode(w[2])), np), n = new Int32Array(W.memory.buffer, np, 1)[0];
      const page = dp ? dec.decode(view().slice(dp, dp + n)).slice(0, 24000) : '', q = w.slice(3).join(' ');   // READER-FIX: the whole numbered page, the Ask system message on the relay
      const r = getSync('relay/kim', JSON.stringify(kimModel() ? { q, page, model: kimModel() } : { q, page })); if (kimModel()) log.push('WEB kim ask model=' + kimModel()); let j = {}; try { j = JSON.parse(dec.decode(r.bytes)); } catch (e) { /* not JSON */ }
      return (j.answer || j.error || '지금은 답할 수 없어요') + '\n';
    }
    if (w[0] === 'mail') {   // Mail (mail.c): the ZeusOs program itself, TLS on the phone
      let stdin = null, to = null; const lt = w.indexOf('<'); if (lt >= 0) { stdin = readMain(w[lt + 1]); w.splice(lt, 2); }
      const gt = w.indexOf('>'); if (gt >= 0) { to = w[gt + 1]; w.splice(gt, 2); }
      const t = performance.now(), r = runProgram('mail', w, stdin); log.push('WEB mail ' + w.slice(1).join(' ').slice(0, 60) + ' exit=' + r.exit + ' ' + Math.round(performance.now() - t) + ' ms ' + r.err.slice(0, 120).replace(/\n/g, ' '));
      const fail = r.exit ? '[exit ' + r.exit + ']\n' : '';   // as the ZeusOs shell reports a failed program (mail.c reads it)
      if (to) { writeMain(to, r.out); return r.err + fail; }   // `> FILE` as the shell does; the capture gets stderr
      return dec.decode(r.out) + r.err + fail;
    }
    if (w[0] === 'u' && w[1] === 'pdfview') {   // SAMPLES-NEW: the PDF app's reader (user/cmds/pdfview.c as prog/pdfview.wasm), the page's files
      const t = performance.now(), r = runProgram('pdfview', w.slice(1)); log.push('WEB pdfview ' + w[2] + ' exit=' + r.exit + ' ' + Math.round(performance.now() - t) + ' ms');
      return dec.decode(r.out) + r.err + (r.exit ? '[exit ' + r.exit + ']\n' : '');
    }
    if (w[0] === 'vault') {   // the Vault app (vault.c): the ZeusOs program itself; Argon2id and the KDBX file on the phone
      const t = performance.now(), r = runProgram('vault', w); log.push('WEB vault ' + w.slice(1).join(' ').slice(0, 40) + ' exit=' + r.exit + ' ' + Math.round(performance.now() - t) + ' ms');
      return dec.decode(r.out) + r.err + (r.exit ? '[exit ' + r.exit + ']\n' : '');
    }
    return 'not here: ' + line + '\n';
  }

  // Mail's account sheet: address and password (and the servers, guessed from the address). Writes the files `mail setup`
  // writes: ~/.mail/account (key value lines) and ~/.mail/secret (0600 on ZeusOs) — here only in this phone's IndexedDB.
  const KNOWN = { 'gmail.com': ['imap.gmail.com', 'smtp.gmail.com'], 'naver.com': ['imap.naver.com', 'smtp.naver.com'], 'daum.net': ['imap.daum.net', 'smtp.daum.net'],
    'outlook.com': ['outlook.office365.com', 'smtp.office365.com'], 'hotmail.com': ['outlook.office365.com', 'smtp.office365.com'], 'icloud.com': ['imap.mail.me.com', 'smtp.mail.me.com'] };
  // MAIL-02 on the phone: pick the provider, type the address and the password; the servers come from the address; the
  // account is checked (a real IMAP login through the pipe) before it is kept, and each failure is said plainly in Korean.
  const HINT = { 'gmail.com': 'Gmail 은 계정 암호가 아니라 앱 비밀번호가 필요해요: Google 계정 › 보안 › 2단계 인증 › 앱 비밀번호.',
    'naver.com': '네이버 메일 › 환경설정 › POP3/IMAP 설정에서 IMAP 을 켜세요. 2단계 인증이면 애플리케이션 비밀번호를 쓰세요.',
    'daum.net': '다음 메일 › 설정 › IMAP/POP3 에서 IMAP 을 켜세요. 2단계 인증이면 앱 비밀번호를 쓰세요.',
    'icloud.com': 'iCloud 는 앱 암호가 필요해요: appleid.apple.com › 로그인 및 보안 › 앱 암호.', 'outlook.com': 'Outlook 은 2단계 인증이면 앱 암호를 쓰세요.' };
  const domOf = (addr) => (addr.split('@')[1] || '').trim().toLowerCase(), alias = { 'googlemail.com': 'gmail.com', 'hanmail.net': 'daum.net', 'me.com': 'icloud.com', 'mac.com': 'icloud.com', 'hotmail.com': 'outlook.com', 'live.com': 'outlook.com' };
  function mailWhy(err, d) {   // the mail program's last line -> what to do
    const e = err.toLowerCase(), h = HINT[alias[d] || d] || '';
    if (/login failed|authenticationfailed|invalid credentials|535|534|auth.*(fail|refused)|username and password/.test(e)) return '암호가 맞지 않아요.' + (h ? '\n' + h : '');
    if (/pipe refused|not allowed|address/.test(e) && /pipe/.test(e)) return '이 서버에는 연결할 수 없어요 (공개 메일 서버가 아니에요).';
    if (/resolve|no such host|nxdomain|getaddrinfo|name/.test(e)) return '서버 주소를 찾지 못했어요. 이메일 주소를 확인하거나 서버를 직접 입력하세요.';
    if (/timed out|timeout|refused|unreachable|reset|closed|abort|connect /.test(e)) return '서버에 연결할 수 없어요. 잠시 뒤 다시 하거나 서버 주소를 확인하세요.';
    if (/certificate|x509|tls|ssl/.test(e)) return '서버 인증서를 확인할 수 없어요.';
    return '확인하지 못했어요: ' + err.trim().split('\n').pop().slice(0, 140);
  }
  function mailSheet(edit) {
    const f = document.getElementById('acct'), $ = (n) => f.querySelector('[name=' + n + ']'); f.hidden = false; log.push('WEB mail account sheet' + (edit ? ' edit' : ''));
    const addr = $('addr'), pw = $('pw'), imap = $('imap'), smtp = $('smtp'), hint = $('hint'), err = $('err'), ok = $('ok');
    const cur = edit ? dec.decode(readMain('/home/zeus/.mail/account') || new Uint8Array()) : '', val = (k) => ((cur.match(new RegExp('^' + k + ' (.*)$', 'm')) || [])[1] || '');
    $('title').textContent = edit ? '메일 계정' : '메일 계정 추가'; $('remove').hidden = !edit; err.textContent = ''; pw.value = '';
    addr.value = edit ? val('user') : ''; imap.value = edit ? val('imap_host') : ''; smtp.value = edit ? val('smtp_host') : '';
    pw.placeholder = edit ? '암호 (바꿀 때만)' : '암호'; pw.required = !edit;
    const show = () => { const d = domOf(addr.value), k = KNOWN[alias[d] || d]; imap.placeholder = k ? k[0] : d ? 'imap.' + d : '받는 서버 (IMAP, 993)'; smtp.placeholder = k ? k[1] : d ? 'smtp.' + d : '보내는 서버 (SMTP, 465)';
      hint.textContent = HINT[alias[d] || d] || ''; for (const b of f.querySelectorAll('.prov button')) b.classList.toggle('on', !!d && b.dataset.d === (alias[d] || d)); };
    for (const b of f.querySelectorAll('.prov button')) b.onclick = () => { const name = addr.value.split('@')[0]; addr.value = b.dataset.d ? name + '@' + b.dataset.d : name + '@'; show(); addr.focus(); };
    addr.oninput = show; show();
    f.onsubmit = (e) => { e.preventDefault(); const d = domOf(addr.value), k = KNOWN[alias[d] || d];
      if (!d) { err.textContent = '이메일 주소를 확인하세요 (예: name@example.com).'; return; }
      const a = 'imap_host ' + (imap.value.trim() || (k ? k[0] : 'imap.' + d)) + '\nimap_port 993\nsmtp_host ' + (smtp.value.trim() || (k ? k[1] : 'smtp.' + d)) + '\nsmtp_port 465\nuser ' + addr.value.trim() + '\nfrom ' + addr.value.trim() + '\n';
      const oldA = readMain('/home/zeus/.mail/account'), oldS = readMain('/home/zeus/.mail/secret');
      W.web_mkdir(mainPath('/home/zeus/.mail')); writeMain('/home/zeus/.mail/account', enc.encode(a));
      if (pw.value) writeMain('/home/zeus/.mail/secret', enc.encode(pw.value + '\n'));
      err.textContent = ''; ok.textContent = '확인 중…'; ok.disabled = true;
      setTimeout(() => {   // a real login (blocking, as the program is) after the button has repainted
        const t = performance.now(), r = runProgram('mail', ['mail', '-T', '-f', 'INBOX'], null); ok.textContent = '확인'; ok.disabled = false;
        log.push('WEB mail check exit=' + r.exit + ' ' + Math.round(performance.now() - t) + ' ms ' + r.err.slice(0, 120).replace(/\n/g, ' '));
        if (r.exit !== 0) {   // keep what was there before; the sheet stays with the reason
          if (oldA) writeMain('/home/zeus/.mail/account', oldA); else W.web_remove(mainPath('/home/zeus/.mail/account'));
          if (pw.value) { if (oldS) writeMain('/home/zeus/.mail/secret', oldS); else W.web_remove(mainPath('/home/zeus/.mail/secret')); }
          err.textContent = mailWhy(r.err || dec.decode(r.out), d); log.push('WEB mail account refused ' + err.textContent.split('\n')[0]); return;
        }
        pw.value = ''; f.hidden = true; log.push('WEB mail account saved'); W.web_mail_open(); W.web_frame(); }, 30); };
    $('remove').onclick = () => { if (!confirm('이 휴대폰에서 메일 계정과 암호를 지울까요? (메일함 서버의 메일은 그대로입니다)')) return;
      for (const n of ['account', 'secret']) W.web_remove(mainPath('/home/zeus/.mail/' + n)); f.hidden = true; log.push('WEB mail account removed'); W.web_home(); W.web_frame(); };
    $('cancel').onclick = () => { f.hidden = true; err.textContent = ''; if (!edit) W.web_home(); W.web_frame(); };
  }


  // ---- LITE-VMM: the VM Manager's remote facade (tools/weblite/shim_vmm.c) through relay.py /relay/vmm/… ----
  // The host is a ZeusOs machine far away; only the VMs its api_caps names for the relay's key. Files in /tmp only.
  const vmm = { listing: false, es: null, name: '', keys: '', keyName: '', keying: false };
  const vmmTab = (v) => String(v == null ? '' : v).replace(/[\t\n]/g, ' ');
  async function vmmJob(w) {
    const out = (f, t) => fileOut(f, enc.encode(t));
    const json = async (r) => { try { return await r.json(); } catch (e) { return {}; } };
    const why = (r, j) => (j && j.error) ? j.error : r.status === 429 ? '요청이 많아요 — 잠시 뒤에' : r.status === 401 ? '초대 링크로 다시 들어오세요' : 'HTTP ' + r.status;
    if (w[0] === 'list') {
      if (vmm.listing) return; vmm.listing = true;
      try {
        const r = await fetch('relay/vmm/list'); const j = await json(r);
        const label = vmmTab((j.host && j.host.label) || '?');
        if (!r.ok || !j.vms) { out('/tmp/.vmm-host', label + '\t-1\t' + vmmTab(why(r, j)) + '\n'); return; }
        out('/tmp/.vmm-host', label + '\t1\t\n');
        out('/tmp/.vmm-list', j.vms.map(v => [v.name, v.state, v.mem_mb, v.disk || '', v.ip || '-', v.up_s || 0, v.health || '', v.store_disk ? 1 : 0, v.nat ? 1 : 0, v.autostart ? 1 : 0].map(vmmTab).join('\t') + '\n').join(''));
      } catch (e) { out('/tmp/.vmm-host', '?\t-1\t연결이 안 돼요\n'); }
      finally { vmm.listing = false; }
    } else if (w[0] === 'templates') {
      try { const r = await fetch('relay/vmm/templates'); const j = await json(r); if (r.ok && j.templates) out('/tmp/.vmm-tpl', j.templates.map(vmmTab).join('\n') + '\n'); } catch (e) { /* the sheet says none */ }
    } else if (w[0] === 'do' || w[0] === 'create') {
      const body = w[0] === 'do' ? { verb: w[1], name: w[2] } : { name: w[1], template: w[2], mem_mb: +w[3], disk_mb: +w[4] }, t = performance.now();
      let rc = -110, msg = 'no answer from the host';
      try {
        const r = await fetch('relay/vmm/' + w[0], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await json(r);
        if (r.ok && typeof j.rc === 'number') { rc = j.rc; msg = j.message || ''; } else { rc = r.status === 403 ? -13 : r.status === 429 ? -16 : -5; msg = why(r, j); }
      } catch (e) { msg = '연결이 안 돼요'; }
      out('/tmp/.vmm-result', rc + '\t' + vmmTab(msg) + '\n');
      log.push('WEB vmm ' + w[0] + ' ' + (w[0] === 'do' ? w[1] + ' ' + w[2] : w[1]) + ' rc=' + rc + ' ' + Math.round(performance.now() - t) + ' ms');
    } else if (w[0] === 'console') {
      if (vmm.es) vmm.es.close();
      vmm.name = w[1]; const es = vmm.es = new EventSource('relay/vmm/console?name=' + encodeURIComponent(w[1]));
      let first = true;
      es.onmessage = (ev) => {
        if (vmm.es !== es) return;
        let j; try { j = JSON.parse(ev.data); } catch (e) { return; }
        const b = Uint8Array.from(atob(j.b64 || ''), c => c.charCodeAt(0));
        const bp = W.web_buf(b.length + 1); view().set(b, bp); W.web_vmm_feed(bp, b.length, j.reset || first ? 1 : 0);
        if (first) log.push('WEB vmm console ' + w[1] + ' ' + b.length + ' bytes'); first = false;
      };
      es.onerror = () => { if (vmm.es === es && es.readyState === 2) log.push('WEB vmm console closed'); };
    } else if (w[0] === 'size') {
      fetch('relay/vmm/size', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: w[1], cols: +w[2], rows: +w[3] }) }).catch(() => {});
    } else if (w[0] === 'console-off') {
      if (vmm.es) { vmm.es.close(); vmm.es = null; log.push('WEB vmm console off'); }
    } else if (w[0] === 'keys') {   // one POST in flight; keys typed meanwhile go in the next one
      if (vmm.keyName !== w[1]) vmm.keys = '';
      vmm.keyName = w[1]; vmm.keys += w[2] || '';
      if (vmm.keying) return; vmm.keying = true;
      try {
        while (vmm.keys) {
          const hx = vmm.keys.slice(0, 512); vmm.keys = vmm.keys.slice(512);
          const bin = String.fromCharCode(...hx.match(/../g).map(h => parseInt(h, 16)));
          const r = await fetch('relay/vmm/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: vmm.keyName, data_b64: btoa(bin) }) });
          if (!r.ok) { log.push('WEB vmm keys ' + r.status); if (r.status === 429) await new Promise(ok => setTimeout(ok, 1000)); }
        }
      } catch (e) { log.push('WEB vmm keys failed'); }
      finally { vmm.keying = false; }
    }
  }

  // ---- MEDIA-SEED: the sample library (docs/contracts/MEDIA_SEED.md) ----
  // `fetch --samples KIND` (samples.c on ZeusOs) from relay/media/ (behind the same invite gate as the page). Pictures and voice
  // memos are kept whole in the file tree (IndexedDB); a song or a video keeps only its first 64 KiB there (the tags, the length
  // header, the container) and plays from the server address, remembered in localStorage 'zeus-media-links' (path -> url):
  // 75 MB of music in a phone tab's memory is too much. The browser's HTTP cache keeps what was heard.
  const MEDIA_HEAD = 65536, linksKey = 'zeus-media-links';
  const mediaLinks = () => { try { return JSON.parse(localStorage.getItem(linksKey) || '{}'); } catch (e) { return {}; } };
  const mediaUrl = (rel) => 'relay/media/' + rel.split('/').map(encodeURIComponent).join('/');
  const mime = (p) => /\.mp3$/i.test(p) ? 'audio/mpeg' : /\.(mp4|m4v)$/i.test(p) ? 'video/mp4' : /\.mov$/i.test(p) ? 'video/quicktime' : /\.webm$/i.test(p) ? 'video/webm' :
    /\.wav$/i.test(p) ? 'audio/wav' : /\.ogg$/i.test(p) ? 'audio/ogg' : /\.flac$/i.test(p) ? 'audio/flac' : 'application/octet-stream';
  let blobUrl = null;
  function srcOf(path) {   // a sample's server address, else the file's own bytes as a blob
    const l = mediaLinks()[path]; if (l) return l;
    const b = readMain(path); if (!b) return null;
    if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = URL.createObjectURL(new Blob([b], { type: mime(path) })); return blobUrl;
  }
  async function mediaGone(path) {   // a sample the server no longer has (the manifest dropped it): forget the stub, not a user file
    const links = mediaLinks(), url = links[path]; if (!url) return false;
    try { const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-cache' }); if (r.status !== 404) return false; } catch (e) { return false; }   // GET of one byte: serve.py has no HEAD (501)
    delete links[path]; try { localStorage.setItem(linksKey, JSON.stringify(links)); } catch (e) { /* full */ }
    W.web_remove(mainPath(path)); W.web_frame(); log.push('WEB media gone ' + path); return true;
  }
  const media = { el: null, state: 0,
    cmd(play, path, skip) {
      if (!this.el) {
        const a = this.el = new Audio(); a.preload = 'auto';
        a.addEventListener('playing', () => { this.state = 2; log.push('WEB media playing'); });
        a.addEventListener('waiting', () => { if (this.state) this.state = 1; });
        a.addEventListener('ended', () => { this.state = 3; log.push('WEB media ended'); });
        a.addEventListener('error', () => { if (this.state) { this.state = 3; log.push('WEB media error'); if (this.path) mediaGone(this.path); } });
      }
      const a = this.el;
      if (!play) { a.pause(); this.state = 0; log.push('WEB media stop'); return 1; }
      const src = srcOf(path); if (!src) { log.push('WEB media missing ' + path); return 0; }
      if (radio.el && radio.state) radio.cmd(0, '');   // one sound at a time
      this.state = 1; this.path = path; a.src = src;
      if (skip > 0) a.addEventListener('loadedmetadata', () => { a.currentTime = skip; }, { once: true });
      const pr = a.play(); if (pr && pr.catch) pr.catch((e) => { this.state = 3; log.push('WEB media play refused ' + e.name); });
      log.push('WEB media play ' + path + (src.startsWith('blob:') ? ' (file)' : ' (server)') + ' skip=' + skip); return 1;
    } };
  let videoBox = null;
  function showVideo(path) {   // the Video app's file over the page; '' closes it
    if (videoBox) { const v = videoBox.querySelector('video'); v.pause(); v.removeAttribute('src'); v.load(); videoBox.remove(); videoBox = null; }
    if (!path) return 0;
    const src = srcOf(path); if (!src) return 0;
    if (media.el && media.state) media.cmd(0); if (radio.el && radio.state) radio.cmd(0, '');
    const box = videoBox = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:#000;z-index:50;display:flex;align-items:center;justify-content:center';
    const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.autoplay = true; v.src = src; v.style.cssText = 'max-width:100%;max-height:100%';
    const x = document.createElement('button'); x.textContent = '닫기'; x.id = 'video-close';   // 닫기
    x.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top) + 12px);right:12px;font:600 16px system-ui;padding:8px 16px;border:0;border-radius:18px;background:rgba(255,255,255,.85)';
    x.onclick = () => { showVideo(''); log.push('WEB video closed'); };
    v.addEventListener('playing', () => log.push('WEB video playing ' + path));
    v.addEventListener('error', () => { log.push('WEB video error ' + path); mediaGone(path).then((g) => { if (g && videoBox) { const m = document.createElement('div'); m.id = 'video-gone'; m.textContent = '이 영상은 서버에서 빠졌습니다 — 목록에서 지웠어요'; m.style.cssText = 'color:#fff;font:500 16px system-ui;padding:24px;text-align:center'; v.replaceWith(m); } }); });
    box.append(v, x); document.body.append(box); log.push('WEB video open ' + path + (src.startsWith('blob:') ? ' (file)' : ' (server)')); return 1;
  }
  // SAMPLE-VIDEO: on every open (not only on 샘플 받기 or a failed play) the phone squares its sample links with the server's list:
  // a song/video the manifest dropped (the old ZeusOs intro) leaves the list (link + 64 KiB head), one replaced under the same
  // name (VIDEO-03 1080p: a new sha) gets its head again and the new ?v= address. Nothing to do without links; user files untouched.
  async function mediaSync() {
    const links = mediaLinks(), home = '/home/zeus'; if (!Object.keys(links).length) return;
    let rows;
    try { const r = await fetch('relay/media/manifest.tsv', { cache: 'no-store' }); if (!r.ok) return; rows = (await r.text()).split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split('\t')).filter((c) => c.length >= 4); }
    catch (e) { return; }   // offline: keep what the phone has
    if (!rows.length) return;   // an empty or broken list is no reason to forget everything
    const by = new Map(rows.map((c) => [home + '/' + c[1], c])); let dropped = 0, fresh = 0;
    for (const [d, url] of Object.entries(links)) {
      if (!d.startsWith(home + '/')) continue;
      const c = by.get(d);
      if (!c) { delete links[d]; W.web_remove(mainPath(d)); dropped++; log.push('WEB media dropped ' + d); continue; }
      const want = mediaUrl(c[1]) + '?v=' + c[3].slice(0, 8); if (url === want) continue;
      try {
        const r = await fetch(want, { headers: { Range: 'bytes=0-' + (MEDIA_HEAD - 1) } }); if (!r.ok) continue;
        let b = new Uint8Array(await r.arrayBuffer()); if (r.status === 200) b = b.slice(0, MEDIA_HEAD);
        if (writeMain(d, b) < 0) continue;
        links[d] = want; fresh++; log.push('WEB media refreshed ' + d);
      } catch (e) { /* next open */ }
    }
    try { localStorage.setItem(linksKey, JSON.stringify(links)); } catch (e) { /* full */ }
    if (dropped || fresh) W.web_frame();
    log.push('WEB media sync ' + dropped + ' dropped ' + fresh + ' refreshed, ' + rows.length + ' listed, ' + Object.keys(links).length + ' links');
  }
  async function sha256hex(b) { if (!crypto.subtle) return ''; const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b)); return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join(''); }
  async function samples(kind) {
    const home = '/home/zeus', state = home + '/.config/samples/' + kind, say = (t) => writeMain(state, enc.encode(t + '\n'));
    if (TRY) { say('error \uc774 \uccb4\ud5d8\ud310\uc5d0\uc11c\ub294 \uc0d8\ud50c\uc744 \ubc1b\uc9c0 \uc54a\uc544\uc694 (This try build has no sample library)'); return; }   // TRY-SELF: no server
    const t0 = performance.now(); say('get 0 0');
    let rows;
    try {
      const r = await fetch('relay/media/manifest.tsv', { cache: 'no-store' });
      if (!r.ok) { say('error HTTP ' + r.status); log.push('WEB samples ' + kind + ' HTTP ' + r.status); return; }
      const all = (await r.text()).split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split('\t'))
        .filter((c) => c.length >= 4 && !c[1].includes('..') && c[1][0] !== '/');
      rows = all.filter((c) => kind === 'all' || c[0] === kind);
      const keep = new Set(all.map((c) => home + '/' + c[1])), ln = mediaLinks();   // samples the server dropped: away from the phone too
      for (const d of Object.keys(ln)) if (d.startsWith(home + '/') && !keep.has(d)) { delete ln[d]; W.web_remove(mainPath(d)); log.push('WEB samples dropped ' + d); }
      try { localStorage.setItem(linksKey, JSON.stringify(ln)); } catch (e) { /* full */ }
    } catch (e) { say('error ' + e.message); return; }
    const links = mediaLinks(); let done = 0, got = 0;
    for (const c of rows) {
      const [k, rel, bytes, sha] = c, head = k === 'music' || k === 'video', dest = home + '/' + rel, url = mediaUrl(rel) + (head && sha ? '?v=' + sha.slice(0, 8) : '');   // the address carries the manifest's sha: a file replaced under the same name (VIDEO-03 1080p) is fetched again, past the browser's day-long cache
      say('get ' + done + ' ' + rows.length);
      const sp = W.web_alloc(4), ty = W.web_stat(mainPath(dest), sp), have = ty === 1 ? new Int32Array(W.memory.buffer, sp, 1)[0] : -1;
      if (have === (head ? Math.min(+bytes, MEDIA_HEAD) : +bytes) && (!head || links[dest] === url)) { done++; continue; }
      try {
        const r = await fetch(url, head ? { headers: { Range: 'bytes=0-' + (MEDIA_HEAD - 1) } } : {});
        if (!r.ok) throw new Error('HTTP ' + r.status);
        let b = new Uint8Array(await r.arrayBuffer());
        if (head) { if (r.status === 200) b = b.slice(0, MEDIA_HEAD); links[dest] = url; }
        else { if (b.length !== +bytes) throw new Error(b.length + ' of ' + bytes + ' bytes'); const h = await sha256hex(b); if (h && h !== sha) throw new Error('checksum differs'); }
        if (writeMain(dest, b) < 0) throw new Error('cannot save ' + rel);
        done++; got++;
      } catch (e) { say('error ' + e.message); log.push('WEB samples ' + kind + ' failed ' + rel + ' ' + e.message); try { localStorage.setItem(linksKey, JSON.stringify(links)); } catch (x) { /* full */ } return; }
    }
    try { localStorage.setItem(linksKey, JSON.stringify(links)); } catch (e) { /* full */ }
    say('done ' + done + ' ' + got);
    log.push('WEB samples ' + kind + ' ' + done + ' files, ' + got + ' fetched, ' + Math.round(performance.now() - t0) + ' ms');
  }

  // ---- SHOP-01 Shopping: `fetch --shop search SORT OUT QFILE | refresh REQ OUT | status OUT` (user/tls/shop.c), the same files ----
  async function shopGet(path) {   // [status, text]; a failure is the relay's "#error CODE words" line or one made here
    try { const r = await fetch('relay/shop/' + path); const t = await r.text(); return [r.status, r.ok || t.startsWith('#error') ? t : '#error ' + r.status + ' HTTP ' + r.status + '\n']; }
    catch (e) { return [0, '#error net ' + String(e.message || e).slice(0, 80) + '\n']; }
  }
  async function shopJob(a) {
    const t0 = performance.now(), first = (p) => dec.decode(readMain(p) || new Uint8Array(0)).split('\n')[0].trim();
    if (a[0] === 'search') {
      const sort = ['sim', 'asc', 'dsc', 'date'].includes(a[1]) ? a[1] : 'sim', q = first(a[3]);
      let [st, t] = q ? await shopGet('search?q=' + encodeURIComponent(q) + '&sort=' + sort + '&display=40') : [400, '#error SE01 empty query\n'];
      if (st === 200 && !t.startsWith('#shop ')) t = '#error 502 not a shop answer\n';
      fileOut(a[2], enc.encode(t)); log.push('WEB shop search ' + st + ' ' + (t.split('\n').length - 2) + ' rows ' + Math.round(performance.now() - t0) + ' ms');
    } else if (a[0] === 'refresh') {
      const lines = dec.decode(readMain(a[1]) || new Uint8Array(0)).split('\n').filter((l) => l.includes('\t')).slice(0, 100);
      let out = '', failed = 0;
      for (const l of lines) {
        const [pid, words] = l.split('\t'); const [st, t] = await shopGet('search?q=' + encodeURIComponent(words) + '&sort=sim&display=40');
        let price = -1;
        if (st === 200 && t.startsWith('#shop ')) { price = 0; for (const r of t.split('\n').slice(1)) { const c = r.split('\t'); if (c[0] === pid) { price = +c[2] || 0; break; } } } else failed++;
        out += pid + '\t' + price + '\n';
      }
      out += '#done ' + lines.length + ' ' + Math.round(performance.now() - t0) + ' failed=' + failed + '\n';
      fileOut(a[2], enc.encode(out)); log.push('WEB shop refresh ' + lines.length + ' items, ' + failed + ' failed');
    } else if (a[0] === 'status') {
      const [st, t] = await shopGet('status'); fileOut(a[1], enc.encode(st === 200 ? t.trim() + ' rtt=' + Math.round(performance.now() - t0) + '\n' : t));
    }
  }

  // MOBILE-PARITY B: Network (netutil.c) — only what a browser can really measure, as plain `key value` lines in the
  // job's output file: the connection the browser reports, the time to our server (relay/net/ping), a name over
  // DNS-over-HTTPS (Cloudflare, then Google; both answer web pages: CORS), a download from our server (relay/net/speed).
  async function netJob(w, out) {
    const say = (t) => { if (out) fileOut(out, enc.encode(t)); }, ms = (t) => Math.round(performance.now() - t);
    const ping = async () => { const t = performance.now(); try { const r = await fetch('relay/net/ping?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return -1; await r.arrayBuffer(); return ms(t); } catch (e) { return -1; } };
    if (w[0] === 'info') {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection; let o = 'online ' + (navigator.onLine ? 1 : 0) + '\n';
      if (c) { if (c.type) o += 'type ' + c.type + '\n'; if (c.effectiveType) o += 'eff ' + c.effectiveType + '\n'; if (c.downlink != null) o += 'down10 ' + Math.round(c.downlink * 10) + '\n'; if (c.rtt != null) o += 'rtt ' + c.rtt + '\n'; if (c.saveData != null) o += 'save ' + (c.saveData ? 1 : 0) + '\n'; }
      await ping(); const a = [await ping(), await ping(), await ping()].filter(x => x >= 0).sort((x, y) => x - y);   // the first warms the connection
      o += 'relay ' + (a.length ? a[a.length >> 1] : -1) + '\nhost ' + location.host + '\n';
      log.push('WEB netweb info ' + o.trim().split('\n').join(' ')); say(o);
    } else if (w[0] === 'ping') {
      const n = Math.max(1, Math.min(16, +w[1] || 4)); let o = '';
      for (let i = 0; i < n; i++) o += 'rtt ' + await ping() + '\n';
      log.push('WEB netweb ping ' + o.trim().split('\n').join(' ')); say(o);
    } else if (w[0] === 'lookup') {
      const name = String(w[1] || '').trim().replace(/^https?:\/\//, '').split('/')[0].slice(0, 253), t = performance.now();
      if (!/^[A-Za-z0-9.-]+$/.test(name)) { say('err ' + (name ? 'not a name' : 'no name') + '\n'); return; }
      const ask = async (base, type) => { const r = await fetch(base + '?name=' + encodeURIComponent(name) + '&type=' + type, { headers: { accept: 'application/dns-json' }, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
      let o = '', err = '';
      for (const base of ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']) {
        try { const [a, b] = await Promise.all([ask(base, 'A'), ask(base, 'AAAA')]);
          if (a.Status === 3) { o = 'nx 1\n'; break; }
          for (const j of [a, b]) for (const x of (j.Answer || [])) if (x.type === 1 || x.type === 28) o += (x.type === 1 ? 'A ' : 'AAAA ') + x.data + '\n';
          o += 'via ' + base.split('/')[2] + '\n'; err = ''; break;
        } catch (e) { err = String(e.message || e).slice(0, 80); }
      }
      if (err) o = 'err ' + err + '\n';
      o += 'ms ' + ms(t) + '\n'; log.push('WEB netweb lookup ' + name + ' ' + o.trim().split('\n').join(' ')); say(o);
    } else if (w[0] === 'speed') {
      await ping(); const t = performance.now(); let o;
      try { const r = await fetch('relay/net/speed?n=4000000&t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); const b = await r.arrayBuffer(); o = 'bytes ' + b.byteLength + '\nms ' + Math.max(1, ms(t)) + '\n'; }
      catch (e) { o = 'err ' + String(e.message || e).slice(0, 80) + '\n'; }
      log.push('WEB netweb speed ' + o.trim().split('\n').join(' ')); say(o);
    }
  }
  // STOCKS-01: what `stocks` does on ZeusOs, from the phone itself — only the sources that let a browser ask them (CORS: Upbit for
  // KRW coins, ExchangeRate-API for rates); Yahoo and Naver do not: only the owner's own session on a server that turned WEBLITE_STOCKS on gets them, through relay.py /relay/stocks (stocksRelayJob below, docs/apps/stocks.md).
  // The answers go to src/gui/stocks.c's web_stocks_store: the app's own parsers write the same cache files as on ZeusOs.
  const stk = { upbitAt: 0, upbitListAt: 0, ranges: ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y'] };
  // STOCKS-LITE: /relay/stocks/ok is 200 only for the owner's marked link on a server that turned the relay on (relay.py); anyone else gets 404 and keeps coins + rates.
  async function stocksProbe() {
    if (TRY) { stk.relay = false; return; }   // TRY-SELF: no server
    try { const r = await fetch('relay/stocks/ok', { cache: 'no-store' }); stk.relay = r.ok && /"on":\s*true/.test(await r.text()); } catch (e) { stk.relay = false; }
    if (stk.relay && W.web_stocks_relay) W.web_stocks_relay(1);
    log.push('WEB stocks relay ' + (stk.relay ? 'on' : 'off'));
  }
  const YR = [['1d', '5m'], ['5d', '15m'], ['1mo', '1d'], ['3mo', '1d'], ['6mo', '1d'], ['ytd', '1d'], ['1y', '1d'], ['5y', '1wk']];
  async function stocksRelayJob(w, store, get, upbit) {
    const cmd = w[0], t0 = performance.now(), E = encodeURIComponent;
    const rget = async (p) => { for (let i = 0; i < 10; i++) { try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 9000); let r; try { r = await fetch('relay/stocks/' + p, { cache: 'no-store', signal: ac.signal }); } finally { clearTimeout(tm); } if (r.status === 429) { await new Promise(f => setTimeout(f, 700)); continue; } return r.ok ? await r.text() : null; } catch (e) { return null; } } return null; };
    const yahoo = (sym, r) => rget('yahoo/v8/finance/chart/' + E(sym) + '?range=' + YR[r][0] + '&interval=' + YR[r][1]);
    const isCoin = (x) => /^[A-Z0-9]+-KRW$/.test(x), isFx = (x) => /=X$/.test(x), isKrx = (x) => /^[0-9A-Z]{6}\.K[QS]$/.test(x);
    const quote = async (sym) => {   // the order of user/stocks/stocks.c provider(): KRX Naver then Yahoo; the rest Yahoo
      if (isKrx(sym)) {
        const b = await rget('naverm/api/stock/' + sym.slice(0, 6) + '/basic');
        if (b) { const i = await rget('naverm/api/stock/' + sym.slice(0, 6) + '/integration');
          if (store(6, sym, 0, b + '\x01' + (i || '')) === 0) { const d = await yahoo(sym, 0); if (d) store(7, sym, 0, d); return ''; } }
      }
      const y = await yahoo(sym, 0); if (y && store(5, sym, 0, y) === 0) return '';
      return 'fail ' + sym + ' no answer\n';
    };
    if (cmd === 'refresh') {
      const lb = readMain('/home/zeus/.config/stocks/list'), syms = lb ? dec.decode(lb).split('\n').map(x => x.trim()).filter(Boolean) : [];
      let ok = 0, fail = 0, why = ''; const rest = [];
      const coins = syms.filter(isCoin);
      if (coins.length) { const t = await upbit('https://api.upbit.com/v1/ticker?markets=' + coins.map(c => 'KRW-' + c.slice(0, -4)).join(','));
        let a = null; try { a = t && JSON.parse(t); } catch (e) { a = null; }
        for (const c of coins) { const o = a && a.find(x => x.market === 'KRW-' + c.slice(0, -4)); if (o && store(0, c, 0, JSON.stringify([o])) === 0) ok++; else rest.push(c); } }
      const todo = syms.filter(x => !isCoin(x)).concat(rest); let next = 0; const fx = [];
      const worker = async () => { while (next < todo.length) { const x = todo[next++]; const e = await quote(x); if (!e) ok++; else if (isFx(x)) fx.push(x); else { fail++; why += e; } } };
      await Promise.all([worker(), worker(), worker()]);
      const bases = {}; for (const f of fx) { const b = f.length === 8 ? f.slice(0, 3) : 'USD'; (bases[b] = bases[b] || []).push(f); }
      for (const b in bases) { const t = await get('https://open.er-api.com/v6/latest/' + b); for (const f of bases[b]) { if (t && store(1, f, 0, t) === 0) ok++; else { fail++; why += 'fail ' + f + ' ExchangeRate-API\n'; } } }
      store(3, '', 0, 'ok ' + ok + ' fail ' + fail + '\n' + why);
      log.push('WEB stocks refresh ok=' + ok + ' fail=' + fail + ' ' + Math.round(performance.now() - t0) + ' ms'); return;
    }
    if (cmd === 'quote') { const sym = w[1] || ''; const e = await quote(sym); log.push('WEB stocks quote ' + sym + (e ? ' none' : ' ok')); return; }
    if (cmd === 'chart') {
      const sym = w[1] || '', r = stk.ranges.indexOf(w[2]);
      if (r >= 0) {
        const y = await yahoo(sym, r);
        if (y && store(7, sym, r, y) === 0) { log.push('WEB stocks chart ' + sym + ' ' + w[2]); return; }
        if (isKrx(sym) && r >= 2) { const n = await rget('navera/chart/domestic/item/' + sym.slice(0, 6) + '?periodType=dayCandle'); if (n && store(8, sym, r, n) === 0) { log.push('WEB stocks chart ' + sym + ' ' + w[2]); return; } }
        if (isCoin(sym)) { const up = ['minutes/10?count=144', 'minutes/60?count=168', 'days?count=31', 'days?count=92', 'days?count=183', 'days?count=200', 'weeks?count=53', 'weeks?count=200'][r]; const [pth, q] = up.split('?');
          const t = await upbit('https://api.upbit.com/v1/candles/' + pth + '?market=KRW-' + sym.slice(0, -4) + '&' + q); if (t && store(2, sym, r, t) === 0) { log.push('WEB stocks chart ' + sym + ' ' + w[2]); return; } }
      }
      store(4, sym, r < 0 ? 0 : r, ''); log.push('WEB stocks chart none ' + sym + ' ' + w[2]); return;
    }
    if (cmd === 'list') {
      const id = w[1] || ''; const ub = W.web_alloc(1400); const n = W.web_stocks_list_url(temp(enc.encode(id)), ub, 1400);
      const u = n > 0 ? dec.decode(new Uint8Array(W.memory.buffer, ub, n)) : '';
      const body = !u ? null : /^https:/.test(u) ? await (async () => { const w8 = stk.upbitListAt + 1500 - Date.now(); if (w8 > 0) await new Promise(f => setTimeout(f, w8)); stk.upbitListAt = Date.now(); return get(u); })() : await rget(u);   // STOCKS-BROWSE-SPEED: a browse list is one request, not queued behind the 10 s coin throttle
      const b = enc.encode(body || ''), bp = W.web_buf(b.length + 1); view().set(b, bp); W.web_stocks_list(temp(enc.encode(id)), bp, b.length);
      log.push('WEB stocks list ' + id + (body ? ' ok' : ' none')); return;
    }
    if (cmd === 'search') {
      const words = w.slice(1).filter(x => x !== '-q').join(' ');
      const [nv, yh] = await Promise.all([rget('naverac/ac?q=' + E(words) + '&target=stock'), rget('yahoo/v1/finance/search?q=' + E(words) + '&quotesCount=12&newsCount=0')]);
      const b = enc.encode((nv || '') + '\x01' + (yh || '')), bp = W.web_buf(b.length + 1); view().set(b, bp); const k = W.web_stocks_search(temp(enc.encode(words)), bp, b.length);
      log.push('WEB stocks search ' + k + ' hits'); return;
    }
  }
  async function stocksJob(w) {
    const store = (k, sym, r, txt) => { const b = enc.encode(txt || ''), bp = W.web_buf(b.length + 1); view().set(b, bp); return W.web_stocks_store(k, temp(enc.encode(sym)), r, bp, b.length); };
    const get = async (u) => { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 9000); try { const r = await fetch(u, { cache: 'no-store', signal: ac.signal }); return r.ok ? await r.text() : null; } catch (e) { return null; } finally { clearTimeout(tm); } };
    const upbit = async (u) => { const wait = stk.upbitAt + 10500 - Date.now(); if (wait > 0) await new Promise(f => setTimeout(f, wait)); stk.upbitAt = Date.now(); return get(u); };   // Upbit: one browser request per 10 s
    if (stk.relay) { await stocksRelayJob(w, store, get, upbit); return; }
    const cmd = w[0], t0 = performance.now();
    if (cmd === 'refresh') {
      const lb = readMain('/home/zeus/.config/stocks/list'), syms = lb ? dec.decode(lb).split('\n').map(x => x.trim()).filter(Boolean) : [];
      const coins = syms.filter(x => /^[A-Z0-9]+-KRW$/.test(x)), fx = syms.filter(x => /=X$/.test(x)); let ok = 0, fail = 0, why = '';
      if (coins.length) {
        const t = await upbit('https://api.upbit.com/v1/ticker?markets=' + coins.map(c => 'KRW-' + c.slice(0, -4)).join(','));
        let a = null; try { a = t && JSON.parse(t); } catch (e) { a = null; }
        for (const c of coins) { const o = a && a.find(x => x.market === 'KRW-' + c.slice(0, -4)); if (o && store(0, c, 0, JSON.stringify([o])) === 0) ok++; else { fail++; why += 'fail ' + c + ' Upbit\n'; } }
      }
      const bases = {}; for (const f of fx) { const b = f.length === 8 ? f.slice(0, 3) : 'USD'; (bases[b] = bases[b] || []).push(f); }
      for (const b in bases) { const t = await get('https://open.er-api.com/v6/latest/' + b); for (const f of bases[b]) { if (t && store(1, f, 0, t) === 0) ok++; else { fail++; why += 'fail ' + f + ' ExchangeRate-API\n'; } } }
      for (const x of syms) if (!coins.includes(x) && !fx.includes(x)) { fail++; why += 'fail ' + x + ' lite: no direct source\n'; }
      store(3, '', 0, 'ok ' + ok + ' fail ' + fail + '\n' + why);
      log.push('WEB stocks refresh ok=' + ok + ' fail=' + fail + ' ' + Math.round(performance.now() - t0) + ' ms'); return;
    }
    if (cmd === 'chart') {
      const sym = w[1] || '', r = stk.ranges.indexOf(w[2]);
      const up = ['minutes/10?count=144', 'minutes/60?count=168', 'days?count=31', 'days?count=92', 'days?count=183', 'days?count=200', 'weeks?count=53', 'weeks?count=200'][r];
      if (r >= 0 && /^[A-Z0-9]+-KRW$/.test(sym)) { const [pth, q] = up.split('?'); const t = await upbit('https://api.upbit.com/v1/candles/' + pth + '?market=KRW-' + sym.slice(0, -4) + '&' + q);
        if (t && store(2, sym, r, t) === 0) { log.push('WEB stocks chart ' + sym + ' ' + w[2]); return; } }
      store(4, sym, r < 0 ? 0 : r, ''); log.push('WEB stocks chart none ' + sym + ' ' + w[2]); return;
    }
    if (cmd === 'search') {   // the built-in names only (stocks.c shows them as you type); an empty answer ends the wait
      fileOut('/home/zeus/.cache/stocks/search', enc.encode('# ' + w.slice(1).filter(x => x !== '-q').join(' ') + '\n')); return;
    }
  }
  // ---- TRY-BIGAPPS: Photo Retouch (user/retouch, unchanged) as prog/rtui.wasm, a WASI reactor this page drives ----
  // The app window (src/gui/retouch.c) queues the keys and pointer events and owns the surface; each frame they go into the editor,
  // it ticks, and the rectangles it changed are copied into the surface. Files are the page's; the font pack is the page's.
  // TRY-BIGAPPS: a saved or exported file -> a small bar with what the person can do with it NOW (download it; a video also as WebM from the browser's own encoder)
  function offerBar(text, buttons) {
    let d = document.getElementById('try-offer'); if (d) d.remove();
    d = document.createElement('div'); d.id = 'try-offer'; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:99995;background:#1c1c1e;color:#fff;border-radius:14px;padding:10px 14px;font:600 14px/1.35 system-ui,sans-serif;max-width:92vw;display:flex;gap:8px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 24px #0006';
    const t = document.createElement('span'); t.textContent = text; t.id = 'try-offer-text'; d.append(t);
    for (const [label, fn, id] of buttons.concat([[L('닫기', 'Close'), () => d.remove(), 'try-offer-close']])) { const b = document.createElement('button'); b.textContent = label; b.id = id || ''; b.style.cssText = 'font:inherit;border:0;border-radius:9px;padding:7px 11px;background:#3a7afe;color:#fff;cursor:pointer'; b.onclick = fn; d.append(b); }
    document.body.append(d); return d;
  }
  const saveAs = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); log.push('WEB try download ' + name + ' ' + blob.size); };
  const baseName = (p) => p.split('/').pop();
  function offerImage(path, bytes) {
    const n = baseName(path); log.push('WEB try saved image ' + path + ' ' + bytes.length);
    const bar = offerBar(L('저장했어요: ', 'Saved: ') + n, [[L('내려받기', 'Download'), () => saveAs(new Blob([bytes], { type: /\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.psd$/i.test(n) ? 'image/vnd.adobe.photoshop' : /\.tiff?$/i.test(n) ? 'image/tiff' : 'application/octet-stream' }), n), 'try-offer-download']]);
    if (window.ZDesk && ZDesk.remember) ZDesk.remember(bar, n, bytes);   // DESK-RESIZE: the last saved file: the 「내 컴퓨터에 저장」 pill, and the name can be dragged out (Chromium)
  }
  function offerVideo(path) {
    const bytes = readMain(path); if (!bytes) return; const n = baseName(path); log.push('WEB try exported ' + path + ' ' + bytes.length);
    const bar = offerBar(L('내보냈어요: ', 'Exported: ') + n, [
      [L('WebM 으로 내려받기', 'Download as WebM'), async () => {
        const t = bar.querySelector('#try-offer-text'), b = bar.querySelector('#try-offer-webm'); if (b) b.disabled = true;
        try { const info = window.ZEnc.parse(bytes); t.textContent = L('브라우저가 영상을 만드는 중… ', 'Your browser is making the video… ') + '0%';
          const r = await window.ZEnc.encode(info, (p) => { t.textContent = L('브라우저가 영상을 만드는 중… ', 'Your browser is making the video… ') + Math.round(p * 100) + '%'; });
          const out = n.replace(/\.avi$/i, '') + '.' + r.ext; saveAs(r.blob, out); t.textContent = L('내려받았어요: ', 'Downloaded: ') + out; log.push('WEB try webm ' + out + ' ' + r.blob.size + ' ' + r.mime);
        } catch (e) { t.textContent = L('이 브라우저에서는 영상을 만들지 못했어요. AVI 로 내려받아 주세요.', 'This browser could not make the video. Download the AVI instead.'); log.push('WEB try webm failed ' + e); }
        if (b) b.disabled = false; }, 'try-offer-webm'],
      [L('AVI 로 내려받기', 'Download the AVI'), () => saveAs(new Blob([bytes], { type: 'video/x-msvideo' }), n), 'try-offer-avi']]);
    if (window.ZDesk && ZDesk.remember) ZDesk.remember(bar, n, bytes);
  }
  imports.env.export_done = (p, n) => { if (TRY || desk) offerVideo(str(p, n)); };
  // TRY-BIGAPPS: our own sample photos and clip, put into the page's folders when Photo Retouch / the Video Editor first opens in the try build
  const trySampled = {};
  function trySamples(kind) {
    if (!TRY || trySampled[kind]) return; trySampled[kind] = 1;
    const dest = { photo: ['/home/zeus/Pictures/샘플/', /^photo-/], video: ['/home/zeus/Movies/', /\.avi$/] }[kind];
    fetch('samples/samples.json').then(r => r.json()).then(async (m) => {
      for (const [name, file] of Object.entries(m)) { if (!dest[1].test(name)) continue;
        const to = (bootKo ? dest[0] : dest[0].replace('/샘플/', '/Samples/')) + ((bootKo ? { 'seasons.avi': '사계 샘플.avi', 'photo-spring.jpg': '봄 산의 진달래.jpg', 'photo-sea.jpg': '여름 바다.jpg', 'photo-cat.jpg': '창가의 고양이.jpg' } : { 'seasons.avi': 'Four Seasons sample.avi', 'photo-spring.jpg': 'Spring mountain azaleas.jpg', 'photo-sea.jpg': 'Summer sea.jpg', 'photo-cat.jpg': 'Cat by the window.jpg' })[name] || name);
        if (window.__webfile(to) >= 0) continue; const r = await fetch('samples/' + file); if (!r.ok) continue; const rc = writeMain(to, new Uint8Array(await r.arrayBuffer())); log.push('WEB try sample ' + to + ' rc=' + rc); }
      W.web_files_reload(); W.web_frame();
    }).catch((e) => { log.push('WEB try samples failed ' + e); trySampled[kind] = 0; });
  }
  // TRY-SAMPLES: the first-start files of a fresh NanumOS (docs, pictures, music, movies, books) in the visitor's browser file store.
  // Small files (<= 64 KB) go in right after the first frame; the big ones (songs, clips, books, big photos) when the app that uses them (or Files) first opens.
  const trySeed = { tree: null, done: {}, busy: false };
  const SEED_APP = { files: 'all', retouch: 'Pictures', photos: 'Pictures', viewer: 'Pictures', paint: 'Pictures', music: 'Music', video: 'Movies', videoedit: ['Movies', 'Music', 'Pictures'], books: 'Books', reader: 'Books', documents: 'Documents', sheet: 'Documents', pdf: 'Documents', notepad: 'Documents' };
  async function trySeedRun(group) {
    if (!TRY || trySeed.done[group]) return; trySeed.done[group] = 1;
    try {
      if (!trySeed.tree) trySeed.tree = await (await fetch('samples/tree.json')).json();
      let n = 0, bytes = 0;
      for (const [kpath, file, size, epath] of trySeed.tree) {
        const path = bootKo || !epath ? kpath : epath;   // the names follow the UI language (user/samples/NAMES.tsv)
        const top = path.split('/')[0]; if (group === 'small' ? size > 65536 : (group !== 'all' && top !== group)) continue;
        const to = '/home/zeus/' + path; if (window.__webfile(to) >= 0) continue;
        const r = await fetch('samples/' + file); if (!r.ok) continue; const rc = writeMain(to, new Uint8Array(await r.arrayBuffer())); if (rc === 0) { n++; bytes += size; }
      }
      if (n) { W.web_files_reload(); W.web_frame(); } log.push('WEB try seed ' + group + ' ' + n + ' files ' + bytes + ' bytes');
    } catch (e) { log.push('WEB try seed failed ' + group + ' ' + e); trySeed.done[group] = 0; }
  }
  let frameNo = 0; window.__trymem = () => ({ main: W.memory.buffer.byteLength, rtui: rt.on ? rt.e.memory.buffer.byteLength : 0 });
  const rt = { on: false };
  function rtStart(args) {
    if (rt.on) return;
    if (!desk) {   // a phone: the editor is laid out for a computer screen (tool bar, panels, shortcuts) — say so, plainly
      W.web_rt_alive(0); log.push('WEB retouch desktop only');
      const d = document.createElement('div'); d.id = 'try-desktop-only'; d.style.cssText = 'position:fixed;inset:0;z-index:99996;background:#323232;color:#fff;display:grid;place-items:center;padding:24px;text-align:center;font:600 18px/1.5 system-ui,sans-serif';
      d.innerHTML = '<div><p style="margin:0 0 8px">' + L('컴퓨터에서 열어 주세요', 'Please open this on a computer') + '</p><p style="margin:0 0 18px;font-weight:400;font-size:15px;color:#ccc">' + L('사진 보정은 컴퓨터 화면에 맞춘 편집기예요 (도구 막대·패널·단축키).', 'Photo Retouch is laid out for a computer screen (tool bar, panels, shortcuts).') + '</p><a href="./" id="try-desktop-only-back" style="color:#fff;background:#3a7afe;border-radius:10px;padding:10px 16px;text-decoration:none;font-size:15px">' + L('다른 앱 써 보기', 'Try other apps') + '</a></div>';
      document.body.append(d); return;
    }
    trySamples('photo');
    if (!fontPack) { log.push('WEB retouch no font pack yet'); W.web_rt_alive(0); return; }
    let p; try { p = runProgram('rtui', ['rtui'], null, { reactor: true, onSave: (path, bytes) => { if ((TRY || desk) && /\.(png|jpe?g|webp|psd|tiff?|bmp)$/i.test(path) && !/^\/(tmp|home\/zeus\/\.config)\//.test(path)) offerImage(path, bytes); } }); } catch (e) { log.push('WEB retouch failed ' + e); toast(L('이 브라우저에서는 사진 보정을 열 수 없어요', 'Photo Retouch cannot open in this browser')); W.web_rt_alive(0); return; }
    const e = p.inst.exports, t0 = performance.now();
    writeMain('/tmp/.web-uisans', new Uint8Array(fontPack));
    const wh = W.web_alloc(8); W.web_rt_offer(1, wh); const sz = new Uint32Array(W.memory.buffer, wh, 2); rt.w = sz[0]; rt.h = sz[1];
    const sp = (s) => { const b = enc.encode(s + '\0'), q = e.rtu_buf(b.length); new Uint8Array(e.memory.buffer).set(b, q); return q; };
    const rc = e.rtu_start(rt.w, rt.h, dpr, sp('/tmp/.web-uisans'), sp(args.join(' ')));
    if (rc) { log.push('WEB retouch start failed ' + rc); W.web_rt_release(); W.web_rt_alive(0); return; }
    W.web_rt_alive(1); Object.assign(rt, { on: true, e, p, kb: W.web_alloc(128), po: W.web_alloc(20), dr: e.rtu_buf(16), cur: -1 });
    log.push('WEB retouch started ' + rt.w + 'x' + rt.h + ' ' + Math.round(performance.now() - t0) + ' ms');
    rtPump(true);
  }
  function rtEnd() { if (!rt.on) return; rt.on = false; try { rt.p.finish(); } catch (x) { /* none open */ } W.web_rt_alive(0); W.web_rt_release(); log.push('WEB retouch closed'); W.web_rt_tick(); /* DESK-RESIZE: the window sees the end now (and starts again with a dropped photo's args) */ W.web_frame(); }
  function rtPump(first) {
    if (!rt.on) return;
    const e = rt.e;
    if (!first) W.web_rt_tick();
    if (!rt.on) return;
    if (!W.web_rt_alive(-1)) { rtEnd(); return; }
    const n = W.web_rt_keys(rt.kb, 128); if (n > 0) { const k = new Uint8Array(W.memory.buffer, rt.kb, n).slice(); for (let i = 0; i + 1 < n; i += 2) e.rtu_key(k[i + 1]); }
    while (W.web_rt_pointer(rt.po)) { const o = new Int32Array(W.memory.buffer, rt.po, 5).slice(); if (o[0] === 4) { rt.w = o[1]; rt.h = o[2]; } e.rtu_ptr(o[0], o[1], o[2], o[3], o[4]); }
    e.rtu_tick();
    if (e.rtu_quit()) { rtEnd(); return; }
    let any = false;
    for (let g = 0; g < 64 && e.rtu_dirty(rt.dr); g++) {
      const r = new Int32Array(e.memory.buffer, rt.dr, 4), x = r[0], y = r[1], w = r[2], h = r[3], fr = e.rtu_frame() >>> 2, src = new Uint32Array(e.memory.buffer);
      for (let j = y; j < y + h; j++) { const row = W.web_rt_row(j); if (!row) continue; new Uint32Array(W.memory.buffer).set(src.subarray(fr + j * rt.w + x, fr + j * rt.w + x + w), (row >>> 2) + x); }
      W.web_rt_damage(x, y, w, h); any = true;
    }
    const c = e.rtu_cursor(); if (c !== rt.cur) { rt.cur = c; W.web_rt_cursor(c); }
    if (any && !rt.firstLogged) { rt.firstLogged = true; log.push('WEB retouch first frame ' + Math.round(performance.now()) + ' ms since load'); }
  }
  async function musicWav(out, inp) {
    try {
      const b = readMain(inp); if (!b) throw new Error('no file ' + inp);
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await new Promise((ok, no) => { const p = ac.decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ok, no); if (p && p.then) p.then(ok, no); });
      try { ac.close(); } catch (e) { /* done */ }
      const n = buf.length, ch = Math.min(2, buf.numberOfChannels), dv = new DataView(new ArrayBuffer(44 + n * ch * 2)), chL = buf.getChannelData(0), chR = ch > 1 ? buf.getChannelData(1) : null;
      const w4 = (o, t) => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
      w4(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w4(8, 'WAVE'); w4(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
      dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w4(36, 'data'); dv.setUint32(40, n * ch * 2, true);
      const f = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      for (let i = 0, o = 44; i < n; i++) { dv.setInt16(o, f(chL[i]), true); o += 2; if (chR) { dv.setInt16(o, f(chR[i]), true); o += 2; } }
      writeMain(out, new Uint8Array(dv.buffer)); log.push('WEB music decoded ' + inp + ' ' + n + ' frames ' + buf.sampleRate + ' Hz');
    } catch (e) { log.push('WEB music decode failed ' + (e && e.message || e)); }
    W.web_mus_alive(0); W.web_frame();
  }
  async function jobs(line) {
    let w = words(line), redir = null;
    if (w[w.length - 1] === '&') w.pop();
    const gt = w.indexOf('>'); if (gt >= 0) { redir = w[gt + 1]; w = w.slice(0, gt); }
    if (w[0] === 'u') { w.shift(); while (w[0] === '-w' || w[0] === '-m') w.splice(0, 2); }   // NEWS-IMG: -m MIB (a memory quota) means nothing here
    const prog = w.shift();
    if (prog === 'play' && w[0] === '--wav') { await musicWav(w[1], w[2]); return; }   // TRY-MUSIC: the Video Editor's music (MP3/OGG/FLAC/AAC) as a WAV, decoded by the browser
    if (prog === 'rtui') { rtStart(w); return; }   // TRY-BIGAPPS: Photo Retouch
    if (prog === 'vmm') return vmmJob(w);
    if (prog === 'netweb') { await netJob(w, redir); return; }   // MOBILE-PARITY B: Network on the phone (src/gui/netutil.c ZEUSOS_WEB)
    if (prog === 'fetch' && w[0] === '--samples') { await samples(w[1] || 'all'); return; }   // MEDIA-SEED: 샘플 받기
    if (prog === 'fetch' && w[0] === '--shop') { await shopJob(w.slice(1)); return; }
    if (prog === 'stocks') { await stocksJob(w); return; }   // STOCKS-01: user/stocks/stocks.c's files, straight from the phone to the sources a browser may ask   // SHOP-01: user/tls/shop.c's files, through relay.py /relay/shop
    if (prog === 'weblite' && /^desk-/.test(w[0] || '') && window.ZDesk) { ZDesk.job(w[0], w.slice(1)); return; }   // WEB-DESKTOP: Restart, the files note
    if (prog === 'weblite' && w[0] === 'mail-open') {   // no account yet: the account sheet (the password stays on the phone)
      if (readMain('/home/zeus/.mail/account')) { W.web_mail_open(); return; }
      mailSheet(); return;
    }
    if (prog === 'weblite' && w[0] === 'storage') { if (window.ZKeep) ZKeep.open(); return; }   // LITE-PERSIST: Settings' 저장 공간·백업
    if (prog === 'weblite' && w[0] === 'mail-account') { mailSheet(!!readMain('/home/zeus/.mail/account')); return; }   // Mail's 계정 row: edit or remove
    if (prog === 'weblite' && w[0] === 'pack') {   // MOBILE-PARITY A: a pack entry ZeusOs has in its image, fetched when its app first opens (the service worker keeps it)
      const name = w[1], file = { manual: 'manual.d1973f1e82.js', 'dict-en': 'dict-en.1fe3f68411.js', wordnet: 'wordnet.2c342eec67.js' }[name]; if (!file) return;
      const t = performance.now(), r = await fetch(file); if (!r.ok) { log.push('WEB pack ' + name + ' missing ' + r.status); return; }
      const b = new Uint8Array(await r.arrayBuffer());
      if (name === 'dict-en') { W.web_file_put(put(enc.encode('/bin/dict-en')), put(b), b.length); W.web_bin_ready(); }   // read as /bin/dict-en, as on ZeusOs; not kept in IndexedDB
      else { const q = W.web_alloc(b.length); view().set(b, q); W.web_pack_entry(mainPath(name), q, b.length); }
      log.push('WEB pack got ' + name + ' ' + b.length + ' bytes ' + Math.round(performance.now() - t) + ' ms'); return;
    }
    if (prog === 'weblite' && w[0] === 'stations') {   // Zeus Radio's station snapshot (tools/weblite/radio-snapshot.sh), not kept in IndexedDB
      const t = performance.now(), r = await fetch('radio/stations.026ae74cc7.js'); const b = new Uint8Array(await r.arrayBuffer());
      fileOut('/home/zeus/.radio/stations', b); W.web_radio_ready();
      log.push('WEB radio stations ' + b.length + ' bytes ' + Math.round(performance.now() - t) + ' ms');
    } else if (prog === 'weather' && w[0] === 'refresh') {   // user/weather/weather.c's refresh, straight from the phone to Open-Meteo (CORS): every saved place in one GET
      const home = '/home/zeus', np = W.web_alloc(4), dp = W.web_file_get(temp(enc.encode(home + '/.config/weather/places')), np);
      const lines = dp ? dec.decode(view().slice(dp, dp + new Int32Array(W.memory.buffer, np, 1)[0])).split('\n') : [];
      const pl = []; for (const ln of lines) { const m = ln.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)\s+(.+)$/); if (m && pl.length < 8) pl.push({ lat: +m[1], lon: +m[2], name: m[3] }); }
      if (!pl.length) pl.push({ lat: 37.5665, lon: 126.978, name: 'Seoul' });
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + pl.map((p) => p.lat.toFixed(4)).join(',') + '&longitude=' + pl.map((p) => p.lon.toFixed(4)).join(',') +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,precipitation,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,uv_index,visibility' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,precipitation_sum&timezone=auto&timeformat=unixtime&forecast_days=7');
      const jj = await r.json(), all = Array.isArray(jj) ? jj : [jj];
      const r10 = (x) => Math.round(x * 10), kind = (k) => k <= 1 ? 'clear' : k <= 3 ? 'cloudy' : (k === 45 || k === 48) ? 'fog' : ((k >= 71 && k <= 77) || k === 85 || k === 86) ? 'snow' : 'rain';
      const nn = (v, d) => v == null ? d : v, nowS = Math.floor(Date.now() / 1000);
      let sums = '', ti0 = 0, kind0 = '';
      for (let pi = 0; pi < pl.length && pi < all.length; pi++) {
        const j = all[pi], c = j.current, h = j.hourly, d = j.daily, p = pl[pi];
        const tc = r10(c.temperature_2m), ti = tc >= 0 ? Math.floor((tc + 5) / 10) : -Math.floor((-tc + 5) / 10), now = c.time;
        sums += 'pl ' + nowS + ' ' + tc + ' ' + c.weather_code + ' ' + nn(c.is_day, 1) + ' ' + (d.time.length ? r10(d.temperature_2m_max[0]) : -999) + ' ' + (d.time.length ? r10(d.temperature_2m_min[0]) : -999) + ' ' + p.lat.toFixed(4) + ' ' + p.lon.toFixed(4) + ' ' + p.name + '\n';
        if (pi) continue;
        let i = 0; while (i < h.time.length && h.time[i] + 3600 <= now) i++;
        const i0 = i, uv = h.uv_index ? nn(h.uv_index[i0], -1) : -1, vis = h.visibility ? nn(h.visibility[i0], -1) : -1;
        let out = nowS + ' ' + ti + ' ' + kind(c.weather_code) + '\n' + 'place ' + p.lat.toFixed(4) + ' ' + p.lon.toFixed(4) + ' ' + p.name + '\n' +
          'now ' + now + ' ' + tc + ' ' + c.weather_code + ' ' + nn(c.relative_humidity_2m, -1) + ' ' + (c.wind_speed_10m == null ? -1 : r10(c.wind_speed_10m)) + ' ' + nn(c.is_day, 1) + '\n' +
          'off ' + (j.utc_offset_seconds || 0) + '\n' +
          'now2 ' + (c.apparent_temperature == null ? -9999 : r10(c.apparent_temperature)) + ' ' + (c.wind_direction_10m == null ? -1 : Math.round(c.wind_direction_10m)) + ' ' + (c.pressure_msl == null ? -1 : r10(c.pressure_msl)) + ' ' + (vis < 0 ? -1 : Math.round(vis)) + ' ' + (uv < 0 ? -1 : r10(uv)) + ' ' + (c.precipitation == null ? -1 : r10(c.precipitation)) + '\n';
        for (let k = 0; i < h.time.length && k < 48; i++, k++) out += 'hour ' + h.time[i] + ' ' + r10(h.temperature_2m[i]) + ' ' + h.weather_code[i] + ' ' + nn(h.precipitation_probability[i], -1) + '\n';
        for (let k = 0; k < d.time.length && k < 7; k++) out += 'day ' + d.time[k] + ' ' + r10(d.temperature_2m_max[k]) + ' ' + r10(d.temperature_2m_min[k]) + ' ' + d.weather_code[k] + ' ' + nn(d.precipitation_probability_max[k], -1) + '\n';
        for (let k = 0; k < d.time.length && k < 7; k++) out += 'day2 ' + nn(d.sunrise && d.sunrise[k], 0) + ' ' + nn(d.sunset && d.sunset[k], 0) + ' ' + (d.uv_index_max && d.uv_index_max[k] != null ? r10(d.uv_index_max[k]) : -1) + ' ' + (d.precipitation_sum && d.precipitation_sum[k] != null ? r10(d.precipitation_sum[k]) : -1) + '\n';
        const b = enc.encode(out), bp = W.web_buf(b.length + 1); view().set(b, bp); W.web_save_file(temp(enc.encode(home + '/.cache/weather')), bp, b.length);   // kept (IndexedDB), as the CLI's cache
        ti0 = ti; kind0 = kind(c.weather_code);
      }
      { const b = enc.encode(sums), bp = W.web_buf(b.length + 1); view().set(b, bp); W.web_save_file(temp(enc.encode(home + '/.cache/weather-places')), bp, b.length); }
      log.push('WEB weather ' + pl[0].name + ' ' + ti0 + '\u00b0 ' + kind0);
    } else if (prog === 'news' && w.indexOf('--check') > 0 && w[w.indexOf('--check') - 1] === 'add') {   // APPLINK-01: the chat's subscribe — the relay checks the address and the feed; news.c then subscribes (news_add_feed, ~/.config/news/urls)
      const url = w[w.indexOf('--check') + 1] || '', say = t => { if (redir) fileOut(redir, enc.encode(t + '\n')); };
      let j = null; try { const r = await fetch('relay/news/check?url=' + encodeURIComponent(url)); if (r.ok) j = await r.json(); } catch (e) { /* offline */ }
      const line = (j && j.line) || 'news: refused ' + url + ': the server did not answer';
      log.push('WEB news check ' + line.split(' ').slice(0, 2).join(' ') + ' ' + url);
      say(line);
    } else if (prog === 'news' && w[0] === '--gui-list') {
      fileOut(w[w.length - 1], enc.encode(localStorage.getItem('zeus-news-list') || ''));   // the last list this phone saw (public headlines)
    } else if (prog === 'news' && w[0] === 'discover') {   // NEWS-ADD-UI: the feeds behind an address, found by the relay (public addresses only)
      const out = w[2]; let txt = '';
      try { const r = await fetch('relay/news/discover?url=' + encodeURIComponent(w[1] || '')); txt = r.ok ? await r.text() : 'err\tthe server answered ' + r.status + '\n'; } catch (e) { txt = 'err\toffline\n'; }
      if (out) fileOut(out, enc.encode(txt)); log.push('WEB news discover ' + (txt.split('\t')[0] || '?') + ' ' + String(w[1] || '').slice(0, 80));
    } else if (prog === 'news' && w[0] === '--gui-refresh') {
      const z = w[w.indexOf('-z') + 1] || '9', only = w.indexOf('-f') >= 0 ? w[w.indexOf('-f') + 1] : '', t = performance.now();
      // NEWS-ADD-UI: the phone's own subscriptions (the same ~/.config/news/urls the app edits), not a fixed list
      const feeds = []; { const u = readMain('/home/zeus/.config/news/urls'); if (u) for (const l of dec.decode(u).split('\n')) { const m = l.trim(); if (!m || m[0] === '#') continue; const sp = m.search(/\s/); const url = sp < 0 ? m : m.slice(0, sp), nm = sp < 0 ? '' : (m.slice(sp).match(/~(.*)$/) || [, ''])[1].trim(); feeds.push([url, nm]); } }
      const want = feeds;   // (the phone refreshes them all: the relay keeps the answers for 10 minutes, and the rows stay in one newest-first list)
      if (!want.length) { if (redir && redir !== '/dev/null') fileOut(redir, enc.encode('news: 0 feeds, 0 items, 0 new\n')); fileOut(w[w.length - 1], enc.encode('')); log.push('WEB news list 0 feeds'); return; }
      // a single feed is merged into the list the phone already has (the program merges into its cache; here the page keeps the list)
      let j = null; const q = want.slice(0, 40).map(f => 'f=' + encodeURIComponent(f[0]) + '&n=' + encodeURIComponent(f[1])).join('&');
      for (let i = 0; i < 3 && !j; i++) { try { const r = await fetch('relay/news/list?z=' + encodeURIComponent(z) + '&own=1' + (q ? '&' + q : '')); if (r.ok) j = await r.json(); } catch (e) { /* again */ } if (!j) await new Promise(ok => setTimeout(ok, 1500 * (i + 1))); }
      if (!j) { if (redir && redir !== '/dev/null') fileOut(redir, enc.encode('news: 0 feeds, 0 items, 0 new, some feeds failed\n')); log.push('WEB news list failed'); return; }   // news.c ends the wait and tries again later
      const list = j.list;
      fileOut(w[w.length - 1], enc.encode(list)); try { localStorage.setItem('zeus-news-list', list); } catch (e) { /* full */ }
      if (redir && redir !== '/dev/null') fileOut(redir, enc.encode(j.said));
      log.push('WEB news list ' + list.split('\n').length + ' rows ' + Math.round(performance.now() - t) + ' ms');
    } else if (prog === 'readpage' && w[0] === '--img') {
      const out = w[1], table = docImages.get(out) || {};
      for (const id of w.slice(2)) if (table[id]) fileOut(out + '.img' + id, await zimg(table[id], [720, 960]));
    } else if (prog === 'readpage' && w[0] === '--thumb') {
      fileOut(w[1], await zimg(w[3], +w[2]));
    } else if (prog === 'readpage') {
      let eager = 4; if (w[0] === '-e') { eager = +w[1]; w = w.slice(2); }
      const url = w[0], out = w[1], t = performance.now(), mine = (readSeq[out] = (readSeq[out] || 0) + 1);   // READER-FIX: a later read of the same file wins
      const fileOut = (p, b) => { if (readSeq[out] === mine) fileOutAll(p, b); };
      let doc;   // READER-FIX: no connection -> an error document at once (the Reader says so instead of waiting 40 s)
      try { const r = await fetch('relay/news/read?url=' + encodeURIComponent(url)); doc = new Uint8Array(await r.arrayBuffer()); if (!r.ok && dec.decode(doc.slice(0, 4)) !== 'ZRD1') throw new Error(r.status); }
      catch (e) { doc = enc.encode('ZRD1\nu\t' + url + '\nt\tThe site did not answer\nk\terror\ne\toffline ' + String(e.message || e).slice(0, 60) + '\nn\t0 0 0\nb\n'); }
      const table = {}; for (const l of dec.decode(doc).split('\n')) if (l.startsWith('i\t')) { const [, n, u] = l.split('\t'); table[n] = u; }
      docImages.set(out, table); if (docImages.size > 30) docImages.delete(docImages.keys().next().value);
      fileOut(out + '.txt', enc.encode(docText(dec.decode(doc))));   // Ask's numbered text before the document (the Reader may ask at once)
      fileOut(out, doc);   // the text first; the first images follow (readpage's order: text never waits for a picture)
      for (let id = 1; id <= eager && table[id]; id++) fileOut(out + '.img' + id, await zimg(table[id], [720, 960]));
      log.push('WEB read ' + url.slice(0, 80) + ' ' + doc.length + ' bytes ' + Math.round(performance.now() - t) + ' ms');
    } else if (prog === 'zeus' && w[0] === '--ask-page') {   // READER-FIX: the Reader's Ask as a background job (the screen keeps drawing)
      const t = performance.now(), page = dec.decode(readMain(w[1]) || new Uint8Array(0)).slice(0, 24000), q = w.slice(2).join(' ');
      let ans = '';
      try { const r = await fetch('relay/kim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kimModel() ? { q, page, model: kimModel() } : { q, page }) });
        const j = await r.json(); ans = j.answer || j.error || ''; if (!ans && r.status === 429) ans = '잠시 뒤 다시 해 주세요 (요청이 많아요).'; }
      catch (e) { ans = ''; }
      if (redir) fileOut(redir, enc.encode((ans || '지금은 답할 수 없어요 — 연결이 안 돼요.') + '\n'));
      log.push('WEB ask ' + ans.length + ' chars ' + Math.round(performance.now() - t) + ' ms');
    } else if (prog === 'python' && w.includes('--stop')) {   // KIM-UX-2: the chat's stop button
      kimSeq++; if (kimAbort) { kimAbort.abort(); kimAbort = null; log.push('WEB kim stop'); }   // ACT-CORE: a stopped stream writes nothing more
    } else if (prog === 'python' && w.includes('--events')) {   // KIM-UX-2: the chat app — the conversation (on the phone) to the relay, its events streamed back
      // ACT-CORE (owner 11-03 비서: the same sentence twice in one bubble, the last answer stuck at 「…」): a turn that was stopped (a new
      // spoken question, barge-in) went on writing /tmp/.kim-ev — the stop came while this handler still awaited browserFacts (no
      // controller yet), or a read already resolved — over the next turn's events. Each turn has its number; only the newest writes.
      const my = ++kimSeq; if (kimAbort) { kimAbort.abort(); kimAbort = null; }
      const ctl = new AbortController(); kimAbort = ctl;
      const req = readMain(w[w.indexOf('--events') + 1]); let j = {}; try { j = JSON.parse(dec.decode(req)); } catch (e) { /* kim.c wrote it */ }
      const body = { messages: j.messages || [], system: j.system || '', temperature: j.temperature, facts: (j.facts || '') + await browserFacts(), stream: true };
      // CHAT-PLUS: this chat's own head (kim.c's model menu: "api TAB model TAB kind"), else the saved pick; ✨ agent; the pictures
      const hf = typeof j.head === 'string' ? j.head.split('\t') : []; const chatModel = hf[0] === KIM_API && hf[1] ? hf[1] : kimModel();
      if (chatModel) body.model = chatModel; if (j.agent === 1) body.agent = 1;
      if (Array.isArray(j.images)) { const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }; body.images = [];
        for (const ip of j.images.slice(0, 4)) { const mt = MIME[String(ip).split('.').pop().toLowerCase()]; const b = mt && readMain(String(ip)); if (!b || b.length > (3 << 20)) continue;
          let bin = ''; for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); body.images.push('data:' + mt + ';base64,' + btoa(bin)); }
        log.push('WEB kim images ' + body.images.length); } if (j.follow === false) body.follow = false; if (j.actions === 1) body.actions = 1; if (j.acts_back === 1) body.acts_back = 1; if (j.appdo && typeof j.appdo === 'object') body.appdo = j.appdo;   // ZEUS-ACTIONS-2: the apps' facts (src/gui/appdo.c)   // ZEUS-FOLLOW: no chips (a translation); ZEUS-ACTIONS: the chat applies the cards (event A) to this phone's files
      if (body.model) log.push('WEB kim ask model=' + body.model);
      const t = performance.now(); let got = new Uint8Array(0), first = 0, last = 0;
      if (my !== kimSeq) { log.push('WEB kim stale turn dropped'); return; }
      // ACT-TRUTH (owner 11-05 「라디오도 안 켜졌어」): each card the chat applied left its result in /tmp/.kim-act-<id> (zact.c) — it goes
      // back to the relay at once, so the head's words come after what the phone really did
      // the relay holds its stream while it waits, so a card the chat applies on a later tick is looked for again (every 150 ms, 10 s)
      const acted = new Set(); let actPoll = 0;
      const actBack = () => { if (j.acts_back !== 1 || my !== kimSeq) return; const t = dec.decode(got); let pending = 0;
        for (const m of t.matchAll(/(?:^|\n)A\tid=([A-Za-z0-9]+)/g)) { const id = m[1]; if (acted.has(id)) continue; const r = readMain('/tmp/.kim-act-' + id); if (!r) { pending++; continue; }
          acted.add(id); log.push('WEB kim act ' + id + ' ' + dec.decode(r).split('\t')[0]);
          fetch('relay/kim/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, r: dec.decode(r) }) }).catch(() => {}); }
        if (pending && !actPoll) { let n = 0; actPoll = setInterval(() => { W.web_kim_tick(); n++; const left = (actBack(), [...dec.decode(got).matchAll(/(?:^|\n)A\tid=([A-Za-z0-9]+)/g)].some(m => !acted.has(m[1])));
          if (!left || n > 66 || my !== kimSeq) { clearInterval(actPoll); actPoll = 0; } }, 150); } };
      // the relay's P lines (heartbeats while it waits for a card's result: WebKit hands a chunk over only when the next comes) never reach the chat's file
      const unpad = (g) => { for (let i = 0; i + 1 < g.length; i++) { if (g[i] !== 0x50 || g[i + 1] !== 9 || (i && g[i - 1] !== 10)) continue;
        let e = i + 2; while (e < g.length && g[e] === 0x20) e++; if (e >= g.length || g[e] !== 10) continue;
        const m = new Uint8Array(g.length - (e + 1 - i)); m.set(g.subarray(0, i)); m.set(g.subarray(e + 1), i); g = m; i--; } return g; };
      const put = (b) => { if (my !== kimSeq) return; const n = new Uint8Array(got.length + b.length); n.set(got); n.set(b, got.length); got = unpad(n); fileOut('/tmp/.kim-ev', got); W.web_kim_tick(); actBack(); };
      try {
        const r = await fetch('relay/kim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok || !r.body) put(enc.encode('E\t' + (r.status === 429 ? '잠시 뒤 다시 해 주세요 (요청이 많아요).' : '지금은 답할 수 없어요 (' + r.status + ').') + '\nD\t\n'));
        else {
          for (const rd = r.body.getReader(); ;) { const { done, value } = await rd.read(); if (done) break; if (!first) first = performance.now() - t; last = performance.now(); put(value); }
          // ACT-CORE (owner 11-03 비서: the last answer stuck at 「…」): a stream that ended without its D line (the relay restarted, the
          // connection dropped) left the chat waiting for KIM_IDLE_S — the turn ends now, in plain words (the Assistant asks once more)
          if (!/(^|\n)D(\t[^\n]*)?\n?$/.test(dec.decode(got.slice(-200)))) { log.push('WEB kim stream ended without D'); put(enc.encode((got.length && got[got.length - 1] !== 10 ? '\n' : '') + 'E\t답이 중간에 끊겼어요 — 다시 물어봐 주세요.\nD\t\n')); }
        }
      } catch (e) { if (e.name !== 'AbortError') put(enc.encode('E\t지금은 답할 수 없어요 — 연결이 안 돼요.\nD\t\n')); }
      if (kimAbort === ctl) kimAbort = null;
      if (my !== kimSeq) { log.push('WEB kim stale turn dropped'); return; }
      const tail = dec.decode(got); log.push('WEB kim ' + Math.round(performance.now() - t) + ' ms first ' + Math.round(first) + ' ms ' + tail.split('\n').filter(l => l.startsWith('T\t')).map(l => l.slice(2)).join('').slice(0, 60).replace(/\\n/g, ' '));
      if (/^M\t(.*)$/m.test(tail)) log.push('WEB kim model ' + tail.match(/^M\t(.*)$/m)[1]);
      if (/^E\t(.*)$/m.test(tail)) log.push('WEB kim error ' + tail.match(/^E\t(.*)$/m)[1]);
      if (/^F\t(.*)$/m.test(tail)) log.push('WEB kim follow ' + tail.match(/^F\t(.*)$/m)[1].split('\\t').join(' | '));   // ZEUS-FOLLOW: the chips (kim.c draws them)
    } else if (prog === 'python' && w.includes('--dict-ai')) {   // DICT-AI: the Dictionary's AI meaning (dict.c) as a background job — the relay's answer, as text lines
      const word = dec.decode(readMain(w[w.indexOf('--dict-ai') + 1]) || new Uint8Array(0)).trim().slice(0, 80), t = performance.now();
      let a = '';
      try { const q = '\uc0ac\uc804\ucc98\ub7fc \uc9e7\uac8c: \u300c' + word + '\u300d\uc758 \ub73b(\ud488\uc0ac, \ud55c\uad6d\uc5b4 \ub73b, \uc608\ubb38 \ud558\ub098).';   // 사전처럼 짧게: 「word」의 뜻(품사, 한국어 뜻, 예문 하나).
        const r = await fetch('relay/kim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kimModel() ? { q, model: kimModel() } : { q }) }); const j = await r.json(); a = j.answer || ''; }
      catch (e) { a = ''; }
      const lines = a.split('\n').map(l => l.replace(/^[#*\->`\s]+/, '').replace(/\*\*/g, '').trim()).filter(Boolean).slice(0, 14).map(l => 'RAW: ' + l);
      if (redir) fileOut(redir, enc.encode(lines.length ? 'SRC: Zeus\n' + lines.join('\n') + '\n@end raw\n' : 'ERR: \uc9c0\uae08\uc740 \ub2f5\ud560 \uc218 \uc5c6\uc5b4\uc694 \u2014 \uc5f0\uacb0\uc774 \uc548 \ub3fc\uc694.\n@end error\n'));   // 지금은 답할 수 없어요 — 연결이 안 돼요.
      log.push('WEB dict ai ' + a.length + ' chars ' + Math.round(performance.now() - t) + ' ms');
    } else if (prog === 'python' && w.some(x => x.endsWith('zeus.py'))) {   // Kim (kim.c): the question file in, zeus's answer shape out
      const lt = line.lastIndexOf('<'), qf = lt >= 0 ? line.slice(lt + 1).trim().split(' ')[0] : '/tmp/.kim-q';
      const np = W.web_alloc(4), dp = W.web_file_get(temp(enc.encode(qf)), np), n = new Int32Array(W.memory.buffer, np, 1)[0];
      const q = dec.decode(view().slice(dp, dp + n)).split('\n/exit')[0].trim(), t = performance.now();
      if (kimModel()) log.push('WEB kim ask model=' + kimModel());
      let a; try { const r = await fetch('relay/kim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kimModel() ? { q, model: kimModel() } : { q }) }); const j = await r.json(); a = j.answer || j.error || '?'; if (j.model) log.push('WEB kim model ' + j.model); }
      catch (e) { a = '지금은 답할 수 없어요 — 연결이 안 돼요.'; }
      fileOut('/tmp/.kim-a', enc.encode('\u203a ' + a + '\n\u203a ')); W.web_kim_tick();   // between zeus's first and second prompt; shown at once
      log.push('WEB kim ' + Math.round(performance.now() - t) + ' ms ' + a.slice(0, 60).replace(/\n/g, ' '));
    } else if (!(prog === 'news' && w[0] === 'mark') && !(prog === 'net')) log.push('WEB run unknown ' + line);
  }

  // ---- touch and mouse: a tap places the caret (and opens the keyboard), a vertical drag scrolls ----
  // The system's gestures are never ours: transparent edge strips (touch-action auto, no preventDefault) lie over
  // the canvas where Safari or iOS needs touches — in a Safari tab the top 44 px (address bar) and the bottom 60 px
  // (the toolbar comes back), in an installed app the home-indicator zone (safe area + 20 px) and the left edge (20 px).
  // A plain tap on a strip still reaches the app (a click: no gesture is taken); in the app the bottom strip goes home.
  const EDIT = 4;
  const edges = { top: document.getElementById('edge-top'), bottom: document.getElementById('edge-bottom'), left: document.getElementById('edge-left') };
  function layoutEdges() {
    if (desktop || desk) { for (const k in edges) edges[k].hidden = true; return; }
    const sa = standalone(), safeB = sa ? safeCss()[1] : 0;
    edges.top.hidden = sa; edges.top.style.height = '44px';
    edges.bottom.style.height = (sa ? safeB + 20 : 60) + 'px';
    edges.left.hidden = !sa;
    document.documentElement.classList.toggle('standalone', sa);
  }
  let down = null;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * dpr), Math.round((e.clientY - r.top) * dpr)]; };
  // KB-01 (owner: like ChatGPT's web app): the keyboard is up only on a text field or an app's text area; a tap outside,
  // a scroll, Enter/Done on a one-line field, another app or a list puts it away. The hidden textarea sits under the
  // caret (1 px, transparent, takes no touches), so whatever the browser shows for it — Android's insertion handle,
  // the paste bubble, a scroll into view — is at the caret, not a strange mark at the top of the screen.
  const textApp = () => W && ((W.web_app() === EDIT && !(W.web_edit_list && W.web_edit_list())) || W.web_app() === 16 || (W.web_wants_keys && W.web_wants_keys()));   // MOBILE-PARITY A: Sheet
  function placeKeys() {
    const c = imeCaret, r = canvas.getBoundingClientRect(); if (!c) return;
    const x = Math.max(0, Math.min(r.width - 2, c[0] / dpr)), y = Math.max(0, Math.min(r.height - 2, (c[1] + c[2]) / dpr - 1));
    ta.style.left = (r.left + x) + 'px'; ta.style.top = (r.top + y) + 'px';
  }
  // Away = the system keyboard hides but the textarea keeps the focus (inputmode none), so a hardware keyboard's
  // shortcuts (Ctrl+N in Vault, an iPad's keyboard) still reach the app; a tap on a field brings it back.
  function keyboardAway() { if (document.activeElement !== ta || ta.inputMode === 'none') return; ta.inputMode = 'none'; ta.blur(); ta.focus({ preventScroll: true }); }
  const keyboardFor = () => { if (W && (imeFocus || textApp())) { if (ta.inputMode === 'none') { ta.inputMode = 'text'; ta.blur(); } ta.focus({ preventScroll: true }); reset(); } else if (document.activeElement === ta) ta.blur(); };
  // Two fingers: a pinch sets this app's text size (re-rendered crisp by the app, 75..200 %); a double tap on a zoomed
  // app goes back to its default size.
  const touches = new Map(); let pinch = null, lastTap = { t: 0, x: 0, y: 0 };
  const span = () => { const p = [...touches.values()]; return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); };
  // PINCH-01: a picture app (Photos, Viewer: W.web_zoom_kind() 2) scales its picture about the fingers' middle instead, a step per 2 %
  // of spread; while it is zoomed one finger drags the picture (down / move / up as a mouse) and a double tap is its own (fit <-> 100 %).
  const pictureApp = () => W && W.web_zoom_kind && W.web_zoom_kind() === 2;
  const mid = () => { const p = [...touches.values()]; return [Math.round((p[0][0] + p[1][0]) / 2), Math.round((p[0][1] + p[1][1]) / 2)]; };
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') touches.set(e.pointerId, at(e));
    if (touches.size === 2 && W && W.web_app() >= 0) {
      if (down && (down.drag || !down.touch)) input('pointer', () => W.web_pointer(down.x, down.y, 2, 0));   // the first finger's drag ends where it was (PAINT-01: a stroke too - the second finger never starts one)
      pinch = pictureApp() ? { pic: true, s: span() } : { d0: span(), p0: W.web_pct(), last: W.web_pct() }; down = null; } }, true);
  canvas.addEventListener('pointermove', (e) => { if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, at(e));
    if (pinch && pinch.pic && touches.size === 2) { const r = span() / pinch.s;
      if (Math.abs(r - 1) >= 0.02) { const f = Math.round((r - 1) * 1000), [mx, my] = mid(); pinch.s = span(); input('pinch', () => W.web_zoom(mx, my, f)); } e.stopImmediatePropagation(); return; }
    if (pinch && touches.size === 2) { const v = Math.max(75, Math.min(200, Math.round(pinch.p0 * span() / pinch.d0 / 5) * 5));
      if (v !== pinch.last) { pinch.last = v; input('pinch', () => W.web_pinch(v)); } e.stopImmediatePropagation(); } }, true);
  const lift = (e) => { touches.delete(e.pointerId); if (pinch) { if (!touches.size) pinch = null; down = null; e.stopImmediatePropagation(); } };
  canvas.addEventListener('pointerup', lift, true); canvas.addEventListener('pointercancel', lift, true);
  canvas.addEventListener('pointerdown', (e) => {
    if (pinch) return;
    commit('tap');   // IME-01: the syllable ends where it is before the caret moves
    const [x, y] = at(e); stats.lastEventAt = e.timeStamp;
    down = { x, y, x0: x, y0: y, lx: x, axis: 0, pan: 0, touch: e.pointerType !== 'mouse', scrolled: 0, acc: 0, home: W.web_app() === -1 };
    if (down.touch && pictureApp() && W.web_zoomed()) { down.touch = false; down.drag = 1; }   // PINCH-01: a zoomed picture follows the finger
    if (down.touch && !down.home && W.web_grab && W.web_grab(x, y)) down.touch = false;   // CAL-TIME: a finger on a calendar event drags it
    if (!down.touch) input('pointer', () => W.web_pointer(x, y, 0, 0));
    else if (down.home) input('pointer', () => W.web_pointer(x, y, 0, 1));   // LAB-01: the home screen's launcher takes the finger whole (arg 1 = touch)
    else if (W.web_hold) { const d = down; d.hold = setTimeout(() => { if (down === d && !d.scrolled && !d.pan && W.web_hold(x, y)) { d.held = 1; log.push('WEB hold'); } }, 500); }   // LITE-HELP: a tap opens a file, a finger held still selects it (Files)
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return; const [x, y] = at(e); stats.lastEventAt = e.timeStamp;
    if (!down.touch) { input('pointer', () => W.web_pointer(x, y, 1, 0)); return; }
    if (down.home) { input('pointer', () => W.web_pointer(x, y, 1, 1)); return; }   // LAB-01: swipes, long press, drags: src/gui/launcher_ui.c
    if (W.web_pan && W.web_pan(down.x0, down.y0)) {   // (LITE-OFFICE-MENU: and 문서's tool bar, where the finger went down) Weather: a sideways drag moves the hour strip or turns to the next place (KM_PAN), a vertical one scrolls
      if (!down.axis) { const ax = Math.abs(x - down.x0), ay = Math.abs(y - down.y0); if (Math.max(ax, ay) < 10 * dpr) return; down.axis = ax > ay ? 1 : 2; down.y = y; }
      if (down.axis === 1) { down.scrolled = down.pan = 1; const d = x - down.lx; down.lx = x; if (d) input('pan', () => W.web_pointer(x, y, 6, d)); return; }
    }
    const dy = y - down.y; if (!down.scrolled && Math.abs(dy) < 10 * dpr) return;
    down.scrolled = 1; const step = 24 * dpr * 1.5;   // about 1.5 lines of finger per wheel notch (a notch = 3 lines)
    down.acc += dy; down.y = y;
    let n = 0; while (down.acc >= step) { down.acc -= step; n++; } while (down.acc <= -step) { down.acc += step; n--; }
    if (n) input('scroll', () => W.web_pointer(x, y, 4, n));
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return; const [x, y] = at(e); stats.lastEventAt = e.timeStamp; clearTimeout(down.hold);
    if (!down.touch) input('pointer', () => W.web_pointer(x, y, 2, 0));
    else if (down.held) {}   // LITE-HELP: the long press already selected; no tap
    else if (down.home) input('pointer', () => W.web_pointer(x, y, 2, 1));
    else if (down.pan) input('pan', () => W.web_pointer(x, y, 6, 0));
    else if (!down.scrolled) {
      const dbl = e.timeStamp - lastTap.t < 320 && Math.abs(x - lastTap.x) < 30 * dpr && Math.abs(y - lastTap.y) < 30 * dpr;
      lastTap = { t: e.timeStamp, x, y };
      if (dbl && W.web_app() >= 0 && W.web_zoomed() && !pictureApp()) input('zoom', () => W.web_pinch(0));   // back to the default size (a picture app takes the two taps itself)
      else input('tap', () => { W.web_pointer(x, y, 0, 0); W.web_pointer(x, y, 2, 0); });
    }
    const scrolled = down.scrolled; down = null;
    if (scrolled && !composing) keyboardAway();   // KB-01: a scroll puts the keyboard away
    else keyboardFor();
  });
  canvas.addEventListener('pointercancel', () => { if (down) clearTimeout(down.hold); down = null; });
  canvas.addEventListener('mousedown', (e) => e.preventDefault());   // only on the canvas itself: the compat mouse events after a touch keep the keyboard
  let hwheelTimer = 0;   // KCAL-01: a trackpad's horizontal swipe is a sideways drag (KM_PAN) for the apps that take one (Calendar: a month per swipe)
  document.getElementById('stage').addEventListener('wheel', (e) => {
    e.preventDefault(); const [x, y] = at(e);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && W.web_pan && W.web_pan(x, y)) {
      input('pan', () => W.web_pointer(x, y, 6, Math.round(-e.deltaX))); clearTimeout(hwheelTimer); hwheelTimer = setTimeout(() => input('pan', () => W.web_pointer(x, y, 6, 0)), 160); return;
    }
    const n = Math.sign(-e.deltaY); if (n) input('wheel', () => W.web_pointer(x, y, 4, n));
  }, { passive: false });
  for (const k in edges) edges[k].addEventListener('click', (e) => {
    if (!W) return; const [x, y] = at(e);
    if (k === 'bottom' && standalone()) { input('home', () => W.web_home()); keyboardFor(); return; }
    input('tap', () => { W.web_pointer(x, y, 0, 0); W.web_pointer(x, y, 2, 0); }); keyboardFor();
  });
  // a Safari tab is not an app: no cover, so the toolbar and the address bar keep their room
  if (!standalone() && !desktop && !desk) document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  layoutEdges();

  // the keyboard opening shrinks the visual viewport: draw into what is left so the caret stays above it
  let lastIn = ''; const resized = () => { layoutEdges(); if (!W || desktop) return;
    if (desk) { const [w, h] = size(); if (w === cw && h === ch) return; if (W.web_resize(w, h, 0, 0) === 0) { fit(w, h); W.web_frame(); } else log.push('WEB desk resize refused ' + w + 'x' + h); return; } const [w, h] = size(), ins = insets().join(); if (w === cw && h === ch && ins === lastIn) return; lastIn = ins; if (W.web_resize(w, h, ...insets()) === 0) { fit(w, h); rgbaPtr = W.web_rgba(); W.web_frame(); } };
  (window.visualViewport || window).addEventListener('resize', resized);
  document.addEventListener('visibilitychange', () => { if (document.hidden && W) W.web_save_now(); });
  window.addEventListener('pagehide', () => { if (W) W.web_save_now(); });
  reset();
  // A page and a wasm from different builds (an old cache) fail to link: clear the caches and the service worker and
  // load once more from the network, by itself. Only once per tab, so a real fault still says so.
  function safeMode() { try { return sessionStorage.getItem('zeus-safe') === '1'; } catch (e) { return false; } }   // LITE-WHITE: this tab's start did not fit once
  async function recover(e) {
    const wasmFault = (window.WebAssembly && (e instanceof WebAssembly.LinkError || e instanceof WebAssembly.CompileError)) || /LinkError|CompileError|import/.test(String(e));
    if (!wasmFault || sessionStorage.getItem('zeus-recovered')) throw e;
    sessionStorage.setItem('zeus-recovered', '1'); log.push('WEB recover ' + e);
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (x) { /* no caches */ }
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (x) { /* no worker */ }
    location.reload(); return new Promise(() => {});
  }
  window.__webready = boot().then(() => sessionStorage.removeItem('zeus-recovered')).catch(recover)
    .catch((e) => { log.push('WEB error ' + e); bootUI.fail(e); });
  // VEDIT-CAPCUT-2: measuring the phone import where no file picker can be driven (the iPhone simulator's Safari, tests/sim_phone_import.py):
  // ?benchimport=URL[,URL] fetches each file and puts it through the same path as a picked one (videos to the Video Editor), timing each;
  // ?benchreport=URL gets the numbers as JSON. Our own sample files only; nothing is sent anywhere else.
  if (q.get('benchimport')) window.__webready.then(async () => {
    const out = { ua: navigator.userAgent, items: [] };
    for (const u of q.get('benchimport').split(',')) {
      try {
        const t0 = performance.now(), r = await fetch(u), b = await r.blob(), t1 = performance.now(), name = decodeURIComponent(u.split('/').pop().split('?')[0]);
        const f = new File([b], name, { type: b.type || (/\.mov$/i.test(name) ? 'video/quicktime' : /\.hei[cf]$/i.test(name) ? 'image/heic' : '') });
        const n0 = log.length; await takePicked([f], true); const t2 = performance.now();
        out.items.push({ name, bytes: f.size, fetch_ms: Math.round(t1 - t0), import_ms: Math.round(t2 - t1), log: log.slice(n0).filter(l => /^WEB (vedit|heic|photo|add|pick)/.test(l)) });
      } catch (e) { out.items.push({ url: u, error: String(e) }); }
    }
    log.push('WEB bench ' + JSON.stringify(out));
    if (q.get('benchreport')) fetch(q.get('benchreport'), { method: 'POST', body: JSON.stringify(out) }).catch(() => {});
  });
})();
