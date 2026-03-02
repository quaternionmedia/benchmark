# ADR-003: Lightweight focus trap in the bench detail sidebar

**Date:** 2026-03-02
**Status:** Accepted

---

## Context

When the bench detail sidebar opens, keyboard focus moves to the close button (`closeBtn.focus()`). However, continuing to press Tab would cycle focus through the entire page — the Leaflet map controls, the header buttons, the filter chips — all while the sidebar is open over the map. This violates the ARIA Authoring Practices Guide for sidebar drawer patterns and is disorienting for screen reader users who perceive the sidebar as a modal overlay.

The ARIA spec for `role="dialog"` requires that focus be trapped within the dialog while it is open. The benchmark sidebar is not a dialog (`role="complementary"` via `<aside>`) but functions like one on mobile, where it covers the full screen.

Three approaches were considered:

**A. `inert` attribute on the background** — Set `inert` on everything except the sidebar when it opens. Simple and browser-native. Not yet fully supported across all screen readers as of 2025.

**B. Third-party focus-trap library** — e.g., `focus-trap`. Reliable but adds a dependency to a zero-dependency project.

**C. Hand-rolled Tab interceptor in `sidebar.js`** — Listen for `keydown Tab` at the document level; if the sidebar is open, constrain the cycle to focusable elements within `#sidebar`. Remove the listener on close. ~25 lines of code, no dependencies.

---

## Decision

Use **option C**: a hand-rolled focus trap implemented directly in `sidebar.js`.

Rationale:
- benchmark is intentionally dependency-light. Adding a library for 25 lines is not justified.
- The `inert` approach, while elegant, has inconsistent screen reader support.
- The sidebar's focusable elements are predictable: the close button and the two directions links. Querying on each Tab press (not caching) ensures newly-rendered content is always included.

### Implementation

```
// Selector for focusable elements (excludes tabindex="-1" used on #sidebar-content)
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapFocus(container) {
  function handler(e) {
    if (e.key !== 'Tab') return
    const els = [...container.querySelectorAll(FOCUSABLE)]
    if (!els.length) return
    const first = els[0], last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }
  document.addEventListener('keydown', handler, { capture: true })
  return () => document.removeEventListener('keydown', handler, { capture: true })
}
```

The trap is installed after `animateSidebarIn` completes (so the sidebar's DOM is fully visible). It is removed when `closeSidebar` runs.

### Focus restoration

`document.activeElement` is captured at the start of `openSidebar()` (before focus moves to the close button). When the sidebar closes, focus returns to that element. This means:
- Keyboard activation via Enter on a bench marker → focus returns to that marker.
- GPS "nearest bench" button → focus returns to the GPS button.
- Mouse click → focus returns to whatever held focus before (typically body).

---

## Consequences

**Positive:**
- Keyboard users are contained within the sidebar; no accidental activation of map controls behind it.
- Focus restoration means keyboard flow is coherent: user can navigate to a bench, read the sidebar, close it, and continue tabbing from where they were.
- No library dependency added.

**Negative / Trade-offs:**
- The trap is Tab-key only. Screen reader virtual cursor (arrow keys in browse mode) is NOT trapped — users can still arrow-key through background content. This is intentional: trapping the virtual cursor requires `aria-modal="true"` and has complex AT implications. The ARIA APG non-modal dialog pattern (which this follows) only requires Tab trapping.
- If the sidebar content is empty (no directions links rendered yet), Tab cycles only the close button. This is harmless but slightly awkward; it resolves as soon as content renders.
