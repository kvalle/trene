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

## Android smoke tests

Before starting work on any implementation ticket, verify that the Android smoke
environment is ready:

```sh
lsof -nP -iTCP:8081 -sTCP:LISTEN
adb devices -l
```

An Android emulator must be listed as `device`. If port 8081 is already in use,
assume the user owns that Metro process, notify them immediately, and wait for
them to stop it before implementation. If port 8081 is free, start Metro with
the following command and keep ownership of that process so it can be stopped
when work is complete:

```sh
mkdir -p .artifacts/expo
__UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo" npm start -- --clear
```

The redirected Expo home keeps Expo CLI state out of the sandbox-blocked
`~/.expo` directory. If the emulator is unavailable or Metro cannot be started,
notify the user immediately and wait. Do this before implementation so the user
gets an early warning.

When an Android emulator is running and the app is installed, cplt agents can
run the Maestro smoke suite through the host ADB server:

```sh
npm run smoke:android:sandbox
```

The command keeps Maestro state and debug output under the ignored
`.artifacts/maestro/` directory and connects to ADB at `127.0.0.1:5037`. Run
this during final verification when a change affects an existing smoke flow,
and extend `.maestro/smoke/` when a new cross-runtime user journey needs
coverage. The runner discovers its YAML files automatically.
