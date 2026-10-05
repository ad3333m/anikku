// Makes a page inside the Ciname apps feel like part of the app rather than a website: no text selection,
// copy menu or long-press callouts, and no pinch or double-tap zoom. Text fields still type. Injected
// into cinejoy.pk by every app; Anikku's own pages have the same rules in their CSS.
(() => {
  if (window.__cinameFeel || window.top !== window) return;
  window.__cinameFeel = true;

  const CSS = 'html{-webkit-text-size-adjust:100%;touch-action:manipulation}' +
    'body,body *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}' +
    'input,textarea,[contenteditable],[contenteditable] *{-webkit-user-select:text!important;user-select:text!important}';
  const VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  const apply = () => {
    if (!document.head) return;
    if (!document.getElementById('ciname-feel')) {
      const style = document.createElement('style');
      style.id = 'ciname-feel';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    if (vp.content !== VIEWPORT) vp.content = VIEWPORT;
  };

  const typing = () => /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });   // iOS pinch
  document.addEventListener('copy', e => { if (!typing()) e.preventDefault(); }, true);
  document.addEventListener('cut', e => { if (!typing()) e.preventDefault(); }, true);
  document.addEventListener('contextmenu', e => { if (!typing()) e.preventDefault(); }, true);

  // the site is a single-page app that rewrites its <head>, so keep re-applying for a while
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  let n = 0;
  const timer = setInterval(() => { apply(); if (++n > 30) clearInterval(timer); }, 1000);
})();
