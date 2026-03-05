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
 * Compute a shifted center so the bench appears in the visible portion of the
 * map when the sidebar/bottom-sheet is open.
 *
 * - Mobile (≤600 px): bottom sheet is 50dvh → shift bench upward by 25% vh
 * - Desktop (>768 px): right sidebar is 340 px → shift bench left by 170 px
 * - Tablet (601–768 px): sidebar is full-width, no useful offset possible
 *
 * @param {L.Map} map
 * @param {L.LatLng | [number, number]} latlng
 * @param {number} zoom
 * @returns {L.LatLng}
 */
function _paddedCenter(map, latlng, zoom) {
  const isMobile = window.matchMedia('(max-width: 600px)').matches
  const isTablet = !isMobile && window.matchMedia('(max-width: 768px)').matches
  if (isTablet) return L.latLng(latlng)

  const pt = map.project(latlng, zoom)
  if (isMobile) {
    // Bottom sheet covers the lower 50dvh — push the centre point DOWN so the
    // bench appears in the middle of the visible upper half of the map.
    pt.y += window.innerHeight * 0.25
  } else {
    // Right sidebar is 340 px — push the centre point RIGHT so the bench
    // appears in the middle of the visible left portion of the map.
    pt.x += 170
  }
  return map.unproject(pt, zoom)
}

/**
 * Fly the map to a bench location (offset for the sidebar panel), then call
 * onComplete when the animation ends.
 * @param {L.Map} map
 * @param {L.LatLng | [number, number]} latlng
 * @param {Function} onComplete
 */
export function flyToBench(map, latlng, onComplete) {
  const ZOOM   = 17
  const center = _paddedCenter(map, latlng, ZOOM)
  map.once('moveend', onComplete)
  map.flyTo(center, ZOOM, { animate: true, duration: 1.2 })
}
