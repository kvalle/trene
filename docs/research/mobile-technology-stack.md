# Mobile technology stack for Trene

Research for [GitHub issue #55](https://github.com/kvalle/trene/issues/55), based on official documentation available 2026-08-02.

## Scope and criteria

The fixed requirements are one codebase for Android and iOS, Android as the primary test platform, direct APK distribution during the MVP, fully local/offline data, reliable persistence of an active treningsøkt, silent haptics, system light/dark theme, accessibility, Norwegian UI, and a future path to backup/restore.

This review compares Expo/React Native and Flutter. Compose Multiplatform is included because it now supports shared UI on Android and iOS; native Kotlin plus Swift and web/PWA approaches are excluded because they do not meet the one-mobile-codebase requirement as directly, while .NET MAUI is not compelling here without an existing .NET constraint.

## Concise recommendation

**Recommendation:** Use **Expo with React Native and TypeScript**, `expo-sqlite` as the only durable application store, and EAS/Gradle APK builds. Persist every accepted workout mutation immediately in a SQLite transaction; do not treat React state or a key-value store as the authoritative active-workout state. Use Jest plus React Native Testing Library for logic/components, real-SQLite tests and Maestro end-to-end tests on Android, and a smaller iOS device/simulator regression pass.

Flutter is a sound fallback, not a deficient option. Choose it instead if the team is materially stronger in Dart/Flutter or a short prototype shows that Flutter's rendered-widget consistency and integrated widget-testing model outweigh TypeScript/React familiarity. Compose Multiplatform should not be selected for this MVP without a specific Kotlin/Compose advantage.

## Facts from primary sources

### Expo/React Native

- React Native supports common features across native platforms, and its own documentation recommends using a framework such as Expo for new applications. Expo supports Android and iOS and supplies native modules and development tooling ([React Native: Get Started](https://reactnative.dev/docs/environment-setup)).
- Expo can produce an installable APK by setting `android.buildType` to `apk` (or using an internal/development profile); an APK can be downloaded directly on a device or installed with `adb`. The normal production default is an AAB, which cannot be installed directly ([Expo: Build APKs](https://docs.expo.dev/build-reference/apk/)). EAS Build is a cloud compile/sign service ([Expo: EAS](https://docs.expo.dev/eas/)), but the EAS build process can also run with `eas build --platform android --local`, and development builds can be compiled with `npx expo run:android` ([Expo: local EAS builds](https://docs.expo.dev/build-reference/local-builds/)).
- `expo-sqlite` supports Android and iOS, persists its database across application restarts, exposes parameter-bound queries and transactions, and can serialize a database to a `Uint8Array` ([Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)). SQLite transactions are atomic, consistent, isolated, and durable even across application, operating-system, and power failures ([SQLite: transactional guarantees](https://www.sqlite.org/transactional.html)).
- React Native exposes Android TalkBack/iOS VoiceOver semantics including labels, hints, roles, state, values, actions, and Android live regions; the documentation explicitly calls for testing TalkBack and VoiceOver ([React Native accessibility](https://reactnative.dev/docs/accessibility)). Its `Appearance` API and `useColorScheme` expose the current light/dark system preference and runtime changes ([React Native Appearance](https://reactnative.dev/docs/appearance)).
- `expo-haptics` provides Android haptic-engine/vibration effects and the iOS Taptic Engine. Expo recommends `performAndroidHapticsAsync` over the Android `Vibrator` simulation for haptic feedback ([Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)). These are haptic APIs, separate from audio playback; silent feedback therefore requires no sound API to be invoked.
- `expo-localization` reads device locale and can declare supported locales on both platforms, including per-app language selection; Expo's guide demonstrates translation libraries while recommending standard `Intl` APIs for numbers and dates ([Expo localization](https://docs.expo.dev/guides/localization/)). Norwegian text is application content, so framework support does not replace Norwegian copy review.
- Expo's documented unit stack is Jest/`jest-expo` plus React Native Testing Library; `jest-expo` mocks native Expo modules. Expo recommends end-to-end tests rather than UI snapshots and documents Maestro runs against a built Android APK or iOS app, locally or in EAS Workflows ([Expo unit testing](https://docs.expo.dev/develop/unit-testing/), [Expo Maestro E2E](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)).
- Expo's file system can read and write local files and offers system file picking on Android and iOS; its document directory is described as safe from system deletion ([Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)). `expo-sharing` can share a local file on Android and iOS ([Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)). These primitives enable a user-controlled export/import flow without requiring a server.

### Flutter

- Flutter has first-party Android/iOS application tooling. It can build an APK with `flutter build apk` and install one on a connected device with `flutter install` ([Flutter: Android deployment](https://docs.flutter.dev/deployment/android)).
- Flutter's official SQLite recipe uses the `sqflite` plugin for Android and iOS and recommends a database over a local file or key-value store when local data must be persisted and queried ([Flutter: persist data with SQLite](https://docs.flutter.dev/cookbook/persistence/sqlite)). The same SQLite durability facts above apply when writes are correctly transaction-bound ([SQLite: transactional guarantees](https://www.sqlite.org/transactional.html)).
- `MaterialApp.themeMode` defaults to `ThemeMode.system` and chooses the light or dark theme from the platform brightness ([Flutter `themeMode`](https://api.flutter.dev/flutter/material/MaterialApp/themeMode.html)). Flutter has first-class accessibility support and explicitly calls for TalkBack/VoiceOver, contrast, target-size, color-vision, and large-text testing ([Flutter accessibility](https://docs.flutter.dev/ui/accessibility)).
- Flutter's `HapticFeedback` API provides platform-default selection and impact feedback but states that it is intentionally terse and not intended for precise haptic control ([Flutter `HapticFeedback`](https://api.flutter.dev/flutter/services/HapticFeedback-class.html)). It is independent of sound playback.
- Flutter provides localization widgets/classes, generated localized resources, locale tracking, and localized Material/Cupertino widgets; non-English support must be configured because the default framework localization is US English ([Flutter internationalization](https://docs.flutter.dev/ui/internationalization)).
- Flutter has first-party unit, widget, and device/emulator integration-test layers. Its guidance recommends many unit/widget tests and enough integration tests for important flows; the built-in integration package cannot interact with some native platform UI ([Flutter testing](https://docs.flutter.dev/testing/overview)).

### Compose Multiplatform

- Compose Multiplatform lets shared Compose UI code run on Android and iOS ([JetBrains: relationship to Jetpack Compose](https://kotlinlang.org/docs/multiplatform/compose-multiplatform-and-jetpack-compose.html)). A generated project still has an Android application module and an Xcode iOS application that consumes the shared module; iOS builds require macOS and Xcode, and platform source sets remain available for platform APIs ([JetBrains: create a Compose Multiplatform app](https://kotlinlang.org/docs/multiplatform/compose-multiplatform-create-first-app.html)).
- Shared resources support strings and plurals, including locale-specific resources ([JetBrains: multiplatform resources](https://kotlinlang.org/docs/multiplatform/compose-multiplatform-resources-usage.html)).
- The official tutorial warns that Kotlin Multiplatform is not necessarily compatible with the latest Android Gradle Plugin and points to a compatibility table ([JetBrains: create a Compose Multiplatform app](https://kotlinlang.org/docs/multiplatform/compose-multiplatform-create-first-app.html)). This is additional version/toolchain coordination compared with the two leading options.

## Comparison against the requirements

| Requirement | Expo/React Native | Flutter | Compose Multiplatform |
|---|---|---|---|
| One Android+iOS codebase | Meets; shared React/TypeScript UI and logic, with native escape hatches | Meets; shared Dart UI and logic, with plugins/platform channels | Meets for shared Compose UI/logic, but retains separate app modules and platform source sets |
| Android-primary development | Strong Expo CLI, Android emulator/device, Gradle, and EAS path | Strong Flutter CLI, emulator/device, and Gradle path | Excellent Android lineage; iOS adds Kotlin/Native/Xcode integration |
| Direct APK during MVP | Explicit EAS profile or local Gradle/EAS build; direct URL or `adb` install | Direct `flutter build apk` and `flutter install` | Standard Android Gradle APK path, but more project/toolchain surface |
| Fully local/offline | Meets with `expo-sqlite`; no cloud runtime required | Meets with SQLite plugin | Meets with a multiplatform SQLite library, but that library choice adds another evaluation |
| Durable active workout | Strong with immediate SQLite transactions; reliability depends on application write design | Equally strong with SQLite transactions; reliability depends on application write design | Technically achievable; no requirement-specific advantage |
| Silent haptics | First-party Expo module; Android-specific semantic effects available | First-party basic platform-default API; less precise by design | Platform abstraction or platform-specific implementation required |
| System light/dark | Built-in runtime system preference | Built-in `ThemeMode.system` | Available through Compose/platform APIs; no material advantage |
| Accessibility | Broad native semantics, but must test both platform screen readers | First-class semantics/checklist, but must test both platform screen readers | Viable, but less evidence here of an end-to-end cross-platform accessibility workflow |
| Norwegian UI | Locale discovery plus chosen JS translation library; Bokmal/Nynorsk product scope still must be decided | Integrated generated localization workflow | Shared localized resources |
| Backup/restore path | SQLite serialization plus file picker/share primitives | SQLite plus Dart file/picker/share plugins | Feasible, but requires selecting and validating more libraries |
| Test/build fit | Fast TS unit/component tests plus APK-based Android E2E; cloud build optional | Cohesive unit/widget/integration stack and straightforward local APK build | Capable Gradle/Xcode stack, but highest setup/versioning complexity of these choices |

## Recommendations and rationale

The following are recommendations, not framework guarantees.

### Application stack

Choose Expo/React Native with TypeScript. It satisfies every fixed requirement with documented first-party modules, has an explicit direct-APK path, and keeps the MVP's native surface small. React Native itself recommends a framework for new apps, so use Expo rather than assembling bare React Native unless a discovered native requirement cannot be represented by Expo modules/config plugins.

Do not make EAS cloud services a runtime dependency. The application and SQLite data must work with networking disabled. EAS Build may be used for convenient signed preview APKs, while local Expo/Gradle builds preserve an exit path and support build debugging.

Flutter's main meaningful advantages are its cohesive SDK/test model and highly controlled cross-platform rendering. Its tradeoffs are adopting Dart and Flutter's widget ecosystem and using plugins for SQLite/file workflows. None of Trene's current requirements exploits a Flutter-only capability, so those advantages do not justify switching unless team skill or a prototype changes the cost assessment.

Compose Multiplatform is genuinely capable, particularly for a Kotlin/Compose team, but brings Gradle/Kotlin/Native/Xcode and compatibility coordination without a compensating benefit for this small offline CRUD/workout app. Reconsider it only if Kotlin expertise or future native Android integration becomes a dominant constraint.

### Local persistence

Use `expo-sqlite` directly, initially without an ORM. Model exercises, treningsokter, and sett relationally. Represent an active treningsøkt with durable status/timestamps in the same database, not as a separate serialized UI snapshot.

For each accepted user mutation, such as adding/editing/deleting a sett or ending a treningsøkt:

1. Validate the domain input.
2. Write all affected rows in one SQLite transaction.
3. Update visible application state only after commit, or reload it from the database.
4. On launch and foregrounding, derive the active treningsøkt from SQLite.

This makes SQLite the single source of truth and uses its atomic crash guarantees. A key-value store is acceptable for non-critical preferences such as dismissed hints, but using both key-value state and SQLite for the active treningsøkt would introduce synchronization and recovery ambiguity.

Use schema migrations from the first release and stable generated IDs rather than row-order assumptions. Enable foreign keys and test each migration against a fixture from every released schema version. WAL can improve general performance and is shown in Expo's setup guidance, but it does not remove the need for explicit transactions ([Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)).

### Backup and restore

Design for backup now, implement it after the MVP workflow is stable. Prefer a versioned, documented JSON export containing domain records, IDs, timestamps, units, export format version, and application/schema version over exposing a raw SQLite file. JSON is easier to validate, migrate, inspect, and import selectively; a raw serialized database is simpler but tightly couples restore compatibility to schema and SQLite configuration.

Create the export from a consistent database snapshot/transaction, write it to a document file, and invoke the platform share/save UI. Restore should parse and validate the entire file before making changes, then import in one transaction with an explicit replace-or-merge policy. SQLite also has snapshot-safe backup mechanisms for a future raw database backup if needed ([SQLite Backup API](https://www.sqlite.org/backup.html)); Expo supplies database serialization and local file primitives ([Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)).

### Test and build approach

- Run TypeScript checks, linting, Jest domain/repository tests, and React Native Testing Library component tests on every change. Keep domain calculations independent of React Native so they run quickly without native mocks.
- Do not infer persistence reliability from `jest-expo`, because it mocks native modules. Add tests that execute against real `expo-sqlite` on Android for migrations, transactions, constraints, active-workout recovery, and export/import round trips.
- Maintain a small Maestro Android suite against a built APK: start a treningsøkt, record sett, background/relaunch the app, verify recovery, complete the treningsøkt, switch system theme, and exercise core TalkBack-labelled controls. Include a deliberate force-stop/process-restart recovery test in the device test layer even if that step needs a small platform script outside Maestro.
- Use an Android emulator for repeatable CI and at least one physical Android device for haptics, TalkBack, lifecycle/process death, and install/upgrade testing. Haptic quality cannot be established by emulator tests alone.
- Before releases, run a smaller iOS simulator/device suite for the full critical workout flow, VoiceOver, system theme, Norwegian formatting, and haptics. A shared codebase does not eliminate platform behavior differences; React Native explicitly notes accessibility differences between Android and iOS ([React Native accessibility](https://reactnative.dev/docs/accessibility)).
- Configure separate EAS profiles for a directly installable MVP APK and eventual store builds. Keep a documented local Android build command as a fallback. Build the installable APK in CI only after fast tests pass, then run the Android E2E smoke suite against that exact artifact.

## Tradeoffs and unknowns

- **Team capability is unknown.** Existing React/TypeScript versus Flutter/Dart versus Kotlin experience can outweigh modest framework differences. Validate this before implementation starts.
- **Norwegian scope is unknown.** Decide whether the app supports only Bokmal (`nb`), Nynorsk (`nn`), both, or simply ships Norwegian text without runtime locale switching. Also define decimal input/display behavior for belastning.
- **Backup policy is unknown.** The destination (manual file, device cloud drive through the system picker, or an application-managed service), encryption requirement, merge/replace semantics, and retention are product/security decisions, not solved by SQLite.
- **Data sensitivity is unknown.** Local-only does not automatically mean encrypted. Decide whether training history warrants database/export encryption and how keys/recovery should work before enabling SQLCipher; Expo documents SQLCipher support but it requires a native build and is unavailable in Expo Go ([Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)).
- **Haptic acceptance is hardware-dependent.** Both stacks map to platform/device behavior, and iOS may suppress haptics under documented conditions such as Low Power Mode or disabled system haptics ([Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)). Test intended cues on target hardware and never make haptics the only confirmation.
- **Process-death behavior depends on write timing.** No framework preserves an in-memory edit that the application has not committed. Product design must define when partially entered fields become accepted durable data; the recommendation above persists accepted actions, not every keystroke.
- **iOS cannot remain untested until release.** Android-primary is efficient, but theme, accessibility, lifecycle, haptics, locale, and file-picker behavior are platform-specific enough to require recurring iOS validation.

## Decision

Proceed with a thin Expo/React Native TypeScript prototype using `expo-sqlite`. The prototype exit criteria should be: direct installation of a release-like APK; an entirely offline start-record-relaunch-resume-complete flow; verified Android process-death recovery; silent physical-device haptics; system theme switching; TalkBack-operable controls with Norwegian labels; and a demonstrated database export/import round trip. If these pass, the major technology risks in issue #55 are retired without committing the MVP to cloud infrastructure.
