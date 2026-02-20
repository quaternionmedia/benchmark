/**
 * src/main.js
 * Application entry point — wires all modules together.
 */

import { initMap, flyToBench } from './map.js'
import { renderMarkers, applyMarkerFilter } from './markers.js'
import { openSidebar } from './sidebar.js'
import { onFilterChange, buildPredicate } from './filters.js'
import { animateBenchCount, animateMapFlyTo } from './animations.js'

const benchCountEl = document.getElementById('bench-count')
const mapEl = document.getElementById('map')

async function main() {
  // Initialise map
  const map = initMap()

  // Load compiled GeoJSON
  const res = await fetch('./data/benches.geojson')
  const geojson = await res.json()
  const { features } = geojson

  // Render markers and get registry
  const registry = renderMarkers(map, features, (props, latlng) => {
    flyToBench(map, latlng, () => {})
    animateMapFlyTo(mapEl)
    openSidebar(props, latlng)
  })

  // Animate bench count
  animateBenchCount(benchCountEl, features.length)

  // Wire filter changes to marker visibility
  onFilterChange((filterState) => {
    const predicate = buildPredicate(filterState)
    applyMarkerFilter(registry, predicate)
  })

  // Fit map to bounds of all benches
  if (features.length > 0) {
    const coords = features.map(f => [
      f.geometry.coordinates[1],
      f.geometry.coordinates[0]
    ])
    map.fitBounds(coords, { padding: [40, 40] })
  }
}

main().catch(console.error)
