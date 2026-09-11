# Active workout density prototype review

Status: ready for comparative review. This is throwaway prototype code for #219 and does not read or write production data.

## Question

Which presentation and editing model provides the best useful information density without making workout recording harder or less understandable?

## Run

```sh
npm run prototype:active-workout
```

Open <http://localhost:4175>. Use the fixed bottom switcher, the left/right arrow keys, or share a direct variant URL:

- `?variant=a` - inline expansion
- `?variant=b` - shared editor
- `?variant=c` - dense direct inputs

The control panel keeps equivalent seed data across variants. It exposes the empty and dense workouts, zero/one/several expanded cards, invalid input, local failure, local busy state, large text, narrow width, light/dark mode, and a simulated numeric keyboard.

## Comparative evidence

| Dimension | A: inline expansion | B: shared editor | C: direct inputs |
| --- | --- | --- | --- |
| Useful information visible | Compact inactive rows; one editor increases only the selected row's height. | Most compact while editing because rows stay unchanged and one editor is reused. | All values and fields are visible, but every planned row is taller than a resting compact row. |
| Scrolling burden | Moderate. The editor moves with the selected row and can push later sets below the fold. | Lowest for a long planned-set list, provided the shared editor remains easy to associate with the selected row. | Moderate to high with many planned sets, though lower than today's full form sections. |
| Editing clarity | Strong spatial connection between the selected summary and its fields. Switching may move content significantly. | Stable editor location and predictable keyboard position. Selection indication must remain strong to avoid editing the wrong set. | No selection step and fast repeated entry. Dense labels and adjacent fields increase scanning demand. |
| Keyboard behavior | The selected row and its editor may be displaced when switching between distant sets. | The editor stays at the bottom of the card, making keyboard-open layout comparatively stable. | Direct fields can sit anywhere in the list; focus may require more scrolling, but switching adjacent fields is immediate. |
| Large-text behavior | Fields stack cleanly, but expanded rows become substantially taller. | Shared fields stack once; compact rows reflow actions onto a second line. | The table loses some density and remove actions reflow; labels remain associated with each field. |
| Error/busy state | Feedback is attached directly to the affected expanded row. | Feedback stays in the shared editor; the selected-row highlight carries context. | Feedback sits below the affected direct-input row and can interrupt table scanning. |
| Apparent design-system gaps to evaluate after approval | A compact selectable/editable data-row pattern and an inline editor transition may be needed. | A selected compact row plus shared-editor composition may need documented semantics. | A dense labelled numeric-field variant or explicit exception may be needed; current `NumericField` is intentionally roomier. |

## Review script

1. Compare all variants first with `Tett økt`, `Ett åpent`, normal text, light mode, and no keyboard.
2. Select each of the three planned sets, edit values, add/remove a set, confirm it, and reopen a completed set.
3. Repeat the selection transition with `Ugyldig`, `Feilet`, and `Lagrer`. Confirm that values remain visible and retry is local.
4. Check `Ingen åpne`, `Ett åpent`, and `Flere åpne`. Expand and collapse individual exercise cards.
5. Enable large text, narrow phone, and the simulated keyboard together. Check clipping, field association, and action reachability.
6. Check both themes, the empty workout, and the finish, cancel, remove-exercise, and add-exercise dialogs.
7. Record a preferred variant, any ideas to combine, rejected alternatives, and remaining uncertainty on #220. Do not treat this prototype code as production architecture.

## Known prototype boundaries

- All mutations are in memory and reset when a control-panel scenario changes or the page reloads.
- The keyboard is a layout fixture, not a functional software keyboard.
- Dialog confirmations close the dialog but do not navigate or mutate persisted data.
- Motion is limited to the phone-width preview and spinner; both are disabled by `prefers-reduced-motion`.
