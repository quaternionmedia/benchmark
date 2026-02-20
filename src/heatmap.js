/**
 * src/heatmap.js
 * Leaflet.heat density heatmap — toggleable overlay showing bench concentration.
 *
 * Requires leaflet.heat to have been imported (and L.heatLayer to be available).
 * Gradient mirrors the condition colour palette: green → amber → red.
 */

import L from 'leaflet'
import 'leaflet.heat'

let _heatLayer = null
let _map       = null
let _visible   = false

/**
 * Initialise the heat layer from all bench coordinates.
 * Does not add it to the map — call toggleHeatmap() to show it.
 *
 * @param {L.Map} map
 * @param {Array}  features - GeoJSON features array
 */
export function initHeatmap(map, features) {
  _map = map

  if (typeof L.heatLayer !== 'function') return   // graceful degradation if plugin failed

  const points = features.map(f => [
    f.geometry.coordinates[1],
    f.geometry.coordinates[0],
    1                           // uniform intensity; weight by bench density naturally
  ])

  _heatLayer = L.heatLayer(points, {
    radius:     30,
    blur:       20,
    maxZoom:    16,
    minOpacity: 0.35,
    gradient:   { 0.4: '#3d7a4a', 0.65: '#a07020', 1.0: '#c84b2f' }
  })
}

/**
 * Toggle heatmap visibility on the map.
 * @returns {boolean} The new visibility state
 */
export function toggleHeatmap() {
  if (!_heatLayer) return false

  if (_visible) {
    _map.removeLayer(_heatLayer)
    _visible = false
  } else {
    _heatLayer.addTo(_map)
    _visible = true
  }
  return _visible
}
