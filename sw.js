/* October Challenge service worker: precache everything, serve cache-first, refresh in background. */
const CACHE = "october-challenge-e9c24a732e";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png", "./icons/icon.svg", "./screenshots/phone.png", "./screenshots/desktop.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("october-challenge-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Browsers probe /favicon.ico (often outside our subfolder): answer from the cached app icon.
  if (url.pathname.endsWith("/favicon.ico")) {
    event.respondWith(caches.open(CACHE).then((c) => c.match("./icons/icon-192.png")).then((r) => r || fetch(req)));
    return;
  }
  if (!req.url.startsWith(self.registration.scope)) return;
  const isNav = req.mode === "navigate";
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = isNav
      ? (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html"))
      : await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(isNav ? "./index.html" : req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response("Offline and not cached yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
  })());
});
