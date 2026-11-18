const CACHE_NAME = "brigade-tracker-v7";

// Service Worker может находиться как в корне локального сайта, так и в подпапке GitHub Pages.
const APP_SCOPE = self.registration.scope;
const APP_BASE_PATH = new URL("./", APP_SCOPE).pathname;
const APP_INDEX_PATH = new URL("index.html", APP_SCOPE).pathname;
const APP_MANIFEST_PATH = new URL("manifest.json", APP_SCOPE).pathname;
const APP_SHELL_PATHS = [
  APP_BASE_PATH,
  APP_INDEX_PATH,
  APP_MANIFEST_PATH,
  new URL("theme-init.js", APP_SCOPE).pathname,
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL_PATHS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith("brigade-tracker-") && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_BASE_PATH)) return;

  // Кэшируем только статические файлы текущего приложения.
  // Пользовательские JSON/CSV-экспорты и любые URL с параметрами не кэшируются.
  const staticDestinations = ["document", "script", "style", "image", "font", "manifest"];
  const isStatic = request.mode === "navigate" || staticDestinations.includes(request.destination);
  const isDataFile = /\.(json|csv|xlsx?|bak|sqlite)$/i.test(url.pathname)
    && url.pathname !== APP_MANIFEST_PATH;
  if (!isStatic || isDataFile || url.search) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy))
              .catch(() => {})
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const appShell = await caches.match(APP_BASE_PATH)
            || await caches.match(APP_INDEX_PATH);
          if (appShell) return appShell;
        }
        return Response.error();
      })
  );
});
