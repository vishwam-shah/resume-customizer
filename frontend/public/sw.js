/*
 * Service worker: makes Tailor installable and usable offline.
 *  - Navigations: network first, so pages are always fresh; offline, the
 *    cached page or /offline.html is shown instead of the browser's error.
 *  - Built assets (/_next/static, /icons, fonts): cache first; their URLs
 *    are content-hashed, so a cached copy is never stale.
 *  - API calls and auth are never cached: they carry personal data.
 */
const version = "tailor-v1";
const shellCache = `${version}-shell`;
const assetCache = `${version}-assets`;
const precache = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const publicPages = ["/", "/sign-in", "/sign-up", "/forgot-password"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.addAll(precache)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(version)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Only public pages are cached; signed-in pages (history, account) hold personal data.
    const cacheable = publicPages.includes(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable && response.ok) {
            const copy = response.clone();
            caches.open(shellCache).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? caches.match("/offline.html")),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(assetCache).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
