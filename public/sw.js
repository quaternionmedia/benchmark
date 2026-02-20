/**
 * public/sw.js
 * Service worker — caches OSM map tiles for offline use.
 *
 * Strategy:
 *   - Tile requests (tile.openstreetmap.org): cache-first, background update
 *   - Everything else: network-first with cache fallback
 *
 * Cache names are versioned so old caches are pruned on activate.
 */

const CACHE_VERSION  = 'v2'
const SHELL_CACHE    = `benchmark-shell-${CACHE_VERSION}`
const TILE_CACHE     = `benchmark-tiles-${CACHE_VERSION}`
const MAX_TILE_AGE   = 7 * 24 * 60 * 60 * 1000   // 7 days in ms

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  event.waitUntil(self.skipWaiting())
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  // Prune caches from older versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('benchmark-') && !k.endsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Only intercept http(s) — ignore chrome-extension:// and other schemes
  if (!event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // Cache-first for OSM tile requests
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(cacheTileFirst(event.request))
    return
  }

  // Let these pass through to the network without SW involvement:
  //   • GeoJSON bench data — IndexedDB (src/store.js) is the single source of truth
  //   • PWA manifest — must always be fresh so the browser can re-parse it
  //   • Overpass API POSTs — non-GET, can't be cached anyway
  if (
    url.pathname.endsWith('/data/benches.geojson') ||
    url.pathname.endsWith('.webmanifest') ||
    url.hostname.endsWith('overpass-api.de')
  ) return

  // Network-first for all other requests (app shell, fonts)
  event.respondWith(networkFirst(event.request))
})

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheTileFirst(request) {
  const cache  = await caches.open(TILE_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    // Serve from cache; revalidate in background if stale
    const age = Date.now() - new Date(cached.headers.get('date') || 0).getTime()
    if (age > MAX_TILE_AGE) {
      fetch(request).then(res => { if (res.ok) cache.put(request, res) }).catch(() => {})
    }
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('', { status: 503, statusText: 'Offline — tile not cached' })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    // Cache API only accepts GET/HEAD; skip caching for POST and other methods
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Cache fallback is only meaningful for GET requests
    if (request.method !== 'GET') return new Response('', { status: 503 })
    const cached = await caches.match(request)
    return cached || new Response('', { status: 503 })
  }
}
