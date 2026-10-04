(async () => {
  const host = document.querySelector('#anikku-skin');
  if (!host) return { skin: false, jw: typeof window.jwplayer };
  const ui = host.shadowRoot.querySelector('.ui');
  ui.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  const p = window.jwplayer();
  return {
    skin: true, state: p.getState(), pos: Math.round(p.getPosition()), dur: Math.round(p.getDuration()),
    controlsOn: ui.classList.contains('on'), title: host.shadowRoot.querySelector('.t2').textContent,
    marks: host.shadowRoot.querySelector('.marks').children.length,
  };
})()
