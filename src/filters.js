/**
 * src/filters.js
 * Filter panel wiring: chip toggles, checkbox state, predicate building.
 */

import { animateFilterPanelIn, animateFilterPanelOut } from './animations.js'

// ─── State ───────────────────────────────────────────────────────────────────

const filterState = {
  condition:  'all',
  material:   'all',
  backrest:   false,
  armrests:   false,
  accessible: false,
  covered:    false
}

// ─── Callbacks ───────────────────────────────────────────────────────────────

const listeners = []

/**
 * Register a callback to be called whenever filters change.
 * @param {Function} cb - Called with a copy of filterState
 */
export function onFilterChange(cb) {
  listeners.push(cb)
}

function notifyListeners() {
  for (const cb of listeners) cb({ ...filterState })
}

// ─── Predicate ───────────────────────────────────────────────────────────────

/**
 * Build a predicate function from the given filter state.
 * @param {Object} state
 * @returns {(props: Object) => boolean}
 */
export function buildPredicate(state) {
  return function (props) {
    if (state.condition !== 'all' && props.condition !== state.condition) return false
    if (state.material  !== 'all' && props.material  !== state.material)  return false
    if (state.backrest   && !props.backrest)   return false
    if (state.armrests   && !props.armrests)   return false
    if (state.accessible && !props.accessible) return false
    if (state.covered    && !props.covered)    return false
    return true
  }
}

// ─── Filter Panel Toggle ─────────────────────────────────────────────────────

const filterToggleBtn = document.getElementById('filter-toggle')
const filterPanelEl   = document.getElementById('filter-panel')

let panelOpen = false

filterToggleBtn.addEventListener('click', () => {
  if (panelOpen) {
    animateFilterPanelOut(filterPanelEl)
    filterToggleBtn.setAttribute('aria-expanded', 'false')
    panelOpen = false
  } else {
    animateFilterPanelIn(filterPanelEl)
    filterToggleBtn.setAttribute('aria-expanded', 'true')
    panelOpen = true
  }
})

// ─── Chip Buttons (condition, material) ──────────────────────────────────────

document.querySelectorAll('.chip[data-filter]').forEach((chip) => {
  chip.addEventListener('click', () => {
    const filterKey = chip.dataset.filter
    const value     = chip.dataset.value

    document.querySelectorAll(`.chip[data-filter="${filterKey}"]`).forEach((c) => {
      c.classList.remove('active')
      c.setAttribute('aria-pressed', 'false')
    })
    chip.classList.add('active')
    chip.setAttribute('aria-pressed', 'true')

    filterState[filterKey] = value
    notifyListeners()
  })
})

// ─── Checkbox Filters (features) ─────────────────────────────────────────────

document.querySelectorAll('input[data-filter]').forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    const filterKey = checkbox.dataset.filter
    filterState[filterKey] = checkbox.checked
    notifyListeners()
  })
})
