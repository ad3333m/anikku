// Ciname website: the service worker behind the Cinejoy browser page. It hands proxied requests
// (everything under cinejoy/go/) to Scramjet and leaves the rest of the site alone. Same setup as
// BrickyProcky (Scramjet 1.1.0, bare-mux 2.1.9, the Epoxy transport over a public Wisp relay).
importScripts("scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const BASE = new URL("./", self.location).pathname;
const PROXIED = [self.location.origin + BASE + "go/", self.location.origin + BASE + "scram/scramjet.wasm.wasm"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function proxied(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) return scramjet.fetch(event);
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (PROXIED.some((prefix) => url.startsWith(prefix))) event.respondWith(proxied(event));
});
