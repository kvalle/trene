# Project Instructions

## Git commits in the sandbox

The sandbox cannot access the 1Password signing agent. If a commit fails because
the signing socket is unavailable, create the commit unsigned with
`git -c commit.gpgsign=false commit ...`.

## Wayfinder on GitHub

The cplt sandbox blocks `gh api graphql`. Use the GitHub REST API to inspect
Wayfinder issue relationships instead:

- Child issues: `/repos/{owner}/{repo}/issues/{number}/sub_issues`
- Blocking issues: `/repos/{owner}/{repo}/issues/{number}/dependencies/blocked_by`

Use the current GitHub API version header and pagination, for example:

```sh
gh api \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  '/repos/kvalle/trene/issues/1/sub_issues?per_page=100'
```

The sandbox also blocks `gh api user`. To get the active GitHub login, use:

```sh
gh auth status --active --hostname github.com \
  --json hosts --jq '.hosts["github.com"][0].login'
```

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `kvalle/trene`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-role label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.

### Design system

The first draft of the design system is documented in
`docs/design-system/README.md`, with an interactive component catalog in
`docs/design-system/catalog/`. Read these before implementing or reviewing any
user-interface change. Reuse the documented components, variants, tokens, and
interaction patterns.

If a requested change needs a new component or variant, or needs to deviate from
the design system, stop and discuss that design decision with the user before
implementation. Do not introduce the addition or deviation silently.

When a new component is added in `src/ui/`, also add it to the runtime component library in
`src/catalog/ComponentCatalog.tsx`: add an entry in the overview group (under the correct
`docs/design-system/README.md` group) and a detail screen with name / description / “Bruk når”
plus all variants and states side by side, using generic isolated examples (no app-screen
strings).

## Ticket implementation workflow

When the user asks to implement a GitHub ticket, whether in natural language or
through an implementation skill, deliver the work through a pull request:

1. Fetch the ticket and its comments before making changes.
2. Before implementation, identify every required verification step and confirm
   that the necessary local tools, runtimes, credentials, devices, emulators,
   ports, fixtures, and services are available. Resolve missing prerequisites or
   ask the user for help before starting work rather than discovering the blocker
   midway through implementation.
3. Start from an up-to-date `origin/main` and create a dedicated branch named
   `issue-<number>-<short-description>`. If a branch or open pull request already
   exists for the ticket, continue there instead of creating a duplicate.
4. For any user-interface change, review `docs/design-system/README.md` and the
   component catalog before implementation. Confirm during review that the
   result follows the design system. If it needs a new component or variant, or
   an exception to the system, agree that change with the user first.
5. Implement, test, and review the ticket on that branch. Never push ticket work
   directly to `main`.
6. Decide whether the ticket causes user-visible changes. For visible changes,
   capture before and after screenshots of every relevant screen, commit them
   under `docs/pr-screenshots/<issue-number>/`, and include them in the pull
   request description. Commit the implementation before capturing screenshots,
   then use this workspace for both versions: switch to detached `origin/main`
   for the before screenshots, switch back to the feature branch for the after
   screenshots, and commit the screenshots separately. Do not depend on another
   worktree where `main` may already be checked out. See
   `docs/pr-screenshots/README.md`. Reassess this after implementation if the
   scope changes; do not rely only on the initial classification.
7. Commit only the intended changes, push the branch, and create a pull request
   against `main`. Write a concise description of what changed and why so the
   result is easy to review. Include `Closes #<number>` in the pull request body.
8. Treat the ticket implementation as incomplete until the pull request exists
   and return its URL to the user.

If local changes prevent safely switching or creating branches, stop and ask the
user how to proceed rather than moving or discarding their work.

After pushing and creating the pull request, wait for its GitHub Actions workflow
to complete. Fine-grained PATs may not permit `gh pr checks`, so poll structured
status periodically with `gh run view <id> --json status,conclusion,jobs`.
Avoid `gh run watch`: its frequent repeated output wastes context. Fetch job
logs only when a job fails. Fix failures, push, and wait for the new run. Treat
the ticket as incomplete and do not ask for review until every required job has
succeeded. Return the PR URL and final check results.

## Android smoke tests

During ticket preflight, decide whether Android runtime verification is required
and verify that the emulator, ADB, Maestro, Metro when needed, and required test
fixtures are available before implementation starts. If a required local
prerequisite is unavailable, notify the user and resolve it before continuing.
If implementing the ticket may require building an APK, also verify that the
Android build broker is running before implementation:

```sh
python3 scripts/request-android-build.py --broker-status
```

This status check does not queue a build. If it fails because the broker is not
running or its heartbeat is stale, tell the user that they must start the broker
outside the sandbox and wait before proceeding.

### Android build broker

The user can explicitly start an Android build broker outside the cplt sandbox.
When it is running, use it instead of trying to run the native APK build inside
the sandbox:

```sh
python3 scripts/request-android-build.py
```

Run the command from this repository. The client validates that the broker has a
fresh heartbeat for this exact repository, records the current Git `HEAD` and a
digest of all tracked and non-ignored worktree files, queues one build, and
prints JSON containing a `requestId` and repository-relative `statusPath`. A
missing or stale heartbeat means the broker is not available; ask the user to
start it outside the sandbox rather than trying to start it yourself.

Poll the printed `statusPath` until it reaches a terminal state. Its directory
also contains `build.log`; on success, `status.json` has `state: "passed"` and an
`artifactPath` relative to that directory, normally `app-smoke.apk`, together
with its SHA-256 and byte size. On failure or rejection, report the status,
`errorCode` when present, and the relevant end of `build.log`.

Build requests are tied to the source identity captured by the client. Avoid
changing tracked or non-ignored files while a request is being accepted or
built, and submit a new request after any source change. Broker runtime files,
logs, and APKs live under the ignored `.artifacts/android/` directory.

For Android native, file-flow, database-lifecycle, or Maestro changes, test
locally before pushing. Run the narrowest affected Maestro flow while iterating,
then run the complete relevant smoke suite locally before using CI as the final
platform verification. Do not use repeated full CI runs as the primary debugging
loop. If sandbox restrictions make local native testing impossible, state the
constraint and use one focused CI job or flow before running the full matrix.

Before running smoke tests locally, check whether Metro's port is available:

```sh
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

If port 8081 is already in use, assume the user owns that Metro process, notify
them, and wait for them to stop it. If port 8081 is free, start Metro with the
following command and keep ownership of that process so it can be stopped when
local testing is complete:

```sh
npm run start:android
```

The command verifies the emulator, configures the ADB reverse tunnel, keeps Expo
state under `.artifacts/expo/`, binds Metro for IPv4 access, and advertises
`127.0.0.1` to the app. If it fails, notify the user and wait.

When an Android emulator is running and the app is installed, cplt agents can
run the Maestro smoke suite through the host ADB server:

```sh
npm run smoke:android
```

The command verifies the emulator and reverse tunnel, keeps Maestro state and
debug output under the ignored `.artifacts/maestro/` directory, and connects to
ADB at `127.0.0.1:5037` so the same command works locally and in the cplt
sandbox. Extend `.maestro/smoke/` when a new cross-runtime user journey needs
coverage. The runner discovers its YAML files automatically.

### Backup and restore interruptions

Native backup and restore interruption tests require a rootable API 34 AOSP or
Google APIs emulator. Google Play images do not support `adb root`. The bundled
release smoke APK does not require Metro.

Run interruption flows one at a time locally:

```sh
ANDROID_BACKUP_INTERRUPTION_FLOW=<flow> npm run smoke:android:backup
```

Supported flows are `export-cleanup`, `before-replacement`,
`around-activation`, and `after-replacement`.

## iOS smoke tests

During ticket preflight, decide whether iOS runtime verification is required. If
it is, check the iOS build broker before implementation:

```sh
python3 scripts/request-ios-smoke.py --broker-status
```

This status check does not queue a smoke test. If the broker is absent, stale, or
targets another repository, ask the user to start it outside cplt and wait. Never
start the broker from the agent session, nest cplt, grant Simulator access to the
current session, or run Xcode, Simulator, or Maestro directly as a workaround.

Submit the allowlisted flow from this repository:

```sh
python3 scripts/request-ios-smoke.py --flow restore-success
```

The client prints compact JSON containing a `requestId` and repository-relative
`statusPath`. Poll that `status.json` until its `state` is `passed`, `failed`,
`rejected`, or `stale`. On failure, rejection, or staleness, report the terminal
state, `errorCode` when present, and only the relevant bounded output from the
result directory's `build.log` or `smoke.log`.

Requests are bound to the current Git `HEAD` and all tracked and non-ignored
worktree files. Keep the worktree stable while a request runs and submit a new
request after any source change. Use one focused allowlisted flow while
iterating; when more flows become allowlisted, submit each required final flow as
an individual request.
