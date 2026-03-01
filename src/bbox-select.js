/**
 * src/bbox-select.js
 * Drag-to-draw bounding box selector — lets the user draw a rectangle on the
 * map and import OSM bench data for that area directly into browser storage.
 *
 * Flow:
 *   1. "import area" button → enter draw mode (crosshair cursor)
 *   2. pointerdown → drag → pointerup → L.Rectangle tracks the selection
 *   3. Draw ends → region name auto-generated from bbox centre → Overpass query fires immediately
 *   4. Button label shows live status; markers appear on completion
 *   5. Escape while drawing → cancel, exit draw mode
 *
 * Pointer events are used instead of separate mouse + touch listeners because:
 *  - Leaflet uses the Pointer Events API internally on modern browsers.
 *  - When Leaflet calls preventDefault() on pointerdown, the browser cancels
 *    any subsequent touchstart events, so raw touch handlers never fire.
 *  - PointerEvent extends MouseEvent and has clientX/clientY, so
 *    map.mouseEventToLatLng() works without any conversion.
 *  - Listeners are attached in capture phase (capture: true) so they fire
 *    before Leaflet's bubble-phase handlers; stopImmediatePropagation() in
 *    draw mode then prevents Leaflet from panning/zooming.
 *
 * Imported benches are stored in IndexedDB via store.mergeFeatures() and never
 * written to YAML files — keeping the git repo free of generated data.
 */

import L from 'leaflet'
import { mergeFeatures } from './store.js'

// ─── OSM tag mappers (mirrors scripts/overpass-import.js) ─────────────────────

function osmMaterial(tags) {
  const m = (tags.material || tags.bench_material || '').toLowerCase()
  if (m.includes('wood') || m.includes('timber'))  return 'wood'
  if (m.includes('metal') || m.includes('iron') || m.includes('steel') || m.includes('alum')) return 'metal'
  if (m.includes('stone') || m.includes('granite') || m.includes('slate')) return 'stone'
  if (m.includes('plastic') || m.includes('fibreglass')) return 'plastic'
  if (m.includes('concrete')) return 'concrete'
  return 'other'
}

function osmCondition(tags) {
  const c = (tags.condition || '').toLowerCase()
  if (c === 'good' || c === 'excellent')                return 'good'
  if (c === 'fair' || c === 'average')                  return 'fair'
  if (c === 'bad'  || c === 'poor' || c === 'broken')   return 'poor'
  return 'unknown'
}

function osmBackrest(tags) {
  if (tags.backrest === 'no')  return false
  if (tags.backrest === 'yes') return true
  return true
}

// ─── Overpass fetch ───────────────────────────────────────────────────────────

const OVERPASS_URL  = 'https://overpass-api.de/api/interpreter'
const MAX_RETRIES   = 3
const RETRY_DELAY   = 4000
const RETRYABLE     = new Set([429, 500, 503, 504])

async function _fetchOverpass(url, options) {
  let delay = RETRY_DELAY
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.ok) return res
    if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) {
      throw new Error(`Overpass API returned ${res.status}: ${res.statusText}`)
    }
    await new Promise(r => setTimeout(r, delay))
    delay *= 2
  }
}

async function queryOverpass(bbox) {
  const [s, w, n, e] = bbox
  const query = `[out:json][timeout:30];\nnode[amenity=bench](${s},${w},${n},${e});\nout body;`
  const res   = await _fetchOverpass(OVERPASS_URL, {
    method:  'POST',
    body:    `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  const data = await res.json()
  return (data.elements || []).filter(e => e.type === 'node')
}

// ─── GeoJSON feature builder ──────────────────────────────────────────────────

/**
 * Convert Overpass nodes to GeoJSON features ready for IndexedDB storage.
 * IDs use the prefix "osm-" + OSM node id to guarantee uniqueness and
 * enable deduplication on subsequent imports of the same area.
 *
 * @param {Array}  nodes      - Overpass element objects
 * @param {string} regionName - Human-readable label for display
 * @returns {Array} GeoJSON Feature objects
 */
function nodesToFeatures(nodes, regionName) {
  const today = new Date().toISOString().slice(0, 10)

  return nodes.map((node, i) => {
    const tags  = node.tags || {}
    const num   = String(i + 1).padStart(3, '0')
    const name  = tags.name || `${regionName} bench ${num}`
    const seats = parseInt(tags.seats) || 2
    const notes = (tags.description || tags.inscription || '').slice(0, 280) || null

    const props = {
      id:         `osm-${node.id}`,
      name,
      material:   osmMaterial(tags),
      backrest:   osmBackrest(tags),
      armrests:   tags.armrest === 'yes',
      accessible: null,
      condition:  osmCondition(tags),
      seats,
      covered:    tags.covered === 'yes',
      added_by:   'overpass-import',
      added_at:   today,
      region:     regionName
    }
    if (notes) props.notes = notes

    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
      properties: props
    }
  })
}

// ─── Public auto-import helper ────────────────────────────────────────────────

/**
 * Build a [S, W, N, E] bbox centred on lat/lng with the given radius in km.
 */
function _bboxFromCenter(lat, lng, radiusKm) {
  const dlat = radiusKm / 111
  const dlng = radiusKm / (111 * Math.cos(lat * Math.PI / 180))
  return [
    (lat - dlat).toFixed(5),
    (lng - dlng).toFixed(5),
    (lat + dlat).toFixed(5),
    (lng + dlng).toFixed(5)
  ]
}

/**
 * Query Overpass for benches within radiusKm of lat/lng, merge into IDB,
 * and call onFeaturesImported with any genuinely new features.
 *
 * @param {number}   lat
 * @param {number}   lng
 * @param {string}   regionName
 * @param {Function} onFeaturesImported
 * @param {number}   [radiusKm=1]
 */
export async function autoImportNearby(lat, lng, regionName, onFeaturesImported, radiusKm = 1) {
  try {
    const bbox  = _bboxFromCenter(lat, lng, radiusKm)
    const nodes = await queryOverpass(bbox)
    if (!nodes.length) return
    const candidates = nodesToFeatures(nodes, regionName)
    const added      = await mergeFeatures(candidates)
    if (added.length && onFeaturesImported) onFeaturesImported(added)
  } catch (err) {
    console.warn('[auto-import] failed:', err)
  }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _map                 = null
let _drawMode            = false
let _dragging            = false
let _startLL             = null
let _rect                = null
let _bboxBounds          = null   // [S, W, N, E] strings
let _onFeaturesImported  = null

const _toggle = document.getElementById('import-toggle')

/**
 * Generate a human-readable region name from the bbox centre coordinates.
 * e.g. "59.33°N 18.07°E"
 */
function _autoRegionName(s, w, n, e) {
  const lat = ((parseFloat(s) + parseFloat(n)) / 2).toFixed(2)
  const lng = ((parseFloat(w) + parseFloat(e)) / 2).toFixed(2)
  const ns  = lat >= 0 ? 'N' : 'S'
  const ew  = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat)}°${ns} ${Math.abs(lng)}°${ew}`
}

function _setToggleLabel(text, resetAfterMs = 0) {
  _toggle.textContent = text
  _toggle.disabled    = resetAfterMs > 0
  if (resetAfterMs) {
    setTimeout(() => {
      _toggle.textContent = 'import area'
      _toggle.disabled    = false
    }, resetAfterMs)
  }
}

// ─── Draw mode helpers ────────────────────────────────────────────────────────

function _enterDrawMode() {
  _drawMode = true
  _toggle.setAttribute('aria-pressed', 'true')
  _toggle.classList.add('active')

  const container = _map.getContainer()
  container.classList.add('draw-mode')
  // touch-action: none tells the browser not to handle pan/zoom gestures,
  // which is more reliable than relying solely on preventDefault().
  container.style.touchAction = 'none'
  container.style.userSelect  = 'none'

  // Disable Leaflet's own interaction handlers as a secondary guard
  _map.dragging.disable()
  if (_map.touchZoom) _map.touchZoom.disable()
  if (_map.tap)       _map.tap.disable()
}

function _exitDrawMode() {
  _drawMode = false
  _dragging = false
  _toggle.setAttribute('aria-pressed', 'false')
  _toggle.classList.remove('active')

  const container = _map.getContainer()
  container.classList.remove('draw-mode')
  container.style.touchAction = ''
  container.style.userSelect  = ''

  _map.dragging.enable()
  if (_map.touchZoom) _map.touchZoom.enable()
  if (_map.tap)       _map.tap.enable()
}

function _removeRect() {
  if (_rect) {
    _rect.remove()
    _rect = null
  }
  _bboxBounds = null
}

function _cleanup() {
  _removeRect()
  _exitDrawMode()
}

// ─── Shared draw logic ────────────────────────────────────────────────────────

function _startDraw(latlng) {
  _dragging = true
  _removeRect()
  _startLL  = latlng
}

function _updateDraw(latlng) {
  const bounds = L.latLngBounds(_startLL, latlng)
  if (_rect) {
    _rect.setBounds(bounds)
  } else {
    _rect = L.rectangle(bounds, {
      color:       'var(--accent, #c84b2f)',
      weight:      2,
      fillOpacity: 0.08,
      dashArray:   '5 4',
      interactive: false
    }).addTo(_map)
  }
}

function _endDraw(latlng) {
  _dragging = false
  const bounds = L.latLngBounds(_startLL, latlng)

  // Ignore tiny accidental taps (degenerate bbox)
  if (bounds.getNorth() === bounds.getSouth() || bounds.getEast() === bounds.getWest()) {
    _removeRect()
    return
  }

  const s  = Math.min(bounds.getSouth(), bounds.getNorth()).toFixed(5)
  const w  = Math.min(bounds.getWest(),  bounds.getEast()).toFixed(5)
  const n  = Math.max(bounds.getSouth(), bounds.getNorth()).toFixed(5)
  const ee = Math.max(bounds.getWest(),  bounds.getEast()).toFixed(5)

  _bboxBounds = [s, w, n, ee]
  _exitDrawMode()
  _triggerImport()
}

async function _triggerImport() {
  if (!_bboxBounds) return
  const [s, w, n, ee] = _bboxBounds
  const regionName = _autoRegionName(s, w, n, ee)

  _setToggleLabel('querying…', 0)
  _toggle.disabled = true

  try {
    const nodes = await queryOverpass(_bboxBounds)
    _removeRect()

    if (!nodes.length) {
      _setToggleLabel('no benches found', 2500)
      return
    }

    const candidates = nodesToFeatures(nodes, regionName)
    const added      = await mergeFeatures(candidates)
    _setToggleLabel(`+${added.length} added`, 2500)
    if (added.length && _onFeaturesImported) _onFeaturesImported(added)
  } catch (err) {
    console.error('[bbox-select] import failed:', err)
    _removeRect()
    _setToggleLabel('failed — retry?', 3000)
  }
}

// ─── Pointer event handlers (mouse + touch, unified) ─────────────────────────
//
// Pointer events are registered in capture phase so they fire before Leaflet's
// bubble-phase handlers. stopImmediatePropagation() in draw mode then prevents
// Leaflet from panning or zooming in response to the same pointer gesture.

function _onPointerDown(e) {
  if (!_drawMode) return
  if (!e.isPrimary) return   // ignore additional fingers in multi-touch

  e.preventDefault()
  e.stopImmediatePropagation()

  // Capture subsequent pointer events on this element even if the pointer
  // moves outside the container boundary mid-drag.
  try { e.target.setPointerCapture(e.pointerId) } catch (_) {}

  _startDraw(_map.mouseEventToLatLng(e))  // PointerEvent has clientX/clientY
}

function _onPointerMove(e) {
  if (!_drawMode || !_dragging || !_startLL) return
  if (!e.isPrimary) return

  e.preventDefault()
  e.stopImmediatePropagation()
  _updateDraw(_map.mouseEventToLatLng(e))
}

function _onPointerUp(e) {
  if (!_drawMode || !_dragging || !_startLL) return
  if (!e.isPrimary) return

  e.stopImmediatePropagation()
  try { e.target.releasePointerCapture(e.pointerId) } catch (_) {}
  _endDraw(_map.mouseEventToLatLng(e))
}

function _onPointerCancel(e) {
  if (!_drawMode || !e.isPrimary) return
  // Gesture was interrupted (system alert, palm rejection, etc.) — clean up
  _dragging = false
  _removeRect()
}

// ─── Public init ──────────────────────────────────────────────────────────────

/**
 * @param {L.Map} map
 * @param {Function} onFeaturesImported - Called with the array of new GeoJSON features
 *   after they have been persisted to IndexedDB. Use this to render new markers and
 *   update the visible bench count.
 */
export function initBboxSelect(map, onFeaturesImported) {
  _map                = map
  _onFeaturesImported = onFeaturesImported

  if (!_toggle) return   // HTML not present, skip silently

  // Toggle draw mode on button click/tap
  _toggle.addEventListener('click', () => {
    if (_drawMode) {
      _cleanup()
    } else {
      _enterDrawMode()
    }
  })

  // Pointer event listeners — capture phase fires before Leaflet's bubble-phase handlers
  const container = map.getContainer()
  container.addEventListener('pointerdown',   _onPointerDown,   { capture: true, passive: false })
  container.addEventListener('pointermove',   _onPointerMove,   { capture: true, passive: false })
  container.addEventListener('pointerup',     _onPointerUp,     { capture: true })
  container.addEventListener('pointercancel', _onPointerCancel, { capture: true })

  // Escape cancels an in-progress draw
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _drawMode) _cleanup()
  })
}
