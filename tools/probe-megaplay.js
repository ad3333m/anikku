(async () => {
  const out = {};
  out.href = location.href;
  out.jw = typeof window.jwplayer;
  try {
    const p = window.jwplayer && window.jwplayer();
    if (p && p.getState) {
      out.state = p.getState();
      out.duration = p.getDuration();
      out.position = p.getPosition();
      out.captions = (p.getCaptionsList() || []).map(c => c.label);
      out.qualities = (p.getQualityLevels() || []).map(q => q.label);
      out.audioTracks = (p.getAudioTracks && p.getAudioTracks() || []).map(a => a.name);
      out.item = Object.keys(p.getPlaylistItem() || {});
    }
  } catch (e) { out.jwError = String(e); }
  out.videos = [...document.querySelectorAll('video')].map(v => ({ src: (v.currentSrc || v.src || '').slice(0, 60), w: v.videoWidth, paused: v.paused }));
  const classes = new Set();
  document.querySelectorAll('body *').forEach(el => el.classList.forEach(c => { if (!c.startsWith('jw-') || c.length < 30) classes.add(c); }));
  out.classes = [...classes].filter(c => !/^jw-(reset|svg|icon)/.test(c)).slice(0, 160);
  out.bodyChildren = [...document.body.children].map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ').join('.') : ''));
  out.iframes = [...document.querySelectorAll('iframe')].map(f => f.src);
  return out;
})()
