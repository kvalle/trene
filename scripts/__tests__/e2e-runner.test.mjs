import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const runner = join(root, "scripts/run-android-e2e.sh");
const qualificationRunner = join(root, "scripts/run-android-qualification.sh");

function executable(directory, name, body) {
  const path = join(directory, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

function run(group, commands, environment = {}) {
  const directory = mkdtempSync(join(tmpdir(), "e2e-runner-"));
  const log = join(directory, "commands.log");
  for (const [name, body] of Object.entries(commands)) executable(directory, name, body);
  const result = spawnSync("/bin/bash", [runner, group], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ...environment,
      PATH: `${directory}:${process.env.PATH}`,
      E2E_TEST_LOG: log,
    },
  });
  return { result, log: readFileSync(log, "utf8") };
}

test("package scripts expose the shared E2E interface", () => {
  const { scripts } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(scripts["e2e:android"], "bash scripts/run-android-e2e.sh");
  assert.equal(scripts["e2e:android:smoke"], "bash scripts/run-android-e2e.sh smoke");
  assert.equal(scripts["e2e:android:standalone"], "bash scripts/run-android-e2e.sh standalone");
  assert.equal(scripts["e2e:android:backup"], "bash scripts/run-android-e2e.sh backup");
  assert.equal(scripts["e2e:ios"], "bash scripts/run-ios-e2e.sh");
});

test("aggregate Android E2E runs every group exactly once", () => {
  const { result, log } = run("all", {
    npm: 'printf "%s %s\\n" "${ANDROID_BACKUP_INTERRUPTION_FLOW:-unset}" "$*" >> "$E2E_TEST_LOG"',
  }, { ANDROID_BACKUP_INTERRUPTION_FLOW: "export-cleanup" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(log.trim().split("\n"), [
    "export-cleanup run e2e:android:smoke",
    "export-cleanup run e2e:android:standalone",
    "none run e2e:android:backup",
  ]);
});

test("focused Android backup E2E selects only the backup runner", () => {
  const { result, log } = run("backup", {
    bash: 'printf "%s\\n" "$*" >> "$E2E_TEST_LOG"',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(log.trim(), "scripts/run-android-backup-e2e.sh");
});

for (const group of ["smoke", "standalone"]) {
  test(`focused Android ${group} E2E selects only its own flows`, () => {
    const { result, log } = run(group, {
      adb: 'if [ "$1" = devices ]; then printf "emulator-5554\\tdevice\\n"; elif [ "$1" = reverse ] && [ "$2" = --list ]; then printf "emulator-5554 tcp:8081 tcp:8081\\n"; fi',
      maestro: 'printf "%s\\n" "$*" >> "$E2E_TEST_LOG"',
      sleep: ":",
    });
    assert.equal(result.status, 0, result.stderr);
    const commands = log.trim().split("\n").filter((command) => command.startsWith("test "));
    assert.ok(commands.length > 0);
    assert.ok(commands.every((command) => command.includes(`.maestro/e2e/android/${group}/`)));
    assert.doesNotMatch(commands[0], /--no-reinstall-driver/);
    assert.ok(commands.slice(1).every((command) => command.includes("--no-reinstall-driver")));
  });
}

test("unknown Android E2E groups are rejected before commands run", () => {
  const result = spawnSync("bash", [runner, "qualification"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown Android E2E group: qualification/);
});

for (const group of ["smoke", "standalone", "backup"]) {
  test(`CI qualification dispatches ${group} without the aggregate command`, () => {
    const directory = mkdtempSync(join(tmpdir(), "qualification-runner-"));
    const log = join(directory, "commands.log");
    executable(directory, "adb", 'if [ "$1" = devices ]; then printf "emulator-5554\\tdevice\\n"; fi');
    executable(directory, "npm", 'printf "%s %s\\n" "${ANDROID_BACKUP_INTERRUPTION_FLOW:-unset}" "$*" >> "$E2E_TEST_LOG"');
    const result = spawnSync("/bin/sh", [qualificationRunner], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        E2E_TEST_LOG: log,
        ANDROID_QUALIFICATION_SUITE: group,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const expectedPrefix = group === "backup" ? "none" : "unset";
    assert.equal(readFileSync(log, "utf8").trim(), `${expectedPrefix} run e2e:android:${group}`);
  });
}
