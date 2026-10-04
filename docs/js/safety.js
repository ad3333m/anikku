// What the catalogue leaves out, everywhere it shows anime (home rows, browse, search, schedule, related,
// recommendations, history, My List, and a title opened directly). Violence and gore stay; sexual content
// does not: adult titles, the Ecchi and Hentai genres, titles tagged for sexual themes, and titles where
// nudity is a big part of the show.
// LGBTQ+ themed titles are left out too, at Adam's request.
//
// AniList hides its "Sexual Content" tags from anonymous requests, so these are the visible signals.

export const BLOCKED_GENRES = ['Ecchi', 'Hentai'];

export const BLOCKED_TAGS = [
  // sexual themes
  'Ero Guro', "Teens' Love", 'Incest', 'Inseki', 'Succubus',
  // LGBTQ+
  'LGBTQ+ Themes', "Boys' Love", 'Yuri', 'Transgender', 'Bisexual', 'Asexual',
];

/** AniList only applies tag filters to tags ranked at least this high (its own default). */
const MIN_RANK = 18;

/** Nudity only counts when it's a big part of the show: Chainsaw Man (46) stays, High School DxD (96) doesn't.
 *  AniList can't filter by one tag's rank, so this is checked on the device (cards carry their tags). */
const NUDITY_RANK = 60;

const list = xs => xs.map(x => JSON.stringify(x)).join(', ');

/** GraphQL arguments for Page.media that keep blocked titles out of the results. */
export const SAFE_ARGS = `isAdult: false, genre_not_in: [${list(BLOCKED_GENRES)}], tag_not_in: [${list(BLOCKED_TAGS)}]`;

/** The same rule for media that come back unfiltered (airing schedules, relations, saved items). */
export function safe(m) {
  if (!m || m.isAdult) return false;
  if ((m.genres || []).some(g => BLOCKED_GENRES.includes(g))) return false;
  if ((m.tags || []).some(t => BLOCKED_TAGS.includes(t.name) && (t.rank == null || t.rank >= MIN_RANK))) return false;
  if ((m.tags || []).some(t => t.name === 'Nudity' && t.rank >= NUDITY_RANK)) return false;
  return m.blocked !== true;
}
