/**
 * src/sidebar.js
 * Bench detail sidebar — open, close, content rendering.
 *
 * Accessibility features:
 *  - Focus moves to the close button when the sidebar opens.
 *  - A lightweight Tab-key focus trap (ADR-003) keeps keyboard focus inside
 *    the sidebar while it is open; Shift+Tab wraps to the last focusable element.
 *  - Focus is restored to the element that triggered the open when the sidebar closes.
 *  - Escape key closes the sidebar from anywhere on the page.
 */

import {
  animateSidebarIn,
  animateSidebarOut,
  animateSidebarContentSwap
} from './animations.js'

const sidebarEl = document.getElementById('sidebar')
const contentEl = document.getElementById('sidebar-content')
const closeBtn  = document.getElementById('sidebar-close')

let isOpen      = false
let _opener     = null   // element that triggered open; focus is restored here on close
let _openerId   = null   // data-id of opener if it's a bench marker (for re-lookup after DOM replacement)
let _removeTrap = null   // cleanup fn returned by trapFocus

// ─── Focus trap (ADR-003) ─────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Constrain Tab / Shift+Tab to elements inside `container`.
 * Queries the DOM on each keypress so newly rendered content is always included.
 * Returns a cleanup function that removes the listener.
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function trapFocus(container) {
  function handler(e) {
    if (e.key !== 'Tab') return
    const els = [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    if (!els.length) return
    const first = els[0]
    const last  = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', handler, { capture: true })
  return () => document.removeEventListener('keydown', handler, { capture: true })
}

// ─── Event listeners ─────────────────────────────────────────────────────────

closeBtn.addEventListener('click', closeSidebar)

// Escape key closes the sidebar from anywhere on the page
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen) closeSidebar()
})

// On mobile (≤600 px), close the sidebar when any other panel opens
document.addEventListener('panel-open', (e) => {
  if (e.detail.id !== 'sidebar' && isOpen && window.matchMedia('(max-width: 600px)').matches) {
    closeSidebar()
  }
})

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Open the sidebar with data for a specific bench.
 * If already open, swaps content with a cross-fade animation.
 * Captures document.activeElement so focus can be restored on close.
 *
 * @param {Object} props  - GeoJSON feature properties
 * @param {[number, number]} latlng - [lat, lng]
 */
export function openSidebar(props, latlng) {
  // Capture opener before focus moves — used to restore focus on close.
  // Also store data-id so we can re-find a marker element if Leaflet replaces
  // it during a flyTo zoom animation (DOM element gets detached).
  _opener   = document.activeElement
  _openerId = _opener?.dataset?.id ?? null

  document.dispatchEvent(new CustomEvent('panel-open', { detail: { id: 'sidebar' } }))

  if (isOpen) {
    animateSidebarContentSwap(contentEl, () => renderContent(props, latlng))
  } else {
    renderContent(props, latlng)
    animateSidebarIn(sidebarEl, () => {
      isOpen = true
      closeBtn.focus()
      _removeTrap = trapFocus(sidebarEl)
    })
  }
}

function closeSidebar() {
  if (!isOpen) return
  if (_removeTrap) { _removeTrap(); _removeTrap = null }
  const savedOpener   = _opener
  const savedOpenerId = _openerId
  _opener   = null
  _openerId = null
  animateSidebarOut(sidebarEl, () => {
    isOpen = false
    const el = (savedOpenerId && document.querySelector(`[data-id="${savedOpenerId}"]`))
             || (savedOpener && document.contains(savedOpener) ? savedOpener : null)
    if (el && typeof el.focus === 'function') el.focus()
  })
}

function renderContent(props, latlng) {
  const [lat, lng] = latlng

  const yesNo = (val) => val === true ? 'yes' : val === false ? 'no' : '—'

  const featureTags = [
    { label: 'backrest',   val: props.backrest },
    { label: 'armrests',   val: props.armrests },
    { label: 'accessible', val: props.accessible },
    { label: 'covered',    val: props.covered }
  ]
  .map(({ label, val }) => {
    const active = val === true ? ' active' : ''
    return `<span class="feature-tag${active}">${label}</span>`
  })
  .join('')

  const notesHtml = props.notes
    ? `<p class="bench-notes">${escHtml(props.notes)}</p>`
    : ''

  const imageHtml = props.image_url
    ? `<img src="${escHtml(props.image_url)}" alt="${escHtml(props.name)}" style="width:100%;margin-bottom:18px;display:block;" />`
    : ''

  contentEl.innerHTML = `
    <div class="bench-detail">
      <div class="bench-detail-header">
        <div class="bench-detail-region">${escHtml(props.region)}</div>
        <div class="bench-detail-name">${escHtml(props.name)}</div>
        <div class="bench-detail-id">${escHtml(props.id)}</div>
      </div>

      <div class="bench-condition-badge cond-${props.condition}">
        ● ${props.condition}
      </div>

      ${imageHtml}

      <div class="bench-meta-grid">
        <div class="bench-meta-cell">
          <span class="label">material</span>
          <span class="value">${escHtml(props.material)}</span>
        </div>
        <div class="bench-meta-cell">
          <span class="label">seats</span>
          <span class="value">${props.seats}</span>
        </div>
        <div class="bench-meta-cell">
          <span class="label">backrest</span>
          <span class="value">${yesNo(props.backrest)}</span>
        </div>
        <div class="bench-meta-cell">
          <span class="label">armrests</span>
          <span class="value">${yesNo(props.armrests)}</span>
        </div>
        <div class="bench-meta-cell">
          <span class="label">accessible</span>
          <span class="value">${props.accessible === null ? '—' : yesNo(props.accessible)}</span>
        </div>
        <div class="bench-meta-cell">
          <span class="label">covered</span>
          <span class="value">${yesNo(props.covered)}</span>
        </div>
      </div>

      <div class="bench-features">${featureTags}</div>

      ${notesHtml}

      <div class="bench-directions">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}"
           target="_blank" rel="noopener noreferrer" class="btn-icon directions-link">
          directions ↗
        </a>
        <a href="https://maps.apple.com/?daddr=${lat},${lng}"
           target="_blank" rel="noopener noreferrer" class="btn-icon directions-link">
          apple maps ↗
        </a>
      </div>

      <div class="bench-meta-footer">
        added by @${escHtml(props.added_by)} · ${escHtml(String(props.added_at))}
        <span class="bench-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
      </div>
    </div>
  `
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
