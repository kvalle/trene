# Active workout density prototype review

Status: direction approved on 2026-09-13. This is throwaway prototype code for #219 and does not read or write production data.

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

## Approved direction

Variant A, inline expansion, is approved as the design source for production planning. The approval applies to the interaction and information hierarchy below, not to the throwaway HTML, CSS, or placeholder SVG paths.

- Keep independently expandable exercise cards. Their summary reads “4 av 7 gjennomført”.
- Show every set as a compact resting row with its number in a circle, load and repetitions, and explicit `Planlagt` or `Gjennomført` status.
- Distinguish status through text, circle treatment, and a small status icon. Completed sets use the semantic green treatment; planned sets use a neutral gray treatment.
- Keep set status independent from view/edit mode. Both planned and completed sets can enter edit mode without changing status.
- Reserve two icon-action positions on the right in view mode at normal, large-text, and narrow widths. The secondary edit action is left of the status action. The rightmost status action is a primary check for completing a planned set or a secondary hourglass for returning a completed set to planned.
- Replace the edit action with a secondary collapse action while the inline editor is open. Keep the status action in the rightmost position.
- Expand the editor directly beneath its row on the same surface, without a divider that makes it look like another set. Align its left edge after the set-number column and allow fields to stack at narrow widths.
- Autosave field changes using the existing production durability model. Incomplete drafts may persist, but remain in edit mode and cannot be collapsed or have status changed until both fields are valid.
- Add a set in compact planned view, prefilled from the preceding set. Do not open its editor automatically.
- Keep removal inside edit mode. Use a trash icon with the visible `Fjern sett` label. Keep `Fjern øvelse` as a labelled exercise-level action and use the same trash icon family.
- Do not add workout date, elapsed time, or aggregate workout-level completion metadata as part of this redesign.
- Use the prototype-local monochrome outline SVGs only as placeholders. #226 owns refinement and production catalog adoption of the icon family.

Variant A was preferred because it preserves the strongest spatial connection between a compact set summary and occasional editing while keeping status changes immediately reachable. Variant B was rejected because the shared editor weakens that set-to-editor connection. Variant C was rejected because always-visible fields keep too much form chrome on screen and become crowded at narrow widths and large text.

Remaining production-planning questions belong to #220: identify any compact-row, icon-button, status-badge, or inline-editor design-system work beyond #226, and specify focus, autosave failure, keyboard, and transition behavior using existing production contracts as the baseline.

## Comparative evidence

| Dimension | A: inline expansion | B: shared editor | C: direct inputs |
| --- | --- | --- | --- |
| Useful information visible | Every set rests as a compact row with status and two actions; green/gray numbered circles with status badges separate completed from planned sets. One editor increases only the edited row's height. | Most compact while editing because rows stay unchanged and one editor is reused. | All values and fields are visible, but every planned row is taller than a resting compact row. |
| Scrolling burden | Moderate. The editor moves with the selected row and can push later sets below the fold. | Lowest for a long planned-set list, provided the shared editor remains easy to associate with the selected row. | Moderate to high with many planned sets, though lower than today's full form sections. |
| Editing clarity | Status (`planned`/`completed`) is independent from mode (`view`/`edit`). Changes autosave; incomplete values remain in edit mode until both fields are valid. | Stable editor location and predictable keyboard position. Selection indication must remain strong to avoid editing the wrong set. | No selection step and fast repeated entry. Dense labels and adjacent fields increase scanning demand. |
| Keyboard behavior | The selected row and its editor may be displaced when switching between distant sets. | The editor stays at the bottom of the card, making keyboard-open layout comparatively stable. | Direct fields can sit anywhere in the list; focus may require more scrolling, but switching adjacent fields is immediate. |
| Large-text behavior | Fields stack cleanly, but expanded rows become substantially taller. | Shared fields stack once; compact rows reflow actions onto a second line. | The table loses some density and remove actions reflow; labels remain associated with each field. |
| Error/busy state | Feedback is attached directly to the affected expanded row. | Feedback stays in the shared editor; the selected-row highlight carries context. | Feedback sits below the affected direct-input row and can interrupt table scanning. |
| Apparent design-system gaps to evaluate after approval | A compact selectable/editable data-row pattern and an inline editor transition may be needed. | A selected compact row plus shared-editor composition may need documented semantics. | A dense labelled numeric-field variant or explicit exception may be needed; current `NumericField` is intentionally roomier. |

## Review script

1. Compare all variants first with `Tett økt`, `Ett åpent`, normal text, light mode, and no keyboard.
2. Toggle planned/completed status independently from editing. Edit both statuses, verify that incomplete fields prevent closing or changing status, then verify that a newly added set starts in compact planned view with values copied from the previous set.
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
