# Trene MVP specification

Status: Implementation-ready

## 1. Product goal

Trene is a mobile app for recording strength-training exercises while working
out. The MVP is primarily for the product owner and secondarily for people who
want a faster, simpler alternative to feature-rich training apps.

The product optimizes for quick one-handed recording, reliable local storage,
and easy access to previous results. It does not require a training program or
advance planning.

## 2. Scope

The MVP supports:

- strength exercises measured as sets of load in kilograms and repetitions;
- one active workout at a time;
- creating and managing a personal exercise list;
- recording, resuming, completing, and cancelling a workout;
- read-only workout and exercise history, with permanent deletion of a whole
  completed workout;
- fully local and offline operation on Android and iOS phones.

The MVP does not include:

- exercises measured only by repetitions, time, or distance;
- accounts, import, export, synchronization, backup, or restore;
- programs, workout planning, predefined exercises, notes, or comments;
- notifications, reminders, rest timers, sound, graphs, records, or calculated
  progress;
- calendars, advanced history filters, alternative exercise sorting, or a
  chronological workout timeline;
- tablet or foldable-window layouts, reordering exercises, or app-controlled
  theme selection;
- Google Play or App Store publication.

## 3. Language and terminology

The user interface uses Norwegian Bokmål (`nb`). Number and date formatting
uses the `nb` locale. Source code and technical identifiers use English.

Canonical domain terms are defined in [`CONTEXT.md`](../CONTEXT.md). In
particular, use `belastning`, not `vekt` or `kilo`, and `repetisjon`, not `rep`.

## 4. Information architecture

### 4.1 Home

With no active workout, Home provides three actions:

- `Start økt`
- `Tidligere økter`
- `Øvelser`

With an active workout, `Fortsett økt` replaces `Start økt`. Home does not show
recent workouts.

### 4.2 Active workout

The active-workout screen contains:

- the exercises in one vertically scrollable list of cards;
- at most one expanded exercise card at a time; the expanded card can be
  collapsed without expanding another;
- a collapsed-card status in the form `x av y sett gjennomført`;
- completed sets grouped above planned sets inside the expanded card;
- completed sets rendered as compact receipt rows;
- `Legg til sett` and `Legg til øvelse` actions;
- `Ferdig` and the secondary destructive action `Avbryt`.

Exercise cards use their durable insertion order. Exercise order groups the
sets and does not claim to represent the order in which exercises were
performed.

### 4.3 Exercise picker and creation

The picker lists exercises alphabetically by their normalized Bokmål sort
order and supports case-insensitive substring search. Exercises already in the
active workout are hidden.

The picker always offers exercise creation. If the exercise list is empty, it
shows an `Opprett første øvelse` empty-state action. A newly created exercise is
selected automatically and opens directly for set recording.

If exercises exist but every one is already in the active workout, the picker
states that all existing exercises have been added and offers creation of a new
exercise. If a search has no matches, the picker shows `Ingen øvelser funnet`
and offers to create an exercise with the search text prefilled. The newly
created exercise is added directly to the active workout.

Exercise creation asks only for a name.

### 4.4 Workout history

`Tidligere økter` lists all completed workouts by completion timestamp
descending, then stable database ID ascending.
Each row shows the completion date and time and the number of exercises saved
in that workout. Only exercises with at least one completed set were saved and
therefore count. The whole row is one primary action that opens workout detail;
there are no inline row actions. There is no calendar, statistics view, or
filtering.

If no workout has been completed, the page explains that completed workouts
will appear here and offers `Start økt`. If an active workout exists, it offers
`Fortsett økt` instead.

A workout detail is read-only and shows:

- its completion date and time;
- its exercises in their saved card order;
- each exercise's completed sets.

It does not show start time, duration, planned sets, or exercises without a
completed set. The detail offers a return to Home and permanent deletion of
the entire workout after explicit confirmation.

### 4.5 Exercise administration and history

`Øvelser` lists all exercises alphabetically and supports case-insensitive
substring search and exercise creation. Each row shows the exercise name and
`Brukt i 1 økt` or `Brukt i N økter`. The count is the number of remaining
completed workouts containing at least one completed set for the exercise; a
deleted workout no longer counts. The whole row is one primary action that
opens exercise detail, with no inline edit, delete, or menu actions.

If the exercise list is empty, the page shows only `Opprett første øvelse`. If
a search has no matches, it shows `Ingen øvelser funnet` and offers to create
an exercise with the search text prefilled.

Selecting an exercise opens one detail screen that shows its current name and
completed-set history. History is grouped by completed workout in the same
deterministic newest-first order,
and each group shows the workout completion date and time plus every set's load
and repetitions. The same screen offers renaming and, when permitted by the
domain rules, deletion.

If the exercise has no remaining completed-workout history, the history area
shows `Ingen fullførte økter med denne øvelsen ennå`. Renaming and eligible
deletion remain available.

Renaming changes the exercise everywhere, including historical workout views.

## 5. Core flows

### 5.1 Start and record a workout

1. The user selects `Start økt`; an empty active workout is created immediately.
2. The user selects `Legg til øvelse` and chooses or creates an exercise.
3. The app creates planned sets from the first remaining completed workout
   containing that exercise under the deterministic history order. If none
   exists, it creates one planned set with empty fields.
4. The user accepts a valid planned set with one explicit confirmation action.
5. The set becomes completed, gets a confirmation timestamp, moves to the
   completed group, and receives its derived display number.
6. The user may switch freely between exercise cards and add exercises or sets.

### 5.2 Add a set

`Legg til sett` creates a new planned set using the first applicable rule:

1. Copy load and repetitions from the most recently confirmed set in that
   exercise in the active workout.
2. Otherwise copy both values from the last planned set if both are valid.
3. Otherwise create empty fields.

It does not query history again. The new set must be confirmed separately.

### 5.3 Correct or remove a set

A completed set cannot be edited or deleted directly. The user first
unconfirms it. This removes its confirmation timestamp and display number,
preserves its values, and returns it to its database-ID position in the
planned-set group. The user may then edit, delete, or reconfirm it.
Reconfirmation assigns a new timestamp and therefore a new completed-set
position.

A planned set is deleted immediately without confirmation or undo.

### 5.4 Remove an exercise from an active workout

An exercise can be removed from the active workout. If it has completed sets,
the user must confirm removal of the card and those sets. Removal does not
delete the exercise or affect completed workouts.

### 5.5 Leave and resume a workout

Back navigation returns to Home without ending the workout or asking for
confirmation. The active workout remains durable and Home offers `Fortsett
økt`. Closing, backgrounding, screen locking, process restart, or reopening the
app must not lose accepted data.

The app follows the phone's normal screen-lock behavior and does not keep the
screen awake.

### 5.6 Complete a workout

`Ferdig` is disabled until at least one set is completed.

1. The user selects `Ferdig`.
2. A confirmation asks whether to complete the workout. If planned sets exist,
   it explicitly warns that they will be discarded.
3. On confirmation, planned sets and exercises without completed sets are
   removed, the workout is assigned its completion timestamp, and the change
   is committed atomically.
4. The completed, read-only workout detail opens as the summary.

There is no separate pre-save summary.

### 5.7 Cancel a workout

`Avbryt` is always available and always requires explicit confirmation,
including for an empty workout. Confirmation permanently deletes the active
workout without creating history. Completed workout history is unaffected.

### 5.8 Navigation and modal tasks

The app uses hierarchical stack navigation from Home and has no permanent tab
bar. Android system Back and the iOS back gesture match visible navigation:
they close the topmost modal, otherwise move one stack level back, and use
normal platform behavior from Home.

The exercise picker and exercise creation are cancellable modal tasks. Closing
the picker without choosing returns to the unchanged active workout and focuses
`Legg til øvelse`; choosing closes it and focuses the selected exercise card.
Cancelling creation returns unchanged to its origin. Creation from the picker
selects the new exercise and returns to the active workout, while creation from
the exercise list opens the new exercise detail.

List-to-detail navigation preserves the originating list's search and scroll
position. Back from a workout detail returns to Home when the detail was opened
after completion, and to workout history when opened there.

After confirmed workout cancellation, Home opens with focus on `Start økt`.
After successful completed-workout deletion, workout history opens without a
success message; focus moves to the next newer row, otherwise the next older
row, otherwise the empty state's `Start økt` or `Fortsett økt` action.

## 6. Domain rules

### 6.1 Exercise identity and names

Each exercise has a stable internal ID. Workouts reference the ID and do not
snapshot the name.

Before validation, storage, duplicate checking, and sorting, a name is
processed in this order:

1. Remove leading and trailing whitespace.
2. Replace each internal run of whitespace, including tabs and line breaks,
   with one ordinary space.
3. Normalize Unicode to NFC.

The result must contain 1 through 100 grapheme clusters. Names are unique under
case-insensitive comparison. Accents, punctuation, and other characters remain
significant. The normalized spelling and casing entered by the user is shown.

Alphabetical ordering uses Bokmål (`nb`) collation without case distinction;
`æ`, `ø`, and `å` follow the locale's normal ordering after `z`. Stable exercise
ID is the final tie-breaker for equal collation values.

An exercise can be deleted only when no active or remaining completed workout
references it. Deleting all completed workouts that reference an otherwise
unused exercise makes that exercise deletable.

Creating or renaming to a duplicate normalized name shows the announced inline
error `En øvelse med dette navnet finnes allerede` beneath the name field. The
draft is retained, focus returns to the field, and no data changes. A rename
keeps the prior stored name until a valid unique name is saved. The error clears
as soon as the field changes and is checked again on the next save attempt. A
database uniqueness conflict has identical behavior and exposes no technical
detail. No shortcut to the existing exercise is offered.

Deleting an eligible exercise requires a destructive dialog that names the
exercise and offers `Avbryt` and `Slett`; there is no undo after success.
Cancelling returns focus to `Slett øvelse`. Successful deletion opens the
exercise list without a success message and focuses the next exercise in
Bokmål alphabetical order, otherwise the previous one, otherwise the empty
state's `Opprett første øvelse` action. A deletion failure can instead be
dismissed to continue on the unchanged detail screen without data loss.

### 6.2 Workout and exercise membership

- At most one workout has active status.
- An exercise occurs at most once in a workout.
- Exercise membership stores an explicit stable position assigned on insertion.
- A completed workout preserves the active workout's exercise order.

### 6.3 Set values

A set is confirmable only when both values are valid:

- load: `0` through `999.9` kilograms, with at most one decimal;
- repetitions: integer `1` through `999`.

Load input accepts comma or period as the decimal separator. The stored numeric
value is separator-independent and display follows the `nb` locale. Zero load
is valid and does not represent a separate repetition-only exercise type.

### 6.4 Planned and completed sets

A planned set has no confirmation timestamp and is not part of completed
history. A completed set has valid load and repetitions and a confirmation
timestamp.

Completed sets sort by confirmation timestamp ascending, then stable database
ID ascending. Their displayed labels, `Sett 1`, `Sett 2`, and so on, are derived
from this order and are never stored.

Planned sets show `Planlagt sett` without a number and sort by stable database
ID ascending. A set retains its ID through persistence and unconfirmation, so
an unconfirmed set returns to its stable position among the planned sets.

When suggestions are copied from a previous workout, they are created in that
workout's displayed order, so increasing IDs preserve the suggestion order.

## 7. Persistence and failure behavior

`expo-sqlite` is the sole durable source for exercises, the active workout, and
history. The database uses stable generated IDs, foreign-key constraints, and
schema migrations from the first release.

Database opening and migration use a blocking startup screen with the app name
and an activity indicator. Navigation and data actions become available only
when the database is ready. On failure, the screen shows `Trene kunne ikke
starte`, explains that data was not changed, and offers `Prøv igjen`; persistent
failure also suggests restarting the app. The MVP never responds by deleting
data or offering partial or read-only use.

Accepted mutations are written immediately in SQLite transactions. On launch
and foregrounding, the app derives the active workout from SQLite.

For planned-set input:

- a valid value is persisted when the field loses focus and always before
  internal navigation or backgrounding;
- invalid or incomplete text remains in process memory, displays an inline
  validation error, and is not written to SQLite;
- invalid in-memory text may be lost if the operating system kills the process;
- confirming a set writes its valid values and confirmation atomically.

If a transaction for a valid edit fails, the app retains the new value in
memory and marks it visibly and accessibly as not saved. Confirming that set and
completing the workout remain blocked until an explicit retry makes the relevant
change durable. A persistent failure remains visible; a brief toast alone is
insufficient.

Completing, cancelling, and deleting a completed workout are each atomic
database operations. A failed destructive or completion transaction leaves the
previous durable state intact and reports the failure without navigating as if
it succeeded.

A screen that cannot read required data shows `Kunne ikke laste inn` and `Prøv
igjen` in place, never an empty state. Back navigation remains available while
data-dependent actions are hidden or disabled. A detail whose workout or
exercise no longer exists instead shows `Finnes ikke lenger` and a route to the
relevant freshly loaded list, without retrying the missing resource.

During any durable operation, its trigger shows activity and the trigger,
competing data actions, and navigation that could interrupt it are blocked. The
rest of the app is not blocked unnecessarily. Failed destructive operations
keep the page and data, close the confirmation dialog, announce the failure,
and focus `Prøv igjen`. Failed non-destructive writes keep the form and draft,
show an accessible inline or status error, and focus retry or the relevant
field. Navigation to a success destination occurs only after confirmed storage.

A failed autosave in an active workout remains visibly and accessibly marked.
The failed mutation is not presented as durable, and dependent actions remain
blocked until manual retry succeeds. The user may return Home, where the active
workout remains marked with a save error and can be reopened. The MVP never
retries failed database operations automatically.

## 8. Visual and interaction direction

The interface is simple, calm, and clean. Active recording prioritizes
one-handed operation, low tap count, large targets, and readable status over
visual density. Both light and dark themes follow the system setting and update
while the app runs. Concrete colors, spacing tokens, typography, and component
styling are implementation choices constrained by this specification's
accessibility acceptance criteria.

The app plays no sound. It uses brief platform-appropriate haptic feedback
for meaningful choices, confirmations, and errors, while respecting system
settings. Haptics never carry information by themselves and are not emitted for
every tap or routine accessibility focus movement.

Every core operation uses a visible single-tap control. Gestures, long press,
motion, or haptics may not be the only way to invoke or understand an action.
Reduced-motion settings are respected.

## 9. Accessibility requirements

The implementation follows the testable MVP requirements in
[`mobile-accessibility.md`](research/mobile-accessibility.md). This is a product
quality target, not a claim that Trene is legally covered by every cited rule.

Required acceptance thresholds include:

- text scales to 200% and the largest supported platform accessibility size
  without clipped content, lost actions, or ordinary two-dimensional scrolling;
- normal text has at least 4.5:1 contrast; large text and meaningful non-text
  cues have at least 3:1, independently in every light/dark state;
- all Android touch targets are at least 48 x 48 dp and all iOS targets at least
  44 x 44 pt, with no overlapping hit areas;
- every control exposes an accurate Norwegian accessible name, role, value, and
  state to TalkBack and VoiceOver;
- headings, groups, field relationships, reading order, and focus order match
  the task order;
- modal focus enters the dialog and returns to its launcher; add/delete and
  navigation operations place focus predictably;
- validation, completion, deletion, and save status are visible in text and
  announced without color, sound, motion, or haptics as the sole signal;
- core flows work in portrait and landscape on the smallest supported phone
  width, with set fields stacking rather than clipping when needed;
- all functions work with screen-reader navigation and supported external
  keyboard or switch-style sequential navigation;
- animations do not flash above WCAG thresholds and nonessential movement is
  removed when reduced motion is enabled.

The legal applicability of Norwegian accessibility rules must be assessed
before making a statutory compliance claim.

## 10. Technical constraints and delivery

- Framework: Expo/React Native with TypeScript.
- Persistence: `expo-sqlite`, with no cloud or network runtime dependency.
- Platforms: Android and iOS phones from one codebase.
- Minimum OS versions: the lowest Android and iOS versions officially supported
  by the selected Expo version at implementation start, recorded in project
  configuration.
- Primary development and MVP test platform: Android.
- MVP Android distribution: directly installable APK.
- iOS remains a required, recurring test target despite Android-first testing.
- Test strategy: TypeScript/Jest and React Native Testing Library for fast
  tests, real-device/emulator SQLite integration tests, Maestro Android
  end-to-end coverage, physical Android testing, and recurring iOS regression.

SQLite schema design should not unnecessarily prevent a later versioned
file-based backup and restore feature, but that feature is outside this MVP.

## 11. MVP acceptance scenarios

The MVP is accepted when all scenarios below pass on supported Android and iOS
phones, with the accessibility matrix applied to each core flow.

1. **First use:** From an empty installation, create the first exercise, record
   and confirm a valid set, complete the workout, and see it in both workout and
   exercise history.
2. **Suggested workout:** Start another workout, select the same exercise, and
   receive every completed set from its newest remaining workout as editable,
   unconfirmed suggestions in the same order.
3. **Set lifecycle:** Add a set using the specified defaults, confirm it,
   unconfirm it, edit it, reconfirm it, and observe deterministic regrouping and
   numbering after app restart.
4. **Interleaved exercises:** Add multiple exercises, switch between them, and
   complete sets in interleaved order without changing exercise-card order or
   creating duplicate exercise membership.
5. **Recovery:** Enter valid data, navigate away, background and force-stop the
   app, reopen it, and resume the single active workout without accepted-data
   loss.
6. **Invalid and failed save:** Enter each invalid boundary value and trigger a
   simulated SQLite failure; see actionable, announced errors and no false
   confirmation, completion, or navigation success.
7. **Completion:** Verify `Ferdig` is unavailable without a completed set, warns
   about planned sets, removes incomplete exercises, commits atomically, and
   opens read-only workout detail.
8. **Cancellation:** Cancel empty and populated workouts only after explicit
   confirmation and verify that no completed history is affected.
9. **Deletion:** Delete a completed workout only after explicit confirmation;
   verify suggestions fall back to the next remaining workout and an exercise
   becomes deletable only after all active/history references are gone.
10. **Names and search:** Verify whitespace normalization, NFC, grapheme limit,
    case-insensitive duplicate prevention and substring search, Bokmål sorting,
    and current-name display throughout history.
11. **Lists and empty states:** Verify workout rows show completion time and the
    saved-exercise count, exercise rows show their remaining-workout usage
    count, whole rows open details, and each no-data/no-match/all-added state
    shows its specified message and context-appropriate action.
12. **Presentation:** Complete all core flows in light and dark mode, portrait
    and landscape, smallest supported width, 200% and maximum platform text,
    TalkBack and VoiceOver, reduced motion, and with sound and haptics disabled.
13. **Offline delivery:** Install the Android APK directly and complete the full
    start-record-restart-resume-complete-history flow with networking disabled.
14. **Navigation:** Verify modal cancellation and system Back behavior, preserved
    list search and scroll state, completion origins, and every specified
    post-cancellation or post-deletion destination and focus target.
15. **Exercise safeguards:** Trigger duplicate names in creation, rename, and a
    simulated database uniqueness race; verify identical inline behavior and no
    data change. Delete an eligible exercise only through its named confirmation
    and verify cancellation, success focus, and failed-write retry behavior.
16. **Startup and loading failures:** Simulate database-open, migration, screen
    read, missing-resource, autosave, non-destructive write, and destructive
    write failures; verify the specified blocking, retry, focus, announcement,
    retained-data, and navigation behavior without automatic retry.

## 12. Implementation freedom

Implementation may choose concrete visual tokens, component internals,
navigation and state-management libraries, database table names, and test-file
organization. Those choices must preserve all behavior, domain invariants,
failure semantics, platform constraints, and acceptance criteria above.
