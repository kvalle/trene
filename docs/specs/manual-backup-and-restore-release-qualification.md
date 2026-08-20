# Manual backup and restore release qualification

The `Backup release qualification` workflow is the mandatory automated gate for a backup-enabled release. Run it with `workflow_dispatch` before publishing a release. Missing, cancelled, infrastructure-failed, or product-failed jobs leave qualification unresolved; only a completely successful run qualifies the automation covered here.

## Automated evidence

| Scenario | Required job | Safe evidence |
| --- | --- | --- |
| Android to iOS to Android | `Android produces A-I-A package`, `iOS restores A-I-A package`, `Android completes A-I-A cycle` | Package SHA-256 at each transfer; format/schema versions; all authoritative table counts; semantic digest |
| iOS to Android to iOS | `iOS produces I-A-I package`, `Android restores I-A-I package`, `iOS completes I-A-I cycle` | Package SHA-256 at each transfer; format/schema versions; all authoritative table counts; semantic digest |
| Oldest and newest supported Android | `Android supported OS (API 24)`, `Android supported OS (API 36)` | Runtime scenario, API level, format/schema versions, stage, counts, Maestro logs and screenshots on failure |
| Oldest and newest supported iOS | `iOS supported OS (16.4)`, `iOS supported OS (26)` | Runtime scenario, OS version, format/schema versions, stage, counts, Maestro logs and screenshots on failure |

Runtime-produced packages contain deterministic synthetic workout data only. Package artifacts are retained for one day and are never included in failure diagnostics. Metadata and diagnostics are retained for seven days and exclude raw package and database contents.

Relevant merges to `main` trigger this workflow through explicit paths covering backup, database, migration/persistence, native configuration, dependencies, native flows, scripts, and workflow definitions. Manual release dispatch ignores path filters and runs the complete matrix.

## Release record

Record the successful workflow URL, commit SHA, app version, backup format version, schema version, execution date, and tester in the release qualification record. Performance, physical-device, interruption, accessibility, and residual-risk evidence required for first-release acceptance is completed by issue #131.
