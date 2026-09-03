import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const readiness = join(root, "scripts/android-e2e-readiness.sh");

function run(scenario, attempts = 5) {
  const directory = mkdtempSync(join(tmpdir(), "android-readiness-"));
  const state = join(directory, "state");
  const log = join(directory, "adb.log");
  const adb = join(directory, "adb");
  mkdirSync(state);
  writeFileSync(adb, `#!/bin/bash
key="$(printf '%s' "$*" | tr ' /-' '___')"
count_file="$ANDROID_READINESS_TEST_STATE/$key"
count=0
[[ -f "$count_file" ]] && count=$(cat "$count_file")
count=$((count + 1))
printf '%s' "$count" > "$count_file"
printf '%s\n' "$*" >> "$ANDROID_READINESS_TEST_LOG"

case "\${1:-} \${2:-} \${3:-}" in
  "root  ") [[ "$ANDROID_READINESS_TEST_SCENARIO" != root-timeout && $count -ge 2 ]] ;;
  "get-state  ")
    [[ "$ANDROID_READINESS_TEST_SCENARIO" == adb-hang && $count -eq 1 ]] && sleep 10
    [[ "$ANDROID_READINESS_TEST_SCENARIO" != adb-timeout && $count -ge 2 ]] && printf 'device\n'
    ;;
  "shell getprop sys.boot_completed") [[ "$ANDROID_READINESS_TEST_SCENARIO" != boot-timeout && $count -ge 2 ]] && printf '1\n' || true ;;
  "shell id -u") [[ "$ANDROID_READINESS_TEST_SCENARIO" != root-identity-timeout && $count -ge 2 ]] && printf '0\n' || printf '2000\n' ;;
  "shell pm path") [[ "$ANDROID_READINESS_TEST_SCENARIO" != package-timeout && $count -ge 2 ]] && printf 'package:/system/framework/framework-res.apk\n' ;;
  "devices -l ") printf 'emulator-5554 device model:test\n' ;;
  "version  ") printf 'Android Debug Bridge test\n' ;;
  "get-serialno  ") printf 'emulator-5554\n' ;;
  "shell id ") printf 'uid=0(root)\n' ;;
  "shell getprop ") printf 'test-runtime\n' ;;
  *) true ;;
esac
`);
  chmodSync(adb, 0o755);

  const result = spawnSync("/bin/bash", [readiness, "ready"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      ANDROID_READINESS_ATTEMPTS: String(attempts),
      ANDROID_READINESS_COMMAND_TIMEOUT_SECONDS: "0.5",
      ANDROID_READINESS_INTERVAL_SECONDS: "0",
      ANDROID_READINESS_ARTIFACTS: join(directory, "diagnostics"),
      ANDROID_READINESS_TEST_LOG: log,
      ANDROID_READINESS_TEST_SCENARIO: scenario,
      ANDROID_READINESS_TEST_STATE: state,
    },
  });
  return { result, commands: readFileSync(log, "utf8"), directory };
}

test("waits through root restart and delayed Android runtime readiness", () => {
  const { result, commands, directory } = run("delayed-success");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Android runtime ready/);
  assert.ok(commands.match(/^shell id -u$/gm)?.length >= 3);
  assert.match(readFileSync(join(directory, "diagnostics", "runtime-identity.txt"), "utf8"), /serial=emulator-5554/);
});

test("bounds a hanging ADB readiness probe", () => {
  const startedAt = Date.now();
  const { result } = run("adb-hang");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - startedAt < 5000);
});

test("root-requiring entry points use the shared readiness boundary", () => {
  for (const [path, pattern] of [
    ["scripts/ci-android-offline.sh", /source scripts\/android-e2e-readiness\.sh/],
    ["scripts/run-android-backup-e2e.sh", /source scripts\/android-e2e-readiness\.sh/],
    [".github/workflows/cross-platform-android.yml", /bash scripts\/android-e2e-readiness\.sh/],
    [".github/workflows/release-qualification.yml", /bash scripts\/android-e2e-readiness\.sh/],
  ]) {
    assert.match(readFileSync(join(root, path), "utf8"), pattern, path);
  }
});

for (const [scenario, message] of [
  ["root-timeout", "ADB root command"],
  ["adb-timeout", "ADB reconnect"],
  ["boot-timeout", "Android boot completion"],
  ["root-identity-timeout", "stable root identity"],
  ["package-timeout", "package-manager readiness"],
]) {
  test(`reports and diagnoses ${scenario}`, () => {
    const { result, commands, directory } = run(scenario, 3);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Timed out waiting for ${message}`));
    assert.ok(commands.match(/^devices -l$/m));
    assert.ok(readFileSync(join(directory, "diagnostics", "adb-devices.txt"), "utf8"));
  });
}
