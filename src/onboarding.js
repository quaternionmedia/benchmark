/**
 * src/onboarding.js
 * Progressive first-run tutorial that gets out of the way quickly.
 *
 * Run 1 — Full tooltip explaining the toolbar (auto-dismisses after 8 s or on any tap).
 * Run 2 — One-line reminder only, auto-dismisses after 3 s.
 * Run 3+ — A small accent ping dot on the import button for 4 s, then nothing ever again.
 *
 * State is stored in localStorage under 'benchmark_onboarding_runs'.
 * The tutorial demonstrates the app *in-app* (no modal, no video) — it simply
 * highlights the toolbar and explains the three gestures with text.
 */

const STORAGE_KEY = 'benchmark_onboarding_runs'

function _getRuns() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
}

function _bumpRuns() {
  localStorage.setItem(STORAGE_KEY, String(_getRuns() + 1))
}

// ─── Tip element helpers ───────────────────────────────────────────────────────

function _makeTip(html, closeLabel) {
  const el = document.createElement('div')
  el.className  = 'onboarding-tip'
  el.role       = 'status'
  el.innerHTML  = html

  const closeBtn = document.createElement('button')
  closeBtn.className   = 'onboarding-tip-close'
  closeBtn.textContent = closeLabel
  el.appendChild(closeBtn)

  document.body.appendChild(el)
  return { el, closeBtn }
}

function _showTip(el, durationMs, onDone) {
  // Tick to allow display:none → opacity transition
  requestAnimationFrame(() => el.classList.add('visible'))

  const dismiss = () => {
    el.classList.remove('visible')
    setTimeout(() => { el.remove(); onDone?.() }, 350)
  }

  const timer = setTimeout(dismiss, durationMs)

  el.querySelector('.onboarding-tip-close').addEventListener('click', () => {
    clearTimeout(timer)
    dismiss()
  })

  // Also dismiss on any map interaction
  document.getElementById('map')?.addEventListener('pointerdown', () => {
    clearTimeout(timer)
    dismiss()
  }, { once: true })
}

// ─── Ping dot ─────────────────────────────────────────────────────────────────

function _showPing(targetId, durationMs) {
  const btn = document.getElementById(targetId)
  if (!btn) return

  // Make the button a positioning context for the dot
  const prev = btn.style.position
  btn.style.position = 'relative'

  const dot = document.createElement('span')
  dot.className = 'toolbar-ping'
  dot.setAttribute('aria-hidden', 'true')
  btn.appendChild(dot)

  setTimeout(() => {
    dot.remove()
    btn.style.position = prev
  }, durationMs)
}

// ─── Public init ──────────────────────────────────────────────────────────────

/**
 * Call once after the map and toolbar are ready.
 * Idempotent — safe to call on every page load; it self-limits based on run count.
 */
export function initOnboarding() {
  const runs = _getRuns()
  _bumpRuns()

  if (runs === 0) {
    // Full tooltip — explains the three actions
    const { el } = _makeTip(
      `<strong>welcome to benchmark</strong><br>` +
      `tap a bench marker to see its details.<br>` +
      `use <em>import</em> to draw a shape and fetch nearby benches.<br>` +
      `use <em>filter</em>, <em>search</em>, and <em>export</em> to explore.`,
      'got it'
    )
    _showTip(el, 8000)
    return
  }

  if (runs === 1) {
    // Minimal one-liner
    const { el } = _makeTip(
      `tap <em>import</em> → drag a circle on the map to fetch benches.`,
      '×'
    )
    _showTip(el, 3000)
    return
  }

  if (runs === 2) {
    // Subtle ping on the import button — nothing after this
    _showPing('import-toggle', 4000)
  }
  // runs >= 3: silent
}
