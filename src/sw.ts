/**
 * src/sw.ts
 *
 * Offline app-shell cache, opt-in via the "make this site offline" button
 * (src/offline.ts wires it; index.html has the button). Not auto-registered
 * on every visit - registration only happens when a visitor explicitly asks
 * for it, so "browser-native, no surprise background behavior" holds.
 *
 * Precache paths are resolved against `scope.registration.scope`, not
 * hardcoded absolute paths - this repo deploys under a subpath
 * (forageopen.github.io/Noted/), and resolving against scope keeps this
 * file correct there, at the repo root, and in local dev without a
 * deployment-specific edit.
 *
 * Strategy: cache-first for the precached shell (index.html, styles.css,
 * dist/main.js, this file), network passthrough for everything else -
 * simplest strategy that satisfies "the app shell still loads with no
 * network," which is the actual ask. Not a general-purpose offline data
 * cache (there's no server data to cache - this app is local-first, the
 * user's file never leaves their browser in the first place).
 */

// This file is compiled under tsconfig.sw.json (lib: WebWorker, not DOM) -
// excluded from the main tsconfig.json (DOM lib) since a single program
// can't have both DOM's and WebWorker's incompatible `self` types at once
// (see npm run typecheck, which runs both configs). TS's webworker lib
// does define ServiceWorkerGlobalScope/FetchEvent/ExtendableEvent, but the
// ambient `self` itself still resolves to the more generic
// WorkerGlobalScope - casting once here (rather than redeclaring the
// ambient `self` binding, which TS rejects) gives every use below the
// correct, specific type.
const scope = self as unknown as ServiceWorkerGlobalScope;

// Bumped to v2 (font asset added to the shell) - a new CACHE_NAME forces a
// fresh precache on activate (see the "activate" handler below, which
// deletes any cache whose name isn't CACHE_NAME), so an already-offline
// visitor actually picks up newly added shell files instead of being
// stuck with whatever was cached under the old name.
const CACHE_NAME = "noted-shell-v2";
const SHELL_PATHS = ["", "index.html", "styles.css", "dist/main.js", "dist/sw.js", "assets/fonts/EricaOne-Regular.woff2"];

function shellUrls(): string[] {
  return SHELL_PATHS.map((path) => new URL(path, scope.registration.scope).href);
}

scope.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(shellUrls());
      await scope.skipWaiting();
    })(),
  );
});

scope.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await scope.clients.claim();
    })(),
  );
});

scope.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (err) {
        // Offline and not in the precached shell (e.g. a font/CDN request
        // that happens not to be same-origin) - nothing sensible to return.
        throw err;
      }
    })(),
  );
});
