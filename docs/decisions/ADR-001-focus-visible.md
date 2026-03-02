# ADR-001: `:focus-visible` for keyboard focus rings

**Date:** 2026-03-02
**Status:** Accepted

---

## Context

Before this change, no interactive element in benchmark had a visible keyboard focus indicator. Browsers apply their default blue outline, but the project's CSS set `outline: none` on `.search-input` and relied on hover states that only respond to pointer input. Keyboard users (and switch-access users) navigating the header, filter chips, sidebar close button, and bench markers had no visual cue indicating which element was focused.

Two CSS pseudo-classes are relevant:

- **`:focus`** — fires for every focus event, including mouse clicks. Many designers suppress `:focus` outlines because they appear on click and look "wrong" in polished UIs. Suppressing them entirely removes keyboard navigation cues.
- **`:focus-visible`** — fires only when the browser determines that focus should be visible (keyboard or other non-pointer input). Supported in all modern browsers as of 2022.

---

## Decision

Use **`:focus-visible`** for all visible keyboard focus rings. Keep functional `:focus` rules that affect layout or state (e.g., the search input width expansion) as-is — they aren't focus *indicators*, they're interaction responses.

Specifically:

- `.btn-icon:focus-visible`, `.chip:focus-visible`, `.sidebar-close:focus-visible` → `outline: 2px solid var(--accent); outline-offset: 2px;`
- `.bench-marker:focus-visible` → same ring plus elevated `z-index` so the marker's outline isn't clipped by adjacent markers
- `.check-label:focus-within` → ring on the label container when the child `<input>` is focused (since the input itself is small and styled by `accent-color`)
- `.skip-link:focus` changed to `.skip-link:focus-visible` (the skip link must remain visible on any keyboard Tab, but no pointer user ever needs to see it appear on click)

---

## Consequences

**Positive:**
- Keyboard and switch-access users get a clear, consistent `2px var(--accent)` ring on every focusable element.
- Mouse users see no change — no ring on click.
- The ring colour (var(--accent)) adapts to both dark and light mode automatically.
- Zero JavaScript — pure CSS enhancement.

**Negative / Trade-offs:**
- Some older browser/AT combinations (pre-2022) may not support `:focus-visible`; they fall back to no ring. This is acceptable because those users were already getting no ring.
- The `--accent` colour on certain backgrounds is ~6:1 contrast ratio. Acceptable for WCAG AA; does not reach AAA on all surfaces.
