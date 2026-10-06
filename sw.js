/* Hace que la app funcione sin internet.
   - La página se guarda cada vez que la abres con internet; sin internet, se usa la copia guardada.
   - El detector de postura de la cámara (MediaPipe) se guarda la primera vez que lo usas.
   - No toca nada más (por ejemplo, tu IA local): esas conexiones pasan directo. */
const APP = "s3-app-v1";
const CDN = "s3-cdn-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("s3-app-") && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function isCdn(u) { return u.hostname === "cdn.jsdelivr.net" || u.hostname === "storage.googleapis.com"; }
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith(".html")) {
      e.respondWith(fetch(req).then((r) => {
        if (r.ok) { const cp = r.clone(); caches.open(APP).then((c) => c.put("./index.html", cp)); }
        return r;
      }).catch(() => caches.match("./index.html").then((r) => r || caches.match("./"))));
      return;
    }
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(APP).then((c) => c.put(req, cp)); }
      return r;
    })));
    return;
  }
  if (isCdn(u)) {
    e.respondWith(caches.open(CDN).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }))));
  }
});
