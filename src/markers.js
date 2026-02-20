/**
 * src/markers.js
 * Custom DOM marker rendering and filter-driven visibility control.
 */

import L from 'leaflet'
import {
  animateMarkersIn,
  animateMarkerSelect,
  animateMarkersOut,
  animateMarkersVisible
} from './animations.js'

/**
 * Render all bench features as custom DOM markers on the map.
 * Returns a registry Map keyed by bench id.
 *
 * @param {L.Map} map
 * @param {Array} features - GeoJSON features array
 * @param {Function} onMarkerClick - Called with (properties, latlng) on click
 * @returns {Map<string, { marker: L.Marker, el: HTMLElement, props: Object }>}
 */
export function renderMarkers(map, features, onMarkerClick) {
  const registry = new Map()
  const markerEls = []

  for (const feature of features) {
    const { properties: props } = feature
    const [lng, lat] = feature.geometry.coordinates
    const latlng = [lat, lng]

    const htmlStr = `<div class="bench-marker cond-${props.condition}" data-id="${props.id}" role="button" tabindex="0" aria-label="${props.name} — ${props.condition} condition"><div class="bench-marker-inner"></div></div>`

    const icon = L.divIcon({
      html: htmlStr,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    })

    const marker = L.marker(latlng, { icon })
    marker.addTo(map)

    // Retrieve the real DOM element inserted by Leaflet
    const el = marker.getElement().querySelector('.bench-marker')

    el.addEventListener('click', () => {
      animateMarkerSelect(el)
      onMarkerClick(props, latlng)
    })

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        animateMarkerSelect(el)
        onMarkerClick(props, latlng)
      }
    })

    registry.set(props.id, { marker, el, props })
    markerEls.push(el)
  }

  // Stagger markers in after a short delay to allow map tiles to begin loading
  setTimeout(() => animateMarkersIn(markerEls), 200)

  return registry
}

/**
 * Apply a filter predicate to all markers.
 * Matching markers animate in; non-matching markers animate out.
 *
 * @param {Map} registry - Registry returned by renderMarkers
 * @param {Function} predicate - (props) => boolean
 */
export function applyMarkerFilter(registry, predicate) {
  const show = []
  const hide = []

  for (const { el, props } of registry.values()) {
    if (predicate(props)) {
      show.push(el)
    } else {
      hide.push(el)
    }
  }

  animateMarkersOut(hide)
  animateMarkersVisible(show)
}
