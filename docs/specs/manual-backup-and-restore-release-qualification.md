# Manual backup and restore release qualification

The complete first-release scenario map, physical procedure, performance
method, and versioned evidence record are maintained in
[`manual-backup-and-restore-qualification.md`](manual-backup-and-restore-qualification.md).

The `Backup release qualification` workflow is the mandatory automated gate for a backup-enabled release. First dispatch `CI` on the exact release-candidate commit to force complete native candidate coverage. Then run release qualification from that commit and supply its full SHA and the successful manual CI run ID. Missing, cancelled, infrastructure-failed, or product-failed jobs leave qualification unresolved; only a completely successful run qualifies the automation covered here.

## Automated evidence

| Scenario | Required job | Safe evidence |
| --- | --- | --- |
| Android to iOS to Android | `Android produces A-I-A package`, `iOS restores A-I-A package`, `Android completes A-I-A cycle` | Package SHA-256 at each transfer; format/schema versions; all authoritative table counts; semantic digest |
| iOS to Android to iOS | `iOS produces I-A-I package`, `Android restores I-A-I package`, `iOS completes I-A-I cycle` | Package SHA-256 at each transfer; format/schema versions; all authoritative table counts; semantic digest |
| Oldest and newest supported Android | Full CI qualification on API 34; `Android maximum supported OS (API 36)` | Runtime scenario, API level, format/schema versions, stage, counts, Maestro logs and screenshots on failure |
| Supported iOS | Full CI qualification on iOS 26 and both cross-platform cycles | Runtime scenario, OS version, format/schema versions, stage, counts, Maestro logs and screenshots on failure |

Runtime-produced packages contain deterministic synthetic workout data only. Package artifacts are retained for one day and are never included in failure diagnostics. Metadata and diagnostics are retained for seven days and exclude raw package and database contents.

The workflow does not run after a merge or publication. Its release-specific work reuses the authoritative portable result and immutable Android APK from the supplied successful CI run. It verifies the CI run commit, status, artifact presence, embedded commit and run identity, and APK SHA-256 before use. API 34 and full native backup coverage belong to relevant CI runs; release qualification adds only the distinct API 36 boundary and the two cross-platform cycles. The sole supported iOS runtime is therefore not repeated in a separate one-entry matrix.

Release publication is intentionally dispatched through `Publish qualified release`. The operator must complete qualification, update the versioned record with its successful run, and dispatch acceptance for that same candidate before providing the acceptance run ID to publication. The publication workflow verifies that the acceptance job succeeded and that only evidence changed after the candidate. There is no post-publication workflow presented as a preventive gate.

## Release record

Record the successful workflow URL, commit SHA, app version, backup format version, schema version, execution date, and tester in the release qualification record. Performance, physical-device, interruption, accessibility, and residual-risk evidence required for first-release acceptance is completed by issue #131.
