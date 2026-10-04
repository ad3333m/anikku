// Video servers: website players that take a MyAnimeList/AniList id and an episode number.
// The user can reorder or switch them off in Settings; the watch page falls back down the list.

export const SERVERS = [
  {
    id: 'megaplay',
    name: 'MegaPlay',
    note: 'Fast HD, subtitles in many languages',
    url: (m, ep, audio) => m.idMal ? `https://megaplay.buzz/stream/mal/${m.idMal}/${ep}/${audio}` : null,
  },
  {
    id: 'megaplay-mirror',
    name: 'MegaPlay Mirror',
    note: 'Same library on a backup domain',
    url: (m, ep, audio) => m.idMal ? `https://megaplay-1.buzz/stream/mal/${m.idMal}/${ep}/${audio}` : null,
  },
  {
    id: 'megaplay-anilist',
    name: 'MegaPlay (AniList match)',
    note: 'Matches by AniList id when the MAL match is wrong',
    url: (m, ep, audio) => `https://megaplay.buzz/stream/ani/${m.id}/${ep}/${audio}`,
  },
];

export function orderedServers(settings) {
  const byId = Object.fromEntries(SERVERS.map(s => [s.id, s]));
  const ordered = settings.servers.map(id => byId[id]).filter(Boolean);
  for (const s of SERVERS) if (!ordered.includes(s)) ordered.push(s);
  return ordered.filter(s => !settings.disabledServers.includes(s.id));
}
