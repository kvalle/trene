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
2. Start from an up-to-date `origin/main` and create a dedicated branch named
   `issue-<number>-<short-description>`. If a branch or open pull request already
   exists for the ticket, continue there instead of creating a duplicate.
3. Implement, test, and review the ticket on that branch. Never push ticket work
   directly to `main`.
4. Decide whether the ticket causes user-visible changes. For visible changes,
   capture before and after screenshots of every relevant screen, commit them
   under `docs/pr-screenshots/<issue-number>/`, and include them in the pull
   request description. See `docs/pr-screenshots/README.md`.
5. Commit only the intended changes, push the branch, and create a pull request
   against `main`. Write a concise description of what changed and why so the
   result is easy to review. Include `Closes #<number>` in the pull request body.
6. Treat the ticket implementation as incomplete until the pull request exists
   and return its URL to the user.

If local changes prevent safely switching or creating branches, stop and ask the
user how to proceed rather than moving or discarding their work.

After pushing and creating the pull request, wait for its GitHub Actions workflow to complete. Use gh run view/gh run watch because fine-grained PATs may not permit gh pr checks. If a job fails, inspect its logs, fix the issue, push, and wait for the new run. Treat the ticket as incomplete and do not ask for review until every required job has succeeded. Return the PR URL and final check results.

## Android smoke tests

Do not prepare the local Android smoke environment before implementing a ticket.
Wait for the smoke tests to run in CI. If they fail, inspect and download the CI
logs before deciding whether local reproduction is needed.

Run the smoke tests locally only when needed for diagnosis. Before doing so,
check whether Metro's port is available:

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
