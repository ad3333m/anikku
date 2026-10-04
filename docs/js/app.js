import * as home from './views/home.js';
import * as anime from './views/anime.js';
import * as watch from './views/watch.js';
import * as pages from './views/pages.js';

const view = document.getElementById('view');
let token = { current: false, cleanup: [] };
const scrollMemory = new Map();
let lastHash = location.hash;

const ROUTES = [
  [/^#?\/?$/, 'home', (v, t) => home.render(v, t)],
  [/^#\/anime\/(\d+)/, 'anime', (v, t, m) => anime.render(v, t, m[1])],
  [/^#\/watch\/(\d+)\/(\d+)/, 'watch', (v, t, m) => watch.render(v, t, m[1], m[2])],
  [/^#\/browse/, 'browse', (v, t, m, p) => pages.browse(v, t, p)],
  [/^#\/search/, 'search', (v, t, m, p) => pages.searchPage(v, t, p)],
  [/^#\/list/, 'list', v => pages.myList(v)],
  [/^#\/history/, 'history', (v, t) => pages.historyPage(v, t)],
  [/^#\/schedule/, 'schedule', (v, t, m, p) => pages.schedulePage(v, t, p)],
  [/^#\/settings/, 'settings', v => pages.settingsPage(v)],
];

async function route() {
  scrollMemory.set(lastHash, window.scrollY);
  token.current = false;
  token.cleanup.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  token = { current: true, cleanup: [] };

  const hash = location.hash || '#/';
  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  const match = ROUTES.find(([re]) => re.test(path)) || ROUTES[0];
  const m = path.match(match[0]);

  document.body.dataset.route = match[1];
  document.title = 'Anikku';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === match[1]));
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');

  const remembered = scrollMemory.get(hash);
  window.scrollTo(0, 0);
  try {
    await match[2](view, token, m, params);
  } catch (e) {
    console.error(e);
  }
  if (remembered && token.current) requestAnimationFrame(() => window.scrollTo(0, remembered));
  lastHash = hash;
  onScroll();
}

function onScroll() {
  document.body.classList.toggle('scrolled', window.scrollY > 24);
}

// in-app back: return to the previous screen, or Home when this was the first one
let depth = 0;
window.addEventListener('hashchange', () => { depth++; });
document.getElementById('back').addEventListener('click', () => {
  if (depth > 0) { depth -= 2; history.back(); } else location.hash = '#/';
});

window.addEventListener('hashchange', route);
window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); location.hash = '#/search'; }
});
if (/AnikkuApp/.test(navigator.userAgent)) document.documentElement.classList.add('in-app');
route();
