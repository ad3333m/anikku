// Data layer: AniList (catalogue, search, schedule) and ani.zip (artwork, episode titles/stills).
// Both allow cross-origin requests, so the site talks to them directly.

import { SAFE_ARGS, safe } from './safety.js';

const ANILIST = 'https://graphql.anilist.co';
const ANIZIP = 'https://api.ani.zip/mappings?anilist_id=';

const CARD = `
fragment card on Media {
  id idMal format status episodes duration averageScore popularity seasonYear season isAdult
  title { romaji english }
  coverImage { extraLarge large color }
  bannerImage
  genres
  tags { name rank }
  nextAiringEpisode { episode airingAt timeUntilAiring }
}`;

const FULL = `
fragment full on Media {
  ...card
  title { romaji english native }
  description(asHtml: false)
  source countryOfOrigin
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  tags { name rank isMediaSpoiler }
  relations { edges { relationType(version: 2) node { ...card type tags { name rank } } } }
  recommendations(perPage: 18, sort: RATING_DESC) { nodes { mediaRecommendation { ...card tags { name rank } } } }
}`;

const memo = new Map();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gql(query, variables = {}, { cacheKey, ttl = 10 * 60 * 1000 } = {}) {
  if (cacheKey) {
    const hit = memo.get(cacheKey);
    if (hit && Date.now() - hit.at < ttl) return hit.data;
    try {
      const s = JSON.parse(sessionStorage.getItem('gq:' + cacheKey) || 'null');
      if (s && Date.now() - s.at < ttl) { memo.set(cacheKey, s); return s.data; }
    } catch { /* storage unavailable */ }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {  // AniList rate limit: wait as told and retry
      const wait = Number(res.headers.get('Retry-After') || 2) * 1000;
      await sleep(Math.min(wait, 15000));
      continue;
    }
    const json = await res.json();
    if (json.errors && !json.data) throw new Error(json.errors[0]?.message || 'AniList error');
    if (cacheKey) {
      const entry = { at: Date.now(), data: json.data };
      memo.set(cacheKey, entry);
      try { sessionStorage.setItem('gq:' + cacheKey, JSON.stringify(entry)); } catch { /* full */ }
    }
    return json.data;
  }
  throw new Error('AniList is busy, try again in a moment');
}

export function currentSeason(offset = 0) {
  const now = new Date();
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  let idx = Math.floor(now.getMonth() / 3) + offset;
  let year = now.getFullYear();
  while (idx > 3) { idx -= 4; year++; }
  while (idx < 0) { idx += 4; year--; }
  return { season: seasons[idx], year };
}

// every catalogue query leaves out adult/sexual titles (see safety.js)
const SAFE = `type: ANIME, ${SAFE_ARGS}`;

export async function homeRows() {
  const { season, year } = currentSeason();
  const q1 = `${CARD}
  query ($season: MediaSeason, $year: Int) {
    trending: Page(perPage: 24) { media(${SAFE}, sort: TRENDING_DESC) { ...card } }
    season: Page(perPage: 24) { media(${SAFE}, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { ...card } }
    top: Page(perPage: 24) { media(${SAFE}, sort: SCORE_DESC, format_in: [TV, MOVIE, ONA]) { ...card } }
  }`;
  const q2 = `${CARD}
  query {
    popular: Page(perPage: 24) { media(${SAFE}, sort: POPULARITY_DESC) { ...card } }
    upcoming: Page(perPage: 24) { media(${SAFE}, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) { ...card } }
    movies: Page(perPage: 24) { media(${SAFE}, format: MOVIE, sort: POPULARITY_DESC) { ...card } }
  }`;
  const [a, b] = await Promise.all([
    gql(q1, { season, year }, { cacheKey: `home1:${season}${year}` }),
    gql(q2, {}, { cacheKey: 'home2' }),
  ]);
  return {
    trending: a.trending.media.filter(safe), season: a.season.media.filter(safe), top: a.top.media.filter(safe),
    popular: b.popular.media.filter(safe), upcoming: b.upcoming.media.filter(safe), movies: b.movies.media.filter(safe),
    seasonLabel: `${season[0]}${season.slice(1).toLowerCase()} ${year}`,
  };
}

export async function genreRow(genre) {
  const q = `${CARD} query ($g: String) { Page(perPage: 24) { media(${SAFE}, genre: $g, sort: TRENDING_DESC) { ...card } } }`;
  const d = await gql(q, { g: genre }, { cacheKey: 'genre:' + genre });
  return d.Page.media.filter(safe);
}

/** Episodes that aired in the last few days (newest first), one entry per show. */
export async function recentEpisodes() {
  const now = Math.floor(Date.now() / 1000);
  const q = `${CARD}
  query ($from: Int, $to: Int) {
    Page(perPage: 50) {
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) {
        episode airingAt media { ...card tags { name rank } }
      }
    }
  }`;
  const d = await gql(q, { from: now - 4 * 86400, to: now }, { cacheKey: 'recent', ttl: 5 * 60 * 1000 });
  const seen = new Set();
  const out = [];
  for (const s of d.Page.airingSchedules) {
    if (!safe(s.media) || seen.has(s.media.id)) continue;
    seen.add(s.media.id);
    out.push({ ...s.media, _airedEpisode: s.episode, _airedAt: s.airingAt });
  }
  return out;
}

export async function schedule(dayStart) {
  const q = `${CARD}
  query ($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt media { ...card tags { name rank } } }
    }
  }`;
  const from = Math.floor(dayStart / 1000), to = from + 86400;
  let page = 1, all = [];
  while (page < 4) {
    const d = await gql(q, { from, to, page }, { cacheKey: `sched:${from}:${page}`, ttl: 15 * 60 * 1000 });
    all = all.concat(d.Page.airingSchedules);
    if (!d.Page.pageInfo.hasNextPage) break;
    page++;
  }
  return all.filter(s => safe(s.media));
}

export async function media(id) {
  const q = `${CARD} ${FULL} query ($id: Int) { Media(id: $id, type: ANIME) { ...full } }`;
  const d = await gql(q, { id: Number(id) }, { cacheKey: 'media:' + id, ttl: 30 * 60 * 1000 });
  const m = d.Media;
  if (m) {
    // a title opened directly is checked too, and its related/recommended lists are filtered
    m.blocked = !safe(m);
    if (m.relations) m.relations.edges = (m.relations.edges || []).filter(e => safe(e.node));
    if (m.recommendations) m.recommendations.nodes = (m.recommendations.nodes || []).filter(n => safe(n.mediaRecommendation));
  }
  return m;
}

export async function search(text, page = 1) {
  const q = `${CARD}
  query ($q: String, $page: Int) {
    Page(page: $page, perPage: 30) { pageInfo { hasNextPage } media(${SAFE}, search: $q, sort: SEARCH_MATCH) { ...card } }
  }`;
  const d = await gql(q, { q: text, page }, { cacheKey: `search:${text}:${page}` });
  return { ...d.Page, media: d.Page.media.filter(safe) };
}

export async function browse({ genre, sort = 'TRENDING_DESC', format, status, year, season, page = 1 }) {
  const args = [SAFE, `sort: ${sort}`];
  const vars = { page };
  const defs = ['$page: Int'];
  if (genre) { args.push('genre: $genre'); defs.push('$genre: String'); vars.genre = genre; }
  if (format) { args.push('format: $format'); defs.push('$format: MediaFormat'); vars.format = format; }
  if (status) { args.push('status: $status'); defs.push('$status: MediaStatus'); vars.status = status; }
  if (year) { args.push('seasonYear: $year'); defs.push('$year: Int'); vars.year = Number(year); }
  if (season) { args.push('season: $season'); defs.push('$season: MediaSeason'); vars.season = season; }
  const q = `${CARD} query (${defs.join(', ')}) { Page(page: $page, perPage: 30) { pageInfo { hasNextPage } media(${args.join(', ')}) { ...card } } }`;
  const d = await gql(q, vars, { cacheKey: 'browse:' + JSON.stringify(vars) + sort });
  return { ...d.Page, media: d.Page.media.filter(safe) };
}

export const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

// ---------------------------------------------------------------- ani.zip

export async function extras(anilistId) {
  const key = 'az:' + anilistId;
  try {
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    if (s && Date.now() - s.at < 12 * 3600 * 1000) return s.data;
  } catch { /* ignore */ }
  try {
    const res = await fetch(ANIZIP + anilistId);
    if (!res.ok) return null;
    const z = await res.json();
    const img = t => (z.images || []).find(i => i.coverType === t)?.url || null;
    const episodes = {};
    for (const [k, e] of Object.entries(z.episodes || {})) {
      const n = parseInt(k, 10);
      if (!n || n < 1) continue;
      episodes[n] = {
        title: e.title?.en || e.title?.['x-jat'] || '',
        image: e.image || null,
        runtime: Number(e.runtime || e.length || 0) || 0,
        overview: e.overview || e.summary || '',
        airdate: e.airdate || e.airDate || '',
      };
    }
    const data = { fanart: img('Fanart'), logo: img('Clearlogo'), banner: img('Banner'), poster: img('Poster'),
      episodes, episodeCount: z.episodeCount || 0 };
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* full */ }
    return data;
  } catch {
    return null;
  }
}

/** Number of episodes that can be watched now. */
export function availableEpisodes(m, ex) {
  if (m.nextAiringEpisode) return Math.max(0, m.nextAiringEpisode.episode - 1);
  if (m.status === 'NOT_YET_RELEASED') return 0;
  return m.episodes || ex?.episodeCount || Object.keys(ex?.episodes || {}).length || (m.format === 'MOVIE' ? 1 : 0);
}
