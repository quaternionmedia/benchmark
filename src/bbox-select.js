/**
 * src/bbox-select.js
 * Draw-to-import tool — lets the user draw shapes on the map and import OSM bench data.
 *
 * Three draw modes:
 *   rect    — drag to draw a bounding box (original behaviour)
 *   polygon — click to add vertices, double-click to close and query
 *   circle  — drag from center to set radius
 *
 * Flow (all modes):
 *   1. Click one of the three mode buttons → enter draw mode (crosshair cursor)
 *   2. Draw shape on map (mode-specific interaction)
 *   3. Shape complete → Overpass query fires → markers appear on completion
 *   4. Button label shows live status; resets after 2.5 s
 *   5. Escape or second button click → cancel and exit draw mode
 *
 * Pointer events (capture phase) are used for cross-device compatibility.
 * stopImmediatePropagation() prevents Leaflet from panning while drawing.
 */

import L from 'leaflet'
import { mergeFeatures, saveArea } from './store.js'
import { animateFilterPanelIn, animateFilterPanelOut } from './animations.js'

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

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const MAX_RETRIES  = 3
const RETRY_DELAY  = 4000
const RETRYABLE    = new Set([429, 500, 503, 504])

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

function _overpassPost(query) {
  return _fetchOverpass(OVERPASS_URL, {
    method:  'POST',
    body:    `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

async function _queryRectOverpass(bbox) {
  const [s, w, n, e] = bbox
  const query = `[out:json][timeout:30];\nnode[amenity=bench](${s},${w},${n},${e});\nout body;`
  const res   = await _overpassPost(query)
  const data  = await res.json()
  return (data.elements || []).filter(e => e.type === 'node')
}

async function _queryPolygonOverpass(polyPoints) {
  const polyStr = polyPoints.map(ll => `${ll.lat.toFixed(6)} ${ll.lng.toFixed(6)}`).join(' ')
  const query   = `[out:json][timeout:30];\nnode[amenity=bench](poly:"${polyStr}");\nout body;`
  const res     = await _overpassPost(query)
  const data    = await res.json()
  return (data.elements || []).filter(e => e.type === 'node')
}

async function _queryCircleOverpass(lat, lng, radiusMeters) {
  const query = `[out:json][timeout:30];\nnode[amenity=bench](around:${radiusMeters},${lat},${lng});\nout body;`
  const res   = await _overpassPost(query)
  const data  = await res.json()
  return (data.elements || []).filter(e => e.type === 'node')
}

// ─── GeoJSON feature builder ──────────────────────────────────────────────────

/**
 * Convert Overpass nodes to GeoJSON features ready for IndexedDB storage.
 * @param {Array}  nodes      - Overpass element objects
 * @param {string} regionName - Human-readable label for display
 * @param {string} [areaId]   - If present, stamped as props.area_id for visibility filtering
 * @returns {Array} GeoJSON Feature objects
 */
function nodesToFeatures(nodes, regionName, areaId) {
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
    if (notes)  props.notes   = notes
    if (areaId) props.area_id = areaId

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
 * No area record is saved (auto-import is ephemeral).
 */
export async function autoImportNearby(lat, lng, regionName, onFeaturesImported, radiusKm = 1) {
  try {
    const bbox  = _bboxFromCenter(lat, lng, radiusKm)
    const nodes = await _queryRectOverpass(bbox)
    if (!nodes.length) return
    const candidates = nodesToFeatures(nodes, regionName)  // no areaId — ephemeral
    const added      = await mergeFeatures(candidates)
    if (added.length && onFeaturesImported) onFeaturesImported(added)
  } catch (err) {
    console.warn('[auto-import] failed:', err)
  }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _map                = null
let _drawMode           = false
let _drawType           = 'rect'   // 'rect' | 'polygon' | 'circle'
let _activeButton       = null     // the button that triggered the current draw
let _onFeaturesImported = null

// Rect state
let _dragging   = false
let _startLL    = null
let _rect       = null
let _bboxBounds = null

// Polygon state
let _polyPoints     = []    // L.LatLng array of placed vertices
let _polyLine       = null  // L.Polyline — committed edges
let _polyRubberBand = null  // L.Polyline — cursor preview to last vertex
let _lastPolyClick  = null  // { x, y, t } for double-click detection

// Circle state
let _circleCenter  = null   // L.LatLng
let _circlePreview = null   // L.Circle

// Button references (resolved at module load; DOM is ready because modules are deferred)
const _buttons = {
  rect:    document.getElementById('import-rect'),
  polygon: document.getElementById('import-poly'),
  circle:  document.getElementById('import-circle')
}

// Import panel toggle
const _importToggleBtn = document.getElementById('import-toggle')
const _importPanelEl   = document.getElementById('import-panel')
let   _importPanelOpen = false

/** Close panel visually only — no draw-mode side-effects (avoids circular calls). */
function _dismissImportPanel() {
  if (!_importPanelOpen) return
  animateFilterPanelOut(_importPanelEl)
  _importToggleBtn.setAttribute('aria-expanded', 'false')
  _importPanelOpen = false
}

/**
 * Open the panel AND immediately enter circle draw mode so the common case
 * (circle import) requires only one tap.  Rect/polygon are available if the
 * user wants to change shape.
 */
function _openImportPanel() {
  animateFilterPanelIn(_importPanelEl)
  _importToggleBtn.setAttribute('aria-expanded', 'true')
  _importPanelOpen = true
  // Auto-activate circle as the default draw mode
  if (_map) _enterDrawMode('circle', _buttons.circle)
}

/** Close panel and cancel any active draw. */
function _closeImportPanel() {
  _dismissImportPanel()
  if (_drawMode) _cleanup()
}

// ─── ID and name helpers ──────────────────────────────────────────────────────

function _generateAreaId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID)
    return 'area_' + crypto.randomUUID().replace(/-/g, '')
  return 'area_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function _autoRegionName(s, w, n, e) {
  const lat = ((parseFloat(s) + parseFloat(n)) / 2).toFixed(2)
  const lng = ((parseFloat(w) + parseFloat(e)) / 2).toFixed(2)
  const ns  = lat >= 0 ? 'N' : 'S'
  const ew  = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat)}°${ns} ${Math.abs(lng)}°${ew}`
}

function _regionNameFromBounds(bounds) {
  const lat = ((bounds.getSouth() + bounds.getNorth()) / 2).toFixed(2)
  const lng = ((bounds.getWest()  + bounds.getEast())  / 2).toFixed(2)
  const ns  = lat >= 0 ? 'N' : 'S'
  const ew  = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat)}°${ns} ${Math.abs(lng)}°${ew}`
}

// ─── Draw mode helpers ────────────────────────────────────────────────────────

function _enterDrawMode(type, btn) {
  _drawType     = type
  _activeButton = btn
  _drawMode     = true
  btn.setAttribute('aria-pressed', 'true')
  btn.classList.add('active')

  const container = _map.getContainer()
  container.classList.add('draw-mode')
  container.style.touchAction = 'none'
  container.style.userSelect  = 'none'

  _map.dragging.disable()
  if (_map.touchZoom) _map.touchZoom.disable()
  if (_map.tap)       _map.tap.disable()
}

function _exitDrawMode() {
  _drawMode = false
  if (_activeButton) {
    _activeButton.setAttribute('aria-pressed', 'false')
    _activeButton.classList.remove('active')
  }
  _dismissImportPanel()   // close panel when draw mode ends for any reason

  const container = _map.getContainer()
  container.classList.remove('draw-mode')
  container.style.touchAction = ''
  container.style.userSelect  = ''

  _map.dragging.enable()
  if (_map.touchZoom) _map.touchZoom.enable()
  if (_map.tap)       _map.tap.enable()
}

function _cleanup() {
  if (_rect)          { _rect.remove();           _rect          = null }
  if (_polyLine)      { _polyLine.remove();        _polyLine      = null }
  if (_polyRubberBand){ _polyRubberBand.remove();  _polyRubberBand = null }
  if (_circlePreview) { _circlePreview.remove();   _circlePreview = null }
  _bboxBounds    = null
  _polyPoints    = []
  _lastPolyClick = null
  _circleCenter  = null
  _dragging      = false
  _startLL       = null
  _exitDrawMode()
}

// ─── Rect draw helpers ────────────────────────────────────────────────────────

function _removeRect() {
  if (_rect) { _rect.remove(); _rect = null }
  _bboxBounds = null
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
  _triggerRectImport()
}

// ─── Pointer event handlers ───────────────────────────────────────────────────
//
// Registered in capture phase so they fire before Leaflet's bubble-phase handlers.
// stopImmediatePropagation() in draw mode prevents Leaflet from panning/zooming.

function _onPointerDown(e) {
  if (!_drawMode || !e.isPrimary) return
  e.preventDefault()
  e.stopImmediatePropagation()
  try { e.target.setPointerCapture(e.pointerId) } catch (_) {}
  _dismissImportPanel()   // clear the panel so the full map is visible while drawing

  const latlng = _map.mouseEventToLatLng(e)

  if (_drawType === 'polygon') {
    const now = Date.now()
    const pos = { x: e.clientX, y: e.clientY }

    // Double-click detection: same spot within 400ms → close polygon
    if (_lastPolyClick &&
        Math.abs(pos.x - _lastPolyClick.x) < 12 &&
        Math.abs(pos.y - _lastPolyClick.y) < 12 &&
        now - _lastPolyClick.t < 400) {
      _lastPolyClick = null
      const points = [..._polyPoints]
      _cleanup()
      if (points.length >= 3) _triggerPolygonImport(points)
      return
    }

    _lastPolyClick = { x: pos.x, y: pos.y, t: now }
    _polyPoints.push(latlng)

    if (_polyLine) {
      _polyLine.setLatLngs(_polyPoints)
    } else {
      _polyLine = L.polyline(_polyPoints, {
        color: 'var(--accent, #c84b2f)', weight: 2, dashArray: '5 4', interactive: false
      }).addTo(_map)
    }
    return
  }

  if (_drawType === 'circle') {
    _dragging     = true
    _circleCenter = latlng
    return
  }

  // rect
  _dragging = true
  _startLL  = latlng
}

function _onPointerMove(e) {
  if (!_drawMode || !e.isPrimary) return
  e.preventDefault()
  e.stopImmediatePropagation()

  const latlng = _map.mouseEventToLatLng(e)

  if (_drawType === 'polygon' && _polyPoints.length > 0) {
    const rubberPath = [_polyPoints[_polyPoints.length - 1], latlng]
    if (_polyRubberBand) {
      _polyRubberBand.setLatLngs(rubberPath)
    } else {
      _polyRubberBand = L.polyline(rubberPath, {
        color: 'var(--accent, #c84b2f)', weight: 2, dashArray: '3 3', opacity: 0.5, interactive: false
      }).addTo(_map)
    }
    return
  }

  if (_drawType === 'circle' && _dragging && _circleCenter) {
    const radius = _circleCenter.distanceTo(latlng)
    if (_circlePreview) {
      _circlePreview.setRadius(radius)
    } else {
      _circlePreview = L.circle(_circleCenter, {
        radius, color: 'var(--accent, #c84b2f)', weight: 2, fillOpacity: 0.08, interactive: false
      }).addTo(_map)
    }
    return
  }

  // rect
  if (_dragging && _startLL) _updateDraw(latlng)
}

function _onPointerUp(e) {
  if (!_drawMode || !e.isPrimary) return
  e.stopImmediatePropagation()
  try { e.target.releasePointerCapture(e.pointerId) } catch (_) {}

  const latlng = _map.mouseEventToLatLng(e)

  if (_drawType === 'polygon') return  // polygon vertices are added on pointerdown

  if (_drawType === 'circle' && _dragging && _circleCenter) {
    _dragging = false
    const center = _circleCenter
    const radius = Math.round(center.distanceTo(latlng))
    _circleCenter = null
    if (_circlePreview) { _circlePreview.remove(); _circlePreview = null }
    if (radius < 50) { _exitDrawMode(); return }   // accidental tap — too small
    _exitDrawMode()
    _triggerCircleImport(center, radius)
    return
  }

  // rect
  if (_dragging && _startLL) _endDraw(latlng)
}

function _onPointerCancel(e) {
  if (!_drawMode || !e.isPrimary) return
  _cleanup()
}

// ─── Import trigger functions ─────────────────────────────────────────────────

async function _triggerRectImport() {
  if (!_bboxBounds) return
  const [s, w, n, ee] = _bboxBounds
  const btn        = _activeButton
  const areaId     = _generateAreaId()
  const regionName = _autoRegionName(s, w, n, ee)

  btn.textContent = 'querying…'
  btn.disabled    = true

  try {
    const nodes = await _queryRectOverpass(_bboxBounds)
    _removeRect()

    if (!nodes.length) {
      btn.textContent = 'no benches found'
      setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
      return
    }

    const candidates = nodesToFeatures(nodes, regionName, areaId)
    const added      = await mergeFeatures(candidates)

    await saveArea({
      id: areaId, name: regionName, type: 'rect',
      bbox: [s, w, n, ee], bench_count: added.length,
      created_at: new Date().toISOString()
    })

    btn.textContent = `+${added.length} added`
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
    if (_onFeaturesImported) _onFeaturesImported(added)
  } catch (err) {
    console.error('[bbox-select] rect import failed:', err)
    _removeRect()
    btn.textContent = 'failed — retry?'
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 3000)
  }
}

async function _triggerPolygonImport(points) {
  const btn        = _activeButton
  const areaId     = _generateAreaId()
  const leafletPoly = L.polygon(points)
  const bounds     = leafletPoly.getBounds()
  const regionName = _regionNameFromBounds(bounds)
  const bbox = [
    bounds.getSouth().toFixed(5), bounds.getWest().toFixed(5),
    bounds.getNorth().toFixed(5), bounds.getEast().toFixed(5)
  ]

  btn.textContent = 'querying…'
  btn.disabled    = true

  try {
    const nodes = await _queryPolygonOverpass(points)

    if (!nodes.length) {
      btn.textContent = 'no benches found'
      setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
      return
    }

    const candidates = nodesToFeatures(nodes, regionName, areaId)
    const added      = await mergeFeatures(candidates)

    await saveArea({
      id: areaId, name: regionName, type: 'polygon',
      bbox, polygon: points.map(ll => [ll.lat, ll.lng]),
      bench_count: added.length, created_at: new Date().toISOString()
    })

    btn.textContent = `+${added.length} added`
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
    if (_onFeaturesImported) _onFeaturesImported(added)
  } catch (err) {
    console.error('[bbox-select] polygon import failed:', err)
    btn.textContent = 'failed — retry?'
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 3000)
  }
}

async function _triggerCircleImport(center, radius) {
  const btn    = _activeButton
  const areaId = _generateAreaId()

  // L.Circle.getBounds() requires a map (pixel projection). Compute geographic
  // bbox directly: radius in meters → degrees of lat/lng.
  const dlat   = radius / 111320
  const dlng   = radius / (111320 * Math.cos(center.lat * Math.PI / 180))
  const bounds = {
    getSouth: () => center.lat - dlat,
    getNorth: () => center.lat + dlat,
    getWest:  () => center.lng - dlng,
    getEast:  () => center.lng + dlng
  }
  const regionName = _regionNameFromBounds(bounds)
  const bbox = [
    (center.lat - dlat).toFixed(5), (center.lng - dlng).toFixed(5),
    (center.lat + dlat).toFixed(5), (center.lng + dlng).toFixed(5)
  ]

  btn.textContent = 'querying…'
  btn.disabled    = true

  try {
    const nodes = await _queryCircleOverpass(center.lat, center.lng, radius)

    if (!nodes.length) {
      btn.textContent = 'no benches found'
      setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
      return
    }

    const candidates = nodesToFeatures(nodes, regionName, areaId)
    const added      = await mergeFeatures(candidates)

    await saveArea({
      id: areaId, name: regionName, type: 'circle',
      bbox, center: [center.lat, center.lng], radius,
      bench_count: added.length, created_at: new Date().toISOString()
    })

    btn.textContent = `+${added.length} added`
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 2500)
    if (_onFeaturesImported) _onFeaturesImported(added)
  } catch (err) {
    console.error('[bbox-select] circle import failed:', err)
    btn.textContent = 'failed — retry?'
    setTimeout(() => { btn.textContent = btn.dataset.label; btn.disabled = false }, 3000)
  }
}

// ─── Public init ──────────────────────────────────────────────────────────────

/**
 * @param {L.Map} map
 * @param {Function} onFeaturesImported - Called with the array of new GeoJSON features
 *   after they have been persisted to IndexedDB.
 */
export function initBboxSelect(map, onFeaturesImported) {
  _map                = map
  _onFeaturesImported = onFeaturesImported

  _importToggleBtn.addEventListener('click', () => {
    if (_importPanelOpen) _closeImportPanel()
    else                  _openImportPanel()
  })

  for (const [mode, btn] of Object.entries(_buttons)) {
    if (!btn) continue
    btn.addEventListener('click', () => {
      const wasSameMode = _drawMode && _activeButton === btn
      if (_drawMode) _cleanup()        // cancel any current draw
      _dismissImportPanel()            // close panel (map needs to be clear)
      if (!wasSameMode) _enterDrawMode(mode, btn)
      // wasSameMode = user clicked the already-active button → cancel only
    })
  }

  const container = map.getContainer()
  container.addEventListener('pointerdown',   _onPointerDown,   { capture: true, passive: false })
  container.addEventListener('pointermove',   _onPointerMove,   { capture: true, passive: false })
  container.addEventListener('pointerup',     _onPointerUp,     { capture: true })
  container.addEventListener('pointercancel', _onPointerCancel, { capture: true })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _drawMode)       _cleanup()
    if (e.key === 'Escape' && _importPanelOpen) _closeImportPanel()
  })
}
