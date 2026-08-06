# MVP qualification

This document is the qualification record for the MVP specification. Automated
checks run on every pull request; physical-device checks must be dated and
signed off here before an MVP release is declared accepted.

## Automated gates

| Gate | Environment | Evidence |
| --- | --- | --- |
| TypeScript, Jest/RNTL, and SQLite integration | Node 22 in GitHub Actions | `Typecheck and unit tests` job |
| Standalone Android APK | Universal Android release build, API 36 toolchain | `trene-android-apk` artifact with SHA-256 |
| Offline lifecycle | Pixel 2 emulator, Android API 34, networking disabled | `Android offline qualification` job |
| iOS buildability | iOS release configuration, simulator SDK | `iOS release build` job |

The Android qualification starts from cleared app data and covers create,
record, force-stop, resume, complete, workout history, and exercise history. It
runs the embedded JavaScript bundle without Metro. Runtime source has no network
client; `expo-sqlite` remains the sole durable data source.

## Scenario traceability

| Scenario | Automated evidence | Physical-device evidence required |
| --- | --- | --- |
| 1. First use | Offline qualification; workout and screen tests | Android and iOS core flow |
| 2. Suggested workout | `workouts.test.ts`, `WorkoutScreen.test.tsx` | Confirm editing and order on both platforms |
| 3. Set lifecycle | `start-workout.yaml`; workout database and screen tests | Restart and regrouping on both platforms |
| 4. Interleaved exercises | Workout database and screen tests | Multi-exercise core flow |
| 5. Recovery | Offline qualification; Home and Workout screen tests | Background, lock, and OS force-stop |
| 6. Invalid and failed save | Domain, database, and Workout screen tests | Screen-reader announcements and focus |
| 7. Completion | Offline qualification; workout database and screen tests | Planned-set warning and read-only result |
| 8. Cancellation | `start-workout.yaml`; workout database and screen tests | Empty and populated cancellation |
| 9. Deletion | Workout, exercise, and completed-workout tests | Destructive-dialog and fallback flow |
| 10. Names and search | Exercise domain, database, and list tests | Keyboard and screen-reader input |
| 11. Lists and empty states | History, exercise-list, picker, and database tests | Reading order and whole-row activation |
| 12. Presentation | Narrow-layout and semantic component tests | Full presentation/accessibility matrix below |
| 13. Offline delivery | Standalone APK and offline qualification | Clean install on physical Android |
| 14. Navigation | Navigation and focus component tests | Android Back, iOS gesture, scroll restoration |
| 15. Exercise safeguards | Creation, detail, and database tests | Screen-reader focus and retry |
| 16. Startup and loading failures | Startup gate and all screen failure tests | Announcements, focus, and retained data |

## Physical-device matrix

Record the device, OS version, date, tester, and result for every row. A blank
result is not a pass and blocks release acceptance.

| Platform | Configuration | Result | Device / OS / date / tester |
| --- | --- | --- | --- |
| Android | Smallest supported width; portrait and landscape | Pending | |
| Android | Light and dark; runtime theme change | Pending | |
| Android | 200% and maximum text | Pending | |
| Android | TalkBack reading/focus order and modal containment | Pending | |
| Android | External keyboard or Switch Access | Pending | |
| Android | Reduced motion; sound and haptics disabled | Pending | |
| Android | 48 dp targets, contrast, nonexclusive cues | Pending | |
| Android | Clean-install offline full lifecycle | Pending | |
| iOS | Smallest supported phone; portrait and landscape | Pending | |
| iOS | Light and dark; runtime theme change | Pending | |
| iOS | 200% and maximum Dynamic Type | Pending | |
| iOS | VoiceOver reading/focus order and modal containment | Pending | |
| iOS | External keyboard or Switch Control | Pending | |
| iOS | Reduce Motion; sound and haptics disabled | Pending | |
| iOS | 44 pt targets, contrast, nonexclusive cues | Pending | |
| iOS | Offline full lifecycle | Pending | |

For every destructive and simulated failure flow, verify retained data, manual
retry, announced status, expected focus, and absence of false navigation. The
release is qualified only when CI is green and no row above remains pending.
