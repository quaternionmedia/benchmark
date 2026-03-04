/**
 * src/areas.js
 * Area manager panel — lists imported areas with visibility toggle, zoom, rename, delete.
 * Also renders a subtle Leaflet boundary overlay for each area on the map.
 *
 * Public API:
 *   initAreas(opts) → { getHiddenAreaIds, refreshAreaList }
 */

import L from 'leaflet'
import { loadAreas, renameArea, deleteArea, removeBenchesByAreaId } from './store.js'
import { animateFilterPanelIn, animateFilterPanelOut } from './animations.js'

// ─── Minimal HTML escaping ─────────────────────────────────────────────────────

const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// ─── Overlay style constants ───────────────────────────────────────────────────

const OVERLAY_VISIBLE = { color: '#c84b2f', weight: 1.5, dashArray: '6 4', fillOpacity: 0.05, opacity: 0.40, interactive: false }
const OVERLAY_HIDDEN  = { color: '#c84b2f', weight: 1,   dashArray: '4 6', fillOpacity: 0,    opacity: 0.15, interactive: false }

// ─── Module state ─────────────────────────────────────────────────────────────

let _map, _registry, _clusterGroup, _soloGroup, _applyAndUpdateCount, _removeFromGroups

const _hiddenAreaIds = new Set()
let _panelOpen = false
let _panelEl   = null
let _toggleBtn = null

/** areaId → L.Layer — keyed so we can update style without re-adding */
const _overlays = new Map()

// ─── Overlay helpers ──────────────────────────────────────────────────────────

function _makeLayer(area) {
  if (area.type === 'circle' && area.center && area.radius) {
    return L.circle(area.center, { radius: area.radius, ...OVERLAY_VISIBLE })
  }
  if (area.type === 'polygon' && area.polygon?.length >= 3) {
    return L.polygon(area.polygon, OVERLAY_VISIBLE)
  }
  // rect (default) — use bbox
  const [s, w, n, e] = area.bbox
  return L.rectangle([[+s, +w], [+n, +e]], OVERLAY_VISIBLE)
}

function _ensureOverlay(area) {
  const hidden = _hiddenAreaIds.has(area.id)
  if (_overlays.has(area.id)) {
    // Update style only
    const layer = _overlays.get(area.id)
    layer.setStyle(hidden ? OVERLAY_HIDDEN : OVERLAY_VISIBLE)
    return
  }
  const layer = _makeLayer(area)
  layer.addTo(_map)
  _overlays.set(area.id, layer)
  if (hidden) layer.setStyle(OVERLAY_HIDDEN)
}

function _dropOverlay(areaId) {
  const layer = _overlays.get(areaId)
  if (layer) { layer.remove(); _overlays.delete(areaId) }
}

/** Load all areas from IDB and sync overlays (called on init + after import). */
async function _syncOverlays() {
  const areas = await loadAreas()
  const ids = new Set(areas.map(a => a.id))
  // Remove overlays for deleted areas
  for (const [id] of _overlays) { if (!ids.has(id)) _dropOverlay(id) }
  // Add/update overlays for all current areas
  for (const area of areas) _ensureOverlay(area)
}

// ─── Public init ──────────────────────────────────────────────────────────────

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

  // Draw overlays even before the panel is opened
  _syncOverlays()

  return {
    getHiddenAreaIds: () => _hiddenAreaIds,
    refreshAreaList:  () => {
      if (_panelOpen) _renderAreaList()
      _syncOverlays()
    }
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

  // Sync overlays whenever the list is rendered
  for (const area of areas) _ensureOverlay(area)

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
  _dropOverlay(area.id)
  await deleteArea(area.id)
  _applyAndUpdateCount()
  _renderAreaList()
}

function _toggleVisibility(area) {
  if (_hiddenAreaIds.has(area.id)) _hiddenAreaIds.delete(area.id)
  else _hiddenAreaIds.add(area.id)
  _ensureOverlay(area)   // update overlay opacity to reflect new state
  _applyAndUpdateCount()
  _renderAreaList()
}
