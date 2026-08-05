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

Cold-cache and reused-APK timings will be recorded here from the pull request CI
runs before this change is retained.

[baseline]: https://github.com/kvalle/trene/actions/runs/30942455877
