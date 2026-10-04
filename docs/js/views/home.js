import * as api from '../api.js';
import * as store from '../store.js';
import { icon, esc, titleOf, cleanText, metaBits, posterCard, resumeCard, row, skeletonRow, bindRows, timeAgo, toast, errorBox } from '../ui.js';

const GENRE_TILES = [
  ['Action', '#ff5b3a', '#b3123c'], ['Romance', '#ff6fa8', '#8a2be2'], ['Fantasy', '#5b8cff', '#2c2fa8'],
  ['Comedy', '#ffc93a', '#ff7a1a'], ['Sci-Fi', '#2ee6d6', '#1f5fd6'], ['Horror', '#8a1c2b', '#24040a'],
  ['Slice of Life', '#7ee081', '#1f8a5c'], ['Sports', '#ff9f43', '#c0392b'], ['Mystery', '#9b6bff', '#33145f'],
  ['Mecha', '#9aa7b8', '#2f3b4c'], ['Psychological', '#e05cff', '#3a0f4f'], ['Supernatural', '#4be3a8', '#123f5f'],
];
const LAZY_GENRES = ['Action', 'Romance', 'Fantasy', 'Comedy', 'Sci-Fi', 'Sports'];

let heroTimer = null;

export async function render(view, token) {
  view.innerHTML = `<div class="hero hero-loading"><div class="hero-shade"></div></div>${skeletonRow()}${skeletonRow()}${skeletonRow()}`;
  let data;
  try {
    data = await api.homeRows();
  } catch (e) {
    if (token.current) view.innerHTML = errorBox(e.message);
    return;
  }
  if (!token.current) return;

  const watching = store.continueWatching();
  const list = store.myList();
  const slides = data.trending.filter(m => m.bannerImage).slice(0, 7);

  view.innerHTML = `
    ${heroHTML(slides, data.seasonLabel)}
    <div class="rows">
      ${watching.length ? row('continue', 'Continue Watching', watching.slice(0, 20).map(h => resumeCard(h)).join(''), { more: '#/history', cls: 'wide-row' }) : ''}
      <div id="recent-slot">${skeletonRow(8)}</div>
      ${row('top10', `${icon('fire', 22, 'accent')} Top 10 Today`, data.trending.slice(0, 10).map((m, i) => posterCard(m, { rank: i + 1 })).join(''), { cls: 'top10' })}
      ${row('season', `Popular in ${esc(data.seasonLabel)}`, data.season.map(m => posterCard(m)).join(''), { more: `#/browse?season=${api.currentSeason().season}&year=${api.currentSeason().year}&sort=POPULARITY_DESC` })}
      ${list.length ? row('mylist', 'My List', list.slice(0, 24).map(m => posterCard(m)).join(''), { more: '#/list' }) : ''}
      <section class="row"><div class="row-head"><div><h2>Browse by Genre</h2></div></div>
        <div class="scroller"><div class="track genre-track">${GENRE_TILES.map(([g, a, b]) =>
          `<a class="genre-tile" href="#/browse?genre=${encodeURIComponent(g)}" style="--a:${a};--b:${b}"><span>${esc(g)}</span></a>`).join('')}</div></div>
      </section>
      ${row('popular', 'All-Time Popular', data.popular.map(m => posterCard(m)).join(''), { more: '#/browse?sort=POPULARITY_DESC' })}
      ${LAZY_GENRES.slice(0, 3).map(g => `<div class="lazy-genre" data-genre="${esc(g)}">${skeletonRow()}</div>`).join('')}
      ${row('top', 'Top Rated', data.top.map(m => posterCard(m)).join(''), { more: '#/browse?sort=SCORE_DESC' })}
      ${row('movies', 'Anime Movies', data.movies.map(m => posterCard(m)).join(''), { more: '#/browse?format=MOVIE&sort=POPULARITY_DESC' })}
      ${LAZY_GENRES.slice(3).map(g => `<div class="lazy-genre" data-genre="${esc(g)}">${skeletonRow()}</div>`).join('')}
      ${row('upcoming', 'Coming Soon', data.upcoming.map(m => posterCard(m, { badge: 'SOON' })).join(''), { sub: 'Add them to My List so you don’t miss the premiere', more: '#/browse?status=NOT_YET_RELEASED&sort=POPULARITY_DESC' })}
      <footer class="foot">Data from AniList and ani.zip · Anikku keeps your list and history on this device</footer>
    </div>`;
  bindRows(view);
  bindHero(view, slides, token);
  bindResume(view, watching, token);

  api.recentEpisodes().then(recent => {
    if (!token.current) return;
    const slot = view.querySelector('#recent-slot');
    if (!slot) return;
    slot.innerHTML = recent.length ? row('recent', 'New Episodes', recent.slice(0, 24).map(m =>
      posterCard(m, { badge: `EP ${m._airedEpisode}`, sub: `<span class="new-dot"></span>${timeAgo(m._airedAt)}` })).join(''),
      { sub: 'Fresh simulcasts from the last few days', more: '#/schedule' }) : '';
    bindRows(slot);
  }).catch(() => { const s = view.querySelector('#recent-slot'); if (s) s.innerHTML = ''; });

  // genre rows load when they scroll into view
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const g = e.target.dataset.genre;
      api.genreRow(g).then(items => {
        if (!token.current) return;
        e.target.innerHTML = row('g-' + g, esc(g), items.map(m => posterCard(m)).join(''), { more: `#/browse?genre=${encodeURIComponent(g)}` });
        bindRows(e.target);
      }).catch(() => { e.target.innerHTML = ''; });
    }
  }, { rootMargin: '600px 0px' });
  view.querySelectorAll('.lazy-genre').forEach(el => io.observe(el));
  token.cleanup.push(() => io.disconnect());
}

// ---------------------------------------------------------------- hero

function heroHTML(slides, seasonLabel) {
  if (!slides.length) return '';
  return `
  <section class="hero" style="--tint:${slides[0].coverImage?.color || '#f47521'}">
    <div class="hero-bg">${slides.map((m, i) =>
      `<div class="hero-slide${i === 0 ? ' on' : ''}" data-i="${i}"><img src="${esc(m.bannerImage)}" alt=""></div>`).join('')}</div>
    <div class="hero-shade"></div>
    <div class="hero-content">
      <div class="hero-kicker"></div>
      <div class="hero-title"></div>
      <div class="hero-meta"></div>
      <p class="hero-desc"></p>
      <div class="hero-actions"></div>
    </div>
    <div class="hero-thumbs">${slides.map((m, i) =>
      `<button class="hero-thumb${i === 0 ? ' on' : ''}" data-i="${i}" aria-label="${esc(titleOf(m))}">
         <img src="${esc(m.coverImage?.large || '')}" alt=""><i></i></button>`).join('')}</div>
  </section>`;
}

function bindHero(view, slides, token) {
  const hero = view.querySelector('.hero');
  if (!hero) return;
  const extras = {};
  let idx = 0;

  const fill = i => {
    const m = slides[i];
    const ex = extras[m.id];
    const h = store.animeHistory(m.id);
    const t = esc(titleOf(m));
    hero.style.setProperty('--tint', m.coverImage?.color || '#f47521');
    hero.querySelector('.hero-kicker').innerHTML = `<span class="pill">${icon('fire', 14)} #${i + 1} Trending</span>${m.genres?.slice(0, 3).map(g => `<span class="tag">${esc(g)}</span>`).join('') || ''}`;
    hero.querySelector('.hero-title').innerHTML = ex?.logo
      ? `<img class="hero-logo" src="${esc(ex.logo)}" alt="${t}" onerror="this.outerHTML='<h1>${t.replace(/'/g, '&#39;')}</h1>'">`
      : `<h1>${t}</h1>`;
    hero.querySelector('.hero-meta').innerHTML = metaBits(m);
    hero.querySelector('.hero-desc').textContent = cleanText(m.description || '') || '';
    const ep = h?.ep || 1;
    const inList = store.inList(m.id);
    hero.querySelector('.hero-actions').innerHTML = `
      <a class="btn primary" href="#/watch/${m.id}/${ep}">${icon('play', 18)} ${h ? `Continue E${ep}` : 'Start Watching'}</a>
      <button class="btn glass" data-list>${icon(inList ? 'check' : 'plus', 18)} My List</button>
      <a class="btn glass icon-only" href="#/anime/${m.id}" aria-label="Details">${icon('info', 20)}</a>`;
    hero.querySelector('[data-list]').onclick = () => {
      const added = store.toggleList(m);
      toast(added ? 'Added to My List' : 'Removed from My List');
      fill(i);
    };
    // the card description isn't loaded for card fields: fetch it once
    if (!m.description) api.media(m.id).then(full => {
      m.description = full.description;
      if (token.current && idx === i) hero.querySelector('.hero-desc').textContent = cleanText(m.description);
    }).catch(() => {});
  };

  const show = i => {
    idx = (i + slides.length) % slides.length;
    hero.querySelectorAll('.hero-slide').forEach(s => s.classList.toggle('on', +s.dataset.i === idx));
    hero.querySelectorAll('.hero-thumb').forEach(s => s.classList.toggle('on', +s.dataset.i === idx));
    const content = hero.querySelector('.hero-content');
    content.classList.remove('swap'); void content.offsetWidth; content.classList.add('swap');
    fill(idx);
    restart();
  };
  const restart = () => {
    clearTimeout(heroTimer);
    heroTimer = setTimeout(() => token.current && show(idx + 1), 9000);
  };
  hero.querySelectorAll('.hero-thumb').forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));

  // swipe on touch screens
  let sx = null;
  hero.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    sx = null;
  });

  fill(0);
  restart();
  token.cleanup.push(() => clearTimeout(heroTimer));

  // fanart + logo from ani.zip upgrade each slide when they arrive
  slides.forEach((m, i) => api.extras(m.id).then(ex => {
    if (!ex || !token.current) return;
    extras[m.id] = ex;
    if (ex.fanart) {
      const img = new Image();
      img.onload = () => {
        const slide = hero.querySelector(`.hero-slide[data-i="${i}"] img`);
        if (slide) { slide.src = ex.fanart; slide.parentElement.classList.add('fanart'); }
      };
      img.src = ex.fanart;
    }
    if (i === idx) fill(i);
  }));
}

function bindResume(view, watching, token) {
  view.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    store.removeFromHistory(+b.dataset.remove);
    b.closest('.card').remove();
    toast('Removed from Continue Watching');
  }));
  // swap in the episode still when ani.zip has one
  watching.slice(0, 20).forEach(h => api.extras(h.media.id).then(ex => {
    const still = ex?.episodes?.[h.ep]?.image || ex?.fanart;
    if (!still || !token.current) return;
    const img = view.querySelector(`#row-continue .card[data-id="${h.media.id}"] img`);
    if (img) img.src = still;
  }));
}
