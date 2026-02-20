/**
 * src/main.js
 * Application entry point — wires all modules together.
 */

import { initMap, flyToBench } from './map.js'
import { renderMarkers, applyMarkerFilter } from './markers.js'
import { openSidebar } from './sidebar.js'
import { onFilterChange, buildPredicate } from './filters.js'
import { animateBenchCount, animateMapFlyTo } from './animations.js'
import { onSearchChange, buildSearchPredicate } from './search.js'
import { initHashSync } from './hash.js'
import { initExport } from './export.js'
import { initHeatmap, toggleHeatmap } from './heatmap.js'

const benchCountEl  = document.getElementById('bench-count')
const mapEl         = document.getElementById('map')
const heatmapToggle = document.getElementById('heatmap-toggle')

// ─── PWA service worker ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/benchmark/sw.js').catch(() => {})
}

async function main() {
  // Initialise map
  const map = initMap()

  // Load compiled GeoJSON
  const res     = await fetch('./data/benches.geojson')
  const geojson = await res.json()
  const { features } = geojson

  // Render markers and get registry
  const registry = renderMarkers(map, features, (props, latlng) => {
    flyToBench(map, latlng, () => {})
    animateMapFlyTo(mapEl)
    openSidebar(props, latlng)
  })

  // Animate bench count on initial load
  animateBenchCount(benchCountEl, features.length)

  // ─── Combined filter + search predicate ──────────────────────────────────────

  let latestFilterState = {
    condition: 'all', material: 'all',
    backrest: false, armrests: false, accessible: false, covered: false
  }
  let latestSearchTerm = ''

  function getCombinedPredicate() {
    const fp = buildPredicate(latestFilterState)
    const sp = buildSearchPredicate(latestSearchTerm)
    return (props) => fp(props) && sp(props)
  }

  function applyAndUpdateCount() {
    const predicate = getCombinedPredicate()
    applyMarkerFilter(registry, predicate)
    const visible = [...registry.values()].filter(({ props }) => predicate(props)).length
    benchCountEl.textContent = `— ${visible} bench${visible !== 1 ? 'es' : ''}`
  }

  onFilterChange((filterState) => {
    latestFilterState = filterState
    applyAndUpdateCount()
  })

  onSearchChange((term) => {
    latestSearchTerm = term
    applyAndUpdateCount()
  })

  // ─── Export panel ─────────────────────────────────────────────────────────────

  initExport(registry, getCombinedPredicate)

  // ─── Heatmap layer ────────────────────────────────────────────────────────────

  initHeatmap(map, features)
  heatmapToggle.addEventListener('click', () => {
    const visible = toggleHeatmap()
    heatmapToggle.setAttribute('aria-pressed', String(visible))
    heatmapToggle.classList.toggle('active', visible)
  })

  // ─── URL hash state ───────────────────────────────────────────────────────────

  const restoredFromHash = initHashSync(map)

  // Fit to all bench bounds only when no saved hash position exists
  if (!restoredFromHash && features.length > 0) {
    const coords = features.map(f => [
      f.geometry.coordinates[1],
      f.geometry.coordinates[0]
    ])
    map.fitBounds(coords, { padding: [40, 40] })
  }
}

main().catch(console.error)
