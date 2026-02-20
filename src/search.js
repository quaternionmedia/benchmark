/**
 * src/search.js
 * Full-text search across bench names, notes, and region.
 * Debounced at 200ms; Escape key clears the input.
 */

const listeners = []
let searchTerm = ''

/**
 * Register a callback called whenever the search term changes.
 * @param {Function} cb - Called with the current search string
 */
export function onSearchChange(cb) {
  listeners.push(cb)
}

function notifyListeners() {
  for (const cb of listeners) cb(searchTerm)
}

/**
 * Build a predicate that matches bench name, notes, and region.
 * Returns a pass-all predicate for empty queries.
 * @param {string} query
 * @returns {(props: Object) => boolean}
 */
export function buildSearchPredicate(query) {
  if (!query || !query.trim()) return () => true
  const q = query.toLowerCase().trim()
  return (props) => {
    const name   = (props.name   || '').toLowerCase()
    const notes  = (props.notes  || '').toLowerCase()
    const region = (props.region || '').toLowerCase()
    return name.includes(q) || notes.includes(q) || region.includes(q)
  }
}

// ─── Wire up search input ─────────────────────────────────────────────────────

const searchEl = document.getElementById('search-input')
let debounceTimer = null

searchEl.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    searchTerm = searchEl.value
    notifyListeners()
  }, 200)
})

searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchEl.value = ''
    searchTerm = ''
    notifyListeners()
  }
})
