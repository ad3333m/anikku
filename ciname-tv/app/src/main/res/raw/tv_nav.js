// D-pad navigation for the three pages Ciname TV shows: the picker, Anikku and cinejoy.pk.
//
// The Activity never lets the WebView see the D-pad (its own handling walks the DOM in document order,
// so on a poster grid "right" can land three rows down). It calls TvNav.key('right') instead, and this
// picks the target geometrically: the nearest candidate whose box lies in that direction, with
// misalignment penalised. This is Cinejoy TV's navigator (ad3333m/cinejoy-android) made general:
//
//  - window.TvNavConfig = { accent: '#ff7a1a' } sets the ring colour before this runs;
//  - an element with a __tvKey(key) function gets the remote's keys while it has the ring and returns
//    true for the ones it used (Anikku's player box hands them to the player skin);
//  - [data-tv-autofocus] marks where the ring lands when a screen opens.
//
// While a player is full screen (Cinejoy's players) the same machinery is scoped to the player's
// own controls, so the transport bar can be walked and its buttons pressed.

(function () {
  if (window.TvNav) { window.TvNav.rescan(); return; }

  var cfg = window.TvNavConfig || {};
  var ACCENT = cfg.accent || '#95FF50';
  var RING = 'tvnav-focus';
  var HIDDEN = 'tvnav-bar-hidden';
  var BAR = 'tvnav-bar-part';
  var BUTTON_ID = 'tvnav-hide-bar';
  var current = null;

  // --- what counts as something you can land on -------------------------

  var SELECTOR = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea',
    'video', 'summary', '[tabindex]:not([tabindex="-1"])',
    '[role=button]', '[role=link]', '[role=option]', '[role=menuitem]',
    '[role=slider]', '[role=tab]', '[onclick]',
  ].join(',');

  function fullscreenEl() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function visible(el) {
    if (!el || el.disabled) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    if (r.bottom < -window.innerHeight || r.top > 2 * window.innerHeight) return false;
    if (r.right < -window.innerWidth || r.left > 2 * window.innerWidth) return false;
    var s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
    if (el.closest && el.closest('[hidden],[aria-hidden=true],.disabled')) return false;
    return true;
  }

  // The scan is the expensive part - querySelectorAll plus a getComputedStyle per survivor, over a
  // home screen with hundreds of posters - so it is cached and only dropped when the page changes.
  var cache = null;
  var cacheAt = 0;
  var CACHE_MS = 700;

  function dropCache() { cache = null; }

  function candidates() {
    var now = Date.now();
    if (cache && now - cacheAt < CACHE_MS) return cache;

    var scope = fullscreenEl() || document;
    var out = [];
    var all = scope.querySelectorAll(SELECTOR);
    for (var i = 0; i < all.length; i++) {
      if (all[i].tagName === 'VIDEO') continue;          // focusable, but landing on it does nothing
      if (visible(all[i])) out.push(all[i]);
    }
    var hideBtn = document.getElementById(BUTTON_ID);
    if (hideBtn && fullscreenEl() && visible(hideBtn) && out.indexOf(hideBtn) < 0) out.push(hideBtn);

    cache = out;
    cacheAt = now;
    return out;
  }

  function box(el) {
    var r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // --- picking the next target ------------------------------------------

  // Distance along the direction of travel plus a penalty for how far off the perpendicular axis the
  // candidate sits, so a badly aligned near element loses to a well aligned slightly further one.
  function score(from, to, dir) {
    var ahead, off, overlap;
    if (dir === 'left' || dir === 'right') {
      ahead = dir === 'right' ? to.l - from.r : from.l - to.r;
      off = Math.abs(to.y - from.y);
      overlap = Math.min(from.b, to.b) - Math.max(from.t, to.t);
    } else {
      ahead = dir === 'down' ? to.t - from.b : from.t - to.b;
      off = Math.abs(to.x - from.x);
      overlap = Math.min(from.r, to.r) - Math.max(from.l, to.l);
    }
    if (ahead < -4) return Infinity;
    if (ahead < 0) ahead = 0;
    var aligned = overlap > 0 ? 0 : off * 2;
    return ahead + off * 0.6 + aligned;
  }

  function nearestToViewport(list) {
    var best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var b = box(list[i]);
      if (b.b < 0 || b.t > window.innerHeight) continue;
      var s = b.t * 0.5 + b.l * 0.1;
      if (s < bestScore) { bestScore = s; best = list[i]; }
    }
    return best || list[0] || null;
  }

  // --- styling -----------------------------------------------------------

  function style() {
    if (document.getElementById('tvnav-style')) return;
    var css = document.createElement('style');
    css.id = 'tvnav-style';
    // Thick, because this is read from three metres away. The outline sits outside the box so it never
    // shifts the layout. Pages can restyle .tvnav-focus for their own cards.
    css.textContent =
      '.' + RING + '{outline:4px solid ' + ACCENT + ' !important;outline-offset:3px !important;' +
      'box-shadow:0 0 0 7px rgba(0,0,0,.6),0 0 24px ' + ACCENT + '88 !important;' +
      'transition:outline-color .12s linear,box-shadow .12s linear !important;scroll-margin:22vh 10vw !important;}' +
      'html{scroll-behavior:smooth !important;}' +
      'html.' + HIDDEN + ' video::-webkit-media-controls{display:none !important;}' +
      'html.' + HIDDEN + ' video::-webkit-media-controls-enclosure{display:none !important;}' +
      'html.' + HIDDEN + ' .' + BAR + '{opacity:0 !important;pointer-events:none !important;}' +
      '#' + BUTTON_ID + '{position:fixed;right:3.2vw;bottom:3.2vh;z-index:2147483647;width:64px;height:64px;' +
      'border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(10,10,12,.82);color:' + ACCENT + ';' +
      'cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;}' +
      'html.tvnav-fs #' + BUTTON_ID + '{display:flex;}' +
      'html.' + HIDDEN + ' #' + BUTTON_ID + '{opacity:.25;}' +
      '#' + BUTTON_ID + ' svg{width:34px;height:34px;display:block;}';
    (document.head || document.documentElement).appendChild(css);
  }

  function mark(el) {
    if (current && current !== el) current.classList.remove(RING);
    current = el;
    if (!el) return;
    el.classList.add(RING);
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    if (!fullscreenEl()) {
      try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    }
  }

  function stillThere(el) {
    return el && el.isConnected && visible(el);
  }

  // --- a full-screen player's transport bar (Cinejoy's players) -------------

  // Custom players build their controls out of ordinary divs, so the bar is found by shape: a wide,
  // short, bottom-anchored box inside the full-screen element that holds buttons.
  function findBars() {
    var scope = fullscreenEl();
    if (!scope) return;
    var host = scope.getBoundingClientRect();
    var all = scope.querySelectorAll('div,nav,footer,section,[class*=control],[class*=bar]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.id === BUTTON_ID || el.closest('#' + BUTTON_ID)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < host.width * 0.5) continue;
      if (r.height > host.height * 0.45) continue;
      if (r.bottom < host.bottom - host.height * 0.4) continue;
      if (!el.querySelector('button,[role=button],input[type=range],[role=slider]')) continue;
      el.classList.add(BAR);
    }
  }

  function makeHideButton() {
    if (document.getElementById(BUTTON_ID)) return document.getElementById(BUTTON_ID);
    var b = document.createElement('button');
    b.id = BUTTON_ID;
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', 'Hide the player controls');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); TvBar.toggle(); });
    document.body.appendChild(b);
    return b;
  }

  var TvBar = {
    hidden: function () { return document.documentElement.classList.contains(HIDDEN); },
    hide: function () {
      findBars();
      document.documentElement.classList.add(HIDDEN);
      var v = document.querySelectorAll('video');
      for (var i = 0; i < v.length; i++) { try { v[i].controls = false; } catch (e) {} }
      return true;
    },
    show: function () {
      document.documentElement.classList.remove(HIDDEN);
      var v = document.querySelectorAll('video');
      for (var i = 0; i < v.length; i++) { try { v[i].controls = true; } catch (e) {} }
      findBars();
      return true;
    },
    toggle: function () { return this.hidden() ? this.show() : this.hide(); },
  };
  window.TvBar = TvBar;

  // --- the API the Activity calls ---------------------------------------

  // Holding the D-pad fires faster than the scroll can settle; dropping presses inside one step keeps
  // the ring in step with the page instead of running ahead and catching up in a lurch.
  var lastMoveAt = 0;
  var MIN_STEP_MS = 70;

  var TvNav = {
    /** One remote key: up/down/left/right/ok/back/playpause/ff/rw/next/menu. */
    key: function (k) {
      if (stillThere(current) && typeof current.__tvKey === 'function') {
        try { if (current.__tvKey(k)) return 'handled'; } catch (e) {}
      }
      switch (k) {
        case 'up': case 'down': case 'left': case 'right': return this.move(k);
        case 'ok': return this.activate();
        case 'playpause': return String(this.playPause());
        case 'ff': return String(this.seek(10));
        case 'rw': return String(this.seek(-10));
        default: return 'unhandled';
      }
    },

    move: function (dir) {
      var now = Date.now();
      if (now - lastMoveAt < MIN_STEP_MS) return 'busy';
      lastMoveAt = now;

      var list = candidates();
      if (!list.length) return 'none';
      if (!stillThere(current)) { mark(this.landing(list)); return 'entered'; }

      var from = box(current);
      var best = null, bestScore = Infinity;
      for (var i = 0; i < list.length; i++) {
        if (list[i] === current) continue;
        var s = score(from, box(list[i]), dir);
        if (s < bestScore) { bestScore = s; best = list[i]; }
      }
      if (!best) return 'edge';
      mark(best);
      return 'moved';
    },

    /** Where the ring lands on a new screen: its [data-tv-autofocus], else the first thing in <main>. */
    landing: function (list) {
      var auto = document.querySelector('[data-tv-autofocus]');
      if (auto && visible(auto)) return auto;
      list = list || candidates();
      var main = document.querySelector('main, [role=main]');
      if (main) {
        var inMain = list.filter(function (el) { return main.contains(el); });
        if (inMain.length) return nearestToViewport(inMain);
      }
      return nearestToViewport(list);
    },

    /** Put the ring somewhere sensible when a screen opens. */
    autofocus: function () {
      dropCache();
      var el = this.landing();
      if (el) mark(el);
      return el ? 'ok' : 'none';
    },

    focus: function (el) { if (el) { dropCache(); mark(el); } return 'ok'; },

    scroll: function (dir) {
      var by = Math.round(window.innerHeight * 0.8);
      window.scrollBy({ top: dir === 'down' ? by : -by, behavior: 'smooth' });
    },

    /** OK: press what has the ring. Text fields say so, so the Activity can bring up the keyboard. */
    activate: function () {
      if (!stillThere(current)) return 'none';
      var tag = current.tagName;
      if ((tag === 'INPUT' && !/^(button|submit|checkbox|radio|range)$/i.test(current.type)) || tag === 'TEXTAREA') {
        current.focus();
        return 'input';
      }
      current.click();
      return 'clicked';
    },

    /** OK while full screen: press the focused control, or play/pause when nothing is focused. */
    okInPlayer: function () {
      if (stillThere(current) && current.id !== BUTTON_ID && current.closest && current.closest('.' + BAR)) {
        current.click();
        return 'control';
      }
      if (stillThere(current) && current.id === BUTTON_ID) { TvBar.toggle(); return 'bar'; }
      this.playPause();
      return 'playpause';
    },

    playPause: function () {
      var media = document.querySelectorAll('video,audio');
      for (var i = 0; i < media.length; i++) { if (media[i].paused) media[i].play(); else media[i].pause(); }
      return media.length;
    },

    seek: function (seconds) {
      var v = document.querySelector('video');
      if (!v) return false;
      v.currentTime = Math.max(0, v.currentTime + seconds);
      return true;
    },

    enterPlayer: function () {
      document.documentElement.classList.add('tvnav-fs');
      style();
      makeHideButton();
      findBars();
      current = null;
      return 'ok';
    },

    leavePlayer: function () {
      document.documentElement.classList.remove('tvnav-fs');
      TvBar.show();
      current = null;
      return 'ok';
    },

    rescan: function () {
      style();
      if (fullscreenEl()) { makeHideButton(); findBars(); }
      if (!stillThere(current)) current = null;
    },
  };
  window.TvNav = TvNav;

  style();

  // Pages route on the client, so the DOM is replaced without a load. When the element with the ring
  // goes, land on the new screen's [data-tv-autofocus] (or the nearest thing) so the remote never goes dead.
  var settle = null;
  new MutationObserver(function () {
    dropCache();
    clearTimeout(settle);
    settle = setTimeout(function () {
      style();
      if (fullscreenEl()) findBars();
      if (!stillThere(current)) { current = null; if (!fullscreenEl()) TvNav.autofocus(); }
    }, 250);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('resize', dropCache, { passive: true });
  TvNav.autofocus();
})();
