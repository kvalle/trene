# Android smoke timings

Issue #93 separates debug APK compilation from emulator and Maestro execution so
that CI can reuse the APK while its native inputs remain unchanged.

## Baseline

The last successful run before this change was [CI run 30942455877][baseline]
on 4 August 2026. Its combined `Build app and run smoke tests` step took 12m23s,
and the complete Android smoke job took 13m43s. APK compilation was not a
separate step, but Gradle reported 7m03s for its build within that combined
step.

## Results

The successful cold-cache [CI run 30984557762][cold] on 5 August 2026 built the
APK in 9m37s. The complete APK job took 11m08s, and the separate smoke job took
6m22s. The smoke job installed that artifact and passed both existing Maestro
flows.

The documentation-only [CI run 30985801317][reused] restored the compatible APK
and skipped compilation. The APK job fell from 11m08s to 58s, while the smoke
job took 6m07s and passed both flows again. End-to-end elapsed time after the
unit-test gate fell from 13m43s at baseline to 7m08s with APK reuse, a 48%
improvement. The cold path remains slower because its build and smoke jobs are
sequential, but it is only used after a native-input change or an APK cache
miss. No new smoke-test flakiness was observed across the cold and reused-APK
runs, so the change is retained.

[baseline]: https://github.com/kvalle/trene/actions/runs/30942455877
[cold]: https://github.com/kvalle/trene/actions/runs/30984557762
[reused]: https://github.com/kvalle/trene/actions/runs/30985801317
