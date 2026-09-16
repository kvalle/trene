# Exercise completion treatment prototype review

Status: variant A selected on 2026-09-16. This is throwaway prototype code and does not read or write production data.

## Question

Which visual treatment makes completed workout exercises easiest to scan without competing with the exercise name, set-count summary, or disclosure control?

## Run

```sh
npm run prototype:exercise-completion
```

Open <http://localhost:4177>. Use the fixed bottom switcher, left/right arrow keys, or a direct URL:

- `?variant=a` - leading status indicator
- `?variant=b` - status indicator near the disclosure control
- `?variant=c` - stronger card-level treatment

All variants use the same completed, partially completed, not-started, and zero-set exercises. Expand cards and toggle any set between planned and completed to evaluate final-set completion and reopening. The controls expose collapsed, mixed, and expanded cards, plus narrow width, light/dark mode, and normal/large text.

## Review script

1. Scan all four exercise headers in each variant before opening a card.
2. Expand `Benkpress`, complete its final set, and confirm the header changes immediately. Reopen a completed set and confirm that it becomes incomplete again.
3. Add a planned set to `Markløft` and confirm that the completed treatment disappears.
4. Expand `Kroppsheving`, add its first planned set, and confirm that zero and one planned set are both incomplete.
5. Repeat each variant with all cards collapsed and expanded.
6. Enable narrow phone and large text together, then repeat in dark mode.
7. Select one treatment based on scanability, clear distinction, and minimal visual competition.

## Selected direction

Variant A, leading status, is selected as the production design source:

- Place a compact circular status indicator before the exercise name and set-count summary in both collapsed and expanded headers.
- Show the existing `check` icon when the exercise has at least one set and all sets are completed. Show the existing `hourglass` icon for partial, not-started, and zero-set exercises.
- Limit semantic completed color to the indicator: use `secondary` fill with `primary` border and icon. Keep the incomplete indicator neutral with `surfaceAlt`, `border`, and `muted`; do not tint the card or header.
- Keep the existing visible set-count summary and add no visible status label.
- Include `fullført` or `ikke fullført` in the disclosure header's accessible name. The decorative indicator itself remains hidden from assistive technology.
- Extend `DisclosureCard` with a general optional leading-header slot, such as `leading?: ReactNode`, and an explicit header accessibility label forwarded to its `Pressable`. Keep both APIs domain-neutral; the active-workout screen owns derivation, indicator composition, and wording.

The production implementation must document and demonstrate the selected shared-component API in the design system and runtime component catalog.

## Known prototype boundaries

- All state is in memory and resets on reload or with `Nullstill sett`.
- Set value editing, persistence, failure states, and production animations are outside this visual decision.
- Icons are prototype-local representations of the existing icon vocabulary.
