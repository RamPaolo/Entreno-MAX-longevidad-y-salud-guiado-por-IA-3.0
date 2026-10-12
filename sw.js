/* Hace que la app funcione sin internet y que se actualice sola.
   - La página se guarda cada vez que la abres con internet; sin internet, se usa la copia guardada.
   - Cada versión nueva trae este archivo con otro número: el navegador lo nota, se instala
     y la app recarga sola cuando no estás en una sesión ni en una conversación.
   - El detector de postura de la cámara (MediaPipe) se guarda la primera vez que lo usas.
   - No toca nada más (tu IA, GitHub, Gemini): esas conexiones pasan directo. */
const APP = "s3-app-v5";
const CDN = "s3-cdn-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("s3-app-") && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function isCdn(u) { return u.hostname === "cdn.jsdelivr.net" || u.hostname === "storage.googleapis.com"; }
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin && /\/equipos\.json$/.test(u.pathname)) return;   // siempre de internet: el llavero cifrado
  if (u.origin === self.location.origin) {
    if (req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith(".html")) {
      e.respondWith(fetch(req).then((r) => {
        if (r.status === 200) { const cp = r.clone(); caches.open(APP).then((c) => c.put("./index.html", cp)); }
        return r;
      }).catch(() => caches.match("./index.html").then((r) => r || caches.match("./"))));
      return;
    }
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.status === 200) { const cp = r.clone(); caches.open(APP).then((c) => c.put(req, cp)); }
      return r;
    })));
    return;
  }
  if (isCdn(u)) {
    e.respondWith(caches.open(CDN).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.status === 200 || r.type === "opaque") c.put(req, r.clone());
      return r;
    }))));
  }
});
