/**
 * src/markers.js
 * Custom DOM marker rendering using Leaflet.markercluster.
 *
 * Nearby markers are grouped into count badges at low zoom levels; zooming in
 * expands clusters back to individual markers. Filtering swaps which markers
 * are inside the cluster group rather than using opacity animations, which
 * eliminates the O(n × stagger) performance bottleneck.
 *
 * Single-digit locality: markers are pre-grouped using a pixel-space grid at a
 * reference zoom (GRID_ZOOM). Grid cells with < MIN_CLUSTER markers are routed
 * to a plain L.layerGroup (soloGroup) so they always render as individuals.
 * Cells with >= MIN_CLUSTER markers go into the MarkerClusterGroup which
 * produces zoom-adaptive count badges. This avoids small-cluster badges that
 * leaflet.markercluster would otherwise form for any 2+ nearby markers.
 */

import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster'
import { animateMarkerSelect } from './animations.js'

// ─── Spatial pre-grouping constants ───────────────────────────────────────────

const GRID_ZOOM = 13    // reference zoom for grid projection
const GRID_CELL = 80    // pixels — matches leaflet.markercluster default maxClusterRadius
const MIN_CLUSTER = 10  // cells with fewer markers always render individually

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Create a registry entry (marker + DOM element + props) for a single feature.
 * @param {Object} feature      - GeoJSON feature
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

  // Retrieve the real DOM element after Leaflet inserts it
  // el is set once the marker is added to a layer
  let el = null

  marker.on('add', () => {
    el = marker.getElement()?.querySelector('.bench-marker') ?? null
  })

  // We attach listeners lazily via the marker's native events so they work
  // whether the marker is in a cluster or displayed individually.
  marker.on('click', () => {
    if (el) animateMarkerSelect(el)
    onMarkerClick(props, latlng)
  })

  // Keyboard activation when the individual marker div is focused
  // (only reachable when the marker is not clustered)
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
 * Partition markers into solo (< MIN_CLUSTER per grid cell) and cluster sets
 * using a pixel-space grid projected at GRID_ZOOM.
 *
 * Grid cells that share <= GRID_CELL pixels at GRID_ZOOM are considered local
 * neighbours. This matches the default maxClusterRadius leaflet.markercluster
 * uses, so the partition is consistent with what the library would cluster.
 *
 * @param {L.Map} map
 * @param {L.Marker[]} markers
 * @returns {{ solo: L.Marker[], cluster: L.Marker[] }}
 */
function _preGroup(map, markers) {
  const cells = new Map()
  for (const m of markers) {
    const { x, y } = map.project(m.getLatLng(), GRID_ZOOM)
    const key = `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`
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
 * Route a marker set to the correct layer by local density.
 * Sparse cells (< MIN_CLUSTER) → soloGroup; dense cells → clusterGroup.
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
 * Render all bench features via a MarkerClusterGroup (dense areas) and a plain
 * layerGroup (sparse areas). Returns the registry, cluster group, and solo group.
 *
 * @param {L.Map} map
 * @param {Array} features       - GeoJSON features array
 * @param {Function} onMarkerClick - Called with (properties, latlng) on click
 * @returns {{ registry: Map, clusterGroup: L.MarkerClusterGroup, soloGroup: L.LayerGroup }}
 */
export function renderMarkers(map, features, onMarkerClick) {
  const registry = new Map()

  const clusterGroup = L.markerClusterGroup({
    chunkedLoading:       true,  // process in rAF chunks — keeps UI responsive during bulk add
    disableClusteringAtZoom: 17, // show individual markers at street / block level and closer
    maxClusterRadius(zoom) {
      // Shrink cluster radius at higher zoom so sparse markers de-cluster naturally
      if (zoom >= 15) return 40
      if (zoom >= 13) return 55
      return 70
    },
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
 * Add more markers to the layers (used by the bbox import flow).
 * Markers are staged into the cluster group; the caller must follow up with
 * applyMarkerFilter to re-route them correctly via _preGroup.
 * Returns a partial registry that the caller merges into the main registry.
 *
 * @param {L.MarkerClusterGroup} clusterGroup
 * @param {Array} features
 * @param {Function} onMarkerClick
 * @returns {Map}
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
 * Apply a filter predicate by re-routing matching markers via _preGroup.
 * Dense cells (>= MIN_CLUSTER) go to clusterGroup; sparse cells to soloGroup.
 * Both layers are cleared on every call so state stays consistent.
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
