# Anikku

Anime streaming with a Crunchyroll-style interface.

- `docs/` – the app (a static site served by GitHub Pages): catalogue from AniList, artwork and episode
  stills from ani.zip, playback through website players.
- `docs/player/skin.js` – Anikku's own player controls, injected into the player frame by the apps.
- `ios/` – the iPhone/iPad app: a WebView shell that blocks pop-ups/redirects/ads and injects the skin.
- `tools/cdp.mjs` – drives headless Edge to test the skin inside the real player frame.
