# Ciname for Windows

Ciname (the picker, Anikku and Cinejoy) as one self-contained `Ciname.exe`: a WinForms window around
Edge WebView2, built with the .NET Framework compiler (no SDK, no installer).

- Three WebView2 views stacked in the window; an app keeps its place behind the picker.
- The picker and Anikku are embedded in the exe and served from `https://ciname.local/` and
  `https://app.anikku.local/`; Anikku's player skin is injected into the MegaPlay frame.
- Pop-up windows are refused, Anikku's frames may only be the players, ad domains get an empty answer
  in every frame, and each app's Home has a back arrow to the picker (Alt+Home anywhere, F11 full screen).

Build: `build.cmd` (needs Python and Node for the page bundling) -> `dist\Ciname.exe`.
Test: start the exe with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then
`node tests/cdp.mjs <url-part> <script.js> [shot.png]`.
