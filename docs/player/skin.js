/*
 * Anikku player skin. The Anikku apps inject this into the website player frame (MegaPlay, a JW Player
 * page). It hides the stock controls, logo and ads and draws Anikku's own controls on top of the same
 * <video>, then talks to the watch page with postMessage: ready, progress, ended, error, next, prev, back.
 */
(() => {
  if (window.__anikkuSkin) return;
  window.__anikkuSkin = true;
  if (!/(^|\.)megaplay(-\d+)?\.buzz$/.test(location.hostname) || window.top === window) return;

  let info = { title: '', subtitle: '', startAt: 0, hasNext: false, hasPrev: false, autoskip: false };
  let marks = { intro: null, outro: null };
  const post = (type, extra = {}) => { try { parent.postMessage({ anikku: type, ...extra }, '*'); } catch (e) { /* detached */ } };
  try { window.open = () => null; } catch (e) { /* ignore */ }

  // intro/outro times arrive with the player's source request
  const setMarks = (intro, outro) => {
    const ok = r => r && r.end > r.start && r.end > 0 ? { start: +r.start, end: +r.end } : null;
    marks = { intro: ok(intro), outro: ok(outro) };
    if (ui) ui.drawMarks();
  };
  const xopen = XMLHttpRequest.prototype.open, xsend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__anxUrl = String(u); return xopen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (/getSources/i.test(this.__anxUrl || '')) this.addEventListener('load', () => {
      try { const d = JSON.parse(this.responseText); setMarks(d.intro, d.outro); } catch (e) { /* not json */ }
    });
    return xsend.apply(this, arguments);
  };

  // ads: anything the page injects outside the video player (frames, click-catching overlays) is removed
  let playerBox = null;  // set once JW Player is running; until then only obvious ad elements go
  const isPlayerPart = el => !!(el.closest && (el.closest('.jwplayer') || el.closest('#anikku-skin')))
    || (playerBox && el.contains(playerBox)) || (el.hasAttribute && (el.hasAttribute('data-id') || el.hasAttribute('data-realid')));
  const sweep = el => {
    if (!(el instanceof Element) || isPlayerPart(el) || el.id === 'anikku-skin') return;
    const tag = el.tagName;
    if (tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') { el.remove(); return; }
    if (el.matches && el.matches('.afs_ads, .ad-placement, [class*="ads-"], [id*="ads-"], [class*="popunder"], [id*="popunder"]')) { el.remove(); return; }
    if (playerBox && (tag === 'DIV' || tag === 'A' || tag === 'SECTION' || tag === 'ASIDE')) {
      const cs = getComputedStyle(el);
      const big = el.offsetWidth > innerWidth * 0.5 && el.offsetHeight > innerHeight * 0.5;
      if ((cs.position === 'fixed' || cs.position === 'absolute') && big && !el.querySelector('.jwplayer, video')) el.remove();
    }
  };
  new MutationObserver(list => {
    for (const m of list) m.addedNodes.forEach(n => { sweep(n); if (n.querySelectorAll) n.querySelectorAll('iframe, .afs_ads, .ad-placement').forEach(sweep); });
  }).observe(document, { childList: true, subtree: true });
  const sweepAll = () => document.querySelectorAll('body > *, iframe, .afs_ads, .ad-placement').forEach(sweep);
  document.addEventListener('DOMContentLoaded', sweepAll);
  setInterval(sweepAll, 2000);

  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || d.anikku !== 'init') return;
    info = { ...info, ...d };
    if (ui) ui.applyInfo();
  });

  let ui = null;
  const start = () => {
    const tick = setInterval(() => {
      if (document.querySelector('.error-content') && getComputedStyle(document.querySelector('.error-content')).display !== 'none'
          && !(window.jwplayer && window.jwplayer().getState)) {
        clearInterval(tick);
        post('error', { reason: 'This server has no video for this episode' });
        return;
      }
      const jw = window.jwplayer && window.jwplayer();
      if (!jw || !jw.getState || !jw.getContainer || !jw.getContainer()) return;
      clearInterval(tick);
      playerBox = jw.getContainer();
      ui = buildUI(jw);
      post('ready');
    }, 150);
    setTimeout(() => { if (!ui) { clearInterval(tick); post('error', { reason: 'The player did not start' }); } }, 25000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // ------------------------------------------------------------------------------------------------
  function buildUI(jw) {
    const touch = matchMedia('(hover: none)').matches;
    const page = document.createElement('style');
    page.textContent = `
      .jw-controls, .jw-display, .jw-logo, .jw-dock, .jw-title, .jw-nextup-container, .jw-rightclick, .jw-tooltip,
      .jw-controlbar, .jw-display-container, .jw-preview, .jw-icon-display, .botright, .zbtn, .afs_ads, .ad-placement,
      .jw-flag-floating .jw-float-bar { display: none !important; }
      html, body { background: #000 !important; overflow: hidden !important; }
      .jw-captions { transition: bottom .25s ease, transform .25s ease !important; }
      .anx-on .jw-captions { transform: translateY(-74px) !important; }
      .jw-text-track-cue { background: rgba(0,0,0,.55) !important; font-family: Inter, -apple-system, "Segoe UI", sans-serif !important;
        font-weight: 600 !important; border-radius: 6px !important; padding: 2px 8px !important; text-shadow: 0 2px 4px rgba(0,0,0,.7) !important; }`;
    document.head.appendChild(page);

    const host = document.createElement('div');
    host.id = 'anikku-skin';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const I = {
      play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
      pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/>',
      back10: '<path d="M4 12a8 8 0 1 0 2.5-5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.5" font-size="7.5" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Arial">10</text>',
      fwd10: '<path d="M20 12a8 8 0 1 1-2.5-5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.5" font-size="7.5" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Arial">10</text>',
      next: '<path d="M6 5l9 7-9 7z" fill="currentColor"/><rect x="16" y="5" width="2.6" height="14" rx="1.2" fill="currentColor"/>',
      cc: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      vol: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      mute: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      backArrow: '<path d="M19 12H5M11 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
      skip: '<path d="M5 5l8 7-8 7zM13 5l8 7-8 7z" fill="currentColor"/>',
    };
    const svg = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${I[n]}</svg>`;

    root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      .ui { position: absolute; inset: 0; font: 600 14px/1.3 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; color: #fff;
            user-select: none; -webkit-user-select: none; cursor: default; }
      .ui.idle { cursor: none; }
      .shade { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s;
               background: linear-gradient(180deg, rgba(0,0,0,.7) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.85) 100%); }
      .on .shade { opacity: 1; }
      .layer { opacity: 0; transition: opacity .3s, transform .3s; pointer-events: none; }
      .on .layer { opacity: 1; pointer-events: auto; }
      button { all: unset; cursor: pointer; display: inline-grid; place-items: center; border-radius: 999px; transition: background .2s, transform .15s, color .2s; }
      button:active { transform: scale(.9); }
      .top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 12px; padding: max(14px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left)); transform: translateY(-8px); }
      .on .top { transform: none; }
      .icon { width: 44px; height: 44px; color: #fff; }
      .icon:hover { background: rgba(255,255,255,.14); }
      .titles { min-width: 0; }
      .t1 { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ff9a3c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .t2 { font-size: 17px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
      .center { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(.92); display: flex; align-items: center; gap: clamp(28px, 7vw, 70px); }
      .on .center { transform: translate(-50%,-50%); }
      .big { width: 76px; height: 76px; background: linear-gradient(135deg,#ffa13d,#ff7a1a 45%,#f4511e); color: #160700; box-shadow: 0 12px 40px -6px rgba(255,122,26,.7); }
      .big:hover { transform: scale(1.06); }
      .mid { width: 56px; height: 56px; background: rgba(0,0,0,.35); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .mid:hover { background: rgba(255,255,255,.18); }
      .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 max(18px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); transform: translateY(8px); }
      .on .bottom { transform: none; }
      .seek { position: relative; height: 26px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
      .rail { position: relative; width: 100%; height: 5px; border-radius: 5px; background: rgba(255,255,255,.22); overflow: visible; transition: height .15s; }
      .seek:hover .rail, .seek.drag .rail { height: 7px; }
      .buf, .fill, .mark { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 5px; }
      .buf { background: rgba(255,255,255,.35); }
      .fill { background: linear-gradient(90deg,#ffa13d,#ff7a1a,#f4511e); box-shadow: 0 0 12px rgba(255,122,26,.7); }
      .mark { background: rgba(255,214,102,.55); border-radius: 2px; }
      .knob { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgba(255,122,26,.45), 0 2px 8px rgba(0,0,0,.5); transform: scale(0); transition: transform .15s; }
      .seek:hover .knob, .seek.drag .knob, .touch .knob { transform: scale(1); }
      .tip { position: absolute; bottom: 30px; padding: 4px 8px; border-radius: 6px; background: rgba(15,15,20,.92); font-size: 12px; transform: translateX(-50%); opacity: 0; pointer-events: none; white-space: nowrap; }
      .seek:hover .tip, .seek.drag .tip { opacity: 1; }
      .bar { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
      .bar .icon { width: 42px; height: 42px; }
      .time { margin: 0 8px; font-variant-numeric: tabular-nums; font-size: 13.5px; color: #e8e8ee; white-space: nowrap; }
      .grow { flex: 1; }
      .vol { display: flex; align-items: center; }
      .vol input { width: 0; opacity: 0; transition: width .25s, opacity .25s; accent-color: #ff7a1a; }
      .vol:hover input { width: 80px; opacity: 1; }
      .pill { position: absolute; right: max(22px, env(safe-area-inset-right)); bottom: 96px; display: none; align-items: center; gap: 8px; height: 44px; padding: 0 20px;
              border-radius: 999px; background: rgba(255,255,255,.95); color: #111; font-weight: 800; box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: pop .35s cubic-bezier(.3,.9,.3,1.3); }
      .pill.show { display: inline-flex; pointer-events: auto; }
      .pill:hover { background: #fff; transform: translateY(-2px); }
      @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(.95); } }
      .menu::-webkit-scrollbar { width: 6px; } .menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 6px; } .menu::-webkit-scrollbar-track { background: transparent; }
      .menu { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: 74px; min-width: 240px; max-height: calc(100% - 110px); overflow-y: auto; overflow-x: hidden;
              scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.2) transparent; padding: 8px; border-radius: 16px;
              background: rgba(18,18,24,.94); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 20px 50px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.08); display: none; }
      .menu.open { display: block; animation: pop .25s; }
      .menu h4 { margin: 6px 10px 6px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #8d8d99; }
      .opt { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 10px 12px; border-radius: 10px; font-weight: 600; }
      .opt:hover { background: rgba(255,255,255,.08); }
      .opt.sel { color: #ff9a3c; }
      .opt svg { opacity: 0; } .opt.sel svg { opacity: 1; }
      .spin { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px; border-radius: 50%; border: 4px solid rgba(255,255,255,.15); border-top-color: #ff7a1a; animation: sp .8s linear infinite; display: none; pointer-events: none; }
      .buffering .spin { display: block; }
      .buffering .center .big { opacity: 0; }
      @keyframes sp { to { transform: rotate(360deg); } }
      .ripple { position: absolute; top: 0; bottom: 0; width: 38%; display: grid; place-items: center; pointer-events: none; opacity: 0; }
      .ripple.l { left: 0; border-radius: 0 50% 50% 0; } .ripple.r { right: 0; border-radius: 50% 0 0 50%; }
      .ripple.go { animation: rip .6s ease-out; background: rgba(255,255,255,.08); }
      .ripple span { padding: 8px 14px; border-radius: 999px; background: rgba(0,0,0,.45); font-weight: 800; }
      @keyframes rip { 0% { opacity: 1; } 100% { opacity: 0; } }
      .touch .bar .hide-touch { display: none; }
      @media (max-width: 520px) { .big { width: 64px; height: 64px; } .mid { width: 48px; height: 48px; } .t2 { font-size: 15px; } .time { font-size: 12.5px; } }
    </style>
    <div class="ui on${touch ? ' touch' : ''}">
      <div class="shade"></div>
      <div class="ripple l"><span>−10s</span></div><div class="ripple r"><span>+10s</span></div>
      <div class="spin"></div>
      <div class="top layer">
        <button class="icon" data-a="back" aria-label="Back">${svg('backArrow')}</button>
        <div class="titles"><div class="t1"></div><div class="t2"></div></div>
      </div>
      <div class="center layer">
        <button class="mid" data-a="b10" aria-label="Back 10 seconds">${svg('back10', 28)}</button>
        <button class="big" data-a="toggle" aria-label="Play">${svg('play', 34)}</button>
        <button class="mid" data-a="f10" aria-label="Forward 10 seconds">${svg('fwd10', 28)}</button>
      </div>
      <button class="pill" data-a="skip">${svg('skip', 18)}<span>Skip Intro</span></button>
      <div class="menu"></div>
      <div class="bottom layer">
        <div class="seek"><div class="rail"><div class="marks"></div><div class="buf"></div><div class="fill"></div><div class="knob"></div></div><div class="tip">0:00</div></div>
        <div class="bar">
          <button class="icon" data-a="toggle" aria-label="Play">${svg('play')}</button>
          <button class="icon hide-touch" data-a="b10" aria-label="Back 10 seconds">${svg('back10')}</button>
          <button class="icon hide-touch" data-a="f10" aria-label="Forward 10 seconds">${svg('fwd10')}</button>
          <div class="vol hide-touch"><button class="icon" data-a="mute" aria-label="Mute">${svg('vol')}</button><input type="range" min="0" max="100" value="100"></div>
          <span class="time">0:00 / 0:00</span>
          <span class="grow"></span>
          <button class="icon" data-a="next" aria-label="Next episode" hidden>${svg('next')}</button>
          <button class="icon" data-a="cc" aria-label="Subtitles">${svg('cc')}</button>
          <button class="icon" data-a="settings" aria-label="Settings">${svg('gear')}</button>
          <button class="icon" data-a="full" aria-label="Fullscreen">${svg('full')}</button>
        </div>
      </div>
    </div>`;

    const $ = s => root.querySelector(s);
    const $$ = s => [...root.querySelectorAll(s)];
    const box = $('.ui'), seek = $('.seek'), fill = $('.fill'), buf = $('.buf'), knob = $('.knob'), tip = $('.tip');
    const menu = $('.menu'), pill = $('.pill'), timeEl = $('.time');
    const container = jw.getContainer();
    const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
    const dur = () => jw.getDuration() || 0;
    const pos = () => jw.getPosition() || 0;
    const playing = () => jw.getState() === 'playing';

    // ---- show/hide controls
    let idleTimer = null;
    const show = () => {
      box.classList.add('on'); box.classList.remove('idle'); container.classList.add('anx-on');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (playing() && !menu.classList.contains('open') && !seek.classList.contains('drag')) hide(); }, touch ? 3200 : 2600);
    };
    const hide = () => { box.classList.remove('on'); box.classList.add('idle'); container.classList.remove('anx-on'); closeMenu(); };
    box.addEventListener('mousemove', show);

    // ---- actions
    const seekBy = d => { jw.seek(Math.min(Math.max(0, pos() + d), Math.max(0, dur() - 1))); show(); };
    const toggle = () => { playing() ? jw.pause() : jw.play(); show(); };
    const actions = {
      back: () => post('back'), toggle, b10: () => seekBy(-10), f10: () => seekBy(10),
      next: () => post('next'),
      mute: () => { jw.setMute(!jw.getMute()); syncVol(); },
      cc: () => openMenu('cc'), settings: () => openMenu('settings'),
      full: () => {
        const v = document.querySelector('video');
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => v && v.webkitEnterFullscreen && v.webkitEnterFullscreen());
        else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      },
      skip: () => { const seg = currentSeg(); if (seg) jw.seek(seg.end + 0.5); pill.classList.remove('show'); },
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b) { e.stopPropagation(); actions[b.dataset.a](); return; }
      if (e.target.closest('.menu') || e.target.closest('.seek') || e.target.closest('.vol')) return;
      onSurfaceTap(e);
    });

    // tap the picture: toggle controls (touch) / play-pause (mouse); double-tap sides to seek
    let lastTap = 0, tapTimer = null;
    function onSurfaceTap(e) {
      const now = Date.now();
      const x = e.clientX / window.innerWidth;
      if (now - lastTap < 300 && (x < 0.38 || x > 0.62)) {
        clearTimeout(tapTimer);
        const right = x > 0.5;
        seekBy(right ? 10 : -10);
        const r = $(right ? '.ripple.r' : '.ripple.l');
        r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
        lastTap = 0;
        return;
      }
      lastTap = now;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        if (menu.classList.contains('open')) { closeMenu(); return; }
        if (touch) { box.classList.contains('on') ? hide() : show(); } else toggle();
      }, touch ? 260 : 200);
    }

    // ---- seek bar
    const ratioAt = cx => { const r = seek.querySelector('.rail').getBoundingClientRect(); return Math.min(1, Math.max(0, (cx - r.left) / r.width)); };
    let dragRatio = null;
    seek.addEventListener('pointerdown', e => {
      seek.setPointerCapture(e.pointerId); seek.classList.add('drag'); dragRatio = ratioAt(e.clientX); paint(); show();
    });
    seek.addEventListener('pointermove', e => {
      const r = ratioAt(e.clientX);
      tip.textContent = fmt(r * dur());
      tip.style.left = (r * 100) + '%';
      if (dragRatio !== null) { dragRatio = r; paint(); }
    });
    const endDrag = () => { if (dragRatio === null) return; jw.seek(dragRatio * dur()); dragRatio = null; seek.classList.remove('drag'); show(); };
    seek.addEventListener('pointerup', endDrag);
    seek.addEventListener('pointercancel', endDrag);

    function paint() {
      const d = dur(), p = dragRatio !== null ? dragRatio * d : pos();
      const r = d ? p / d : 0;
      fill.style.width = (r * 100) + '%';
      knob.style.left = (r * 100) + '%';
      buf.style.width = (jw.getBuffer() || 0) + '%';
      timeEl.textContent = `${fmt(p)} / ${fmt(d)}`;
      if (dragRatio !== null) { tip.textContent = fmt(p); tip.style.left = (r * 100) + '%'; }
    }

    // ---- intro / outro
    const currentSeg = () => {
      const p = pos();
      for (const k of ['intro', 'outro']) { const s = marks[k]; if (s && p >= s.start && p < s.end - 1) return { ...s, kind: k }; }
      return null;
    };
    let autoskipped = {};
    function drawMarks() {
      const d = dur();
      $('.marks').innerHTML = d ? ['intro', 'outro'].filter(k => marks[k]).map(k =>
        `<div class="mark" style="left:${marks[k].start / d * 100}%;width:${(marks[k].end - marks[k].start) / d * 100}%"></div>`).join('') : '';
    }
    function updateSkip() {
      const seg = currentSeg();
      if (seg && info.autoskip && !autoskipped[seg.kind]) { autoskipped[seg.kind] = true; jw.seek(seg.end + 0.5); return; }
      if (seg) {
        pill.querySelector('span').textContent = seg.kind === 'intro' ? 'Skip Intro' : (info.hasNext ? 'Skip Outro' : 'Skip Credits');
        pill.classList.add('show');
      } else pill.classList.remove('show');
    }

    // ---- menus
    function openMenu(kind) {
      if (menu.classList.contains('open') && menu.dataset.kind === kind) { closeMenu(); return; }
      menu.dataset.kind = kind;
      const check = svg('check', 18);
      if (kind === 'cc') {
        const list = jw.getCaptionsList() || [], cur = jw.getCurrentCaptions();
        const name = l => /\[LAT\]/i.test(l) ? 'Spanish (Latin America)' : /\[ESP\]/i.test(l) ? 'Spanish (Spain)'
          : /brazil/i.test(l) ? 'Portuguese (Brazil)' : l.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        menu.innerHTML = `<h4>Subtitles</h4>` + list.map((c, i) => `<button class="opt${i === cur ? ' sel' : ''}" data-cc="${i}"><span>${name(c.label)}</span>${check}</button>`).join('');
      } else {
        const q = jw.getQualityLevels() || [], cq = jw.getCurrentQuality(), rate = jw.getPlaybackRate();
        menu.innerHTML = (q.length > 1 ? `<h4>Quality</h4>` + q.map((l, i) => `<button class="opt${i === cq ? ' sel' : ''}" data-q="${i}"><span>${l.label}</span>${check}</button>`).join('') : '')
          + `<h4>Speed</h4>` + [0.75, 1, 1.25, 1.5, 2].map(r => `<button class="opt${r === rate ? ' sel' : ''}" data-rate="${r}"><span>${r === 1 ? 'Normal' : r + '×'}</span>${check}</button>`).join('');
      }
      menu.classList.add('open');
      show();
      menu.querySelectorAll('[data-cc]').forEach(b => b.onclick = e => { e.stopPropagation(); jw.setCurrentCaptions(+b.dataset.cc); closeMenu(); });
      menu.querySelectorAll('[data-q]').forEach(b => b.onclick = e => { e.stopPropagation(); jw.setCurrentQuality(+b.dataset.q); closeMenu(); });
      menu.querySelectorAll('[data-rate]').forEach(b => b.onclick = e => { e.stopPropagation(); jw.setPlaybackRate(+b.dataset.rate); closeMenu(); });
    }
    function closeMenu() { menu.classList.remove('open'); }

    // ---- volume
    const volInput = root.querySelector('.vol input');
    const syncVol = () => {
      const muted = jw.getMute();
      root.querySelector('[data-a="mute"]').innerHTML = svg(muted || !jw.getVolume() ? 'mute' : 'vol');
      volInput.value = muted ? 0 : jw.getVolume();
    };
    volInput.addEventListener('input', () => { jw.setVolume(+volInput.value); jw.setMute(+volInput.value === 0); syncVol(); show(); });

    // ---- keyboard (desktop)
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
      else if (k === 'arrowright' || k === 'l') seekBy(k === 'l' ? 10 : 5);
      else if (k === 'arrowleft' || k === 'j') seekBy(k === 'j' ? -10 : -5);
      else if (k === 'f') actions.full();
      else if (k === 'm') actions.mute();
      else if (k === 'n' && info.hasNext) post('next');
      else if (k === 'escape') post('back');
    });

    // ---- state
    const syncPlay = () => {
      const p = playing();
      $$('[data-a="toggle"]').forEach((b, i) => { b.innerHTML = svg(p ? 'pause' : 'play', i === 0 ? 34 : 24); b.setAttribute('aria-label', p ? 'Pause' : 'Play'); });
      if (!p) show();
    };
    jw.on('play', () => { box.classList.remove('buffering'); syncPlay(); show(); });
    jw.on('pause', syncPlay);
    jw.on('buffer', () => box.classList.add('buffering'));
    jw.on('firstFrame', () => box.classList.remove('buffering'));
    jw.on('complete', () => { post('ended', { d: dur() }); syncPlay(); });
    jw.on('error', ev => post('error', { reason: (ev && ev.message) || 'Playback error' }));
    jw.on('meta', drawMarks);
    jw.on('mute', syncVol);
    jw.on('volume', syncVol);

    let startDone = false;
    let lastReport = 0;
    setInterval(() => {
      paint();
      updateSkip();
      if (!startDone && info.startAt > 5 && dur() > 0) { startDone = true; jw.seek(info.startAt); }
      if (playing() && Date.now() - lastReport > 2000) { lastReport = Date.now(); post('progress', { t: pos(), d: dur() }); }
    }, 250);

    function applyInfo() {
      $('.t1').textContent = info.title || '';
      $('.t2').textContent = info.subtitle || '';
      root.querySelector('[data-a="next"]').hidden = !info.hasNext;
      if (!startDone && info.startAt > 5 && dur() > 0) { startDone = true; jw.seek(info.startAt); }
    }
    applyInfo();
    syncPlay();
    syncVol();
    drawMarks();
    show();
    if (jw.getState() === 'idle') { try { jw.play(); } catch (e) { /* needs a tap */ } }
    return { applyInfo, drawMarks };
  }
})();
