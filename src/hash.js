/**
 * src/hash.js
 * URL hash state — #lat,lng,zoom — for shareable map positions.
 *
 * Reads on page load; writes on every map moveend via history.replaceState
 * (no history entry spam).
 */

/**
 * Parse the current URL hash into a view state object.
 * Returns null if the hash is absent or structurally invalid.
 * @returns {{ lat: number, lng: number, zoom: number } | null}
 */
export function readHashState() {
  const hash = window.location.hash.slice(1)
  if (!hash) return null

  const parts = hash.split(',').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null

  const [lat, lng, zoom] = parts
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || zoom < 0 || zoom > 22) return null

  return { lat, lng, zoom }
}

/**
 * Write the current map centre and zoom into the URL hash.
 * @param {L.Map} map
 */
export function writeHashState(map) {
  const c = map.getCenter()
  const z = map.getZoom()
  history.replaceState(null, '', `#${c.lat.toFixed(5)},${c.lng.toFixed(5)},${z}`)
}

/**
 * Initialise bidirectional hash sync.
 * Restores view from hash if present, then mirrors every subsequent moveend.
 *
 * @param {L.Map} map
 * @returns {boolean} true if the initial view was set from the hash
 */
export function initHashSync(map) {
  const state = readHashState()
  if (state) {
    map.setView([state.lat, state.lng], state.zoom)
  }
  map.on('moveend', () => writeHashState(map))
  return !!state
}
