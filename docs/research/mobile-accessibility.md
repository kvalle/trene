# Mobile accessibility requirements for Trene MVP

Research for [GitHub issue 32](https://github.com/kvalle/trene/issues/32), checked 2 August 2026.

## Executive conclusion

Design and test every MVP task (create a training session, choose an exercise, add/edit/delete a set, and finish/review a session) against the applicable WCAG 2.1 A and AA criteria. The highest-risk prototype constraints are: 200% scalable text without lost content or function; 4.5:1 text and 3:1 meaningful non-text contrast in every theme/state; 48 x 48 dp Android and 44 x 44 pt iOS hit targets; complete labels, roles, values and state for assistive technology; logical reading/focus order; textual, announced validation and save status; no color-, gesture-, motion-, haptic- or orientation-only operation.

This is a conservative product target, not a conclusion that every WCAG 2.1 A/AA criterion is legally binding on Trene. Uu-tilsynet says many mobile apps are regulated when they need an internet connection at least once after download to serve their purpose, and says the relevant minimum differs by sector and content: currently 29 app criteria for private-sector organizations and 42 for public-sector organizations, with six criteria excepted for apps ([Uu-tilsynet: Universell utforming av apper](https://www.uutilsynet.no/regelverk/universell-utforming-av-apper/230)). Whether Trene is offered by a regulated organization, needs a network connection for its purpose, or falls within an exception is not established by issue 32. That legal scope must be assessed before claiming statutory compliance.

## Source and requirement levels

- **Legal/WCAG minimum** below means a WCAG 2.1 A or AA success criterion identified by Uu-tilsynet as part of Norway's framework for relevant apps. It is legally binding only if Trene and the content/function in question are in scope. Uu-tilsynet stresses that relevance depends on app functionality and sector ([app guidance](https://www.uutilsynet.no/regelverk/universell-utforming-av-apper/230)); its filter is the authority for the exact applicable set ([WCAG requirement list](https://www.uutilsynet.no/wcag-standarden/wcag-standarden/86?f%5B0%5D=t1%3A206)).
- **WCAG AAA** is useful design guidance but is not part of an A/AA conformance target. In particular, WCAG 2.1 target size 2.5.5 is AAA, not an A/AA legal minimum ([WCAG 2.1, 2.5.5](https://www.w3.org/TR/WCAG21/#target-size)).
- **Platform recommendation** is official Apple/Google guidance. It is not itself a Norwegian statutory WCAG requirement, but is the practical native implementation baseline.
- WCAG success criteria are normative, technology-neutral and testable; techniques and explanatory documents are informative, not additional requirements ([WCAG 2.1 guidance layers](https://www.w3.org/TR/WCAG21/#wcag-2-layers-of-guidance)).

## Testable MVP requirements

### Contrast and visual states

**Legal/WCAG minimum**

- Normal text and text in controls must have contrast of at least 4.5:1 against its actual background. Large text may use 3:1; WCAG defines large as at least 18 pt (24 CSS px) regular or 14 pt (about 18.66 CSS px) bold. Logos, incidental text and inactive controls are exceptions ([WCAG 2.1, 1.4.3](https://www.w3.org/TR/WCAG21/#contrast-minimum); [Uu-tilsynet 1.4.3](https://www.uutilsynet.no/wcag-standarden/143-kontrast-minimum-niva-aa/95)). Do not treat placeholder text for an editable field as an inactive-control exception.
- Visual information needed to identify a control, its state, field boundary or focus must contrast at least 3:1 with adjacent colors. The rule does not require restyling a native component whose appearance is determined by the platform and not modified by Trene ([WCAG 2.1, 1.4.11](https://www.w3.org/TR/WCAG21/#non-text-contrast); [Uu-tilsynet 1.4.11](https://www.uutilsynet.no/wcag-standarden/1411-kontrast-ikke-tekstlig-innhold-niva-aa/145)).

**MVP acceptance tests**

- Measure every text/background token pair and every meaningful icon, outline, selected state, error state and custom focus indicator in light and dark themes, including disabled appearances where information remains necessary.
- Measure composited colors in their rendered state, not only source hex values. Pass at 4.5:1 for normal text and 3:1 for large text and required non-text cues.
- Do not place essential text over variable imagery or gradients unless a backing surface guarantees contrast.

### Text scaling and layout

**Legal/WCAG minimum**

- Text must be resizable to 200% without assistive technology and without loss of content or functionality, except captions and images of text ([WCAG 2.1, 1.4.4](https://www.w3.org/TR/WCAG21/#resize-text); [Uu-tilsynet 1.4.4](https://www.uutilsynet.no/wcag-standarden/144-endring-av-tekststorrelse-niva-aa/96)).
- Where reflow applies, content must work at the equivalent of 320 CSS px width without two-dimensional scrolling, except content whose meaning requires two-dimensional layout ([WCAG 2.1, 1.4.10](https://www.w3.org/TR/WCAG21/#reflow); [Uu-tilsynet 1.4.10](https://www.uutilsynet.no/wcag-standarden/1410-dynamisk-tilpasning-reflow-niva-aa/144)). For a native app, use this as the narrow-viewport design test and confirm its exact legal mapping against Uu-tilsynet's app test rule.
- Content and functionality must survive user-overridden text spacing at WCAG's stated values where the criterion and technology apply ([WCAG 2.1, 1.4.12](https://www.w3.org/TR/WCAG21/#text-spacing)).

**Platform recommendation and MVP interpretation**

- Use platform-scalable text styles rather than fixed pixel/point text and respond to the device text-size setting. Apple provides per-app Larger Text and other visual settings, so a native app must not assume the default category ([Apple: per-app visual accessibility settings](https://support.apple.com/guide/iphone/customize-per-app-visual-settings-iph1f48544ab/ios)). Android recommends scalable pixels (`sp`) for text so user font preferences are respected ([Android: support different pixel densities](https://developer.android.com/training/multiscreen/screendensities#TaskUseDP)).
- Apple recommends at least 11 pt at the default size for legibility; this is platform guidance, not the WCAG 200% rule ([Apple UI design tips](https://developer.apple.com/design/tips/)).

**MVP acceptance tests**

- At the largest supported iOS Dynamic Type accessibility size and Android's largest font-size setting, all labels, values and actions remain available. Text wraps; rows/cards grow or stack; no value is clipped, ellipsized beyond recognition or covered; horizontal scrolling is not needed for ordinary forms or lists.
- At 200% relative text size, complete every core task without rotating, zooming out or lowering text size. Numeric inputs for belastning and repetisjoner retain their labels, units, entered values, errors and increment/decrement actions.
- Test the smallest supported phone width and split/narrow window if tablets or foldables are in MVP scope.

### Touch targets and spacing

**Requirement classification**

- WCAG 2.1 has no A/AA minimum target size. Its 44 x 44 CSS px target criterion is AAA and has exceptions ([WCAG 2.1, 2.5.5](https://www.w3.org/TR/WCAG21/#target-size)). Do not describe 44 or 48 as a WCAG 2.1 AA or Norwegian legal minimum.
- Android recommends every interactive target be at least 48 x 48 dp and recommends at least 8 dp separation; the visible icon may be smaller if its responsive area is large enough and does not overlap another target ([Android Accessibility Help: touch target size](https://support.google.com/accessibility/android/answer/7101858)).
- Apple recommends hit targets of at least 44 x 44 pt ([Apple UI design tips](https://developer.apple.com/design/tips/)).

**MVP acceptance tests**

- Android: every add, remove, increment, decrement, menu, close, row and primary action has a non-overlapping target of at least 48 x 48 dp; adjacent targets have 8 dp separation wherever possible.
- iOS: every target is at least 44 x 44 pt. Expand the hit area of small icons without creating overlapping hit regions.
- Verify the dense set-entry UI with a target overlay and one-handed tapping. A tap between `+` and `-` must not trigger either action.
- Activate on release rather than initial touch where the toolkit permits cancellation, so dragging away cancels an accidental action ([WCAG 2.1, 2.5.2](https://www.w3.org/TR/WCAG21/#pointer-cancellation)).

### Labels, roles and screen-reader semantics

**Legal/WCAG minimum**

- Every informative non-text item has an equivalent text alternative; decorative content is excluded from assistive technology ([WCAG 2.1, 1.1.1](https://www.w3.org/TR/WCAG21/#non-text-content); [Uu-tilsynet 1.1.1](https://www.uutilsynet.no/wcag-standarden/111-ikke-tekstlig-innhold-niva/87)).
- Structure and relationships visible on screen must be programmatically determinable, including headings, groups, labels and field/error relationships ([WCAG 2.1, 1.3.1](https://www.w3.org/TR/WCAG21/#info-and-relationships)).
- Every component exposes its accessible name, role and current value/state; changes to user-settable values are exposed to assistive technology ([WCAG 2.1, 4.1.2](https://www.w3.org/TR/WCAG21/#name-role-value); [Uu-tilsynet 4.1.2](https://www.uutilsynet.no/wcag-standarden/412-navn-rolle-verdi-niva/121)).
- A visible text label must be contained in the component's accessible name, preferably at the start, so speech control can address what the user sees ([WCAG 2.1, 2.5.3](https://www.w3.org/TR/WCAG21/#label-in-name)). Labels and headings must describe purpose ([WCAG 2.1, 2.4.6](https://www.w3.org/TR/WCAG21/#headings-and-labels)).

**MVP acceptance tests**

- With TalkBack and VoiceOver, every control announces a concise Norwegian name, role, state/value and useful hint only where the action is not evident. Examples: `Legg til sett, knapp`; `Belastning, tekstfelt, 80 kilogram`; `Sett 2, 8 repetisjoner med 80 kilogram`.
- Icon-only delete/edit/add controls have action-specific names that include context, such as `Slett sett 2`, not `Søppelbøtte` or `Knapp`.
- A set row is exposed as a meaningful group. Do not make a parent and all duplicate children separately focusable. Decorative separators/icons are hidden from the accessibility tree.
- Increment/decrement controls expose the resulting value. Toggle and selected exercise/session states expose selected/checked/expanded state rather than encoding it only visually.
- Use standard native controls and semantics where possible. Apple states standard UIKit controls are accessible by default and provides the accessibility API for custom UI ([Apple Accessibility Programming Guide for iOS](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/iPhoneAccessibility/Introduction/Introduction.html)); the implementation must still be tested because this archived guide is not current API documentation.

### Reading order, focus and navigation

**Legal/WCAG minimum**

- If sequence affects meaning, assistive technology must receive the correct reading sequence ([WCAG 2.1, 1.3.2](https://www.w3.org/TR/WCAG21/#meaningful-sequence)). Focusable components must receive focus in an order that preserves meaning and operation ([WCAG 2.1, 2.4.3](https://www.w3.org/TR/WCAG21/#focus-order); [Uu-tilsynet 2.4.3](https://www.uutilsynet.no/wcag-standarden/243-fokusrekkefolge-niva/105)). Keyboard focus must be visible where keyboard operation applies ([WCAG 2.1, 2.4.7](https://www.w3.org/TR/WCAG21/#focus-visible)).
- Receiving focus or changing a field value must not unexpectedly change context unless the user was warned ([WCAG 2.1, 3.2.1](https://www.w3.org/TR/WCAG21/#on-focus); [3.2.2](https://www.w3.org/TR/WCAG21/#on-input)).

**MVP acceptance tests**

- Swipe through each screen with TalkBack and VoiceOver. Order matches the visual/task order: screen heading, instructions/status, exercise, then each set's label, belastning, repetisjoner and actions.
- Opening a modal moves accessibility focus to its heading or first necessary field and traps focus within it; closing returns focus to the launching control. Adding a set moves focus to an announced new-set heading or first field, not unpredictably to the screen top.
- Deleting a set places focus on the nearest surviving set or the add control and announces the result. Navigation to a new screen announces its title.
- Complete all functions with external keyboard and platform switch/assistive navigation where those input modes are supported; no focus trap or invisible focus is allowed ([WCAG 2.1, 2.1.1 and 2.1.2](https://www.w3.org/TR/WCAG21/#keyboard-accessible)).

### Errors and status communication

**Legal/WCAG minimum**

- Automatically detected errors must identify the field/item and describe the error in text ([WCAG 2.1, 3.3.1](https://www.w3.org/TR/WCAG21/#error-identification); [Uu-tilsynet 3.3.1](https://www.uutilsynet.no/wcag-standarden/331-identifikasjon-av-feil-niva/116)). Inputs requiring user data need labels or instructions ([WCAG 2.1, 3.3.2](https://www.w3.org/TR/WCAG21/#labels-or-instructions)). If a correction is known, suggest it unless doing so would compromise security or purpose ([WCAG 2.1, 3.3.3](https://www.w3.org/TR/WCAG21/#error-suggestion)).
- Status messages must be programmatically exposed so assistive technology can announce them without moving focus ([WCAG 2.1, 4.1.3](https://www.w3.org/TR/WCAG21/#status-messages); [Uu-tilsynet 4.1.3](https://www.uutilsynet.no/wcag-standarden/413-statusbeskjeder-niva-aa/152)).

**MVP acceptance tests**

- Invalid or missing belastning/repetisjoner shows an inline message next to the field, marks the field invalid programmatically, and includes a correction such as `Skriv inn et helt antall repetisjoner fra 1 til 999`.
- On submit, show an error summary when multiple errors exist, announce it once, and allow navigation to each field. Never clear valid entries because another field failed.
- `Sett lagt til`, `Treningsøkt lagret`, offline/pending state and save failure are visible and announced without stealing focus. Persistent failures remain available until resolved; brief snackbars are not the only record of a failure.
- Destructive actions such as deleting a set/session provide confirmation or an immediate, accessible undo. WCAG 3.3.4 specifically mandates reversibility/checking for legal, financial and user-modifiable stored-data transactions when applicable ([WCAG 2.1, 3.3.4](https://www.w3.org/TR/WCAG21/#error-prevention-legal-financial-data)); adopting undo for Trene is also an MVP safety decision.

### Color independence

**Legal/WCAG minimum**

- Color cannot be the only visual means of conveying information, action, response or distinction ([WCAG 2.1, 1.4.1](https://www.w3.org/TR/WCAG21/#use-of-color); [Uu-tilsynet 1.4.1](https://www.uutilsynet.no/wcag-standarden/141-bruk-av-farge-niva/93)). Instructions cannot rely only on shape, color, size, position, orientation or sound ([WCAG 2.1, 1.3.3](https://www.w3.org/TR/WCAG21/#sensory-characteristics)).

**MVP acceptance tests**

- Selected, completed, invalid, unsaved and disabled states each have a text, icon, shape/pattern or programmatic-state cue in addition to color. Error fields show text and an error icon/state, not only a red outline.
- In grayscale and common color-vision simulations, a tester can identify every state and complete every core task.
- Instructions name controls (`Velg Legg til sett`) rather than only location or appearance (`trykk den grønne knappen nederst`).

### Orientation and reflow

**Legal/WCAG minimum**

- Do not lock content and operation to portrait or landscape unless that orientation is essential to the function ([WCAG 2.1, 1.3.4](https://www.w3.org/TR/WCAG21/#orientation); [Uu-tilsynet 1.3.4](https://www.uutilsynet.no/wcag-standarden/134-visningsretning-niva-aa/141)). Nothing in ordinary workout logging makes one orientation evidently essential.
- The reflow constraints above apply where relevant; a fixed dense table is not justified merely because it is convenient ([WCAG 2.1, 1.4.10](https://www.w3.org/TR/WCAG21/#reflow)).

**MVP acceptance tests**

- Complete every core task in portrait and landscape. Rotation preserves entered values, scroll position where practical, current modal and logical accessibility focus.
- In constrained width or with large text, set fields stack vertically rather than clip or require horizontal scrolling.

### Light and dark themes

**Requirement classification and MVP requirement**

- WCAG 2.1 does not require a dark theme. It requires the chosen presentation to satisfy contrast and other criteria. Therefore every Trene-provided theme must independently meet 1.4.3 and 1.4.11; offering a failing theme is not cured by offering another passing theme ([WCAG 2.1 conformance requirement: full pages and complete processes](https://www.w3.org/TR/WCAG21/#conformance-reqs)).
- Support the system light/dark preference and allow the platform to update while the app runs. This is an MVP platform-quality requirement, not a Norwegian legal requirement. Android's official dark-theme guidance describes `MODE_NIGHT_FOLLOW_SYSTEM` and warns against hard-coded colors ([Android: support dark theme](https://developer.android.com/develop/ui/views/theming/darktheme)); Apple exposes Light, Dark and Auto appearances in its developer site and platform design system ([Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)).

**MVP acceptance tests**

- Switch system appearance while every MVP screen and modal is open. All surfaces, system bars, keyboard-adjacent content and controls update without restart, flashing, transparent artifacts or lost state.
- Run the full contrast matrix in both modes, including selected, pressed, focused, invalid, disabled and chart/history colors.

### Motion and flashing

**Legal/WCAG minimum**

- Content must not flash more than three times in any one-second period unless it stays below WCAG's flash thresholds ([WCAG 2.1, 2.3.1](https://www.w3.org/TR/WCAG21/#three-flashes-or-below-threshold); [Uu-tilsynet 2.3.1](https://www.uutilsynet.no/wcag-standarden/231-terskelverdi-pa-maksimalt-tre-glimt-niva/102)).
- If device motion or user motion operates a function, provide an ordinary UI alternative and let the user disable motion activation, except where motion is essential or supported through an accessibility interface ([WCAG 2.1, 2.5.4](https://www.w3.org/TR/WCAG21/#motion-actuation)).
- Reducing nonessential interaction animation is WCAG 2.1 AAA, not an A/AA minimum ([WCAG 2.1, 2.3.3](https://www.w3.org/TR/WCAG21/#animation-from-interactions)).

**Platform recommendation and MVP acceptance tests**

- Respect iOS Reduce Motion and the corresponding Android animator-duration/reduced-motion preference; replace large movement, parallax and repeated celebration with a short fade or no animation. Apple documents that Reduce Motion changes screen transitions and effects ([Apple: customize onscreen motion](https://support.apple.com/guide/iphone/customize-motion-settings-iph0b691d3ed/ios)); Android exposes system animation-scale settings to apps and tests ([Android `Settings.Global`](https://developer.android.com/reference/android/provider/Settings.Global#ANIMATOR_DURATION_SCALE)).
- With reduced motion enabled, complete all tasks with no information or action removed and no transition delay. Never use flashing for workout progress or errors.
- Do not require shaking the phone to undo, add or finish. If offered as a shortcut, provide a labeled button and a setting to disable it.

### Haptics, sound and multimodal feedback

**Requirement classification and MVP requirement**

- WCAG does not require haptics. Because instructions and information cannot rely solely on sensory characteristics or sound, haptic or audio feedback cannot be the only confirmation, warning or error cue ([WCAG 2.1, 1.3.3](https://www.w3.org/TR/WCAG21/#sensory-characteristics)).
- Haptics are optional enhancement only. Use platform-standard semantic feedback sparingly for a completed action or error; honor system/user settings and never vibrate continuously. Apple says haptics can supplement visual and auditory feedback ([Apple HIG: playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)); Android recommends avoiding legacy one-shot patterns and using predefined effects/feedback constants where possible ([Android: haptics principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)). These are platform recommendations, not legal requirements.

**MVP acceptance tests**

- With sound muted and vibration/haptics disabled, every save, error, timer/status and destructive action remains visibly understandable and screen-reader accessible.
- With VoiceOver/TalkBack running, haptics do not mask or duplicate rapid announcements and are not triggered for routine focus movement.

### Gestures and pointer input

**Legal/WCAG minimum**

- Any multipoint or path-based gesture must have a single-pointer alternative unless the gesture is essential ([WCAG 2.1, 2.5.1](https://www.w3.org/TR/WCAG21/#pointer-gestures)).
- Functions triggered by device motion need the alternatives described above. Accessible names must match visible labels for speech input ([WCAG 2.1, 2.5.3 and 2.5.4](https://www.w3.org/TR/WCAG21/#input-modalities)).

**MVP acceptance tests**

- Swipe-to-delete, drag-to-reorder, long press and pinch may only be shortcuts. Provide visible, labeled controls/menu actions for delete, reorder and zoom equivalents.
- Complete all MVP tasks using ordinary single taps, then with VoiceOver and TalkBack gestures.

## Practical verification checklist

Run this checklist on at least one currently supported small-screen iPhone and Android phone, and on both platforms whenever shared UI code changes. Uu-tilsynet explicitly recommends testing native apps with VoiceOver and TalkBack on both iOS and Android ([Uu-tilsynet app guidance](https://www.uutilsynet.no/regelverk/universell-utforming-av-apper/230)).

- [ ] Document whether Trene is a network-dependent app and which legal sector/scope applies; record applicable and non-applicable WCAG criteria before making a compliance claim.
- [ ] Complete each core workflow at default text size, 200%, and the platform maximum accessibility text size on the smallest supported width.
- [ ] Measure text contrast (4.5:1 normal, 3:1 large) and meaningful non-text contrast (3:1) for every state in light and dark mode.
- [ ] Verify information remains understandable in grayscale and color-vision simulations.
- [ ] Overlay target bounds: Android targets are at least 48 x 48 dp and preferably 8 dp apart; iOS targets are at least 44 x 44 pt; no overlap.
- [ ] Run Android Accessibility Scanner, accessibility checks in UI tests where available, and Xcode Accessibility Inspector. Automated checks supplement, not replace, manual and assistive-technology testing; WCAG expects both automated and human evaluation ([WCAG 2.1 introduction](https://www.w3.org/TR/WCAG21/#background-on-wcag-2)).
- [ ] With TalkBack, complete every workflow by swipe navigation and explore-by-touch; verify names, roles, values, state changes, grouping, headings, order, modal focus and announcements.
- [ ] Repeat the complete screen-reader test with VoiceOver. Apple documents VoiceOver as describing and navigating app views and controls ([Apple Accessibility Programming Guide](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/iPhoneAccessibility/Introduction/Introduction.html)).
- [ ] Test an external keyboard and switch-style sequential navigation: visible logical focus, no traps, all actions available.
- [ ] Trigger every validation, offline, save-failure, save-success, empty and loading state. Verify persistent visual text plus an appropriate assistive-technology announcement without unexpected focus movement.
- [ ] Rotate every screen and modal both ways while data is entered; verify state, order, focus and function survive.
- [ ] Toggle light/dark appearance, bold/increased-contrast settings where supported, and reduced motion while the app is running.
- [ ] Disable sound and haptics; verify no information or confirmation disappears. Then enable them and verify they are brief, optional and not disruptive.
- [ ] Verify all drag, swipe, multipoint, long-press and motion shortcuts have visible single-tap alternatives.
- [ ] Verify animations do not flash above the WCAG threshold and that reduced-motion mode removes nonessential movement without removing functionality.
- [ ] Include at least one usability session with people who use screen magnification/large text, a screen reader, and reduced dexterity; conformance checks do not cover every disability need ([WCAG 2.1 abstract and guidance](https://www.w3.org/TR/WCAG21/#abstract)).

## Prototype/spec priorities

1. Make set entry reflowable at maximum platform text size before fixing visual density; no clipped labels, values, controls or errors.
2. Reserve 48 x 48 dp Android / 44 x 44 pt iOS non-overlapping target areas for every control, especially adjacent set increment/decrement/delete actions.
3. Specify an accessibility contract for every component: visible label, accessible name, role, value/state, grouping, focus destination and status announcement.
4. Define contrast-tested semantic color tokens for both themes and every state; never encode selected, complete, invalid or unsaved only by color.
5. Specify focus and announcements for add/delete set, validation, save/offline/failure, modal open/close and screen transitions.
6. Make portrait and landscape, system theme, scalable text and reduced motion part of prototype acceptance, not post-implementation polish.
7. Treat gestures, motion, sound and haptics as optional shortcuts/feedback; every core action and result must remain available through a visible single-tap control and assistive technology.

## Scope caveats

- Issue 32 does not state whether MVP is native, hybrid or web-based. Uu-tilsynet uses app test rules for native/hybrid apps and website test rules for web apps, so implementation techniques differ even when the user-facing requirement is the same ([Uu-tilsynet app types and testing](https://www.uutilsynet.no/regelverk/universell-utforming-av-apper/230)).
- Issue 32 does not identify public/private sector, network dependence, authentication, media, time limits, charts or personal-data fields. Those facts can add or remove applicable criteria. Reassess the complete Uu-tilsynet app-filtered list when the MVP feature set and operator are known ([Uu-tilsynet WCAG list](https://www.uutilsynet.no/wcag-standarden/wcag-standarden/86?f%5B0%5D=t1%3A206)).
- This document translates primary guidance into an engineering target; it is not legal advice or an accessibility conformance audit.
