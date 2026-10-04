import { settings } from './store.js';

const P = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  bookmarkFill: '<path d="M6 4h12v17l-6-4-6 4z" fill="currentColor"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M5 9l7 7 7-7"/>',
  back: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  next: '<path d="M6 5l9 7-9 7z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>',
  prev: '<path d="M18 5l-9 7 9 7z" fill="currentColor" stroke="none"/><path d="M6 5v14"/>',
  server: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" stroke="none"/>',
  fire: '<path d="M12 21c4 0 7-2.7 7-6.6 0-3.1-2-5.3-3.6-7-.4 2-1.5 3.1-2.6 3.6.3-3.4-1.2-6.4-4.3-8 .3 3-1.4 5-2.9 6.6C4.6 11.3 5 13 5 14.4 5 18.3 8 21 12 21z"/>',
  tv: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 3l4 3 4-3"/>',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function titleOf(m) {
  const t = m?.title || {};
  return settings().titleLang === 'romaji' ? (t.romaji || t.english || '') : (t.english || t.romaji || '');
}

export function cleanText(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\(Source:[^)]*\)/gi, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export const FORMAT = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' };
export const STATUS = { FINISHED: 'Finished', RELEASING: 'Airing', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'Hiatus' };

export function metaBits(m) {
  const bits = [];
  if (m.averageScore) bits.push(`<span class="score">${icon('star', 13)} ${(m.averageScore / 10).toFixed(1)}</span>`);
  if (m.seasonYear) bits.push(`<span>${m.seasonYear}</span>`);
  if (m.format) bits.push(`<span>${FORMAT[m.format] || m.format}</span>`);
  if (m.nextAiringEpisode) bits.push(`<span class="live">EP ${m.nextAiringEpisode.episode - 1} out</span>`);
  else if (m.episodes) bits.push(`<span>${m.episodes} ep${m.episodes > 1 ? 's' : ''}</span>`);
  return bits.join('');
}

export function timeAgo(sec) {
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export function fmtClock(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- cards

export function posterCard(m, { badge = '', rank = 0, sub = '' } = {}) {
  const color = m.coverImage?.color || '#1b1b22';
  const t = esc(titleOf(m));
  const img = m.coverImage?.extraLarge || m.coverImage?.large || '';
  return `
  <a class="card poster${rank ? ' ranked' : ''}" href="#/anime/${m.id}" data-id="${m.id}" style="--tint:${color}">
    ${rank ? `<span class="rank">${rank}</span>` : ''}
    <div class="thumb">
      <img loading="lazy" src="${esc(img)}" alt="">
      ${badge ? `<span class="badge">${badge}</span>` : ''}
      <div class="hover">
        <div class="hover-meta">${metaBits(m)}</div>
        <div class="hover-genres">${(m.genres || []).slice(0, 3).map(esc).join(' · ')}</div>
        <span class="hover-play">${icon('play', 18)}</span>
      </div>
    </div>
    <div class="card-title">${t}</div>
    <div class="card-sub">${sub || [m.format ? FORMAT[m.format] || m.format : '', m.seasonYear || ''].filter(Boolean).join(' · ')}</div>
  </a>`;
}

/** Landscape card for Continue Watching. */
export function resumeCard(h, still) {
  const m = h.media;
  const pct = h.d ? Math.min(100, Math.round((h.t / h.d) * 100)) : 4;
  const left = h.d ? Math.max(0, Math.round((h.d - h.t) / 60)) : 0;
  const img = still || m.bannerImage || m.coverImage?.extraLarge || '';
  return `
  <div class="card wide" data-id="${m.id}">
    <a class="thumb" href="#/watch/${m.id}/${h.ep}">
      <img loading="lazy" src="${esc(img)}" alt="">
      <span class="play-chip">${icon('play', 16)}</span>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </a>
    <button class="card-x" data-remove="${m.id}" aria-label="Remove from Continue Watching">${icon('close', 14)}</button>
    <div class="card-title">${esc(titleOf(m))}</div>
    <div class="card-sub">Episode ${h.ep}${left ? ` · ${left}m left` : ''}</div>
  </div>`;
}

export function row(id, title, inner, { sub = '', more = '', cls = '' } = {}) {
  return `
  <section class="row ${cls}" id="row-${id}">
    <div class="row-head">
      <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      ${more ? `<a class="row-more" href="${more}">See all ${icon('chevronRight', 16)}</a>` : ''}
    </div>
    <div class="scroller">
      <button class="nudge left" aria-label="Scroll left">${icon('chevronLeft', 22)}</button>
      <div class="track">${inner}</div>
      <button class="nudge right" aria-label="Scroll right">${icon('chevronRight', 22)}</button>
    </div>
  </section>`;
}

export function skeletonRow(n = 8, wide = false) {
  return `<section class="row"><div class="row-head"><div><h2 class="sk sk-title"></h2></div></div><div class="scroller"><div class="track">${
    Array.from({ length: n }, () => `<div class="card ${wide ? 'wide' : 'poster'}"><div class="thumb sk"></div><div class="sk sk-line"></div></div>`).join('')
  }</div></div></section>`;
}

/** Wires the left/right arrows of every row inside root. */
export function bindRows(root) {
  root.querySelectorAll('.scroller').forEach(sc => {
    const track = sc.querySelector('.track');
    const update = () => {
      sc.classList.toggle('at-start', track.scrollLeft < 8);
      sc.classList.toggle('at-end', track.scrollLeft + track.clientWidth > track.scrollWidth - 8);
    };
    sc.querySelectorAll('.nudge').forEach(b => b.addEventListener('click', () => {
      const dir = b.classList.contains('left') ? -1 : 1;
      track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: 'smooth' });
    }));
    track.addEventListener('scroll', update, { passive: true });
    requestAnimationFrame(update);
  });
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export function errorBox(msg, retry = true) {
  return `<div class="error-box">${icon('info', 28)}<h3>Something went wrong</h3><p>${esc(msg)}</p>${retry ? '<button class="btn glass" onclick="location.reload()">Try again</button>' : ''}</div>`;
}
