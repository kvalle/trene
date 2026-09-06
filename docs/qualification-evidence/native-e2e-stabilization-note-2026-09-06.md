# Native E2E stabilization note, 2026-09-06

## Purpose

This note summarizes the stabilization work performed after the failed issue
#193 qualification, the failures observed during repeated hosted CI runs, and
the remaining distance to a stable native E2E matrix.

No further CI runs were started after run 34019236371 failed. The current branch
is `issue-193-verify-native-e2e-stability`, PR #199, at revision
`140445b5467a1297fd46e73ad0155e163abcf20d`.

## Changes made

- Committed the requested temporary CI artifact guidance separately in
  `4a726d7`.
- Added bounded acknowledgement for selected app navigation taps. A tap is
  repeated at most once, and only when the destination is absent while the
  source remains visible. Whole journeys are never retried.
- Added immediate, exact assertions after the iOS workout values `42.5` and `6`
  are entered, before the planned set is confirmed.
- Replaced multi-character setup names with verified one-character names. This
  keeps the restore precondition and retained-data assertions while avoiding the
  repeatedly demonstrated lossy multi-character XCTest input path.
- Avoided the contradictory `exercise-name-input` lookup by waiting for the
  create screen and focusing the known field position on the fixed hosted
  iPhone 16 target.
- Terminated Files before replacing Trene's simulator container so Files does
  not retain a reference to the previous app container.
- Kept file selection single-shot and preserved semantic destination checks in
  each calling app flow.
- Used the visible Files cancel control position instead of duplicate native
  `Cancel` accessibility nodes.
- Replaced the share-sheet `PopoverDismissRegion` selector with a tap on the
  visible background. Hosted evidence showed that the selector could report a
  completed tap while leaving the sheet open.
- Added script-level regression checks for these boundaries.

The implementation commits are:

- `7a3b912` - stabilize hosted iOS interactions.
- `285025d` - stabilize iOS share cancellation.
- `140445b` - avoid lossy iOS setup input.

## Local verification

The final revision passed:

- Typecheck.
- 386 Jest tests.
- 55 script and CI-planning tests.
- All eight allowlisted iOS broker flows on the same revision and worktree
  digest: `926d18db71857d15e5920b0ae82f16ad476c6984d7bedd5f7d99c1e8eab8d9b1`.

The local broker was useful for validating flow syntax and product behavior,
but it did not reproduce the hosted XCTest degradation under repeated,
multi-flow shards.

## Hosted CI timeline

### Revision `7a3b912`

- [33993467220](https://github.com/kvalle/trene/actions/runs/33993467220): passed.
- [33995577114](https://github.com/kvalle/trene/actions/runs/33995577114): passed.
- [33997461797](https://github.com/kvalle/trene/actions/runs/33997461797): passed.
- [33999087948](https://github.com/kvalle/trene/actions/runs/33999087948): failed only in iOS fail-safe. `PopoverDismissRegion`
  reported a completed tap, but the captured screenshot and hierarchy still
  showed the share sheet open.

The source changed after the fourth run, so the three preceding green runs no
longer counted toward final qualification.

### Revision `285025d`

- [34002329619](https://github.com/kvalle/trene/actions/runs/34002329619): passed.
- [34003995910](https://github.com/kvalle/trene/actions/runs/34003995910): failed only in iOS fail-safe. Maestro reported entering
  `Beholdes`; the failure hierarchy showed the input value was only `B`.

The source changed to remove this multi-character setup dependency, restarting
qualification again.

### Revision `140445b`

- [34011509458](https://github.com/kvalle/trene/actions/runs/34011509458): passed.
- [34012964084](https://github.com/kvalle/trene/actions/runs/34012964084): passed.
- [34014445482](https://github.com/kvalle/trene/actions/runs/34014445482): failed only in Android around-activation. The emulator and root
  readiness completed, but Maestro hung on the first `launchApp`, before product
  behavior ran.
- [34015930497](https://github.com/kvalle/trene/actions/runs/34015930497): passed.
- [34019236371](https://github.com/kvalle/trene/actions/runs/34019236371): failed only in iOS recovery. The complete `restore-failure` flow
  passed. The following `newer-backup` flow failed its initial Files-picker wait.
  Maestro claimed that none of `Browse`, `newer.trene-backup`, `On My iPhone`,
  or `No Recents` was visible, while its own captured hierarchy contained both
  `Browse`, `On My iPhone`, and `newer.trene-backup`.

The final revision therefore produced three complete green runs out of five,
but no sequence longer than two consecutive green runs. The latest attempted
qualification sequence ended with one green run followed by the iOS recovery
failure.

## Failure assessment

The changes materially improved the original failure mechanisms:

- Multi-character setup input loss was removed from the repeated restore flows.
- Numeric workout input is checked immediately and has passed both local and
  hosted runs since that check was added.
- The Files container has been found consistently after resetting Files state.
- Share cancellation passed after targeting the visible background.
- App navigation acknowledgement has worked in the observed final-revision
  runs.

The remaining hosted failures are primarily below the product-flow layer:

- XCTest/Maestro can return a negative lookup result that contradicts the
  hierarchy captured for the same failed command.
- A hosted Android emulator/driver can stall before the first product action.
- These failures are sparse and move between native-driver boundaries rather
  than clustering around one product assertion.

The latest iOS failure is particularly important: changing the Files selector
again would not address the evidence, because every expected selector was
present in the failure hierarchy. It points to degraded or inconsistent XCTest
query execution after several flows, not an incorrect selector.

## Distance to stable CI

The product journeys and deterministic test setup appear close to stable. All
eight broker flows pass on the final revision, and most hosted matrices pass
completely. The remaining gap is the hosted native-driver lifecycle, not a large
unfinished product change.

However, the acceptance criterion is not close in an evidence sense: the final
revision has not achieved five consecutive complete green runs, and the latest
attempt failed. More blind repetition is unlikely to be an efficient next step.

The next investigation should focus on one boundary at a time:

1. Capture per-flow XCTest query latency and driver logs, especially before the
   second flow in a shard.
2. Determine whether a fresh simulator or driver per iOS flow removes the
   contradictory hierarchy lookup without reusing the previously unsuccessful
   ready-driver experiment.
3. Reproduce the `newer-backup` picker entry as a focused hosted job or collect
   equivalent repeated broker evidence before another full five-run attempt.
4. Treat the Android first-launch stall separately; one isolated pre-product
   failure does not currently justify redesigning the Android flows.

Assessment: the flow-level work is mostly complete, but one additional focused
driver-lifecycle experiment is likely needed before another qualification
attempt. If that experiment identifies a reliable isolation boundary, the
remaining work is probably small. If contradictory XCTest lookups continue even
with per-flow isolation, achieving five consecutive hosted runs may require a
runner or Maestro-version strategy rather than further YAML changes.

## Policy decision

After reviewing this evidence, the project stopped using hosted iOS E2E as an
automatic pull-request gate. Android E2E remains in automatic pull-request CI.
The complete iOS E2E matrix remains available as a manually dispatched GitHub
Actions workflow, while pull requests explicitly record that all relevant iOS
broker flows passed locally or explain why they are not applicable.

This preserves the iOS journeys and an on-demand hosted diagnostic path without
letting known hosted XCTest/Maestro instability create routine pull-request
failures. Reintroducing automatic iOS PR execution should require new evidence
that the native-driver lifecycle is stable enough to be actionable.
