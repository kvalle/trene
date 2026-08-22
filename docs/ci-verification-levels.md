# CI verification levels

CI places each check at the earliest lifecycle point where it addresses a unique
risk. `scripts/plan-ci.mjs` is the authoritative changed-path classifier, with
observable routing cases covered by `npm run test:ci-plan`.

| Level | Trigger | Purpose and unique risk | Reused result or artifact |
| --- | --- | --- | --- |
| Portable | Every CI run | Type errors, unit/integration regressions, routing validity, and qualification-record structure | One authoritative result per commit; release qualification validates this successful CI run |
| Android representative | Ordinary application changes | Common launch and workout persistence journey on the minimum supported API | The CI APK built once for the commit |
| Android full | Backup, database, persistence, Android native/file-flow, Maestro, dependency, or owning workflow changes | Complete backup, recovery, accessibility, and interruption behavior on API 34 | The same CI APK across all five suites |
| iOS representative | Ordinary application changes | Critical native restore integration without running every destructive scenario | The app is built once in the job |
| iOS full | Backup, database, persistence, iOS native/file-flow, Maestro, dependency, or owning workflow changes | Every supported iOS backup and restore journey on iOS 26 | One app build for the complete flow set |
| Release qualification | Intentional dispatch for an exact candidate commit | Maximum Android API boundary and both runtime-produced cross-platform semantic round trips | Successful CI result and its verified immutable Android APK |

Documentation-only changes do not run native jobs. Platform-owned changes run
only that platform unless they affect shared backup semantics or release
qualification. Obsolete pull-request runs are cancelled; intentional release
qualification runs are not.

At every package transfer, qualification verifies SHA-256, format and schema
versions, authoritative table counts, and the semantic digest. Synthetic package
artifacts have short retention. Failure diagnostics exclude backup archives,
SQLite databases, app containers, and user data. An infrastructure failure is a
failed gate, never accepted product evidence.

The supported publication path is `Publish qualified release`; it refuses to
create a GitHub release unless its referenced workflow run contains a successful
`Accept backup-enabled release` job. Before publication, manually dispatch `CI`
on the candidate ref to force complete
Android and iOS candidate coverage. Then dispatch `Backup release qualification`
on that ref with `candidate-commit` set to its full SHA and `ci-run-id` set to
that successful manual CI run. After recording the successful qualification
run in a later evidence-only commit, dispatch
acceptance from that evidence commit. Finally dispatch publication with the
candidate SHA, successful acceptance run ID, and release tag.
