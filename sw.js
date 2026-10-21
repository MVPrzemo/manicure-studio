/* Service worker: aplikacja otwiera się też bez internetu (dane z ostatniej synchronizacji). */
const CACHE = "manicure-studio-v3";
const SHELL = [
  "./", "./index.html", "./app.js", "./manifest.webmanifest",
  "./icons/logo.jpg", "./icons/logo-full.jpg", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // dane z Google Apps Script zawsze z sieci
  if (/(^|\.)google\.com$|googleusercontent\.com$/.test(url.hostname)) return;

  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  // najpierw sieć (świeża wersja aplikacji), przy braku internetu – kopia z pamięci
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
