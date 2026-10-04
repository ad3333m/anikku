// Everything the user owns lives in localStorage on this device: My List, watch history, settings.

import { safe } from './safety.js';

const K = { list: 'anikku.list', history: 'anikku.history', settings: 'anikku.settings', searches: 'anikku.searches' };

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new CustomEvent('anikku:store', { detail: key }));
}

/** Small copy of a show, enough to draw cards without asking AniList again. */
export function snapshot(m) {
  return {
    id: m.id, idMal: m.idMal, format: m.format, episodes: m.episodes, status: m.status,
    title: m.title, coverImage: m.coverImage, bannerImage: m.bannerImage, averageScore: m.averageScore,
    seasonYear: m.seasonYear, genres: m.genres || [], nextAiringEpisode: m.nextAiringEpisode || null,
    isAdult: !!m.isAdult, blocked: !safe(m),
  };
}

// ---------------------------------------------------------------- settings

export const DEFAULT_SETTINGS = {
  audio: 'sub',
  autoplay: true,
  autoskip: false,
  titleLang: 'english',
  servers: ['megaplay', 'megaplay-mirror', 'megaplay-anilist'],
  disabledServers: [],
};

export function settings() {
  return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) };
}
export function setSetting(key, value) {
  const s = settings();
  s[key] = value;
  write(K.settings, s);
}

// ---------------------------------------------------------------- My List

export function myList() { return read(K.list, []).filter(safe); }
export function inList(id) { return myList().some(x => x.id === id); }
export function toggleList(m) {
  const list = myList();
  const i = list.findIndex(x => x.id === m.id);
  if (i >= 0) list.splice(i, 1);
  else list.unshift({ ...snapshot(m), addedAt: Date.now() });
  write(K.list, list);
  return i < 0;
}

// ---------------------------------------------------------------- history

/** history: { [animeId]: { media, ep, t, d, updatedAt, watched: { [ep]: true }, progress: { [ep]: [t, d] } } } */
export function history() { return read(K.history, {}); }

export function continueWatching() {
  return Object.values(history()).filter(h => !h.hidden && safe(h.media)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function animeHistory(id) { return history()[id] || null; }

export function saveProgress(m, ep, t = 0, d = 0) {
  const h = history();
  const prev = h[m.id] || { watched: {}, progress: {} };
  const entry = { ...prev, media: snapshot(m), ep, t, d, updatedAt: Date.now(), hidden: false };
  entry.progress = { ...(prev.progress || {}), [ep]: [Math.round(t), Math.round(d)] };
  if (d > 0 && t / d > 0.9) entry.watched = { ...(prev.watched || {}), [ep]: true };
  h[m.id] = entry;
  write(K.history, h);
}

export function markWatched(m, ep, watched = true) {
  const h = history();
  const prev = h[m.id] || { watched: {}, progress: {}, ep, t: 0, d: 0 };
  const w = { ...(prev.watched || {}) };
  if (watched) w[ep] = true; else delete w[ep];
  h[m.id] = { ...prev, media: snapshot(m), watched: w, updatedAt: prev.updatedAt || Date.now() };
  write(K.history, h);
}

export function removeFromHistory(id) {
  const h = history();
  if (h[id]) { h[id].hidden = true; write(K.history, h); }
}

export function clearHistory() { write(K.history, {}); }
export function clearList() { write(K.list, []); }

// ---------------------------------------------------------------- recent searches

export function recentSearches() { return read(K.searches, []); }
export function addSearch(q) {
  const s = recentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
  s.unshift(q);
  write(K.searches, s.slice(0, 8));
}
