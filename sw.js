/* Hace que la app funcione sin internet y que se actualice sola.
   - Con internet, cada archivo de la app se pide fresco (si no cambió, el servidor responde «igual» y casi no gasta datos);
     sin internet, se usa la copia guardada. Así nunca se mezcla un archivo nuevo con uno viejo.
   - Cada versión nueva trae este archivo con otro número: el navegador lo nota, se instala
     y la app recarga sola cuando no estás en una sesión ni en una conversación.
   - El detector de postura de la cámara (MediaPipe) se guarda la primera vez que lo usas.
   - No toca nada más (tu IA, GitHub, Gemini): esas conexiones pasan directo.
   PARA OTRA PERSONA: cambia "s3" por el mismo prefijo que PERFIL.cache en programa.js (por ejemplo "milu"),
   así dos apps en la misma cuenta de GitHub no se borran las copias guardadas. */
const APP = "s3-app-v7";                 // sube el número en cada versión
const PRE = APP.split("-app-")[0];       // "s3"
const CDN = PRE + "-cdn-v1";
const SHELL = ["./", "./index.html", "./estilos.css", "./programa.js", "./figuras.js", "./motor.js", "./fuente.woff2",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PRE + "-app-") && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function isCdn(u) { return u.hostname === "cdn.jsdelivr.net" || u.hostname === "storage.googleapis.com"; }
/* Red primero (con un tope de 4 s si ya hay copia guardada); si no hay red, la copia. */
function fresh(req, key) {
  return caches.open(APP).then((c) => c.match(key, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((r) => {
      if (r && r.status === 200) c.put(key, r.clone());
      return r;
    });
    if (!hit) return net;
    const slow = new Promise((ok) => setTimeout(() => ok(hit), 4000));
    return Promise.race([net.catch(() => hit), slow]);
  }));
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin && /\/equipos\.json$/.test(u.pathname)) return;   // siempre de internet: el llavero cifrado
  if (u.origin === self.location.origin) {
    const page = req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith(".html");
    e.respondWith(fresh(page ? req : new Request(req, { cache: "no-cache" }), page ? "./index.html" : u.pathname.replace(/^.*\//, "./")));
    return;
  }
  if (isCdn(u)) {
    e.respondWith(caches.open(CDN).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.status === 200 || r.type === "opaque") c.put(req, r.clone());
      return r;
    }))));
  }
});
