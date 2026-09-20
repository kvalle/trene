# Exercise reordering prototype review

Status: variant C selected and refined on 2026-09-20. This is throwaway prototype code and does not read or write production data.

## Question

Which visual pattern makes both the moving exercise and its prospective insertion position clearest without relying only on color, motion, or haptics?

## Run

```sh
npm run prototype:exercise-reordering
```

Open <http://localhost:4178>. Use the fixed bottom switcher, left/right arrow keys, or a direct URL:

- `?variant=a` - border and textual insertion marker
- `?variant=b` - origin placeholder and lifted copy
- `?variant=c` - card shown directly in its prospective position

Choose `Vis dragtilstand` for a stable comparison. With a mouse, drag the `Benkpress` header directly. On a touch screen, press and hold the header, drag vertically, and release. An ordinary click or tap still expands or collapses the card.

## Review script

1. Show the drag state in each variant and identify the moving exercise and resulting position without using color as the only clue.
2. Move the card upward and downward, then release it.
3. Confirm that starting a drag collapses the expanded card and that it remains collapsed.
4. Compare normal and reduced-motion modes.
5. Repeat in dark mode and with large text.
6. Select the quietest pattern that still makes both identity and destination unambiguous.

## Variant tradeoffs

- Variant A keeps all cards stable and makes both meanings explicit, but adds the largest insertion marker.
- Variant B most closely resembles physical dragging, but duplicates the card during the gesture and is visually busiest.
- Variant C previews the final order most directly, but movement in the list does more of the explanatory work.

## Selected direction

Variant C, prospective placement, is selected as the production design source:

- Move the card directly into its prospective list position as it crosses another card.
- Animate these positional swaps unless reduced motion is enabled.
- Keep the selected card treatment: `secondary` surface, `primary` border, and leading inset accent.
- Replace the exercise status icon with a domain-neutral vertical move icon while dragging. The icon uses paired up/down arrows with the existing rounded, two-point stroke language.
- Replace the normal set-progress summary with italic `Dra for å endre rekkefølge` text at the original position and `Flytt til #X` after crossing into another position, without changing the card height.
- Do not show a separate insertion line or `Slipp for plass X` marker.

## Known prototype boundaries

- The prototype approximates pointer long-press and drag behavior in a browser; production gesture recognition, auto-scroll, cancellation, and native accessibility actions are outside this visual decision.
- All state is in memory and resets on reload.
- Symbols are prototype-local approximations of the existing icon vocabulary.
