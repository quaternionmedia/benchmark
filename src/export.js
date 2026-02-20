/**
 * src/export.js
 * Export the currently-filtered bench data as GeoJSON, CSV, or YAML.
 *
 * Depends on #export-toggle and #export-panel being present in the DOM.
 * initExport() must be called after the marker registry is available.
 */

import { animateFilterPanelIn, animateFilterPanelOut } from './animations.js'

let _registry    = null
let _getPredicate = null

/**
 * Initialise the export panel.
 * @param {Map} registry     - Marker registry returned by renderMarkers
 * @param {Function} getPredicate - Returns the current combined filter+search predicate
 */
export function initExport(registry, getPredicate) {
  _registry     = registry
  _getPredicate = getPredicate
}

// ─── Panel toggle ─────────────────────────────────────────────────────────────

const exportBtn     = document.getElementById('export-toggle')
const exportPanelEl = document.getElementById('export-panel')
let   panelOpen     = false

exportBtn.addEventListener('click', () => {
  if (panelOpen) {
    animateFilterPanelOut(exportPanelEl)
    exportBtn.setAttribute('aria-expanded', 'false')
    panelOpen = false
  } else {
    animateFilterPanelIn(exportPanelEl)
    exportBtn.setAttribute('aria-expanded', 'true')
    panelOpen = true
  }
})

// ─── Download buttons ─────────────────────────────────────────────────────────

document.getElementById('export-geojson').addEventListener('click', () => {
  downloadFile(buildGeoJSON(), 'benches.geojson', 'application/geo+json')
})

document.getElementById('export-csv').addEventListener('click', () => {
  downloadFile(buildCSV(), 'benches.csv', 'text/csv')
})

document.getElementById('export-yaml').addEventListener('click', () => {
  downloadFile(buildYAML(), 'benches.yaml', 'text/yaml')
})

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getFilteredBenches() {
  const predicate = _getPredicate()
  const result    = []
  for (const { props, marker } of _registry.values()) {
    if (predicate(props)) {
      const { lat, lng } = marker.getLatLng()
      result.push({ ...props, lat, lng })
    }
  }
  return result
}

function buildGeoJSON() {
  const benches  = getFilteredBenches()
  const features = benches.map(({ lat, lng, ...props }) => ({
    type: 'Feature',
    geometry:   { type: 'Point', coordinates: [lng, lat] },
    properties: props
  }))
  return JSON.stringify({
    type: 'FeatureCollection',
    metadata: { exported_at: new Date().toISOString(), total_benches: features.length },
    features
  }, null, 2)
}

const CSV_FIELDS = [
  'id', 'name', 'region', 'lat', 'lng',
  'material', 'condition', 'seats',
  'backrest', 'armrests', 'accessible', 'covered',
  'notes', 'added_by', 'added_at'
]

function buildCSV() {
  const benches = getFilteredBenches()
  if (!benches.length) return ''
  const rows = [CSV_FIELDS.join(',')]
  for (const b of benches) {
    rows.push(CSV_FIELDS.map(k => {
      const s = String(b[k] ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(','))
  }
  return rows.join('\n')
}

function buildYAML() {
  const benches  = getFilteredBenches()
  const byRegion = {}
  for (const b of benches) {
    if (!byRegion[b.region]) byRegion[b.region] = []
    byRegion[b.region].push(b)
  }

  const lines = []
  for (const [region, items] of Object.entries(byRegion)) {
    lines.push(`region:`)
    lines.push(`  name: "${region}"`)
    lines.push(``)
    lines.push(`benches:`)
    for (const b of items) {
      lines.push(`  - id: ${b.id}`)
      lines.push(`    name: "${b.name}"`)
      lines.push(`    lat: ${b.lat}`)
      lines.push(`    lng: ${b.lng}`)
      lines.push(`    material: ${b.material}`)
      lines.push(`    backrest: ${b.backrest}`)
      lines.push(`    armrests: ${b.armrests}`)
      lines.push(`    accessible: ${b.accessible === null ? 'null' : b.accessible}`)
      lines.push(`    condition: ${b.condition}`)
      lines.push(`    seats: ${b.seats}`)
      lines.push(`    covered: ${b.covered}`)
      lines.push(`    added_by: ${b.added_by}`)
      lines.push(`    added_at: "${b.added_at}"`)
      if (b.notes)     lines.push(`    notes: "${b.notes}"`)
      if (b.image_url) lines.push(`    image_url: ${b.image_url}`)
      lines.push(``)
    }
    lines.push(`---`)
    lines.push(``)
  }
  return lines.join('\n')
}

// ─── Download ─────────────────────────────────────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
