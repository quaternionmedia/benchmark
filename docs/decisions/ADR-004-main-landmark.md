# ADR-004: `<main>` landmark wrapping the map and sidebar

**Date:** 2026-03-02
**Status:** Accepted

---

## Context

The benchmark layout has the following landmark structure before this change:

```
<header>     — header landmark ✓
<div role="region" aria-label="Filter benches">     — region ✓
<div role="region" aria-label="Export bench data">  — region ✓
<div role="region" aria-label="Imported areas">     — region ✓
<div id="map" role="application">                   — application ✓
<aside id="sidebar">                                — complementary ✓
```

Two issues:

1. **No `<main>` landmark.** Screen reader users navigating by landmarks (using `d` in NVDA, `m` in VoiceOver, etc.) have no way to jump directly to the primary content. WCAG 2.4.1 requires a mechanism to bypass repeated navigation blocks. The existing skip link (`<a href="#map">`) addresses this for keyboard users, but landmark navigation is the method screen reader users prefer.

2. **Skip link target is `#map`.** `#map` has `role="application"`, which places screen readers in "pass-through" mode where virtual cursor keys are sent directly to the page. Jumping directly into `role="application"` from the skip link gives users no chance to orient themselves in the landmark before being dropped into the Leaflet widget.

---

## Decision

Wrap `#map` and `#sidebar` in `<main id="main-content">`. Update the skip link target from `#map` to `#main-content`.

```html
<!-- Before -->
<div id="map" role="application" ...></div>
<aside id="sidebar" ...></aside>

<!-- After -->
<main id="main-content">
  <div id="map" role="application" ...></div>
  <aside id="sidebar" ...></aside>
</main>
```

The `<main>` element is implicitly `role="main"` — no `role` attribute needed.

The skip link becomes `<a href="#main-content">Skip to map</a>`. Focusing `#main-content` places the user at the landmark entry point; they can then Tab to enter the map or use the sidebar if it is open.

### CSS impact

The CSS grid assigns `grid-row: 2` to the map container. After wrapping in `<main>`:
- `<main id="main-content">` gets `grid-row: 2; position: relative; overflow: hidden;`
- `#map` loses its `grid-row: 2` declaration (it fills `<main>` via `width: 100%; height: 100%`)
- `.sidebar { top: var(--header-h) }` becomes `.sidebar { top: 0 }` — the sidebar is now positioned relative to `<main>` which starts below the header, so `top: 0` correctly aligns it to the top of the content area

The absolutely-positioned filter/export/areas panels remain siblings of `<main>` inside `#app`, so their `top: var(--header-h)` positioning is unchanged.

---

## Consequences

**Positive:**
- Screen reader landmark navigation now reaches the primary content area via a single `m` keystroke.
- Skip link target gives users a clean entry point before entering `role="application"`.
- Semantic HTML improves with no visual layout change.
- `<main>` is a standard HTML5 element — no ARIA role attributes required.

**Negative / Trade-offs:**
- One extra DOM nesting level (performance impact: negligible).
- `.sidebar { top: 0 }` is only correct while the sidebar is a child of `<main>`. If the sidebar is ever moved out of `<main>`, this needs revisiting.
- `<aside>` inside `<main>` is semantically valid (`complementary` landmark may be scoped to `main`). Screen readers that scope landmarks will announce the sidebar as "bench detail, complementary" only when inside the main region, which is the intended behaviour.
