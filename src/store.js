/**
 * src/store.js
 * Single source of truth for bench data and imported area metadata.
 *
 * Bench data API (IndexedDB stale-while-revalidate, 4-hour TTL):
 *   loadBenches()              → Promise<{ features, metadata, source: 'cache'|'network' }>
 *   mergeFeatures(newFeatures) → Promise<Array>   dedup-merges into IDB cache
 *   clearCache()               → Promise<void>
 *   setBenchProvider(fn)       → void  bypass IDB with a custom async provider
 *
 * Area metadata API (persists imported bbox/polygon/circle regions):
 *   saveArea(area)                  → Promise<void>
 *   loadAreas()                     → Promise<Array>   sorted newest-first
 *   renameArea(id, newName)         → Promise<void>
 *   deleteArea(id)                  → Promise<void>
 *   removeBenchesByAreaId(areaId)   → Promise<string[]>  returns removed feature IDs
 */

const DB_NAME     = 'benchmark-store'
const DB_VERSION  = 2
const STORE_NAME  = 'benches'
const AREAS_STORE = 'areas'
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

// ─── Areas API ────────────────────────────────────────────────────────────────

/**
 * Persist an area record to IndexedDB.
 * @param {{ id: string, name: string, type: string, bbox: number[], bench_count: number, created_at: string }} area
 * @returns {Promise<void>}
 */
export async function saveArea(area) {
  let db
  try { db = await _openDB() } catch { return }
  return new Promise((resolve, reject) => {
    const req = db.transaction(AREAS_STORE, 'readwrite').objectStore(AREAS_STORE).put(area)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/**
 * Load all area records from IndexedDB, sorted newest-first.
 * @returns {Promise<Array>}
 */
export async function loadAreas() {
  let db
  try { db = await _openDB() } catch { return [] }
  return new Promise((resolve, reject) => {
    const req = db.transaction(AREAS_STORE, 'readonly').objectStore(AREAS_STORE).getAll()
    req.onsuccess = (e) => {
      const areas = e.target.result ?? []
      areas.sort((a, b) => b.created_at.localeCompare(a.created_at))
      resolve(areas)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Update the name of an area record in IndexedDB.
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<void>}
 */
export async function renameArea(id, newName) {
  let db
  try { db = await _openDB() } catch { return }
  return new Promise((resolve, reject) => {
    const store  = db.transaction(AREAS_STORE, 'readwrite').objectStore(AREAS_STORE)
    const getReq = store.get(id)
    getReq.onsuccess = (e) => {
      const rec = e.target.result
      if (!rec) return resolve()
      rec.name = newName
      const putReq = store.put(rec)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/**
 * Delete an area record from IndexedDB by ID.
 * Does not remove the associated bench features — call removeBenchesByAreaId first.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteArea(id) {
  let db
  try { db = await _openDB() } catch { return }
  return new Promise((resolve, reject) => {
    const req = db.transaction(AREAS_STORE, 'readwrite').objectStore(AREAS_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/**
 * Remove all bench features with a given area_id from the IDB cache.
 * Returns the array of feature IDs that were removed so callers can clean
 * up the in-memory registry and layer groups.
 * @param {string} areaId
 * @returns {Promise<string[]>}
 */
export async function removeBenchesByAreaId(areaId) {
  let db
  try { db = await _openDB() } catch { return [] }
  const cached = await _readFromIDB(db)
  if (!cached) return []
  const kept = []
  const ids  = []
  for (const f of cached.features) {
    if (f.properties.area_id === areaId) ids.push(f.properties.id)
    else kept.push(f)
  }
  if (ids.length) await _writeToIDB(db, kept, { generated_at: cached.generated_at })
  return ids
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db     = e.target.result
      const oldVer = e.oldVersion
      if (oldVer < 1) db.createObjectStore(STORE_NAME)
      if (oldVer < 2) db.createObjectStore(AREAS_STORE, { keyPath: 'id' })
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
