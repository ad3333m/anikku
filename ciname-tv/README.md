# Ciname for Google TV

Ciname (the picker, Anikku and Cinejoy) as an Android TV app, built for a Sony BRAVIA 8 77".

- **Remote only.** Every key goes to `res/raw/tv_nav.js`, Cinejoy TV's geometric D-pad navigator made
  general: a thick focus ring (orange in Anikku, lime in Cinejoy), Back goes back a page and from an
  app's Home to the picker, Back on the picker leaves.
- **Anikku's player on a remote.** The skin is put into the MegaPlay frame with
  `WebViewCompat.addDocumentStartJavaScript`; while the player has the ring, OK plays/pauses (or skips
  the intro), left/right seek 10s, up opens subtitles, down goes to the episodes.
- **Gentle on the TV.** No blur, no Ken Burns, the picker stops animating behind an app, the screen stays
  awake while an episode is open, and a full-screen film asks for the panel's largest output mode.
- **No ads, no pop-ups.** Ad domains get an empty response, pop-up windows are refused, and the player
  skin's strict mode only lets the player's own scripts run.

The pages are not committed here: CI bundles them into `app/src/main/assets/` (`ios/bundle_web.py` for
Anikku, `ciname/tools/inline_launcher.py` for the picker) before Gradle runs, then builds the APK
(debug-signed, so it installs from a USB stick, Downloader or `adb install`) and runs it on an
Android TV emulator with remote key presses (`tools/emulator_test.sh`).
