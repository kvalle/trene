# Design System Migration Specification

## Problem Statement

Trene's screens implement similar controls, forms, rows, cards, feedback,
statuses, and dialogs independently. The result is visually inconsistent and
makes every interface change expensive: colors, typography, shape, disabled
states, busy states, accessibility behavior, and interaction details can drift
between screens.

The approved design system defines the intended visual language and component
semantics, but its current catalog is an HTML prototype. It does not render the
React Native components used by the application. Maintaining that prototype in
parallel with a separate app implementation would create two sources that can
diverge.

Some screens, especially Active Workout and the Data restore flow, are too
complex to migrate safely from static examples alone. Their information
hierarchy, local and global operation states, keyboard behavior, large-text
layout, and safety-critical dialogs must be validated interactively before
production implementation.

The migration must not alter product behavior. Existing persistence,
navigation, lifecycle, focus, accessibility, retry, haptic, and safety behavior
is already deliberate and often protected by tests and native automation.

## Solution

Build a reusable React Native component library that implements the documented
design system and migrate every current user-facing screen to it in small,
dependency-ordered tracer bullets.

Create a React Native development catalog that imports and renders the exact
components used by the production app. Every component delivery adds its real
variants and states to this catalog. The existing HTML catalog remains a design
reference while the library is being built, then is removed when it no longer
contains unique approved design information.

Preserve all existing functional and accessibility behavior. Before changing a
screen's presentation, add any missing regression or characterization tests and
run them green against the existing implementation. Then migrate the screen,
run automated and native verification, and provide matched before-and-after
screenshots.

Use interactive prototype approval gates for the Active Workout screen and the
Data restore flow before implementing their redesigned compositions.

## User Stories

1. As a Trene user, I want every screen to use a coherent visual language, so that the app feels predictable and trustworthy.
2. As a Trene user, I want the app to follow my system light or dark theme, so that it remains comfortable in my environment.
3. As a Trene user, I want text and controls to remain readable at large system text sizes, so that I can use the app without losing content or actions.
4. As a Trene user, I want controls to meet native touch-target expectations, so that they are easy to operate.
5. As a Trene user, I want primary, secondary, text, and destructive actions to look consistently different, so that their relative importance is clear.
6. As a Trene user, I want disabled controls to look unavailable rather than like weaker active actions, so that I do not mistake them for usable controls.
7. As a Trene user, I want an action in progress to show a clear status and prevent repeated activation, so that I know the app is working.
8. As a Trene user, I want errors to use text, iconography, and visual treatment together, so that meaning does not depend on color alone.
9. As a Trene user, I want loading, empty, no-results, failure, and missing-resource states to be presented consistently, so that I understand why content is unavailable and what I can do.
10. As a Trene user, I want dialogs to use consistent safe, confirming, and destructive actions, so that consequential choices are unambiguous.
11. As a Trene user, I want dialog actions to remain readable and operable with large text, so that confirmation is not less safe under accessibility settings.
12. As a Trene user, I want native back, swipe, and modal behavior to remain familiar on Android and iOS, so that the redesign does not make navigation surprising.
13. As a screen-reader or switch-control user, I want roles, names, hints, states, reading order, focus transitions, and announcements preserved, so that the redesigned app remains operable.
14. As a keyboard user, I want fields, errors, and relevant actions to remain visible and reachable while the keyboard is open, so that forms remain usable.
15. As a user starting Trene, I want loading, recoverable failure, repeated failure, and safety stop to be visually distinct without changing startup safety.
16. As a user on Home, I want one dominant start-or-continue action and clearly subordinate destinations, so that the next step is obvious.
17. As a user with an unsaved workout draft, I want the warning to remain visible and meaningful after the redesign, so that I do not mistake the draft for durable data.
18. As a user creating an exercise, I want a focused, simple form with clear validation and save progress, so that I can complete the task quickly.
19. As a user browsing Settings, I want destinations presented as consistent navigation rows, so that the screen can grow without visual reinvention.
20. As a user browsing History, I want completed workouts grouped as scannable navigation rows, so that dates and exercise counts are easy to compare.
21. As a user with no completed workouts, I want a clear empty state and start-or-continue action, so that History remains useful.
22. As a user browsing Exercises, I want a consistent searchable list with usage metadata, so that I can find an exercise quickly.
23. As a user whose exercise search has no matches, I want a clear no-results state and a relevant creation action, so that I can continue without clearing my intent.
24. As a user choosing an exercise for a workout, I want the selected row to retain its identity while showing progress, so that I know which exercise is being added.
25. As a user choosing an exercise, I want unavailable rows and actions disabled while selection is saved, so that I cannot create conflicting operations.
26. As a user viewing a completed workout, I want exercise summaries and sets presented with consistent cards and data rows, so that the result is easy to scan.
27. As a user deleting a completed workout, I want an unmistakably destructive confirmation and protected busy state, so that deletion is intentional and cannot be interrupted unsafely.
28. As a user viewing an exercise, I want editing, history, empty history, and deletion to form one coherent detail page, so that related tasks remain understandable.
29. As a user renaming an exercise, I want the field, error, and save state to remain usable with the keyboard and large text, so that I can correct problems directly.
30. As a user managing data, I want the privacy notice and backup and restore actions to have clear hierarchy, so that I understand their purpose and consequences.
31. As a user previewing a restore, I want creation time and content counts presented clearly before any data changes, so that I can verify the selected backup.
32. As a user confirming a restore, I want current and incoming data clearly compared in a destructive confirmation, so that replacement is explicit.
33. As a user during restore commit, I want a non-dismissible busy state, so that I do not accidentally interrupt a critical operation.
34. As a user after an unrecoverable restore failure, I want a locked safety message with preservation guidance and no misleading actions, so that I do not make recovery less likely.
35. As a user recording a workout, I want set-level, exercise-level, and workout-level actions to be visually distinct, so that I understand their scope.
36. As a user recording a dense workout, I want several exercises and sets to remain scannable, so that the interface continues to work beyond the simplest example.
37. As a user editing a planned set, I want the active fields, validation, save failure, and retry to remain usable with the keyboard and large text, so that recording is reliable during training.
38. As a user waiting for a local workout operation, I want only the affected context and unsafe competing actions disabled, so that the app remains understandable.
39. As a user expanding exercises, I want the expanded state and completed-set summary to remain clear, so that I can move efficiently between exercises.
40. As a user finishing or cancelling a workout, I want the existing warnings, confirmations, persistence ordering, and return routes preserved, so that redesign cannot lose data.
41. As a maintainer, I want one reusable React Native component library, so that visual and accessibility behavior is fixed once and reused across screens.
42. As a maintainer, I want components named after general interface roles rather than workout concepts, so that they remain reusable.
43. As a maintainer, I want the component catalog to render production components, so that documentation cannot silently drift from the app.
44. As a maintainer, I want every component ticket to add its implemented variants and states to the runtime catalog, so that the catalog grows with the library.
45. As a maintainer, I want component interfaces derived from real screen consumers, so that the library does not accumulate speculative abstractions.
46. As a maintainer, I want domain state and asynchronous orchestration to remain in screens, so that generic visual components do not acquire business behavior.
47. As a maintainer, I want existing behavior characterized by green tests before visual changes begin, so that regressions can be attributed to the migration.
48. As a maintainer, I want screen-level tests to remain the primary behavioral seam, so that tests protect user-observable behavior rather than implementation details.
49. As a maintainer, I want small component contract tests only where reuse can lose native props or refs, so that component tests remain valuable and stable.
50. As a maintainer, I want native journey tests for high-risk flows, so that JavaScript tests do not conceal navigation, keyboard, modal, or persistence regressions.
51. As a reviewer, I want matched before-and-after screenshots with stable fixtures, so that each visual change can be evaluated directly.
52. As a reviewer, I want relevant light, dark, large-text, keyboard, error, busy, disabled, and dialog states shown, so that approval is not based only on a happy path.
53. As a reviewer, I want complex designs approved through an interactive prototype before production implementation, so that design problems are solved before they become migration code.
54. As a maintainer, I want the HTML prototype removed when the runtime catalog supersedes it, so that the repository retains one executable component reference.
55. As a release owner, I want unavailable physical-iPhone verification recorded as residual risk, so that simulator coverage is not mistaken for physical-device evidence.

## Implementation Decisions

- The design system documentation remains the normative visual and semantic reference. It defines colors, typography levels, radii, hierarchy, component roles, and accessibility principles.
- Production UI components will live in a dedicated shared React Native UI module. The exact internal file layout is chosen during implementation, but application screens import components through a small public module boundary rather than from screen-local copies.
- The library begins with semantic theme tokens for background, surfaces, text, muted text, primary and danger actions, content-on-action colors, borders, and focus. Both light and dark values are implemented.
- React Navigation receives the same semantic theme values used by production components. The app retains native stack navigation and native modal routes; the catalog header is a visual contract, not a requirement to replace native navigation.
- The library provides general components and compositions for actions, text/search/numeric fields, field errors, cards, list containers, navigation/selection/data rows, disclosure cards, loaders, notices, error alerts, page statuses, and dialogs.
- Component names describe interface roles, not workout-domain concepts. Domain copy, data, persistence, and orchestration remain in screens.
- Disabled and busy are states of relevant interactive components, not separate components. Disabled controls use native disabled behavior and a neutral visual treatment. Busy controls expose status, prevent repeated activation, and retain their semantic action role.
- Buttons have primary, secondary, text, and destructive variants. A page-level retry is normally primary; retry inside a local error alert is secondary because the surrounding screen remains usable.
- Small row actions use an appropriate icon plus a visible label. The icon strategy is resolved during the Active Workout prototype before production use.
- Forms are scrollable and account for the software keyboard. The focused field, its error, and the next relevant action remain reachable. Controls grow rather than truncate at large text sizes. Paired numeric fields stack when horizontal layout no longer has sufficient room.
- A list container owns its outer border, radius, clipping, and separators. Rows own layout, interaction, and state. Settings uses this list model even while it contains one destination because more settings are expected soon.
- PageStatus composes loading, empty, no-results, failure, and missing-resource content. Local operation failures use ErrorAlert instead of replacing otherwise valid page content.
- Dialog is the shared modal foundation with confirming and destructive compositions. Safe cancellation precedes confirmation in reading order; the confirming or destructive action comes last. Actions stack when necessary for large text.
- Destructive work disables every dialog action, prevents dismissal and stack removal, and shows busy state on the action that started the operation.
- Startup safety stop uses a non-dismissible full-screen PageStatus because navigation is unavailable. Restore safety stop uses a non-dismissible Dialog because it occurs inside an existing modal workflow. They may share error content but not a domain-specific container.
- Exercise Picker treats existing selection rows as the primary task. Create Exercise is secondary when selectable rows exist and primary when no row can satisfy the task. A busy row retains the exercise name and shows progress in its trailing slot.
- Deleting an unconfirmed planned set remains secondary because it removes a local plan. Deleting confirmed or historical data is destructive.
- The Data restore flow receives an interactive prototype and explicit approval before production migration. It covers selection failure, preview, current-data inspection, destructive confirmation, non-dismissible commit, success, recoverable failure, and locked safety stop at small width and large text.
- The Active Workout screen receives an interactive prototype and explicit approval before production migration. It covers empty and dense workouts, long names, multiple planned sets, field and save failures, local busy states, keyboard, large text, action hierarchy, and all dialogs.
- A React Native development catalog imports the same component implementations as the production app. It is not a second visual implementation. It supports representative content, relevant component states, light and dark themes, large text, and constrained layouts.
- Each component migration ticket updates the runtime catalog with the components and states it introduces. A component is not complete until its production implementation and catalog representation agree.
- The current HTML catalog remains temporarily as the approved design reference and prototype surface. It is removed when all unique approved patterns have been represented in the runtime catalog. Color experimentation and discarded alternatives are not retained.
- Migration proceeds through twelve dependency-ordered tracer bullets: theme/app shell/runtime catalog; controls/Create Exercise; feedback/Home/Startup; navigation lists/Settings/History; searchable Exercises; Exercise Picker; cards/dialogs/Completed Workout; Exercise Detail; Data prototype; Data migration; Active Workout prototype; Active Workout migration and catalog completion.
- List and card/dialog work can proceed in parallel after the shared control and feedback foundations are established. Active Workout prototype work can proceed independently. Active Workout production migration occurs last.
- No migration ticket may intentionally change business behavior, persistence semantics, route contracts, focus behavior, announcements, haptics, or retry semantics. Any desired behavioral change becomes separate explicitly approved work.
- User-visible implementation tickets include matched before-and-after screenshots. Android emulator screenshots are canonical because they can be reproduced consistently. iOS simulator screenshots supplement native-header, modal, keyboard, and Dynamic Type review where useful.
- Physical iPhone verification is unavailable for this migration. iOS simulator and existing iOS CI are used instead. The remaining physical-device risk is recorded in affected pull requests and does not block the migration.

## Testing Decisions

- New regression and characterization tests for existing behavior are written first and run green against the existing interface before production presentation changes begin.
- Tests assert externally observable behavior rather than component internals or exact style objects.
- React Native Testing Library screen tests are the primary seam for domain-visible state, navigation, persistence ordering, disabled and busy behavior, retry semantics, focus, announcements, and accessibility.
- Shared-component tests are limited to reusable contracts that screen tests cannot reliably protect: ref and event forwarding, `testID`, roles, names, hints, accessibility state, native disabled/editable behavior, input events, modal containment, and dismissal callbacks.
- Existing screen suites remain in place and are expanded only for identified preservation gaps. They are not replaced by shallow component tests.
- A focused app-shell test protects theme selection, route registration and titles, initial route, modal presentations, back-button configuration, and shared workout-draft provider placement.
- The Create Exercise migration adds characterization of autofocus, keyboard submission, generic persistence failure, disabled controls, and blocked navigation before visual changes.
- Home and Startup tests add missing retry, focus, startup ordering, loader-label, and runtime-cleanup coverage before migration.
- Settings receives a focused contract test. Existing History tests continue to protect row semantics, empty-state behavior, persistence before navigation, and focus restoration.
- Exercises receives missing refresh, loader, retry-focus, and keyboard contracts. A focused Android Maestro flow covers search results and no results.
- Exercise Picker receives missing autofocus, whole-screen busy blocking, failure preservation, and system-cancellation contracts. A focused Android Maestro flow covers existing exercise selection, search, cancellation, and the all-added state.
- Completed Workout receives missing blocked-dismissal, navigation-prevention, and busy-state contracts. A focused Android Maestro flow covers cancellation and successful deletion.
- Exercise Detail receives missing rename-busy, duplicate-delete guard, blocked dismissal, loader, and keyboard contracts.
- Data retains its extensive screen, integration, package, database-runtime, recovery, and interruption tests. Additional assertions preserve all automation IDs, focus restoration, announcement, mutual blocking, commit locking, and safe-stop semantics.
- Active Workout retains its broad screen, domain, and database tests. Missing route-focus, navigation prevention, flush-before-navigation, keyboard, field-association, and busy-dialog cases are added before migration.
- Android Maestro remains the primary automated native journey seam. Four focused flows are added for Exercises search, existing-exercise selection, completed-workout deletion, and dense/error/busy Active Workout behavior.
- Data changes run relevant Android and iOS backup/restore suites, including success, recoverable failure, rollback failure, and interruption scenarios where commit or startup composition changes.
- Active Workout migration runs the complete Android smoke suite and release-like qualification. iOS simulator manually covers start, create/select, edit, background/resume, complete, cancel, keyboard, and swipe/back behavior because no equivalent iOS workout suite exists.
- Every implementation ticket runs TypeScript checking and the complete Jest suite. The completed migration also runs the repository verification command.
- Native verification checks light and dark theme, runtime theme change where relevant, large text, keyboard-open layouts, loading, empty, error, busy, disabled, and dialog states.
- TalkBack or VoiceOver verification is performed when roles, focus, fields, dialogs, or action order change. Simulator limitations are recorded rather than treated as physical-device proof.
- Every visible implementation ticket includes deterministic, matched before-and-after screenshots from the same Android emulator state. Transient states use controlled fixtures or pending promises instead of manual timing.
- The Active Workout prototype uses approval screenshots rather than origin/main pairs. Its approved states become the visual acceptance source for production migration.

## Out of Scope

- Changes to workout, exercise, history, backup, restore, or startup product behavior.
- Changes to database schemas, persistence rules, migration rules, backup formats, or restore safety guarantees.
- New user-facing features or Settings destinations.
- App-controlled theme selection; Trene continues to follow the system theme.
- A custom navigation implementation replacing the native stack.
- Domain-specific components that embed workout persistence or orchestration.
- A general-purpose third-party design-system framework or Storybook dependency unless a later concrete need justifies it.
- Tablet, foldable, desktop, or web application layouts beyond ensuring components do not make unnecessary phone-size assumptions.
- Visual regression automation based on pixel snapshots.
- Physical iPhone testing during this migration.
- Preserving abandoned color explorations or superseded prototype alternatives.

## Further Notes

- The normative visual rules and current prototype catalog are documented in the repository's design-system documentation.
- The detailed component matrix, dependency graph, design uncertainties, preservation requirements, test coverage, runtime prerequisites, and screenshot plan are documented in the design-system migration plan.
- The migration is expected to produce twelve implementation and prototype tickets with explicit blocking relationships.
- Each implementation ticket must reassess whether it has introduced a component, state, or exception not already approved. Such a change requires user agreement before implementation.
- The runtime component catalog is part of the product's engineering infrastructure. It should remain easy to launch locally and should identify when a component is demonstrated with example domain content rather than embedding that content in the component API.
- The migration is complete only when all registered user-facing screens and Startup are rendered through the shared system where applicable, the runtime catalog covers the actual components, the temporary HTML catalog has no unique value and is removed, required checks pass, and every implementation ticket has reviewable visual evidence.
