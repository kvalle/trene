# Project Instructions

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
4. Implement, test, and review the ticket on that branch. Never push ticket work
   directly to `main`.
5. Decide whether the ticket causes user-visible changes. For visible changes,
   capture before and after screenshots of every relevant screen, commit them
   under `docs/pr-screenshots/<issue-number>/`, and include them in the pull
   request description. Commit the implementation before capturing screenshots,
   then use this workspace for both versions: switch to detached `origin/main`
   for the before screenshots, switch back to the feature branch for the after
   screenshots, and commit the screenshots separately. Do not depend on another
   worktree where `main` may already be checked out. See
   `docs/pr-screenshots/README.md`. Reassess this after implementation if the
   scope changes; do not rely only on the initial classification.
6. Commit only the intended changes, push the branch, and create a pull request
   against `main`. Write a concise description of what changed and why so the
   result is easy to review. Include `Closes #<number>` in the pull request body.
7. Treat the ticket implementation as incomplete until the pull request exists
   and return its URL to the user.

If local changes prevent safely switching or creating branches, stop and ask the
user how to proceed rather than moving or discarding their work.

After pushing and creating the pull request, wait for its GitHub Actions workflow to complete. Use gh run view/gh run watch because fine-grained PATs may not permit gh pr checks. If a job fails, inspect its logs, fix the issue, push, and wait for the new run. Treat the ticket as incomplete and do not ask for review until every required job has succeeded. Return the PR URL and final check results.

## Android smoke tests

During ticket preflight, decide whether Android runtime verification is required
and verify that the emulator, ADB, Maestro, Metro when needed, and required test
fixtures are available before implementation starts. If a required local
prerequisite is unavailable, notify the user and resolve it before continuing.

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
