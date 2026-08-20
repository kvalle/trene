# Manual backup and restore qualification

This is the first-release qualification plan and evidence index for the manual
backup and restore specification. The machine-readable release record lives in
[`manual-backup-and-restore-qualification.json`](manual-backup-and-restore-qualification.json).
`npm run qualify:backup:record` checks its shape during development; the
`Backup release qualification` workflow applies the stricter release check and
does not accept pending, failed, or incomplete evidence.

## Scenario traceability

| Specification scenarios | Required automated gate | Required physical or measured evidence |
| --- | --- | --- |
| Discovery, backup creation, WAL consistency, validation, sharing, cancellation, disclosure, and cleanup (stories 1-11) | Unit and real-SQLite integration tests; Android and iOS native file-flow suites | Physical Android backup and share/cancel flow; large-dataset creation, validation, and peak temporary-storage measurements |
| Selection, staging, hostile package rejection, database and semantic validation, preview, and cancellation (stories 12-23) | Package-codec, database-inspection, restore-preparation, Android, and iOS suites | Physical Android picker/cancel/damaged-package flow; large-dataset validation and temporary-storage measurements |
| Destructive confirmation, replacement, fresh session, migration, and forward compatibility (stories 24-35) | Restore commit and migration tests; Android and iOS restore; Android-to-iOS-to-Android and iOS-to-Android-to-iOS release cycles | Physical Android restore over different current data; measured large-dataset restore time |
| Rollback, interruption recovery, safe stop, and user-safe outcomes (stories 36-45) | Failure-injection tests; native interruption suites; native simultaneous restore-and-rollback failure | Physical Android interruption and safe-stop flows; measured startup recovery; retained recovery marker and rollback artifact evidence |
| Accessibility (stories 46-48) | RNTL accessibility checks and native semantic smoke | Physical Android TalkBack names, reading/focus order, disabled states, preview, destructive confirmation, success, and error announcements |
| Ownership, lifecycle, compatibility fixtures, and verification policy (stories 49-57) | Typecheck/unit/integration CI, historical fixtures, supported-OS matrix, and cross-platform cycles | Versioned qualification record, performance environment, physical Android sign-off, and physical iOS sign-off or accepted residual risk |

## Performance method

Performance qualification uses deterministic synthetic data only. Record the
dataset counts and byte sizes, device model and OS, app/format/schema versions,
APK SHA-256, date, tester, battery and thermal conditions, and at least three
measured runs after one warm-up. The slowest supported device class is the
lowest-performance physical device on which Trene supports installation; name
that device explicitly rather than substituting an emulator profile.

Measure and set observed release limits for:

- backup creation from action to share surface;
- selected-package validation from picker return to preview;
- restore from destructive confirmation to ready application state;
- peak app-controlled temporary storage during backup and restore;
- startup recovery from launch to verified ready state after interruption.

The safe Android automation trace contains stage names and timestamps only.
Storage sampling records byte counts, not file names or contents. Qualification
must not retain a raw `.trene-backup`, SQLite database, exercise name, or other
user data as evidence. Safe references are limited to GitHub Actions run/job
URLs and committed files under `docs/qualification-evidence/`.

## Physical Android procedure

Use the APK identified by the release record and a physical device selected by
ADB. Set `ANDROID_SMOKE_APK` to the exact qualification APK, then run
`npm run qualify:backup:android` to install it, capture the safe environment,
and print the guided checks. Manual TalkBack checks are required even when Maestro
semantic smoke passes. Record each scenario separately; one successful happy
path is not evidence for cancellation, interruption, safe stop, or accessibility.
Automated interruption and retained-artifact checks require either a debuggable
qualification build (so ADB `run-as` is available) or a rootable test device.

## Physical iOS decision

Physical iOS is preferred. If no device is available, the record must instead
contain an explicit accepted residual risk with reason, impact, simulator
evidence, mitigation, owner, acceptance date, and the condition that triggers
follow-up physical testing. A blank physical result is not a deferral.

## Release acceptance

The release is accepted only when:

- the complete automated release workflow succeeded for the recorded commit;
- every Android physical scenario passed on the recorded device and APK;
- every performance measurement has observations and an accepted measured limit;
- physical iOS passed, or the complete residual risk was explicitly accepted;
- native simultaneous restore-and-rollback failure reached safe stop and proved
  that both the durable operation marker and rollback snapshot remained;
- every evidence reference points to safe metadata, logs, or screenshots and
  not to a raw package, database, or real user data.
