import * as api from '../api.js';
import * as store from '../store.js';
import { SERVERS, orderedServers } from '../servers.js';
import { icon, esc, titleOf, posterCard, resumeCard, toast, errorBox, fmtClock } from '../ui.js';

// ---------------------------------------------------------------- Browse

const SORTS = [['TRENDING_DESC', 'Trending'], ['POPULARITY_DESC', 'Popular'], ['SCORE_DESC', 'Top rated'], ['START_DATE_DESC', 'Newest'], ['FAVOURITES_DESC', 'Most loved']];
const FORMATS = [['', 'Any format'], ['TV', 'TV'], ['MOVIE', 'Movie'], ['ONA', 'ONA'], ['OVA', 'OVA'], ['SPECIAL', 'Special']];
const STATUSES = [['', 'Any status'], ['RELEASING', 'Airing'], ['FINISHED', 'Finished'], ['NOT_YET_RELEASED', 'Upcoming']];

export async function browse(view, token, params) {
  const f = {
    genre: params.get('genre') || '', sort: params.get('sort') || 'TRENDING_DESC', format: params.get('format') || '',
    status: params.get('status') || '', year: params.get('year') || '', season: params.get('season') || '',
  };
  const heading = f.genre || (f.season ? `${f.season[0]}${f.season.slice(1).toLowerCase()} ${f.year}` : 'Browse');
  view.innerHTML = `
  <div class="page">
    <div class="page-head"><h1>${esc(heading)}</h1><p>Every anime on AniList, filtered your way</p></div>
    <div class="genre-chips">
      <a class="chip${!f.genre ? ' on' : ''}" href="${link({ ...f, genre: '' })}">All</a>
      ${api.GENRES.map(g => `<a class="chip${f.genre === g ? ' on' : ''}" href="${link({ ...f, genre: g })}">${esc(g)}</a>`).join('')}
    </div>
    <div class="filters">
      ${select('sort', SORTS, f.sort)}${select('format', FORMATS, f.format)}${select('status', STATUSES, f.status)}
    </div>
    <div class="grid" id="browse-grid"></div>
    <div class="loader-row" id="browse-more"><div class="spinner"></div></div>
  </div>`;
  view.querySelectorAll('.filters select').forEach(sel => sel.onchange = () => {
    location.hash = link({ ...f, [sel.name]: sel.value });
  });
  await infinite(view, token, page => api.browse({ ...f, page }));
}

function select(name, opts, value) {
  return `<select class="select" name="${name}">${opts.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

function link(f) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return '#/browse?' + p.toString();
}

async function infinite(view, token, fetchPage) {
  const grid = view.querySelector('#browse-grid');
  const more = view.querySelector('#browse-more');
  let page = 1, busy = false, done = false;
  const next = async () => {
    if (busy || done) return;
    busy = true;
    try {
      const res = await fetchPage(page);
      if (!token.current) return;
      grid.insertAdjacentHTML('beforeend', res.media.map(m => posterCard(m)).join(''));
      done = !res.pageInfo.hasNextPage;
      page++;
      if (done) more.innerHTML = grid.children.length ? '' : '<div class="empty"><p>Nothing found.</p></div>';
    } catch (e) {
      more.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
      done = true;
    } finally { busy = false; }
  };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) next(); }, { rootMargin: '900px 0px' });
  io.observe(more);
  token.cleanup.push(() => io.disconnect());
  await next();
}

// ---------------------------------------------------------------- Search

export async function searchPage(view, token, params) {
  const q = (params.get('q') || '').trim();
  view.innerHTML = `
  <div class="page">
    <form class="search-big" id="search-form">
      ${icon('search', 22)}
      <input id="search-input" type="search" data-tv-autofocus autocomplete="off" placeholder="Search anime" value="${esc(q)}">
    </form>
    <div id="search-body"></div>
  </div>`;
  const input = view.querySelector('#search-input');
  const body = view.querySelector('#search-body');
  view.querySelector('#search-form').onsubmit = e => { e.preventDefault(); input.blur(); };
  if (!('ontouchstart' in window)) input.focus();

  let gen = 0, timer;
  const run = async text => {
    const my = ++gen;
    if (!text) {
      const recent = store.recentSearches();
      body.innerHTML = recent.length ? `<h3 class="sub-head">Recent searches</h3><div class="genre-chips">${recent.map(r =>
        `<a class="chip" href="#/search?q=${encodeURIComponent(r)}">${esc(r)}</a>`).join('')}</div>` : `<div class="empty">${icon('search', 28)}<p>Find any anime by title.</p></div>`;
      return;
    }
    body.innerHTML = `<div class="loader-row"><div class="spinner"></div></div>`;
    try {
      const res = await api.search(text);
      if (my !== gen || !token.current) return;
      body.innerHTML = res.media.length ? `<div class="grid">${res.media.map(m => posterCard(m)).join('')}</div>`
        : `<div class="empty"><p>No results for “${esc(text)}”.</p></div>`;
      if (res.media.length) store.addSearch(text);
    } catch (e) {
      if (my === gen) body.innerHTML = errorBox(e.message, false);
    }
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = input.value.trim();
      history.replaceState(null, '', v ? `#/search?q=${encodeURIComponent(v)}` : '#/search');
      run(v);
    }, 280);
  });
  token.cleanup.push(() => clearTimeout(timer));
  run(q);
}

// ---------------------------------------------------------------- My List & History

export function myList(view) {
  const list = store.myList();
  view.innerHTML = `
  <div class="page">
    <div class="page-head"><h1>My List</h1><p>${list.length ? `${list.length} show${list.length > 1 ? 's' : ''} saved on this device` : 'Shows you bookmark land here'}</p></div>
    ${list.length ? `<div class="grid">${list.map(m => posterCard(m)).join('')}</div>`
      : `<div class="empty">${icon('bookmark', 30)}<p>Tap <b>My List</b> on any show to save it.</p><a class="btn primary" href="#/browse">Browse anime</a></div>`}
  </div>`;
}

export function historyPage(view, token) {
  const items = store.continueWatching();
  view.innerHTML = `
  <div class="page">
    <div class="page-head"><h1>History</h1><p>Pick up exactly where you left off</p></div>
    ${items.length ? `<div class="grid wide-grid">${items.map(h => resumeCard(h)).join('')}</div>`
      : `<div class="empty">${icon('history', 30)}<p>Nothing watched yet.</p><a class="btn primary" href="#/">Find something</a></div>`}
  </div>`;
  view.querySelectorAll('[data-remove]').forEach(b => b.onclick = e => {
    e.preventDefault();
    store.removeFromHistory(+b.dataset.remove);
    b.closest('.card').remove();
  });
  items.forEach(h => api.extras(h.media.id).then(ex => {
    const still = ex?.episodes?.[h.ep]?.image || ex?.fanart;
    const img = view.querySelector(`.card[data-id="${h.media.id}"] img`);
    if (still && img && token.current) img.src = still;
  }));
}

// ---------------------------------------------------------------- Schedule

export async function schedulePage(view, token, params) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + (i - 1) * 86400000));
  const sel = Math.min(6, Math.max(0, Number(params.get('d') ?? 1)));
  view.innerHTML = `
  <div class="page">
    <div class="page-head"><h1>Simulcast Schedule</h1><p>When new episodes air, in your time zone</p></div>
    <div class="day-tabs">${days.map((d, i) => `<a class="day${i === sel ? ' on' : ''}" href="#/schedule?d=${i}">
      <b>${i === 1 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</b><span>${d.getDate()}</span></a>`).join('')}</div>
    <div id="sched"><div class="loader-row"><div class="spinner"></div></div></div>
  </div>`;
  try {
    const items = await api.schedule(days[sel].getTime());
    if (!token.current) return;
    const now = Date.now() / 1000;
    view.querySelector('#sched').innerHTML = items.length ? `<div class="sched-list">${items.map(s => {
      const m = s.media, aired = s.airingAt < now;
      return `<a class="sched-item${aired ? ' aired' : ''}" href="${aired ? `#/watch/${m.id}/${s.episode}` : `#/anime/${m.id}`}">
        <time>${new Date(s.airingAt * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
        <img loading="lazy" src="${esc(m.coverImage?.large || '')}" alt="">
        <div><div class="sched-title">${esc(titleOf(m))}</div><div class="sched-ep">Episode ${s.episode}${aired ? ' · <span class="live">Out now</span>' : ''}</div></div>
        <span class="sched-go">${icon(aired ? 'play' : 'chevronRight', 18)}</span>
      </a>`;
    }).join('')}</div>` : '<div class="empty"><p>Nothing airs this day.</p></div>';
  } catch (e) {
    if (token.current) view.querySelector('#sched').innerHTML = errorBox(e.message);
  }
}

// ---------------------------------------------------------------- Settings

export function settingsPage(view) {
  const draw = () => {
    const s = store.settings();
    const servers = [...orderedServers({ ...s, disabledServers: [] })];
    view.innerHTML = `
    <div class="page narrow">
      <div class="page-head"><h1>Settings</h1><p>Saved on this device</p></div>

      <section class="set-card">
        <h2>${icon('server', 20)} Video servers</h2>
        <p class="muted">Anikku plays episodes with these website players, top to bottom. If one can't play an episode it moves to the next. Reorder or switch them off.</p>
        <div class="server-list">${servers.map((sv, i) => {
          const off = s.disabledServers.includes(sv.id);
          return `<div class="server${off ? ' off' : ''}">
            <div class="server-rank">${i + 1}</div>
            <div class="server-info"><b>${esc(sv.name)}</b><span>${esc(sv.note)}</span></div>
            <button class="icon-btn" data-up="${sv.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 18)}</button>
            <button class="icon-btn" data-down="${sv.id}" ${i === servers.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 18)}</button>
            <label class="switch"><input type="checkbox" data-srv="${sv.id}" ${off ? '' : 'checked'}><i></i></label>
          </div>`;
        }).join('')}</div>
      </section>

      <section class="set-card">
        <h2>${icon('play', 20)} Playback</h2>
        <div class="set-row"><div><b>Audio</b><span>Default for new episodes</span></div>
          <div class="seg"><button class="${s.audio === 'sub' ? 'on' : ''}" data-audio="sub">Sub</button><button class="${s.audio === 'dub' ? 'on' : ''}" data-audio="dub">Dub</button></div></div>
        <div class="set-row"><div><b>Autoplay next episode</b><span>Starts the next one when an episode ends</span></div>
          <label class="switch"><input type="checkbox" data-toggle="autoplay" ${s.autoplay ? 'checked' : ''}><i></i></label></div>
        <div class="set-row"><div><b>Skip intros and outros</b><span>Automatically, when the player knows where they are (Anikku app)</span></div>
          <label class="switch"><input type="checkbox" data-toggle="autoskip" ${s.autoskip ? 'checked' : ''}><i></i></label></div>
      </section>

      <section class="set-card">
        <h2>${icon('tv', 20)} Display</h2>
        <div class="set-row"><div><b>Titles</b><span>Language for show names</span></div>
          <div class="seg"><button class="${s.titleLang === 'english' ? 'on' : ''}" data-title="english">English</button><button class="${s.titleLang === 'romaji' ? 'on' : ''}" data-title="romaji">Romaji</button></div></div>
      </section>

      <section class="set-card">
        <h2>${icon('trash', 20)} Data</h2>
        <div class="set-row"><div><b>Watch history</b><span>${store.continueWatching().length} shows</span></div><button class="btn glass small" data-clear="history">Clear</button></div>
        <div class="set-row"><div><b>My List</b><span>${store.myList().length} shows</span></div><button class="btn glass small" data-clear="list">Clear</button></div>
      </section>

      <p class="foot">Anikku · catalogue by AniList, artwork by ani.zip / TheTVDB · videos are played by third-party websites</p>
    </div>`;

    const reorder = (id, dir) => {
      const order = servers.map(x => x.id);
      const i = order.indexOf(id), j = i + dir;
      [order[i], order[j]] = [order[j], order[i]];
      store.setSetting('servers', order);
      draw();
    };
    view.querySelectorAll('[data-up]').forEach(b => b.onclick = () => reorder(b.dataset.up, -1));
    view.querySelectorAll('[data-down]').forEach(b => b.onclick = () => reorder(b.dataset.down, 1));
    view.querySelectorAll('[data-srv]').forEach(c => c.onchange = () => {
      const off = new Set(store.settings().disabledServers);
      if (c.checked) off.delete(c.dataset.srv); else off.add(c.dataset.srv);
      if (off.size >= SERVERS.length) { toast('Keep at least one server on'); c.checked = true; return; }
      store.setSetting('disabledServers', [...off]);
      draw();
    });
    view.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => { store.setSetting('audio', b.dataset.audio); draw(); });
    view.querySelectorAll('[data-title]').forEach(b => b.onclick = () => { store.setSetting('titleLang', b.dataset.title); draw(); });
    view.querySelectorAll('[data-toggle]').forEach(c => c.onchange = () => store.setSetting(c.dataset.toggle, c.checked));
    view.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
      if (!confirm(`Clear ${b.dataset.clear === 'list' ? 'My List' : 'your watch history'}?`)) return;
      b.dataset.clear === 'list' ? store.clearList() : store.clearHistory();
      toast('Cleared');
      draw();
    });
  };
  draw();
}

export { fmtClock };
