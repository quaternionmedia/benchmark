/**
 * src/gps.js
 * GPS / geolocation features:
 *   1. Jump to current location on the map
 *   2. Fly to the nearest bench from the user's position
 */

import L from 'leaflet'

let _locationMarker = null

/**
 * Haversine great-circle distance in km.
 */
function _haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Place (or move) the location dot marker on the map.
 * @param {L.Map} map
 * @param {L.LatLng | [number, number]} latlng
 */
function _placeLocationDot(map, latlng) {
  if (_locationMarker) _locationMarker.remove()
  _locationMarker = L.marker(latlng, {
    icon: L.divIcon({
      html:      '<div class="gps-dot"></div>',
      className: '',
      iconSize:  [16, 16],
      iconAnchor:[8, 8]
    }),
    zIndexOffset: 1000
  }).addTo(map)
}

/**
 * Wire up the "locate me" and "nearest bench" GPS buttons.
 *
 * @param {L.Map}    map
 * @param {Map}      registry     - bench registry from renderMarkers
 * @param {Function} onBenchFound - called with (props, [lat, lng]) for the nearest bench
 */
export function initGps(map, registry, onBenchFound) {
  const locateBtn  = document.getElementById('gps-locate')
  const nearestBtn = document.getElementById('gps-nearest')

  // ── 1. Jump to current location ──────────────────────────────────────────

  locateBtn.addEventListener('click', () => {
    locateBtn.classList.add('active')
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true })
  })

  map.on('locationfound', (e) => {
    locateBtn.classList.remove('active')
    _placeLocationDot(map, e.latlng)
  })

  map.on('locationerror', () => {
    locateBtn.classList.remove('active')
  })

  // ── 2. Find nearest bench ─────────────────────────────────────────────────

  nearestBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return
    nearestBtn.classList.add('active')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        nearestBtn.classList.remove('active')
        const { latitude, longitude } = pos.coords
        _placeLocationDot(map, [latitude, longitude])

        let nearest = null
        let minDist = Infinity
        for (const entry of registry.values()) {
          const ll = entry.marker.getLatLng()
          const d  = _haversine(latitude, longitude, ll.lat, ll.lng)
          if (d < minDist) { minDist = d; nearest = entry }
        }

        if (nearest) {
          const ll = nearest.marker.getLatLng()
          onBenchFound(nearest.props, [ll.lat, ll.lng])
        }
      },
      () => { nearestBtn.classList.remove('active') }
    )
  })
}
