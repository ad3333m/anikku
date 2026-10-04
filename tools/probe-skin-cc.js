(async () => {
  const sr = document.querySelector('#anikku-skin').shadowRoot;
  sr.querySelector('.ui').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  sr.querySelector('[data-a="cc"]').click();
  await new Promise(r => setTimeout(r, 500));
  return { open: sr.querySelector('.menu').classList.contains('open'), items: sr.querySelectorAll('.menu .opt').length };
})()
