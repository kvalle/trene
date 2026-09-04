import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const readiness = join(root, "scripts/ios-e2e-readiness.sh");

function executable(path, contents) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function run(scenario, attempts = 5) {
  const directory = mkdtempSync(join(tmpdir(), "ios-readiness-"));
  const state = join(directory, "state");
  const log = join(directory, "commands.log");
  mkdirSync(state);

  executable(join(directory, "xcrun"), `#!/bin/bash
key="$(printf '%s' "$*" | tr ' /-' '___')"
count_file="$IOS_READINESS_TEST_STATE/$key"
count=0
[[ -f "$count_file" ]] && count=$(cat "$count_file")
count=$((count + 1))
printf '%s' "$count" > "$count_file"
printf 'xcrun %s\n' "$*" >> "$IOS_READINESS_TEST_LOG"
if [[ "$1 $2" == "simctl bootstatus" ]]; then
  [[ "$IOS_READINESS_TEST_SCENARIO" != boot-timeout && $count -ge 2 ]]
  exit $?
fi
exit 0
`);
  executable(join(directory, "maestro"), `#!/bin/bash
key="$(printf '%s' "$*" | tr ' /-' '___')"
count_file="$IOS_READINESS_TEST_STATE/$key"
count=0
[[ -f "$count_file" ]] && count=$(cat "$count_file")
count=$((count + 1))
printf '%s' "$count" > "$count_file"
printf 'maestro %s\n' "$*" >> "$IOS_READINESS_TEST_LOG"
if [[ "$1" == "--version" ]]; then
  printf '2.8.0\n'
  exit 0
fi
if [[ "$*" == *hierarchy* ]]; then
  [[ "$IOS_READINESS_TEST_SCENARIO" == driver-hang && $count -eq 1 ]] && sleep 10
  [[ "$IOS_READINESS_TEST_SCENARIO" != driver-timeout && $count -ge 2 ]]
  exit $?
fi
exit 0
`);

  const result = spawnSync("/bin/bash", [readiness, "ready", "test-udid"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      IOS_READINESS_ATTEMPTS: String(attempts),
      IOS_READINESS_COMMAND_TIMEOUT_SECONDS: "0.5",
      IOS_MAESTRO_PROBE_TIMEOUT_SECONDS: "0.5",
      IOS_READINESS_INTERVAL_SECONDS: "0",
      IOS_READINESS_ARTIFACTS: join(directory, "diagnostics"),
      IOS_READINESS_TEST_LOG: log,
      IOS_READINESS_TEST_SCENARIO: scenario,
      IOS_READINESS_TEST_STATE: state,
    },
  });
  return { result, commands: readFileSync(log, "utf8"), directory };
}

test("waits independently for simulator boot and Maestro driver readiness", () => {
  const { result, commands, directory } = run("delayed-success");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /simulator and Maestro driver ready/);
  assert.ok(commands.match(/xcrun simctl bootstatus test-udid -b/g)?.length >= 2);
  assert.ok(commands.match(/maestro --device test-udid hierarchy/g)?.length >= 2);
  assert.match(readFileSync(join(directory, "diagnostics", "maestro-version.txt"), "utf8"), /./);
});

test("bounds and retries a hanging Maestro driver probe", () => {
  const startedAt = Date.now();
  const { result } = run("driver-hang");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - startedAt < 5000);
});

for (const [scenario, message] of [
  ["boot-timeout", "iOS simulator boot and migration completion"],
  ["driver-timeout", "Maestro driver readiness"],
]) {
  test(`reports and diagnoses ${scenario}`, () => {
    const { result, commands, directory } = run(scenario, 3);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Timed out waiting for ${message}`));
    assert.match(commands, /xcrun simctl list devices -j/);
    assert.ok(readFileSync(join(directory, "diagnostics", "simulator-devices.json"), "utf8") !== undefined);
  });
}

test("the iOS runner retries readiness but invokes each product journey once", () => {
  const runner = readFileSync(join(root, "scripts/run-ios-e2e.sh"), "utf8");
  assert.match(runner, /wait_for_ios_runtime "\$udid"/);
  assert.doesNotMatch(runner, /wait_for_ios_condition[^\n]*maestro[^\n]*test/);
  assert.equal(runner.match(/maestro --device "\$udid" test --no-reinstall-driver/g)?.length, 2);
});

test("the native picker selects a backup once and leaves destination waits to callers", () => {
  const picker = readFileSync(join(root, ".maestro/e2e/ios/select-backup-file.yaml"), "utf8");
  assert.equal(picker.match(/id: "\$\{BACKUP_FILE\}, trene-backup"/g)?.length, 1);
  assert.doesNotMatch(picker, /waitForAnimationToEnd/);
  for (const [flow, destination] of [
    ["restore-success.yaml", "restore-preview"],
    ["damaged-backup.yaml", "data-error"],
    ["newer-backup.yaml", "data-error"],
    ["restore-failure.yaml", "restore-preview"],
    ["rollback-failure.yaml", "restore-preview"],
    ["storage-failure.yaml", "data-error"],
  ]) {
    const contents = readFileSync(join(root, ".maestro/e2e/ios", flow), "utf8");
    assert.match(contents, new RegExp(`file: select-backup-file\\.yaml[\\s\\S]*extendedWaitUntil:[\\s\\S]*id: "${destination}"`), flow);
  }
});

test("restore setup enters the exercise name without lossy bulk input", () => {
  const cases = [
    ["restore-success.yaml", "Utdatert"],
    ["damaged-backup.yaml", "Beholdes"],
    ["newer-backup.yaml", "Beholdes"],
    ["restore-failure.yaml", "Beholdes"],
    ["storage-failure.yaml", "Beholdes"],
  ];
  for (const [name, value] of cases) {
    const flow = readFileSync(join(root, ".maestro/e2e/ios", name), "utf8");
    const commands = [...value].map((character) => `- inputText: "${character}"`).join("\n");
    assert.match(flow, new RegExp(commands), name);
    assert.doesNotMatch(flow, new RegExp(`inputText: "${value}"`), name);
  }
});

test("picker cancellation avoids the duplicated native Cancel node", () => {
  const flow = readFileSync(join(root, ".maestro/e2e/ios/picker-cancellation.yaml"), "utf8");
  assert.doesNotMatch(flow, /tapOn: "Cancel"/);
  assert.match(flow, /point: "76%,13%"[\s\S]*id: "restore-from-file"/);
});
