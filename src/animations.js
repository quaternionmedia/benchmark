/**
 * src/animations.js
 * Centralised anime.js animation contracts for benchmark.
 * All anime.js calls live here — never scattered across modules.
 */

import anime from 'animejs/lib/anime.es.js'

// ─── MARKERS ─────────────────────────────────────────────────────────────────

/**
 * Stagger-animate all bench markers on initial map load.
 * @param {HTMLElement[]} markerEls - Array of marker DOM elements
 */
export function animateMarkersIn(markerEls) {
  anime({
    targets: markerEls,
    opacity: [0, 1],
    scale: [0, 1],
    rotate: [0, -45],           // marker resting state is rotated -45deg
    delay: anime.stagger(18, { from: 'center' }),
    duration: 480,
    easing: 'spring(1, 80, 12, 0)'
  })
}

/**
 * Animate a single marker as "selected" (pulse + scale up).
 * @param {HTMLElement} markerEl
 */
export function animateMarkerSelect(markerEl) {
  anime({
    targets: markerEl,
    scale: [1, 1.4, 1.2],
    duration: 400,
    easing: 'easeOutElastic(1, 0.5)'
  })
}

/**
 * Animate filtered-out markers to fade and shrink.
 * @param {HTMLElement[]} markerEls - Markers to hide
 */
export function animateMarkersOut(markerEls) {
  if (!markerEls.length) return
  anime({
    targets: markerEls,
    opacity: [null, 0],
    scale: [null, 0.4],
    delay: anime.stagger(8),
    duration: 280,
    easing: 'easeInQuad'
  })
}

/**
 * Animate filtered-in markers back into view.
 * @param {HTMLElement[]} markerEls - Markers to show
 */
export function animateMarkersVisible(markerEls) {
  if (!markerEls.length) return
  anime({
    targets: markerEls,
    opacity: [null, 1],
    scale: [null, 1],
    delay: anime.stagger(12),
    duration: 340,
    easing: 'easeOutBack'
  })
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

/**
 * Slide sidebar in from the right.
 * @param {HTMLElement} sidebarEl
 * @param {Function} onComplete - Called when animation finishes
 */
export function animateSidebarIn(sidebarEl, onComplete) {
  sidebarEl.classList.remove('hidden')
  anime({
    targets: sidebarEl,
    translateX: ['100%', '0%'],
    opacity: [0.6, 1],
    duration: 380,
    easing: 'cubicBezier(0.16, 1, 0.3, 1)',
    complete: onComplete
  })
}

/**
 * Slide sidebar out to the right.
 * @param {HTMLElement} sidebarEl
 * @param {Function} onComplete - Called when animation finishes
 */
export function animateSidebarOut(sidebarEl, onComplete) {
  anime({
    targets: sidebarEl,
    translateX: ['0%', '100%'],
    opacity: [1, 0.4],
    duration: 280,
    easing: 'cubicBezier(0.7, 0, 0.84, 0)',
    complete: () => {
      sidebarEl.classList.add('hidden')
      if (onComplete) onComplete()
    }
  })
}

/**
 * Fade+slide sidebar content when switching between benches.
 * @param {HTMLElement} contentEl
 * @param {Function} swapFn - Called mid-animation to update content
 */
export function animateSidebarContentSwap(contentEl, swapFn) {
  anime({
    targets: contentEl,
    opacity: [1, 0],
    translateY: [0, -6],
    duration: 140,
    easing: 'easeInQuad',
    complete: () => {
      swapFn()
      anime({
        targets: contentEl,
        opacity: [0, 1],
        translateY: [6, 0],
        duration: 200,
        easing: 'easeOutQuad'
      })
    }
  })
}

// ─── FILTER PANEL ────────────────────────────────────────────────────────────

/**
 * Reveal the filter panel with a fade + slide-down.
 * @param {HTMLElement} panelEl
 */
export function animateFilterPanelIn(panelEl) {
  panelEl.classList.remove('hidden')
  anime({
    targets: panelEl,
    opacity: [0, 1],
    translateY: [-10, 0],
    duration: 260,
    easing: 'cubicBezier(0.16, 1, 0.3, 1)'
  })
}

/**
 * Hide the filter panel with fade + slide-up.
 * @param {HTMLElement} panelEl
 */
export function animateFilterPanelOut(panelEl) {
  anime({
    targets: panelEl,
    opacity: [1, 0],
    translateY: [0, -8],
    duration: 180,
    easing: 'cubicBezier(0.7, 0, 0.84, 0)',
    complete: () => panelEl.classList.add('hidden')
  })
}

// ─── BBOX IMPORT PANEL ───────────────────────────────────────────────────────

/**
 * Reveal the bbox import panel with a fade + slide-down.
 * @param {HTMLElement} panelEl
 */
export function animateBboxPanelIn(panelEl) {
  panelEl.classList.remove('hidden')
  anime({
    targets: panelEl,
    opacity: [0, 1],
    translateY: [-10, 0],
    duration: 260,
    easing: 'cubicBezier(0.16, 1, 0.3, 1)'
  })
}

/**
 * Hide the bbox import panel with fade + slide-up.
 * @param {HTMLElement} panelEl
 * @param {Function} [onComplete]
 */
export function animateBboxPanelOut(panelEl, onComplete) {
  anime({
    targets: panelEl,
    opacity: [1, 0],
    translateY: [0, -8],
    duration: 180,
    easing: 'cubicBezier(0.7, 0, 0.84, 0)',
    complete: () => {
      panelEl.classList.add('hidden')
      if (onComplete) onComplete()
    }
  })
}

// ─── BENCH COUNT ─────────────────────────────────────────────────────────────

/**
 * Animate the bench count number rolling up from 0.
 * @param {HTMLElement} el - The count display element
 * @param {number} target - Final count value
 */
export function animateBenchCount(el, target) {
  anime({
    targets: { count: 0 },
    count: target,
    round: 1,
    duration: 900,
    delay: 400,
    easing: 'easeOutExpo',
    update(anim) {
      const val = Math.round(anim.animations[0].currentValue)
      el.textContent = `— ${val} bench${val !== 1 ? 'es' : ''}`
    }
  })
}

// ─── MAP FLY-TO COMPANION ────────────────────────────────────────────────────

/**
 * Visual "zoom flash" overlay that plays alongside Leaflet's flyTo.
 * Creates a brief ripple on the map canvas to cue the transition.
 * @param {HTMLElement} mapEl - The #map container
 */
export function animateMapFlyTo(mapEl) {
  const ripple = document.createElement('div')
  Object.assign(ripple.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '2px solid rgba(200, 75, 47, 0.6)',
    transform: 'translate(-50%, -50%) scale(0)',
    pointerEvents: 'none',
    zIndex: '500'
  })
  mapEl.style.position = 'relative'
  mapEl.appendChild(ripple)

  anime({
    targets: ripple,
    scale: [0, 8],
    opacity: [0.8, 0],
    duration: 600,
    easing: 'easeOutQuad',
    complete: () => ripple.remove()
  })
}
