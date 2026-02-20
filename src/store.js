/**
 * src/store.js
 * Single source of truth for bench data.
 *
 * Public API:
 *   loadBenches()        → Promise<{ features, metadata, source: 'cache'|'network' }>
 *   clearCache()         → Promise<void>
 *   setBenchProvider(fn) → void
 *       fn signature: () => Promise<{ features: Array, metadata: Object }>
 *       When set, the entire IDB path is bypassed — the provider owns caching.
 */

const DB_NAME     = 'benchmark-store'
const DB_VERSION  = 1
const STORE_NAME  = 'benches'
const RECORD_KEY  = 'v1'
const STALE_MS    = 4 * 60 * 60 * 1000   // 4 hours
const GEOJSON_URL = './data/benches.geojson'

// ─── Extension point ──────────────────────────────────────────────────────────

let _benchProvider = null

/**
 * Replace the default fetch+IDB strategy with a custom async function.
 * Call this before loadBenches() — e.g. at app startup when a backend is available.
 *
 * @param {() => Promise<{ features: Array, metadata: Object }>} fn
 */
export function setBenchProvider(fn) {
  _benchProvider = fn
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load bench data with IDB stale-while-revalidate.
 *
 * Cold start:  fetch network → store in IDB → return features
 * Warm fresh:  return from IDB immediately (no network request)
 * Warm stale:  return from IDB immediately, revalidate in background
 *
 * @returns {Promise<{ features: Array, metadata: Object, source: 'cache'|'network' }>}
 */
export async function loadBenches() {
  if (_benchProvider) {
    const result = await _benchProvider()
    return { ...result, source: 'network' }
  }
  return _loadWithIDB()
}

/**
 * Merge new GeoJSON features into the IDB cache, deduplicating by feature id.
 * Returns the subset of newFeatures that were actually added (i.e. not already present).
 *
 * @param {Array} newFeatures - GeoJSON features to merge in
 * @returns {Promise<Array>} features that were genuinely new
 */
export async function mergeFeatures(newFeatures) {
  let db
  try { db = await _openDB() } catch { return newFeatures }

  const cached = await _readFromIDB(db)
  const existing = cached ? cached.features : []

  const existingIds = new Set(existing.map(f => f.properties.id))
  const toAdd = newFeatures.filter(f => !existingIds.has(f.properties.id))

  if (!toAdd.length) return toAdd

  const merged = [...existing, ...toAdd]
  const metadata = cached ? { generated_at: cached.generated_at } : {}
  await _writeToIDB(db, merged, metadata)
  return toAdd
}

/**
 * Delete the IDB cache record. Useful for dev and for forcing a fresh fetch.
 * @returns {Promise<void>}
 */
export async function clearCache() {
  let db
  try { db = await _openDB() } catch { return }
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.delete(RECORD_KEY)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

function _readFromIDB(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.get(RECORD_KEY)
    req.onsuccess = (e) => resolve(e.target.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

function _writeToIDB(db, features, metadata) {
  return new Promise((resolve, reject) => {
    const tx     = db.transaction(STORE_NAME, 'readwrite')
    const store  = tx.objectStore(STORE_NAME)
    const record = {
      features,
      generated_at: metadata?.generated_at ?? null,
      cached_at:    Date.now()
    }
    const req = store.put(record, RECORD_KEY)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── Network fetch ────────────────────────────────────────────────────────────

async function _fetchFromNetwork(db) {
  const res     = await fetch(GEOJSON_URL)
  const geojson = await res.json()
  const { features, metadata } = geojson
  // Write to IDB in background — don't block the return path
  _writeToIDB(db, features, metadata).catch(console.warn)
  return { features, metadata }
}

// ─── Core stale-while-revalidate flow ─────────────────────────────────────────

async function _loadWithIDB() {
  let db
  try {
    db = await _openDB()
  } catch {
    // IDB unavailable (private browsing, quota, etc.) — fall back to raw fetch
    const res     = await fetch(GEOJSON_URL)
    const geojson = await res.json()
    return { features: geojson.features, metadata: geojson.metadata, source: 'network' }
  }

  const cached = await _readFromIDB(db)

  if (!cached) {
    // Cold start: nothing in IDB yet
    const { features, metadata } = await _fetchFromNetwork(db)
    return { features, metadata, source: 'network' }
  }

  const age   = Date.now() - cached.cached_at
  const stale = age > STALE_MS

  if (stale) {
    // Serve stale data immediately; refresh IDB in background
    _fetchFromNetwork(db).catch(console.warn)
  }

  return {
    features: cached.features,
    metadata: { generated_at: cached.generated_at },
    source:   'cache'
  }
}
