(async () => {
  const p = window.jwplayer();
  const item = p.getPlaylistItem();
  let chapters = item.chapters;
  const out = { chaptersType: typeof chapters, chapters: JSON.stringify(chapters).slice(0, 400) };
  const ch = (item.tracks || []).filter(t => t.kind === 'chapters').map(t => t.file);
  out.chapterTracks = ch;
  if (ch[0]) { try { out.vtt = (await (await fetch(ch[0])).text()).slice(0, 500); } catch (e) { out.vttErr = String(e); } }
  out.zbtn = [...document.querySelectorAll('.zbtn')].map(b => b.outerHTML.slice(0, 200));
  out.tracksKinds = (item.tracks || []).map(t => t.kind + ':' + (t.label || ''));
  return out;
})()
