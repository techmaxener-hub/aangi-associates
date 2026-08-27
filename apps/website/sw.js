// Aangi Associates — minimal service worker for the public marketing site.
// Network-first, cache-fallback: every request tries the network first so
// content is never stale, and only falls back to the cache when offline.
// Deliberately NOT cache-first — this is a static (non-hashed) build, so
// caching JS/CSS aggressively would risk serving outdated files after a
// deploy.
//
// Scope note: this file sits at the document root, so its *reachable*
// scope is the whole origin — including /app/, the CRM single-page app.
// A service worker has no business touching that SPA (stale JS chunks
// after a redeploy, interference with Supabase auth fetches), so the
// fetch handler explicitly ignores anything under /app/ and lets the
// browser handle those requests exactly as if no service worker existed.
const CACHE_NAME = "aangi-shell-v1";
const SHELL_ASSETS = [
  "/index.html",
  "/assets/css/main.css",
  "/packages/ui/tokens.css",
  "/packages/ui/components.css",
  "/packages/ui/include.js",
  "/assets/img/logo-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // leave Supabase/Google Fonts/etc. alone
  if (url.pathname.startsWith("/app/")) return; // leave the CRM SPA alone entirely

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }),
  );
});
