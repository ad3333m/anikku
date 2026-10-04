# Anikku

Anime streaming with a Crunchyroll-style interface.

- `docs/` – the app, a static site that ships inside the apps (`ios/bundle_web.py` packs it into one page):
  catalogue from AniList, artwork and episode stills from ani.zip, playback through website players.
- `docs/player/skin.js` – Anikku's own player controls, injected into the player frame by the apps.
- `ios/` – the iPhone/iPad app: a WebView shell that blocks pop-ups/redirects/ads and injects the skin.
- `ciname/` – Ciname, one iPhone/iPad app holding Anikku and Cinejoy (the cinejoy.pk shell
  from ad3333m/cinejoy-ios). It opens on a picker; the back button on either app's Home or a swipe in
  from the left edge returns to it.
- `tools/cdp.mjs` – drives headless Edge to test the skin inside the real player frame; `tools/adaudit.mjs`
  lists the pop-ups, ad hosts and overlays a watch page produces.
