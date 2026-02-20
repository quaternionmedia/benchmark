/**
 * src/sidebar.js
 * Bench detail sidebar — open, close, content rendering.
 */

import {
  animateSidebarIn,
  animateSidebarOut,
  animateSidebarContentSwap
} from './animations.js'

const sidebarEl = document.getElementById('sidebar')
const contentEl = document.getElementById('sidebar-content')
const closeBtn  = document.getElementById('sidebar-close')

let isOpen = false

closeBtn.addEventListener('click', closeSidebar)

// Escape key closes the sidebar from anywhere on the page
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen) closeSidebar()
})

/**
 * Open the sidebar with data for a specific bench.
 * If already open, swaps content with a cross-fade animation.
 *
 * @param {Object} props  - GeoJSON feature properties
 * @param {[number, number]} latlng - [lat, lng]
 */
export function openSidebar(props, latlng) {
  if (isOpen) {
    animateSidebarContentSwap(contentEl, () => renderContent(props, latlng))
  } else {
    renderContent(props, latlng)
    animateSidebarIn(sidebarEl, () => {
      isOpen = true
      closeBtn.focus()   // move keyboard focus into sidebar on open
    })
  }
}

function closeSidebar() {
  if (!isOpen) return
  animateSidebarOut(sidebarEl, () => { isOpen = false })
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
