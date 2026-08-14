# Manual Backup and Restore Specification

## Problem Statement

Trene stores all workout data locally. Users currently have no supported way to preserve that data outside the app, move it to another device or platform, or recover it after reinstalling or replacing a device. A raw database export would not provide a safe product capability: backups must remain portable and restorable as Trene evolves, imported files must be treated as untrusted, and a failed or interrupted restore must never silently damage or partially replace current data.

## Solution

Add a dedicated Data page under Settings where users can manually create and restore a portable `.trene-backup` file through the operating system's sharing and file-selection surfaces.

A backup is a validated, versioned ZIP package containing a manifest and an authoritative, consistent SQLite snapshot. Trene validates every package it creates before offering it through the system share surface.

A restore copies the selected file into app-controlled storage, validates it without modifying live data, migrates it in staging when necessary, and previews its creation time and content counts. After explicit destructive confirmation, Trene creates a verified internal rollback snapshot and atomically replaces all persistent data. It reopens and validates the active database before declaring success. Failure or interruption must either recover the completed restore or return to the verified original data. If neither state can be proven valid, Trene stops safely instead of opening a database of unknown state.

The same backup format and compatibility rules apply on Android and iOS. Every valid backup from a publicly released backup-enabled Trene version remains forward-restorable without a time limit.

## User Stories

1. As a Trene user, I want to open a dedicated Data page from Settings, so that backup and restore actions are easy to find without cluttering normal workout flows.
2. As a Trene user, I want to create a backup manually, so that I can preserve all persistent workout data when I choose.
3. As a Trene user, I want the backup to include every exercise, workout, workout exercise, set, and future persistent component declared by the format, so that restoring it recreates my complete persistent data.
4. As a Trene user, I want Trene to create a consistent snapshot while the database uses WAL, so that the backup cannot omit recent committed data or combine inconsistent database states.
5. As a Trene user, I want Trene to validate a newly created backup before sharing it, so that it does not offer a file it cannot restore.
6. As a Trene user, I want to choose where to save or share the backup through the operating system, so that I control its destination.
7. As a Trene user, I want Trene to avoid claiming that a shared backup was saved, so that the app does not misrepresent an outcome it cannot observe.
8. As a Trene user, I want to be told that the backup contains workout data and is not app-encrypted, so that I can choose an appropriate storage location.
9. As a Trene user, I want cancelling the system sharing surface to return me safely to Data, so that cancellation is not treated as a failure or success.
10. As a Trene user, I want interrupted backup creation to leave my current data untouched, so that creating a backup cannot damage the app database.
11. As a Trene user, I want abandoned temporary backup files cleaned up after restart, so that interrupted exports do not consume storage indefinitely.
12. As a Trene user, I want to select a `.trene-backup` file through the operating system, so that I can restore a backup from any available file provider.
13. As a Trene user, I want cancelling file selection to return me safely to Data, so that I can change my mind without side effects.
14. As a Trene user, I want the selected file copied to app-controlled staging before inspection, so that restore does not depend on continued access to an external file provider.
15. As a Trene user, I want imported files treated as untrusted regardless of extension or MIME type, so that malformed or hostile files cannot compromise my data or device.
16. As a Trene user, I want Trene to reject damaged or modified backup components, so that corrupt data is not restored.
17. As a Trene user, I want Trene to reject unsafe archive paths, duplicate entries, undeclared files, symbolic links, encrypted entries, and dangerous expansion behavior, so that opening a backup is bounded and safe.
18. As a Trene user, I want Trene to reject unsupported mandatory data while safely ignoring only explicitly optional extensions, so that restore never silently loses persistent data.
19. As a Trene user, I want Trene to verify SQLite integrity, foreign keys, schema, constraints, indexes, triggers, and domain semantics before restore, so that only a valid database can replace my data.
20. As a Trene user, I want Trene to reject invalid timestamps, names, positions, statuses, references, or set values rather than guessing or repairing them, so that restore preserves data meaning.
21. As a Trene user, I want to see the backup creation time and workout and exercise counts before restoring, so that I can verify that I selected the intended backup.
22. As a Trene user, I want preview counts derived from the validated database rather than trusted manifest text, so that the preview describes what will actually be restored.
23. As a Trene user, I want to cancel after previewing a backup, so that inspection never obliges me to replace my data.
24. As a Trene user, I want a separate destructive confirmation showing the current workout and exercise counts that will be replaced, so that the consequence is explicit.
25. As a Trene user, I want backup creation to remain a separate action rather than an extra restore step, so that the restore journey stays clear and predictable.
26. As a Trene user, I want restore to replace all persistent data rather than merge it, so that the resulting app state exactly represents the selected backup.
27. As a Trene user, I want restore to remove data that existed only before restore, so that no stale records survive replacement.
28. As a Trene user, I want restore to avoid duplicate imported records, so that repeated or cross-platform restore does not alter the backup's meaning.
29. As a Trene user, I want current in-memory drafts and stale navigation state discarded after successful restore, so that the UI cannot write pre-restore state into the restored database.
30. As a Trene user, I want Trene to migrate an older supported backup in staging before replacement, so that backups remain useful after app upgrades.
31. As a Trene user, I want every migration step to preserve all persistent data and meaning, so that compatibility does not silently discard information.
32. As a Trene user, I want a newer backup rejected by an older app with guidance to update Trene, so that an unsupported downgrade is not attempted.
33. As a Trene user, I want backups created on Android to restore on iOS, so that I can change platforms.
34. As a Trene user, I want backups created on iOS to restore on Android, so that portability works in both directions.
35. As a Trene user, I want every valid public backup version to remain restorable in future releases, so that backups do not expire as Trene evolves.
36. As a Trene user, I want Trene to preserve my current data automatically before replacement, so that a restore failure can roll back without requiring me to manage an extra backup.
37. As a Trene user, I want the internal rollback mechanism hidden during normal operation, so that implementation details do not complicate the restore journey.
38. As a Trene user, I want an invalid or pre-commit failed restore to leave current data unchanged, so that inspection and migration are non-destructive.
39. As a Trene user, I want a post-commit verification failure to restore my verified original data, so that a bad replacement does not become active.
40. As a Trene user, I want an interrupted restore to recover deterministically on next startup, so that process termination cannot leave a partially decided state.
41. As a Trene user, I want Trene to stop safely if both restore and rollback fail, so that it does not open and mutate a database whose state is unknown.
42. As a Trene user, I want successful restore feedback to report restored counts, so that I can confirm the result.
43. As a Trene user, I want restore failure feedback to state that no data was replaced and report my retained counts when that state is verified, so that I know my current data is safe.
44. As a Trene user, I want actionable failure categories such as damaged backup, newer Trene required, or insufficient storage, so that I know what I can do next.
45. As a Trene user, I want technical details retained locally without exposing raw SQL or file contents in the UI, so that diagnosis is possible without overwhelming me or leaking data.
46. As a keyboard, switch-control, screen-reader, or TalkBack/VoiceOver user, I want backup and restore controls to have correct names, roles, reading order, focus, and disabled states, so that I can complete the journey safely.
47. As an assistive-technology user, I want focus moved to previews, confirmations, success, and errors at the right time, so that important state changes are announced and understandable.
48. As an assistive-technology user, I want the destructive nature of restore communicated explicitly, so that confirmation is as safe for me as for a sighted touch user.
49. As a maintainer, I want backup and restore coordinated behind one service boundary, so that UI code cannot accidentally sequence destructive database operations.
50. As a maintainer, I want one owner of the active database connection, so that backup and restore can exclude concurrent work and safely replace and reopen the database.
51. As a maintainer, I want backup validation to share domain validity rules with normal persistence, so that restore acceptance cannot drift from data the app relies on.
52. As a maintainer, I want every released format and schema represented by immutable synthetic fixtures, so that indefinite compatibility is continuously verifiable.
53. As a maintainer, I want failures injectable after every durable operation stage, so that rollback and startup recovery are proven rather than assumed.
54. As a maintainer, I want fast semantic round-trip and failure tests on every PR commit, so that most regressions are caught cheaply and early.
55. As a maintainer, I want Android native smoke on PRs, so that the complete app journey receives regular device-runtime coverage.
56. As a maintainer, I want expensive iOS and cross-platform flows restricted to relevant merges and releases, so that verification remains affordable without abandoning essential coverage.
57. As a maintainer, I want failed native runs to retain safe diagnostics, versions, counts, logs, and screenshots without raw backup data, so that failures can be investigated without exposing user information.

## Implementation Decisions

- Add a dedicated Settings area with a Data page. The page always offers separate Create backup and Restore from file actions. It uses normal platform navigation, including the iOS stack back control and Android system back behavior.
- A backup is a restorable snapshot, not a human-readable export. Its file extension is `.trene-backup`.
- The portable representation is a versioned ZIP container. It contains exactly one `manifest.json`, exactly one authoritative `database.sqlite`, and only explicitly declared and understood optional components. The structure permits future permanent media components without making them part of the first release.
- The manifest records package format version, SQLite schema version, producing app version for diagnostics, creation time, component paths and types, byte sizes, SHA-256 digests, and row counts for every authoritative table. Format and schema versions are independent monotonically increasing integers; app version never determines compatibility.
- The first release guarantees integrity, not producer authenticity. Matching SHA-256 digests detect corruption or modification but do not prove that Trene created a package.
- Package inspection rejects duplicate entries, absolute or traversing paths, symbolic links, encrypted entries, undeclared entries, and unknown mandatory components. Unknown manifest data is accepted only in an explicitly optional, namespaced extension that can be ignored without losing or changing persistent user data.
- Archive extraction is streaming and bounded by adjustable implementation limits for manifest size, entry count, path depth, expansion ratio, and bytes processed. The file format does not impose a permanent maximum total backup size; safely available storage is the practical limit.
- Backup creation uses a WAL-consistent SQLite snapshot rather than direct database-file copying. It coordinates exclusive application access, writes the package to temporary app-controlled storage, reopens the completed package, and passes it through the same package, digest, SQLite, schema, semantic, and count validation used for imports before offering it to the operating system.
- The operating system sharing surface chooses the destination. Returning from that surface means only that sharing ended; Trene must not report that the user saved the file.
- Restore file selection uses the operating system document picker. The selected file is copied into app-controlled staging before parsing or validation. Cancellation is a normal outcome, not an error.
- SQLite inspection initially opens an imported database in isolation and read-only where supported, with trusted-schema behavior disabled where supported. It verifies SQLite integrity, foreign-key integrity, declared supported schema version, and that version's exact expected schema objects, columns, types, nullability, keys, indexes, triggers, and constraints.
- Persistent-data inspection is a shared application capability rather than restore-only logic. It validates the domain invariants normal persistence relies on, including valid and ordered timestamps, normalized exercise names, contiguous positions, consistent workout and set statuses, references, loads, repetitions, and confirmation state. Validation rejects invalid data without guessing, dropping, rewriting, or repairing it.
- The manifest's authoritative table counts are compared before migration. User-facing workout and exercise preview counts are independently derived from the validated database. Migrated authoritative and preview counts are retained for post-commit verification.
- Every valid backup produced by a publicly released backup-enabled Trene version remains restorable without a time limit. Corrupt, manually modified, and development-build artifacts are outside this guarantee.
- Android and iOS use one platform-neutral backup format and compatibility policy. Any future platform-specific persistent state must have a platform-neutral backup representation.
- Restore supports only forward migration. Every release retains a complete, tested migration chain from each previously public supported format and schema to the current versions. It never exports an old format or downgrades a database.
- Source validation occurs against the source schema before migration. Each migration step runs only in staging and is followed by integrity, foreign-key, exact-schema, semantic, and count validation for the resulting schema. A failed or lossy step rejects the complete restore, skips no steps, leaves the imported artifact untouched, and leaves live data unchanged.
- An older app rejects a package with a newer format or schema and tells the user to update Trene. It never performs a best-effort restore.
- Restore has distinct preparation and commit phases. Preparation stages, inspects, migrates, and validates without changing live data, then returns creation time and content counts for preview. Commit begins only after a separate destructive confirmation showing current counts that will be replaced.
- Restore replaces all persistent data atomically; it never merges or selectively restores. Before replacement, Trene creates and verifies a durable internal rollback snapshot and durable operation marker. The internal snapshot is not offered as a user-managed backup.
- One database runtime owns the active database connection. It gates all database operations, enters exclusive maintenance for snapshot and restore work, closes and replaces connections safely, and exposes a new database generation after verified activation. Existing persistence operations may retain function-oriented interfaces but must not retain independently replaceable native handles across a restore.
- A database lifecycle boundary owns opening, configuring, migrating, and closing live and staged databases. The same ordered migration implementation serves startup upgrades and staged restore.
- A platform SQLite adapter owns consistent snapshot and online replacement behavior. Expo-specific backup APIs, WAL coordination, native locking, and low-level replacement are kept out of the portable SQL query interface.
- A package codec exclusively owns ZIP and manifest creation and inspection, component declarations, digests, and archive safety. It does not migrate or mutate live data.
- A platform file-flow adapter exclusively owns system sharing, document selection, cancellation, and copying imports to private staging.
- A backup and restore service is the primary application and test seam. It coordinates package creation, restore preparation, restore commit, durable operation stages, rollback, cleanup, user-safe failure categories, and startup recovery. UI code does not sequence database snapshots, migrations, replacement, or rollback.
- After replacement, Trene reopens the active database and repeats SQLite integrity, foreign-key, current-schema, semantic, migrated-table-count, and preview-count checks. It does not repeat original package hashes against the migrated active database.
- The rollback snapshot records byte size, SHA-256 digest, schema version, and table counts when created. Trene verifies these before rollback and performs full database, schema, semantic, and count validation after rollback becomes active.
- A successful restore removes the rollback snapshot and marker only after verified activation and application remount. A failed restore reports unchanged data only when rollback or non-replacement has proven that state.
- Startup checks the durable operation marker before exposing the app. It deterministically completes verification, cleanup, or rollback according to the recorded stage. If neither the restored nor rollback database can be verified, startup enters a non-retry safe-stop state, preserves recovery artifacts and diagnostics, and does not open an unknown database for normal use.
- Successful restore starts a fresh data-dependent application session. It clears in-memory workout drafts, stale navigation history, retained route identifiers, and screen-local state before exposing the restored database. Automatic rollback mechanics remain hidden from the normal user journey.
- Backup and restore expose short non-interactive busy states. Navigation and repeated actions are prevented while destructive work is active.
- Failures map to safe actionable categories, including damaged or modified backup, newer Trene version required, insufficient storage, failed restore with verified unchanged data, and unrecoverable safe stop. Exact checks, components, SQL, and technical causes remain in local diagnostics.
- App-level encryption and password protection are not included. The Data page explains that backup files contain workout data.
- The implementation must account for the SQLite version used by the selected Expo SDK and must not ship with an unresolved WAL-reset race affecting snapshot or replacement correctness.

## Testing Decisions

- Tests assert externally meaningful outcomes: complete semantic data, user-visible state, durable recovery state, and safe replacement. They do not assert SQLite file-byte identity, internal row storage order, private helper calls, or migration metadata unless that metadata is itself part of the compatibility contract.
- The highest test seam is the backup and restore service. Real-SQLite integration tests drive source data through package creation, package inspection, staged restore, migration, replacement or rollback, and semantic comparison of every authoritative table and domain value.
- Package codec tests generate synthetic archives and cover manifest parsing, format compatibility, digests, duplicate entries, traversal and absolute paths, undeclared and mandatory components, optional extensions, encryption, symlinks, entry and path limits, expansion limits, malformed ZIPs, and bounded processing.
- Database inspection and migration tests use real temporary or in-memory SQLite databases, following existing database test precedent. They cover exact schemas, SQLite and foreign-key integrity, every domain invariant, every historical migration step, durable reopen, and rejection without silent repair.
- Snapshot and replacement adapter tests cover WAL-consistent export, exclusive coordination, online replacement, transient failures, close/reopen behavior, and fault injection. Native-specific APIs are tested behind this adapter rather than added to every portable database fake.
- Service integration tests cover empty, small representative, rich edge-case, and large deterministic synthetic datasets. Restore runs both into an empty database and over different existing data, proving full replacement with neither stale nor duplicate rows.
- Every publicly released format and schema combination has immutable synthetic fixtures, including representative and rich edge-case data. Current code restores every historical fixture on each PR. A new public format or schema cannot merge without its fixtures and complete migration coverage.
- Failure injection runs before and after every durable restore stage: staging, package and database validation, every migration, rollback-snapshot creation and verification, live replacement, active-database reopening, post-commit validation, rollback, and cleanup. Every result is either a complete verified restore, verified intact original data, or the explicitly tested safe-stop state.
- Backup failure injection covers every durable creation stage. Interrupted pre-share export is never considered created or offered, and startup cleanup leaves live data unchanged.
- Simultaneous restore and rollback failure is tested at service/integration level. It must preserve the marker, diagnostics, and recovery artifacts; reject normal database use; and enter safe stop.
- Startup and application-session component tests cover marker recovery, normal retryable startup failure, non-retry safe stop, database generation changes, clearing in-memory workout drafts, navigation reset, and exposure of only the verified database.
- Data-page component tests follow existing React Native Testing Library patterns for repository failures, busy-state navigation prevention, destructive confirmation, alerts, announcements, and accessibility focus. They cover backup return without claiming save success; picker and sharing cancellation; preview and current counts; confirmation; success; all safe error categories; disabled actions; and repeated-action prevention.
- Accessibility tests verify accessible names and roles, reading order, focus after transitions and errors, announcements, disabled controls during work, and explicit destructive confirmation. Native smoke verifies the resulting platform accessibility tree for representative flows.
- Every PR commit runs fast unit, real-SQLite integration, migration, historical-fixture, semantic round-trip, and failure-injection tests.
- Android backup and restore joins the existing Maestro smoke suite on one stable Android configuration for each PR. Native smoke focuses on system file integration, real database persistence and remount, and the complete user journey rather than duplicating exhaustive package validation.
- Representative native force-stop tests interrupt restore before replacement, around activation of the new database, and after replacement before cleanup. Next startup must deterministically complete or roll back. Backup receives at least one native force-stop and cleanup scenario. The simultaneous restore-and-rollback failure receives native coverage before the first backup-enabled release but is not part of ordinary smoke.
- Expensive macOS/iOS and cross-platform jobs run after merge to `main` when explicit path filters identify changes to backup, database, migration, persistence, native configuration, dependencies, or the workflows themselves. Workflow changes also trigger them. The complete matrix runs before release regardless of path filters.
- Automated iOS simulator restore is mandatory. After relevant merges and before release, native coverage includes the newest and oldest supported Android and iOS versions. OS integration changes receive expanded coverage.
- Before release, actual files complete Android to iOS to Android and iOS to Android to iOS cycles. Data is checked after every restore, not merely after import acceptance. Jobs exchange only synthetic, short-lived artifacts and verify SHA-256 digest between platforms.
- Physical Android verification is required before the first backup-enabled release and after relevant changes to file handling, database lifecycle, or native integration. Physical iOS verification is strongly preferred but may be deferred when no device is available if residual risk is recorded explicitly. Later physical verification is risk-based rather than required for every unrelated release.
- Native flows cover cancelled selection and sharing, damaged backup, newer Trene required, insufficient storage, restore failure, and rollback failure, asserting both user messaging and resulting data state.
- Large-dataset qualification establishes measurable limits for backup creation, validation, restore, temporary storage, and startup recovery. Limits are calibrated on the slowest supported device class before the first release rather than guessed in this specification.
- Required test failures block release. Infrastructure failures leave the result unresolved and may be rerun. An initial failure cannot be accepted as flaky until its cause is understood and the test or product is corrected.
- Failed runs retain scenario, platform and OS, backup and schema versions, safely identified durable stage, logs, screenshots, and relevant counts. CI artifacts never contain real user data or raw backup contents.
- Existing prior art includes real `node:sqlite` database tests for migrations, constraints, rollback, durable reopen, and persistence semantics; React Native Testing Library screen tests for failures, confirmations, navigation blocking, announcements, and focus; StartupGate tests for loading, failure, and retry; and Android Maestro flows for persistent state across force-stop and relaunch.

## Out of Scope

- Automatic or scheduled backups.
- Backup reminders.
- Cloud accounts or Trene-managed remote storage.
- Multi-device synchronization and conflict resolution.
- App-level encryption or password protection of backup files.
- Proving that a backup package was produced by an authentic Trene installation.
- Selective backup or selective restore.
- Merging backup data with current data.
- Restoring a newer backup into an older app or otherwise downgrading format or schema.
- Human-readable data export and import.
- User management of the internal rollback snapshot.
- Permanent support guarantees for corrupt, manually modified, or development-build backup artifacts.

## Further Notes

- This specification supersedes the MVP specification's exclusion of backup and restore, but does not otherwise expand the MVP feature set.
- The resolved Wayfinder map is [Specify cross-platform manual backup and restore](https://github.com/kvalle/trene/issues/109). Its child decisions remain the detailed source for file capabilities, SQLite snapshot and replacement, package representation, restore safety, compatibility, validation, user journey, and verification strategy.
- The validated user journey has a throwaway prototype linked from [Specify the backup and restore user journey](https://github.com/kvalle/trene/issues/114).
- The current application has no Settings screen, no replaceable database runtime, no startup recovery marker, and no iOS runtime automation. These are implementation work, not reasons to weaken the behavior specified here.
