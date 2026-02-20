/**
 * src/map.js
 * Leaflet map initialisation and flyTo wrapper.
 */

import L from 'leaflet'

// Expose L as a global so legacy UMD Leaflet plugins (e.g. leaflet.heat) can extend it.
window.L = L

/**
 * Create and return the Leaflet map bound to #map.
 * @returns {L.Map}
 */
export function initMap() {
  const map = L.map('map', {
    center: [20, 0],
    zoom: 3,
    zoomControl: true,
    attributionControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)

  return map
}

/**
 * Fly the map to a bench location, then call onComplete when the animation ends.
 * @param {L.Map} map
 * @param {L.LatLng | [number, number]} latlng
 * @param {Function} onComplete
 */
export function flyToBench(map, latlng, onComplete) {
  map.once('moveend', onComplete)
  map.flyTo(latlng, 17, {
    animate: true,
    duration: 1.2
  })
}
