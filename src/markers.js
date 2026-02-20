/**
 * src/markers.js
 * Custom DOM marker rendering using Leaflet.markercluster.
 *
 * Nearby markers are grouped into count badges at low zoom levels; zooming in
 * expands clusters back to individual markers. Filtering swaps which markers
 * are inside the cluster group rather than using opacity animations, which
 * eliminates the O(n × stagger) performance bottleneck.
 */

import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster'
import { animateMarkerSelect } from './animations.js'

// ─── Private helper ───────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render all bench features via a MarkerClusterGroup.
 * Returns both the registry (for filtering/export) and the cluster group
 * (for layer manipulation).
 *
 * @param {L.Map} map
 * @param {Array} features       - GeoJSON features array
 * @param {Function} onMarkerClick - Called with (properties, latlng) on click
 * @returns {{ registry: Map, clusterGroup: L.MarkerClusterGroup }}
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
      const sz = n < 10 ? 'sm' : n < 100 ? 'md' : 'lg'
      return L.divIcon({
        html:      `<div class="bench-cluster bench-cluster-${sz}">${n}</div>`,
        className: '',
        iconSize:   L.point(36, 36),
        iconAnchor: L.point(18, 18)
      })
    }
  })

  const allMarkers = []
  for (const feature of features) {
    const entry = _buildEntry(feature, onMarkerClick)
    registry.set(entry.props.id, entry)
    allMarkers.push(entry.marker)
  }

  // Batch add — O(n log n) vs O(n²) for individual addLayer calls
  clusterGroup.addLayers(allMarkers)
  map.addLayer(clusterGroup)

  return { registry, clusterGroup }
}

/**
 * Add more markers to an existing cluster group (used by the bbox import flow).
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
 * Apply a filter predicate by swapping which markers are inside the cluster group.
 * Matching markers are re-added; non-matching are removed.
 * This replaces the previous opacity-animation approach, eliminating the
 * O(n × stagger_delay) performance bottleneck.
 *
 * @param {Map} registry
 * @param {L.MarkerClusterGroup} clusterGroup
 * @param {Function} predicate - (props) => boolean
 */
export function applyMarkerFilter(registry, clusterGroup, predicate) {
  const visible = []
  for (const { marker, props } of registry.values()) {
    if (predicate(props)) visible.push(marker)
  }
  clusterGroup.clearLayers()
  if (visible.length) clusterGroup.addLayers(visible)
}
