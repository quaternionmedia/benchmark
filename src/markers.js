/**
 * src/markers.js
 * Custom DOM marker rendering using Leaflet.markercluster.
 *
 * Dense areas (>= MIN_CLUSTER markers in a proximity cell) are collapsed into
 * count badges; sparse areas always render as individual markers.
 *
 * HOW THE CLUSTER-SIZE GUARANTEE WORKS
 * ─────────────────────────────────────
 * leaflet.markercluster has no built-in minimum-cluster-size option.  Its
 * greedy algorithm can split any group into sub-clusters, so simply routing
 * "large groups" to the cluster layer is insufficient — those sub-clusters
 * can still have single-digit counts.
 *
 * The fix uses a tighter grid: cellSize = maxRadius / √2.  Any two markers
 * inside the same cell are at most cellSize × √2 = maxRadius apart, which is
 * exactly the cluster radius.  The greedy algorithm therefore places all
 * markers from one cell into ONE cluster — no sub-division is possible.
 *
 * Cells with >= MIN_CLUSTER markers → clusterGroup (one badge per cell, ≥ 10).
 * Cells with <  MIN_CLUSTER markers → soloGroup   (plain layerGroup, always
 *                                                   individual icons).
 *
 * Because pixel-space distances change with zoom, routing is re-run on every
 * zoomend event (wired in main.js) so the cell partition stays accurate.
 */

import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster'
import { animateMarkerSelect } from './animations.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_CLUSTER = 10  // minimum markers per cell to produce a badge

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Cluster radius (px) at a given zoom — must match the clusterGroup option.
 * @param {number} zoom
 * @returns {number}
 */
function _maxRadius(zoom) {
  if (zoom >= 15) return 40
  if (zoom >= 13) return 55
  return 70
}

/**
 * Create a registry entry (marker + DOM element + props) for a single feature.
 * @param {Object} feature
 * @param {Function} onMarkerClick - Called with (props, latlng) on click
 * @returns {{ marker: L.Marker, el: HTMLElement, props: Object }}
 */
function _buildEntry(feature, onMarkerClick) {
  const { properties: props } = feature
  const [lng, lat] = feature.geometry.coordinates
  const latlng = [lat, lng]

  const htmlStr = `<div class="bench-marker mat-${props.material} cond-${props.condition}" data-id="${props.id}" role="button" tabindex="0" aria-label="${props.name} — ${props.material}, ${props.condition} condition"><div class="bench-marker-inner"></div></div>`

  const icon = L.divIcon({
    html:      htmlStr,
    className: '',
    iconSize:  [28, 28],
    iconAnchor:[14, 28]
  })

  const marker = L.marker(latlng, { icon })

  let el = null

  marker.on('add', () => {
    el = marker.getElement()?.querySelector('.bench-marker') ?? null
  })

  marker.on('click', () => {
    if (el) animateMarkerSelect(el)
    onMarkerClick(props, latlng)
  })

  marker.on('add', () => {
    const markerEl = marker.getElement()?.querySelector('.bench-marker')
    if (!markerEl) return
    el = markerEl
    markerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        animateMarkerSelect(markerEl)
        onMarkerClick(props, latlng)
      }
    })
  })

  return { marker, get el() { return el }, props }
}

/**
 * Partition markers into solo (sparse) and cluster (dense) sets.
 *
 * Projects markers to pixel space at the map's current zoom, then bins them
 * into a grid with cellSize = maxRadius / √2.  This size guarantees that any
 * two markers within the same cell are pairwise <= maxRadius apart, so
 * leaflet.markercluster's greedy algorithm forms exactly ONE cluster per cell.
 *
 * Cells with < MIN_CLUSTER markers → solo (show as individuals).
 * Cells with >= MIN_CLUSTER markers → cluster (show as count badge).
 *
 * @param {L.Map} map
 * @param {L.Marker[]} markers
 * @returns {{ solo: L.Marker[], cluster: L.Marker[] }}
 */
function _preGroup(map, markers) {
  const zoom     = map.getZoom()
  const cellSize = _maxRadius(zoom) / Math.SQRT2  // max intra-cell distance = maxRadius

  const cells = new Map()
  for (const m of markers) {
    const { x, y } = map.project(m.getLatLng(), zoom)
    const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(m)
  }

  const solo = [], cluster = []
  for (const cell of cells.values()) {
    if (cell.length < MIN_CLUSTER) solo.push(...cell)
    else cluster.push(...cell)
  }
  return { solo, cluster }
}

/**
 * Route markers to the correct layer based on local density at the current zoom.
 * Both groups are cleared on every call so state stays consistent.
 *
 * @param {L.Map} map
 * @param {L.Marker[]} markers
 * @param {L.MarkerClusterGroup} clusterGroup
 * @param {L.LayerGroup} soloGroup
 */
function _route(map, markers, clusterGroup, soloGroup) {
  clusterGroup.clearLayers()
  soloGroup.clearLayers()
  if (!markers.length) return
  const { solo, cluster } = _preGroup(map, markers)
  solo.forEach(m => soloGroup.addLayer(m))
  if (cluster.length) clusterGroup.addLayers(cluster)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render all bench features. Returns the registry, cluster group, and solo group.
 * Callers should also wire: map.on('zoomend', () => applyMarkerFilter(...))
 * so that routing is refreshed when pixel-space distances change with zoom.
 *
 * @param {L.Map} map
 * @param {Array} features
 * @param {Function} onMarkerClick - Called with (properties, latlng) on click
 * @returns {{ registry: Map, clusterGroup: L.MarkerClusterGroup, soloGroup: L.LayerGroup }}
 */
export function renderMarkers(map, features, onMarkerClick) {
  const registry = new Map()

  const clusterGroup = L.markerClusterGroup({
    chunkedLoading:       true,
    disableClusteringAtZoom: 17,
    maxClusterRadius:     _maxRadius,   // same function used by _preGroup
    iconCreateFunction(cluster) {
      const n  = cluster.getChildCount()
      const sz = n < 100 ? 'md' : 'lg'
      return L.divIcon({
        html:      `<div class="bench-cluster bench-cluster-${sz}">${n}</div>`,
        className: '',
        iconSize:   L.point(36, 36),
        iconAnchor: L.point(18, 18)
      })
    }
  })

  const soloGroup = L.layerGroup()

  const allMarkers = []
  for (const feature of features) {
    const entry = _buildEntry(feature, onMarkerClick)
    registry.set(entry.props.id, entry)
    allMarkers.push(entry.marker)
  }

  map.addLayer(clusterGroup)
  map.addLayer(soloGroup)
  _route(map, allMarkers, clusterGroup, soloGroup)

  return { registry, clusterGroup, soloGroup }
}

/**
 * Add more markers to the cluster layer (bbox import flow).
 * The caller must follow up with applyMarkerFilter to re-route correctly.
 *
 * @param {L.MarkerClusterGroup} clusterGroup
 * @param {Array} features
 * @param {Function} onMarkerClick
 * @returns {Map} partial registry to merge into the main registry
 */
export function addMarkersToGroup(clusterGroup, features, onMarkerClick) {
  const partial    = new Map()
  const newMarkers = []

  for (const feature of features) {
    const entry = _buildEntry(feature, onMarkerClick)
    partial.set(entry.props.id, entry)
    newMarkers.push(entry.marker)
  }

  clusterGroup.addLayers(newMarkers)
  return partial
}

/**
 * Apply a filter predicate and re-route markers via _preGroup at current zoom.
 * Call this on filter/search changes AND on map zoomend.
 *
 * @param {L.Map} map
 * @param {Map} registry
 * @param {L.MarkerClusterGroup} clusterGroup
 * @param {L.LayerGroup} soloGroup
 * @param {Function} predicate - (props) => boolean
 */
export function applyMarkerFilter(map, registry, clusterGroup, soloGroup, predicate) {
  const visible = []
  for (const { marker, props } of registry.values()) {
    if (predicate(props)) visible.push(marker)
  }
  _route(map, visible, clusterGroup, soloGroup)
}
