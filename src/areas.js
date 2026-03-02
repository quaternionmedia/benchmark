/**
 * src/areas.js
 * Area manager panel — lists imported areas with visibility toggle, zoom, rename, delete.
 *
 * Public API:
 *   initAreas(opts) → { getHiddenAreaIds, refreshAreaList }
 *
 * initAreas wires the #areas-toggle button and #areas-panel element.
 * The returned getHiddenAreaIds() is a live getter for the main predicate.
 * The returned refreshAreaList() re-renders the list (call after importing).
 */

import { loadAreas, renameArea, deleteArea, removeBenchesByAreaId } from './store.js'
import { animateFilterPanelIn, animateFilterPanelOut } from './animations.js'

// ─── Minimal HTML escaping to prevent XSS in user-supplied area names ──────────

const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// ─── Module state ─────────────────────────────────────────────────────────────

let _map, _registry, _clusterGroup, _soloGroup, _applyAndUpdateCount, _removeFromGroups

const _hiddenAreaIds = new Set()
let _panelOpen = false
let _panelEl   = null
let _toggleBtn = null

// ─── Public init ──────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {L.Map}                  opts.map
 * @param {Map}                    opts.registry
 * @param {L.MarkerClusterGroup}   opts.clusterGroup
 * @param {L.LayerGroup}           opts.soloGroup
 * @param {Function}               opts.applyAndUpdateCount
 * @param {Function}               opts.removeFromGroups - removeBenchesFromGroups(ids, registry, clusterGroup, soloGroup)
 * @returns {{ getHiddenAreaIds: () => Set, refreshAreaList: () => void }}
 */
export function initAreas({ map, registry, clusterGroup, soloGroup, applyAndUpdateCount, removeFromGroups }) {
  _map                  = map
  _registry             = registry
  _clusterGroup         = clusterGroup
  _soloGroup            = soloGroup
  _applyAndUpdateCount  = applyAndUpdateCount
  _removeFromGroups     = removeFromGroups

  _panelEl   = document.getElementById('areas-panel')
  _toggleBtn = document.getElementById('areas-toggle')

  _toggleBtn.addEventListener('click', () => _panelOpen ? _closePanel() : _openPanel())

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _panelOpen) _closePanel()
  })

  return {
    getHiddenAreaIds: () => _hiddenAreaIds,
    refreshAreaList:  () => { if (_panelOpen) _renderAreaList() }
  }
}

// ─── Panel open / close ───────────────────────────────────────────────────────

function _openPanel() {
  if (_panelOpen) return
  _panelOpen = true
  _toggleBtn.setAttribute('aria-expanded', 'true')
  _renderAreaList()
  animateFilterPanelIn(_panelEl)
}

function _closePanel() {
  if (!_panelOpen) return
  _panelOpen = false
  _toggleBtn.setAttribute('aria-expanded', 'false')
  animateFilterPanelOut(_panelEl)
}

// ─── List rendering ───────────────────────────────────────────────────────────

async function _renderAreaList() {
  const listEl = _panelEl.querySelector('#areas-list')
  listEl.innerHTML = '<p class="areas-loading">loading…</p>'

  const areas = await loadAreas()

  if (!areas.length) {
    listEl.innerHTML = '<p class="areas-empty">no imported areas yet.<br>draw on the map to import.</p>'
    return
  }

  listEl.innerHTML = ''
  for (const area of areas) listEl.appendChild(_buildAreaItem(area))
}

function _buildAreaItem(area) {
  const hidden = _hiddenAreaIds.has(area.id)
  const n      = area.bench_count ?? 0

  const el = document.createElement('div')
  el.className    = 'area-item'
  el.dataset.areaId = area.id
  el.innerHTML = `
    <div class="area-item-main">
      <button type="button" class="area-visibility-btn${hidden ? '' : ' active'}"
              aria-pressed="${hidden ? 'false' : 'true'}"
              title="${hidden ? 'Show' : 'Hide'} benches">
        ${hidden ? '○' : '●'}
      </button>
      <div class="area-item-info">
        <span class="area-item-name">${escHtml(area.name)}</span>
        <span class="area-item-meta">${area.type ?? 'bbox'} · ${n} bench${n !== 1 ? 'es' : ''} · ${area.created_at.slice(0, 10)}</span>
      </div>
    </div>
    <div class="area-item-actions">
      <button type="button" class="btn-icon area-action-btn" data-action="zoom">zoom</button>
      <button type="button" class="btn-icon area-action-btn" data-action="rename">rename</button>
      <button type="button" class="btn-icon area-action-btn" data-action="delete">delete</button>
    </div>`

  el.querySelector('[data-action="zoom"]').addEventListener('click',   () => _zoomToArea(area))
  el.querySelector('[data-action="rename"]').addEventListener('click', () => _renameArea(area))
  el.querySelector('[data-action="delete"]').addEventListener('click', () => _deleteArea(area))
  el.querySelector('.area-visibility-btn').addEventListener('click',   () => _toggleVisibility(area))

  return el
}

// ─── Area operations ──────────────────────────────────────────────────────────

function _zoomToArea(area) {
  const [s, w, n, e] = area.bbox
  _map.fitBounds([[+s, +w], [+n, +e]], { padding: [40, 40] })
}

async function _renameArea(area) {
  const newName = prompt('Rename area:', area.name)
  if (!newName || !newName.trim() || newName.trim() === area.name) return
  await renameArea(area.id, newName.trim())
  _renderAreaList()
}

async function _deleteArea(area) {
  const n = area.bench_count ?? 0
  if (!confirm(`Delete "${area.name}"?\n\n${n} bench${n !== 1 ? 'es' : ''} will be removed from local storage.`)) return

  const removedIds = await removeBenchesByAreaId(area.id)
  _removeFromGroups(removedIds, _registry, _clusterGroup, _soloGroup)
  _hiddenAreaIds.delete(area.id)
  await deleteArea(area.id)
  _applyAndUpdateCount()
  _renderAreaList()
}

function _toggleVisibility(area) {
  if (_hiddenAreaIds.has(area.id)) _hiddenAreaIds.delete(area.id)
  else _hiddenAreaIds.add(area.id)
  _applyAndUpdateCount()
  _renderAreaList()
}
