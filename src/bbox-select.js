/**
 * src/bbox-select.js
 * Drag-to-draw bounding box selector — lets the user draw a rectangle on the
 * map and import OSM bench data for that area directly into browser storage.
 *
 * Flow:
 *   1. "import area" button → enter draw mode (crosshair cursor)
 *   2. mousedown → drag → mouseup  → L.Rectangle tracks the selection
 *   3. Confirmation panel shows bbox coords + region name input
 *   4. "import to map" → Overpass query → mergeFeatures (IndexedDB) → live re-render
 *   5. "cancel" or Escape → cleanup, exit draw mode
 *
 * Imported benches are stored in IndexedDB via store.mergeFeatures() and never
 * written to YAML files — keeping the git repo free of generated data.
 */

import L from 'leaflet'
import { mergeFeatures } from './store.js'
import {
  animateBboxPanelIn,
  animateBboxPanelOut
} from './animations.js'

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

// ─── Module state ─────────────────────────────────────────────────────────────

let _map        = null
let _drawMode   = false
let _dragging   = false
let _startLL    = null
let _rect       = null
let _bboxBounds = null   // [S, W, N, E] floats

const _panel  = document.getElementById('bbox-panel')
const _toggle = document.getElementById('import-toggle')
const _coords = document.getElementById('bbox-coords-display')
const _input  = document.getElementById('bbox-region-name')
const _confirm = document.getElementById('bbox-confirm')
const _cancel  = document.getElementById('bbox-cancel')

// ─── Draw mode helpers ────────────────────────────────────────────────────────

function _enterDrawMode() {
  _drawMode = true
  _toggle.setAttribute('aria-pressed', 'true')
  _toggle.classList.add('active')
  _map.getContainer().classList.add('draw-mode')
  // Prevent map panning while drawing
  _map.dragging.disable()
  _map.getContainer().style.userSelect = 'none'
}

function _exitDrawMode() {
  _drawMode  = false
  _dragging  = false
  _toggle.setAttribute('aria-pressed', 'false')
  _toggle.classList.remove('active')
  _map.getContainer().classList.remove('draw-mode')
  _map.dragging.enable()
  _map.getContainer().style.userSelect = ''
}

function _removeRect() {
  if (_rect) {
    _rect.remove()
    _rect = null
  }
  _bboxBounds = null
}

function _cleanup(andClosePanel = true) {
  _removeRect()
  _exitDrawMode()
  if (andClosePanel && _panel && !_panel.classList.contains('hidden')) {
    animateBboxPanelOut(_panel)
  }
  _input.value = ''
  _confirm.disabled = false
  _confirm.textContent = 'import to map'
}

// ─── Mouse event handlers ─────────────────────────────────────────────────────

function _onMouseDown(e) {
  if (!_drawMode) return
  // Only respond to left-button
  if (e.button !== undefined && e.button !== 0) return
  e.preventDefault()

  _dragging = true
  _removeRect()
  _startLL  = _map.mouseEventToLatLng(e)
}

function _onMouseMove(e) {
  if (!_drawMode || !_dragging || !_startLL) return
  const currentLL = _map.mouseEventToLatLng(e)
  const bounds    = L.latLngBounds(_startLL, currentLL)

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

function _onMouseUp(e) {
  if (!_drawMode || !_dragging || !_startLL) return
  _dragging = false

  const endLL  = _map.mouseEventToLatLng(e)
  const bounds = L.latLngBounds(_startLL, endLL)

  // Ignore tiny accidental clicks (< 100m span)
  if (bounds.getNorth() === bounds.getSouth() || bounds.getEast() === bounds.getWest()) {
    _removeRect()
    return
  }

  const s = Math.min(bounds.getSouth(), bounds.getNorth()).toFixed(5)
  const w = Math.min(bounds.getWest(),  bounds.getEast()).toFixed(5)
  const n = Math.max(bounds.getSouth(), bounds.getNorth()).toFixed(5)
  const ee = Math.max(bounds.getWest(), bounds.getEast()).toFixed(5)

  _bboxBounds = [s, w, n, ee]

  if (_coords) _coords.textContent = `${s}, ${w}, ${n}, ${ee}`

  // Show confirmation panel
  if (_panel) animateBboxPanelIn(_panel)
  if (_input) {
    _input.focus()
    _input.select()
  }
}

// ─── Public init ──────────────────────────────────────────────────────────────

/**
 * @param {L.Map} map
 * @param {Function} onFeaturesImported - Called with the array of new GeoJSON features
 *   after they have been persisted to IndexedDB. Use this to render new markers and
 *   update the visible bench count.
 */
export function initBboxSelect(map, onFeaturesImported) {
  _map = map

  if (!_panel || !_toggle) return   // HTML not present, skip silently

  // Toggle draw mode on button click
  _toggle.addEventListener('click', () => {
    if (_drawMode) {
      _cleanup()
    } else {
      _enterDrawMode()
    }
  })

  // Attach mouse events to the map container element
  const container = map.getContainer()
  container.addEventListener('mousedown', _onMouseDown)
  container.addEventListener('mousemove', _onMouseMove)
  container.addEventListener('mouseup',   _onMouseUp)

  // Escape key cancels draw mode / confirmation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (_drawMode || (_panel && !_panel.classList.contains('hidden')))) {
      _cleanup()
    }
  })

  // Cancel button
  _cancel.addEventListener('click', () => _cleanup())

  // Confirm: query Overpass → merge into IndexedDB → live re-render
  _confirm.addEventListener('click', async () => {
    if (!_bboxBounds) return

    const regionName = (_input.value || 'Imported Region').trim()
    _confirm.disabled    = true
    _confirm.textContent = 'querying…'

    try {
      const nodes = await queryOverpass(_bboxBounds)

      if (!nodes.length) {
        _confirm.textContent = 'no benches found'
        setTimeout(() => {
          _confirm.disabled    = false
          _confirm.textContent = 'import to map'
        }, 2000)
        return
      }

      _confirm.textContent = 'saving…'
      const candidates = nodesToFeatures(nodes, regionName)
      const added      = await mergeFeatures(candidates)

      _cleanup()
      if (added.length && onFeaturesImported) onFeaturesImported(added)
    } catch (err) {
      console.error('[bbox-select] import failed:', err)
      _confirm.textContent = 'failed — retry?'
      setTimeout(() => {
        _confirm.disabled    = false
        _confirm.textContent = 'import to map'
      }, 3000)
    }
  })
}
