# Exercise completion treatment prototype review

Status: awaiting explicit selection for #236. This is throwaway prototype code and does not read or write production data.

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

## Decision to record on #236

The ticket remains open until the user explicitly chooses a variant. Record:

- selected indicator and placement
- color scope
- accessible completed/incomplete behavior
- smallest expected `DisclosureCard` API extension

Do not infer a production API from this prototype. The current alternatives intentionally test presentation before changing the shared component.

## Known prototype boundaries

- All state is in memory and resets on reload or with `Nullstill sett`.
- Set value editing, persistence, failure states, and production animations are outside this visual decision.
- Icons are prototype-local representations of the existing icon vocabulary.
