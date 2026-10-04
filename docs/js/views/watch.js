import * as api from '../api.js';
import * as store from '../store.js';
import { orderedServers } from '../servers.js';
import { icon, esc, titleOf, cleanText, toast, errorBox } from '../ui.js';

// The Anikku apps (iOS, Ciname, Ciname TV) inject a skin into the player frame. It talks to this page
// with postMessage: ready / progress / ended / error / next / prev / back / menu, and receives "init"
// (and, on a TV, the remote's keys as {anikkuCmd: 'key'}).

export async function render(view, token, id, epStr) {
  const ep = Math.max(1, parseInt(epStr, 10) || 1);
  view.innerHTML = `<div class="watch"><div class="player-wrap"><div class="player-box loading"><div class="spinner"></div></div></div></div>`;
  let m, ex;
  try {
    [m, ex] = await Promise.all([api.media(id), api.extras(id)]);
  } catch (e) {
    if (token.current) view.innerHTML = errorBox(e.message);
    return;
  }
  if (!token.current) return;
  if (!m || m.blocked) { view.innerHTML = errorBox("This title isn't available in Anikku", false); return; }

  const total = api.availableEpisodes(m, ex) || ep;
  const e = ex?.episodes?.[ep] || {};
  const epName = e.title && !/^episode\s*\d+$/i.test(e.title) ? e.title : '';
  const servers = orderedServers(store.settings());
  const hist = store.animeHistory(m.id);
  const saved = hist?.progress?.[ep];
  const startAt = saved && saved[1] && saved[0] / saved[1] < 0.92 ? saved[0] : 0;
  let serverIdx = 0;
  let skinned = false;
  let lastSave = 0;
  let endTimer = null;

  // opening an episode puts it in Continue Watching straight away
  store.saveProgress(m, ep, startAt, saved?.[1] || 0);

  const s = store.settings();
  view.innerHTML = `
  <div class="watch" style="--tint:${m.coverImage?.color || '#f47521'}">
    <div class="player-wrap">
      <div class="player-box">
        <iframe id="player" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen
                referrerpolicy="origin"></iframe>
        <div class="player-veil"><div class="spinner"></div><span>Loading ${esc(servers[0]?.name || 'player')}…</span></div>
        <div class="next-up" hidden></div>
      </div>
    </div>
    <div class="watch-body">
      <div class="watch-main">
        <a class="watch-series" href="#/anime/${m.id}">${esc(titleOf(m))}</a>
        <h1 class="watch-title">Episode ${ep}${epName ? ` – ${esc(epName)}` : ''}</h1>
        ${e.overview ? `<p class="watch-overview">${esc(cleanText(e.overview))}</p>` : ''}
        <div class="watch-actions">
          <a class="btn glass small${ep <= 1 ? ' disabled' : ''}" href="#/watch/${m.id}/${ep - 1}">${icon('prev', 16)} Previous</a>
          <a class="btn primary small${ep >= total ? ' disabled' : ''}" href="#/watch/${m.id}/${ep + 1}">Next episode ${icon('next', 16)}</a>
          <button class="btn glass small" data-watched>${icon('check', 16)} <span></span></button>
        </div>
        <div class="watch-opts">
          <div class="opt-group">
            <span class="opt-label">Audio</span>
            <div class="seg">
              <button class="${s.audio === 'sub' ? 'on' : ''}" data-audio="sub">Sub</button>
              <button class="${s.audio === 'dub' ? 'on' : ''}" data-audio="dub">Dub</button>
            </div>
          </div>
          <div class="opt-group">
            <span class="opt-label">${icon('server', 15)} Server</span>
            <div class="servers">${servers.map((sv, i) => `<button class="srv${i === 0 ? ' on' : ''}" data-srv="${i}">${esc(sv.name)}</button>`).join('')}</div>
          </div>
        </div>
        <p class="watch-hint">Not playing? Try another server or switch between Sub and Dub.</p>
      </div>
      <aside class="watch-side">
        <h3>Episodes <span>${total}</span></h3>
        <div class="ep-list">${episodeList(m, ex, total, ep)}</div>
      </aside>
    </div>
  </div>`;

  const frame = view.querySelector('#player');
  const veil = view.querySelector('.player-veil');
  const nextUp = view.querySelector('.next-up');

  const load = () => {
    const sv = servers[serverIdx];
    const url = sv?.url(m, ep, store.settings().audio);
    view.querySelectorAll('.srv').forEach((b, i) => b.classList.toggle('on', i === serverIdx));
    if (!url) { tryNextServer('This server has no match for this show'); return; }
    veil.hidden = false;
    veil.querySelector('span').textContent = `Loading ${sv.name}…`;
    frame.src = url;
  };
  const tryNextServer = why => {
    if (serverIdx < servers.length - 1) {
      serverIdx++;
      toast(`${why} – trying ${servers[serverIdx].name}`);
      load();
    } else {
      veil.hidden = false;
      veil.innerHTML = `${icon('info', 26)}<span>${esc(why)}. Try Dub/Sub or another episode.</span>`;
    }
  };
  frame.addEventListener('load', () => setTimeout(() => { if (!skinned) veil.hidden = true; }, 600));

  const updateWatchedBtn = () => {
    const w = store.animeHistory(m.id)?.watched?.[ep];
    const b = view.querySelector('[data-watched]');
    b.classList.toggle('on', !!w);
    b.querySelector('span').textContent = w ? 'Watched' : 'Mark watched';
  };
  view.querySelector('[data-watched]').onclick = () => {
    const w = !store.animeHistory(m.id)?.watched?.[ep];
    store.markWatched(m, ep, w);
    updateWatchedBtn();
  };
  updateWatchedBtn();

  view.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => {
    store.setSetting('audio', b.dataset.audio);
    view.querySelectorAll('[data-audio]').forEach(x => x.classList.toggle('on', x === b));
    serverIdx = 0;
    load();
  });
  view.querySelectorAll('[data-srv]').forEach(b => b.onclick = () => { serverIdx = +b.dataset.srv; load(); });

  const goNext = () => { if (ep < total) location.hash = `#/watch/${m.id}/${ep + 1}`; };

  // Ciname TV: the player box takes the remote's focus ring when the episode opens, and while it has
  // it the remote drives the player skin. Down (with no player menu open) moves on to the buttons and
  // episodes below, Back leaves the episode.
  let menuOpen = false;
  const tv = document.documentElement.classList.contains('tv');
  if (tv) {
    const box = view.querySelector('.player-box');
    box.tabIndex = 0;
    box.setAttribute('data-tv-autofocus', '');
    box.__tvKey = key => {
      if ((key === 'down' || key === 'back') && !menuOpen) return false;
      if (frame.contentWindow) frame.contentWindow.postMessage({ anikkuCmd: 'key', key }, '*');
      return true;
    };
    try { window.CinameTV && window.CinameTV.watching(true); } catch (e) { /* not on the TV */ }
    token.cleanup.push(() => { try { window.CinameTV && window.CinameTV.watching(false); } catch (e) { /* gone */ } });
  }

  const onMessage = ev => {
    if (ev.source !== frame.contentWindow) return;
    const msg = ev.data;
    if (!msg || typeof msg !== 'object' || !msg.anikku) return;
    switch (msg.anikku) {
      case 'ready':
        skinned = true;
        veil.hidden = true;
        frame.contentWindow.postMessage({
          anikku: 'init',
          title: titleOf(m),
          subtitle: `E${ep}${epName ? ` – ${epName}` : ''}`,
          startAt,
          hasNext: ep < total,
          hasPrev: ep > 1,
          autoskip: store.settings().autoskip,
        }, '*');
        break;
      case 'progress':
        if (Date.now() - lastSave > 4000 && msg.d > 0) {
          lastSave = Date.now();
          store.saveProgress(m, ep, msg.t, msg.d);
          if (msg.t / msg.d > 0.9) updateWatchedBtn();
        }
        break;
      case 'ended':
        store.saveProgress(m, ep, msg.d || 1, msg.d || 1);
        updateWatchedBtn();
        if (store.settings().autoplay && ep < total) {
          let n = 6;
          nextUp.hidden = false;
          const tick = () => {
            nextUp.innerHTML = `<span>Next episode in ${n}</span><button class="btn primary small" data-go>Play now</button><button class="btn glass small" data-stay>Cancel</button>`;
            nextUp.querySelector('[data-go]').onclick = goNext;
            nextUp.querySelector('[data-stay]').onclick = () => { clearTimeout(endTimer); nextUp.hidden = true; };
            if (n-- <= 0) goNext(); else endTimer = setTimeout(tick, 1000);
          };
          tick();
        }
        break;
      case 'error':
        tryNextServer(msg.reason || `${servers[serverIdx]?.name} can't play this episode`);
        break;
      case 'next': goNext(); break;
      case 'menu': menuOpen = !!msg.open; break;
      case 'prev': if (ep > 1) location.hash = `#/watch/${m.id}/${ep - 1}`; break;
      case 'back': history.length > 1 ? history.back() : (location.hash = `#/anime/${m.id}`); break;
    }
  };
  window.addEventListener('message', onMessage);
  token.cleanup.push(() => { window.removeEventListener('message', onMessage); clearTimeout(endTimer); });

  // keep the current episode visible in the side list (scroll the list only, never the page)
  const list = view.querySelector('.ep-list');
  const cur = list.querySelector('.on');
  if (cur && list.scrollHeight > list.clientHeight) list.scrollTop = cur.offsetTop - list.offsetTop - list.clientHeight / 2 + cur.clientHeight / 2;
  document.title = `${titleOf(m)} · E${ep} · Anikku`;
  load();
}

function episodeList(m, ex, total, current) {
  const h = store.animeHistory(m.id);
  const from = Math.max(1, current - 50), to = Math.min(total, current + 150);
  let html = '';
  for (let n = from; n <= to; n++) {
    const e = ex?.episodes?.[n] || {};
    const name = e.title && !/^episode\s*\d+$/i.test(e.title) ? e.title : `Episode ${n}`;
    const still = e.image;
    html += `<a class="ep-row${n === current ? ' on' : ''}${h?.watched?.[n] ? ' watched' : ''}" href="#/watch/${m.id}/${n}">
      <div class="ep-row-thumb">${still ? `<img loading="lazy" src="${esc(still)}" alt="">` : `<span>${n}</span>`}${n === current ? `<i class="eq"><b></b><b></b><b></b></i>` : ''}</div>
      <div><div class="ep-row-num">E${n}${e.runtime ? ` · ${e.runtime}m` : ''}</div><div class="ep-row-title">${esc(name)}</div></div>
    </a>`;
  }
  return html;
}
