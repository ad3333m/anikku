import * as api from '../api.js';
import * as store from '../store.js';
import { icon, esc, titleOf, cleanText, metaBits, posterCard, row, bindRows, toast, errorBox, FORMAT, STATUS } from '../ui.js';

const RELATION = { PREQUEL: 'Prequel', SEQUEL: 'Sequel', SIDE_STORY: 'Side story', SPIN_OFF: 'Spin-off', ALTERNATIVE: 'Alternative',
  PARENT: 'Main story', SUMMARY: 'Summary', CHARACTER: 'Characters', OTHER: 'Other', COMPILATION: 'Compilation', SOURCE: 'Source', ADAPTATION: 'Adaptation' };

export async function render(view, token, id) {
  view.innerHTML = `<div class="series series-loading"><div class="series-head"><div class="series-shade"></div></div></div>`;
  let m;
  try {
    m = await api.media(id);
  } catch (e) {
    if (token.current) view.innerHTML = errorBox(e.message);
    return;
  }
  if (!token.current) return;
  if (!m) { view.innerHTML = errorBox('This show was not found', false); return; }

  const ex = await api.extras(m.id);
  if (!token.current) return;

  const t = esc(titleOf(m));
  const total = api.availableEpisodes(m, ex);
  const h = store.animeHistory(m.id);
  const resumeEp = h?.ep || 1;
  const art = ex?.fanart || m.bannerImage || m.coverImage?.extraLarge;
  const desc = cleanText(m.description);
  const studio = m.studios?.nodes?.[0]?.name;
  const aired = [m.startDate?.year, m.endDate?.year && m.endDate.year !== m.startDate?.year ? m.endDate.year : null].filter(Boolean).join(' – ');
  const nextAir = m.nextAiringEpisode;
  const relations = (m.relations?.edges || []).filter(e => e.node.type === 'ANIME' && !e.node.isAdult);
  const recs = (m.recommendations?.nodes || []).map(n => n.mediaRecommendation).filter(r => r && !r.isAdult);

  view.innerHTML = `
  <div class="series" style="--tint:${m.coverImage?.color || '#f47521'}">
    <header class="series-head">
      <div class="series-art${ex?.fanart ? '' : ' soft'}"><img src="${esc(art)}" alt=""></div>
      <div class="series-shade"></div>
      <div class="series-info">
        <div class="series-title">${ex?.logo
          ? `<img class="series-logo" src="${esc(ex.logo)}" alt="${t}" onerror="this.outerHTML='<h1>${t.replace(/'/g, '&#39;')}</h1>'">`
          : `<h1>${t}</h1>`}</div>
        ${m.title.english && m.title.romaji && m.title.english !== m.title.romaji ? `<div class="series-alt">${esc(settingsAltTitle(m))}</div>` : ''}
        <div class="hero-meta">${metaBits(m)}${m.status ? `<span>${STATUS[m.status] || m.status}</span>` : ''}</div>
        <div class="chips">${(m.genres || []).map(g => `<a class="chip" href="#/browse?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>
        <div class="hero-actions">
          ${total > 0 ? `<a class="btn primary" href="#/watch/${m.id}/${resumeEp}">${icon('play', 18)} ${h ? `Continue E${resumeEp}` : 'Start Watching E1'}</a>`
            : `<span class="btn glass disabled">${nextAir ? `Premieres ${new Date(nextAir.airingAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'Coming soon'}</span>`}
          <button class="btn glass" data-list>${icon(store.inList(m.id) ? 'check' : 'plus', 18)} My List</button>
          ${m.trailer?.site === 'youtube' ? `<a class="btn glass" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${esc(m.trailer.id)}">${icon('tv', 18)} Trailer</a>` : ''}
        </div>
        <div class="series-lower">
          <div class="series-desc-wrap"><p class="series-desc" data-clamp>${esc(desc)}</p></div>
          <dl class="series-facts">
            ${studio ? `<dt>Studio</dt><dd>${esc(studio)}</dd>` : ''}
            ${aired ? `<dt>Aired</dt><dd>${esc(aired)}</dd>` : ''}
            ${m.format ? `<dt>Format</dt><dd>${FORMAT[m.format] || m.format}${m.duration ? ` · ${m.duration} min` : ''}</dd>` : ''}
            ${nextAir ? `<dt>Next episode</dt><dd>EP ${nextAir.episode} in ${countdown(nextAir.timeUntilAiring)}</dd>` : ''}
            ${m.title.native ? `<dt>Japanese</dt><dd>${esc(m.title.native)}</dd>` : ''}
          </dl>
        </div>
      </div>
    </header>

    <nav class="tabs">
      <button class="tab on" data-tab="episodes">Episodes${total ? ` <span>${total}</span>` : ''}</button>
      ${relations.length ? `<button class="tab" data-tab="related">Related <span>${relations.length}</span></button>` : ''}
      ${recs.length ? `<button class="tab" data-tab="similar">More Like This</button>` : ''}
    </nav>

    <section class="tab-panel on" data-panel="episodes"></section>
    ${relations.length ? `<section class="tab-panel" data-panel="related"><div class="grid">${relations.map(e =>
      posterCard(e.node, { badge: RELATION[e.relationType] || '' })).join('')}</div></section>` : ''}
    ${recs.length ? `<section class="tab-panel" data-panel="similar"><div class="grid">${recs.map(r => posterCard(r)).join('')}</div></section>` : ''}
  </div>`;

  view.querySelector('[data-list]').onclick = e => {
    const added = store.toggleList(m);
    e.currentTarget.innerHTML = `${icon(added ? 'check' : 'plus', 18)} My List`;
    toast(added ? 'Added to My List' : 'Removed from My List');
  };
  const d = view.querySelector('[data-clamp]');
  if (d && desc.length > 280) {
    d.classList.add('clamped');
    const more = document.createElement('button');
    more.className = 'link-btn';
    more.textContent = 'More details';
    more.onclick = () => { d.classList.toggle('clamped'); more.textContent = d.classList.contains('clamped') ? 'More details' : 'Show less'; };
    d.after(more);
  }
  view.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    view.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    view.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === b.dataset.tab));
  });

  renderEpisodes(view.querySelector('[data-panel="episodes"]'), m, ex, total);
}

function settingsAltTitle(m) {
  const main = titleOf(m);
  return main === m.title.english ? m.title.romaji : m.title.english;
}

function countdown(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), mi = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${mi}m` : `${mi}m`;
}

// ---------------------------------------------------------------- episodes

const PAGE = 100;

function renderEpisodes(panel, m, ex, total) {
  if (!total) {
    panel.innerHTML = `<div class="empty">${icon('calendar', 28)}<p>No episodes yet. ${m.nextAiringEpisode ? `Episode ${m.nextAiringEpisode.episode} airs in ${countdown(m.nextAiringEpisode.timeUntilAiring)}.` : 'Add it to My List and check back soon.'}</p></div>`;
    return;
  }
  const s = store.settings();
  let newestFirst = false;
  const hist = store.animeHistory(m.id);
  let rangeStart = hist?.ep ? Math.floor((hist.ep - 1) / PAGE) * PAGE + 1 : 1;

  const draw = () => {
    const h = store.animeHistory(m.id);
    const ranges = [];
    for (let a = 1; a <= total; a += PAGE) ranges.push([a, Math.min(total, a + PAGE - 1)]);
    let eps = [];
    for (let n = rangeStart; n <= Math.min(total, rangeStart + PAGE - 1); n++) eps.push(n);
    if (newestFirst) eps.reverse();
    panel.innerHTML = `
      <div class="ep-bar">
        <div class="seg">
          <button class="${store.settings().audio === 'sub' ? 'on' : ''}" data-audio="sub">Sub</button>
          <button class="${store.settings().audio === 'dub' ? 'on' : ''}" data-audio="dub">Dub</button>
        </div>
        ${ranges.length > 1 ? `<select class="select" data-range>${ranges.map(([a, b]) =>
          `<option value="${a}"${a === rangeStart ? ' selected' : ''}>Episodes ${a}–${b}</option>`).join('')}</select>` : ''}
        <button class="btn glass small" data-sort>${icon(newestFirst ? 'down' : 'up', 16)} ${newestFirst ? 'Newest first' : 'Oldest first'}</button>
      </div>
      <div class="ep-grid">${eps.map(n => epCard(m, ex, n, h)).join('')}</div>`;
    panel.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => { store.setSetting('audio', b.dataset.audio); draw(); });
    panel.querySelector('[data-sort]').onclick = () => { newestFirst = !newestFirst; draw(); };
    const r = panel.querySelector('[data-range]');
    if (r) r.onchange = () => { rangeStart = +r.value; draw(); };
  };
  draw();
}

function epCard(m, ex, n, h) {
  const e = ex?.episodes?.[n] || {};
  const still = e.image || ex?.fanart || m.bannerImage || m.coverImage?.extraLarge;
  const pr = h?.progress?.[n];
  const watched = h?.watched?.[n];
  const pct = watched ? 100 : pr && pr[1] ? Math.round((pr[0] / pr[1]) * 100) : 0;
  const name = e.title && !/^episode\s*\d+$/i.test(e.title) ? e.title : '';
  const runtime = e.runtime || m.duration;
  return `
  <a class="ep${watched ? ' watched' : ''}${h?.ep === n ? ' current' : ''}" href="#/watch/${m.id}/${n}">
    <div class="ep-thumb${e.image ? '' : ' no-still'}">
      <img loading="lazy" src="${esc(still)}" alt="">
      ${e.image ? '' : `<span class="ep-num">${n}</span>`}
      ${runtime ? `<span class="ep-time">${runtime}m</span>` : ''}
      ${watched ? `<span class="ep-done">${icon('check', 14)}</span>` : ''}
      <span class="ep-play">${icon('play', 22)}</span>
      ${pct ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
    </div>
    <div class="ep-kicker">${esc(titleOf(m))}</div>
    <div class="ep-title">E${n}${name ? ` – ${esc(name)}` : ''}</div>
    ${e.airdate ? `<div class="ep-sub">${esc(new Date(e.airdate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))}</div>` : ''}
  </a>`;
}
