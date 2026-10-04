// Ciname's way out of Cinejoy: a back button in cinejoy.pk's own top bar, next to its logo, that returns
// to the Ciname picker. Every other page already has the site's own "Go back" arrow there, so this one
// only shows where that is missing (the home page) and never makes two arrows.
(() => {
  if (window.__cinameBack || window.top !== window) return;
  window.__cinameBack = true;

  const style = document.createElement('style');
  style.textContent = `
    #ciname-back { width: 38px; height: 38px; margin-right: 6px; padding: 0; border: 0; border-radius: 50%; flex: none;
      display: grid; place-items: center; cursor: pointer; pointer-events: auto; color: #fff;
      background: rgba(18, 18, 20, .55); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .14) inset, 0 6px 18px rgba(0, 0, 0, .35);
      -webkit-tap-highlight-color: transparent; transition: transform .15s, background .2s; }
    #ciname-back:active { transform: scale(.88); background: rgba(149, 255, 80, .3); }
    #ciname-back.floating { position: fixed; z-index: 2147483000; margin: 0;
      left: max(16px, env(safe-area-inset-left)); top: calc(env(safe-area-inset-top) + 14px); }`;

  const button = document.createElement('button');
  button.id = 'ciname-back';
  button.type = 'button';
  button.setAttribute('aria-label', 'Back to Ciname');
  button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 5l-7 7 7 7"/></svg>';
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ciname) window.webkit.messageHandlers.ciname.postMessage('exit');
      else if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage('exit');   // Ciname for Windows
    } catch (err) { /* not inside Ciname */ }
  });

  // the site re-renders its header as you move around, so keep checking where the button belongs
  const place = () => {
    if (!document.head || !document.body) return;
    if (!style.isConnected) document.head.appendChild(style);
    const logo = document.querySelector('.header-row a[href="/"]');
    const slot = logo && logo.parentElement;
    if (slot && slot.querySelector('[aria-label="Go back"]')) {
      if (button.isConnected) button.remove();
    } else if (slot) {
      button.classList.remove('floating');
      if (slot.firstElementChild !== button) slot.insertBefore(button, slot.firstElementChild);
    } else if (location.pathname === '/') {
      // the header markup changed: still give Home a way out, floating where the logo would be
      button.classList.add('floating');
      if (button.parentElement !== document.body) document.body.appendChild(button);
    } else if (button.isConnected) {
      button.remove();
    }
  };
  // `document`, not documentElement: on Windows this runs before the page has any HTML
  new MutationObserver(place).observe(document, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
})();
